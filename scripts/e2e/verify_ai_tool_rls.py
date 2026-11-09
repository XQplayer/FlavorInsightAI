"""Private staging probe invoked over stdin; never print JWTs or API keys."""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from services.ai_tools import Principal, ResearchTools, ToolError  # noqa: E402


def main() -> None:
    data = json.load(sys.stdin)
    tools = ResearchTools(supabase_url=data["url"], supabase_anon_key=data["anon_key"])
    alice = Principal(data["alice_id"], token=data["alice_token"])
    bob = Principal(data["bob_id"], token=data["bob_token"])
    administrator = Principal(data["admin_id"], token=data["admin_token"])

    def denied(name, args, principal, expected):
        try:
            tools.call(name, args, principal)
        except ToolError as exc:
            if exc.code == expected:
                return
            raise AssertionError(f"unexpected tool denial: {exc.code}") from None
        raise AssertionError("unauthorized tool call unexpectedly succeeded")

    own = tools.call("get_analysis_task", {"task_id": data["alice_task_id"]}, alice)
    assert own["task_id"] == data["alice_task_id"]
    denied("get_analysis_task", {"task_id": data["bob_task_id"]}, alice, "TASK_NOT_FOUND")
    denied("get_analysis_task", {"task_id": data["alice_task_id"]}, bob, "TASK_NOT_FOUND")
    denied("get_analysis_task", {"task_id": data["absent_task_id"]}, alice, "TASK_NOT_FOUND")
    denied("get_analysis_task", {"task_id": data["bob_task_id"], "user_id": data["bob_id"]}, alice, "INVALID_ARGUMENT")
    denied("get_analysis_task", {"task_id": data["bob_task_id"]}, Principal(data["alice_id"], token=data["alice_token"], admin=True), "TASK_NOT_FOUND")
    denied("get_analysis_task", {"task_id": data["alice_task_id"]}, Principal(data["alice_id"], token=data["bob_token"]), "TASK_NOT_FOUND")
    summary = tools.call("get_analysis_summary", {"task_id": data["alice_task_id"]}, alice)
    assert summary["task_id"] == data["alice_task_id"]
    denied("get_analysis_summary", {"task_id": data["bob_task_id"]}, alice, "TASK_NOT_FOUND")
    admin_view = tools.call("get_analysis_task", {"task_id": data["bob_task_id"]}, administrator)
    assert admin_view["task_id"] == data["bob_task_id"]
    print(json.dumps({"status": "PASS", "checks": 10}))


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(json.dumps({"status": "FAIL", "reason": type(exc).__name__}))
        sys.exit(1)
