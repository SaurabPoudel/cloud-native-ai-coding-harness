# Cloud-Native AI Coding Harness

This project gives you a small dashboard for handing coding tasks to AI agents and keeping an eye on what they do. Each task is stored in PostgreSQL, picked up by a worker, and run in its own Docker sandbox. You can submit work, follow task status, and inspect the files an agent leaves behind from the browser.

The repository has three moving parts:

- **FastAPI backend** accepts tasks and serves their status and workspace files.
- **Worker** claims tasks from PostgreSQL and runs the agent loop.
- **React dashboard** lets you submit tasks and inspect the queue.

## What it looks like

The main screen shows system health, the task form, and the task queue.

![Harness dashboard home screen](screenshots/homescreen.png)

Select a task to browse the files created in its workspace.

![Workspace file browser for a completed task](screenshots/workspace-files.png)

## Before you start

You’ll need:

- Python 3.12 or newer and [uv](https://docs.astral.sh/uv/)
- Node.js and npm (or Bun)
- A PostgreSQL database
- Docker running on the machine that runs the worker
- A Groq API key

## Get it running

### 1. Configure the backend

Create a `.env` file in the project root with your PostgreSQL connection string and Groq API key:

```dotenv
DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/harness
GROQ_API_KEY=your-groq-api-key
```

Replace the example database details with a database you can connect to. Keep `.env` local; it contains credentials.

Install the Python dependencies:

```bash
uv sync
```

### 2. Start the API

In one terminal, from the project root:

```bash
uv run uvicorn backend.brain._main:app --host 0.0.0.0 --port 8000 --reload
```

The API is available at `http://localhost:8000`; its interactive docs are at `http://localhost:8000/docs`.

### 3. Start a worker

In a second terminal, also from the project root:

```bash
uv run python -m backend.controller._route
```

The worker polls the database for tasks and launches them in Docker. By default, one worker runs up to five tasks at a time. You can change that with `HARNESS_CONCURRENCY`; `HARNESS_POLL_SEC` controls how often it checks for work.

### 4. Start the dashboard

In a third terminal:

```bash
cd frontend
bun install
bun dev
```

Open `http://localhost:5173`. During development, Vite forwards API requests to the backend on port 8000.

## Using the dashboard

Enter a task name and a clear prompt, then submit it. The queue refreshes automatically, and selecting a row opens its task details. From there you can review the prompt and status, browse workspace files, and use the available task controls.

The agent works in an isolated Docker container with a task-specific workspace. Files are also available to the dashboard through the backend, so you can inspect the result without opening the container yourself.

## API at a glance

The API includes endpoints for checking health, submitting and listing tasks, reading an individual task’s status, and inspecting its workspace files. It also supports cancelling and deleting tasks, plus cleaning up tasks by status. For request and response details, see `/docs` while the API is running.

## A few useful notes

- The backend creates or updates the task table when it starts; PostgreSQL must be reachable first.
- The worker needs access to a working Docker daemon. Starting the API alone does not execute queued tasks.
- Agent calls use the Groq client and the `openai/gpt-oss-120b` model configured in the backend.
- The frontend has its own setup notes in [frontend/README.md](frontend/README.md).
