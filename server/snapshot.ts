import type { Queryable } from "./db.ts";
import type {
  ActionItem, CallOrder, Clin, ClinMonthlySpend, Contract, ContractDocument, Deliverable, Invoice, Issue,
  MonthlyReport, MsrSection, PortalSnapshot, ReportGroup, Risk, RiskLevel, StaffEquipment, StaffTransfer, WeeklyReport,
} from "../shared/types.ts";
import { todayIso } from "./dates.ts";

// Fallback used only if risk_severity_matrix has no rows (e.g. schema not yet migrated).
const FALLBACK_SEVERITY_MATRIX: Record<RiskLevel, Record<RiskLevel, RiskLevel>> = {
  low: { low: "low", medium: "low", high: "medium" },
  medium: { low: "low", medium: "medium", high: "high" },
  high: { low: "medium", medium: "high", high: "high" },
};

export type SeverityMatrix = Record<RiskLevel, Record<RiskLevel, RiskLevel>>;

/** Risk severity matrix is configuration-driven (spec §14), not hardcoded — loaded from risk_severity_matrix. */
export async function loadSeverityMatrix(db: Queryable): Promise<SeverityMatrix> {
  const { rows } = await db.query<{ probability: RiskLevel; impact: RiskLevel; severity: RiskLevel }>(
    "select probability, impact, severity from risk_severity_matrix",
  );
  if (!rows.length) return FALLBACK_SEVERITY_MATRIX;
  const matrix = { low: {}, medium: {}, high: {} } as SeverityMatrix;
  for (const r of rows) matrix[r.probability][r.impact] = r.severity;
  return matrix;
}

export function config() {
  return {
    staleDaysFinancials: Number(process.env.STALE_DAYS_FINANCIALS) || 30,
    staleDaysStaffing: Number(process.env.STALE_DAYS_STAFFING) || 7,
    magicLinkTokenExpiryMinutes: Number(process.env.MAGIC_LINK_TOKEN_EXPIRY_MINUTES) || 10,
  };
}

const toRisk = (r: any, matrix: SeverityMatrix): Risk => ({
  id: r.id, callOrderId: r.call_order_id, description: r.description, probability: r.probability, impact: r.impact,
  severity: matrix[r.probability as RiskLevel][r.impact as RiskLevel], mitigation: r.mitigation, status: r.status,
  createdAt: r.created_at, closedAt: r.closed_at,
});
const toIssue = (i: any): Issue => ({
  id: i.id, callOrderId: i.call_order_id, description: i.description, dateIdentified: i.date_identified,
  assignedTo: i.assigned_to, status: i.status, updatesNarrative: i.updates_narrative || [],
  createdAt: i.created_at, closedAt: i.closed_at,
});
const toInvoice = (i: any): Invoice => ({
  id: i.id, callOrderId: i.call_order_id, invoiceNumber: i.invoice_number, invoiceDate: i.invoice_date,
  amount: i.amount, periodStart: i.period_start, periodEnd: i.period_end, paymentStatus: i.payment_status,
  paidDate: i.paid_date, fileHref: i.file_href,
});
const toContractDocument = (d: any): ContractDocument => ({
  id: d.id, callOrderId: d.call_order_id, name: d.name, fileHref: d.file_href, isAdminMod: d.is_admin_mod,
  isFundingMod: d.is_funding_mod, fundingChangeAmount: d.funding_change_amount, popPeriodLabel: d.pop_period_label,
  effectiveDate: d.effective_date,
});
const toDeliverable = (d: any): Deliverable => ({
  id: d.id, callOrderId: d.call_order_id, name: d.name, category: d.category, periodLabel: d.period_label,
  linkType: d.link_type, fileHref: d.file_href, url: d.url,
  dueDate: d.due_date, deliveryDate: d.delivery_date, status: d.status,
});
const toClin = (c: any, monthly: any[]): Clin => ({
  id: c.id, callOrderId: c.call_order_id, name: c.name, fundedAmount: c.funded_amount,
  monthlySpend: monthly.filter((m) => m.clin_id === c.id).map((m): ClinMonthlySpend => ({
    id: m.id, clinId: m.clin_id, month: m.month, projectedAmount: m.projected_amount, actualAmount: m.actual_amount,
  })),
});
const toActionItem = (a: any): ActionItem => ({
  id: a.id, weeklyReportId: a.weekly_report_id, callOrderId: a.call_order_id, name: a.name, description: a.description,
  dateAssigned: a.date_assigned, status: a.status, closedAt: a.closed_at,
});

