from pathlib import Path
import tempfile, json
from backend.harness._execute_tools import execute_tool

if __name__ == "__main__":
    ws = Path(tempfile.mkdtemp(prefix="ws-"))
    print("workspace:", ws)

    # 1. write_file happy path
    r = execute_tool("write_file", {"path": "a.txt", "content": "hello\n"}, ws, 1)
    print("1 write_file      →", r.ok, "|", r.content)

    # 2. read_file happy path — should be line-numbered
    r = execute_tool("read_file", {"path": "a.txt"}, ws, 1)
    print("2 read_file       →", r.ok, "|", r.content)

    # 3. path traversal — MUST fail
    r = execute_tool("read_file", {"path": "../../etc/passwd"}, ws, 1)
    print("3 path traversal  →", r.ok, "|", r.content)
    assert not r.ok, "SECURITY BUG: traversal escaped!"

    # 4. bad args — MUST fail gracefully, not raise
    r = execute_tool("write_file", {"path": 123, "content": None}, ws, 1)
    print("4 bad args        →", r.ok, "|", r.content)

    # 5. finish sets finished flag
    r = execute_tool("finish", {"summary": "did it", "success": True}, ws, 1)
    print("5 finish          →", r.ok, "| finished =", r.finished, "|", r.content)
    assert r.finished and r.finish_payload == {"summary": "did it", "success": True}

    # 6. bash happy path — needs docker running
    r = execute_tool("bash", {"command": "echo $((40+2))"}, ws, 1)
    print("6 bash            →", r.ok, "|", r.content.strip())

    # 7. bash failure — stderr visible, ok=False, agent can self-correct
    r = execute_tool("bash", {"command": "python -c 'import doesnotexist'"}, ws, 1)
    print("7 bash error      →", r.ok, "|", "ModuleNotFoundError" in r.content)

    print("\n✅ all execute_tool smoke checks passed")