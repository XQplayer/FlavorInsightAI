"""Exercise the local live gateway with public/synthetic prompts only.

Never reads, prints, or stores OPENAI_API_KEY. Requires an already running
local Live gateway. Evidence JSON is written under ignored _local/.
"""

import json
import os
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import HTTPCookieProcessor, Request, build_opener
from http.cookiejar import CookieJar


BASE = os.environ.get("AI_LIVE_BASE_URL", "http://127.0.0.1:18887").rstrip("/")
ORIGIN = os.environ.get("AI_LIVE_ORIGIN", "http://127.0.0.1:5195")
OUTPUT = Path(__file__).resolve().parents[2] / "_local" / "verification" / "ai-live-result.json"


class BrowserSession:
    def __init__(self):
        self.opener = build_opener(HTTPCookieProcessor(CookieJar()))

    def request(self, path, method="GET", body=None):
        data = json.dumps(body).encode() if body is not None else None
        request = Request(BASE + path, data=data, method=method, headers={"Origin": ORIGIN, **({"Content-Type": "application/json"} if data else {})})
        return self.opener.open(request, timeout=120)

    def json(self, path, method="GET", body=None):
        with self.request(path, method, body) as response:
            return json.load(response)

    def chat(self, conversation_id, prompt):
        events = []
        with self.request("/ai/chat", "POST", {"conversation_id": conversation_id, "message": prompt}) as response:
            for line in response:
                if line.startswith(b"data: "):
                    events.append(json.loads(line[6:]))
        answer = "".join(item.get("text", "") for item in events if item.get("type") == "delta")
        errors = [item for item in events if item.get("type") == "error"]
        if errors:
            raise AssertionError(f"Live chat error: {errors[-1].get('code')} {errors[-1].get('message')}")
        assert events and events[-1].get("type") == "done", "Live stream ended without done"
        return {"answer": answer, "events": events, "tools": [item.get("name") for item in events if item.get("type") == "tool"], "sources": events[-1].get("sources") or [], "usage": next((item for item in events if item.get("type") == "usage"), {})}


def main():
    first = BrowserSession()
    config = first.json("/ai/session")
    assert config.get("mode") == "openai" and config.get("key_configured") and config.get("model_configured")
    assert "api_key" not in config
    conversation = first.json("/ai/conversations", "POST")["id"]
    basic = first.chat(conversation, "请用一句中文说明 GC-MS 内标半定量与绝对定量的区别，不给出虚构数值。")
    assert "半定量" in basic["answer"] and "绝对定量" in basic["answer"]
    assert len([event for event in basic["events"] if event.get("type") == "delta"]) > 1
    assert basic["usage"].get("input_tokens", 0) > 0
    print(f"PASS basic Chinese streaming: deltas={len([event for event in basic['events'] if event.get('type') == 'delta'])} input_tokens={basic['usage']['input_tokens']} output_tokens={basic['usage'].get('output_tokens')}")

    followup = first.chat(conversation, "上一问讨论的两种定量方式是什么？只列名称。")
    assert "半定量" in followup["answer"] and "绝对定量" in followup["answer"]
    print("PASS multi-turn context")

    compound = first.chat(conversation, "请调用平台工具查询 CAS 141-78-6，并说明已有数据库记录的风味描述与来源；没有的分子属性不要推断。")
    assert "search_compound" in compound["tools"] or "get_compound_detail" in compound["tools"]
    assert "141-78-6" in compound["answer"]
    assert any(isinstance(source, dict) and source.get("type") == "database_record" for source in compound["sources"])
    print(f"PASS live compound tool: tools={compound['tools']} sources={len(compound['sources'])} input_tokens={compound['usage'].get('input_tokens')} output_tokens={compound['usage'].get('output_tokens')}")

    absent = first.chat(conversation, "请调用平台检索工具查询 CAS 9999999-99-9。若无记录，只说没有平台证据，不要编造性质、阈值或 DOI。")
    assert "search_compound" in absent["tools"] or "get_compound_detail" in absent["tools"]
    assert not absent["sources"]
    print(f"PASS absent CAS: tools={absent['tools']} sources=0")

    second = BrowserSession()
    second.json("/ai/session")
    try:
        second.json(f"/ai/conversations/{conversation}")
    except HTTPError as exc:
        assert exc.code == 404
        print("PASS session isolation: second local identity received 404")
    else:
        raise AssertionError("Second identity could read the first conversation")

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    evidence = {
        "mode": config["mode"],
        "basic": {"deltas": len([event for event in basic["events"] if event.get("type") == "delta"]), "usage": basic["usage"]},
        "followup": {"usage": followup["usage"]},
        "compound": {"answer": compound["answer"], "tools": compound["tools"], "sources": compound["sources"], "usage": compound["usage"]},
        "absent": {"answer": absent["answer"], "tools": absent["tools"], "sources": absent["sources"], "usage": absent["usage"]},
        "isolation": "404",
    }
    OUTPUT.write_text(json.dumps(evidence, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Evidence saved to ignored local file: {OUTPUT.name}")


if __name__ == "__main__":
    main()
