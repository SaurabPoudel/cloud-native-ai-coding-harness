import {
  HealthResponse,
  ProjectTask,
  SubmitTaskPayload,
  SubmitTaskResponse,
} from './types';

// Use environment variable if provided, otherwise default to relative path for Vite proxy
// or http://localhost:8000 if running directly
const API_BASE_URL = import.meta.env.VITE_API_URL ?? '';

export class ApiError extends Error {
  statusCode: number;
  detail: unknown;

  constructor(message: string, statusCode: number, detail?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.detail = detail;
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const defaultHeaders: HeadersInit = {
    'Accept': 'application/json',
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
  };

  const config: RequestInit = {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  };

  let response: Response;
  try {
    response = await fetch(url, config);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Network request failed';
    throw new ApiError(
      `Cannot connect to harness backend at ${url}. Ensure FastAPI is running on port 8000. (${message})`,
      0
    );
  }

  if (!response.ok) {
    let errorDetail: unknown = null;
    let errorMessage = `Request failed with status ${response.status}`;
    try {
      const data = await response.json();
      errorDetail = data;
      if (typeof data === 'object' && data !== null && 'detail' in data) {
        errorMessage = typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail);
      }
    } catch {
      // response wasn't JSON
    }
    throw new ApiError(errorMessage, response.status, errorDetail);
  }

  return response.json() as Promise<T>;
}

export const api = {
  /**
   * Health check for FastAPI server and DB ping
   */
  getHealth: async (): Promise<HealthResponse> => {
    return request<HealthResponse>('/health');
  },

  /**
   * Submit a new coding agent task
   */
  submitTask: async (payload: SubmitTaskPayload): Promise<SubmitTaskResponse> => {
    return request<SubmitTaskResponse>('/submit', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  /**
   * Retrieve list of recent project tasks
   */
  getProjects: async (limit: number = 20): Promise<ProjectTask[]> => {
    return request<ProjectTask[]>(`/projects?limit=${limit}`);
  },

  /**
   * Retrieve single project state by ID
   */
  getProjectStatus: async (id: number): Promise<ProjectTask> => {
    return request<ProjectTask>(`/status/${id}`);
  },
};
