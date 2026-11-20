import React, { useEffect, useState } from 'react';
import { ProjectTask } from '../api';
import { useProjectStatus } from '../hooks/useHarness';
import { StatusBadge } from './StatusBadge';
import { useToast } from '../context/ToastContext';
import {
  X,
  Cpu,
  Calendar,
  Clock,
  Terminal,
  Copy,
  Check,
  AlertTriangle,
  RotateCw,
  ExternalLink,
  Code2,
} from 'lucide-react';

interface TaskDrawerProps {
  task: ProjectTask | null;
  onClose: () => void;
}

export const TaskDrawer: React.FC<TaskDrawerProps> = ({ task, onClose }) => {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const { showToast } = useToast();

  // Fetch real-time status updates for the open task
  const { data: liveTask, isFetching, refetch } = useProjectStatus(task ? task.id : null);

  // Merge initial task with live polled task
  const currentTask = liveTask || task;

  // Handle ESC key to close drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!currentTask) return null;

  const copyToClipboard = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    showToast('info', 'Copied to Clipboard', `Copied ${fieldName} value.`);
    setTimeout(() => setCopiedField(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Drawer Panel */}
      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-xl bg-zinc-950 border-l border-zinc-800 shadow-2xl flex flex-col h-full transform transition-all">
          
          {/* Header */}
          <div className="p-6 border-b border-zinc-800/80 bg-zinc-900/40 flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-2">
                <span className="font-mono text-sm font-semibold text-indigo-400">
                  Task #{currentTask.id}
                </span>
                <StatusBadge status={currentTask.status} />
                {isFetching && (
                  <RotateCw className="w-3.5 h-3.5 text-zinc-500 animate-spin" />
                )}
              </div>
              <h2 className="text-lg font-bold text-zinc-100 truncate leading-snug">
                {currentTask.name}
              </h2>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => refetch()}
                className="p-2 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition-colors"
                title="Refresh task details"
              >
                <RotateCw className={`w-4 h-4 ${isFetching ? 'animate-spin text-indigo-400' : ''}`} />
              </button>
              <button
                onClick={onClose}
                className="p-2 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition-colors"
                aria-label="Close drawer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Drawer Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            
            {/* Metadata Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3.5 rounded-xl bg-zinc-900/50 border border-zinc-800">
                <div className="flex items-center gap-1.5 text-xs text-zinc-500 mb-1">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Created At</span>
                </div>
                <p className="text-xs font-mono text-zinc-200">
                  {new Date(currentTask.created_at).toLocaleString()}
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-zinc-900/50 border border-zinc-800">
                <div className="flex items-center gap-1.5 text-xs text-zinc-500 mb-1">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Execution Attempts</span>
                </div>
                <p className="text-xs font-mono text-zinc-200">
                  <span className="font-semibold text-indigo-400">{currentTask.attempts}</span> of 3 max attempts
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-zinc-900/50 border border-zinc-800 col-span-2">
                <div className="flex items-center justify-between text-xs text-zinc-500 mb-1">
                  <span className="flex items-center gap-1.5">
                    <Cpu className="w-3.5 h-3.5" />
                    <span>Allocated Worker (Lock)</span>
                  </span>
                  {currentTask.locked_at && (
                    <span className="text-[11px] font-mono text-zinc-500">
                      Locked: {new Date(currentTask.locked_at).toLocaleTimeString()}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between mt-1">
                  <p className="text-xs font-mono text-indigo-300">
                    {currentTask.locked_by || 'None (Task is unassigned in queue)'}
                  </p>
                  {currentTask.locked_by && (
                    <button
                      onClick={() => copyToClipboard(currentTask.locked_by!, 'Worker ID')}
                      className="text-zinc-500 hover:text-zinc-300 p-1"
                    >
                      {copiedField === 'Worker ID' ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Error diagnostics section if task failed */}
            {currentTask.last_error && (
              <div className="rounded-xl border border-rose-500/30 bg-rose-950/20 p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-rose-400 text-xs font-semibold uppercase tracking-wider">
                    <AlertTriangle className="w-4 h-4" />
                    <span>Failure Diagnostic Trace</span>
                  </div>
                  <button
                    onClick={() => copyToClipboard(currentTask.last_error!, 'Error stack')}
                    className="flex items-center gap-1 text-[11px] text-rose-300 hover:text-white"
                  >
                    {copiedField === 'Error stack' ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copy trace</span>
                      </>
                    )}
                  </button>
                </div>
                <pre className="text-xs font-mono text-rose-200/90 bg-rose-950/50 p-3 rounded-lg overflow-x-auto whitespace-pre-wrap break-all border border-rose-900/40">
                  {currentTask.last_error}
                </pre>
              </div>
            )}

            {/* Prompt View (if available) */}
            {currentTask.prompt && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                    <Code2 className="w-4 h-4 text-indigo-400" />
                    <span>Submitted Prompt</span>
                  </label>
                  <button
                    onClick={() => copyToClipboard(currentTask.prompt!, 'Prompt')}
                    className="text-xs text-zinc-400 hover:text-zinc-200 flex items-center gap-1"
                  >
                    {copiedField === 'Prompt' ? (
                      <Check className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                    <span>Copy</span>
                  </button>
                </div>
                <div className="p-3.5 rounded-xl bg-zinc-900/80 border border-zinc-800 text-xs font-mono text-zinc-300 whitespace-pre-wrap max-h-48 overflow-y-auto">
                  {currentTask.prompt}
                </div>
              </div>
            )}

            {/* Sandbox Logs & Agent Transcripts Placeholder (Required) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-indigo-400" />
                  <span className="text-xs font-semibold text-zinc-200">
                    Live Execution Logs
                  </span>
                </div>
                <span className="text-[10px] font-mono uppercase bg-indigo-950/60 text-indigo-400 border border-indigo-500/30 px-2 py-0.5 rounded">
                  Docker Sandbox
                </span>
              </div>

              {/* Terminal View */}
              <div className="rounded-xl border border-zinc-800 bg-black/80 overflow-hidden font-mono text-xs">
                {/* Terminal top chrome */}
                <div className="px-4 py-2 bg-zinc-900/90 border-b border-zinc-800 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
                    <span className="ml-2 text-[11px] text-zinc-500 truncate">
                      sandbox-agent://ws-{currentTask.id}/logs.stream
                    </span>
                  </div>
                  <span className="text-[10px] text-zinc-600">STDOUT / STDERR</span>
                </div>

                {/* Terminal content */}
                <div className="p-4 min-h-[160px] flex flex-col justify-center items-center text-center space-y-3">
                  <div className="p-2.5 rounded-xl bg-zinc-900/80 border border-zinc-800 text-zinc-400">
                    <Terminal className="w-5 h-5 text-indigo-400 animate-pulse" />
                  </div>
                  
                  {/* The exact placeholder text requested */}
                  <p className="text-xs text-zinc-300 font-medium">
                    Agent Transcripts &amp; Live Sandbox Logs coming soon...
                  </p>

                  <p className="text-[11px] text-zinc-500 max-w-xs leading-relaxed">
                    Streaming log tap for Docker container stdout/stderr, tool calls, and LLM reasoning steps will appear here in the next release.
                  </p>

                  <div className="inline-flex items-center gap-1.5 text-[10px] font-mono text-zinc-600 border border-zinc-800/80 px-2.5 py-1 rounded-md bg-zinc-950/50">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                    <span>harness-controller: ready for websocket hook</span>
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* Drawer Footer */}
          <div className="p-4 border-t border-zinc-800/80 bg-zinc-900/40 flex items-center justify-between text-xs text-zinc-400">
            <button
              onClick={() => copyToClipboard(JSON.stringify(currentTask, null, 2), 'JSON')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 transition-colors"
            >
              {copiedField === 'JSON' ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              <span>Copy Task Payload</span>
            </button>

            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors font-medium"
            >
              Close
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};
