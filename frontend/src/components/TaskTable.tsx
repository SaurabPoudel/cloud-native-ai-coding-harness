import React, { useState, useMemo } from 'react';
import { ProjectTask, TaskStatus } from '../api';
import { StatusBadge } from './StatusBadge';
import { 
  Search, 
  RotateCw, 
  Layers, 
  ChevronRight, 
  Cpu, 
  AlertTriangle,
  Clock,
  Filter
} from 'lucide-react';

interface TaskTableProps {
  tasks: ProjectTask[];
  isLoading: boolean;
  isFetching: boolean;
  onSelectTask: (task: ProjectTask) => void;
  selectedTaskId: number | null;
}

function formatRelativeTime(dateString: string): string {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffSec < 5) return 'just now';
    if (diffSec < 60) return `${diffSec}s ago`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour}h ago`;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return dateString;
  }
}

export const TaskTable: React.FC<TaskTableProps> = ({
  tasks,
  isLoading,
  isFetching,
  onSelectTask,
  selectedTaskId,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | TaskStatus>('all');

  // Filter tasks based on search query and status tab
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      const matchesSearch =
        searchTerm === '' ||
        task.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        task.id.toString().includes(searchTerm) ||
        (task.locked_by && task.locked_by.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesStatus =
        statusFilter === 'all' || task.status.toLowerCase() === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [tasks, searchTerm, statusFilter]);

  const counts = useMemo(() => {
    return {
      all: tasks.length,
      running: tasks.filter((t) => t.status === 'running').length,
      pending: tasks.filter((t) => t.status === 'pending').length,
      done: tasks.filter((t) => t.status === 'done').length,
      failed: tasks.filter((t) => t.status === 'failed').length,
    };
  }, [tasks]);

  return (
    <div className="glass-panel rounded-2xl border border-zinc-800 shadow-xl overflow-hidden flex flex-col">
      {/* Controls Bar */}
      <div className="p-4 border-b border-zinc-800/80 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        
        {/* Status Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          {(['all', 'running', 'pending', 'done', 'failed'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setStatusFilter(tab)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 whitespace-nowrap ${
                statusFilter === tab
                  ? 'bg-zinc-800 text-white shadow-sm border border-zinc-700/60'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60'
              }`}
            >
              <span className="capitalize">{tab}</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                statusFilter === tab 
                  ? 'bg-zinc-700 text-zinc-100' 
                  : 'bg-zinc-900 text-zinc-500'
              }`}>
                {counts[tab]}
              </span>
            </button>
          ))}
        </div>

        {/* Search & Polling Indicator */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by ID, name, worker..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-zinc-950/80 border border-zinc-800 rounded-lg text-zinc-200 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors"
            />
          </div>

          <div
            className="flex items-center gap-1 text-[11px] text-zinc-500 px-2.5 py-1.5 rounded-lg bg-zinc-950/50 border border-zinc-800 shrink-0"
            title="Auto-refreshing every 3s"
          >
            <RotateCw className={`w-3 h-3 ${isFetching ? 'animate-spin text-indigo-400' : 'text-zinc-500'}`} />
            <span className="hidden md:inline font-mono">3s Poll</span>
          </div>
        </div>
      </div>

      {/* Table Container */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-zinc-800/80 bg-zinc-950/40 text-zinc-400 font-medium">
              <th className="py-3 px-4 w-16">ID</th>
              <th className="py-3 px-4">Task Name</th>
              <th className="py-3 px-4 w-32">Status</th>
              <th className="py-3 px-4 w-24">Attempts</th>
              <th className="py-3 px-4 w-44">Worker ID</th>
              <th className="py-3 px-4 min-w-[200px]">Last Error / Diagnostic</th>
              <th className="py-3 px-4 w-28 text-right">Created</th>
              <th className="py-3 px-3 w-8"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/60">
            {isLoading ? (
              // Loading skeletons
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  <td className="py-4 px-4"><div className="h-4 bg-zinc-800 rounded w-8" /></td>
                  <td className="py-4 px-4"><div className="h-4 bg-zinc-800 rounded w-48" /></td>
                  <td className="py-4 px-4"><div className="h-5 bg-zinc-800 rounded-full w-20" /></td>
                  <td className="py-4 px-4"><div className="h-4 bg-zinc-800 rounded w-10" /></td>
                  <td className="py-4 px-4"><div className="h-4 bg-zinc-800 rounded w-24" /></td>
                  <td className="py-4 px-4"><div className="h-4 bg-zinc-800 rounded w-36" /></td>
                  <td className="py-4 px-4 text-right"><div className="h-4 bg-zinc-800 rounded w-14 ml-auto" /></td>
                  <td className="py-4 px-3" />
                </tr>
              ))
            ) : filteredTasks.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-zinc-500">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Layers className="w-8 h-8 text-zinc-600 stroke-1" />
                    <p className="text-sm font-medium text-zinc-400">No agent tasks found</p>
                    <p className="text-xs text-zinc-600">
                      {searchTerm || statusFilter !== 'all'
                        ? 'Try clearing filters or search criteria'
                        : 'Deploy an agent task above to initialize the queue'}
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              filteredTasks.map((task) => {
                const isSelected = selectedTaskId === task.id;
                return (
                  <tr
                    key={task.id}
                    onClick={() => onSelectTask(task)}
                    className={`cursor-pointer transition-colors group ${
                      isSelected
                        ? 'bg-indigo-950/30 hover:bg-indigo-950/40'
                        : 'hover:bg-zinc-800/40'
                    }`}
                  >
                    {/* ID */}
                    <td className="py-3.5 px-4 font-mono font-medium text-zinc-400 group-hover:text-zinc-200">
                      #{task.id}
                    </td>

                    {/* Name */}
                    <td className="py-3.5 px-4 font-medium text-zinc-200 max-w-xs truncate">
                      <div className="flex items-center gap-2">
                        <span className="truncate">{task.name}</span>
                      </div>
                    </td>

                    {/* Status Badge */}
                    <td className="py-3.5 px-4">
                      <StatusBadge status={task.status} />
                    </td>

                    {/* Attempts */}
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center gap-1 font-mono text-zinc-400">
                        <span className="text-zinc-200 font-semibold">{task.attempts}</span>
                        <span className="text-zinc-600">/</span>
                        <span className="text-zinc-500">3</span>
                      </span>
                    </td>

                    {/* Worker ID (Locked by) */}
                    <td className="py-3.5 px-4">
                      {task.locked_by ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded font-mono text-[11px] bg-zinc-900 border border-zinc-800 text-indigo-300 max-w-[170px] truncate" title={task.locked_by}>
                          <Cpu className="w-3 h-3 text-indigo-400 shrink-0" />
                          <span className="truncate">{task.locked_by}</span>
                        </span>
                      ) : (
                        <span className="text-zinc-600 text-xs italic font-mono">—</span>
                      )}
                    </td>

                    {/* Last Error */}
                    <td className="py-3.5 px-4 max-w-sm">
                      {task.last_error ? (
                        <div
                          className="flex items-center gap-1.5 text-rose-400/90 hover:text-rose-300 truncate group/err cursor-help"
                          title={task.last_error}
                        >
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-rose-400" />
                          <span className="truncate font-mono text-[11px] bg-rose-950/30 px-1.5 py-0.5 rounded border border-rose-900/30">
                            {task.last_error}
                          </span>
                        </div>
                      ) : (
                        <span className="text-zinc-600 font-mono">—</span>
                      )}
                    </td>

                    {/* Created At */}
                    <td className="py-3.5 px-4 text-right text-zinc-400 font-mono text-[11px] whitespace-nowrap">
                      <span title={new Date(task.created_at).toLocaleString()}>
                        {formatRelativeTime(task.created_at)}
                      </span>
                    </td>

                    {/* Arrow action indicator */}
                    <td className="py-3.5 px-3 text-right">
                      <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-zinc-300 transition-transform group-hover:translate-x-0.5" />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Footer stats count */}
      <div className="py-2.5 px-4 bg-zinc-950/60 border-t border-zinc-800/80 flex items-center justify-between text-[11px] text-zinc-500">
        <div className="flex items-center gap-2">
          <span>Showing {filteredTasks.length} of {tasks.length} tasks</span>
          {tasks.length > 0 && <span className="text-zinc-700">•</span>}
          <span className="text-zinc-600">Click any row to open runtime inspector</span>
        </div>
        <div className="flex items-center gap-1 font-mono text-zinc-500">
          <span>FastAPI Engine</span>
        </div>
      </div>
    </div>
  );
};
