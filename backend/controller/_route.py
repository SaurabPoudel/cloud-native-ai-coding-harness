"""
Concurrent task scheduler.

Two independent limits:
  - Semaphore(CONCURRENCY): how many agents run simultaneously
  - claim_one() SKIP LOCKED: how many controllers can claim from the DB

Run this file as many times as you want — the DB guarantees no double-claim.
"""

from __future__ import annotations
import asyncio
import os
import socket
import tempfile
from datetime import datetime
from pathlib import Path

from backend.db import claim_one, set_status, requeue_orphans, Project
from backend.harness import run_agent, AgentResult


CONCURRENCY       = int(os.getenv("HARNESS_CONCURRENCY", "5"))
POLL_INTERVAL_SEC = int(os.getenv("HARNESS_POLL_SEC", "3"))
HEARTBEAT_SEC     = 30
STALE_AFTER_SEC   = 300           # a 'running' lock older than 5min is stale
EAGER_REQUEUE     = os.getenv("HARNESS_EAGER_REQUEUE", "1") == "1"

WORKER_ID = f"{socket.gethostname()}-{os.getpid()}"

_semaphore: asyncio.Semaphore | None = None
_running: set[asyncio.Task] = set()
_idle_logged = False


def _workspace_for(project_id: int) -> Path:
    p = Path(tempfile.gettempdir()) / f"harness-ws-{project_id}"
    p.mkdir(parents=True, exist_ok=True)
    return p


def _log_idle_once() -> bool:
    """Suppress identical 'queue empty' lines from N worker loops."""
    global _idle_logged
    if not _idle_logged:
        _idle_logged = True
        return True
    return False


async def _run_one(project: Project) -> None:
    """Run one agent task. Always sets a terminal status, even on crash."""
    try:
        result: AgentResult = await asyncio.to_thread(
            run_agent,
            project.prompt,
            _workspace_for(project.id),
            project.id,
        )
        set_status(project.id, "done" if result.success else "failed")
        print(
            f"[{WORKER_ID}] task {project.id} → "
            f"{'done' if result.success else 'failed'} "
            f"({result.turns}t, {result.tool_calls} calls, {result.tokens_used}tok)"
        )
    except Exception as e:
        try:
            set_status(project.id, "failed", error=f"{type(e).__name__}: {e}")
        except Exception:
            pass
        print(f"[{WORKER_ID}] task {project.id} → CRASH {type(e).__name__}: {e}")


async def _worker_loop() -> None:
    """Continuously claim tasks while the semaphore has capacity."""
    global _semaphore
    assert _semaphore is not None

    while True:
        await _semaphore.acquire()

        project: Project | None
        try:
            project = claim_one(WORKER_ID)
        except Exception as e:
            _semaphore.release()
            print(f"[{WORKER_ID}] claim error: {type(e).__name__}: {e}")
            await asyncio.sleep(POLL_INTERVAL_SEC)
            continue

        if project is None:
            _semaphore.release()
            if _log_idle_once():
                print(f"[{WORKER_ID}] queue empty, sleeping {POLL_INTERVAL_SEC}s")
            await asyncio.sleep(POLL_INTERVAL_SEC)
            continue

        print(f"[{WORKER_ID}] claimed task {project.id} (attempt {project.attempts})")

        task = asyncio.create_task(_run_one(project))
        _running.add(task)

        def _done(t: asyncio.Task) -> None:
            _running.discard(t)
            _semaphore.release()

        task.add_done_callback(_done)


async def _reaper_loop() -> None:
    """Heartbeat every HEARTBEAT_SEC + requeue stale 'running' rows."""
    while True:
        await asyncio.sleep(HEARTBEAT_SEC)
        try:
            n = requeue_orphans(stale_after_sec=STALE_AFTER_SEC)
            print(
                f"[{WORKER_ID}] heartbeat: running={len(_running)} "
                f"requeued={n} at {datetime.now().strftime('%H:%M:%S')}"
            )
        except Exception as e:
            print(f"[{WORKER_ID}] reaper error: {type(e).__name__}: {e}")


async def main() -> None:
    global _semaphore
    _semaphore = asyncio.Semaphore(CONCURRENCY)

    print(f"[{WORKER_ID}] starting — concurrency={CONCURRENCY} poll={POLL_INTERVAL_SEC}s")

    workers = [_worker_loop() for _ in range(CONCURRENCY)]
    reaper = _reaper_loop()

    try:
        await asyncio.gather(*workers, reaper)
    except asyncio.CancelledError:
        print(f"[{WORKER_ID}] shutdown — waiting up to 30s for {len(_running)} task(s)")
        if _running:
            _, pending = await asyncio.wait(_running, timeout=30)
            if pending:
                print(f"[{WORKER_ID}] {len(pending)} task(s) still running — abandoning")
                for t in pending:
                    t.cancel()

        if EAGER_REQUEUE:
            try:
                n = requeue_orphans(stale_after_sec=0)
                if n:
                    print(f"[{WORKER_ID}] eager requeued {n} task(s) for next worker")
            except Exception as e:
                print(f"[{WORKER_ID}] eager requeue error: {type(e).__name__}: {e}")
        raise


if __name__ == "__main__":
    print(f"bootstrap: worker={WORKER_ID} concurrency={CONCURRENCY} poll={POLL_INTERVAL_SEC}s")
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print(f"\n[{WORKER_ID}] stopped by user")
        # Skip Python's atexit thread-join — reaper will recover orphans on
        # next startup, and we've already eager-requeued them above.
        os._exit(0)