"""Read-only, bounded projections of existing FlavorInsight AI evidence."""

from __future__ import annotations

import json
import hashlib
import io
import math
import re
import zipfile
import zlib
from collections import Counter
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import quote, urlencode
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


PUBLIC_DATA = Path(__file__).resolve().parents[1] / "frontend" / "public" / "aroma_data_merged.json"
CAS_PATTERN = re.compile(r"^\d{2,7}-\d{2}-\d$")
UUID_PATTERN = re.compile(r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$")


class ToolError(ValueError):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code


@dataclass(frozen=True)
class Principal:
    user_id: str
    token: str = ""
    guest: bool = False
    admin: bool = False


TOOL_SCHEMAS = [
    {"type": "function", "name": "search_compound", "description": "Search existing public FlavorThresholdDB records by CAS or compound name and optional medium. Returns source-attributed identity and descriptors, not inferred thresholds.", "parameters": {"type": "object", "properties": {"query": {"type": "string"}, "medium": {"type": ["string", "null"]}}, "required": ["query", "medium"], "additionalProperties": False}, "strict": True},
    {"type": "function", "name": "get_compound_detail", "description": "Read source-attributed compound identity, flavor and raw threshold source lines; add PubChem property records only after exact CAS identity verification. Missing fields remain unavailable.", "parameters": {"type": "object", "properties": {"identifier": {"type": "string"}}, "required": ["identifier"], "additionalProperties": False}, "strict": True},
    {"type": "function", "name": "get_analysis_task", "description": "Read the authenticated user's GC-MS task metadata, stage progress and QC state only.", "parameters": {"type": "object", "properties": {"task_id": {"type": "string"}}, "required": ["task_id"], "additionalProperties": False}, "strict": True},
    {"type": "function", "name": "get_analysis_summary", "description": "Read an authenticated user's completed task's bounded stage, QC and integrity-checked derived result excerpt without raw Excel or complete logs.", "parameters": {"type": "object", "properties": {"task_id": {"type": "string"}}, "required": ["task_id"], "additionalProperties": False}, "strict": True},
]


class ResearchTools:
    def __init__(self, data_path: Path = PUBLIC_DATA, supabase_url: str = "", supabase_anon_key: str = "", fetch_json=None, fetch_bytes=None, public_enrichment=None):
        self.data_path = Path(data_path)
        self.supabase_url = supabase_url.rstrip("/")
        self.supabase_anon_key = supabase_anon_key
        self.fetch_json = fetch_json or self._fetch_json
        self.fetch_bytes = fetch_bytes or self._fetch_bytes
        self.public_enrichment = public_enrichment
        self._records = None

    @staticmethod
    def _fetch_json(url: str, headers: dict) -> object:
        request = Request(url, headers=headers)
        with urlopen(request, timeout=8) as response:
            return json.load(response)

    @staticmethod
    def _fetch_bytes(url: str, headers: dict) -> bytes:
        request = Request(url, headers=headers)
        with urlopen(request, timeout=12) as response:
            data = response.read(52_428_801)
        if len(data) > 52_428_800:
            raise ToolError("RESULT_UNAVAILABLE", "Stored result exceeds the allowed size")
        return data

    def _public_records(self) -> list[dict]:
        if self._records is None:
            with self.data_path.open(encoding="utf-8") as handle:
                data = json.load(handle)
            if not isinstance(data, list):
                raise ToolError("DATA_UNAVAILABLE", "Public compound data has an unexpected shape")
            self._records = data
        return self._records

    @staticmethod
    def _string(value, field: str, maximum: int = 100) -> str:
        if not isinstance(value, str) or not 1 <= len(value.strip()) <= maximum or any(ord(c) < 32 for c in value):
            raise ToolError("INVALID_ARGUMENT", f"{field} must be a bounded text value")
        return value.strip()

    @staticmethod
    def _safe_text(value, maximum: int = 120) -> str:
        text = str(value or "")[:maximum]
        text = re.sub(r"(?i)\bsk-[A-Za-z0-9_-]{16,}\b|\bBearer\s+\S+", "[redacted credential]", text)
        return re.sub(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b", "[redacted email]", text)

    @staticmethod
    def _validate_args(name: str, args: dict) -> dict:
        fields = {"search_compound": "query", "get_compound_detail": "identifier", "get_analysis_task": "task_id", "get_analysis_summary": "task_id"}
        if name not in fields:
            raise ToolError("UNKNOWN_TOOL", "This tool is not available")
        field = fields[name]
        if not isinstance(args, dict) or (set(args) != {field} and not (name == "search_compound" and set(args) == {field, "medium"})):
            raise ToolError("INVALID_ARGUMENT", "Tool arguments do not match the declared schema")
        value = ResearchTools._string(args[field], field)
        if name == "search_compound" and "medium" in args and args["medium"] is not None:
            return {field: value, "medium": ResearchTools._string(args["medium"], "medium", 40)}
        if field == "task_id" and not UUID_PATTERN.fullmatch(value):
            raise ToolError("INVALID_ARGUMENT", "task_id must be a UUID")
        return {field: value}

    def _compound(self, query: str, limit: int = 8, medium: str | None = None) -> dict:
        needle = query.casefold()
        exact_cas = CAS_PATTERN.fullmatch(query) is not None
        records = []
        seen = set()
        for row in self._public_records():
            cas = str(row.get("cas") or "").strip()
            if medium and str(row.get("medium") or "").casefold() != medium.casefold():
                continue
            names = [str(row.get(key) or "") for key in ("english_name", "chinese_name")]
            if (cas != query if exact_cas else not (needle in cas.casefold() or any(needle in name.casefold() for name in names))):
                continue
            if cas not in seen:
                seen.add(cas)
                related = [item for item in self._public_records() if item.get("cas") == cas and (not medium or str(item.get("medium") or "").casefold() == medium.casefold())]
                records.append({
                    "compound_id": f"cas:{cas}", "cas": cas, "english_name": names[0], "chinese_name": names[1],
                    "media": list(dict.fromkeys(str(item.get("medium") or "") for item in related if item.get("medium")))[:8],
                    "flavor_descriptors": list(dict.fromkeys(str(desc) for item in related for desc in (item.get("flavor_desc_cn") or item.get("flavor_desc") or []) if isinstance(desc, str)))[:12],
                    "flavor_categories": list(dict.fromkeys(str(cat) for item in related for cat in item.get("flavor_categories", []) if isinstance(cat, str)))[:12],
                    "source": {"type": "database_record", "dataset": "FlavorThresholdDB public aroma data", "url": "https://xqplayer.github.io/FlavorInsightAI/aroma-threshold/"},
                })
                if len(records) >= limit:
                    break
        return {"query": query, "results": records, "count": len(records), "note": "Descriptors are recorded database fields; no threshold or quantitative conclusion is inferred."}

    def _compound_detail(self, identifier: str) -> dict:
        result = self._compound(identifier, 1)
        if not result["results"]:
            return {"found": False, "compound": None, "threshold_source_lines": [], "threshold_source_line_total": 0, "missing": ["compound_record"], "source": None}
        compound = result["results"][0]
        rows = [row for row in self._public_records() if str(row.get("cas") or "").strip() == compound["cas"]]
        threshold_source_lines = []
        threshold_total = 0
        for row in rows:
            medium = str(row.get("medium") or "").strip()[:40]
            for raw in row.get("threshold_data") or []:
                if isinstance(raw, str) and raw.strip():
                    threshold_total += 1
                    if len(threshold_source_lines) < 8:
                        threshold_source_lines.append({"medium": medium, "raw_record": raw.strip()[:180], "source": compound["source"]})
        detail = {
            "found": True, "compound": compound,
            "molecular_properties": None,
            "structure_classification": {"status": "unavailable", "value": None},
            "physicochemical_properties": {"status": "unavailable", "values": {}},
            "volatility_partition": {"status": "unavailable", "values": {}},
            "threshold_source_lines": threshold_source_lines,
            "threshold_source_line_total": threshold_total,
            "threshold_source_lines_truncated": threshold_total > len(threshold_source_lines),
            "threshold_note": "These are unparsed source lines, not a count of validated thresholds. They may include headings, cross-references, detection/recognition values, media and units. Do not calculate OAV from them.",
            "missing": ["structure_classification", "physicochemical_properties", "volatility_partition"],
            "source": compound["source"],
        }
        if self.public_enrichment:
            try:
                enrichment = self.public_enrichment(compound["cas"])
            except (HTTPError, URLError, TimeoutError, ValueError, OSError):
                enrichment = {"status": "unavailable"}
            if isinstance(enrichment, dict) and enrichment.get("status") == "verified" and enrichment.get("cas") == compound["cas"]:
                record = enrichment.get("pubchem") or {}
                source = {"type": "external_database", "dataset": "PubChem", "url": str(record.get("url") or "")[:200]}
                allowed = ("molecular_formula", "molecular_weight", "iupac_name", "smiles", "inchi_key", "xlogp", "tpsa")
                properties = {key: value if isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value) else value[:180] for key in allowed if (value := record.get(key)) is not None and (isinstance(value, str) and value.strip() or isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value))}
                detail["physicochemical_properties"] = {"status": "available" if properties else "unavailable", "values": properties, "source": source}
                detail["molecular_properties"] = properties or None
                volatile = enrichment.get("volatile") or {}
                volatile_values = {}
                for key, entries in (volatile.get("properties") or {}).items():
                    if key not in {"boiling_point", "vapor_pressure", "henrys_law_constant", "water_solubility", "experimental_logp", "density", "melting_point", "physical_state"} or not isinstance(entries, list):
                        continue
                    safe_entries = []
                    for entry in entries[:1]:
                        if not isinstance(entry, dict):
                            continue
                        safe_entries.append({field: value[:180] if isinstance(value, str) else value for field in ("raw_value", "normalized_value", "unit", "temperature", "pressure", "medium", "source", "source_url") if (value := entry.get(field)) is not None and (field != "source_url" or isinstance(value, str) and value.startswith("https://")) and (isinstance(value, str) or isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value))})
                    if safe_entries:
                        volatile_values[key] = safe_entries
                detail["volatility_partition"] = {"status": "available" if volatile_values else "unavailable", "values": volatile_values, "source": {"type": "external_database", "dataset": "PubChem PUG View", "url": str(volatile.get("url") or record.get("url") or "")[:200]}}
                detail["missing"] = [key for key in detail["missing"] if key not in {"physicochemical_properties", "volatility_partition"} or detail[key]["status"] == "unavailable"]
            else:
                detail["enrichment_status"] = "identity_unverified_or_unavailable"
        return detail

    def _task(self, task_id: str, principal: Principal) -> dict:
        if principal.guest or not principal.token or not UUID_PATTERN.fullmatch(principal.user_id):
            raise ToolError("AUTH_REQUIRED", "A verified account is required for private task data")
        if not self.supabase_url or not self.supabase_anon_key:
            raise ToolError("TASK_STORE_UNAVAILABLE", "Private task store is not configured")
        selected = "id,user_id,name,status,current_stage,progress,stage_summary,qc_summary,created_at,updated_at,completed_at,result_path,result_size,result_expires_at,result_sha256"
        headers = {"apikey": self.supabase_anon_key, "Authorization": f"Bearer {principal.token}", "Accept": "application/json"}
        query = urlencode({"id": f"eq.{task_id}", "user_id": f"eq.{principal.user_id}", "select": selected})
        verified_admin = False
        try:
            rows = self.fetch_json(f"{self.supabase_url}/rest/v1/shimadzu_jobs?{query}", headers)
            if not rows:
                profile_query = urlencode({"id": f"eq.{principal.user_id}", "select": "id,is_admin"})
                profile = self.fetch_json(f"{self.supabase_url}/rest/v1/profiles?{profile_query}", headers)
                if isinstance(profile, list) and len(profile) == 1 and isinstance(profile[0], dict) and profile[0].get("id") == principal.user_id and profile[0].get("is_admin") is True:
                    verified_admin = True
                    admin_query = urlencode({"id": f"eq.{task_id}", "select": selected})
                    rows = self.fetch_json(f"{self.supabase_url}/rest/v1/shimadzu_jobs?{admin_query}", headers)
        except (HTTPError, URLError, TimeoutError, ValueError) as exc:
            raise ToolError("TASK_STORE_UNAVAILABLE", "Private task store could not be queried") from exc
        if not isinstance(rows, list) or len(rows) != 1 or not isinstance(rows[0], dict):
            raise ToolError("TASK_NOT_FOUND", "Task not found or access denied")
        row = rows[0]
        if row.get("user_id") != principal.user_id and not verified_admin:
            raise ToolError("TASK_NOT_FOUND", "Task not found or access denied")
        if row.get("id") != task_id or not isinstance(row.get("status"), str):
            raise ToolError("TASK_STORE_INVALID", "Task store returned an invalid record")
        return row

    def _derived_result(self, row: dict, principal: Principal) -> dict:
        unavailable = {"status": "unavailable", "reason": "No verified retained result archive is available"}
        result_path = row.get("result_path")
        archive_sha = row.get("result_sha256")
        if not result_path:
            return unavailable
        expected_path = f"{row['user_id']}/{row['id']}/result.zip"
        if result_path != expected_path or not isinstance(archive_sha, str) or not re.fullmatch(r"[0-9a-fA-F]{64}", archive_sha):
            raise ToolError("RESULT_INTEGRITY_FAILED", "Stored result metadata failed integrity checks")
        size = row.get("result_size")
        if not isinstance(size, int) or not 0 < size <= 52_428_800:
            return {"status": "unavailable", "reason": "Retained result exceeds the evidence read limit"}
        expiry = row.get("result_expires_at")
        if expiry:
            try:
                if datetime.fromisoformat(expiry.replace("Z", "+00:00")) <= datetime.now(timezone.utc):
                    return {"status": "unavailable", "reason": "Retained result has expired"}
            except (TypeError, ValueError):
                raise ToolError("RESULT_INTEGRITY_FAILED", "Stored result expiry is invalid")
        url = f"{self.supabase_url}/storage/v1/object/authenticated/shimadzu-results/{quote(result_path, safe='/')}"
        headers = {"apikey": self.supabase_anon_key, "Authorization": f"Bearer {principal.token}"}
        try:
            archive_bytes = self.fetch_bytes(url, headers)
        except (HTTPError, URLError, TimeoutError, OSError) as exc:
            raise ToolError("RESULT_UNAVAILABLE", "Retained result could not be read") from exc
        if not isinstance(archive_bytes, bytes) or len(archive_bytes) != size or hashlib.sha256(archive_bytes).hexdigest().lower() != archive_sha.lower():
            raise ToolError("RESULT_INTEGRITY_FAILED", "Retained result hash or size does not match")
        data_path = "04_跨样品合并与半定量/data.json"
        manifest_path = "04_跨样品合并与半定量/manifest.json"
        try:
            with zipfile.ZipFile(io.BytesIO(archive_bytes)) as archive:
                if len(archive.infolist()) > 2000 or archive.getinfo(data_path).file_size > 4_000_000 or archive.getinfo(manifest_path).file_size > 100_000:
                    return {"status": "unavailable", "reason": "Derived evidence exceeds the projection limit"}
                data_bytes = archive.read(data_path)
                manifest = json.loads(archive.read(manifest_path))
            expected_data_sha = next((item.get("sha256") for item in manifest.get("outputHashes", []) if isinstance(item, dict) and item.get("path") == data_path), None)
            actual_data_sha = hashlib.sha256(data_bytes).hexdigest()
            if expected_data_sha != actual_data_sha:
                raise ToolError("RESULT_INTEGRITY_FAILED", "Derived stage hash does not match")
            data = json.loads(data_bytes)
            table = data.get("table") if isinstance(data, dict) else None
            rows = table.get("rows") if isinstance(table, dict) else None
            concentrations = data.get("concentrationStatus") if isinstance(data, dict) else None
            if not isinstance(rows, list) or not isinstance(concentrations, list):
                raise ToolError("RESULT_INTEGRITY_FAILED", "Derived result has an invalid schema")
        except (zipfile.BadZipFile, zipfile.LargeZipFile, zlib.error, EOFError, OSError, KeyError, ValueError, TypeError, RuntimeError, AttributeError) as exc:
            raise ToolError("RESULT_INTEGRITY_FAILED", "Retained result has invalid derived evidence") from exc
        compounds = {}
        categories = Counter()
        for item in rows[:100_000]:
            if not isinstance(item, dict):
                continue
            cas = str(item.get("CAS #") or "").strip()
            if not CAS_PATTERN.fullmatch(cas) or cas in compounds:
                continue
            category = str(item.get("化合物分类") or "").strip()
            compound = {"cas": cas, "chinese_name": self._safe_text(item.get("中文名"), 80), "english_name": self._safe_text(item.get("常用英文名") or item.get("Name"), 80), "category": self._safe_text(category, 80) if category and category != "NA" else None}
            compounds[cas] = compound
            if compound["category"]:
                categories[compound["category"]] += 1
        measured = []
        measured_total = 0
        for item in concentrations[:100_000]:
            if not isinstance(item, dict) or item.get("status") != "Calculated":
                continue
            cas, value = item.get("cas"), item.get("concentration")
            if not isinstance(cas, str) or not CAS_PATTERN.fullmatch(cas) or isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or value < 0:
                continue
            measured_total += 1
            if len(measured) < 12:
                measured.append({"cas": cas, "sample": self._safe_text(item.get("sampleName"), 80), "value": value, "unit": "μg/mL", "method": "internal-standard semi-quantification"})
        return {
            "status": "integrity_checked_derived_excerpt", "compound_results": {"total": len(compounds), "basis": "Stage 4 screened CAS rows", "items": list(compounds.values())[:12], "truncated": len(compounds) > 12},
            "category_distribution": {"items": [{"category": name, "count": count} for name, count in categories.most_common(12)], "unclassified": len(compounds) - sum(categories.values())},
            "semiquantitative_results": {"total": measured_total, "items": measured, "truncated": measured_total > 12, "unit_note": "μg/mL is the analysis-system concentration; it is not automatically μg/g of a solid sample."},
            "evidence": {"archive_sha256": archive_sha, "stage": data_path, "stage_sha256": actual_data_sha},
        }

    def call(self, name: str, args: dict, principal: Principal) -> dict:
        if name == "search_research_knowledge":
            raise ToolError("KNOWLEDGE_UNAVAILABLE", "Research knowledge search is not connected")
        valid = self._validate_args(name, args)
        if name in {"search_compound", "get_compound_detail"}:
            identifier = valid.get("query") or valid.get("identifier")
            if name == "get_compound_detail" and identifier.startswith("cas:"):
                identifier = identifier[4:]
            return self._compound(identifier, 8, valid.get("medium")) if name == "search_compound" else self._compound_detail(identifier)
        row = self._task(valid["task_id"], principal)
        source = {"type": "private_task_record", "dataset": "Authorized shimadzu_jobs summary", "url": ""}
        qc = row.get("qc_summary") or {}
        qc_summary = {key: self._safe_text(value, 100) if isinstance(value, str) else value for key, value in qc.items() if key in {"status", "blocked", "warnings", "failed_count", "warning_count", "passed_count"} and (isinstance(value, (bool, int, float)) and (not isinstance(value, float) or math.isfinite(value)) or isinstance(value, str) and len(value) <= 100)} if isinstance(qc, dict) else {}
        if name == "get_analysis_task":
            return {"task_id": row["id"], "name": self._safe_text(row.get("name")), "status": row["status"], "current_stage": row.get("current_stage"), "progress": row.get("progress"), "qc_summary": qc_summary, "updated_at": row.get("updated_at"), "source": source}
        if row["status"] != "complete":
            raise ToolError("TASK_INCOMPLETE", "A completed task is required for an analysis summary")
        stages = row.get("stage_summary") or []
        if not isinstance(stages, list):
            raise ToolError("TASK_STORE_INVALID", "Task summary has an unexpected shape")
        derived = self._derived_result(row, principal)
        return {"task_id": row["id"], "name": self._safe_text(row.get("name")), "status": row["status"], "stage_counts": [{"stage": item.get("index", item.get("stage")), "status": item.get("status"), "counts": {key: value for key, value in list((item.get("counts") or {}).items())[:32] if isinstance(key, str) and len(key) <= 50 and isinstance(value, (bool, int, float)) and (not isinstance(value, float) or math.isfinite(value))} if isinstance(item.get("counts"), dict) else {}} for item in stages[:7] if isinstance(item, dict)], "qc_summary": qc_summary, "result_sha256": row.get("result_sha256"), "compound_results": derived.get("compound_results", {"status": "unavailable"}), "category_distribution": derived.get("category_distribution", {"status": "unavailable"}), "semiquantitative_results": derived.get("semiquantitative_results", {"status": "unavailable"}), "derived_evidence": derived.get("evidence"), "derived_status": derived["status"], "derived_unavailable_reason": derived.get("reason"), "source": source, "note": "Only bounded derived results were read. Internal-standard estimates are semi-quantitative; no raw workbook or complete log was sent to the model."}
