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

export const api = {
  snapshot: () => request("/api/portal"),
  uploadCallOrders: (list: FileList) => request("/api/call-orders/upload", { method: "POST", body: files(list) }),
  saveSpend: (id: string, spend: string) => request(`/api/call-orders/${enc(id)}/spend`, { method: "PATCH", body: json({ spend }) }),
  addStaff: (id: string, input: { name: string; laborCategory: string; rate: string }) =>
    request(`/api/call-orders/${enc(id)}/staff`, { method: "POST", body: json(input) }),
  setStaffStatus: (staffId: number, status: string) => request(`/api/staff/${staffId}`, { method: "PATCH", body: json({ status }) }),
  removeStaff: (staffId: number) => request(`/api/staff/${staffId}`, { method: "DELETE" }),
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
