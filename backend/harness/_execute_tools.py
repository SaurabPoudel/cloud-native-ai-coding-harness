"""
Turn one LLM tool_call into a ToolResult.

Design rules:
1. Never raise for user-facing errors. Return a ToolResult with ok=False.
2. Path traversal is rejected at the boundary.
3. bash goes through the sandbox executor (isolated).
4. read_file / write_file operate on the host workspace — path-validated,
   same directory that gets uploaded to the sandbox.
5. All output is size-capped so one tool call cannot blow the context.
"""

from __future__ import annotations
import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from backend.sandbox import run_in_sandbox
from ._tools import TOOLS


# Hard ceilings — an agent's runaway `cat huge.log` must not OOM the harness
MAX_TOOL_OUTPUT_CHARS = 20_000
READ_MAX_LINES_DEFAULT = 500


@dataclass
class ToolResult:
    ok: bool
    content: str                      # what goes back to the LLM
    finished: bool = False            # True only for `finish`
    finish_payload: dict | None = None


# ─────────────────────────────────────────────────────────────
# Path safety — the #1 sandbox escape vector
# ─────────────────────────────────────────────────────────────
def _safe_path(workspace: Path, rel: str) -> Path | None:
    if not isinstance(rel, str) or not rel:
        return None
    """
    Resolve `rel` relative to workspace and return the real path.
    Returns None if the path escapes workspace (e.g. ../, absolute, symlink out).
    """
    try:
        # Absolute path → reject outright (agent should use relative under workspace)
        if Path(rel).is_absolute():
            return None
        candidate = (workspace / rel).resolve()
        # resolve() follows symlinks — this catches symlink-escape too
        if not candidate.is_relative_to(workspace.resolve()):
            return None
        return candidate
    except Exception:
        return None


def _cap(text: str) -> str:
    if len(text) <= MAX_TOOL_OUTPUT_CHARS:
        return text
    return text[:MAX_TOOL_OUTPUT_CHARS] + f"\n... [truncated {len(text) - MAX_TOOL_OUTPUT_CHARS} chars]"


# ─────────────────────────────────────────────────────────────
# Individual tool handlers
# ─────────────────────────────────────────────────────────────
def _tool_bash(workspace: Path, project_id: int, args: dict) -> ToolResult:
    cmd = args.get("command")
    if not isinstance(cmd, str) or not cmd.strip():
        return ToolResult(False, "error: `command` must be a non-empty string")

    r = run_in_sandbox(project_id=project_id, command=cmd, workspace=workspace)

    header = f"exit_code={r['exit_code']}"
    if r["timed_out"]:
        header += " (timed out)"
    body = ""
    if r["stdout"]:
        body += f"--- stdout ---\n{r['stdout']}"
    if r["stderr"]:
        body += f"\n--- stderr ---\n{r['stderr']}"
    if not body:
        body = "(no output)"

    return ToolResult(ok=(r["exit_code"] == 0), content=_cap(f"{header}\n{body}"))


def _tool_read_file(workspace: Path, args: dict) -> ToolResult:
    p = _safe_path(workspace, args.get("path", ""))
    if p is None:
        return ToolResult(False, "error: path must be relative and inside workspace")
    if not p.is_file():
        return ToolResult(False, f"error: not a file: {args.get('path')}")

    max_lines = args.get("max_lines") or READ_MAX_LINES_DEFAULT
    try:
        lines = p.read_text(errors="replace").splitlines()
    except Exception as e:
        return ToolResult(False, f"error: read failed: {e}")

    shown = lines[:max_lines]
    out = "\n".join(f"{i + 1:>4}| {ln}" for i, ln in enumerate(shown))
    if len(lines) > max_lines:
        out += f"\n... [truncated {len(lines) - max_lines} lines]"
    return ToolResult(True, _cap(out) if out else "(empty file)")


def _tool_write_file(workspace: Path, args: dict) -> ToolResult:
    rel = args.get("path")
    if not isinstance(rel, str) or not rel:
        return ToolResult(False, "error: `path` must be a non-empty string")
    p = _safe_path(workspace, rel)
    if p is None:
        return ToolResult(False, "error: path must be relative and inside workspace")
    p = _safe_path(workspace, args.get("path", ""))
    if p is None:
        return ToolResult(False, "error: path must be relative and inside workspace")
    content = args.get("content")
    if not isinstance(content, str):
        return ToolResult(False, "error: `content` must be a string")

    try:
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(content)
    except Exception as e:
        return ToolResult(False, f"error: write failed: {e}")
    return ToolResult(True, f"wrote {len(content)} bytes to {args.get('path')}")


def _tool_finish(args: dict) -> ToolResult:
    summary = args.get("summary", "")
    success = bool(args.get("success", False))
    return ToolResult(
        ok=True,
        content=f"finished (success={success}): {summary}",
        finished=True,
        finish_payload={"summary": summary, "success": success},
    )


# ─────────────────────────────────────────────────────────────
# Public dispatcher — this is what the agent loop calls
# ─────────────────────────────────────────────────────────────
_VALID_TOOL_NAMES = {t["function"]["name"] for t in TOOLS}


def execute_tool(
    tool_name: str,
    raw_arguments: str | dict,
    workspace: Path,
    project_id: int,
) -> ToolResult:
    """
    Execute one tool call. Never raises for user-facing errors — returns ToolResult(ok=False).
    """
    # 1. Validate tool name — LLMs hallucinate names
    if tool_name not in _VALID_TOOL_NAMES:
        return ToolResult(False, f"error: unknown tool '{tool_name}'. Valid: {sorted(_VALID_TOOL_NAMES)}")

    # 2. Parse arguments — Groq/OpenAI return JSON-as-string
    if isinstance(raw_arguments, str):
        try:
            args = json.loads(raw_arguments) if raw_arguments else {}
        except json.JSONDecodeError as e:
            return ToolResult(False, f"error: tool arguments are not valid JSON: {e}")
    elif isinstance(raw_arguments, dict):
        args = raw_arguments
    else:
        return ToolResult(False, f"error: arguments must be JSON string or dict, got {type(raw_arguments).__name__}")

    # 3. Route
    try:
        if tool_name == "bash":
            return _tool_bash(workspace, project_id, args)
        if tool_name == "read_file":
            return _tool_read_file(workspace, args)
        if tool_name == "write_file":
            return _tool_write_file(workspace, args)
        if tool_name == "finish":
            return _tool_finish(args)
    except Exception as e:
        # Belt-and-suspenders: a handler bug must not crash the agent loop
        return ToolResult(False, f"error: tool '{tool_name}' crashed: {type(e).__name__}: {e}")

    return ToolResult(False, f"error: tool '{tool_name}' has no handler (unreachable)")