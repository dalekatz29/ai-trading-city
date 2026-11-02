import unittest
from decimal import Decimal
from unittest.mock import Mock, call

from bybit_futures.market import DAY_MS, Market
from bybit_futures.transport import DemoError


SYMBOL = "BTCUSDT"
NOW = 1_893_501_123_456


def page(rows, cursor="", linear=True):
    result = {"list": rows, "nextPageCursor": cursor}
    if linear:
        result["category"] = "linear"
    return result


def specification(**updates):
    row = dict(symbol=SYMBOL, contractType="LinearPerpetual", settleCoin="USDT",
               quoteCoin="USDT", status="Trading", lotSizeFilter={
                   "minOrderQty":"0.001", "maxOrderQty":"100", "maxMktOrderQty":"10",
                   "qtyStep":"0.001", "minNotionalValue":"5"
               }, priceFilter={"minPrice":"0.1", "maxPrice":"2000000", "tickSize":"0.1"})
    return {**row, **updates}


def order(order_id="a", **updates):
    row = dict(symbol=SYMBOL, orderId=order_id, orderLinkId="", side="Buy", orderType="Limit",
               orderStatus="New", reduceOnly=False, closeOnTrigger=False, stopOrderType="UNKNOWN",
               qty="0.01", leavesQty="0.01", price="95000", triggerPrice="")
    return {**row, **updates}


def entry(key, kind, net, **updates):
    return dict({"id":key, "type":kind, "symbol":SYMBOL, "transactionTime":str(NOW - 10),
                 "category":"linear", "currency":"USDT", "change":net}, **updates)


