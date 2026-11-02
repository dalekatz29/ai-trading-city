"""Command-line interface. Omitting the command runs only read-only connectivity checks."""
import argparse
import json
import os
import sqlite3
import sys

from .client import DemoFutures, Market, SYMBOLS, public_report, state_path
from .risk import RiskError, RiskState
from .transport import DemoError, DemoTransport


def arguments(argv=None):
    parser = argparse.ArgumentParser(description="Bybit Demo perpetuals (BTCUSDT and ETHUSDT).")
    sub = parser.add_subparsers(dest="command")
    for name in ("public-check","check","positions","reconcile","kill"):
        sub.add_parser(name)
    sub.add_parser("resume").add_argument("--confirm",required=True,action="store_true")
    status = sub.add_parser("order-status")
    cancel = sub.add_parser("cancel")
    close = sub.add_parser("close")
    order = sub.add_parser("place")
    protect = sub.add_parser("protect")
    for action in (status,cancel,close,order,protect):
        action.add_argument("symbol", choices=SYMBOLS)
    for action in (status,cancel,close,order):
        action.add_argument("--link-id",required=True,help="Unique 1–36 character ID for this instruction.")
    order.add_argument("--side",choices=("Buy","Sell"),required=True)
    order.add_argument("--qty",required=True)
    order.add_argument("--price",required=True)
    close.add_argument("--qty",help="Optional partial close. Default is the full verified position.")
    for action in (order,protect):
        action.add_argument("--stop-loss",required=action is protect)
        action.add_argument("--take-profit",required=action is protect)
    return parser.parse_args(argv)


def main(argv=None):
    args=arguments(argv)
    cmd=args.command or "check"
    try:
        if cmd == "public-check":
            report = public_report(Market(DemoTransport(public_only=True)))
            print(json.dumps({**report, "private_account_checked":False}, indent=2))
            return 0
        if cmd == "kill":
            # A local emergency stop works even if credentials/limits are missing.
            RiskState(state_path()).kill()
            print("Emergency entry lock is active.",file=sys.stderr)
            if not os.environ.get("BYBIT_API_KEY") or not os.environ.get("BYBIT_API_SECRET"):
                print("Broker cancellation and position checks unavailable without demo credentials.",file=sys.stderr)
                return 2
        app=DemoFutures.from_env()
        if cmd == "place":
            result=app.place_limit(args.symbol,args.side,args.qty,args.price,stop_loss=args.stop_loss,
                                   take_profit=args.take_profit,order_link_id=args.link_id)
        elif cmd == "cancel":
            result=app.cancel(args.symbol,args.link_id)
        elif cmd == "close":
            result=app.close(args.symbol,order_link_id=args.link_id,qty=args.qty)
        elif cmd == "protect":
            result=app.protect(args.symbol,stop_loss=args.stop_loss,take_profit=args.take_profit)
        elif cmd == "order-status":
            result=app.order_status(args.symbol,args.link_id)
        else:
            result=getattr(app,cmd)()
        print(json.dumps(result,indent=2))
        return 0
    except (DemoError,RiskError,ValueError) as failure:
        print(str(failure),file=sys.stderr)
    except (OSError,sqlite3.Error):
        print("Local demo state unavailable. Verify the state directory and its permissions.",file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main())

