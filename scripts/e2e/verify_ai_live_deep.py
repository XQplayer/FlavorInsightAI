"""One paid public CAS prompt; no private task or API credential is printed."""

import json
from pathlib import Path

from verify_ai_live import BrowserSession


def main():
    browser = BrowserSession()
    configuration = browser.json("/ai/session")
    assert configuration.get("mode") == "openai" and configuration.get("key_configured")
    conversation = browser.json("/ai/conversations", "POST")["id"]
    result = browser.chat(conversation, "请查询 CAS 141-78-6 的分子式、挥发性质与风味描述。只依据 get_compound_detail 的已核验数据库字段回答，并分别说明来源、阈值原文的局限；不要计算 OAV。")
    assert "get_compound_detail" in result["tools"]
    assert any(source.get("dataset") == "PubChem" for source in result["sources"])
    assert "141-78-6" in result["answer"]
    output = Path(__file__).resolve().parents[2] / "_local" / "verification" / "ai-deep-live-result.json"
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps({"answer": result["answer"], "tools": result["tools"], "sources": result["sources"], "usage": result["usage"]}, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"PASS live deep CAS: tools={result['tools']} sources={[source.get('dataset') for source in result['sources']]} input_tokens={result['usage'].get('input_tokens')} output_tokens={result['usage'].get('output_tokens')}")


if __name__ == "__main__":
    main()
