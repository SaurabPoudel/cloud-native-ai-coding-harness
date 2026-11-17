from pathlib import Path
import tempfile
from backend.harness._agent_loop import run_agent

if __name__ == "__main__":
    ws = Path(tempfile.mkdtemp(prefix="agent-"))
    print("workspace:", ws)

    prompt = (
        "Create a file `greet.py` that prints 'hello from agent'. "
        "Then run it with python and confirm the output is exactly "
        "'hello from agent'. "
        "Then call finish with success=true and a one-line summary."
    )

    result = run_agent(prompt=prompt, workspace=ws, project_id=1)

    print("\n── RESULT ──")
    print("success     :", result.success)
    print("summary     :", result.summary)
    print("turns       :", result.turns)
    print("tool_calls  :", result.tool_calls)
    print("tokens_used :", result.tokens_used)
    print("transcript  :", len(result.transcript), "messages")

    print("\n── files in workspace ──")
    for p in sorted(ws.rglob("*")):
        if p.is_file():
            print(" ", p.relative_to(ws))