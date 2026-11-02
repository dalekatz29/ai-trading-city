"""One-way USDT perpetual trading on Bybit Demo. No network actions on import."""
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
import os
from pathlib import Path
import re
from uuid import uuid4

from .market import Market, SYMBOLS, require_symbol, decimal_value
from .risk import RiskError, RiskState
from .transport import DemoError, DemoTransport, OrderRejected

TERMINAL = {"Filled", "Cancelled", "PartiallyFilledCanceled", "Rejected", "Deactivated"}


def amount(value):
    number = decimal_value(value, "quantity, price or risk limit")
    if number <= 0 or not -18 <= number.adjusted() <= 18:
        raise ValueError("Expected a positive decimal within the supported range.")
    return number


def _order_id(value):
    if not isinstance(value, str) or not re.fullmatch(r"[A-Za-z0-9_-]{1,36}", value):
        raise ValueError("Use a 1–36 character order link ID (letters, numbers, dash, underscore).")
    return value


def enabled():
    return os.environ.get("DEMO_TRADING_ENABLED") == "true"


def require_enabled():
    if not enabled():
        raise DemoError("Demo execution disabled. DEMO_TRADING_ENABLED must be exactly true.")


def state_path():
    return Path.home() / ".trading-city" / "bybit-demo-futures" / "risk.sqlite3"


def day(ms):
    return datetime.fromtimestamp(ms / 1000, timezone.utc).date().isoformat()


def public_report(market):
    stamp = market.server_time_ms()
    instruments = {}
    for symbol in SYMBOLS:
        info = market.instrument(symbol)
        instruments[symbol] = {"mark":str(market.mark(symbol)), "qty_step":str(info.qty_step)}
    return {"environment":"Bybit Demo", "server_time_ms":stamp, "instruments":instruments}


