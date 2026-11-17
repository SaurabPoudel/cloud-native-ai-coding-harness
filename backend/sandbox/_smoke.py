# backend/sandbox/_smoke.py
from pathlib import Path
from backend.sandbox import run_in_sandbox

if __name__ == "__main__":
    ws = Path("/tmp/agent-smoke")
    ws.mkdir(exist_ok=True)
    (ws / "hello.py").write_text("print('hello from sandbox')\n")

    r1 = run_in_sandbox(1, "python hello.py", ws)
    print("── RUN 1 (ok) ──")
    print(r1)

    r2 = run_in_sandbox(1, "sleep 120", ws)   # will time out at 60s? no — 60 is default; use short test
    print("── RUN 2 (timeout test) ──")
    print(r2)