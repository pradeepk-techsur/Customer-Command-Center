// Date helpers shared by seed and API. All output is YYYY-MM-DD (DATE column) or null.

export function isoDate(d: Date): string {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function todayIso(): string { return isoDate(new Date()); }

/** "9/26/25 – 9/25/26" → { start, end } as YYYY-MM-DD or null. */
export function parsePop(pop: string): { start: string | null; end: string | null } {
  const parts = String(pop || "").split(/\s*[–-]\s*/);
  const p = (t: string | undefined) => {
    const x = String(t || "").match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
    if (!x) return null;
    const y = +x[3] < 100 ? 2000 + +x[3] : +x[3];
    return isoDate(new Date(y, +x[1] - 1, +x[2]));
  };
  return { start: p(parts[0]), end: p(parts[1]) };
}

/** "Sep 8, 2026" / "Jul 15, 2026" / "6/29/2026" → YYYY-MM-DD or null. */
export function toIsoDate(label: string | null | undefined): string | null {
  if (!label) return null;
  const t = Date.parse(label);
  return isNaN(t) ? null : isoDate(new Date(t));
}

/** "June 2026" → 2026-06-01 or null. */
export function firstOfMonth(period: string): string | null {
  const t = Date.parse("1 " + period);
  return isNaN(t) ? null : isoDate(new Date(t));
}

export function monthLabel(d = new Date()): string {
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export function dayLabel(d = new Date()): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
