import type { CallOrder, PortalConfig, StaffMember } from "../../shared/types.ts";

export const ACCENT = "var(--accent)";
export const WARN = "var(--warn)";

export function usd(n: number | null | undefined): string {
  if (n === null || n === undefined) return "N/A";
  if (Math.abs(n) >= 1000000) return "$" + (n / 1000000).toFixed(2) + "M";
  if (Math.abs(n) >= 1000) return "$" + Math.round(n / 1000).toLocaleString() + "K";
  return "$" + n.toFixed(0);
}

export function usdFull(n: number | null | undefined): string {
  if (n === null || n === undefined) return "N/A";
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export const rate = (n: number) => "$" + Number(n).toFixed(2);

export const isVacant = (name: string) => /^VACANT/i.test(name);
export const isDeparted = (status: string) => /offboarded|no longer available/i.test(status || "");
export const isAssigned = (s: StaffMember) => !isVacant(s.name) && !isDeparted(s.status);
export const filled = (c: CallOrder) => c.staff.filter(isAssigned).length;

/** Burn thresholds (fixed policy): below 75% accent, 75–85% amber, 86%+ red. */
export function burnColor(pct: number): string {
  return pct >= 86 ? "var(--burn-high)" : pct >= 75 ? "var(--burn-mid)" : ACCENT;
}

export function pctOf(spend: number, funded: number) { return funded ? Math.round((spend / funded) * 100) : 0; }

/** Parses a YYYY-MM-DD string as a local date. */
export function localDate(iso: string | null): Date | null {
  if (!iso) return null;
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
}

export function dateLabel(iso: string | null): string {
  const d = localDate(iso);
  return d ? d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";
}

export type PeriodState = "current" | "upcoming" | "prior";
export function periodState(c: CallOrder, today: string): PeriodState {
  const start = localDate(c.popStart), end = localDate(c.popEnd), now = localDate(today)!;
  if (!start || !end) return "current";
  if (now < start) return "upcoming";
  if (now > end) return "prior";
  return "current";
}

export function daysOld(iso: string | null, today: string): number {
  const d = localDate(iso), now = localDate(today);
  return d && now ? Math.round((now.getTime() - d.getTime()) / 86400000) : 0;
}

export type StampKind = "fin" | "people";
export function stampOf(c: CallOrder, kind: StampKind) { return kind === "fin" ? c.finUpdatedOn : c.peopleUpdatedOn; }
export function intervalOf(kind: StampKind, config: PortalConfig) { return kind === "fin" ? config.staleDaysFinancials : config.staleDaysStaffing; }
export function isStale(c: CallOrder, kind: StampKind, today: string, config: PortalConfig) {
  return daysOld(stampOf(c, kind), today) > intervalOf(kind, config);
}
/** The stamp that is furthest past its refresh interval — what the register shows per call order. */
export function mostOverdueStamp(c: CallOrder, today: string, config: PortalConfig): { stamp: string; stale: boolean } {
  const kinds: StampKind[] = ["fin", "people"];
  const ranked = kinds
    .map((k) => ({ k, ratio: daysOld(stampOf(c, k), today) / Math.max(intervalOf(k, config), 1) }))
    .sort((a, b) => b.ratio - a.ratio);
  return { stamp: stampOf(c, ranked[0].k), stale: ranked[0].ratio > 1 };
}

export const normalizeLcat = (t: string) => String(t).toLowerCase().replace(/[^a-z]/g, "");

/** Splits textarea input into trimmed, non-empty lines. */
export const lines = (t: string) => String(t || "").split("\n").map((x) => x.trim()).filter(Boolean);

/** "Workstream: text" → { title: "Workstream", text }, otherwise { title: "", text: line }. */
export function toEntries(t: string) {
  return lines(t).map((l) => {
    const m = l.match(/^([^:]{3,60}):\s+(.*)$/);
    return m ? { title: m[1], text: m[2] } : { title: "", text: l };
  });
}
export const fromEntries = (arr: { title: string; text: string }[]) => arr.map((e) => (e.title ? e.title + ": " : "") + e.text).join("\n");

export function todayLabel() { return new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); }
export function monthLabel() { return new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" }); }
