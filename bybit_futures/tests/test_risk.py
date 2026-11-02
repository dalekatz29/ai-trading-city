import contextlib
from datetime import date
from decimal import Decimal as D
import multiprocessing
from pathlib import Path
import tempfile
import threading
import time
import unittest
from unittest.mock import Mock

from bybit_futures.risk import RiskError, RiskState


TODAY = date(2026, 1, 20)


def limits(**updates):
    values = dict(qty="0.03", price="1000", positions=[], open_orders=[],
                  marks={"BTCUSDT": "50000", "ETHUSDT": "1000"},
                  realized_today="0", utc_day=TODAY.isoformat(),
                  max_position_usdt="100", max_daily_loss_usdt="10")
    return {**values, **updates}


def kill_in_child(path, result):
    try:
        RiskState(path).kill()
        result.put("killed")
    except Exception as exc:
        result.put(type(exc).__name__)


class RiskTests(unittest.TestCase):
    def setUp(self):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        self.path = Path(temp.name) / "risk.db"
        self.state = RiskState(self.path, "test-account", today=lambda: TODAY)
        self.send = Mock(return_value={"orderId": "mock"})

    def enter(self, name="entry-1", **changes):
        with self.state.entry(name, "ETHUSDT") as gate:
            metrics = gate.check_entry(**limits(**changes))
            self.assertEqual(gate.dispatch(self.send), {"orderId": "mock"})
        return metrics

    def test_gross_exposure_both_assets_and_directions(self):
        pos = [{"symbol":"BTCUSDT","side":"Sell","size":"0.001","unrealisedPnl":"-1"}]
        orders = [
            {"symbol":"ETHUSDT","reduceOnly":False,"leavesQty":"0.02","price":"1100","triggerPrice":"0"},
            {"symbol":"BTCUSDT","reduceOnly":True,"leavesQty":"0.001","price":"50000"}
        ]
        with self.assertRaisesRegex(RiskError, "notional"):
            self.enter(positions=pos, open_orders=orders)
        m = self.enter(positions=pos, open_orders=orders, qty="0.028")
        self.assertEqual(m["projected_exposure"], D("100"))
        self.assertEqual(m["daily_loss"], D("1"))
        self.assertEqual(self.send.call_count, 1)

    def test_bad_numbers_or_unverified_open_orders_cannot_place(self):
        for kw in [
            {"realized_today": "NaN"}, {"qty": "0"}, {"price": "-1"},
            {"marks":{"ETHUSDT":"1000"}}, {"marks":{"BTCUSDT":"1","ETHUSDT":"Infinity"}},
            {"open_orders":[{"symbol":"BTCUSDT","reduceOnly":"false","leavesQty":"0.01"}]},
            {"open_orders":[{"symbol":"BTCUSDT","reduceOnly":False,"leavesQty":"0"}]},
            {"positions":[{"symbol":"ETHUSDT","side":"Buy","size":"1","unrealisedPnl":""}]}
        ]:
            with self.subTest(kw=kw), self.assertRaises(RiskError):
                self.enter(**kw)
        self.send.assert_not_called()
        self.assertEqual(self.state.pending(), [])

    def test_daily_breach_counts_unrealized_losses_and_latches_across_restart(self):
        positions=[{"symbol":"ETHUSDT","side":"Buy","size":"0.001","unrealisedPnl":"-4"},
                   {"symbol":"BTCUSDT","side":"Sell","size":"0.0001","unrealisedPnl":"40"}]
        with self.assertRaisesRegex(RiskError, "Daily loss"):
            self.enter(realized_today="-6", positions=positions)
        self.state = RiskState(self.path, "test-account", today=lambda: TODAY)
        with self.assertRaisesRegex(RiskError, "Daily loss"):
            self.enter(realized_today="99")
        self.send.assert_not_called()
        tomorrow = date(2026, 1, 21)
        self.state = RiskState(self.path, "test-account", today=lambda: tomorrow)
        self.enter(utc_day=tomorrow.isoformat())
        self.assertEqual(self.send.call_count, 1)

    def test_missing_check_expired_context_and_binding_do_not_send(self):
        unbound = RiskState(self.path, today=lambda: TODAY)
        with self.assertRaisesRegex(RiskError, "Bind"):
            with unbound.entry("entry-1", "ETHUSDT"):
                pass
        with self.assertRaisesRegex(RiskError, "different demo account"):
            unbound.bind_account("other")
        with self.state.entry("entry-1","ETHUSDT") as gate:
            with self.assertRaises(RiskError):
                gate.dispatch(self.send)
            with self.assertRaisesRegex(RiskError, "UTC day"):
                gate.check_entry(**limits(utc_day="2026-01-19"))
            gate.check_entry(**limits())
        with self.assertRaises(RiskError):
            gate.dispatch(self.send)
        self.send.assert_not_called()

    def test_lost_ack_is_pending_until_verified_terminal_and_link_never_reused(self):
        self.send.side_effect = TimeoutError()
        with self.assertRaises(TimeoutError):
            self.enter()
        self.state = RiskState(self.path, "test-account", today=lambda: TODAY)
        self.assertEqual(self.state.pending(), [("entry-1","ETHUSDT")])
        with self.assertRaises(RiskError):
            self.enter("new-entry")
        self.state.kill()
        with self.assertRaises(RiskError):
            self.state.resume()
        self.state.settle("entry-1")
        self.state.resume()
        with self.assertRaises(RiskError):
            self.enter()
        self.send.side_effect = None
        self.enter("new-entry")
        self.assertEqual(self.send.call_count, 2)

    def test_two_simultaneous_preflights_cannot_submit_on_the_same_snapshot(self):
        with contextlib.ExitStack() as stack:
            first = stack.enter_context(self.state.entry("buy-1","ETHUSDT"))
            second = stack.enter_context(self.state.entry("buy-2","ETHUSDT"))
            first.check_entry(**limits())
            second.check_entry(**limits())
            first.dispatch(self.send)
            self.state.settle("buy-1")   # even if another caller quickly settled it
            with self.assertRaises(RiskError):
                second.dispatch(self.send)
        self.assertEqual(self.send.call_count, 1)

    def test_second_process_kills_during_slow_preflight_without_credentials(self):
        with self.state.entry("slow","ETHUSDT") as gate:
            gate.check_entry(**limits())
            ctx = multiprocessing.get_context("spawn")
            result = ctx.Queue()
            child = ctx.Process(target=kill_in_child, args=(self.path, result))
            child.start()
            try:
                self.assertEqual(result.get(timeout=15), "killed")
                child.join(5)
                self.assertEqual(child.exitcode, 0)
            finally:
                if child.is_alive():
                    child.kill()
                    child.join()
                result.close()
            with self.assertRaisesRegex(RiskError, "kill switch"):
                gate.dispatch(self.send)
        self.assertTrue(RiskState(self.path).killed())
        self.send.assert_not_called()

    def test_kill_immediately_latches_and_drains_prior_network_dispatch(self):
        started, release, returned = threading.Event(), threading.Event(), threading.Event()
        failures = []

        def send():
            started.set()
            if not release.wait(10):
                raise TimeoutError("test release timed out")

        def submit():
            try:
                with self.state.entry("in-flight","ETHUSDT") as gate:
                    gate.check_entry(**limits())
                    gate.dispatch(send)
            except Exception as err:
                failures.append(err)

        def kill():
            self.state.kill()
            returned.set()

        sub_thread, kill_thread = threading.Thread(target=submit), threading.Thread(target=kill)
        sub_thread.start()
        self.assertTrue(started.wait(5))
        kill_thread.start()
        try:
            deadline = time.monotonic() + 4
            while not self.state.killed() and time.monotonic() < deadline:
                time.sleep(0.01)
            self.assertTrue(self.state.killed())
            self.assertFalse(returned.is_set())
        finally:
            release.set()
            sub_thread.join(5)
            kill_thread.join(5)
        self.assertTrue(returned.is_set())
        self.assertFalse(failures)
        self.assertEqual(self.state.pending(), [("in-flight","ETHUSDT")])

