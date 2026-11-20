import os
from dataclasses import dataclass
from datetime import datetime
from typing import Optional

from psycopg import connect
from psycopg.rows import dict_row
from dotenv import load_dotenv

load_dotenv()
DSN = os.environ["DATABASE_URL"]


@dataclass
class Project:
    id: int
    name: str
    prompt: str
    status: str                                    # pending | running | done | failed
    created_at: datetime
    attempts: int = 0
    locked_at: Optional[datetime] = None
    locked_by: Optional[str] = None
    last_error: Optional[str] = None


def _conn():
    # autocommit=True → we don't leak connections from long agent loops
    return connect(DSN, autocommit=True, row_factory=dict_row)


def init_schema():
    with _conn() as c, c.cursor() as cur:
        cur.execute("""
            CREATE TABLE IF NOT EXISTS projects (
                id         BIGSERIAL PRIMARY KEY,
                name       TEXT NOT NULL,
                prompt     TEXT NOT NULL,
                status     TEXT NOT NULL DEFAULT 'pending',
                attempts   INT  NOT NULL DEFAULT 0,
                locked_at  TIMESTAMPTZ,
                locked_by  TEXT,
                last_error TEXT,
                created_at TIMESTAMPTZ NOT NULL DEFAULT now()
            );
            -- migrations for existing installs
            ALTER TABLE projects ADD COLUMN IF NOT EXISTS attempts   INT NOT NULL DEFAULT 0;
            ALTER TABLE projects ADD COLUMN IF NOT EXISTS locked_at  TIMESTAMPTZ;
            ALTER TABLE projects ADD COLUMN IF NOT EXISTS locked_by  TEXT;
            ALTER TABLE projects ADD COLUMN IF NOT EXISTS last_error TEXT;

            CREATE INDEX IF NOT EXISTS idx_projects_pending
                ON projects(id) WHERE status = 'pending';
        """)


def create(name: str, prompt: str) -> int:
    with _conn() as c, c.cursor() as cur:
        cur.execute(
            "INSERT INTO projects(name, prompt) VALUES (%s,%s) RETURNING id",
            (name, prompt),
        )
        return cur.fetchone()["id"]


def get_pending(limit: int = 5) -> list[Project]:
    with _conn() as c, c.cursor() as cur:
        cur.execute(
            "SELECT * FROM projects WHERE status='pending' ORDER BY id LIMIT %s",
            (limit,),
        )
        return [Project(**r) for r in cur.fetchall()]


def set_status(pid: int, status: str, error: str | None = None) -> None:
    with _conn() as c, c.cursor() as cur:
        cur.execute(
            "UPDATE projects SET status=%s, last_error=%s WHERE id=%s AND status != 'cancelled'",
            (status, error, pid),
        )


def cancel_project(pid: int, reason: str = "Cancelled by user") -> bool:
    with _conn() as c, c.cursor() as cur:
        cur.execute(
            """
            UPDATE projects
            SET status = 'cancelled',
                last_error = %s
            WHERE id = %s AND status IN ('pending', 'running')
            RETURNING id;
            """,
            (reason, pid),
        )
        row = cur.fetchone()
        return row is not None


def delete_project(pid: int) -> bool:
    with _conn() as c, c.cursor() as cur:
        cur.execute("DELETE FROM projects WHERE id = %s RETURNING id;", (pid,))
        row = cur.fetchone()
        return row is not None


def cleanup_projects_db(target: str = "smoke") -> list[int]:
    with _conn() as c, c.cursor() as cur:
        if target == "smoke":
            cur.execute("DELETE FROM projects WHERE name LIKE 'smoke%' RETURNING id;")
        elif target in ("done", "failed", "cancelled"):
            cur.execute("DELETE FROM projects WHERE status = %s RETURNING id;", (target,))
        elif target == "all":
            cur.execute("DELETE FROM projects RETURNING id;")
        else:
            return []
        return [r["id"] for r in cur.fetchall()]


def claim_one(worker_id: str, max_attempts: int = 3) -> Project | None:
    """
    Atomically claim ONE pending task. Returns None if queue is empty.

    Uses FOR UPDATE SKIP LOCKED so concurrent callers never claim the same row.
    Single statement = single transaction = no race window.
    """
    with _conn() as c, c.cursor() as cur:
        cur.execute("""
            WITH picked AS (
                SELECT id FROM projects
                WHERE status = 'pending'
                  AND attempts < %s
                ORDER BY id
                LIMIT 1
                FOR UPDATE SKIP LOCKED
            )
            UPDATE projects
            SET status    = 'running',
                attempts  = projects.attempts + 1,
                locked_at = now(),
                locked_by = %s
            WHERE id = (SELECT id FROM picked)
            RETURNING *;
        """, (max_attempts, worker_id))
        row = cur.fetchone()
        return Project(**row) if row else None


def requeue_orphans(stale_after_sec: int = 300, max_attempts: int = 3) -> int:
    """
    Requeue rows stuck in 'running' whose lock is older than stale_after_sec.
    Called periodically by the controller. Returns count requeued.
    """
    with _conn() as c, c.cursor() as cur:
        cur.execute("""
            UPDATE projects
            SET status     = 'pending',
                locked_at  = NULL,
                locked_by  = NULL,
                last_error = 'requeued: stale lock'
            WHERE status = 'running'
              AND locked_at < now() - make_interval(secs => %s)
              AND attempts < %s
            RETURNING id;
        """, (stale_after_sec, max_attempts))
        return len(cur.fetchall())
