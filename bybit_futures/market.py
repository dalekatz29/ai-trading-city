"""Validated, read-only V5 data for the two supported demo perpetuals."""

import time
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation

from .transport import DemoError

SYMBOLS = ("BTCUSDT", "ETHUSDT")
DAY_MS = 86_400_000
MAX_PAGES = 200
ZERO = Decimal(0)
PNL_TYPES = frozenset({"TRADE", "SETTLEMENT", "LIQUIDATION", "ADL", "FEE_REFUND"})
NON_TRADING_TYPES = frozenset({
    "TRANSFER_IN", "TRANSFER_OUT", "BONUS", "BONUS_RECOLLECT", "AIRDROP",
    "BONUS_TRANSFER_IN", "BONUS_TRANSFER_OUT", "INTEREST", "BORROW", "REPAY",
})


def require_symbol(symbol):
    if symbol not in SYMBOLS:
        raise DemoError("Only BTCUSDT and ETHUSDT linear perpetuals are supported.")
    return symbol


def decimal_value(value, field):
    if type(value) not in (str, int, Decimal):
        raise DemoError(f"Invalid {field}.")
    try:
        number = Decimal(value)
    except (InvalidOperation, ValueError):
        raise DemoError(f"Invalid {field}.") from None
    if not number.is_finite() or abs(number.as_tuple().exponent) > 30 or len(number.as_tuple().digits) > 28:
        raise DemoError(f"Invalid {field}.")
    return number


def _positive(value, field):
    number = decimal_value(value, field)
    if number <= ZERO:
        raise DemoError(f"Expected positive {field}.")
    return number


def _object(data, field):
    if not isinstance(data, dict):
        raise DemoError(f"Invalid {field} response.")
    return data


def _linear_page(page):
    if _object(page, "linear").get("category") != "linear":
        raise DemoError("Unexpected product category.")
    return page


def _rows(result):
    rows = result.get("list")
    if not isinstance(rows, list) or any(not isinstance(row, dict) for row in rows):
        raise DemoError("Missing or malformed result list.")
    return rows


def _aligned(value, step):
    # Integer ratio arithmetic keeps step checks exact for all accepted Decimals.
    numerator, denominator = value.as_integer_ratio()
    step_num, step_den = step.as_integer_ratio()
    return (numerator * step_den) % (denominator * step_num) == 0


@dataclass(frozen=True)
class Instrument:
    symbol: str
    qty_step: Decimal
    min_qty: Decimal
    max_qty: Decimal
    max_market_qty: Decimal
    tick_size: Decimal
    min_notional: Decimal
    min_price: Decimal
    max_price: Decimal

    def check_qty(self, qty, *, market=False):
        qty = _positive(qty, "order quantity")
        ceiling = self.max_market_qty if market else self.max_qty
        if not self.min_qty <= qty <= ceiling or not _aligned(qty, self.qty_step):
            raise DemoError("Quantity is outside the instrument limits or off step.")
        return qty

    def check_price(self, price):
        price = _positive(price, "order price")
        if not self.min_price <= price <= self.max_price or not _aligned(price, self.tick_size):
            raise DemoError("Price is outside the instrument limits or off tick.")
        return price


