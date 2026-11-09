import hashlib
import io
import json
import tempfile
import unittest
from pathlib import Path
from urllib.parse import parse_qs, urlparse
from zipfile import ZipFile

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
        self.assertTrue(detail["threshold_source_lines"])
        self.assertGreater(detail["threshold_source_line_total"], len(detail["threshold_source_lines"]))
        self.assertEqual(detail["physicochemical_properties"]["status"], "unavailable")
        self.assertIn("physicochemical_properties", detail["missing"])
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

    def test_two_synthetic_users_and_verified_admin_follow_store_rls(self):
        users = ["11111111-1111-4111-8111-111111111111", "33333333-3333-4333-8333-333333333333"]
        task_ids = ["22222222-2222-4222-8222-222222222222", "44444444-4444-4444-8444-444444444444"]
        admin = "55555555-5555-4555-8555-555555555555"
        rows = {task_ids[index]: {"id": task_ids[index], "user_id": user, "name": f"Synthetic {index}", "status": "complete", "stage_summary": [], "qc_summary": {}} for index, user in enumerate(users)}
        seen = []
        def fetch(url, headers):
            path = urlparse(url).path
            query = parse_qs(urlparse(url).query)
            caller = headers["Authorization"].removeprefix("Bearer token-")
            seen.append((path, query, caller))
            if path.endswith("/profiles"):
                return [{"id": admin, "is_admin": True}] if caller == admin else [{"id": caller, "is_admin": False}]
            task_id = query["id"][0].removeprefix("eq.")
            row = rows.get(task_id)
            if not row or row["user_id"] != caller and caller != admin:
                return []
            if "user_id" in query and (query["user_id"][0] != f"eq.{caller}" or row["user_id"] != caller):
                return []
            return [row]
        tools = ResearchTools(supabase_url="https://test.invalid", supabase_anon_key="synthetic-anon", fetch_json=fetch)
        alice, bob, root = (Principal(user, token=f"token-{user}") for user in [*users, admin])
        self.assertEqual(tools.call("get_analysis_task", {"task_id": task_ids[0]}, alice)["task_id"], task_ids[0])
        self.assertEqual(tools.call("get_analysis_task", {"task_id": task_ids[1]}, bob)["task_id"], task_ids[1])
        for candidate in [task_ids[1], "66666666-6666-4666-8666-666666666666"]:
            with self.assertRaises(ToolError) as caught:
                tools.call("get_analysis_task", {"task_id": candidate}, alice)
            self.assertEqual(caught.exception.code, "TASK_NOT_FOUND")
            self.assertEqual(str(caught.exception), "Task not found or access denied")
        self.assertEqual(tools.call("get_analysis_task", {"task_id": task_ids[1]}, root)["task_id"], task_ids[1])
        self.assertTrue(any(path.endswith("/profiles") and caller == admin for path, _, caller in seen))
        with self.assertRaises(ToolError) as caught:
            tools.call("get_analysis_task", {"task_id": task_ids[1], "user_id": users[1]}, alice)
        self.assertEqual(caught.exception.code, "INVALID_ARGUMENT")

    def test_synthetic_derived_zip_yields_bounded_semquant_evidence(self):
        owner, task = "11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222"
        stage_path = "04_跨样品合并与半定量/data.json"
        stage5_path = "05_统计_CV_CAS与QC/data.json"
        derived = {"table": {"rows": [{"CAS #": "141-78-6", "中文名": "乙酸乙酯", "化合物分类": "酯类"}]}, "concentrationStatus": [{"cas": "141-78-6", "sampleName": "tech@example.org", "concentration": 2.5, "status": "Calculated"}], "counts": {"naConcentrations": 2}}
        statistics = {"cvScreeningExecuted": True, "cvThreshold": 30, "counts": {"allNaGroups": 0, "incompleteGroups": 1, "filteredGroups": 1}, "groupStatistics": [{"cas": "141-78-6", "sampleGroup": "SYNTHETIC_G", "sampleNames": ["S1", "S2", "S3"], "concentrations": [2.0, 2.5, 3.0], "mean": 2.5, "sd": 0.5, "cv": 20.0, "status": "Retained_CV_At_Or_Below_Threshold"}, {"cas": "141-78-6", "sampleGroup": "SYNTHETIC_MISSING", "sampleNames": ["M1", "M2", "M3"], "concentrations": [2.0, "NA", "NA"], "mean": "NA", "sd": "NA", "cv": "NA", "status": "Incomplete_Triplicate"}, {"cas": "141-78-6", "sampleGroup": "SYNTHETIC_CV_FAIL", "sampleNames": ["F1", "F2", "F3"], "concentrations": [1.0, 5.0, 9.0], "mean": 5.0, "sd": 4.0, "cv": 80.0, "status": "Filtered_CV_Above_Threshold"}]}
        data = json.dumps(derived, ensure_ascii=False).encode()
        stage5_data = json.dumps(statistics, ensure_ascii=False).encode()
        manifest = {"outputHashes": [{"path": stage_path, "sha256": hashlib.sha256(data).hexdigest()}]}
        stage5_manifest = {"outputHashes": [{"path": stage5_path, "sha256": hashlib.sha256(stage5_data).hexdigest()}], "severity": "PASS"}
        buffer = io.BytesIO()
        with ZipFile(buffer, "w") as archive:
            archive.writestr(stage_path, data)
            archive.writestr("04_跨样品合并与半定量/manifest.json", json.dumps(manifest))
            archive.writestr(stage5_path, stage5_data)
            archive.writestr("05_统计_CV_CAS与QC/manifest.json", json.dumps(stage5_manifest))
        result_bytes = buffer.getvalue()
        row = {"id": task, "user_id": owner, "name": "Synthetic tech@example.org", "status": "complete", "stage_summary": [{"stage": 5, "status": "PASS", "counts": {"filteredGroups": 1}}], "qc_summary": {"incompleteGroups": 1, "filteredGroups": 1}, "result_path": f"{owner}/{task}/result.zip", "result_size": len(result_bytes), "result_sha256": hashlib.sha256(result_bytes).hexdigest()}
        tools = ResearchTools(supabase_url="https://test.invalid", supabase_anon_key="synthetic-anon", fetch_json=lambda *_: [row], fetch_bytes=lambda *_: result_bytes)
        result = tools.call("get_analysis_summary", {"task_id": task}, Principal(owner, token="synthetic-token"))
        self.assertEqual(result["derived_status"], "integrity_checked_derived_excerpt")
        self.assertEqual(result["compound_results"]["items"][0]["cas"], "141-78-6")
        self.assertIn("internal standards", result["compound_results"]["basis"])
        self.assertEqual(result["category_distribution"]["items"][0], {"category": "酯类", "count": 1})
        self.assertEqual(result["semiquantitative_results"]["items"][0]["unit"], "μg/mL")
        self.assertEqual(result["semiquantitative_results"]["items"][0]["value"], 2.5)
        self.assertEqual(result["qc_status"], "PASS")
        self.assertEqual(result["replicate_statistics"]["items"][0]["mean"], 2.5)
        self.assertEqual(result["replicate_statistics"]["items"][0]["sd"], 0.5)
        self.assertEqual(result["replicate_statistics"]["items"][0]["cv_percent"], 20.0)
        self.assertEqual(result["replicate_statistics"]["items"][0]["replicates"][0], {"sample": "S1", "value": 2.0})
        self.assertIsNone(result["replicate_statistics"]["items"][1]["mean"])
        self.assertEqual(result["replicate_statistics"]["items"][1]["status"], "Incomplete_Triplicate")
        self.assertEqual(result["missing_and_filters"]["stage4_na_concentrations"], 2)
        self.assertEqual(result["missing_and_filters"]["incomplete_groups"], 1)
        self.assertEqual(result["missing_and_filters"]["cv_filtered_groups"], 1)
        self.assertEqual(result["replicate_statistics"]["items"][2]["status"], "Filtered_CV_Above_Threshold")
        self.assertEqual(result["derived_evidence"]["statistics_stage_sha256"], hashlib.sha256(stage5_data).hexdigest())
        self.assertNotIn("tech@example.org", str(result))
        self.assertNotIn("result_path", str(result))
        row["stage_summary"] = [{"stage": 5, "status": "WARN"}]
        self.assertEqual(tools.call("get_analysis_summary", {"task_id": task}, Principal(owner, token="synthetic-token"))["qc_status"], "WARN")
        row["stage_summary"] = []
        self.assertEqual(tools.call("get_analysis_summary", {"task_id": task}, Principal(owner, token="synthetic-token"))["qc_status"], "PASS")
        row["result_sha256"] = "0" * 64
        with self.assertRaises(ToolError) as caught:
            tools.call("get_analysis_summary", {"task_id": task}, Principal(owner, token="synthetic-token"))
        self.assertEqual(caught.exception.code, "RESULT_INTEGRITY_FAILED")
        row["result_sha256"] = hashlib.sha256(result_bytes).hexdigest()
        row["result_path"] = f"{owner}/../{task}/result.zip"
        with self.assertRaises(ToolError) as caught:
            tools.call("get_analysis_summary", {"task_id": task}, Principal(owner, token="synthetic-token"))
        self.assertEqual(caught.exception.code, "RESULT_INTEGRITY_FAILED")

    def test_stage5_statistics_manifest_mismatch_fails_closed(self):
        owner, task = "11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222"
        stage4_path, stage5_path = "04_跨样品合并与半定量/data.json", "05_统计_CV_CAS与QC/data.json"
        stage4 = json.dumps({"table": {"rows": []}, "concentrationStatus": []}).encode()
        stage5 = json.dumps({"groupStatistics": [{"cas": "141-78-6", "mean": 999}], "counts": {}}).encode()
        archive_buffer = io.BytesIO()
        with ZipFile(archive_buffer, "w") as archive:
            archive.writestr(stage4_path, stage4)
            archive.writestr("04_跨样品合并与半定量/manifest.json", json.dumps({"outputHashes": [{"path": stage4_path, "sha256": hashlib.sha256(stage4).hexdigest()}]}))
            archive.writestr(stage5_path, stage5)
            archive.writestr("05_统计_CV_CAS与QC/manifest.json", json.dumps({"outputHashes": [{"path": stage5_path, "sha256": "0" * 64}]}))
        payload = archive_buffer.getvalue()
        row = {"id": task, "user_id": owner, "status": "complete", "stage_summary": [], "result_path": f"{owner}/{task}/result.zip", "result_size": len(payload), "result_sha256": hashlib.sha256(payload).hexdigest()}
        tools = ResearchTools(supabase_url="https://test.invalid", supabase_anon_key="synthetic-anon", fetch_json=lambda *_: [row], fetch_bytes=lambda *_: payload)
        with self.assertRaises(ToolError) as caught:
            tools.call("get_analysis_summary", {"task_id": task}, Principal(owner, token="synthetic-token"))
        self.assertEqual(caught.exception.code, "RESULT_INTEGRITY_FAILED")

    def test_pubchem_fields_require_exact_verified_cas_and_keep_record_sources(self):
        record = {"found": True, "url": "https://pubchem.ncbi.nlm.nih.gov/compound/8857", "molecular_formula": "C4H8O2", "molecular_weight": 88.11, "xlogp": 0.7}
        volatile = {"url": "https://pubchem.ncbi.nlm.nih.gov/compound/8857#section=Experimental-Properties", "properties": {"vapor_pressure": [{"raw_value": "73 mmHg at 20 C", "unit": "mmHg", "normalized_value": 73, "source": "reported source"}]}}
        tools = ResearchTools(public_enrichment=lambda cas: {"status": "verified", "cas": cas, "pubchem": record, "volatile": volatile})
        detail = tools.call("get_compound_detail", {"identifier": "141-78-6"}, self.guest)
        self.assertEqual(detail["physicochemical_properties"]["values"]["molecular_formula"], "C4H8O2")
        self.assertEqual(detail["volatility_partition"]["values"]["vapor_pressure"][0]["unit"], "mmHg")
        self.assertEqual(detail["physicochemical_properties"]["source"]["dataset"], "PubChem")
        tools = ResearchTools(public_enrichment=lambda cas: {"status": "verified", "cas": "999-99-9", "pubchem": record})
        detail = tools.call("get_compound_detail", {"identifier": "141-78-6"}, self.guest)
        self.assertEqual(detail["physicochemical_properties"]["status"], "unavailable")


if __name__ == "__main__":
    unittest.main()
