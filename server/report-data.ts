import type { BpaReportRow, CallOrder, ReportsData, StaffingReportRow } from "../shared/types.ts";

const natural = new Intl.Collator("en-US", { numeric: true, sensitivity: "base" });
const cents = (value: number) => Math.round(value * 100);
const dollars = (value: number) => value / 100;

export function reportPeriodStatus(popEnd: string | null, today: string): "active" | "inactive" {
  return popEnd && popEnd < today ? "inactive" : "active";
}

function dateBoundary(values: Array<string | null>, direction: "min" | "max"): string | null {
  const dates = values.filter((value): value is string => !!value).sort();
  if (!dates.length) return null;
  return direction === "min" ? dates[0] : dates[dates.length - 1];
}

export function buildReportsData(callOrders: CallOrder[], today: string): ReportsData {
  const groups = new Map<string, CallOrder[]>();
  for (const order of callOrders.filter((order) => !order.pending)) {
    const periods = groups.get(order.groupKey) || [];
    periods.push(order);
    groups.set(order.groupKey, periods);
  }

  const rows: BpaReportRow[] = Array.from(groups.entries()).map(([groupKey, groupPeriods]): BpaReportRow => {
    const periods = [...groupPeriods]
      .sort((a, b) => String(a.popStart || "").localeCompare(String(b.popStart || "")) || natural.compare(a.id, b.id))
      .map((period) => {
        const obligated = cents(period.funded);
        const expended = cents(period.spend);
        return {
          id: period.id,
          popStart: period.popStart,
          popEnd: period.popEnd,
          pop: period.pop,
          status: reportPeriodStatus(period.popEnd, today),
          obligated: dollars(obligated),
          expended: dollars(expended),
          remaining: dollars(obligated - expended),
        };
      });
    const obligated = periods.reduce((sum, period) => sum + cents(period.obligated), 0);
    const expended = periods.reduce((sum, period) => sum + cents(period.expended), 0);
    return {
      callOrderNumber: groupKey,
      title: groupPeriods[0]?.groupName || groupPeriods[0]?.name || groupKey,
      status: periods.some((period) => period.status === "active") ? "active" : "inactive",
      popStart: dateBoundary(groupPeriods.map((period) => period.popStart), "min"),
      popEnd: dateBoundary(groupPeriods.map((period) => period.popEnd), "max"),
      obligated: dollars(obligated),
      expended: dollars(expended),
      remaining: dollars(obligated - expended),
      periods,
    };
  }).sort((a, b) => natural.compare(a.callOrderNumber, b.callOrderNumber));

  const staffing: StaffingReportRow[] = callOrders
    .filter((order) => !order.pending)
    .flatMap((order) => order.staff
      .filter((person) => !/^\s*VACANT\b/i.test(person.name) && !/^\s*vacant\s*$/i.test(person.status))
      .map((person) => ({
        callOrderNumber: order.groupKey,
        callOrderPeriod: order.id,
        callOrderTitle: order.groupName,
        name: person.name,
        laborCategory: person.laborCategory,
        rate: person.rate,
        status: person.status,
      })))
    .sort((a, b) => natural.compare(a.callOrderNumber, b.callOrderNumber) || a.name.localeCompare(b.name));

  const obligated = rows.reduce((sum, row) => sum + cents(row.obligated), 0);
  const expended = rows.reduce((sum, row) => sum + cents(row.expended), 0);
  return {
    generatedOn: today,
    bpa: {
      obligated: dollars(obligated),
      expended: dollars(expended),
      remaining: dollars(obligated - expended),
      callOrders: rows,
    },
    staffing,
  };
}