class Market:
    def __init__(self, transport, *, clock_ms=None):
        self.transport = transport
        self._clock_ms = clock_ms or (lambda: time.time_ns() // 1_000_000)

    def server_time_ms(self):
        result = _object(self.transport.call("get_server_time"), "server clock")
        nano = result.get("timeNano")
        if not isinstance(nano, str) or not nano.isascii() or not nano.isdecimal() or not 16 <= len(nano) <= 20:
            raise DemoError("Invalid Bybit server clock.")
        server_ms = int(nano) // 1_000_000
        if abs(self._clock_ms() - server_ms) > 10_000:
            raise DemoError("Local and demo server clocks disagree.")
        return server_ms

    def _pages(self, method, *, linear=True, **params):
        seen_cursors = set()
        for _ in range(MAX_PAGES):
            result = _object(self.transport.call(method, **params), "page")
            if linear:
                _linear_page(result)
            yield from _rows(result)
            cursor = result.get("nextPageCursor")
            if cursor == "":
                return
            if not isinstance(cursor, str) or not cursor or cursor in seen_cursors:
                raise DemoError("Missing or repeated page cursor; refusing incomplete risk data.")
            seen_cursors.add(cursor)
            params["cursor"] = cursor
        raise DemoError("Page limit exceeded; risk data is incomplete.")

    def instrument(self, symbol):
        symbol = require_symbol(symbol)
        result = _linear_page(self.transport.call("get_instruments_info", category="linear", symbol=symbol))
        rows = _rows(result)
        if len(rows) != 1 or result.get("nextPageCursor") not in ("", None):
            raise DemoError("Expected exactly one instrument.")
        row = rows[0]
        if (row.get("symbol") != symbol or row.get("contractType") != "LinearPerpetual"
                or row.get("settleCoin") != "USDT" or row.get("quoteCoin") != "USDT"
                or row.get("status") != "Trading"):
            raise DemoError("Instrument is not an active supported USDT perpetual.")
        qty, px = _object(row.get("lotSizeFilter"), "quantity limits"), _object(row.get("priceFilter"), "price limits")
        rules = Instrument(
            symbol, _positive(qty.get("qtyStep"), "quantity increment"),
            _positive(qty.get("minOrderQty"), "minimum quantity"), _positive(qty.get("maxOrderQty"), "maximum quantity"),
            _positive(qty.get("maxMktOrderQty"), "maximum market quantity"),
            _positive(px.get("tickSize"), "price increment"), _positive(qty.get("minNotionalValue"), "minimum notional"),
            _positive(px.get("minPrice"), "minimum price"), _positive(px.get("maxPrice"), "maximum price"),
        )
        if rules.min_qty > min(rules.max_qty, rules.max_market_qty) or rules.min_price > rules.max_price:
            raise DemoError("Inconsistent instrument limits.")
        return rules

    def mark(self, symbol):
        symbol = require_symbol(symbol)
        result = _linear_page(self.transport.call("get_tickers", category="linear", symbol=symbol))
        rows = _rows(result)
        if len(rows) != 1 or rows[0].get("symbol") != symbol:
            raise DemoError("Expected one matching ticker.")
        return _positive(rows[0].get("markPrice"), "mark price")

    def positions(self, symbol, *, one_way=False):
        symbol = require_symbol(symbol)
        pages = self._pages("get_positions", category="linear", symbol=symbol, limit=200)
        positions, indices = [], set()
        for row in pages:
            idx = row.get("positionIdx")
            if (row.get("symbol") != symbol or type(idx) is not int or idx not in (0, 1, 2)
                    or idx in indices or (one_way and idx != 0)):
                raise DemoError("Unrecognized, duplicate or unsupported position mode.")
            indices.add(idx)
            size = decimal_value(row.get("size"), "position size")
            side = row.get("side")
            if size < ZERO or side not in ("", "Buy", "Sell") or (size > ZERO and not side):
                raise DemoError("Invalid position side or size.")
            if size > ZERO and idx in (1, 2) and side != {1:"Buy", 2:"Sell"}[idx]:
                raise DemoError("Position side does not match position mode.")
            pnl = row.get("unrealisedPnl")
            if size == ZERO and pnl == "":
                pnl = "0"
            pnl = decimal_value(pnl, "unrealised P&L")
            if size == ZERO and pnl != ZERO:
                raise DemoError("Empty position reports non-zero unrealised P&L.")
            positions.append({**row, "unrealisedPnl":str(pnl)})
        if one_way and indices != {0}:
            raise DemoError("One-way position mode was not established for this symbol.")
        return positions

    def open_orders(self, symbol):
        symbol = require_symbol(symbol)
        # Omitting orderFilter includes active and conditional orders.
        pages = self._pages("get_open_orders", category="linear", symbol=symbol, openOnly=0, limit=50)
        orders, ids = [], set()
        for row in pages:
            order_id = row.get("orderId")
            if (row.get("symbol") != symbol or not isinstance(order_id, str) or not order_id
                    or order_id in ids or row.get("side") not in ("Buy", "Sell")
                    or row.get("orderType") not in ("Limit", "Market")
                    or row.get("orderStatus") not in ("New", "PartiallyFilled", "Untriggered", "Triggered")
                    or type(row.get("reduceOnly")) is not bool or type(row.get("closeOnTrigger")) is not bool
                    or not isinstance(row.get("stopOrderType"), str)):
                raise DemoError("Unrecognized or duplicate open order.")
            ids.add(order_id)
            qty = decimal_value(row.get("qty"), "order quantity")
            leaves = row.get("leavesQty")
            if row["reduceOnly"] and leaves == "":
                leaves = row["qty"]
            remaining = decimal_value(leaves, "remaining order quantity")
            price = decimal_value(row.get("price") or "0", "order price")
            trigger = decimal_value(row.get("triggerPrice") or "0", "trigger price")
            if (not ZERO <= remaining <= qty or price < ZERO or trigger < ZERO
                    or (row["orderType"] == "Limit" and price == ZERO)
                    or (not row["reduceOnly"] and (remaining == ZERO or
                        (row["orderStatus"] == "Untriggered" and trigger == ZERO)))):
                raise DemoError("Inconsistent open order size or price.")
            orders.append({**row, "leavesQty":str(remaining), "price":str(price), "triggerPrice":str(trigger)})
        return orders

    def realized_today(self, now_ms):
        """Net reported USDT cash change from supported futures trades/funding today."""
        if type(now_ms) is not int or now_ms <= 0 or abs(self._clock_ms() - now_ms) > 10_000:
            raise DemoError("A fresh demo server timestamp is required for daily loss.")
        start = now_ms - now_ms % DAY_MS
        rows = self._pages("get_transaction_log", linear=False, accountType="UNIFIED", category="linear",
                           currency="USDT", startTime=start, endTime=now_ms, limit=50)
        total, ids = ZERO, set()
        for row in rows:
            trans_type = row.get("type")
            if trans_type in NON_TRADING_TYPES:
                continue
            symbol = row.get("symbol")
            if not isinstance(symbol, str) or not symbol:
                raise DemoError("Missing symbol in transaction log.")
            if symbol not in SYMBOLS:
                continue
            if (trans_type not in PNL_TYPES or row.get("category") != "linear" or row.get("currency") != "USDT"
                    or row.get("transSubType") not in (None, "")):
                raise DemoError("Unsupported transaction for a managed contract.")
            entry = row.get("id")
            when = str(row.get("transactionTime", ""))
            if (not isinstance(entry, str) or not entry or entry in ids or len(when) > 16
                    or not when.isascii() or not when.isdecimal() or not start <= int(when) <= now_ms):
                raise DemoError("Duplicate or out-of-window transaction.")
            ids.add(entry)
            # Bybit's 'change' is the net cashFlow + funding - fee. Adding any
            # component again would double count actual funding or trading fees.
            total += decimal_value(row.get("change"), "transaction net change")
        return total

    def order_rows(self, method, symbol, link):
        """Read every matching history or execution row for reconciliation."""
        symbol = require_symbol(symbol)
        if method not in ("get_order_history", "get_executions"):
            raise DemoError("Only history or execution queries are permitted here.")
        if (not isinstance(link, str) or not 1 <= len(link) <= 36 or not link.isascii()
                or not all(c.isalnum() or c in "_-" for c in link)):
            raise DemoError("Invalid order link ID for reconciliation.")
        pages = self._pages(method, category="linear", symbol=symbol, orderLinkId=link, limit=50)
        rows = []
        for row in pages:
            if (row.get("symbol") != symbol or row.get("orderLinkId") != link
                    or not isinstance(row.get("orderId"), str) or not row["orderId"]):
                raise DemoError("Mismatched or missing identity in exchange order data.")
            rows.append(row)
        return rows

