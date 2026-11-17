# backend/sandbox/_sandbox_executor.py
import io
import tarfile
import uuid
from pathlib import Path

import docker
from docker.errors import ContainerError, ImageNotFound

from ._sadbox_setup import SandboxConfig, DEFAULT_CONFIG

_client = docker.from_env()


def _tar_dir(src: Path) -> bytes:
    """Pack a host dir into an in-memory tar for `put_archive`."""
    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode="w") as tar:
        tar.add(src, arcname=".")
    return buf.getvalue()


def run_in_sandbox(
    project_id: int,
    command: str,
    workspace: Path,
    cfg: SandboxConfig = DEFAULT_CONFIG,
) -> dict:
    """
    Boot an ephemeral container, inject workspace, run `command`, capture
    stdout/stderr/exit, then destroy. Returns a dict — never raises for
    user-code failures (only for infra failures).
    """
    name = f"agent-{project_id}-{uuid.uuid4().hex[:8]}"

    try:
        container = _client.containers.create(
            image=cfg.image,
            command=["bash", "-lc", command],
            name=name,
            working_dir=cfg.workdir,
            mem_limit=cfg.mem_limit,
            nano_cpus=cfg.nano_cpus,
            pids_limit=cfg.pids_limit,
            network_disabled=cfg.network_disabled,
            detach=True,
            auto_remove=False,      # we remove explicitly for visibility
            labels={"harness": "1", "project_id": str(project_id)},
        )
    except ImageNotFound:
        _client.images.pull(cfg.image)
        return run_in_sandbox(project_id, command, workspace, cfg)

    try:
        # inject workspace files (no host bind-mount → safer)
        container.put_archive(cfg.workdir, _tar_dir(workspace))

        container.start()

        try:
            result = container.wait(timeout=cfg.timeout_sec)
            exit_code = result["StatusCode"]
            timed_out = False
        except Exception:
            container.kill()
            exit_code, timed_out = -1, True

        stdout = container.logs(stdout=True, stderr=False).decode(errors="replace")
        stderr = container.logs(stdout=False, stderr=True).decode(errors="replace")

        return {
            "exit_code": exit_code,
            "stdout": stdout,
            "stderr": stderr,
            "timed_out": timed_out,
            "container": name,
        }
    finally:
        try:
            container.remove(force=True)
        except Exception:
            pass  # already gone


def destroy_sandbox(name: str) -> None:
    """Emergency cleanup — used by the controller on crash."""
    try:
        _client.containers.get(name).remove(force=True)
    except Exception:
        pass