"""Local risk limits for the two supported USDT demo perpetuals."""
from contextlib import contextmanager
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from hashlib import sha256
from pathlib import Path
import re
import sqlite3
import time

SYMBOLS = frozenset(("BTCUSDT", "ETHUSDT"))
ZERO = Decimal(0)


class RiskError(Exception):
    """An entry was refused, or its outcome must be reconciled."""


def _number(value, label, *, minimum=None):
    try:
        n = Decimal(str(value))
    except (InvalidOperation, ValueError, TypeError):
        raise RiskError(f"Invalid {label}.") from None
    if not n.is_finite() or (minimum is not None and n < minimum):
        raise RiskError(f"Invalid {label}.")
    return n


def _positive(value, label):
    n = _number(value, label)
    if n <= 0:
        raise RiskError(f"Invalid {label}.")
    return n


@contextmanager
def _transaction(path, *, write=False):
    """No connection is shared between threads or inherited across processes."""
    con = sqlite3.connect(path, timeout=45, isolation_level=None)
    try:
        con.execute("PRAGMA synchronous=FULL")
        con.execute("BEGIN IMMEDIATE" if write else "BEGIN")
        yield con
        con.commit()
    finally:
        con.close()  # uncommitted work rolls back on any exception


def _utc_today():
    return datetime.now(timezone.utc).date()


class RiskState:
    """One durable state per dedicated demo account, shared by all local callers."""

    def __init__(self, path, account_id=None, *, today=_utc_today):
        self.path = Path(path).expanduser().absolute()
        self.path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
        self._fence = self.path.with_name(self.path.name + ".dispatch")
        self._today = today
        self._binding = None
        with _transaction(self.path, write=True) as db:
            db.execute("CREATE TABLE IF NOT EXISTS control (id INTEGER PRIMARY KEY "
                       "CHECK(id=1), binding TEXT, halted INTEGER NOT NULL, revision INTEGER NOT NULL)")
            db.execute("INSERT OR IGNORE INTO control VALUES (1,NULL,0,0)")
            db.execute("CREATE TABLE IF NOT EXISTS openings (link TEXT PRIMARY KEY, "
                       "symbol TEXT NOT NULL, pending INTEGER NOT NULL)")
            db.execute("CREATE TABLE IF NOT EXISTS loss_days (utc_day TEXT PRIMARY KEY)")
        if account_id is not None:
            self.bind_account(account_id)

    def bind_account(self, account_id):
        """Accept an authenticated UID or a *non-secret* credential fingerprint."""
        if not isinstance(account_id, str) or not account_id.strip():
            raise RiskError("Missing account identifier.")
        binding = sha256(account_id.encode()).hexdigest()
        with _transaction(self.path, write=True) as db:
            existing, = db.execute("SELECT binding FROM control WHERE id=1").fetchone()
            if existing is not None and existing != binding:
                raise RiskError("Risk state belongs to a different demo account.")
            db.execute("UPDATE control SET binding=? WHERE id=1", (binding,))
        self._binding = binding

    def killed(self):
        with _transaction(self.path) as db:
            return bool(db.execute("SELECT halted FROM control WHERE id=1").fetchone()[0])

    def kill(self):
        # Persist first, even if another process has started an outbound request.
        with _transaction(self.path, write=True) as db:
            db.execute("UPDATE control SET halted=1,revision=revision+1 WHERE id=1")
        # After this fence returns, no pre-kill dispatch can begin a send.
        with _transaction(self._fence, write=True):
            pass

    def resume(self):
        with _transaction(self.path, write=True) as db:
            if db.execute("SELECT 1 FROM openings WHERE pending=1 LIMIT 1").fetchone():
                raise RiskError("Reconcile outstanding order intents before resuming.")
            db.execute("UPDATE control SET halted=0,revision=revision+1 WHERE id=1")

    def pending(self):
        with _transaction(self.path) as db:
            return db.execute("SELECT link,symbol FROM openings WHERE pending=1 ORDER BY rowid").fetchall()

    def settle(self, order_link_id):
        """Caller supplies a broker-reconciled terminal ID, never an unverified ID."""
        with _transaction(self.path, write=True) as db:
            changed = db.execute("UPDATE openings SET pending=0 WHERE link=? AND pending=1",
                                 (order_link_id,)).rowcount
            if changed:
                db.execute("UPDATE control SET revision=revision+1 WHERE id=1")

    def _guard(self, db):
        binding, halted, revision = db.execute(
            "SELECT binding,halted,revision FROM control WHERE id=1").fetchone()
        if not self._binding or self._binding != binding:
            raise RiskError("Bind the authenticated demo account before trading.")
        if halted:
            raise RiskError("Emergency kill switch is active.")
        day = self._today().isoformat()
        if db.execute("SELECT 1 FROM loss_days WHERE utc_day=?", (day,)).fetchone():
            raise RiskError("Daily loss limit reached for the current UTC day.")
        return revision

    @contextmanager
    def entry(self, order_link_id, symbol):
        if symbol not in SYMBOLS or not isinstance(order_link_id, str) or not re.fullmatch(
                r"[a-zA-Z0-9_-]{1,36}", order_link_id):
            raise RiskError("Invalid symbol or order link ID.")
        with _transaction(self.path) as db:
            revision = self._guard(db)
            if db.execute("SELECT 1 FROM openings WHERE pending=1 OR link=? LIMIT 1",
                          (order_link_id,)).fetchone():
                raise RiskError("A prior order is unresolved or this order link ID was already used.")
        gate = _Entry(self, revision, order_link_id, symbol)
        try:
            yield gate
        finally:
            gate.active = False


