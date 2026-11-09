import tempfile
import unittest
from pathlib import Path

from services.ai_tools import Principal, ResearchTools, ToolError


class ResearchToolTests(unittest.TestCase):
    def setUp(self):
        self.tools = ResearchTools()
        self.guest = Principal("local-guest", guest=True)

    def test_real_public_dataset_contains_source_attributed_ethyl_acetate(self):
        result = self.tools.call("search_compound", {"query": "141-78-6"}, self.guest)
        self.assertEqual(result["results"][0]["cas"], "141-78-6")
        self.assertEqual(result["results"][0]["compound_id"], "cas:141-78-6")
        self.assertEqual(result["results"][0]["chinese_name"], "乙酸乙酯")
        self.assertIn("菠萝", result["results"][0]["flavor_descriptors"])
        self.assertEqual(result["results"][0]["source"]["type"], "database_record")
        self.assertNotIn("threshold_data", str(result))
        detail = self.tools.call("get_compound_detail", {"identifier": "cas:141-78-6"}, self.guest)
        self.assertEqual(detail["source"]["type"], "database_record")
        self.assertIsNone(detail["molecular_properties"])
        water_only = self.tools.call("search_compound", {"query": "141-78-6", "medium": "水"}, self.guest)
        self.assertEqual(water_only["results"][0]["media"], ["水"])

    def test_invalid_and_unknown_tools_fail_closed(self):
        for name, args in [("shell", {"command": "id"}), ("search_compound", {"query": "x", "path": "/tmp"}), ("get_analysis_task", {"task_id": "../other"})]:
            with self.subTest(name=name), self.assertRaises(ToolError):
                self.tools.call(name, args, self.guest)

    def test_guest_cannot_read_private_task(self):
        with self.assertRaises(ToolError) as caught:
            self.tools.call("get_analysis_task", {"task_id": "11111111-1111-4111-8111-111111111111"}, self.guest)
        self.assertEqual(caught.exception.code, "AUTH_REQUIRED")

    def test_unconnected_research_knowledge_cannot_fabricate_citations(self):
        with self.assertRaises(ToolError) as caught:
            self.tools.call("search_research_knowledge", {"query": "ethyl acetate"}, self.guest)
        self.assertEqual(caught.exception.code, "KNOWLEDGE_UNAVAILABLE")

    def test_task_query_is_owner_scoped_and_summary_is_bounded(self):
        owner = "11111111-1111-4111-8111-111111111111"
        task = "22222222-2222-4222-8222-222222222222"
        seen = []
        def fetch(url, headers):
            seen.append((url, headers))
            return [{"id": task, "user_id": owner, "name": "Example", "status": "complete", "current_stage": 7, "progress": 100, "stage_summary": [{"index": 0, "status": "PASS", "counts": {"samples": 3}, "log_tail": "secret"}], "qc_summary": {"status": "PASS"}, "result_sha256": "abc"}]
        tools = ResearchTools(supabase_url="https://example.supabase.co", supabase_anon_key="public-anon", fetch_json=fetch)
        principal = Principal(owner, token="user-token")
        result = tools.call("get_analysis_summary", {"task_id": task}, principal)
        self.assertIn(f"user_id=eq.{owner}", seen[0][0])
        self.assertEqual(seen[0][1]["Authorization"], "Bearer user-token")
        self.assertNotIn("secret", str(result))
        self.assertEqual(result["stage_counts"][0]["counts"]["samples"], 3)

    def test_foreign_task_remains_unavailable_even_if_store_returns_it(self):
        owner = "11111111-1111-4111-8111-111111111111"
        task = "22222222-2222-4222-8222-222222222222"
        tools = ResearchTools(supabase_url="https://example.supabase.co", supabase_anon_key="public-anon", fetch_json=lambda *_: [{"id": task, "user_id": "33333333-3333-4333-8333-333333333333"}])
        with self.assertRaises(ToolError) as caught:
            tools.call("get_analysis_task", {"task_id": task}, Principal(owner, token="token"))
        self.assertEqual(caught.exception.code, "TASK_NOT_FOUND")

    def test_malformed_task_response_fails_without_exposing_internals(self):
        owner = "11111111-1111-4111-8111-111111111111"
        task = "22222222-2222-4222-8222-222222222222"
        principal = Principal(owner, token="token")
        tools = ResearchTools(supabase_url="https://example.supabase.co", supabase_anon_key="anon", fetch_json=lambda *_: ["bad"])
        with self.assertRaises(ToolError) as caught:
            tools.call("get_analysis_task", {"task_id": task}, principal)
        self.assertEqual(caught.exception.code, "TASK_NOT_FOUND")
        tools = ResearchTools(supabase_url="https://example.supabase.co", supabase_anon_key="anon", fetch_json=lambda *_: [{"id": task, "user_id": owner, "status": "complete", "stage_summary": "bad"}])
        with self.assertRaises(ToolError) as caught:
            tools.call("get_analysis_summary", {"task_id": task}, principal)
        self.assertEqual(caught.exception.code, "TASK_STORE_INVALID")


if __name__ == "__main__":
    unittest.main()
