import json
import io
import os
import threading
import unittest
from http.server import ThreadingHTTPServer
from unittest.mock import patch
from urllib.error import HTTPError
from urllib.request import Request, urlopen

import fema_proxy_server
from services.ai_gateway import AIGateway, GatewayError
from services.ai_tools import Principal


ORIGIN = "http://127.0.0.1:5174"


class GatewayUnitTests(unittest.TestCase):
    def setUp(self):
        self.gateway = AIGateway(mode="mock", allowed_origins={ORIGIN})
        self.owner, self.cookie = self.gateway.create_guest_cookie("127.0.0.1", ORIGIN)

    def test_mock_stream_queries_actual_public_records_and_keeps_history(self):
        conversation = self.gateway.new_conversation(self.owner)
        events = list(self.gateway.chat(self.owner, conversation["id"], "查询 CAS 141-78-6，并介绍它的风味特征。"))
        self.assertEqual(events[0]["type"], "start")
        self.assertIn("tool", [event["type"] for event in events])
        self.assertIn("乙酸乙酯", "".join(event.get("text", "") for event in events))
        self.assertEqual(events[-1]["type"], "done")
        self.assertEqual(len(self.gateway.get_conversation(self.owner, conversation["id"])["messages"]), 2)
        self.assertEqual(self.gateway.active[self.owner.user_id], 0)

    def test_other_identity_cannot_read_or_delete_conversation(self):
        conversation = self.gateway.new_conversation(self.owner)
        other, _ = self.gateway.create_guest_cookie("127.0.0.1", ORIGIN)
        for operation in (self.gateway.get_conversation, self.gateway.delete_conversation):
            with self.assertRaises(GatewayError):
                operation(other, conversation["id"])

    def test_origin_cookie_and_rate_limits_are_enforced(self):
        with self.assertRaises(GatewayError):
            self.gateway.create_guest_cookie("203.0.113.1", ORIGIN)
        with self.assertRaises(GatewayError):
            self.gateway.principal("", self.cookie, "127.0.0.1", "https://untrusted.example")
        restored = self.gateway.principal("", self.cookie, "127.0.0.1", ORIGIN)
        self.assertEqual(restored.user_id, self.owner.user_id)
        self.gateway.per_minute = 1
        conversation = self.gateway.new_conversation(self.owner)
        list(self.gateway.chat(self.owner, conversation["id"], "hello"))
        with self.assertRaises(GatewayError) as caught:
            self.gateway.chat(self.owner, conversation["id"], "again")
        self.assertEqual(caught.exception.code, "RATE_LIMITED")

    def test_no_server_key_or_model_is_explicit_and_never_returned(self):
        gateway = AIGateway(mode="openai", api_key="", model="", allowed_origins={ORIGIN})
        principal = Principal("11111111-1111-4111-8111-111111111111", token="test")
        conversation = gateway.new_conversation(principal)
        with self.assertRaises(GatewayError) as caught:
            gateway.chat(principal, conversation["id"], "hello")
        self.assertEqual(caught.exception.code, "OPENAI_NOT_CONFIGURED")
        self.assertNotIn("api_key", gateway.configuration())

    def test_local_real_mode_requires_explicit_opt_in_and_still_denies_private_task(self):
        gateway = AIGateway(mode="openai", api_key="test", model="test", allowed_origins={ORIGIN})
        with self.assertRaises(GatewayError):
            gateway.create_guest_cookie("127.0.0.1", ORIGIN)
        with patch.dict(os.environ, {"FLAVOR_AI_ALLOW_LOCAL_REAL": "true"}):
            gateway = AIGateway(mode="openai", api_key="test", model="test", allowed_origins={ORIGIN})
        guest, cookie = gateway.create_guest_cookie("127.0.0.1", ORIGIN)
        self.assertEqual(gateway.principal("", cookie, "127.0.0.1", ORIGIN).user_id, guest.user_id)
        result = gateway._tool("get_analysis_task", {"task_id": "11111111-1111-4111-8111-111111111111"}, guest)
        self.assertEqual(result["error"], "AUTH_REQUIRED")

    def test_mocked_responses_api_executes_read_only_tool_and_streams_answer(self):
        requests = []
        def event(value):
            return ("data: " + json.dumps(value) + "\n\n").encode()
        streams = [
            event({"type": "response.completed", "response": {"output": [{"type": "function_call", "name": "search_compound", "arguments": '{"query":"141-78-6"}', "call_id": "call-1"}], "usage": {"input_tokens": 12, "output_tokens": 7}}}),
            event({"type": "response.output_text.delta", "delta": "Evidence: ethyl acetate."}) + event({"type": "response.completed", "response": {"output": [], "usage": {"input_tokens": 28, "output_tokens": 11}}}),
        ]
        def fake_open(request, timeout):
            requests.append(request)
            return io.BytesIO(streams[len(requests) - 1])
        gateway = AIGateway(mode="openai", model="account-verified-model", api_key="server-test-secret", open_url=fake_open)
        principal = Principal("11111111-1111-4111-8111-111111111111", token="test")
        conversation = gateway.new_conversation(principal)
        events = list(gateway.chat(principal, conversation["id"], "CAS 141-78-6"))
        self.assertEqual([event["type"] for event in events], ["start", "tool", "delta", "usage", "done"])
        self.assertEqual(events[-2]["input_tokens"], 40)
        self.assertEqual(json.loads(requests[1].data)["input"][-1]["call_id"], "call-1")
        self.assertEqual(json.loads(json.loads(requests[1].data)["input"][-1]["output"])["results"][0]["cas"], "141-78-6")
        self.assertNotIn("server-test-secret", str(events))
        self.assertEqual(gateway.active[principal.user_id], 0)

    def test_cancelled_stream_releases_slot_without_saving_partial_reply(self):
        conversation = self.gateway.new_conversation(self.owner)
        stream = self.gateway.chat(self.owner, conversation["id"], "CAS 141-78-6")
        next(stream)
        stream.close()
        self.assertEqual(self.gateway.active[self.owner.user_id], 0)
        self.assertEqual(self.gateway.get_conversation(self.owner, conversation["id"])["messages"], [])

    def test_model_cannot_issue_more_than_four_tools_in_one_round(self):
        calls = [{"type": "function_call", "name": "search_compound", "arguments": '{"query":"141-78-6"}', "call_id": f"call-{index}"} for index in range(5)]
        event = ("data: " + json.dumps({"type": "response.completed", "response": {"output": calls}}) + "\n\n").encode()
        gateway = AIGateway(mode="openai", model="test", api_key="test", open_url=lambda *_args, **_kwargs: io.BytesIO(event))
        principal = Principal("11111111-1111-4111-8111-111111111111", token="test")
        conversation = gateway.new_conversation(principal)
        with self.assertRaises(GatewayError) as caught:
            list(gateway.chat(principal, conversation["id"], "CAS 141-78-6"))
        self.assertEqual(caught.exception.code, "TOOL_LIMIT")
        self.assertEqual(len(gateway.audit), 0)


class GatewayHttpTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.gateway = AIGateway(mode="mock", allowed_origins={ORIGIN})
        cls.patch = patch.object(fema_proxy_server, "AI_GATEWAY", cls.gateway)
        cls.patch.start()
        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), fema_proxy_server.Handler)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.base = f"http://127.0.0.1:{cls.server.server_port}"

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.patch.stop()

    def request(self, path, *, method="GET", cookie="", payload=None, origin=ORIGIN):
        headers = {"Origin": origin}
        if cookie:
            headers["Cookie"] = cookie
        body = None
        if payload is not None:
            headers["Content-Type"] = "application/json"
            body = json.dumps(payload).encode()
        return urlopen(Request(self.base + path, headers=headers, data=body, method=method), timeout=5)

    def test_session_chat_stream_and_cross_origin_denial(self):
        with self.request("/ai/session") as response:
            session = json.load(response)
            cookie = response.headers["Set-Cookie"].split(";", 1)[0]
            self.assertEqual(session["mode"], "mock")
            self.assertEqual(response.headers["Access-Control-Allow-Origin"], ORIGIN)
            self.assertNotIn("api_key", str(session))
        with self.request("/ai/conversations", method="POST", cookie=cookie) as response:
            conversation = json.load(response)
        with self.request("/ai/chat", method="POST", cookie=cookie, payload={"conversation_id": conversation["id"], "message": "CAS 141-78-6"}) as response:
            events = [json.loads(line[6:]) for line in response if line.startswith(b"data: ")]
        self.assertEqual(events[-1]["type"], "done")
        self.assertTrue(any(event.get("name") == "search_compound" for event in events))
        with self.assertRaises(HTTPError) as caught:
            self.request("/ai/conversations", cookie=cookie, origin="https://evil.example")
        self.assertEqual(caught.exception.code, 403)


if __name__ == "__main__":
    unittest.main()
