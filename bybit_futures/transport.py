"""pybit REST transport restricted to Bybit Demo Trading and an explicit V5 allowlist."""
import http.client
import logging
import os
import time
from urllib.parse import urlsplit

import requests
from pybit.unified_trading import HTTP
from urllib3.connection import HTTPSConnection

DEMO_URL = "https://api-demo.bybit.com"
_READS = {
    "get_server_time": "/v5/market/time",
    "get_wallet_balance": "/v5/account/wallet-balance",
    "get_api_key_information": "/v5/user/query-api",
    "get_instruments_info": "/v5/market/instruments-info",
    "get_tickers": "/v5/market/tickers",
    "get_positions": "/v5/position/list",
    "get_open_orders": "/v5/order/realtime",
    "get_order_history": "/v5/order/history",
    "get_executions": "/v5/execution/list",
    "get_transaction_log": "/v5/account/transaction-log",
    "get_closed_pnl": "/v5/position/closed-pnl",
}
_WRITES = {
    "place_order": "/v5/order/create",
    "cancel_order": "/v5/order/cancel",
    "set_trading_stop": "/v5/position/trading-stop",
}


class DemoError(RuntimeError):
    """A safe-to-display error. It never includes headers, raw requests or responses."""


class OrderRejected(DemoError):
    """The exchange definitively refused to create this order."""


def _require_enabled():
    if os.environ.get("DEMO_TRADING_ENABLED") != "true":
        raise DemoError("Demo execution requires DEMO_TRADING_ENABLED=true.")


class _DemoSession(requests.Session):
    """Check the prepared URL before dispatch, including requests prepared by the SDK."""

    def __init__(self):
        super().__init__()
        self.trust_env = False

    def send(self, request, **kwargs):
        target = urlsplit(request.url)
        if target.scheme != "https" or target.netloc != "api-demo.bybit.com" or target.fragment:
            raise DemoError("Request outside the fixed Bybit Demo origin was blocked.")
        if request.method == "POST" and target.path in _WRITES.values():
            _require_enabled()
        elif request.method != "GET" or target.path not in _READS.values():
            raise DemoError("Unexpected Demo API operation was blocked.")
        # Python HTTP wire debugging prints signed headers directly to stdout.
        if http.client.HTTPConnection.debuglevel or HTTPSConnection.debuglevel:
            raise DemoError("HTTP wire debugging must be disabled.")
        kwargs.update(allow_redirects=False, proxies={}, verify=True)
        response = super().send(request, **kwargs)
        if 300 <= response.status_code < 400:
            response.close()
            raise DemoError("Bybit Demo redirect was blocked.")
        return response


class _DemoHTTP(HTTP):
    def __repr__(self):
        return "<Bybit Demo HTTP>"


class DemoTransport:
    def __init__(self, *, public_only=False):
        self._public_only = public_only
        key = None if public_only else os.environ.get("BYBIT_API_KEY", "")
        secret = None if public_only else os.environ.get("BYBIT_API_SECRET", "")
        if not public_only and (not key.strip() or not secret.strip()):
            raise DemoError("Set BYBIT_API_KEY and BYBIT_API_SECRET to Demo Trading credentials.")
        self._sdk = _DemoHTTP(
            demo=True, testnet=False, domain="bybit", tld="com", api_key=key, api_secret=secret,
            log_requests=False, force_retry=False, max_retries=1, timeout=8,
        )
        if self._sdk.endpoint != DEMO_URL:
            self._sdk.client.close()
            raise DemoError("Unexpected pybit endpoint. Connection blocked.")
        # pybit can log raw broker error bodies even when log_requests=False.
        self._sdk.logger = logging.Logger("bybit_futures.silent")
        self._sdk.logger.disabled = True
        self._sdk.retry_codes.clear()
        sdk_session = self._sdk.client
        self._sdk.client = _DemoSession()
        self._sdk.client.headers.update(sdk_session.headers)
        sdk_session.close()

    @classmethod
    def from_env(cls):
        return cls()

    def call(self, method, **kwargs):
        if method not in _READS:
            raise DemoError("Only allowlisted reads are available here.")
        if self._public_only and not _READS[method].startswith("/v5/market/"):
            raise DemoError("This session is limited to public market data.")
        return self._request(method, kwargs, require_fresh=True)

    def _write(self, method, **kwargs):
        """Internal entry point for the position/risk service after its checks."""
        if self._public_only or method not in _WRITES:
            raise DemoError("Unknown Demo mutation.")
        _require_enabled()
        return self._request(method, kwargs, require_fresh=False)

    def _request(self, method, params, *, require_fresh):
        if self._sdk.endpoint != DEMO_URL:
            raise DemoError("Unexpected pybit endpoint. Connection blocked.")
        # Whitelist methods above. Do not include an SDK error message in public errors:
        # SDK exceptions can contain signed request metadata and raw server text.
        try:
            reply = getattr(self._sdk, method)(**params)
        except DemoError:
            raise
        except Exception as exc:
            code = getattr(exc, "status_code", None)
            label = str(code) if type(code) is int and 0 <= code < 10**9 else "transport error"
        else:
            if not isinstance(reply, dict) or type(reply.get("retCode")) is not int:
                raise DemoError("Malformed Bybit Demo response.")
            if reply["retCode"] == 0:
                if not isinstance(reply.get("result"), dict):
                    raise DemoError("Missing Bybit Demo result.")
                timestamp = reply.get("time")
                if require_fresh and (type(timestamp) is not int or abs(time.time()*1000 - timestamp) > 10000):
                    raise DemoError("Stale or missing Bybit Demo timestamp. Check your system clock.")
                # This endpoint can echo the API key. Only the account identity is needed.
                if method == "get_api_key_information":
                    return {"userID": reply["result"].get("userID")}
                return reply["result"]
            code = reply["retCode"]
            label = str(code)
        if method == "place_order" and code in (110003, 110004, 110007, 110017):
            raise OrderRejected(f"Demo exchange rejected the order ({code}).")
        raise DemoError(f"Bybit Demo {method} failed ({label}).")

