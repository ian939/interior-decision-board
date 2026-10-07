import type {
  CardDetail,
  DashboardResponse,
  PlannerItem,
  PlannerLayout,
  PreferenceValue,
  SessionResponse,
  Space,
  TransitionInput,
  UserSummary,
  WorkRequest,
} from "@interior/shared";

const API_BASE = (import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8787/api").replace(/\/$/, "");
const API_ORIGIN = new URL(API_BASE).origin;
const TOKEN_KEY = "interior-decision-token";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
  ) {
    super(message);
  }
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

async function request<T>(path: string, init: RequestInit = {}, authenticated = true): Promise<T> {
  const headers = new Headers(init.headers);
  const token = getToken();
  if (authenticated && token) headers.set("authorization", `Bearer ${token}`);
  if (init.body && !(init.body instanceof FormData) && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  const response = await fetch(`${API_BASE}${path}`, { ...init, headers });
  if (!response.ok) {
    let payload: { error?: string; code?: string } = {};
    try {
      payload = (await response.json()) as typeof payload;
    } catch {
      payload = {};
    }
    if (response.status === 401 && authenticated) window.dispatchEvent(new Event("interior:unauthorized"));
    throw new ApiError(payload.error ?? `요청 실패 (${response.status})`, response.status, payload.code);
  }
  const contentType = response.headers.get("content-type") ?? "";
  return (contentType.includes("json") ? await response.json() : await response.text()) as T;
}

export const api = {
  setupStatus: () => request<{ setupRequired: boolean }>("/setup/status", {}, false),
  login: (role: "owner" | "partner", password: string) =>
    request<SessionResponse>("/auth/login", { method: "POST", body: JSON.stringify({ role, password }) }, false),
  me: () => request<{ user: UserSummary }>("/auth/me"),
  health: () =>
    request<{
      ok: boolean;
      setupRequired: boolean;
      queue: { queued: number; processing: number; failed: number };
      telegramConfigured: boolean;
    }>("/health", {}, false),
  dashboard: () => request<DashboardResponse>("/dashboard"),
  card: (id: string) => request<CardDetail>(`/cards/${id}`),
  addUrl: (url: string, note?: string) =>
    request<CardDetail>("/cards/url", { method: "POST", body: JSON.stringify({ url, note: note || undefined }) }),
  addFile: (file: File, note?: string) => {
    const form = new FormData();
    form.append("file", file);
    const query = note ? `?note=${encodeURIComponent(note)}` : "";
    return request<CardDetail>(`/cards/file${query}`, { method: "POST", body: form });
  },
  updateCard: (id: string, input: { title?: string; summary?: string | null; topicTags?: string[]; spaceIds?: string[] }) =>
    request<CardDetail>(`/cards/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
  deleteCard: (id: string) => request<{ ok: true }>(`/cards/${id}`, { method: "DELETE" }),
  transition: (id: string, input: TransitionInput) =>
    request<CardDetail>(`/cards/${id}/transition`, { method: "POST", body: JSON.stringify(input) }),
  comment: (id: string, body: string) =>
    request(`/cards/${id}/comments`, { method: "POST", body: JSON.stringify({ body }) }),
  preference: (id: string, value: PreferenceValue | null) =>
    request(`/cards/${id}/preference`, { method: "PUT", body: JSON.stringify({ value }) }),
  addRelatedUrl: (id: string, url: string) =>
    request(`/cards/${id}/related/url`, { method: "POST", body: JSON.stringify({ url }) }),
  addRelatedFile: (id: string, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return request(`/cards/${id}/related/file`, { method: "POST", body: form });
  },
  compare: (id: string) => request(`/cards/${id}/compare`, { method: "POST" }),
  workRequestDraft: (id: string) => request<{ content: string }>(`/cards/${id}/work-request-draft`, { method: "POST" }),
  workRequests: () => request<{ items: WorkRequest[] }>("/work-requests"),
  updateWorkRequest: (id: string, input: { title?: string; body?: string; completed?: boolean }) =>
    request<WorkRequest>(`/work-requests/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
  plannerLayouts: () => request<{ layouts: PlannerLayout[] }>("/planner/layouts"),
  addPlannerLayout: (name: string, items: PlannerItem[] = []) =>
    request<PlannerLayout>("/planner/layouts", { method: "POST", body: JSON.stringify({ name, items }) }),
  updatePlannerLayout: (id: string, input: { name?: string; items?: PlannerItem[] }) =>
    request<PlannerLayout>(`/planner/layouts/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
  deletePlannerLayout: (id: string) => request<{ ok: true }>(`/planner/layouts/${id}`, { method: "DELETE" }),
  spaces: () => request<{ spaces: Space[] }>("/spaces"),
  addSpace: (name: string) => request<Space>("/spaces", { method: "POST", body: JSON.stringify({ name }) }),
  updateSpace: (id: string, input: { name?: string; active?: boolean; sortOrder?: number }) =>
    request<Space>(`/spaces/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
};

export function mediaUrl(path: string | null): string | null {
  if (!path) return null;
  if (!path.startsWith("/api/files/")) return path;
  const token = getToken();
  return `${API_ORIGIN}${path}${token ? `?access_token=${encodeURIComponent(token)}` : ""}`;
}

export async function downloadExport(format: "markdown" | "csv"): Promise<void> {
  const token = getToken();
  const response = await fetch(`${API_BASE}/work-requests/export?format=${format}`, {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) throw new ApiError("내보내기에 실패했습니다.", response.status);
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `interior-work-requests.${format === "csv" ? "csv" : "md"}`;
  anchor.click();
  URL.revokeObjectURL(url);
}
