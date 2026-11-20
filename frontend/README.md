# Harness Control — Frontend Dashboard

A modern, dark-mode-first developer dashboard for orchestrating and observing AI coding agents in Docker sandboxes. Built to interface with the Python FastAPI coding harness backend.

## Tech Stack
- **Framework:** React 18 + Vite
- **Language:** TypeScript
- **Styling:** Tailwind CSS (Dark-mode first, Linear/Vercel aesthetic)
- **State & Polling:** TanStack Query (React Query)
- **Icons:** Lucide React

---

## Quickstart

### 1. Install Dependencies
```bash
cd frontend
bun install
# or: npm install / pnpm install
```

### 2. Start the FastAPI Backend
Ensure your Python backend is running on `localhost:8000`:
```bash
cd ..
uv run uvicorn backend.brain._main:app --host 0.0.0.0 --port 8000 --reload
```

### 3. Run the Frontend Dev Server
```bash
cd frontend
bun run dev
# or: npm run dev
```

The app will be available at `http://localhost:5173`. Vite automatically proxies API requests (`/health`, `/submit`, `/projects`, `/status`) to `http://127.0.0.1:8000`.

---

## Features

1. **System Health & DB Monitor**
   - Top navigation shows real-time FastAPI liveness, PostgreSQL DB connectivity, and pending task queue depth.
   - Automatically polls `/health` with visual green/red indicator.

2. **Deploy Agent Task Panel**
   - Submit new coding instructions (`name` and `prompt`) with instant optimistic updates and cache invalidation.
   - Presets for rapid testing and `Ctrl + Enter` / `Cmd + Enter` keyboard deployment.

3. **Task Queue & Status Board**
   - Live auto-refreshing table polling `/projects` every 3 seconds.
   - Status badges with animated pulse for active agents (`pending`, `running`, `done`, `failed`).
   - Monospace Worker ID (`locked_by`) inspection.
   - Filter by status tab (`All`, `Running`, `Pending`, `Done`, `Failed`) and instant client-side search.

4. **Task Detail & Sandbox Logs Drawer**
   - Slide-over inspector showing full task lifecycle metrics, timestamps, and error stack trace with 1-click clipboard copy.
   - Live status refresh while viewing the drawer.
   - Dedicated terminal window placeholder for upcoming streaming agent logs and Docker sandbox stdout/stderr.

5. **Resilient Error Handling**
   - Non-blocking error alerts when backend is offline with exact CLI command to start FastAPI.
   - Floating toast notification system for submit feedback, copy events, and network errors.
