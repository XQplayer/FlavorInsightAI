"""One real-model call with a synthetic, in-memory task store and derived ZIP.

This is not a real Supabase user/RLS test. No secret or private research data is
printed, persisted in this script, or sent to the model.
"""

import hashlib
import io
import json
import sys
from pathlib import Path
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from services.ai_gateway import AIGateway
from services.ai_tools import Principal, ResearchTools


OWNER = "11111111-1111-4111-8111-111111111111"
TASK = "22222222-2222-4222-8222-222222222222"


def local_settings():
    private = ROOT / ".env.local"
    values = {}
    for line in private.read_text(encoding="utf-8-sig").splitlines():
        if "=" in line:
            name, value = line.split("=", 1)
            if name in {"OPENAI_API_KEY", "OPENAI_MODEL"}:
                values[name] = value.strip().strip('"')
    if not values.get("OPENAI_API_KEY") or not values.get("OPENAI_MODEL"):
        raise RuntimeError("Configure the private local OpenAI key and model before this test")
    return values


def synthetic_archive():
    path = "04_跨样品合并与半定量/data.json"
    data = {"table": {"rows": [{"CAS #": "141-78-6", "中文名": "乙酸乙酯", "化合物分类": "酯类"}]}, "concentrationStatus": [{"cas": "141-78-6", "sampleName": "SYNTHETIC_SAMPLE_A", "concentration": 2.5, "status": "Calculated"}]}
    content = json.dumps(data, ensure_ascii=False).encode()
    manifest = {"outputHashes": [{"path": path, "sha256": hashlib.sha256(content).hexdigest()}]}
    buffer = io.BytesIO()
    with ZipFile(buffer, "w") as archive:
        archive.writestr(path, content)
        archive.writestr("04_跨样品合并与半定量/manifest.json", json.dumps(manifest))
    return buffer.getvalue()


def main():
    settings = local_settings()
    archive = synthetic_archive()
    row = {"id": TASK, "user_id": OWNER, "name": "SYNTHETIC_DEMO_ONLY", "status": "complete", "current_stage": 7, "progress": 100, "stage_summary": [{"stage": 4, "status": "PASS", "counts": {"casRows": 1}}], "qc_summary": {"status": "PASS"}, "result_path": f"{OWNER}/{TASK}/result.zip", "result_size": len(archive), "result_sha256": hashlib.sha256(archive).hexdigest()}
    tools = ResearchTools(supabase_url="https://synthetic.invalid", supabase_anon_key="synthetic", fetch_json=lambda *_: [row], fetch_bytes=lambda *_: archive)
    gateway = AIGateway(mode="openai", model=settings["OPENAI_MODEL"], api_key=settings["OPENAI_API_KEY"], tools=tools)
    principal = Principal(OWNER, token="synthetic-token")
    conversation = gateway.new_conversation(principal)
    events = list(gateway.chat(principal, conversation["id"], f"请解释合成测试任务 {TASK} 的结果摘要、半定量单位和 QC；说明这些是合成演示数据，不要计算 OAV 或声称是实际科研结果。"))
    answer = "".join(event.get("text", "") for event in events if event.get("type") == "delta")
    assert any(event.get("type") == "tool" and event.get("name") == "get_analysis_summary" for event in events)
    assert "2.5" in answer and "μg/mL" in answer and "合成" in answer
    assert events[-1]["type"] == "done"
    usage = next(event for event in events if event.get("type") == "usage")
    output = ROOT / "_local" / "verification" / "ai-synthetic-summary-live-result.json"
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps({"synthetic": True, "answer": answer, "usage": usage, "tool": "get_analysis_summary"}, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"PASS real model on synthetic task: input_tokens={usage['input_tokens']} output_tokens={usage['output_tokens']}")


if __name__ == "__main__":
    main()
