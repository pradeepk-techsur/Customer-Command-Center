import type { CallOrderAwardPreview, CallOrderSetupInput, PortalSnapshot, Role, WeeklyReportInput } from "../shared/types.ts";

// Authentication tokens stored in memory and localStorage
let accessToken: string | null = null;
let refreshToken: string | null = null;
let refreshTimer: ReturnType<typeof setTimeout> | null = null;

export const SESSION_EXPIRED_EVENT = "portal:session-expired";

function tokenExpiry(token: string | null): number | null {
  if (!token || typeof window === "undefined") return null;
  try {
    const encoded = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(window.atob(encoded.padEnd(Math.ceil(encoded.length / 4) * 4, "="))) as { exp?: number };
    return payload.exp ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

function expireSession() {
  const hadSession = !!accessToken || !!refreshToken;
  clearTokens();
  if (hadSession && typeof window !== "undefined") window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
}

function scheduleTokenRefresh() {
  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = null;
  const expiresAt = tokenExpiry(accessToken);
  if (!expiresAt || typeof window === "undefined") return;
  const delay = Math.max(0, Math.min(expiresAt - Date.now() - 5_000, 2_147_483_647));
  refreshTimer = setTimeout(async () => {
    refreshTimer = null;
    if (!await tryRefreshToken()) expireSession();
  }, delay);
}

export function setTokens(access: string, refresh: string) {
  accessToken = access;
  refreshToken = refresh;
  localStorage.setItem("accessToken", access);
  localStorage.setItem("refreshToken", refresh);
  scheduleTokenRefresh();
}

export function clearTokens() {
  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = null;
  accessToken = null;
  refreshToken = null;
  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");
}

export function getAccessToken() {
  return accessToken;
}

export function getRefreshToken() {
  return refreshToken;
}

// Legacy function for backward compatibility (unused in authenticated mode)
let role: Role = "customer";
let user = "";
export function setActor(nextRole: Role, nextUser = "") { role = nextRole; user = nextUser; }

async function request<T = PortalSnapshot>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers || {});
  
  // Use JWT authentication if token is available
  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  } else {
    // Fallback to mock headers for backward compatibility
    headers.set("x-portal-role", role);
    if (user) headers.set("x-portal-user", user);
  }
  
  if (init.body && !(init.body instanceof FormData)) headers.set("content-type", "application/json");
  
  const res = await fetch(path, { ...init, headers });
  
  // Refresh once on an expired access token. If the refresh credential or server session has
  // expired, notify the app immediately so it cannot keep rendering a stale authenticated UI.
  if (res.status === 401) {
    if (refreshToken && await tryRefreshToken()) {
      headers.set("Authorization", `Bearer ${accessToken}`);
      const retryRes = await fetch(path, { ...init, headers });
      const retryBody = await retryRes.json().catch(() => null);
      if (retryRes.status === 401) {
        expireSession();
        throw new Error("Session expired. Please log in again.");
      }
      if (!retryRes.ok) throw new Error((retryBody && retryBody.error) || `Request failed (${retryRes.status}).`);
      return retryBody as T;
    }
    expireSession();
    throw new Error("Session expired. Please log in again.");
  }
  
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error((body && body.error) || `Request failed (${res.status}).`);
  return body as T;
}

