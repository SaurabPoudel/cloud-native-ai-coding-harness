import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, SubmitTaskPayload } from '../api';
import { useToast } from '../context/ToastContext';

export const HARNESS_QUERY_KEYS = {
  health: ['health'] as const,
  projects: ['projects'] as const,
  projectStatus: (id: number) => ['project', id] as const,
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
