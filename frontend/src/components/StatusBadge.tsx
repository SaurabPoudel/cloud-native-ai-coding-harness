import React from 'react';
import { TaskStatus } from '../api';
import { Loader2, Clock, CheckCircle2, AlertCircle } from 'lucide-react';

interface StatusBadgeProps {
  status: TaskStatus | string;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md' }) => {
  const normalized = status.toLowerCase() as TaskStatus;

  const configs: Record<TaskStatus, {
    label: string;
    bg: string;
    border: string;
    text: string;
    dotBg: string;
    icon: React.ReactNode;
  }> = {
    pending: {
      label: 'Pending',
      bg: 'bg-zinc-800/80',
      border: 'border-zinc-700/80',
      text: 'text-zinc-300',
      dotBg: 'bg-zinc-400',
      icon: <Clock className="w-3 h-3 text-zinc-400" />,
    },
    running: {
      label: 'Running',
      bg: 'bg-blue-950/60',
      border: 'border-blue-600/40',
      text: 'text-blue-300',
      dotBg: 'bg-blue-400 animate-ping',
      icon: <Loader2 className="w-3 h-3 text-blue-400 animate-spin" />,
    },
    done: {
      label: 'Done',
      bg: 'bg-emerald-950/60',
      border: 'border-emerald-600/40',
      text: 'text-emerald-300',
      dotBg: 'bg-emerald-400',
      icon: <CheckCircle2 className="w-3 h-3 text-emerald-400" />,
    },
    failed: {
      label: 'Failed',
      bg: 'bg-rose-950/60',
      border: 'border-rose-600/40',
      text: 'text-rose-300',
      dotBg: 'bg-rose-400',
      icon: <AlertCircle className="w-3 h-3 text-rose-400" />,
    },
  };

  const current = configs[normalized] || {
    label: status,
    bg: 'bg-zinc-800',
    border: 'border-zinc-700',
    text: 'text-zinc-400',
    dotBg: 'bg-zinc-500',
    icon: null,
  };

  const sizeClasses = size === 'sm' 
    ? 'px-2 py-0.5 text-xs gap-1.5' 
    : 'px-2.5 py-1 text-xs font-medium gap-1.5';

  return (
    <span
      className={`inline-flex items-center rounded-full border shadow-sm transition-colors ${current.bg} ${current.border} ${current.text} ${sizeClasses}`}
    >
      <span className="relative flex h-2 w-2 items-center justify-center">
        {normalized === 'running' && (
          <span className="absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75 animate-ping" />
        )}
        <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${current.dotBg}`} />
      </span>
      <span>{current.label}</span>
    </span>
  );
};
