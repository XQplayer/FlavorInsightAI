"""Read-only, bounded projections of existing FlavorInsight AI evidence."""

from __future__ import annotations

import json
import math
import re
from dataclasses import dataclass
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
    {"type": "function", "name": "get_compound_detail", "description": "Read source-attributed public compound details by CAS or name.", "parameters": {"type": "object", "properties": {"identifier": {"type": "string"}}, "required": ["identifier"], "additionalProperties": False}, "strict": True},
    {"type": "function", "name": "get_analysis_task", "description": "Read the authenticated user's GC-MS task metadata, stage progress and QC state only.", "parameters": {"type": "object", "properties": {"task_id": {"type": "string"}}, "required": ["task_id"], "additionalProperties": False}, "strict": True},
    {"type": "function", "name": "get_analysis_summary", "description": "Read an authenticated user's completed task's bounded result and QC summary without raw Excel or complete logs.", "parameters": {"type": "object", "properties": {"task_id": {"type": "string"}}, "required": ["task_id"], "additionalProperties": False}, "strict": True},
]


class ResearchTools:
    def __init__(self, data_path: Path = PUBLIC_DATA, supabase_url: str = "", supabase_anon_key: str = "", fetch_json=None):
        self.data_path = Path(data_path)
        self.supabase_url = supabase_url.rstrip("/")
        self.supabase_anon_key = supabase_anon_key
        self.fetch_json = fetch_json or self._fetch_json
        self._records = None

    @staticmethod
    def _fetch_json(url: str, headers: dict) -> object:
        request = Request(url, headers=headers)
        with urlopen(request, timeout=8) as response:
            return json.load(response)

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

    def _task(self, task_id: str, principal: Principal) -> dict:
        if principal.guest or not principal.token or not UUID_PATTERN.fullmatch(principal.user_id):
            raise ToolError("AUTH_REQUIRED", "A verified account is required for private task data")
        if not self.supabase_url or not self.supabase_anon_key:
            raise ToolError("TASK_STORE_UNAVAILABLE", "Private task store is not configured")
        query = urlencode({"id": f"eq.{task_id}", "user_id": f"eq.{principal.user_id}", "select": "id,user_id,name,status,current_stage,progress,stage_summary,qc_summary,created_at,updated_at,completed_at,result_sha256"})
        url = f"{self.supabase_url}/rest/v1/shimadzu_jobs?{query}"
        try:
            rows = self.fetch_json(url, {"apikey": self.supabase_anon_key, "Authorization": f"Bearer {principal.token}", "Accept": "application/json"})
        except (HTTPError, URLError, TimeoutError, ValueError) as exc:
            raise ToolError("TASK_STORE_UNAVAILABLE", "Private task store could not be queried") from exc
        if not isinstance(rows, list) or not rows or not isinstance(rows[0], dict) or rows[0].get("user_id") != principal.user_id:
            raise ToolError("TASK_NOT_FOUND", "Task not found or access denied")
        row = rows[0]
        if row.get("id") != task_id or not isinstance(row.get("status"), str):
            raise ToolError("TASK_STORE_INVALID", "Task store returned an invalid record")
        return row

    def call(self, name: str, args: dict, principal: Principal) -> dict:
        if name == "search_research_knowledge":
            raise ToolError("KNOWLEDGE_UNAVAILABLE", "Research knowledge search is not connected")
        valid = self._validate_args(name, args)
        if name in {"search_compound", "get_compound_detail"}:
            identifier = valid.get("query") or valid.get("identifier")
            if name == "get_compound_detail" and identifier.startswith("cas:"):
                identifier = identifier[4:]
            result = self._compound(identifier, 8 if name == "search_compound" else 1, valid.get("medium"))
            return result if name == "search_compound" else {"found": bool(result["results"]), "compound": result["results"][0] if result["results"] else None, "molecular_properties": None, "source": result["results"][0]["source"] if result["results"] else None, "note": "No molecular property is supplied by this public table; do not infer one."}
        row = self._task(valid["task_id"], principal)
        source = {"type": "private_task_record", "dataset": "Owner-scoped shimadzu_jobs summary", "url": ""}
        qc = row.get("qc_summary") or {}
        qc_summary = {key: value for key, value in qc.items() if key in {"status", "blocked", "warnings", "failed_count", "warning_count", "passed_count"} and (isinstance(value, (bool, int, float)) and (not isinstance(value, float) or math.isfinite(value)) or isinstance(value, str) and len(value) <= 100)} if isinstance(qc, dict) else {}
        if name == "get_analysis_task":
            return {"task_id": row["id"], "name": str(row.get("name") or "")[:120], "status": row["status"], "current_stage": row.get("current_stage"), "progress": row.get("progress"), "qc_summary": qc_summary, "updated_at": row.get("updated_at"), "source": source}
        if row["status"] != "complete":
            raise ToolError("TASK_INCOMPLETE", "A completed task is required for an analysis summary")
        stages = row.get("stage_summary") or []
        if not isinstance(stages, list):
            raise ToolError("TASK_STORE_INVALID", "Task summary has an unexpected shape")
        return {"task_id": row["id"], "status": row["status"], "stage_counts": [{"stage": item.get("index", item.get("stage")), "status": item.get("status"), "counts": {key: value for key, value in list((item.get("counts") or {}).items())[:32] if isinstance(key, str) and len(key) <= 50 and isinstance(value, (bool, int, float)) and (not isinstance(value, float) or math.isfinite(value))} if isinstance(item.get("counts"), dict) else {}} for item in stages[:7] if isinstance(item, dict)], "qc_summary": qc_summary, "result_sha256": row.get("result_sha256"), "source": source, "note": "Semi-quantitative results are not absolute concentrations; no raw workbook or complete log is included."}
