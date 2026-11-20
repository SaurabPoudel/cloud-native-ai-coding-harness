import React, { useState } from 'react';
import { useSubmitTask } from '../hooks/useHarness';
import { Play, Sparkles, Terminal, CornerDownLeft, AlertCircle } from 'lucide-react';

const PRESETS = [
  {
    name: 'Add Prometheus metrics',
    prompt: 'Implement Prometheus metric instrumentation for the FastAPI application routes, measuring request latency and status codes.',
  },
  {
    name: 'Optimize Dockerfile',
    prompt: 'Refactor the Docker sandbox image to utilize multi-stage builds and minimize final container footprint.',
  },
  {
    name: 'Implement Redis task cache',
    prompt: 'Add an asynchronous Redis client with cache hit/miss instrumentation for repeated code search queries.',
  },
];

export const SubmitForm: React.FC = () => {
  const [name, setName] = useState('');
  const [prompt, setPrompt] = useState('');
  const [clientError, setClientError] = useState<string | null>(null);

  const submitMutation = useSubmitTask();

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setClientError(null);

    const trimmedName = name.trim();
    const trimmedPrompt = prompt.trim();

    if (!trimmedName) {
      setClientError('Task name is required.');
      return;
    }
    if (!trimmedPrompt) {
      setClientError('Prompt / instructions cannot be empty.');
      return;
    }

    submitMutation.mutate(
      { name: trimmedName, prompt: trimmedPrompt },
      {
        onSuccess: () => {
          setName('');
          setPrompt('');
          setClientError(null);
        },
      }
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  };

  const applyPreset = (preset: typeof PRESETS[0]) => {
    setName(preset.name);
    setPrompt(preset.prompt);
    setClientError(null);
  };

  return (
    <div className="glass-panel rounded-2xl p-5 border border-zinc-800 shadow-xl relative overflow-hidden">
      {/* Glow highlight */}
      <div className="absolute top-0 right-0 -mr-16 -mt-16 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="pb-3.5 border-b border-zinc-800/80 space-y-3">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-indigo-950/60 border border-indigo-500/30 text-indigo-400 shrink-0">
            <Terminal className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-zinc-100">Deploy Agent Task</h2>
            <p className="text-[11px] text-zinc-500">Inject workload instructions into sandbox queue</p>
          </div>
        </div>

        {/* Quick Presets chips underneath title */}
        <div className="flex items-center gap-2 pt-0.5">
          <span className="text-[11px] text-zinc-500 flex items-center gap-1 shrink-0">
            <Sparkles className="w-3 h-3 text-indigo-400" />
            Presets:
          </span>
          <div className="flex gap-1.5 flex-wrap">
            {PRESETS.map((preset, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => applyPreset(preset)}
                className="px-2.5 py-0.5 text-[11px] rounded bg-zinc-800/80 hover:bg-zinc-700/80 text-zinc-300 hover:text-white border border-zinc-700/50 transition-colors"
                title={preset.prompt}
              >
                {preset.name.split(' ')[0]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        {clientError && (
          <div className="flex items-center gap-2 p-3 text-xs rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{clientError}</span>
          </div>
        )}

        {/* Task Name */}
        <div>
          <label htmlFor="task-name" className="block text-xs font-medium text-zinc-300 mb-1.5">
            Task Name
          </label>
          <input
            id="task-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Add Redis cache to user query endpoint"
            maxLength={100}
            disabled={submitMutation.isPending}
            className="w-full px-3.5 py-2.5 text-sm bg-zinc-950/70 border border-zinc-800 rounded-xl text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500/80 transition-colors disabled:opacity-50"
          />
        </div>

        {/* Prompt / Instructions */}
        <div>
          <div className="flex justify-between items-center mb-1.5">
            <label htmlFor="task-prompt" className="block text-xs font-medium text-zinc-300">
              Prompt / Instructions
            </label>
            <span className="text-[11px] text-zinc-500 font-mono">
              {prompt.length} / 20,000
            </span>
          </div>
          <textarea
            id="task-prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe what the agent should accomplish in the sandbox environment..."
            rows={4}
            maxLength={20000}
            disabled={submitMutation.isPending}
            className="w-full px-3.5 py-2.5 text-sm font-mono text-zinc-200 bg-zinc-950/70 border border-zinc-800 rounded-xl placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500/80 transition-colors resize-y min-h-[96px] disabled:opacity-50"
          />
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between pt-1">
          <div className="text-[11px] text-zinc-500 hidden sm:flex items-center gap-1.5">
            <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-zinc-800 rounded border border-zinc-700/60 text-zinc-400">
              Ctrl + Enter
            </kbd>
            <span>to deploy</span>
          </div>

          <button
            type="submit"
            disabled={submitMutation.isPending || !name.trim() || !prompt.trim()}
            className="ml-auto inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm text-white bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-indigo-600/20 border border-indigo-400/20"
          >
            {submitMutation.isPending ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Deploying Agent...</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-white" />
                <span>Deploy Agent</span>
                <CornerDownLeft className="w-3.5 h-3.5 opacity-60 ml-0.5" />
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
