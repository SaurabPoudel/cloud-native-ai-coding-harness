export type TaskStatus = 'pending' | 'running' | 'done' | 'failed';

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
