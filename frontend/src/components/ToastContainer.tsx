import React from 'react';
import { useToast, ToastType } from '../context/ToastContext';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';

const iconMap: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />,
  error: <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />,
  warning: <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />,
  info: <Info className="w-5 h-5 text-indigo-400 shrink-0" />,
};

const borderMap: Record<ToastType, string> = {
  success: 'border-emerald-500/30 bg-emerald-950/40 text-emerald-100',
  error: 'border-rose-500/30 bg-rose-950/40 text-rose-100',
  warning: 'border-amber-500/30 bg-amber-950/40 text-amber-100',
  info: 'border-indigo-500/30 bg-indigo-950/40 text-indigo-100',
};

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-md w-full pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl border backdrop-blur-xl shadow-2xl transition-all duration-300 animate-in slide-in-from-bottom-2 ${borderMap[toast.type]}`}
        >
          {iconMap[toast.type]}
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-semibold text-zinc-100 leading-tight">
              {toast.title}
            </h4>
            {toast.message && (
              <p className="mt-1 text-xs text-zinc-400 line-clamp-3 leading-relaxed">
                {toast.message}
              </p>
            )}
          </div>
          <button
            onClick={() => removeToast(toast.id)}
            className="text-zinc-400 hover:text-zinc-200 p-0.5 rounded transition-colors"
            aria-label="Close notification"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
};
