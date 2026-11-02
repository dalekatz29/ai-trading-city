from datetime import datetime, timezone
from decimal import Decimal as D
import os
from pathlib import Path
import tempfile
import time
import unittest
from unittest.mock import Mock, patch

from bybit_futures.client import DemoFutures
from bybit_futures.market import Instrument
from bybit_futures.risk import RiskError, RiskState
from bybit_futures.transport import DemoError, OrderRejected


class ClientTests(unittest.TestCase):
    def setUp(self):
        folder = tempfile.TemporaryDirectory()
        self.addCleanup(folder.cleanup)
        self.now = time.time_ns() // 1_000_000
        state = RiskState(Path(folder.name) / "state.db", today=lambda:datetime.fromtimestamp(self.now/1000,timezone.utc).date())
        env = patch.dict(os.environ, {}, clear=True)
        env.start()
        self.addCleanup(env.stop)
        self.t = Mock()
        self.t.call.side_effect = lambda op, **kw: {"get_api_key_information":{"userID":123},
            "get_wallet_balance":{"list":[{"accountType":"UNIFIED"}]}}[op]
        self.t._write.side_effect = lambda op, **kw: {"orderId":"demo-id","orderLinkId":kw.get("orderLinkId")}
        self.app=DemoFutures(self.t,state,"100","10")
        self.m=self.app.market=Mock()
        self.m.server_time_ms.return_value=self.now
        self.m.instrument.side_effect=lambda s: Instrument(s,D("0.001"),D("0.001"),D("10"),D("10"),
                                                          D("0.1"),D(5),D(1),D(2000000))
        self.m.mark.side_effect=lambda s: D(50000) if s=="BTCUSDT" else D(2000)
        self.m.open_orders.return_value=[]
        self.m.positions.side_effect=lambda s, **kw: [{"symbol":s,"positionIdx":0,"size":"0","side":"",
                                                       "unrealisedPnl":"0","updatedTime":str(self.now)}]
        self.m.realized_today.return_value=D(0)
        self.m.order_rows.return_value=[]

    def enable(self):
        os.environ["DEMO_TRADING_ENABLED"]="true"

    def order(self, **opts):
        return self.app.place_limit("ETHUSDT","Buy","0.02","2000",order_link_id="case-1",**opts)

    def test_connectivity_is_read_only_even_when_flag_is_set(self):
        self.enable()
        self.assertTrue(self.app.check()["wallet_verified"])
        self.assertEqual([c.args[0] for c in self.t.call.call_args_list],
                         ["get_wallet_balance","get_api_key_information"])
        self.t._write.assert_not_called()

    def test_only_verified_uid_can_bind_the_state(self):
        self.t.call.side_effect=DemoError("Demo authentication failed.")
        with self.assertRaises(DemoError):
            self.app.check()
        self.app.state.bind_account("bybit-demo-new-account")

    def test_disarmed_all_writes_rejected_kill_local_only(self):
        for attempt in (self.order,lambda:self.app.cancel("ETHUSDT","x"),lambda:self.app.close("BTCUSDT",order_link_id="x"),
                        lambda:self.app.protect("ETHUSDT",stop_loss=1,take_profit=2),self.app.resume):
            with self.assertRaises(DemoError):
                attempt()
        self.assertTrue(self.app.kill()["kill_latched"])
        self.t._write.assert_not_called()

    def test_open_orders_validate_both_exposures_and_do_not_repeat_while_pending(self):
        self.enable()
        self.order(stop_loss="1800",take_profit="2200")
        method=self.t._write.call_args
        self.assertEqual(method.args,("place_order",))
        self.assertEqual((method.kwargs["category"],method.kwargs["positionIdx"],method.kwargs["reduceOnly"]),("linear",0,False))
        self.assertEqual((method.kwargs["slTriggerBy"],method.kwargs["tpTriggerBy"]),("MarkPrice","MarkPrice"))
        with self.assertRaises(RiskError):
            self.order()
        self.assertEqual(self.t._write.call_count,1)
        report=self.app.kill()
        self.assertEqual(report["cancellations"],[{"order_link_id":"case-1","status":"cancellation requested"}])
        self.assertEqual(self.t._write.call_args.args,("cancel_order",))
        with self.assertRaises(RiskError):
            self.app.resume()

    def test_lost_ack_does_not_automatically_resubmit(self):
        self.enable()
        self.t._write.side_effect=DemoError("timeout")
        with self.assertRaisesRegex(DemoError,"case-1"):
            self.order()
        self.assertEqual(self.app.state.pending(),[("case-1","ETHUSDT")])
        with self.assertRaises(RiskError):
            self.order()
        self.t._write.assert_called_once()

    def test_definitive_rejection_releases_risk_but_id_remains_used(self):
        self.enable()
        self.t._write.side_effect=OrderRejected("rejected")
        with self.assertRaises(OrderRejected):
            self.order()
        self.assertFalse(self.app.state.pending())
        with self.assertRaises(RiskError):
            self.order()

    def test_partial_fill_reconciliation_waits_for_executions_and_position(self):
        self.enable()
        self.order()
        history={"orderId":"ex","orderStatus":"Cancelled","cumExecQty":"0.01","updatedTime":str(self.now+800)}
        fill={"orderId":"ex","execId":"fill","execType":"Trade","execQty":"0.01","execTime":str(self.now)}
        self.m.order_rows.side_effect=lambda method,*_: [history] if method=="get_order_history" else []
        self.assertFalse(self.app.reconcile()[0]["released"])
        self.m.order_rows.side_effect=lambda method,*_: [history] if method=="get_order_history" else [fill]
        self.m.positions.side_effect=None
        self.m.positions.return_value=[{"updatedTime":str(self.now-1)}]
        self.assertFalse(self.app.reconcile()[0]["released"])
        self.m.positions.return_value=[{"updatedTime":str(self.now)}]
        self.assertTrue(self.app.reconcile()[0]["released"])

    def test_long_short_protection_and_reduce_only_close(self):
        self.enable()
        self.m.positions.side_effect=None
        self.m.positions.return_value=[{"symbol":"ETHUSDT","side":"Sell","size":"0.02"}]
        self.app.protect("ETHUSDT",stop_loss="2100",take_profit="1900")
        self.assertEqual(self.t._write.call_args.kwargs["tpslMode"],"Full")
        with self.assertRaises(ValueError):
            self.app.protect("ETHUSDT",stop_loss="1900",take_profit="2100")
        self.app.state.kill()
        with self.assertRaises(ValueError):
            self.app.close("ETHUSDT",order_link_id="exit-1",qty="0.03")
        self.app.close("ETHUSDT",order_link_id="exit-1",qty="0.01")
        kw=self.t._write.call_args.kwargs
        self.assertEqual((kw["side"],kw["qty"],kw["orderType"],kw["reduceOnly"]),("Buy","0.01","Market",True))

    def test_kill_during_protection_preflight_blocks_the_final_write(self):
        self.enable()
        self.m.positions.side_effect=None
        self.m.positions.return_value=[{"symbol":"ETHUSDT","side":"Buy","size":"0.02"}]
        def mark_after_kill(symbol):
            self.app.state.kill()
            return D(2000)
        self.m.mark.side_effect=mark_after_kill
        with self.assertRaises(RiskError):
            self.app.protect("ETHUSDT",stop_loss="1900",take_profit="2100")
        self.t._write.assert_not_called()

    def test_daily_loss_and_stale_preflight_never_submit(self):
        self.enable()
        self.m.server_time_ms.side_effect=[self.now,self.now+11000]
        with self.assertRaises(RiskError):
            self.order()
        self.m.server_time_ms.side_effect=None
        self.m.realized_today.return_value=D(-11)
        with self.assertRaises(RiskError):
            self.order()
        self.m.realized_today.return_value=D(0)
        with self.assertRaises(RiskError):
            self.order()
        self.t._write.assert_not_called()