async function tryRefreshToken(): Promise<boolean> {
  if (!refreshToken) return false;
  
  try {
    const res = await fetch("/api/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    
    if (!res.ok) return false;
    
    const data = await res.json();
    if (data.accessToken) {
      accessToken = data.accessToken;
      localStorage.setItem("accessToken", data.accessToken);
      scheduleTokenRefresh();
      return true;
    }
    
    return false;
  } catch {
    return false;
  }
}

if (typeof window !== "undefined") {
  accessToken = localStorage.getItem("accessToken");
  refreshToken = localStorage.getItem("refreshToken");
  scheduleTokenRefresh();
}

const json = (v: unknown) => JSON.stringify(v);
const files = (list: FileList | File[], extra: Record<string, string> = {}) => {
  const fd = new FormData();
  for (const f of Array.from(list)) fd.append("files", f);
  for (const [k, v] of Object.entries(extra)) fd.append(k, v);
  return fd;
};
const enc = encodeURIComponent;

/** "bpa" scope segment for BPA-level (call_order_id null) records. */
const scope = (callOrderId: string | null) => enc(callOrderId ?? "bpa");

export const api = {
  snapshot: () => request("/api/portal"),
  previewCallOrderAward: (award: File) => {
    const body = new FormData(); body.append("award", award);
    return request<CallOrderAwardPreview>("/api/call-orders/award-preview", { method: "POST", body });
  },
  createCallOrder: (input: CallOrderSetupInput, award?: File) => {
    const body = new FormData();
    body.append("details", JSON.stringify(input));
    if (award) body.append("award", award);
    return request<PortalSnapshot>("/api/call-orders", { method: "POST", body });
  },
  saveSpend: (id: string, spend: string) => request(`/api/call-orders/${enc(id)}/spend`, { method: "PATCH", body: json({ spend }) }),
  saveDescription: (id: string, description: string) => request(`/api/call-orders/${enc(id)}/description`, { method: "PATCH", body: json({ description }) }),
  saveNarrative: (id: string, narrative: string) => request(`/api/call-orders/${enc(id)}/narrative`, { method: "PATCH", body: json({ narrative }) }),
  saveCallOrderSetup: (id: string, input: CallOrderSetupInput) =>
    request(`/api/call-orders/${enc(id)}/setup`, { method: "PATCH", body: json(input) }),
  addCallOrderPeriod: (groupKey: string, input: { popStart: string; popEnd: string; funded?: string }) =>
    request(`/api/call-orders/${enc(groupKey)}/periods`, { method: "POST", body: json(input) }),
  addStaff: (id: string, input: { name: string; laborCategory: string; rate: string }) =>
    request(`/api/call-orders/${enc(id)}/staff`, { method: "POST", body: json(input) }),
  setStaffStatus: (staffId: number, status: string) => request(`/api/staff/${staffId}`, { method: "PATCH", body: json({ status }) }),
  updateStaff: (staffId: number, input: { name?: string; laborCategory?: string; rate?: string; status?: string }) =>
    request(`/api/staff/${staffId}`, { method: "PATCH", body: json(input) }),
  removeStaff: (staffId: number) => request(`/api/staff/${staffId}`, { method: "DELETE" }),

  // CLINs
  addClin: (callOrderId: string | null, input: { name: string; fundedAmount: string }) =>
    request(`/api/scope/${scope(callOrderId)}/clins`, { method: "POST", body: json(input) }),
  updateClin: (callOrderId: string | null, clinId: number, input: { name?: string; fundedAmount?: string }) =>
    request(`/api/scope/${scope(callOrderId)}/clins/${clinId}`, { method: "PATCH", body: json(input) }),
  removeClin: (callOrderId: string | null, clinId: number) =>
    request(`/api/scope/${scope(callOrderId)}/clins/${clinId}`, { method: "DELETE" }),
  setClinMonthlySpend: (callOrderId: string | null, clinId: number, month: string, input: { projectedAmount?: string; actualAmount?: string }) =>
    request(`/api/scope/${scope(callOrderId)}/clins/${clinId}/monthly-spend/${month}`, { method: "PUT", body: json(input) }),

  // Invoices
  addInvoice: (callOrderId: string | null, input: FormData) =>
    request(`/api/scope/${scope(callOrderId)}/invoices`, { method: "POST", body: input }),
  updateInvoice: (callOrderId: string | null, invoiceId: number, input: { paymentStatus?: string; paidDate?: string }) =>
    request(`/api/scope/${scope(callOrderId)}/invoices/${invoiceId}`, { method: "PATCH", body: json(input) }),
  removeInvoice: (callOrderId: string | null, invoiceId: number) =>
    request(`/api/scope/${scope(callOrderId)}/invoices/${invoiceId}`, { method: "DELETE" }),

  // Contract documents (award + mods)
  addContractDocument: (callOrderId: string | null, input: FormData) =>
    request(`/api/scope/${scope(callOrderId)}/contract-documents`, { method: "POST", body: input }),
  updateContractDocument: (callOrderId: string | null, documentId: number, input: Record<string, string>) =>
    request(`/api/scope/${scope(callOrderId)}/contract-documents/${documentId}`, { method: "PATCH", body: json(input) }),
  removeContractDocument: (callOrderId: string | null, documentId: number) =>
    request(`/api/scope/${scope(callOrderId)}/contract-documents/${documentId}`, { method: "DELETE" }),

  // Deliverables
  addDeliverable: (callOrderId: string | null, input: FormData) =>
    request(`/api/scope/${scope(callOrderId)}/deliverables`, { method: "POST", body: input }),
  updateDeliverable: (callOrderId: string | null, deliverableId: number, input: Record<string, string>) =>
    request(`/api/scope/${scope(callOrderId)}/deliverables/${deliverableId}`, { method: "PATCH", body: json(input) }),
  removeDeliverable: (callOrderId: string | null, deliverableId: number) =>
    request(`/api/scope/${scope(callOrderId)}/deliverables/${deliverableId}`, { method: "DELETE" }),

  // Risks & Issues
  addRisk: (callOrderId: string | null, input: { description: string; probability: string; impact: string; mitigation?: string }) =>
    request(`/api/scope/${scope(callOrderId)}/risks-issues/risks`, { method: "POST", body: json(input) }),
  updateRisk: (callOrderId: string | null, riskId: number, input: Record<string, string>) =>
    request(`/api/scope/${scope(callOrderId)}/risks-issues/risks/${riskId}`, { method: "PATCH", body: json(input) }),
  removeRisk: (callOrderId: string | null, riskId: number) =>
    request(`/api/scope/${scope(callOrderId)}/risks-issues/risks/${riskId}`, { method: "DELETE" }),
  addIssue: (callOrderId: string | null, input: { description: string; assignedTo?: string }) =>
    request(`/api/scope/${scope(callOrderId)}/risks-issues/issues`, { method: "POST", body: json(input) }),
  updateIssue: (callOrderId: string | null, issueId: number, input: Record<string, string>) =>
    request(`/api/scope/${scope(callOrderId)}/risks-issues/issues/${issueId}`, { method: "PATCH", body: json(input) }),
  removeIssue: (callOrderId: string | null, issueId: number) =>
    request(`/api/scope/${scope(callOrderId)}/risks-issues/issues/${issueId}`, { method: "DELETE" }),

  // Action items
  addActionItem: (callOrderId: string | null, input: { name: string; description?: string; dateAssigned?: string; weeklyReportId?: number }) =>
    request(`/api/scope/${scope(callOrderId)}/action-items`, { method: "POST", body: json(input) }),
  updateActionItem: (callOrderId: string | null, actionItemId: number, input: Record<string, string>) =>
    request(`/api/scope/${scope(callOrderId)}/action-items/${actionItemId}`, { method: "PATCH", body: json(input) }),
  removeActionItem: (callOrderId: string | null, actionItemId: number) =>
    request(`/api/scope/${scope(callOrderId)}/action-items/${actionItemId}`, { method: "DELETE" }),
  async searchClosedActionItems(q: string) {
    const res = await fetch(`/api/action-items/archive?q=${enc(q)}`, {
      headers: accessToken ? { "Authorization": `Bearer ${accessToken}` } : {},
    });
    if (!res.ok) throw new Error("Failed to search action items");
    return res.json();
  },

  // Staffing
  updateStaffContact: (staffId: number, input: Record<string, string>) =>
    request(`/api/staffing/${staffId}/contact`, { method: "PATCH", body: json(input) }),
  uploadPropertyReturn: (staffId: number, file: File) => {
    const fd = new FormData(); fd.append("file", file);
    return request(`/api/staffing/${staffId}/property-return`, { method: "POST", body: fd });
  },
  addStaffEquipment: (staffId: number, input: { makeModel: string; propertyTagNumber?: string }) =>
    request(`/api/staffing/${staffId}/equipment`, { method: "POST", body: json(input) }),
  removeStaffEquipment: (equipmentId: number) => request(`/api/staffing/equipment/${equipmentId}`, { method: "DELETE" }),
  setLcatVacancyStatus: (lcatId: number, vacancyStatus: string) =>
    request(`/api/staffing/labor-categories/${lcatId}/vacancy-status`, { method: "PATCH", body: json({ vacancyStatus }) }),
  addLcat: (callOrderId: string, input: { name: string; fte: string; hours: string; rate: string }) =>
    request(`/api/staffing/call-orders/${enc(callOrderId)}/labor-categories`, { method: "POST", body: json(input) }),
  updateLcat: (lcatId: number, input: { name?: string; fte?: string; hours?: string; rate?: string }) =>
    request(`/api/staffing/labor-categories/${lcatId}`, { method: "PATCH", body: json(input) }),
  removeLcat: (lcatId: number) => request(`/api/staffing/labor-categories/${lcatId}`, { method: "DELETE" }),
  createWeekly: (id: string, input: WeeklyReportInput) => request(`/api/call-orders/${enc(id)}/weekly-reports`, { method: "POST", body: json(input) }),
  uploadWeekly: (id: string, list: FileList) => request(`/api/call-orders/${enc(id)}/weekly-reports/upload`, { method: "POST", body: files(list) }),
  editWeekly: (id: string, reportId: number, input: WeeklyReportInput) => request(`/api/call-orders/${enc(id)}/weekly-reports/${reportId}`, { method: "PUT", body: json(input) }),
  submitWeekly: (id: string, reportId: number) => request(`/api/call-orders/${enc(id)}/weekly-reports/${reportId}/submit`, { method: "POST" }),
  
  // Authentication endpoints
  async getMe() {
    const res = await fetch("/api/auth/me", {
      headers: accessToken ? { "Authorization": `Bearer ${accessToken}` } : {},
    });
    if (!res.ok) return null;
    return res.json();
  },
  
  async logout() {
    if (accessToken) {
      await fetch("/api/auth/logout", {
        method: "POST",
        headers: { "Authorization": `Bearer ${accessToken}` },
      });
    }
    clearTokens();
  },
  
  // Consolidated Weekly Reports endpoints
  async getWeeks() {
    const res = await fetch("/api/weekly-reports/weeks", {
      headers: accessToken ? { "Authorization": `Bearer ${accessToken}` } : {},
    });
    if (!res.ok) throw new Error("Failed to fetch weeks");
    return res.json();
  },
  
};
