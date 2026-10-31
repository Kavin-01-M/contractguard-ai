import type {
  AuditEvent,
  Bootstrap,
  Deadline,
  DocumentRecord,
  Finding,
  GraphEdge,
  GraphNode,
  Obligation,
  Task,
} from "../types/domain";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, {
    credentials: "include",
    ...init,
    headers: {
      ...(init?.body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      ...init?.headers,
    },
  });
  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const body = await response.json();
      message =
        typeof body.detail === "string"
          ? body.detail
          : body.detail?.message || message;
    } catch {
      /* keep status message */
    }
    throw new ApiError(message, response.status);
  }
  return response.json() as Promise<T>;
}
export const api = {
  health: () =>
    request<{
      status: string;
      database: string;
      semantic_search: string;
      auth_mode: string;
    }>("/health"),
  auth: () =>
    request<{
      authenticated: boolean;
      login_required?: boolean;
      demo_mode?: boolean;
      user?: { name: string; email?: string; role?: string; demo: boolean };
    }>("/auth/me"),
  login: (payload: {
    email?: string;
    password?: string;
    name?: string;
    role?: string;
  }) =>
    request<{
      ok: boolean;
      user: {
        open_id: string;
        name: string;
        email: string;
        role: string;
        demo: boolean;
      };
    }>("/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  logout: () =>
    request<{ ok: boolean }>("/auth/logout", {
      method: "POST",
    }),
  bootstrap: () => request<Bootstrap>("/bootstrap"),
  documents: (q = "", type = "") =>
    request<DocumentRecord[]>(
      `/documents?q=${encodeURIComponent(q)}&document_type=${encodeURIComponent(type)}`,
    ),
  document: (id: string) => request<DocumentRecord>(`/documents/${id}`),
  obligations: (q = "") =>
    request<Obligation[]>(`/obligations?q=${encodeURIComponent(q)}`),
  findings: (status = "") =>
    request<Finding[]>(
      `/findings${status ? `?status=${encodeURIComponent(status)}` : ""}`,
    ),
  finding: (id: string) => request<Finding>(`/findings/${id}`),
  deadlines: () => request<Deadline[]>("/deadlines"),
  tasks: () => request<Task[]>("/tasks"),
  audit: () => request<AuditEvent[]>("/audit"),
  graph: () => request<{ nodes: GraphNode[]; edges: GraphEdge[] }>("/graph"),
  analyze: () =>
    request<{
      ok: boolean;
      contracts: number;
      new_obligations: number;
      new_findings: number;
      message: string;
    }>("/analyze", { method: "POST" }),
  loadDemo: () =>
    request<{
      ok: boolean;
      documents: number;
      obligations: number;
      findings: number;
      message: string;
    }>("/demo/load", { method: "POST" }),
  deleteDocument: (id: string) =>
    request<{ ok: boolean; message: string }>(`/documents/${id}`, {
      method: "DELETE",
    }),
  createTask: (payload: Partial<Task>) =>
    request<Task>("/tasks", { method: "POST", body: JSON.stringify(payload) }),
  updateTask: (id: string, payload: Partial<Task> & { comment?: string }) =>
    request<Task>(`/tasks/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  reviewFinding: (
    id: string,
    payload: { decision: string; reason?: string; severity?: string },
  ) =>
    request<Finding>(`/findings/${id}/review`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  triggerDeadline: (id: string, trigger_date: string) =>
    request<Deadline>(`/deadlines/${id}/trigger`, {
      method: "POST",
      body: JSON.stringify({ trigger_date }),
    }),
  copilot: (id: string, question: string) =>
    request<{
      answer: string;
      citations: Array<{
        document_name: string;
        quote: string;
        section: string | null;
        page_number: number | null;
        role: string;
      }>;
      mode: string;
    }>(`/copilot?finding_id=${encodeURIComponent(id)}`, {
      method: "POST",
      body: JSON.stringify({ question }),
    }),
};
export function uploadFile(
  file: File,
  type: string,
  onProgress: (value: number) => void,
): Promise<DocumentRecord> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(
      "POST",
      `/api/documents?document_type=${encodeURIComponent(type)}`,
    );
    xhr.withCredentials = true;
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable)
        onProgress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300)
        resolve(JSON.parse(xhr.responseText) as DocumentRecord);
      else {
        try {
          const detail = JSON.parse(xhr.responseText).detail;
          reject(
            new Error(
              typeof detail === "string"
                ? detail
                : detail?.message || `Upload failed (${xhr.status})`,
            ),
          );
        } catch {
          reject(new Error(`Upload failed (${xhr.status})`));
        }
      }
    };
    xhr.onerror = () =>
      reject(new Error("Upload network error. Check that the API is running."));
    const form = new FormData();
    form.append("file", file);
    xhr.send(form);
  });
}
