import React from 'react';
import { useHealth } from '../hooks/useHarness';
import { Cpu, Database, RefreshCw, Server, AlertCircle } from 'lucide-react';

export const Navbar: React.FC = () => {
  const { data: health, isError, isLoading, isFetching, refetch } = useHealth();

  const isOnline = !isError && health?.status === 'ok';

  return (
    <header className="sticky top-0 z-30 w-full border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Brand / Logo */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 via-indigo-600 to-violet-700 flex items-center justify-center shadow-lg shadow-indigo-500/20 border border-indigo-400/20">
            <Cpu className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-base text-zinc-100 tracking-tight">Harness Control</span>
              <span className="px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase bg-zinc-800 text-zinc-400 rounded-md border border-zinc-700/60">
                v0.1.0
              </span>
            </div>
            <p className="text-xs text-zinc-500 hidden sm:block">Cloud-Native AI Agent Sandbox Orchestrator</p>
          </div>
        </div>

        {/* Live System Health Indicator & Actions */}
        <div className="flex items-center gap-3">
          {/* Health Pill */}
          <div
            className={`flex items-center gap-2.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${
              isLoading
                ? 'bg-zinc-900 border-zinc-800 text-zinc-400'
                : isOnline
                ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-950/40 border-rose-500/30 text-rose-300'
            }`}
            title={
              isOnline
                ? `FastAPI: ${health?.status} | DB: ${health?.db} | Pending Tasks: ${health?.pending_count}`
                : 'Backend unreachable. Make sure FastAPI is running on port 8000.'
            }
          >
            <span className="relative flex h-2 w-2">
              {isOnline && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              )}
              <span
                className={`relative inline-flex rounded-full h-2 w-2 ${
                  isOnline ? 'bg-emerald-500' : 'bg-rose-500'
                }`}
              />
            </span>

            <span className="flex items-center gap-1.5">
              <Server className="w-3.5 h-3.5 opacity-70" />
              <span>{isOnline ? 'System Healthy' : 'System Offline'}</span>
            </span>

            {isOnline && (
              <>
                <span className="text-zinc-600">|</span>
                <span className="flex items-center gap-1 text-emerald-400 font-mono text-[11px]">
                  <Database className="w-3 h-3 opacity-80" />
                  DB OK
                </span>
                <span className="text-zinc-600">|</span>
                <span className="flex items-center gap-1 text-zinc-300">
                  <span className="text-zinc-400">Pending:</span>
                  <span className="font-mono font-semibold px-1.5 py-0.2 bg-zinc-800/80 rounded border border-zinc-700/50 text-indigo-300">
                    {health?.pending_count ?? 0}
                  </span>
                </span>
              </>
            )}

            {!isOnline && !isLoading && (
              <span className="flex items-center gap-1 text-[11px] text-rose-400">
                <AlertCircle className="w-3 h-3" />
                (Port 8000)
              </span>
            )}
          </div>

          {/* Manual Refresh Button */}
          <button
            onClick={() => refetch()}
            className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-zinc-200 transition-colors"
            title="Refresh system state"
            aria-label="Refresh system state"
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin text-indigo-400' : ''}`} />
          </button>
        </div>

      </div>
    </header>
  );
};
