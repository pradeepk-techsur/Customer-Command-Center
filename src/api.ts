import type { MsrSectionInput, PortalSnapshot, Role, WeeklyReportInput } from "../shared/types.ts";

// Authentication tokens stored in memory and localStorage
let accessToken: string | null = null;
let refreshToken: string | null = null;

// Load tokens from localStorage on initialization
if (typeof window !== "undefined") {
  accessToken = localStorage.getItem("accessToken");
  refreshToken = localStorage.getItem("refreshToken");
}

export function setTokens(access: string, refresh: string) {
  accessToken = access;
  refreshToken = refresh;
  localStorage.setItem("accessToken", access);
  localStorage.setItem("refreshToken", refresh);
}

export function clearTokens() {
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

async function request(path: string, init: RequestInit = {}): Promise<PortalSnapshot> {
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
  
  // Handle 401 Unauthorized - try to refresh token
  if (res.status === 401 && refreshToken) {
    const refreshed = await tryRefreshToken();
    if (refreshed) {
      // Retry original request with new token
      headers.set("Authorization", `Bearer ${accessToken}`);
      const retryRes = await fetch(path, { ...init, headers });
      const retryBody = await retryRes.json().catch(() => null);
      if (!retryRes.ok) throw new Error((retryBody && retryBody.error) || `Request failed (${retryRes.status}).`);
      return retryBody as PortalSnapshot;
    } else {
      // Refresh failed - redirect to login
      clearTokens();
      window.location.href = "/login";
      throw new Error("Session expired. Please log in again.");
    }
  }
  
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error((body && body.error) || `Request failed (${res.status}).`);
  return body as PortalSnapshot;
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
      return true;
    }
    
    return false;
  } catch {
    return false;
  }
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
  uploadCallOrders: (list: FileList) => request("/api/call-orders/upload", { method: "POST", body: files(list) }),
  saveSpend: (id: string, spend: string) => request(`/api/call-orders/${enc(id)}/spend`, { method: "PATCH", body: json({ spend }) }),
  saveDescription: (id: string, description: string) => request(`/api/call-orders/${enc(id)}/description`, { method: "PATCH", body: json({ description }) }),
  saveCallOrderSetup: (id: string, input: { popStart?: string; popEnd?: string; funded?: string; eac?: string; overUnder?: string; pm?: string }) =>
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
  addStaffTransfer: (input: { staffId: number; toCallOrderId?: string; toLcat?: string; effectiveDate: string; notes?: string }) =>
    request(`/api/staffing/transfers`, { method: "POST", body: json(input) }),
  completeStaffTransfer: (transferId: number) => request(`/api/staffing/transfers/${transferId}/complete`, { method: "POST" }),
  removeStaffTransfer: (transferId: number) => request(`/api/staffing/transfers/${transferId}`, { method: "DELETE" }),
  createWeekly: (id: string, input: WeeklyReportInput) => request(`/api/call-orders/${enc(id)}/weekly-reports`, { method: "POST", body: json(input) }),
  uploadWeekly: (id: string, list: FileList) => request(`/api/call-orders/${enc(id)}/weekly-reports/upload`, { method: "POST", body: files(list) }),
  editWeekly: (id: string, reportId: number, input: WeeklyReportInput) => request(`/api/call-orders/${enc(id)}/weekly-reports/${reportId}`, { method: "PUT", body: json(input) }),
  submitWeekly: (id: string, reportId: number) => request(`/api/call-orders/${enc(id)}/weekly-reports/${reportId}/submit`, { method: "POST" }),
  createMonthly: (period: string, mode: "blank" | "draft") => request("/api/monthly-reports", { method: "POST", body: json({ period, mode }) }),
  uploadMonthly: (period: string, list: FileList) => request("/api/monthly-reports/upload", { method: "POST", body: files(list, { period }) }),
  createPmMonthly: (period: string, mode: "blank" | "draft") => request("/api/pm/monthly-reports", { method: "POST", body: json({ period, mode }) }),
  saveSection: (reportId: number, callOrderId: string, input: MsrSectionInput) =>
    request(`/api/monthly-reports/${reportId}/sections/${enc(callOrderId)}`, { method: "PUT", body: json(input) }),
  submitMonthlyToCustomer: (reportId: number) => request(`/api/monthly-reports/${reportId}/submit`, { method: "POST" }),
  
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
  
  async getConsolidatedWeeklyReport(weekEnding: string) {
    const res = await fetch(`/api/weekly-reports/consolidated/${weekEnding}`, {
      headers: accessToken ? { "Authorization": `Bearer ${accessToken}` } : {},
    });
    if (!res.ok) throw new Error("Failed to fetch consolidated weekly report");
    return res.json();
  },
  
  async submitConsolidatedWeeklyReport(weekEnding: string) {
    return request(`/api/weekly-reports/consolidated/${weekEnding}/submit`, { method: "POST" });
  },
  
  async getCustomerWeeklyReports() {
    const res = await fetch("/api/weekly-reports/customer", {
      headers: accessToken ? { "Authorization": `Bearer ${accessToken}` } : {},
    });
    if (!res.ok) throw new Error("Failed to fetch customer weekly reports");
    return res.json();
  },
  
  async getWeeklyReport(callOrderId: string, reportId: number) {
    const res = await fetch(`/api/call-orders/${callOrderId}/weekly-reports/${reportId}`, {
      headers: accessToken ? { "Authorization": `Bearer ${accessToken}` } : {},
    });
    if (!res.ok) throw new Error("Failed to fetch weekly report");
    return res.json();
  },
  
  async updateWeeklyReport(callOrderId: string, reportId: number, data: WeeklyReportInput) {
    return request(`/api/call-orders/${callOrderId}/weekly-reports/${reportId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },
};
