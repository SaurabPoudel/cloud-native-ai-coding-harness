export type TaskStatus = 'pending' | 'running' | 'done' | 'failed' | 'cancelled';

export interface HealthResponse {
  status: string;
  db: string;
  pending_count: number;
}

export interface SubmitTaskPayload {
  name: string;
  prompt: string;
}

export interface SubmitTaskResponse {
  id: number;
  status: string;
}

export interface CancelTaskResponse {
  id: number;
  status: string;
  message: string;
}

export interface DeleteTaskResponse {
  id: number;
  deleted: boolean;
  message: string;
}

export interface CleanupTasksResponse {
  deleted_count: number;
  deleted_ids: number[];
  message: string;
}

export interface WorkspaceFileInfo {
  name: string;
  path: string;
  size: number;
  modified_at: string;
  is_dir: boolean;
}

export interface WorkspaceFilesResponse {
  project_id: number;
  workspace_path: string;
  files: WorkspaceFileInfo[];
}

export interface WorkspaceFileContentResponse {
  project_id: number;
  path: string;
  content: string;
  size: number;
  is_binary: boolean;
}

export interface ProjectTask {
  id: number;
  name: string;
  status: TaskStatus;
  attempts: number;
  last_error: string | null;
  created_at: string;
  locked_at: string | null;
  locked_by: string | null;
  // prompt is stored in DB if retrieved, but in status response model:
  prompt?: string;
}

export interface ApiError {
  message: string;
  statusCode?: number;
  detail?: string | object;
}