class DemoFutures:
    """Supported public interface. All writes pass the execution gate."""
    def __init__(self, transport, state, max_position_usdt, daily_loss_limit_usdt):
        self._transport = transport
        self.market = Market(transport)
        self.state = state
        self.max_position_usdt = amount(max_position_usdt)
        self.daily_loss_limit_usdt = amount(daily_loss_limit_usdt)
        self._bound = False

    def _bind_verified(self):
        if not self._bound:
            uid = self._transport.call("get_api_key_information").get("userID")
            if not re.fullmatch(r"[1-9][0-9]{0,23}", str(uid)):
                raise DemoError("The demo account identity could not be verified.")
            self.state.bind_account("bybit-demo-" + str(uid))
            self._bound = True

    @classmethod
    def from_env(cls):
        return cls(DemoTransport.from_env(), RiskState(state_path()),
                   os.environ.get("MAX_POSITION_USDT", "100"),
                   os.environ.get("DAILY_LOSS_LIMIT_USDT", "10"))

    def check(self):
        """Read public data, then authenticate against the demo wallet. No order endpoints."""
        report = public_report(self.market)
        wallet = self._transport.call("get_wallet_balance", accountType="UNIFIED", coin="USDT")
        rows = wallet.get("list")
        if not isinstance(rows, list) or len(rows) != 1 or rows[0].get("accountType") != "UNIFIED":
            raise DemoError("The authenticated demo unified wallet could not be verified.")
        self._bind_verified()
        return {**report, "wallet_verified":True, "execution_enabled":enabled(), "kill_latched":self.state.killed()}

    def positions(self):
        return [{key: row.get(key) for key in ("symbol","positionIdx","side","size","markPrice","unrealisedPnl","stopLoss","takeProfit")}
                for symbol in SYMBOLS for row in self.market.positions(symbol)]

    def _protection(self, info, side, mark, limit, stop_loss, take_profit):
        params = {}
        for key, trigger, raw, below in (("stopLoss","slTriggerBy",stop_loss,side == "Buy"),
                                          ("takeProfit","tpTriggerBy",take_profit,side == "Sell")):
            if raw is None:
                continue
            price = amount(raw)
            info.check_price(price)
            if (below and price >= min(mark, limit)) or (not below and price <= max(mark, limit)):
                raise ValueError("Stop loss or take profit is on the wrong side of the mark/entry.")
            params[key] = format(price, "f")
            params[trigger] = "MarkPrice"
        if params:
            params["tpslMode"] = "Full"
        return params

    def _ack_order(self, method, link, **params):
        require_enabled()
        try:
            result = self._transport._write(method, orderLinkId=link, **params)
            if not result.get("orderId") or result.get("orderLinkId") != link:
                raise DemoError("Unverified acknowledgement.")
        except OrderRejected:
            raise
        except DemoError:
            raise DemoError(f"No verified acknowledgement for {link}. Reconcile with Bybit before retrying.") from None
        return {"order_link_id":link, "order_id":result["orderId"], "status":"acknowledged; fill/cancel not yet confirmed"}

    def _history(self, symbol, link):
        rows = self.market.order_rows("get_order_history", symbol, link)
        if len(rows) > 1:
            raise DemoError("Order history could not be verified.")
        return rows[0] if rows else None

    def order_status(self, symbol, order_link_id):
        symbol, link = require_symbol(symbol), _order_id(order_link_id)
        row = self._history(symbol, link)
        if row is None:
            return {"order_link_id":link, "status":"unknown"}
        return {"order_link_id":link, "status":row.get("orderStatus"), "filled_qty":row.get("cumExecQty")}

    def reconcile(self):
        """Only clear reservations backed by terminal history and a current position snapshot."""
        self._bind_verified()
        statuses = []
        for link, symbol in self.state.pending():
            row = self._history(symbol, link)
            status = (row or {}).get("orderStatus", "unknown")
            released = False
            if status in TERMINAL:
                try:
                    filled = Decimal(str(row["cumExecQty"]))
                    updated = int(row["updatedTime"])
                except (KeyError, ValueError, InvalidOperation, TypeError):
                    raise DemoError("Incomplete terminal order record.") from None
                if not filled.is_finite() or filled < 0 or updated <= 0 or (status == "Filled" and not filled):
                    raise DemoError("Invalid terminal order record.")
                confirmed = not filled
                if filled:
                    fills = self.market.order_rows("get_executions", symbol, link)
                    ids = {fill.get("execId") for fill in fills}
                    if (not all(isinstance(i,str) and i for i in ids) or len(ids) != len(fills)
                            or any(f.get("orderId") != row["orderId"] or f.get("execType") != "Trade" for f in fills)):
                        raise DemoError("Unverified execution identities.")
                    if fills and sum(amount(f.get("execQty")) for f in fills) == filled:
                        try:
                            last_fill = max(int(f["execTime"]) for f in fills)
                            positions = self.market.positions(symbol, one_way=True)
                            confirmed = last_fill > 0 and any(int(p.get("updatedTime") or 0) >= last_fill for p in positions)
                        except (ValueError, TypeError, KeyError):
                            raise DemoError("Unverified position or execution timestamp.") from None
                if confirmed:
                    self.state.settle(link)
                    released = True
            statuses.append({"order_link_id":link,"status":status,"released":released})
        return statuses

    def place_limit(self, symbol, side, qty, price, *, stop_loss=None, take_profit=None, order_link_id=None):
        require_enabled()
        symbol = require_symbol(symbol)
        if side not in ("Buy","Sell"):
            raise ValueError("Side must be Buy or Sell.")
        quantity, limit = amount(qty), amount(price)
        link = _order_id(order_link_id if order_link_id is not None else "e-"+uuid4().hex)
        if self.state.killed():
            raise RiskError("The emergency kill switch is latched.")
        self.reconcile()
        with self.state.entry(link,symbol) as gate:
            started = self.market.server_time_ms()
            info = self.market.instrument(symbol)
            info.check_qty(quantity)
            info.check_price(limit)
            marks = {s:self.market.mark(s) for s in SYMBOLS}
            if quantity * min(limit, marks[symbol]) < info.min_notional:
                raise ValueError("Below the demo instrument minimum notional.")
            orders = [o for s in SYMBOLS for o in self.market.open_orders(s)]
            positions = [p for s in SYMBOLS for p in self.market.positions(s,one_way=True)]
            realized = self.market.realized_today(started)
            protections = self._protection(info,side,marks[symbol],limit,stop_loss,take_profit)
            checked = self.market.server_time_ms()
            if not 0 <= checked - started <= 10000 or day(checked) != day(started):
                raise RiskError("Risk snapshot changed day or exceeded ten seconds. Obtain a fresh snapshot.")
            gate.check_entry(qty=quantity,price=limit,positions=positions,open_orders=orders,marks=marks,
                             realized_today=realized,utc_day=day(started),max_position_usdt=self.max_position_usdt,
                             max_daily_loss_usdt=self.daily_loss_limit_usdt)
            def submit():
                return self._ack_order("place_order",link,category="linear",symbol=symbol,
                                       side=side,qty=format(quantity,"f"),price=format(limit,"f"),
                                       orderType="Limit",timeInForce="GTC",positionIdx=0,reduceOnly=False,**protections)
            try:
                return gate.dispatch(submit)
            except OrderRejected:
                self.state.settle(link)
                raise

    def cancel(self, symbol, order_link_id):
        require_enabled()
        symbol, link = require_symbol(symbol), _order_id(order_link_id)
        self._bind_verified()
        def request_cancel():
            return self._ack_order("cancel_order",link,category="linear",symbol=symbol)
        if (link, symbol) in self.state.pending():
            return request_cancel()
        return self.state.unless_killed(request_cancel)

    def _held(self, symbol):
        rows = self.market.positions(require_symbol(symbol),one_way=True)
        active = [p for p in rows if Decimal(str(p["size"])) > 0]
        if len(active) != 1 or active[0].get("side") not in ("Buy","Sell"):
            raise DemoError("Expected one open one-way position.")
        return active[0]

    def close(self, symbol, *, order_link_id, qty=None):
        """Explicit reduce-only market close. Reuse the same link ID for the same instruction."""
        require_enabled()
        symbol, link = require_symbol(symbol), _order_id(order_link_id)
        self._bind_verified()
        pos = self._held(symbol)
        size = amount(pos["size"])
        portion = size if qty is None else amount(qty)
        if portion > size:
            raise ValueError("Requested close exceeds the confirmed position.")
        info=self.market.instrument(symbol)
        info.check_qty(portion,market=True)
        return self._ack_order("place_order",link,category="linear",symbol=symbol,
                               side="Sell" if pos["side"]=="Buy" else "Buy",qty=format(portion,"f"),
                               orderType="Market",positionIdx=0,reduceOnly=True)

    def protect(self, symbol, *, stop_loss, take_profit):
        require_enabled()
        symbol = require_symbol(symbol)
        if self.state.killed():
            raise RiskError("Protection cannot be changed while the emergency kill switch is latched.")
        self._bind_verified()
        pos = self._held(symbol)
        mark = self.market.mark(symbol)
        if stop_loss is None or take_profit is None:
            raise ValueError("Specify both stop loss and take profit.")
        params=self._protection(self.market.instrument(symbol),pos["side"],mark,mark,stop_loss,take_profit)
        self.state.unless_killed(lambda: self._transport._write(
            "set_trading_stop",category="linear",symbol=symbol,positionIdx=0,**params))
        return {"symbol":symbol,"status":"protection acknowledged; verify on the position"}

    def kill(self):
        self.state.kill()
        self._bind_verified()
        # Cancel by stable reservation ID, even if an acknowledgement was lost.
        # Exchange-side TP/SL and other users' orders are not selected.
        pending = self.state.pending()
        cancellations = []
        if enabled():
            for link, symbol in pending:
                try:
                    self.cancel(symbol, link)
                    result = "cancellation requested"
                except (DemoError, RiskError):
                    result = "unconfirmed; reconcile before retry"
                cancellations.append({"order_link_id":link, "status":result})
        result = {"kill_latched":True, "pending_entries":len(pending), "cancellations":cancellations,
                  "execution_enabled":enabled()}
        try:
            result["positions"] = self.positions()
        except (ValueError, DemoError):
            result["positions_status"] = "unavailable; inspect the demo account"
        return result

    def resume(self):
        require_enabled()
        self.reconcile()
        self.state.resume()
        return {"kill_latched":self.state.killed(),"status":"local emergency latch cleared"}

