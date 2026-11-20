"""
FastAPI entry point for the harness.

Endpoints:
  GET  /health              → liveness + DB ping
  POST /submit              → create a task, return its ID
  GET  /projects            → list recent projects (paginated, default 20)
  GET  /status/{project_id} → one project's state

Run:
  uv run uvicorn backend.brain._main:app --host 0.0.0.0 --port 8000 --reload
"""

from __future__ import annotations
from datetime import datetime
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from backend.db import (
    init_schema,
    create,
    get_pending,
    _conn,        # private but needed for /status and /projects
    Project,
)


# ─────────────────────────────────────────────────────────────
# Request / response models (Pydantic v2)
# ─────────────────────────────────────────────────────────────
class SubmitRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    prompt: str = Field(..., min_length=1, max_length=20_000)


class SubmitResponse(BaseModel):
    id: int
    status: str = "pending"


class StatusResponse(BaseModel):
    id: int
    name: str
    status: str
    attempts: int
    last_error: Optional[str] = None
    created_at: datetime
    locked_at: Optional[datetime] = None
    locked_by: Optional[str] = None


class HealthResponse(BaseModel):
    status: str
    db: str
    pending_count: int


# ─────────────────────────────────────────────────────────────
# App + startup
# ─────────────────────────────────────────────────────────────
app = FastAPI(
    title="Cloud-Native AI Coding Harness",
    version="0.1.0",
    description="Submit coding tasks to isolated Docker sandboxes, run 100+ agents.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def _on_startup() -> None:
    """Run schema migration once at startup. Idempotent (IF NOT EXISTS)."""
    init_schema()


# ─────────────────────────────────────────────────────────────
# Endpoints
# ─────────────────────────────────────────────────────────────
@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    try:
        pending = len(get_pending(limit=1000))
        return HealthResponse(status="ok", db="ok", pending_count=pending)
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"db unreachable: {e}")


@app.post("/submit", response_model=SubmitResponse, status_code=201)
def submit(req: SubmitRequest) -> SubmitResponse:
    try:
        pid = create(req.name, req.prompt)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"db write failed: {e}")
    return SubmitResponse(id=pid)


@app.get("/projects", response_model=list[StatusResponse])
def list_projects(limit: int = 20) -> list[StatusResponse]:
    limit = max(1, min(limit, 200))
    with _conn() as c, c.cursor() as cur:
        cur.execute(
            "SELECT * FROM projects ORDER BY id DESC LIMIT %s",
            (limit,),
        )
        rows = cur.fetchall()
    return [StatusResponse(**r) for r in rows]


@app.get("/status/{project_id}", response_model=StatusResponse)
def status(project_id: int) -> StatusResponse:
    with _conn() as c, c.cursor() as cur:
        cur.execute("SELECT * FROM projects WHERE id=%s", (project_id,))
        row = cur.fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail=f"project {project_id} not found")
    return StatusResponse(**row)
