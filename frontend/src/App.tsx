import React, { useState } from 'react';
import { Navbar } from './components/Navbar';
import { MetricCards } from './components/MetricCards';
import { SubmitForm } from './components/SubmitForm';
import { TaskTable } from './components/TaskTable';
import { TaskDrawer } from './components/TaskDrawer';
import { ToastContainer } from './components/ToastContainer';
import { useHealth, useProjects } from './hooks/useHarness';
import { ProjectTask } from './api';
import { AlertCircle, Terminal, RefreshCw, Zap } from 'lucide-react';

export const App: React.FC = () => {
  const [selectedTask, setSelectedTask] = useState<ProjectTask | null>(null);

  const { data: health, isError: isHealthError, error: healthError } = useHealth();
  const {
    data: projects = [],
    isLoading: isProjectsLoading,
    isFetching: isProjectsFetching,
    isError: isProjectsError,
    error: projectsError,
    refetch: refetchProjects,
  } = useProjects(50);

  const hasBackendError = isHealthError || isProjectsError;
  const backendErrorMessage =
    (healthError as Error)?.message || (projectsError as Error)?.message || 'Failed to connect to FastAPI backend.';

  return (
    <div className="min-h-screen bg-[#08090d] text-zinc-100 flex flex-col font-sans selection:bg-indigo-500/30">
      {/* Top Navbar */}
      <Navbar />

      {/* Backend Offline / Error Banner */}
      {hasBackendError && (
        <div className="bg-rose-950/80 border-b border-rose-500/30 px-4 py-3">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-rose-200">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <div>
                <span className="font-semibold text-rose-100">Backend Communication Issue: </span>
                <span>{backendErrorMessage}</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-mono text-[11px] text-rose-300 bg-rose-900/60 px-2.5 py-1 rounded border border-rose-700/50 hidden md:inline">
                uv run uvicorn backend.brain._main:app --port 8000 --reload
              </span>
              <button
                onClick={() => refetchProjects()}
                className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-900/80 hover:bg-rose-800 rounded-md border border-rose-600/40 text-white font-medium transition-colors"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Retry</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        
        {/* Metric Overview Cards */}
        <MetricCards
          tasks={projects}
          health={health}
          isLoading={isProjectsLoading}
        />

        {/* Dashboard Grid: Left/Top Submit Panel + Right/Main Queue */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Submit Task Panel (4 cols on lg screens) */}
          <div className="lg:col-span-4 lg:sticky lg:top-24 space-y-4">
            <SubmitForm />

            {/* Quick Architecture Note */}
            <div className="p-4 rounded-xl border border-zinc-800/60 bg-zinc-900/30 text-xs text-zinc-500 space-y-2">
              <div className="flex items-center gap-1.5 text-zinc-400 font-medium">
                <Zap className="w-3.5 h-3.5 text-indigo-400" />
                <span>Concurrent Sandbox Engine</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                Tasks are claimed via PostgreSQL <code className="text-zinc-300 font-mono">FOR UPDATE SKIP LOCKED</code>. Up to 5 agents concurrently run in isolated Docker containers with automated timeout enforcement.
              </p>
            </div>
          </div>

          {/* Task Queue & Status Board (8 cols on lg screens) */}
          <div className="lg:col-span-8">
            <TaskTable
              tasks={projects}
              isLoading={isProjectsLoading}
              isFetching={isProjectsFetching}
              onSelectTask={(task) => setSelectedTask(task)}
              selectedTaskId={selectedTask?.id ?? null}
            />
          </div>
        </div>
      </main>

      {/* Task Details / Logs Drawer */}
      <TaskDrawer
        task={selectedTask}
        onClose={() => setSelectedTask(null)}
      />

      {/* Global Toast Notifications */}
      <ToastContainer />
    </div>
  );
};
