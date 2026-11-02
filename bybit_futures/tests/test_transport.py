import contextlib
import http.client
import io
import json
import logging
import os
import time
import unittest
from unittest.mock import patch

import requests

from bybit_futures.transport import DEMO_URL, DemoError, DemoTransport


class TransportTests(unittest.TestCase):
    def setUp(self):
        self.key, self.secret = "fixture-key-never-log", "fixture-secret-never-log"
        env = patch.dict(os.environ, {
            "BYBIT_API_KEY": self.key, "BYBIT_API_SECRET": self.secret,
            "HTTPS_PROXY": "http://invalid.invalid:8888",
        }, clear=True)
        env.start()
        self.addCleanup(env.stop)
        self.response = {"retCode": 0, "retMsg": "OK", "result": {}, "time": int(time.time()*1000)}
        self.status = 200
        self.location = None
        wire = patch("requests.adapters.HTTPAdapter.send", autospec=True, side_effect=self._reply)
        self.wire = wire.start()
        self.addCleanup(wire.stop)
        self.transport = DemoTransport.from_env()

    def _reply(self, adapter, request, **options):
        response = requests.Response()
        response.request = request
        response.url = request.url
        response.status_code = self.status
        response._content = json.dumps(self.response).encode("utf-8")
        response._content_consumed = True
        if self.location:
            response.headers["Location"] = self.location
        return response

    def test_real_sdk_signs_only_the_demo_url_and_ignores_proxy(self):
        self.response["result"] = {"list": []}
        self.assertEqual(self.transport.call("get_positions", category="linear", symbol="BTCUSDT"), {"list":[]})
        self.assertEqual(self.wire.call_count, 1)
        _, request = self.wire.call_args.args
        options = self.wire.call_args.kwargs
        self.assertEqual(request.url, DEMO_URL + "/v5/position/list?category=linear&symbol=BTCUSDT")
        self.assertEqual(request.method, "GET")
        self.assertEqual(request.headers["X-BAPI-API-KEY"], self.key)
        self.assertTrue(request.headers["X-BAPI-SIGN"])
        self.assertEqual(options["proxies"], {})
        self.assertIs(options["verify"], True)
        self.assertNotIn(self.secret, repr(self.transport._sdk))

    def test_missing_keys_and_unexpected_sdk_origin_fail_before_network(self):
        with patch.dict(os.environ, {"BYBIT_API_SECRET":""}):
            with self.assertRaises(DemoError): DemoTransport.from_env()
        self.transport._sdk.endpoint = "https://invalid.invalid"
        with self.assertRaises(DemoError): self.transport.call("get_server_time")
        self.wire.assert_not_called()

    def test_public_check_is_unsigned_and_cannot_become_a_private_session(self):
        with patch.dict(os.environ, {"DEMO_TRADING_ENABLED":"true"}):
            client = DemoTransport(public_only=True)
            client.call("get_server_time")
            headers = self.wire.call_args.args[1].headers
            self.assertFalse(any(k.startswith("X-BAPI-API-KEY") or k.startswith("X-BAPI-SIGN") for k in headers))
            with self.assertRaises(DemoError):
                client.call("get_wallet_balance", accountType="UNIFIED")
            with self.assertRaises(DemoError):
                client._write("place_order")
            self.assertEqual(self.wire.call_count, 1)

    def test_identity_lookup_excludes_key_and_private_profile_fields(self):
        self.response["result"] = {"userID":1234, "apiKey":self.key, "secret":self.secret, "ips":["127.0.0.1"]}
        self.assertEqual(self.transport.call("get_api_key_information"), {"userID":1234})

    def test_prepared_urls_and_methods_are_pinned_at_last_hop(self):
        for url in ("https://api.bybit.com/v5/market/time", "http://api-demo.bybit.com/v5/market/time",
                    "https://api-demo.bybit.com.invalid.invalid/v5/market/time",
                    "https://api-demo.bybit.com:8443/v5/market/time", DEMO_URL + "/v5/asset/transfer"):
            with self.subTest(url=url), self.assertRaises(DemoError):
                self.transport._sdk.client.get(url)
        self.wire.assert_not_called()

    def test_redirects_are_blocked_even_for_an_authenticated_call(self):
        self.status = 307
        self.location = "https://api.bybit.com/v5/account/wallet-balance"
        with self.assertRaisesRegex(DemoError, "redirect"):
            self.transport.call("get_wallet_balance", accountType="UNIFIED")
        self.assertEqual(self.wire.call_count, 1)
        self.assertTrue(self.wire.call_args.args[1].url.startswith(DEMO_URL+"/"))

    def test_flag_and_public_read_surface_do_not_allow_accidental_writes(self):
        for flag in ("", "false", "True", "1", "yes"):
            with self.subTest(flag=flag), patch.dict(os.environ, {"DEMO_TRADING_ENABLED":flag}):
                with self.assertRaises(DemoError): self.transport._write("place_order")
                with self.assertRaises(DemoError): self.transport._sdk.client.post(DEMO_URL + "/v5/order/create")
        with patch.dict(os.environ, {"DEMO_TRADING_ENABLED":"true"}):
            with self.assertRaises(DemoError): self.transport.call("place_order")
            with self.assertRaises(DemoError): self.transport._write("set_leverage")
            self.wire.assert_not_called()
            self.transport._write("cancel_order", category="linear", symbol="ETHUSDT", orderId="mock-id")
            self.assertEqual(self.wire.call_args.args[1].url, DEMO_URL+"/v5/order/cancel")

    def test_stale_and_malformed_read_envelopes_fail_closed(self):
        self.response["time"] -= 20000
        with self.assertRaisesRegex(DemoError, "timestamp"):
            self.transport.call("get_server_time")
        self.response = {"retCode":0, "retMsg":"OK", "result":None}
        with self.assertRaisesRegex(DemoError, "result"):
            self.transport.call("get_server_time")

    def test_no_raw_sdk_messages_or_secrets_in_diagnostics_or_retries(self):
        buffer = io.StringIO()
        handler = logging.StreamHandler(buffer)
        root = logging.getLogger()
        level = root.level
        root.addHandler(handler)
        root.setLevel(logging.DEBUG)
        self.addCleanup(root.removeHandler, handler)
        self.addCleanup(root.setLevel, level)
        self.response.update(retCode=10006, retMsg=self.secret+self.key)
        with contextlib.redirect_stdout(buffer), contextlib.redirect_stderr(buffer):
            with self.assertRaises(DemoError) as raised:
                self.transport.call("get_wallet_balance", accountType="UNIFIED")
        self.assertEqual(self.wire.call_count, 1)
        self.assertIn("10006", str(raised.exception))
        self.assertIsNone(raised.exception.__context__)
        for value in (self.key, self.secret):
            self.assertNotIn(value, str(raised.exception) + buffer.getvalue())
        with patch.object(http.client.HTTPConnection, "debuglevel", 1):
            with self.assertRaisesRegex(DemoError,"debugging"):
                self.transport.call("get_wallet_balance", accountType="UNIFIED")
        self.assertEqual(self.wire.call_count, 1)


if __name__ == "__main__":
    unittest.main()

