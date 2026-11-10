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
from services.ai_tools import Principal, ResearchTools


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
            gateway = AIGateway(mode="openai", api_key="test", model="test", allowed_origins={ORIGIN}, private_task_tools=True)
        guest, cookie = gateway.create_guest_cookie("127.0.0.1", ORIGIN)
        self.assertEqual(gateway.principal("", cookie, "127.0.0.1", ORIGIN).user_id, guest.user_id)
        result = gateway._tool("get_analysis_task", {"task_id": "11111111-1111-4111-8111-111111111111"}, guest)
        self.assertEqual(result["error"], "AUTH_REQUIRED")

    def test_private_task_tools_are_off_by_default(self):
        task_id = "11111111-1111-4111-8111-111111111111"
        self.assertFalse(self.gateway.configuration()["private_task_tools_enabled"])
        self.assertEqual(self.gateway._tool("get_analysis_task", {"task_id": task_id}, self.owner)["error"], "PRIVATE_TASKS_UNAVAILABLE")
        conversation = self.gateway.new_conversation(self.owner)
        with self.assertRaises(GatewayError) as caught:
            self.gateway.chat(self.owner, conversation["id"], f"Explain task {task_id}")
        self.assertEqual(caught.exception.code, "PRIVATE_TASKS_UNAVAILABLE")
        self.assertEqual(self.gateway.get_conversation(self.owner, conversation["id"])["messages"], [])

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
        self.assertEqual(json.loads(requests[0].data)["tool_choice"], {"type": "function", "name": "search_compound"})
        self.assertFalse({"get_analysis_task", "get_analysis_summary"} & {tool["name"] for tool in json.loads(requests[0].data)["tools"]})
        self.assertEqual(json.loads(requests[1].data)["tool_choice"], "auto")
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

    def test_estimated_cost_uses_verified_standard_and_cached_rates(self):
        with patch.dict(os.environ, {"FLAVOR_AI_INPUT_USD_PER_MILLION": "2", "FLAVOR_AI_CACHED_INPUT_USD_PER_MILLION": "0.1", "FLAVOR_AI_OUTPUT_USD_PER_MILLION": "10"}):
            gateway = AIGateway(mode="mock")
        usage = gateway._finish(self.owner, "2026-11-10", {"input_tokens": 1000, "cached_input_tokens": 200, "output_tokens": 100})
        self.assertEqual(usage["cached_input_tokens"], 200)
        self.assertEqual(usage["estimated_cost_usd"], 0.00262)

    def test_history_is_bounded_without_losing_latest_turn(self):
        messages = [{"role": "user" if index % 2 == 0 else "assistant", "content": str(index) + "x" * 3900} for index in range(20)]
        history = AIGateway._bounded_history(messages)
        self.assertLessEqual(sum(len(item["content"]) for item in history), 12_000)
        self.assertEqual(history[-1]["content"], messages[-1]["content"])
        self.assertLess(len(history), 16)

    def test_upstream_rate_limit_retries_once_then_fails_without_saving_message(self):
        attempts = []
        def limited(request, timeout):
            attempts.append(timeout)
            raise HTTPError(request.full_url, 429, "rate limited", {}, None)
        gateway = AIGateway(mode="openai", model="test", api_key="test", open_url=limited)
        principal = Principal("11111111-1111-4111-8111-111111111111", token="test")
        conversation = gateway.new_conversation(principal)
        with patch("services.ai_gateway.time.sleep"), self.assertRaises(GatewayError) as caught:
            list(gateway.chat(principal, conversation["id"], "test"))
        self.assertEqual(caught.exception.code, "OPENAI_UPSTREAM")
        self.assertEqual(len(attempts), 2)
        self.assertEqual(gateway.get_conversation(principal, conversation["id"])["messages"], [])
        self.assertEqual(gateway.active[principal.user_id], 0)

    def test_incomplete_model_response_is_not_persisted_as_success(self):
        event = b'data: {"type":"response.incomplete","response":{"incomplete_details":{"reason":"max_output_tokens"}}}\n\n'
        gateway = AIGateway(mode="openai", model="test", api_key="synthetic-key", open_url=lambda *_args, **_kwargs: io.BytesIO(event))
        principal = Principal("11111111-1111-4111-8111-111111111111", token="synthetic-jwt")
        conversation = gateway.new_conversation(principal)
        with self.assertRaises(GatewayError) as caught:
            list(gateway.chat(principal, conversation["id"], "Explain source evidence"))
        self.assertEqual(caught.exception.code, "OPENAI_OUTPUT_LIMIT")
        self.assertEqual(gateway.get_conversation(principal, conversation["id"])["messages"], [])

    def test_retry_after_tool_result_does_not_repeat_read_only_tool(self):
        calls, requests = [], []
        class CountingTools:
            def call(self, name, args, principal):
                calls.append((name, args, principal.user_id))
                return {"query": "141-78-6", "results": [], "count": 0}
        first = {"type": "response.completed", "response": {"output": [{"type": "function_call", "name": "search_compound", "arguments": '{"query":"141-78-6"}', "call_id": "c1"}], "usage": {"input_tokens": 10, "output_tokens": 5}}}
        final = [{"type": "response.output_text.delta", "delta": "No platform record."}, {"type": "response.completed", "response": {"output": [], "usage": {"input_tokens": 20, "output_tokens": 8}}}]
        def fake_open(request, timeout):
            requests.append(request)
            if len(requests) == 2:
                raise HTTPError(request.full_url, 429, "rate limited", {}, None)
            payload = [first] if len(requests) == 1 else final
            return io.BytesIO("".join("data: " + json.dumps(item) + "\n\n" for item in payload).encode())
        gateway = AIGateway(mode="openai", model="test", api_key="synthetic-key", tools=CountingTools(), open_url=fake_open)
        principal = Principal("11111111-1111-4111-8111-111111111111", token="synthetic-jwt")
        conversation = gateway.new_conversation(principal)
        with patch("services.ai_gateway.time.sleep"):
            events = list(gateway.chat(principal, conversation["id"], "查询 CAS 141-78-6"))
        self.assertEqual(len(requests), 3)
        self.assertEqual(len(calls), 1)
        self.assertEqual(events[-1]["type"], "done")

    def test_cancel_live_stream_releases_slot_without_committing_partial_answer(self):
        event = b'data: {"type":"response.output_text.delta","delta":"partial"}\n\n'
        upstream = io.BytesIO(event)
        gateway = AIGateway(mode="openai", model="test", api_key="synthetic-key", open_url=lambda *_args, **_kwargs: upstream)
        principal = Principal("11111111-1111-4111-8111-111111111111", token="synthetic-jwt")
        conversation = gateway.new_conversation(principal)
        stream = gateway.chat(principal, conversation["id"], "Explain")
        self.assertEqual(next(stream)["type"], "start")
        self.assertEqual(next(stream)["type"], "delta")
        stream.close()
        self.assertTrue(upstream.closed)
        self.assertEqual(gateway.active[principal.user_id], 0)
        self.assertEqual(gateway.get_conversation(principal, conversation["id"])["messages"], [])

    def test_verified_synthetic_jwts_isolate_conversations_and_tool_arguments(self):
        alice = "11111111-1111-4111-8111-111111111111"
        bob = "33333333-3333-4333-8333-333333333333"
        task = "22222222-2222-4222-8222-222222222222"
        identities = {"jwt-alice": alice, "jwt-bob": bob}
        def auth_open(request, timeout):
            token = request.headers["Authorization"].removeprefix("Bearer ")
            if token not in identities:
                raise HTTPError(request.full_url, 401, "invalid", {}, None)
            return io.BytesIO(json.dumps({"id": identities[token]}).encode())
        def store_fetch(url, headers):
            if "/profiles?" in url:
                return [{"id": identities[headers["Authorization"].removeprefix("Bearer ")], "is_admin": False}]
            return [{"id": task, "user_id": alice, "status": "complete", "stage_summary": [], "qc_summary": {}}] if headers["Authorization"] == "Bearer jwt-alice" else []
        tools = ResearchTools(supabase_url="https://test.invalid", supabase_anon_key="synthetic-anon", fetch_json=store_fetch)
        gateway = AIGateway(mode="mock", supabase_url="https://test.invalid", supabase_anon_key="synthetic-anon", tools=tools, open_url=auth_open, allowed_origins={ORIGIN}, private_task_tools=True)
        alice_principal = gateway.principal("Bearer jwt-alice", "", "127.0.0.1", ORIGIN)
        bob_principal = gateway.principal("Bearer jwt-bob", "", "127.0.0.1", ORIGIN)
        self.assertEqual(gateway._tool("get_analysis_task", {"task_id": task}, alice_principal)["task_id"], task)
        self.assertEqual(gateway._tool("get_analysis_task", {"task_id": task}, bob_principal)["error"], "TASK_NOT_FOUND")
        self.assertEqual(gateway._tool("get_analysis_task", {"task_id": task, "user_id": alice}, bob_principal)["error"], "INVALID_ARGUMENT")
        conversation = gateway.new_conversation(alice_principal)
        with self.assertRaises(GatewayError) as caught:
            gateway.get_conversation(bob_principal, conversation["id"])
        self.assertEqual(caught.exception.status, 404)
        with self.assertRaises(GatewayError):
            gateway.principal("Bearer forged-jwt", "", "127.0.0.1", ORIGIN)

    def test_foreign_task_model_call_stops_after_server_denial(self):
        task = "22222222-2222-4222-8222-222222222222"
        model_requests = []
        def fake_open(request, timeout):
            model_requests.append(json.loads(request.data))
            event = {"type": "response.completed", "response": {"output": [{"type": "function_call", "name": "get_analysis_summary", "arguments": json.dumps({"task_id": task}), "call_id": "call-1"}], "usage": {"input_tokens": 20, "output_tokens": 5}}}
            return io.BytesIO(("data: " + json.dumps(event) + "\n\n").encode())
        tools = ResearchTools(supabase_url="https://test.invalid", supabase_anon_key="synthetic-anon", fetch_json=lambda *_: [])
        gateway = AIGateway(mode="openai", model="test", api_key="synthetic-key", tools=tools, open_url=fake_open, private_task_tools=True)
        principal = Principal("11111111-1111-4111-8111-111111111111", token="synthetic-jwt")
        conversation = gateway.new_conversation(principal)
        events = list(gateway.chat(principal, conversation["id"], f"解释任务 {task} 的摘要"))
        self.assertEqual(model_requests[0]["tool_choice"], {"type": "function", "name": "get_analysis_summary"})
        self.assertEqual(len(model_requests), 1)
        self.assertIn("无法读取该任务", "".join(item.get("text", "") for item in events))
        self.assertFalse(events[-1]["sources"])

    def test_pubchem_enrichment_rejects_unconfirmed_cid(self):
        with patch.object(fema_proxy_server, "query_pubchem", return_value={"found": True, "cid": 8857}), patch.object(fema_proxy_server, "query_pubchem_cas_candidates", return_value={"candidates": ["other"]}), patch.object(fema_proxy_server, "query_pubchem_volatile_properties") as volatile:
            self.assertEqual(fema_proxy_server._ai_verified_public_enrichment("141-78-6")["status"], "identity_unverified")
            volatile.assert_not_called()
        with patch.object(fema_proxy_server, "query_pubchem", return_value={"found": True, "cid": 8857}), patch.object(fema_proxy_server, "query_pubchem_cas_candidates", return_value={"candidates": ["141-78-6"]}), patch.object(fema_proxy_server, "query_pubchem_volatile_properties", return_value={"status": "ok", "properties": {}}):
            self.assertEqual(fema_proxy_server._ai_verified_public_enrichment("141-78-6")["status"], "verified")

    def test_deep_cas_question_forces_detail_with_exact_identifier(self):
        requests = []
        events = [
            {"type": "response.completed", "response": {"output": [{"type": "function_call", "name": "get_compound_detail", "arguments": '{"identifier":"141-78-6"}', "call_id": "detail-1"}], "usage": {"input_tokens": 10, "output_tokens": 5}}},
            {"type": "response.output_text.delta", "delta": "Only source-backed values."},
            {"type": "response.completed", "response": {"output": [], "usage": {"input_tokens": 20, "output_tokens": 7}}},
        ]
        streams = [io.BytesIO(("data: " + json.dumps(events[0]) + "\n\n").encode()), io.BytesIO("".join("data: " + json.dumps(item) + "\n\n" for item in events[1:]).encode())]
        def fake_open(request, timeout):
            requests.append(json.loads(request.data))
            return streams[len(requests) - 1]
        gateway = AIGateway(mode="openai", model="test", api_key="synthetic-key", open_url=fake_open)
        principal = Principal("11111111-1111-4111-8111-111111111111", token="synthetic-jwt")
        conversation = gateway.new_conversation(principal)
        result = list(gateway.chat(principal, conversation["id"], "查询 CAS 141-78-6 的理化性质和蒸气压来源"))
        self.assertEqual(requests[0]["tool_choice"], {"type": "function", "name": "get_compound_detail"})
        self.assertEqual(requests[1]["tool_choice"], "auto")
        self.assertTrue(any(event.get("name") == "get_compound_detail" for event in result))


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

    def test_pca_plan_http_requires_session_and_rejects_raw_matrix(self):
        inspection = {"dataset_id": "synthetic-http", "samples": 6, "features": 3, "missing_cells": 0,
                      "constant_variables": 0, "all_missing_variables": 0, "qc_filtered_cells": 0,
                      "source_sha256": None, "synthetic": True, "warning_codes": []}
        with self.request('/ai/session') as response:
            cookie = response.headers['Set-Cookie'].split(';', 1)[0]
        with self.request('/ai/analysis/plan', method='POST', cookie=cookie,
                          payload={"goal": "explore", "inspection": inspection}) as response:
            result = json.load(response)
        self.assertEqual(result['plan']['dataset_id'], 'synthetic-http')
        self.assertEqual(result['mode'], 'mock')
        with self.assertRaises(HTTPError) as caught:
            self.request('/ai/analysis/plan', method='POST', cookie=cookie,
                         payload={"goal": "explore", "inspection": {**inspection, "matrix": [[1, 2]]}})
        self.assertEqual(caught.exception.code, 400)


if __name__ == "__main__":
    unittest.main()
