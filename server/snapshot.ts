import type { Queryable, getAccessibleCallOrders } from "./db.ts";
import type { CallOrder, MonthlyReport, MsrSection, PortalSnapshot, ReportGroup, WeeklyReport } from "../shared/types.ts";
import { todayIso } from "./dates.ts";

export const CONTRACT = { agency: "AOUSC", vehicle: "BPA for TSO Support Services", number: "47QTCA20D00C6" };

export function config() {
  return {
    staleDaysFinancials: Number(process.env.STALE_DAYS_FINANCIALS) || 30,
    staleDaysStaffing: Number(process.env.STALE_DAYS_STAFFING) || 7,
  };
}

/**
 * Build portal snapshot with user-based access filtering.
 * @param db - Database pool or client
 * @param userId - Optional user ID for access filtering
 * @param userRole - Optional user role for access filtering
 * @returns PortalSnapshot filtered to user's accessible call orders
 */
export async function buildSnapshot(
  db: Queryable, 
  userId?: number, 
  userRole?: string
): Promise<PortalSnapshot> {
  // Get accessible call orders for this user
  let accessibleCallOrders: string[] | null = null;
  if (userId && userRole) {
    const { getAccessibleCallOrders } = await import("./db.ts");
    accessibleCallOrders = await getAccessibleCallOrders(db, userId, userRole);
  }

  // Build WHERE clause for call order filtering
  let callOrderFilter = "";
  let callOrderParams: any[] = [];
  
  if (accessibleCallOrders !== null) {
    if (accessibleCallOrders.length === 0) {
      // User has no accessible call orders - return empty snapshot
      const actor = userId && userRole ? { id: userId, email: '', role: userRole as any } : undefined;
      return { 
        today: todayIso(), 
        config: config(), 
        contract: CONTRACT, 
        callOrders: [], 
        monthlyReports: [],
        actor
      };
    }
    // Filter to accessible call orders
    callOrderFilter = `where id = ANY($1)`;
    callOrderParams = [accessibleCallOrders];
  }

  // Query call orders with access filter
  const ordersQuery = accessibleCallOrders !== null
    ? `select * from call_orders ${callOrderFilter} order by sort_order, created_at`
    : `select * from call_orders order by sort_order, created_at`;

  const orders = await db.query(ordersQuery, callOrderParams);

  // If no call orders accessible, return empty snapshot
  if (orders.rows.length === 0) {
    const actor = userId && userRole ? { id: userId, email: '', role: userRole as any } : undefined;
    return { 
      today: todayIso(), 
      config: config(), 
      contract: CONTRACT, 
      callOrders: [], 
      monthlyReports: [],
      actor
    };
  }

  // Get call order IDs for filtering related data
  const callOrderIds = orders.rows.map((o: any) => o.id);

  // Build monthly reports query based on role
  let monthlyQuery = "select * from monthly_reports where ";
  let monthlyParams: any[] = [];
  
  if (userRole === 'customer') {
    // Customers only see reports that have been released to them
    monthlyQuery += "customer_visible = true and report_type = 'program' order by period_start desc nulls last, created_at desc";
  } else if (userRole === 'pm') {
    // PMs see their own PM reports + program reports (not released-only)
    monthlyQuery += "(report_type = 'pm' and created_by_user_id = $1) or report_type = 'program' order by period_start desc nulls last, created_at desc";
    monthlyParams.push(userId);
  } else {
    // Program managers and admins see all reports
    monthlyQuery += "true order by period_start desc nulls last, created_at desc";
  }

  // Query related data, filtered to accessible call orders
  const [lcats, staff, weekly, items, monthly, sections] = await Promise.all([
    db.query("select * from labor_categories where call_order_id = ANY($1) order by call_order_id, sort_order, id", [callOrderIds]),
    db.query("select * from staff where call_order_id = ANY($1) order by call_order_id, sort_order, id", [callOrderIds]),
    db.query("select * from weekly_reports where call_order_id is null or call_order_id = ANY($1) order by week_ending desc nulls last, created_at desc", [callOrderIds]),
    db.query("select * from weekly_report_items where call_order_id = ANY($1) order by weekly_report_id, sort_order, id", [callOrderIds]),
    db.query(monthlyQuery, monthlyParams),
    db.query("select * from msr_sections where call_order_id = ANY($1) order by id", [callOrderIds]),
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
        createdInPortal: w.created_in_portal, 
        statusV2: w.status_v2 || 'draft',
        createdByUserId: w.created_by_user_id || null,
        submittedAt: w.submitted_at || null,
        lastEditedAt: w.last_edited_at || null,
        groups,
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
      dueOn: m.due_on, status: m.status, href: m.href, scope: m.scope,
      createdByUserId: m.created_by_user_id || null,
      reportType: m.report_type || 'program',
      parentReportId: m.parent_report_id || null,
      customerVisible: m.customer_visible || false,
      customerReleasedAt: m.customer_released_at || null,
      customerReleasedBy: m.customer_released_by || null,
      sections: secs,
    };
  });

  // Include actor information if user is authenticated
  const actor = userId && userRole ? { id: userId, email: '', role: userRole as any } : undefined;
  
  return { today: todayIso(), config: config(), contract: CONTRACT, callOrders, monthlyReports, actor };
}
