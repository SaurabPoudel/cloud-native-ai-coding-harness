import os
from dataclasses import dataclass
from datetime import datetime
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
    status: str
    created_at: datetime

def _conn():
    return connect(DSN, autocommit=True, row_factory=dict_row)

def init_schema():
    with _conn() as c, c.cursor() as cur:
        cur.execute("""
            CREATE TABLE IF NOT EXISTS projects (
                id         BIGSERIAL PRIMARY KEY,
                name       TEXT NOT NULL,
                prompt     TEXT NOT NULL,
                status     TEXT NOT NULL DEFAULT 'pending',
                created_at TIMESTAMPTZ NOT NULL DEFAULT now()
            );
            CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
        """)

def create(name: str, prompt: str) -> int:
    with _conn() as c, c.cursor() as cur:
        cur.execute(
            "INSERT INTO projects (name, prompt) VALUES (%s, %s) RETURNING id;",
            (name, prompt)
        )
        return cur.fetchone()["id"]


def get_pending(limit: int = 5) -> list[Project]:
    with _conn() as c, c.cursor() as cur:
        cur.execute(
            "SELECT  * FROM projects WHERE status = 'pending' ORDER BY created_at ASC LIMIT %s;",
            (limit,)
        )
        return [Project(**row) for row in cur.fetchall()]

def set_status(pid: int, status: str):
    with _conn() as c, c.cursor() as cur:
        cur.execute("UPDATE projects SET status = %s WHERE id = %s;", (status, pid))