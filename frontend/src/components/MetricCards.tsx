import React from 'react';
import { ProjectTask, HealthResponse } from '../api';
import { Activity, Clock, CheckCircle2, AlertTriangle } from 'lucide-react';

interface MetricCardsProps {
  tasks: ProjectTask[];
  health?: HealthResponse;
  isLoading: boolean;
}

export const MetricCards: React.FC<MetricCardsProps> = ({ tasks, health, isLoading }) => {
  const runningCount = tasks.filter((t) => t.status === 'running').length;
  const pendingCount = health?.pending_count ?? tasks.filter((t) => t.status === 'pending').length;
  const doneCount = tasks.filter((t) => t.status === 'done').length;
  const failedCount = tasks.filter((t) => t.status === 'failed').length;

  const cards = [
    {
      label: 'Active Agents',
      value: runningCount,
      icon: <Activity className="w-4 h-4 text-blue-400" />,
      border: 'border-blue-500/20',
      bg: 'from-blue-950/20 to-transparent',
      glow: runningCount > 0 ? 'text-blue-400' : 'text-zinc-400',
      subtext: runningCount > 0 ? 'Executing sandbox workloads' : 'Idle capacity ready',
    },
    {
      label: 'Pending Queue',
      value: pendingCount,
      icon: <Clock className="w-4 h-4 text-amber-400" />,
      border: 'border-amber-500/20',
      bg: 'from-amber-950/20 to-transparent',
      glow: pendingCount > 0 ? 'text-amber-400' : 'text-zinc-400',
      subtext: 'Awaiting worker allocation',
    },
    {
      label: 'Completed Tasks',
      value: doneCount,
      icon: <CheckCircle2 className="w-4 h-4 text-emerald-400" />,
      border: 'border-emerald-500/20',
      bg: 'from-emerald-950/20 to-transparent',
      glow: 'text-emerald-400',
      subtext: 'Clean test & agent exits',
    },
    {
      label: 'Failed / Retries',
      value: failedCount,
      icon: <AlertTriangle className="w-4 h-4 text-rose-400" />,
      border: 'border-rose-500/20',
      bg: 'from-rose-950/20 to-transparent',
      glow: failedCount > 0 ? 'text-rose-400' : 'text-zinc-400',
      subtext: 'Inspections & diagnostics',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card, i) => (
        <div
          key={i}
          className={`relative p-4 rounded-xl border bg-gradient-to-b ${card.bg} ${card.border} bg-zinc-900/40 backdrop-blur-sm transition-all hover:border-zinc-700/60`}
        >
          <div className="flex items-center justify-between text-xs font-medium text-zinc-400">
            <span>{card.label}</span>
            <div className="p-1.5 rounded-lg bg-zinc-800/60 border border-zinc-700/50">
              {card.icon}
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className={`text-2xl font-bold font-mono tracking-tight ${card.glow}`}>
              {isLoading ? '—' : card.value}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-zinc-500 truncate">{card.subtext}</p>
        </div>
      ))}
    </div>
  );
};