class MarketTests(unittest.TestCase):
    def setUp(self):
        self.transport = Mock()
        self.market = Market(self.transport, clock_ms=lambda: NOW)

    def test_only_supported_symbols_and_linear_active_instruments(self):
        for method in (self.market.instrument, self.market.mark, self.market.positions, self.market.open_orders):
            with self.assertRaises(DemoError):
                method("BTCUSD")
        self.transport.call.assert_not_called()
        for bad in ({"contractType":"LinearFutures"}, {"quoteCoin":"USDC"}, {"settleCoin":"BTC"},
                    {"status":"Settling"}, {"symbol":"ETHUSDT"}, {"lotSizeFilter":{}},
                    {"priceFilter":{"minPrice":"1", "maxPrice":"100", "tickSize":"NaN"}}):
            self.transport.call.return_value = page([specification(**bad)])
            with self.subTest(bad=bad), self.assertRaises(DemoError):
                self.market.instrument(SYMBOL)

    def test_instrument_enforces_exact_ticks_quantity_and_limits(self):
        self.transport.call.return_value = page([specification()])
        instrument = self.market.instrument(SYMBOL)
        self.assertEqual(instrument.check_qty("0.005"), Decimal("0.005"))
        self.assertEqual(instrument.check_price("95000.1"), Decimal("95000.1"))
        for invalid in ("0.0005", 0, "101", "Infinity", "0.01001", True):
            with self.subTest(qty=invalid), self.assertRaises(DemoError):
                instrument.check_qty(invalid)
        with self.assertRaises(DemoError):
            instrument.check_qty("11", market=True)
        for invalid in ("0.001", "-1", "95000.01", "3000000", "nan"):
            with self.subTest(price=invalid), self.assertRaises(DemoError):
                instrument.check_price(invalid)

    def test_marks_and_server_clock(self):
        self.transport.call.return_value = page([{"symbol":SYMBOL, "markPrice":"85001.25"}])
        self.assertEqual(self.market.mark(SYMBOL), Decimal("85001.25"))
        for bad in ("-1", "0", "NaN", None):
            self.transport.call.return_value = page([{"symbol":SYMBOL, "markPrice":bad}])
            with self.assertRaises(DemoError):
                self.market.mark(SYMBOL)
        self.transport.call.return_value = {"timeNano": str(NOW * 1_000_000 + 123)}
        self.assertEqual(self.market.server_time_ms(), NOW)
        self.transport.call.return_value = {"timeNano": str((NOW - 30000) * 1_000_000)}
        with self.assertRaises(DemoError):
            self.market.server_time_ms()

    def test_positions_hedge_or_missing_mode_rejected_for_mutations(self):
        flat = {"symbol":SYMBOL, "positionIdx":0, "side":"", "size":"0", "unrealisedPnl":""}
        self.transport.call.return_value = page([flat])
        self.assertEqual(self.market.positions(SYMBOL, one_way=True)[0]["unrealisedPnl"], "0")
        hedge = {**flat, "size":"1", "side":"Sell", "positionIdx":2, "unrealisedPnl":"-2.5"}
        self.transport.call.return_value = page([hedge])
        self.assertEqual(self.market.positions(SYMBOL)[0]["side"], "Sell")
        with self.assertRaises(DemoError):
            self.market.positions(SYMBOL, one_way=True)
        self.transport.call.return_value = page([])
        with self.assertRaises(DemoError):
            self.market.positions(SYMBOL, one_way=True)
        self.transport.call.return_value = page([{**hedge, "unrealisedPnl":""}])
        with self.assertRaises(DemoError):
            self.market.positions(SYMBOL)

    def test_all_open_orders_including_conditionals_follow_cursors(self):
        stop = order("b", orderType="Market", orderStatus="Untriggered", price="0",
                     stopOrderType="Stop", triggerPrice="98000")
        protected = order("c", reduceOnly=True, closeOnTrigger=True, orderType="Market",
                          orderStatus="Untriggered", stopOrderType="StopLoss", qty="0", leavesQty="")
        self.transport.call.side_effect = [page([order()], "second"), page([stop, protected])]
        rows = self.market.open_orders(SYMBOL)
        self.assertEqual([r["orderId"] for r in rows], ["a","b","c"])
        self.assertEqual(rows[1]["triggerPrice"], "98000")
        self.assertTrue(rows[2]["reduceOnly"])
        args = dict(category="linear", symbol=SYMBOL, openOnly=0, limit=50)
        self.assertEqual(self.transport.call.call_args_list, [call("get_open_orders", **args),
                                                              call("get_open_orders", cursor="second", **args)])

    def test_incomplete_or_contradictory_order_pages_never_pass(self):
        for sequence in ([page([order()], "1"), page([order()], "")], [page([], "1"), page([], "1")],
                         [{"category":"linear", "list":[]}], [page([order(reduceOnly="false")])],
                         [page([order(leavesQty="0.03")])], [page([order(symbol="DOGEUSDT")])]):
            self.transport.call.side_effect = sequence
            with self.subTest(sequence=sequence), self.assertRaises(DemoError):
                self.market.open_orders(SYMBOL)

    def test_reconciliation_follows_all_pages_and_rejects_identity_mismatches(self):
        record = dict(symbol=SYMBOL, orderId="oid", orderLinkId="link1")
        for method in ("get_order_history","get_executions"):
            self.transport.call.side_effect = [page([record], "next"), page([])]
            self.assertEqual(self.market.order_rows(method, SYMBOL, "link1"), [record])
            self.assertEqual(self.transport.call.call_args.kwargs["cursor"], "next")
            for change in ({"symbol":"ETHUSDT"},{"orderLinkId":"other"},{"orderId":""}):
                self.transport.call.side_effect = [page([{**record, **change}])]
                with self.assertRaises(DemoError):
                    self.market.order_rows(method, SYMBOL, "link1")
        with self.assertRaises(DemoError):
            self.market.order_rows("place_order", SYMBOL, "link1")

    def test_daily_loss_uses_net_exchange_change_and_no_external_transfers(self):
        self.transport.call.side_effect = [
            page([entry("1","TRADE","-10", cashFlow="-9", fee="1"),
                  entry("x","TRANSFER_IN","500", symbol="")], "more", linear=False),
            page([entry("2","SETTLEMENT","-0.2", symbol="ETHUSDT", funding="-0.2"),
                  entry("3","TRADE","1"), entry("4","FEE_REFUND","0.03"),
                  entry("nonmanaged","TRADE","1000",symbol="SOLUSDT")], linear=False)]
        self.assertEqual(self.market.realized_today(NOW), Decimal("-9.17"))
        _, kwargs = self.transport.call.call_args
        self.assertEqual((kwargs["startTime"], kwargs["endTime"]), (NOW - NOW % DAY_MS, NOW))
        self.assertEqual(kwargs["currency"],"USDT")
        self.assertEqual(kwargs["cursor"],"more")

    def test_transactions_validate_window_uniqueness_type_and_economics(self):
        for invalid in (entry("2","TRADE",None), entry("2","TRADE","NaN"),
                        entry("2","TRADE","8",category="spot"),
                        entry("2","TRADE","8",transactionTime=str(NOW-2*DAY_MS)),
                        entry("2","TRADE","8",symbol=""),
                        entry("1","TRADE","2"), entry("2","UNKNOWN","1"),
                        entry("2","TRADE","1",transSubType="movePosition")):
            self.transport.call.return_value = page([entry("1","TRADE","1"),invalid], linear=False)
            with self.subTest(row=invalid), self.assertRaises(DemoError):
                self.market.realized_today(NOW)
        with self.assertRaises(DemoError):
            self.market.realized_today(NOW-12000)


if __name__ == "__main__":
    unittest.main()

