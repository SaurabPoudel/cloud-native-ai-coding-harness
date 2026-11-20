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
import os
import shutil
import tempfile
from pathlib import Path
from datetime import datetime
from typing import Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from backend.db import (
    init_schema,
    create,
    get_pending,
    cancel_project,
    delete_project,
    cleanup_projects_db,
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


class CancelResponse(BaseModel):
    id: int
    status: str
    message: str


class WorkspaceFileInfo(BaseModel):
    name: str
    path: str
    size: int
    modified_at: datetime
    is_dir: bool = False


class WorkspaceFilesResponse(BaseModel):
    project_id: int
    workspace_path: str
    files: list[WorkspaceFileInfo]


class WorkspaceFileContentResponse(BaseModel):
    project_id: int
    path: str
    content: str
    size: int
    is_binary: bool = False


class DeleteResponse(BaseModel):
    id: int
    deleted: bool
    message: str


class CleanupResponse(BaseModel):
    deleted_count: int
    deleted_ids: list[int]
    message: str


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


@app.post("/projects/{project_id}/cancel", response_model=CancelResponse)
@app.post("/cancel/{project_id}", response_model=CancelResponse)
def cancel_task(project_id: int) -> CancelResponse:
    with _conn() as c, c.cursor() as cur:
        cur.execute("SELECT id, status FROM projects WHERE id=%s", (project_id,))
        row = cur.fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail=f"project {project_id} not found")

    current_status = row["status"]
    if current_status in ("done", "failed", "cancelled"):
        raise HTTPException(
            status_code=400,
            detail=f"Cannot cancel project {project_id} with terminal status '{current_status}'",
        )

    ok = cancel_project(project_id, reason="Cancelled by user via dashboard")
    if not ok:
        raise HTTPException(status_code=500, detail="Failed to cancel task")
    return CancelResponse(
        id=project_id,
        status="cancelled",
        message=f"Task {project_id} has been cancelled.",
    )


@app.delete("/projects/{project_id}", response_model=DeleteResponse)
def delete_task(project_id: int) -> DeleteResponse:
    # Remove sandbox workspace directory on disk if it exists
    ws = Path(tempfile.gettempdir()) / f"harness-ws-{project_id}"
    if ws.exists():
        shutil.rmtree(ws, ignore_errors=True)

    ok = delete_project(project_id)
    if not ok:
        raise HTTPException(status_code=404, detail=f"project {project_id} not found")
    return DeleteResponse(
        id=project_id,
        deleted=True,
        message=f"Task #{project_id} and its workspace have been deleted.",
    )


@app.post("/projects/cleanup", response_model=CleanupResponse)
def cleanup_projects(target: str = Query("smoke", description="'smoke', 'done', 'failed', 'cancelled', or 'all'")) -> CleanupResponse:
    target_clean = target.lower().strip()
    deleted_ids = cleanup_projects_db(target_clean)

    for pid in deleted_ids:
        ws = Path(tempfile.gettempdir()) / f"harness-ws-{pid}"
        if ws.exists():
            shutil.rmtree(ws, ignore_errors=True)

    return CleanupResponse(
        deleted_count=len(deleted_ids),
        deleted_ids=deleted_ids,
        message=f"Successfully purged {len(deleted_ids)} '{target_clean}' tasks and workspaces.",
    )


@app.get("/projects/{project_id}/files", response_model=WorkspaceFilesResponse)
def list_workspace_files(project_id: int) -> WorkspaceFilesResponse:
    ws = Path(tempfile.gettempdir()) / f"harness-ws-{project_id}"
    if not ws.exists() or not ws.is_dir():
        return WorkspaceFilesResponse(project_id=project_id, workspace_path=str(ws), files=[])

    files_list: list[WorkspaceFileInfo] = []
    for p in ws.rglob("*"):
        if any(part.startswith(".") or part == "__pycache__" for part in p.parts):
            continue
        try:
            stat = p.stat()
            rel_path = str(p.relative_to(ws))
            files_list.append(
                WorkspaceFileInfo(
                    name=p.name,
                    path=rel_path,
                    size=stat.st_size if p.is_file() else 0,
                    modified_at=datetime.fromtimestamp(stat.st_mtime),
                    is_dir=p.is_dir(),
                )
            )
        except OSError:
            continue

    files_list.sort(key=lambda f: (not f.is_dir, f.path.lower()))
    return WorkspaceFilesResponse(
        project_id=project_id,
        workspace_path=str(ws),
        files=files_list,
    )


@app.get("/projects/{project_id}/file", response_model=WorkspaceFileContentResponse)
def get_workspace_file_content(
    project_id: int, path: str = Query(..., min_length=1)
) -> WorkspaceFileContentResponse:
    ws = Path(tempfile.gettempdir()) / f"harness-ws-{project_id}"
    target = (ws / path).resolve()

    try:
        target.relative_to(ws.resolve())
    except ValueError:
        raise HTTPException(status_code=403, detail="Access denied: path traversal detected.")

    if not target.exists() or not target.is_file():
        raise HTTPException(status_code=404, detail=f"File '{path}' not found in workspace.")

    try:
        content = target.read_text(encoding="utf-8")
        return WorkspaceFileContentResponse(
            project_id=project_id,
            path=path,
            content=content,
            size=target.stat().st_size,
            is_binary=False,
        )
    except UnicodeDecodeError:
        return WorkspaceFileContentResponse(
            project_id=project_id,
            path=path,
            content="[Binary file content cannot be displayed in text editor]",
            size=target.stat().st_size,
            is_binary=True,
        )
