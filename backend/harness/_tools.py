"""
Tool schemas exposed to the LLM. Shape is OpenAI function-calling format.

Design rules enforced here:
1. `description` explains WHEN to use the tool, not just what it does.
2. Every parameter has an explicit description — no bare types.
3. Required parameters only. Optional params invite hallucination.
4. Tools are intentionally few. Adding tools increases loop probability.
"""

TOOLS: list[dict] = [
    {
        "type": "function",
        "function": {
            "name": "bash",
            "description": (
                "Run a shell command inside the sandbox at /workspace. "
                "Use for: listing files (ls), inspecting (cat, head), running "
                "Python (python x.py), running tests, installing packages "
                "(pip install X). You start in /workspace. "
                "Output is captured (stdout + stderr) and returned to you. "
                "Do NOT use for reading a file you will then edit — use "
                "read_file so you get line numbers. "
                "Do NOT use for writing files — use write_file. "
                "Commands time out after 60s; keep them short and focused."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "command": {
                        "type": "string",
                        "description": (
                            "A single bash command. Can be piped or chained with &&. "
                            "Runs under `bash -lc` so `pip`, `python`, `git` are on PATH."
                        ),
                    }
                },
                "required": ["command"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "read_file",
            "description": (
                "Read a text file from /workspace and return it with line numbers "
                "(format: `  12| content`). Use this before editing an existing file "
                "so you know its exact contents. Returns an error string if the file "
                "does not exist or is binary."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {
                        "type": "string",
                        "description": (
                            "Path relative to /workspace, e.g. 'src/main.py'. "
                            "Do NOT use absolute paths; do NOT use '..'."
                        ),
                    },
                    "max_lines": {
                        "type": "integer",
                        "description": (
                            "Max lines to return, starting from line 1. "
                            "Default 500. Use to avoid flooding context on large files."
                        ),
                    },
                },
                "required": ["path"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "write_file",
            "description": (
                "Create or OVERWRITE a text file at the given path under /workspace. "
                "Creates parent directories automatically. Always write the COMPLETE "
                "file contents — this replaces the whole file. Never emit a diff or "
                "partial content. If you only want to change part of a file, first "
                "read_file it, then write the whole new version."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {
                        "type": "string",
                        "description": "Relative path under /workspace, e.g. 'src/main.py'.",
                    },
                    "content": {
                        "type": "string",
                        "description": "Full file contents. Empty string allowed (creates empty file).",
                    },
                },
                "required": ["path", "content"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "finish",
            "description": (
                "Call this ONLY when the task is fully complete or you have decided "
                "it cannot be completed. This ends the agent loop. "
                "Provide a one-paragraph summary of what you did or why you stopped. "
                "Do NOT call finish while any todo item is still pending."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "summary": {
                        "type": "string",
                        "description": "What was accomplished, or the specific blocker.",
                    },
                    "success": {
                        "type": "boolean",
                        "description": "True if the task was completed; false if blocked.",
                    },
                },
                "required": ["summary", "success"],
            },
        },
    },
]


def dispatch(*args, **kwargs):
    raise NotImplementedError("dispatch lives in _execute_tools.py after Step 5")