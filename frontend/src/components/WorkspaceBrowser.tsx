import React, { useState } from 'react';
import { useWorkspaceFiles, useWorkspaceFileContent } from '../hooks/useHarness';
import { WorkspaceFileInfo } from '../api';
import { useToast } from '../context/ToastContext';
import {
  FileText,
  FileCode,
  FileJson,
  Folder,
  RotateCw,
  Copy,
  Check,
  Code2,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';

interface WorkspaceBrowserProps {
  projectId: number;
}

function getFileIcon(name: string) {
  if (name.endsWith('.py')) return <FileCode className="w-4 h-4 text-emerald-400" />;
  if (name.endsWith('.json')) return <FileJson className="w-4 h-4 text-amber-400" />;
  if (name.endsWith('.md') || name.endsWith('.txt')) return <FileText className="w-4 h-4 text-blue-400" />;
  return <FileText className="w-4 h-4 text-zinc-400" />;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

export const WorkspaceBrowser: React.FC<WorkspaceBrowserProps> = ({ projectId }) => {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const { showToast } = useToast();

  const {
    data: filesData,
    isLoading: isFilesLoading,
    isFetching: isFilesFetching,
    refetch: refetchFiles,
  } = useWorkspaceFiles(projectId);

  const {
    data: contentData,
    isLoading: isContentLoading,
    isError: isContentError,
  } = useWorkspaceFileContent(projectId, selectedFile);

  const files = filesData?.files || [];

  // Automatically select the first file if none selected
  React.useEffect(() => {
    if (files.length > 0 && !selectedFile) {
      const firstFile = files.find((f) => !f.is_dir);
      if (firstFile) setSelectedFile(firstFile.path);
    }
  }, [files, selectedFile]);

  const copyFileContent = (content: string) => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    showToast('info', 'File Content Copied', `Copied ${selectedFile} to clipboard.`);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 overflow-hidden flex flex-col">
      {/* Header bar */}
      <div className="px-4 py-2.5 bg-zinc-900/80 border-b border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Folder className="w-4 h-4 text-indigo-400" />
          <span className="text-xs font-semibold text-zinc-200">
            Workspace Artifacts
          </span>
          <span className="text-[11px] font-mono text-zinc-500">
            /tmp/harness-ws-{projectId}
          </span>
        </div>

        <button
          onClick={() => refetchFiles()}
          className="p-1 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded transition-colors"
          title="Refresh workspace files"
        >
          <RotateCw className={`w-3.5 h-3.5 ${isFilesFetching ? 'animate-spin text-indigo-400' : ''}`} />
        </button>
      </div>

      {/* Browser Body */}
      {isFilesLoading ? (
        <div className="p-8 text-center text-xs text-zinc-500 flex items-center justify-center gap-2">
          <RotateCw className="w-4 h-4 animate-spin text-indigo-400" />
          <span>Scanning workspace directory...</span>
        </div>
      ) : files.length === 0 ? (
        <div className="p-8 text-center text-zinc-500 space-y-2">
          <Folder className="w-8 h-8 mx-auto text-zinc-700 stroke-1" />
          <p className="text-xs font-medium text-zinc-400">No workspace files created yet</p>
          <p className="text-[11px] text-zinc-600 max-w-xs mx-auto">
            Files written by the agent via <code className="text-zinc-400">write_file</code> will appear here automatically.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-12 min-h-[260px] divide-y md:divide-y-0 md:divide-x divide-zinc-800">
          
          {/* File List (Left sidebar - 4 cols) */}
          <div className="md:col-span-4 p-2 space-y-1 overflow-y-auto max-h-[360px]">
            {files.map((file) => {
              const isSelected = selectedFile === file.path;
              return (
                <button
                  key={file.path}
                  onClick={() => !file.is_dir && setSelectedFile(file.path)}
                  disabled={file.is_dir}
                  className={`w-full text-left px-2.5 py-1.5 rounded-lg flex items-center justify-between gap-2 text-xs transition-colors ${
                    isSelected
                      ? 'bg-indigo-950/60 text-indigo-200 border border-indigo-500/30 font-medium'
                      : 'text-zinc-300 hover:bg-zinc-900/80 hover:text-white'
                  } ${file.is_dir ? 'opacity-60 cursor-default' : 'cursor-pointer'}`}
                >
                  <div className="flex items-center gap-2 truncate">
                    {file.is_dir ? (
                      <Folder className="w-4 h-4 text-zinc-500 shrink-0" />
                    ) : (
                      getFileIcon(file.name)
                    )}
                    <span className="truncate font-mono">{file.path}</span>
                  </div>
                  {!file.is_dir && (
                    <span className="text-[10px] font-mono text-zinc-500 shrink-0">
                      {formatBytes(file.size)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Code Viewer (Right pane - 8 cols) */}
          <div className="md:col-span-8 flex flex-col bg-black/40 min-h-[220px]">
            {selectedFile ? (
              <>
                {/* Code file header */}
                <div className="px-3.5 py-2 border-b border-zinc-800/80 bg-zinc-900/40 flex items-center justify-between text-xs">
                  <span className="font-mono text-zinc-300 flex items-center gap-1.5 truncate">
                    <Code2 className="w-3.5 h-3.5 text-indigo-400" />
                    {selectedFile}
                  </span>

                  {contentData && !contentData.is_binary && (
                    <button
                      onClick={() => copyFileContent(contentData.content)}
                      className="inline-flex items-center gap-1 text-[11px] text-zinc-400 hover:text-zinc-200 px-2 py-0.5 rounded bg-zinc-800/60 border border-zinc-700/50 hover:bg-zinc-700/60 transition-colors"
                    >
                      {copied ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span className="text-emerald-300">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copy code</span>
                        </>
                      )}
                    </button>
                  )}
                </div>

                {/* Content preview */}
                <div className="p-3.5 font-mono text-xs overflow-x-auto max-h-[320px] flex-1">
                  {isContentLoading ? (
                    <div className="text-zinc-500 flex items-center gap-2 py-4">
                      <RotateCw className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                      <span>Loading file content...</span>
                    </div>
                  ) : isContentError ? (
                    <div className="text-rose-400 flex items-center gap-2 py-2">
                      <AlertCircle className="w-4 h-4" />
                      <span>Could not read file from workspace.</span>
                    </div>
                  ) : contentData?.is_binary ? (
                    <div className="text-zinc-500 py-6 text-center italic">
                      [Binary file cannot be displayed]
                    </div>
                  ) : (
                    <pre className="text-zinc-200 leading-relaxed whitespace-pre font-mono">
                      {contentData?.content.split('\n').map((line, idx) => (
                        <div key={idx} className="table-row">
                          <span className="table-cell pr-4 select-none text-zinc-600 text-[11px] text-right">
                            {idx + 1}
                          </span>
                          <span className="table-cell">{line}</span>
                        </div>
                      ))}
                    </pre>
                  )}
                </div>
              </>
            ) : (
              <div className="p-8 text-center text-zinc-600 text-xs my-auto">
                Select a file from the list to view its code
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  );
};
