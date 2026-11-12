import json
import threading
import unittest
from http.server import ThreadingHTTPServer
from unittest.mock import patch
from urllib.error import HTTPError
from urllib.request import Request, urlopen

import fema_proxy_server
from ai_gateway_server import AIGatewayHandler
from services.ai_gateway import AIGateway


ORIGIN = "http://127.0.0.1:5195"


class AIOnlyServerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), AIGatewayHandler)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.base = f"http://127.0.0.1:{cls.server.server_port}"

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.thread.join(timeout=3)
        cls.server.server_close()

    def setUp(self):
        self.gateway_patch = patch.object(
            fema_proxy_server, "AI_GATEWAY", AIGateway(mode="mock", allowed_origins={ORIGIN})
        )
        self.gateway_patch.start()

    def tearDown(self):
        self.gateway_patch.stop()

    def request(self, path, method="GET", origin=ORIGIN):
        request = Request(
            self.base + path,
            method=method,
            headers={"Origin": origin, "Content-Type": "application/json"},
            data=b"{}" if method == "POST" else None,
        )
        try:
            with urlopen(request, timeout=3) as response:
                return response.status, response.read()
        except HTTPError as error:
            return error.code, error.read()

    def test_health_and_ai_routes_still_work(self):
        status, body = self.request("/health")
        self.assertEqual(status, 200)
        self.assertIn("api_version", json.loads(body))
        status, body = self.request("/ai/session")
        self.assertEqual(status, 200)
        self.assertEqual(json.loads(body)["mode"], "mock")
        status, _ = self.request("/ai/chat", method="OPTIONS")
        self.assertEqual(status, 204)

    def test_legacy_api_routes_are_not_exposed(self):
        for path, method in (
            ("/shimadzu/capabilities", "GET"),
            ("/fema", "GET"),
            ("/shimadzu/jobs", "POST"),
            ("/shimadzu/jobs", "OPTIONS"),
        ):
            with self.subTest(path=path, method=method):
                status, _ = self.request(path, method=method)
                self.assertEqual(status, 404)

    def test_unapproved_origin_cannot_preflight_ai(self):
        status, _ = self.request("/ai/chat", method="OPTIONS", origin="https://untrusted.example")
        self.assertEqual(status, 403)


if __name__ == "__main__":
    unittest.main()
