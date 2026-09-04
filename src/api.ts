import type { MsrSectionInput, PortalSnapshot, Role, WeeklyReportInput } from "../shared/types.ts";

// The role and user travel as headers on every request. The server enforces role on every mutation;
// in production these are supplied by the SSO layer in front of the API rather than the browser.
let role: Role = "customer";
let user = "";
export function setActor(nextRole: Role, nextUser = "") { role = nextRole; user = nextUser; }

async function request(path: string, init: RequestInit = {}): Promise<PortalSnapshot> {
  const headers = new Headers(init.headers || {});
  headers.set("x-portal-role", role);
  if (user) headers.set("x-portal-user", user);
  if (init.body && !(init.body instanceof FormData)) headers.set("content-type", "application/json");
  const res = await fetch(path, { ...init, headers });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error((body && body.error) || `Request failed (${res.status}).`);
  return body as PortalSnapshot;
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
  createMonthly: (period: string, mode: "blank" | "draft") => request("/api/monthly-reports", { method: "POST", body: json({ period, mode }) }),
  uploadMonthly: (period: string, list: FileList) => request("/api/monthly-reports/upload", { method: "POST", body: files(list, { period }) }),
  saveSection: (reportId: number, callOrderId: string, input: MsrSectionInput) =>
    request(`/api/monthly-reports/${reportId}/sections/${enc(callOrderId)}`, { method: "PUT", body: json(input) }),
};
