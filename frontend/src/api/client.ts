import {
  Task,
  DocumentItem,
  Annotation,
  AgreementSummary,
  ConsensusRecord,
  AuditLogEntry,
  BenchmarkReport,
  User,
} from '../types/api';

let inMemoryToken: string | null = null;

export const setAuthToken = (token: string | null) => {
  inMemoryToken = token;
};

export const getAuthToken = (): string | null => {
  return inMemoryToken;
};

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  headers.set('Accept', 'application/json');

  if (inMemoryToken) {
    headers.set('Authorization', `Bearer ${inMemoryToken}`);
  }

  if (options.body && typeof options.body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const fullUrl = path.startsWith('http')
    ? path
    : (typeof window !== 'undefined' && window.location && window.location.origin ? window.location.origin : 'http://127.0.0.1:3000') + path;

  const response = await fetch(fullUrl, { ...options, headers });

  if (!response.ok) {
    let errorDetail = `HTTP ${response.status} ${response.statusText}`;
    try {
      const errJson = await response.json();
      if (errJson.detail) {
        errorDetail = typeof errJson.detail === 'string' ? errJson.detail : JSON.stringify(errJson.detail);
      }
    } catch {
      // Ignore JSON parse failure
    }
    throw new Error(errorDetail);
  }

  return response.json();
}

export const api = {
  auth: {
    getConfig: () => request<any>('/api/auth/config'),
    getDemoToken: (role: string, username: string, email: string) =>
      request<{ access_token: string; role: string; username: string }>('/api/auth/demo-token', {
        method: 'POST',
        body: JSON.stringify({ role, username, email }),
      }),
    getMe: () => request<User>('/api/auth/me'),
    logout: () => request<any>('/api/auth/logout', { method: 'POST' }),
  },
  tasks: {
    list: (taskType?: string) =>
      request<Task[]>(taskType ? `/api/tasks?task_type=${encodeURIComponent(taskType)}` : '/api/tasks'),
    create: (data: { name: string; task_type: string; description?: string; guidelines?: string; labels_schema: string[] }) =>
      request<Task>('/api/tasks', { method: 'POST', body: JSON.stringify(data) }),
    get: (id: string) => request<Task>(`/api/tasks/${id}`),
    delete: (id: string) => request<{ status: string }>(`/api/tasks/${id}`, { method: 'DELETE' }),
    addDocuments: (taskId: string, docs: Array<{ text: string; metadata?: any }>) =>
      request<{ status: string; count: number }>(`/api/tasks/${taskId}/documents`, {
        method: 'POST',
        body: JSON.stringify({ documents: docs }),
      }),
    listDocuments: (taskId: string) => request<DocumentItem[]>(`/api/tasks/${taskId}/documents`),
  },
  annotations: {
    submit: (data: any) => request<Annotation>('/api/annotations', { method: 'POST', body: JSON.stringify(data) }),
    list: (taskId: string, documentId?: string) => {
      let url = `/api/annotations?task_id=${taskId}`;
      if (documentId) url += `&document_id=${documentId}`;
      return request<Annotation[]>(url);
    },
    batchImport: (taskId: string, annotations: any[]) =>
      request<any>('/api/annotations/batch', {
        method: 'POST',
        body: JSON.stringify({ task_id: taskId, annotations }),
      }),
  },
  agreement: {
    getTaskSummary: (taskId: string) => request<AgreementSummary>(`/api/agreement/tasks/${taskId}`),
    getDocumentDetails: (docId: string) => request<any>(`/api/agreement/documents/${docId}`),
  },
  reconciliation: {
    autoReconcile: (taskId: string, strategy: string) =>
      request<any>(`/api/reconciliation/auto/${taskId}`, {
        method: 'POST',
        body: JSON.stringify({ strategy, auto_approve: true }),
      }),
    manualConsensus: (docId: string, data: any) =>
      request<ConsensusRecord>(`/api/reconciliation/documents/${docId}`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    listConsensus: (taskId: string) => request<ConsensusRecord[]>(`/api/reconciliation/tasks/${taskId}`),
  },
  evaluation: {
    getBenchmark: () => request<BenchmarkReport>('/api/evaluation/benchmark'),
    runBenchmark: () => request<BenchmarkReport>('/api/evaluation/benchmark/run', { method: 'POST' }),
  },
  advisory: {
    getStatus: () => request<any>('/api/advisory/status'),
    diagnose: (data: any) => request<any>('/api/advisory/diagnose', { method: 'POST', body: JSON.stringify(data) }),
  },
  audit: {
    list: () => request<AuditLogEntry[]>('/api/audit'),
  },
};