/**
 * BPA-level record plus its own CLINs/invoices/documents/deliverables/risks/issues (call_order_id is null).
 * Funded/spend/EAC/people are always rolled up live from every non-pending call order — the BPA
 * dashboard is a summary of its call orders, not a separately editable total.
 */
async function loadContract(db: Queryable, severityMatrix: SeverityMatrix): Promise<Contract> {
  const [contractRes, clinsRes, clinSpendRes, invoicesRes, docsRes, deliverablesRes, risksRes, issuesRes, rollupRes] = await Promise.all([
    db.query("select * from contracts order by id limit 1"),
    db.query("select * from clins where call_order_id is null order by sort_order, id"),
    db.query(`select cms.* from clin_monthly_spend cms join clins c on c.id = cms.clin_id where c.call_order_id is null order by cms.month`),
    db.query("select * from invoices where call_order_id is null order by invoice_date desc"),
    db.query("select * from contract_documents where call_order_id is null order by sort_order, id"),
    db.query("select * from deliverables where call_order_id is null order by sort_order, id"),
    db.query("select * from risks where call_order_id is null order by status, created_at desc"),
    db.query("select * from issues where call_order_id is null order by status, created_at desc"),
    db.query(
      `select
         coalesce(sum(co.funded), 0) as funded,
         coalesce(sum(co.spend), 0) as spend,
         coalesce(sum(co.eac), 0) as eac,
         coalesce((select count(*) from staff s join call_orders c2 on c2.id = s.call_order_id
                   where not c2.pending and not (s.name ilike 'VACANT%')
                     and s.status not ilike '%offboarded%' and s.status not ilike '%no longer available%'), 0) as people
       from call_orders co where not co.pending`,
    ),
  ]);
  const c = contractRes.rows[0] || {
    id: 0, name: "BPA", agency: "", vehicle: "", number: "", pop_start: null, pop_end: null,
  };
  const rollup = rollupRes.rows[0];
  return {
    id: c.id, name: c.name, agency: c.agency, vehicle: c.vehicle, number: c.number,
    popStart: c.pop_start, popEnd: c.pop_end,
    funded: rollup.funded, spend: rollup.spend, eac: rollup.eac || null, peopleAssigned: rollup.people,
    clins: clinsRes.rows.map((row) => toClin(row, clinSpendRes.rows)),
    invoices: invoicesRes.rows.map(toInvoice),
    contractDocuments: docsRes.rows.map(toContractDocument),
    deliverables: deliverablesRes.rows.map(toDeliverable),
    risks: risksRes.rows.map((r) => toRisk(r, severityMatrix)),
    issues: issuesRes.rows.map(toIssue),
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
  const severityMatrix = await loadSeverityMatrix(db);

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
        contract: await loadContract(db, severityMatrix), 
        callOrders: [], 
        monthlyReports: [],
        staffTransfers: [],
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
      contract: await loadContract(db, severityMatrix), 
      callOrders: [], 
      monthlyReports: [],
      staffTransfers: [],
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
  const [
    lcats, staff, weekly, items, monthly, sections,
    clins, clinSpend, invoices, contractDocuments, deliverables, risks, issues,
    equipment, staffTransfers, actionItems,
  ] = await Promise.all([
    db.query("select * from labor_categories where call_order_id = ANY($1) order by call_order_id, sort_order, id", [callOrderIds]),
    db.query("select * from staff where call_order_id = ANY($1) order by call_order_id, sort_order, id", [callOrderIds]),
    db.query("select * from weekly_reports where call_order_id is null or call_order_id = ANY($1) order by week_ending desc nulls last, created_at desc", [callOrderIds]),
    db.query("select * from weekly_report_items where call_order_id = ANY($1) order by weekly_report_id, sort_order, id", [callOrderIds]),
    db.query(monthlyQuery, monthlyParams),
    db.query("select * from msr_sections where call_order_id = ANY($1) order by id", [callOrderIds]),
    db.query("select * from clins where call_order_id = ANY($1) order by call_order_id, sort_order, id", [callOrderIds]),
    db.query(`select cms.* from clin_monthly_spend cms join clins c on c.id = cms.clin_id where c.call_order_id = ANY($1) order by cms.month`, [callOrderIds]),
    db.query("select * from invoices where call_order_id = ANY($1) order by call_order_id, invoice_date desc", [callOrderIds]),
    db.query("select * from contract_documents where call_order_id = ANY($1) order by call_order_id, sort_order, id", [callOrderIds]),
    db.query("select * from deliverables where call_order_id = ANY($1) order by call_order_id, sort_order, id", [callOrderIds]),
    db.query("select * from risks where call_order_id = ANY($1) order by call_order_id, status, created_at desc", [callOrderIds]),
    db.query("select * from issues where call_order_id = ANY($1) order by call_order_id, status, created_at desc", [callOrderIds]),
    db.query("select e.* from staff_equipment e join staff s on s.id = e.staff_id where s.call_order_id = ANY($1) order by e.staff_id, e.id", [callOrderIds]),
    db.query("select t.*, s.name as staff_name from staff_transfers t join staff s on s.id = t.staff_id where s.call_order_id = ANY($1) or t.from_call_order_id = ANY($1) or t.to_call_order_id = ANY($1) order by t.effective_date desc", [callOrderIds]),
    db.query("select * from action_items where call_order_id = ANY($1) order by call_order_id, status, date_assigned desc", [callOrderIds]),
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
      laborCategories: lcats.rows.filter((l) => l.call_order_id === c.id).map((l) => ({
        id: l.id, name: l.name, fte: l.fte, hours: l.hours, rate: l.rate, vacancyStatus: l.vacancy_status || null,
      })),
      staff: staff.rows.filter((s) => s.call_order_id === c.id).map((s) => ({
        id: s.id, name: s.name, laborCategory: s.labor_category, rate: s.rate, status: s.status,
        aoEmail: s.ao_email || null, phone: s.phone || null, startDate: s.start_date || null, endDate: s.end_date || null,
        offerAcceptedDate: s.offer_accepted_date || null, of306SubmittedDate: s.of306_submitted_date || null,
        fingerprintsCompleteDate: s.fingerprints_complete_date || null, laptopReceivedDate: s.laptop_received_date || null,
        pivIssuedDate: s.piv_issued_date || null, propertyReturnDocHref: s.property_return_doc_href || null,
        equipment: equipment.rows.filter((e) => e.staff_id === s.id).map((e): StaffEquipment => ({
          id: e.id, staffId: e.staff_id, makeModel: e.make_model, propertyTagNumber: e.property_tag_number || null,
        })),
      })),
      weeklyReports: reports,
      clins: clins.rows.filter((cl) => cl.call_order_id === c.id).map((cl) => toClin(cl, clinSpend.rows)),
      invoices: invoices.rows.filter((i) => i.call_order_id === c.id).map(toInvoice),
      contractDocuments: contractDocuments.rows.filter((d) => d.call_order_id === c.id).map(toContractDocument),
      deliverables: deliverables.rows.filter((d) => d.call_order_id === c.id).map(toDeliverable),
      risks: risks.rows.filter((r) => r.call_order_id === c.id).map((r) => toRisk(r, severityMatrix)),
      issues: issues.rows.filter((i) => i.call_order_id === c.id).map(toIssue),
      actionItems: actionItems.rows.filter((a) => a.call_order_id === c.id).map(toActionItem),
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

  const contract = await loadContract(db, severityMatrix); 
  const staffTransfersOut: StaffTransfer[] = staffTransfers.rows.map((t) => ({
    id: t.id, staffId: t.staff_id, staffName: t.staff_name, fromCallOrderId: t.from_call_order_id, fromLcat: t.from_lcat,
    toCallOrderId: t.to_call_order_id, toLcat: t.to_lcat, effectiveDate: t.effective_date, notes: t.notes,
    status: t.status, createdAt: t.created_at, completedAt: t.completed_at,
  }));

  return { today: todayIso(), config: config(), contract, callOrders, monthlyReports, staffTransfers: staffTransfersOut, actor };
}
