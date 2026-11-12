"""Durable, server-owned chat records. Every service-role request is owner-scoped."""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen


class ConversationStoreError(Exception):
    def __init__(self, code: str, status: int = 503):
        super().__init__(code)
        self.code = code
        self.status = status


class SupabaseConversationStore:
    def __init__(self, url: str, service_key: str, *, open_url=urlopen):
        if not url.startswith("https://") or not service_key:
            raise ValueError("A private Supabase URL and service key are required")
        self.url = url.rstrip("/") + "/rest/v1/"
        self.service_key = service_key
        self.open_url = open_url

    def _request(self, table: str, *, method="GET", query=None, body=None):
        path = table + ("?" + urlencode(query) if query else "")
        headers = {
            "apikey": self.service_key,
            "Accept": "application/json",
            "Prefer": "return=representation",
        }
        # New sb_secret_* keys are API keys, not JWTs. Legacy service_role
        # keys still need the Bearer header until they are rotated out.
        if not self.service_key.startswith("sb_secret_"):
            headers["Authorization"] = "Bearer " + self.service_key
        if body is not None:
            headers["Content-Type"] = "application/json"
        request = Request(self.url + path, data=json.dumps(body).encode() if body is not None else None,
                          headers=headers, method=method)
        try:
            with self.open_url(request, timeout=10) as response:
                return json.load(response)
        except HTTPError as exc:
            if exc.code == 409:
                raise ConversationStoreError("ANALYSIS_ALREADY_LINKED", 409) from exc
            if exc.code in (400, 401, 403, 404):
                raise ConversationStoreError("CONVERSATION_STORE_REJECTED", 503) from exc
            raise ConversationStoreError("CONVERSATION_STORE_UNAVAILABLE") from exc
        except (URLError, TimeoutError, ValueError) as exc:
            raise ConversationStoreError("CONVERSATION_STORE_UNAVAILABLE") from exc

    @staticmethod
    def _uuid(value: str) -> str:
        try:
            parsed = uuid.UUID(value)
        except (ValueError, TypeError, AttributeError) as exc:
            raise ConversationStoreError("NOT_FOUND", 404) from exc
        return str(parsed)

    @staticmethod
    def _owner(value: str) -> str:
        return SupabaseConversationStore._uuid(value)

    def list(self, owner: str):
        owner = self._owner(owner)
        rows = []
        while True:
            batch = self._request("ai_conversations", query={"user_id": "eq." + owner,
                                  "select": "id,title,created_at,last_activity_at,title_source",
                                  "order": "last_activity_at.desc,id.desc", "limit": "500",
                                  "offset": str(len(rows))})
            rows.extend(batch)
            if len(batch) < 500:
                break
        return rows

    def get(self, owner: str, conversation_id: str):
        owner, conversation_id = self._owner(owner), self._uuid(conversation_id)
        rows = self._request("ai_conversations", query={"id": "eq." + conversation_id,
                             "user_id": "eq." + owner,
                             "select": "id,title,created_at,last_activity_at,title_source,context_summary"})
        if not rows:
            raise ConversationStoreError("NOT_FOUND", 404)
        messages = []
        while True:
            batch = self._request("ai_messages", query={"session_id": "eq." + conversation_id,
                                  "user_id": "eq." + owner,
                                  "select": "message_id,session_id,user_id,role,content,message_type,created_at,status,model,token_usage,sources,tool_events",
                                  "order": "position.asc", "limit": "500", "offset": str(len(messages))})
            messages.extend(batch)
            if len(batch) < 500:
                break
        links = self._request("ai_analysis_links", query={"session_id": "eq." + conversation_id,
                              "user_id": "eq." + owner,
                              "select": "analysis_id,result_id,result_schema,summary,provenance,created_at",
                              "order": "created_at.desc", "limit": "10"})
        return {**rows[0], "messages": messages, "analysis_links": links}

    def create(self, owner: str):
        owner = self._owner(owner)
        conversation_id = str(uuid.uuid4())
        rows = self._request("ai_conversations", method="POST", body={"id": conversation_id, "user_id": owner})
        return {**rows[0], "messages": []}

    def rename(self, owner: str, conversation_id: str, title: str):
        rows = self._request("ai_conversations", method="PATCH",
                             query={"id": "eq." + self._uuid(conversation_id), "user_id": "eq." + self._owner(owner)},
                             body={"title": title, "title_source": "manual"})
        if not rows:
            raise ConversationStoreError("NOT_FOUND", 404)
        return rows[0]

    def delete(self, owner: str, conversation_id: str):
        rows = self._request("ai_conversations", method="DELETE",
                             query={"id": "eq." + self._uuid(conversation_id), "user_id": "eq." + self._owner(owner)})
        if not rows:
            raise ConversationStoreError("NOT_FOUND", 404)

    def begin_turn(self, owner: str, conversation_id: str, message: str):
        owner, conversation_id = self._owner(owner), self._uuid(conversation_id)
        self.get(owner, conversation_id)
        user_message_id, assistant_message_id = str(uuid.uuid4()), str(uuid.uuid4())
        self._request("ai_messages", method="POST", body=[
            {"message_id": user_message_id, "session_id": conversation_id, "user_id": owner,
             "role": "user", "content": message, "message_type": "text", "status": "completed"},
            {"message_id": assistant_message_id, "session_id": conversation_id, "user_id": owner,
             "role": "assistant", "content": "", "message_type": "text", "status": "streaming"},
        ])
        return assistant_message_id

    def finish_turn(self, owner: str, conversation_id: str, assistant_message_id: str, *, answer: str,
                    sources: list, tool_events: list, usage: dict, model: str):
        owner, conversation_id = self._owner(owner), self._uuid(conversation_id)
        rows = self._request("ai_messages", method="PATCH",
                             query={"message_id": "eq." + self._uuid(assistant_message_id),
                                    "session_id": "eq." + conversation_id, "user_id": "eq." + owner,
                                    "role": "eq.assistant", "status": "eq.streaming"},
                             body={"content": answer, "status": "completed", "sources": sources[:5],
                                   "tool_events": tool_events[:12],
                                   "token_usage": usage, "model": model or None})
        if not rows:
            raise ConversationStoreError("CONVERSATION_STORE_REJECTED")
        current = self.get(owner, conversation_id)
        title_update = {"last_activity_at": datetime.now(timezone.utc).isoformat()}
        if current["title_source"] == "auto" and current["title"] == "New conversation":
            first_user = next((item["content"] for item in current["messages"] if item["role"] == "user"), "")
            title_update["title"] = first_user.strip()[:60] or "New conversation"
        completed = [item for item in current["messages"] if item["role"] in ("user", "assistant") and item["status"] == "completed"]
        if len(completed) > 16:
            earlier = completed[:-16]
            title_update["context_summary"] = "\n".join(
                f"{item['role']}: {item['content'][:180]}" for item in earlier[-20:]
            )[-4000:]
        self._request("ai_conversations", method="PATCH",
                      query={"id": "eq." + conversation_id, "user_id": "eq." + owner}, body=title_update)

    def interrupt_turn(self, owner: str, conversation_id: str, assistant_message_id: str):
        self._request("ai_messages", method="PATCH",
                      query={"message_id": "eq." + self._uuid(assistant_message_id),
                             "session_id": "eq." + self._uuid(conversation_id), "user_id": "eq." + self._owner(owner),
                             "status": "eq.streaming"},
                      body={"status": "interrupted"})

    def link_analysis(self, owner: str, conversation_id: str, facts: dict):
        owner, conversation_id = self._owner(owner), self._uuid(conversation_id)
        current = self.get(owner, conversation_id)
        existing = next((item for item in current["analysis_links"] if item["result_id"] == facts["run_id"]), None)
        if existing:
            return {"analysis_id": existing["analysis_id"], "result_id": existing["result_id"],
                    "provenance": existing["provenance"]}
        body = {"session_id": conversation_id, "user_id": owner,
                "analysis_id": facts["dataset_id"], "result_id": facts["run_id"],
                "result_schema": facts["schema_version"], "summary": facts,
                "provenance": "client-validated-browser-pca-summary"}
        rows = self._request("ai_analysis_links", method="POST", body=body)
        return {"analysis_id": rows[0]["analysis_id"], "result_id": rows[0]["result_id"],
                "provenance": rows[0]["provenance"]}
