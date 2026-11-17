"""
The agent loop. One task, one LLM, N tool calls, hard caps.

Public contract:
    run_agent(prompt, workspace, project_id) -> AgentResult

Never raises for expected errors (budget, tool errors, LLM 400s).
Raises only for infra failures (e.g. Docker daemon down).

Key invariants enforced here:
  - assistant message with tool_calls is appended VERBATIM (guardrail 4)
  - tool message references the exact tool_call_id (guardrail 5)
  - budget exceedance is caught -> AgentResult(success=False)
  - max_turns ceiling prevents infinite loops
  - model narrating completion after progress -> synthesize finish (Case A)
"""

from __future__ import annotations
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from ._LLM_client import LLMClient, BudgetExceeded
from ._tools import TOOLS
from ._execute_tools import execute_tool, ToolResult


MAX_TURNS = 40  # hard ceiling; LLM never sees this — harness enforces it


SYSTEM_PROMPT = """\
# CRITICAL
You are running inside an automated harness. There is NO human reading your
text replies. If you produce a plain text response with no tool call, the
harness will terminate your task as a failure.

# Your workspace
- The sandbox working directory is /workspace. It is your ONLY writable area.
- Relative paths (e.g. `src/main.py`) resolve under /workspace. Never use absolute paths.
- You have bash, read_file, write_file, and finish.

# Rules of engagement
1. Explore before acting. List files, read relevant files BEFORE writing.
2. Think before each tool call: what will you learn? what will change?
3. When a tool fails, read the stderr carefully. Do NOT retry the same command
   unchanged. Diagnose, adjust, retry once.
4. Prefer small, verifiable steps: write a file, run it, check output, next step.
5. Keep bash commands short. Do not `cat` large files or dump entire directories.
6. Never `pip install` unless the task requires a missing package. When you do,
   prefer pinned versions (`pip install requests==2.32.3`).
7. Do not ask the user questions. You cannot reach a human. If blocked, call
   `finish(success=False, summary="<blocker>")`.

# Finish — MANDATORY
- `finish` is a TOOL CALL, not a text message. You MUST call the `finish` tool
  to end the task. Saying "done" in plain text does NOT end the task and is an
  error.
- The moment you have verified the task (tested the script, checked output),
  your VERY NEXT action MUST be `finish(success=True, summary="<one line>")`.
- If you are genuinely blocked, `finish(success=False, summary="<blocker>")`.
- NEVER call finish while a step in your own plan is still pending.
- NEVER respond with only text. Every assistant turn MUST either call a tool
  or call finish.
"""


@dataclass
class AgentResult:
    success: bool
    summary: str
    turns: int
    tool_calls: int
    tokens_used: int
    transcript: list[dict] = field(default_factory=list)  # for logging/replay


# ─────────────────────────────────────────────────────────────
# Message builders — the two invariants in code form
# ─────────────────────────────────────────────────────────────
def _assistant_message(resp: dict) -> dict:
    """
    Rebuild the assistant message EXACTLY as the model returned it.
    If tool_calls are present, they must be preserved verbatim — id, function
    name, arguments. Omitting them causes a 400 on the NEXT request.
    """
    msg = resp["choices"][0]["message"]
    out: dict[str, Any] = {"role": "assistant", "content": msg.get("content") or ""}
    if msg.get("tool_calls"):
        out["tool_calls"] = msg["tool_calls"]  # keep verbatim
    return out


def _tool_message(tool_call_id: str, content: str) -> dict:
    """A tool result must reference the exact tool_call_id it answers."""
    return {"role": "tool", "tool_call_id": tool_call_id, "content": content}


# ─────────────────────────────────────────────────────────────
# The loop
# ─────────────────────────────────────────────────────────────
def run_agent(prompt: str, workspace: Path, project_id: int) -> AgentResult:
    client = LLMClient()
    messages: list[dict] = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": prompt},
    ]

    turns = 0
    tool_call_count = 0
    transcript: list[dict] = []

    while turns < MAX_TURNS:
        turns += 1

        # ── LLM round-trip ──────────────────────────────────
        try:
            resp = client.chat(messages, tools=TOOLS)
        except BudgetExceeded as e:
            return AgentResult(
                success=False,
                summary=f"budget exceeded: {e}",
                turns=turns,
                tool_calls=tool_call_count,
                tokens_used=client.budget.used_tokens,
                transcript=transcript,
            )

        assistant = _assistant_message(resp)
        messages.append(assistant)
        transcript.append(assistant)

        # ── No tool calls = model spoke instead of acting ───
        if not assistant.get("tool_calls"):
            text = (assistant.get("content") or "").strip()

            # Case A: model has made progress, then narrated completion.
            # Well-known quirk of llama-family models. Treat as finish.
            if tool_call_count >= 1 and text:
                return AgentResult(
                    success=True,
                    summary=text[:500],
                    turns=turns,
                    tool_calls=tool_call_count,
                    tokens_used=client.budget.used_tokens,
                    transcript=transcript,
                )

            # Case B: first turn and model only planned — nudge once.
            if turns == 1:
                messages.append({
                    "role": "user",
                    "content": (
                        "You did not call a tool. Do not narrate — ACT. "
                        "Call a tool now, or call finish if the task is complete."
                    ),
                })
                continue

            # Case C: no progress and nothing useful said → stuck.
            return AgentResult(
                success=False,
                summary=f"model stopped without tool_calls: {text[:200] or '<no text>'}",
                turns=turns,
                tool_calls=tool_call_count,
                tokens_used=client.budget.used_tokens,
                transcript=transcript,
            )

        # ── Execute every tool call in order ────────────────
        for call in assistant["tool_calls"]:
            fn = call["function"]
            result: ToolResult = execute_tool(
                tool_name=fn["name"],
                raw_arguments=fn["arguments"],
                workspace=workspace,
                project_id=project_id,
            )
            tool_call_count += 1

            tool_msg = _tool_message(call["id"], result.content)
            messages.append(tool_msg)
            transcript.append(tool_msg)

            if result.finished:
                payload = result.finish_payload or {}
                return AgentResult(
                    success=bool(payload.get("success", False)),
                    summary=payload.get("summary", ""),
                    turns=turns,
                    tool_calls=tool_call_count,
                    tokens_used=client.budget.used_tokens,
                    transcript=transcript,
                )

    # Loop hit max_turns
    return AgentResult(
        success=False,
        summary=f"max_turns ({MAX_TURNS}) reached",
        turns=turns,
        tool_calls=tool_call_count,
        tokens_used=client.budget.used_tokens,
        transcript=transcript,
    )