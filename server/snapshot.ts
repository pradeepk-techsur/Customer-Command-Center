import type { Queryable } from "./db.ts";
import type { CallOrder, MonthlyReport, MsrSection, PortalSnapshot, ReportGroup, WeeklyReport } from "../shared/types.ts";
import { todayIso } from "./dates.ts";

export const CONTRACT = { agency: "AOUSC", vehicle: "BPA for TSO Support Services", number: "47QTCA20D00C6" };

export function config() {
  return {
    staleDaysFinancials: Number(process.env.STALE_DAYS_FINANCIALS) || 30,
    staleDaysStaffing: Number(process.env.STALE_DAYS_STAFFING) || 7,
  };
}

export async function buildSnapshot(db: Queryable): Promise<PortalSnapshot> {
  const [orders, lcats, staff, weekly, items, monthly, sections] = await Promise.all([
    db.query("select * from call_orders order by sort_order, created_at"),
    db.query("select * from labor_categories order by call_order_id, sort_order, id"),
    db.query("select * from staff order by call_order_id, sort_order, id"),
    db.query("select * from weekly_reports order by week_ending desc nulls last, created_at desc"),
    db.query("select * from weekly_report_items order by weekly_report_id, sort_order, id"),
    db.query("select * from monthly_reports order by period_start desc nulls last, created_at desc"),
    db.query("select * from msr_sections order by id"),
  ]);

  const itemsByReport = new Map<number, typeof items.rows>();
  for (const it of items.rows) {
    const list = itemsByReport.get(it.weekly_report_id) || [];
    list.push(it);
    itemsByReport.set(it.weekly_report_id, list);
  }

  const groupsFor = (reportId: number, callOrderId: string): ReportGroup[] => {
    const groups: ReportGroup[] = [];
    for (const it of itemsByReport.get(reportId) || []) {
      if (it.call_order_id !== callOrderId) continue;
      let g = groups.find((x) => x.label === it.section_label);
      if (!g) { g = { label: it.section_label, items: [] }; groups.push(g); }
      g.items.push(it.item_text);
    }
    return groups;
  };

  const callOrders: CallOrder[] = orders.rows.map((c) => {
    const reports: WeeklyReport[] = [];
    for (const w of weekly.rows) {
      const programWide = w.call_order_id === null;
      if (!programWide && w.call_order_id !== c.id) continue;
      const groups = groupsFor(w.id, c.id);
      // A program-wide touchpoint only appears under call orders it actually has items for.
      if (programWide && !groups.length) continue;
      reports.push({
        id: w.id, callOrderId: w.call_order_id, weekEnding: w.week_ending, weekLabel: w.week_label,
        file: w.file_name, submittedBy: w.submitted_by, status: w.status, href: w.href,
        createdInPortal: w.created_in_portal, groups,
      });
    }
    return {
      id: c.id, groupKey: c.group_key, groupName: c.group_name, name: c.name, pop: c.pop_label,
      popStart: c.pop_start, popEnd: c.pop_end, funded: c.funded, spend: c.spend, eac: c.eac, over: c.over_under,
      pm: c.pm, pending: c.pending, highlights: c.highlights, finUpdatedOn: c.fin_updated_on, peopleUpdatedOn: c.people_updated_on,
      laborCategories: lcats.rows.filter((l) => l.call_order_id === c.id).map((l) => ({ id: l.id, name: l.name, fte: l.fte, hours: l.hours, rate: l.rate })),
      staff: staff.rows.filter((s) => s.call_order_id === c.id).map((s) => ({ id: s.id, name: s.name, laborCategory: s.labor_category, rate: s.rate, status: s.status })),
      weeklyReports: reports,
    };
  });

  const monthlyReports: MonthlyReport[] = monthly.rows.map((m) => {
    const secs: Record<string, MsrSection> = {};
    for (const s of sections.rows.filter((x) => x.monthly_report_id === m.id)) {
      secs[s.call_order_id] = {
        id: s.id, callOrderId: s.call_order_id, title: s.title, funding: s.funding, completed: s.completed, planned: s.planned,
        risks: s.risks, issues: s.issues, travel: s.travel, staffing: s.staffing, drafted: s.drafted,
      };
    }
    return {
      id: m.id, period: m.period, periodStart: m.period_start, file: m.file_name, submittedBy: m.submitted_by,
      dueOn: m.due_on, status: m.status, href: m.href, scope: m.scope, sections: secs,
    };
  });

  return { today: todayIso(), config: config(), contract: CONTRACT, callOrders, monthlyReports };
}