def _gross_risk(positions, open_orders, marks):
    if set(marks) != SYMBOLS:
        raise RiskError("Missing or unexpected mark price.")
    marks = {s: _positive(p, "mark price") for s, p in marks.items()}
    notional, open_losses = ZERO, ZERO
    for row in positions:
        s = row.get("symbol")
        if s not in marks:
            raise RiskError("Unexpected symbol in position data.")
        size = _number(row.get("size"), "position size", minimum=ZERO)
        if size:
            if row.get("side") not in ("Buy", "Sell"):
                raise RiskError("Invalid position side.")
            notional += marks[s] * size
            open_losses += max(ZERO, -_number(row.get("unrealisedPnl"), "unrealized P&L"))
    for row in open_orders:
        s = row.get("symbol")
        if s not in marks or not isinstance(row.get("reduceOnly"), bool):
            raise RiskError("Unverified open order.")
        if row["reduceOnly"]:
            continue
        price = marks[s]
        for field in ("price", "triggerPrice"):
            if row.get(field) not in (None, ""):
                price = max(price, _number(row[field], field, minimum=ZERO))
        # A still-open growth order reporting zero leaves may be in transition
        # to a fill that the latest position snapshot does not include yet.
        qty = _positive(row.get("leavesQty"), "remaining open order quantity")
        notional += qty * price
    return marks, notional, open_losses


class _Entry:
    def __init__(self, state, revision, link, symbol):
        self.state, self.revision, self.link, self.symbol = state, revision, link, symbol
        self.active = True
        self.checked_at = None
        self.checked_day = None

    def check_entry(self, *, qty, price, positions, open_orders, marks, realized_today,
                    utc_day, max_position_usdt, max_daily_loss_usdt):
        self.checked_at = None
        if not self.active or utc_day != self.state._today().isoformat():
            raise RiskError("Risk data is not for the current UTC day.")
        marks, exposure, open_losses = _gross_risk(positions, open_orders, marks)
        new_value = _positive(qty, "entry quantity") * max(
            _positive(price, "entry price"), marks[self.symbol])
        loss = max(ZERO, -_number(realized_today, "daily realized P&L")) + open_losses
        daily_cap = _positive(max_daily_loss_usdt, "daily loss limit")
        position_cap = _positive(max_position_usdt, "maximum position notional")
        if loss >= daily_cap:
            with _transaction(self.state.path, write=True) as db:
                db.execute("INSERT OR IGNORE INTO loss_days VALUES (?)", (utc_day,))
                db.execute("UPDATE control SET revision=revision+1 WHERE id=1")
            raise RiskError("Daily loss limit reached for the current UTC day.")
        if exposure + new_value > position_cap:
            raise RiskError("Maximum aggregate position notional would be exceeded.")
        self.checked_day, self.checked_at = utc_day, time.monotonic()
        return {"current_exposure": exposure, "projected_exposure": exposure + new_value,
                "daily_loss": loss}

    def dispatch(self, send):
        if not self.active or self.checked_at is None:
            raise RiskError("A successful risk check is required before submission.")
        checked_at, self.checked_at = self.checked_at, None
        # Reserve on disk before making any external call. A crash or timeout
        # never frees this ID. Only verified terminal orders can be settled later.
        with _transaction(self.state._fence, write=True):
            with _transaction(self.state.path, write=True) as db:
                revision = self.state._guard(db)
                if self.checked_day != self.state._today().isoformat() or time.monotonic() - checked_at > 15:
                    raise RiskError("Risk snapshot expired. Fetch a fresh snapshot.")
                if revision != self.revision or db.execute(
                        "SELECT 1 FROM openings WHERE pending=1 OR link=? LIMIT 1", (self.link,)).fetchone():
                    raise RiskError("Risk state changed. Reconcile and fetch a new snapshot.")
                db.execute("INSERT INTO openings VALUES (?,?,1)", (self.link, self.symbol))
                db.execute("UPDATE control SET revision=revision+1 WHERE id=1")
            return send()

