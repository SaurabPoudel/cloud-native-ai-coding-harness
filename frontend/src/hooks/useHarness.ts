import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, SubmitTaskPayload } from '../api';
import { useToast } from '../context/ToastContext';

export const HARNESS_QUERY_KEYS = {
  health: ['health'] as const,
  projects: ['projects'] as const,
  projectStatus: (id: number) => ['project', id] as const,
  workspaceFiles: (id: number) => ['workspace-files', id] as const,
  workspaceFileContent: (id: number, path: string) => ['workspace-file-content', id, path] as const,
};

/**
 * Hook to poll system health and pending count
 */
export function useHealth() {
  return useQuery({
    queryKey: HARNESS_QUERY_KEYS.health,
    queryFn: () => api.getHealth(),
    refetchInterval: 5000,
    retry: 1,
    refetchOnWindowFocus: true,
  });
}

/**
 * Hook to fetch and poll recent projects (auto-refresh every 3 seconds)
 */
export function useProjects(limit: number = 50) {
  return useQuery({
    queryKey: [...HARNESS_QUERY_KEYS.projects, limit],
    queryFn: () => api.getProjects(limit),
    refetchInterval: 3000, // Explicit requirement: 3s polling
    refetchOnWindowFocus: true,
  });
}

/**
 * Hook to fetch status for a specific project
 */
export function useProjectStatus(id: number | null) {
  return useQuery({
    queryKey: id ? HARNESS_QUERY_KEYS.projectStatus(id) : ['project', 'none'],
    queryFn: () => (id ? api.getProjectStatus(id) : Promise.reject('No ID')),
    enabled: id !== null,
    refetchInterval: (query) => {
      // Poll faster if project is running or pending
      const status = query.state.data?.status;
      return status === 'running' || status === 'pending' ? 3000 : false;
    },
  });
}

/**
 * Mutation hook to submit a new agent task with cache invalidation
 */
export function useSubmitTask() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: (payload: SubmitTaskPayload) => api.submitTask(payload),
    onSuccess: (data, variables) => {
      // Immediately invalidate and refetch projects and health
      queryClient.invalidateQueries({ queryKey: HARNESS_QUERY_KEYS.projects });
      queryClient.invalidateQueries({ queryKey: HARNESS_QUERY_KEYS.health });

      showToast(
        'success',
        'Agent Task Dispatched',
        `Task #${data.id} "${variables.name}" queued into the harness.`
      );
    },
    onError: (error: Error) => {
      showToast(
        'error',
        'Failed to Deploy Agent',
        error.message || 'An unknown error occurred while submitting task.'
      );
    },
  });
}

/**
 * Mutation hook to cancel a task
 */
export function useCancelTask() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: (id: number) => api.cancelTask(id),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: HARNESS_QUERY_KEYS.projects });
      queryClient.invalidateQueries({ queryKey: HARNESS_QUERY_KEYS.health });
      queryClient.invalidateQueries({ queryKey: HARNESS_QUERY_KEYS.projectStatus(data.id) });

      showToast(
        'warning',
        'Task Cancelled',
        `Task #${data.id} has been marked as cancelled.`
      );
    },
    onError: (error: Error) => {
      showToast(
        'error',
        'Cancellation Failed',
        error.message || 'Could not cancel the task.'
      );
    },
  });
}

/**
 * Mutation hook to delete a task and clean up workspace
 */
export function useDeleteTask() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: (id: number) => api.deleteTask(id),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: HARNESS_QUERY_KEYS.projects });
      queryClient.invalidateQueries({ queryKey: HARNESS_QUERY_KEYS.health });

      showToast(
        'success',
        'Task Deleted',
        `Task #${data.id} and its workspace have been removed.`
      );
    },
    onError: (error: Error) => {
      showToast(
        'error',
        'Delete Failed',
        error.message || 'Could not delete the task.'
      );
    },
  });
}

/**
 * Mutation hook to bulk clean up tasks
 */
export function useCleanupTasks() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: (target: 'smoke' | 'done' | 'failed' | 'cancelled' | 'all') =>
      api.cleanupTasks(target),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: HARNESS_QUERY_KEYS.projects });
      queryClient.invalidateQueries({ queryKey: HARNESS_QUERY_KEYS.health });

      showToast(
        'success',
        'Cleanup Complete',
        data.message || `Deleted ${data.deleted_count} tasks.`
      );
    },
    onError: (error: Error) => {
      showToast(
        'error',
        'Cleanup Failed',
        error.message || 'Could not purge tasks.'
      );
    },
  });
}

/**
 * Hook to list files in a project's workspace
 */
export function useWorkspaceFiles(projectId: number | null) {
  return useQuery({
    queryKey: projectId ? HARNESS_QUERY_KEYS.workspaceFiles(projectId) : ['workspace-files', 'none'],
    queryFn: () => (projectId ? api.getWorkspaceFiles(projectId) : Promise.reject('No ID')),
    enabled: projectId !== null,
    refetchInterval: (query) => {
      // Refresh files periodically if drawer is open
      return 4000;
    },
  });
}

/**
 * Hook to retrieve text content of a single workspace file
 */
export function useWorkspaceFileContent(projectId: number | null, path: string | null) {
  return useQuery({
    queryKey:
      projectId && path
        ? HARNESS_QUERY_KEYS.workspaceFileContent(projectId, path)
        : ['workspace-file-content', 'none', 'none'],
    queryFn: () =>
      projectId && path
        ? api.getWorkspaceFileContent(projectId, path)
        : Promise.reject('Missing params'),
    enabled: Boolean(projectId && path),
  });
}
