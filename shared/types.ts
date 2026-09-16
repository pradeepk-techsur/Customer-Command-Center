// Types shared by the API server and the React client.

export type Role = "customer" | "pm" | "admin" | "program_manager";

export interface LaborCategory {
  id: number;
  name: string;
  fte: number;
  hours: number;
  rate: number;
  vacancyStatus: 'sourcing' | 'on_hold' | 'onboarding' | null;
}

export interface StaffMember {
  id: number;
  name: string;
  laborCategory: string;
  rate: number;
  status: string;
  aoEmail: string | null;
  phone: string | null;
  startDate: string | null;
  endDate: string | null;
  offerAcceptedDate: string | null;
  of306SubmittedDate: string | null;
  fingerprintsCompleteDate: string | null;
  laptopReceivedDate: string | null;
  pivIssuedDate: string | null;
  propertyReturnDocHref: string | null;
  equipment: StaffEquipment[];
}

export interface StaffEquipment {
  id: number;
  staffId: number;
  makeModel: string;
  propertyTagNumber: string | null;
}

export interface StaffTransfer {
  id: number;
  staffId: number;
  staffName: string;
  fromCallOrderId: string | null;
  fromLcat: string | null;
  toCallOrderId: string | null;
  toLcat: string | null;
  effectiveDate: string;
  notes: string | null;
  status: 'pending' | 'completed';
  createdAt: string;
  completedAt: string | null;
}

export interface ReportGroup {
  label: string;
  items: string[];
}

export interface WeeklyReport {
  id: number;
  callOrderId: string | null; // null = program-wide touchpoint
  weekEnding: string | null;  // YYYY-MM-DD
  weekLabel: string;          // "Sep 8, 2026"
  file: string;
  submittedBy: string;
  status: string;             // Submitted | Uploaded (legacy)
  statusV2: string;           // draft | submitted | uploaded
  href: string | null;
  createdInPortal: boolean;
  createdByUserId: number | null;
  submittedAt: string | null; // ISO timestamp
  lastEditedAt: string | null; // ISO timestamp
  groups: ReportGroup[];      // items for the call order being viewed
}

export interface CallOrder {
  id: string;
  groupKey: string;
  groupName: string;
  name: string;
  pop: string;
  popStart: string | null;
  popEnd: string | null;
  funded: number;
  spend: number;
  eac: number | null;
  over: number | null;
  pm: string;
  pending: boolean;
  highlights: string[];
  finUpdatedOn: string;
  peopleUpdatedOn: string;
  laborCategories: LaborCategory[];
  staff: StaffMember[];
  weeklyReports: WeeklyReport[];
  clins: Clin[];
  invoices: Invoice[];
  contractDocuments: ContractDocument[];
  deliverables: Deliverable[];
  risks: Risk[];
  issues: Issue[];
  actionItems: ActionItem[];
}

// ============================================================================
// Contract Tab: BPA record, CLINs, invoices, contract documents, deliverables
// ============================================================================

export interface Contract {
  id: number;
  name: string;
  agency: string;
  vehicle: string;
  number: string;
  popStart: string | null;
  popEnd: string | null;
  /** Rolled up live from every non-pending call order — not independently editable. */
  funded: number;
  spend: number;
  eac: number | null;
  peopleAssigned: number;
  clins: Clin[];
  invoices: Invoice[];
  contractDocuments: ContractDocument[];
  deliverables: Deliverable[];
  risks: Risk[];
  issues: Issue[];
}

export interface ClinMonthlySpend {
  id: number;
  clinId: number;
  month: string;              // YYYY-MM-01
  projectedAmount: number | null;
  actualAmount: number | null;
}

export interface Clin {
  id: number;
  callOrderId: string | null; // null = BPA-level CLIN
  name: string;
  fundedAmount: number;
  monthlySpend: ClinMonthlySpend[];
}

export interface Invoice {
  id: number;
  callOrderId: string | null; // null = BPA-level invoice
  invoiceNumber: string;
  invoiceDate: string;
  amount: number;
  periodStart: string | null;
  periodEnd: string | null;
  paymentStatus: 'unpaid' | 'paid';
  paidDate: string | null;
  fileHref: string | null;
}

export interface ContractDocument {
  id: number;
  callOrderId: string | null; // null = BPA-level document
  name: string;
  fileHref: string | null;
  isAdminMod: boolean;
  isFundingMod: boolean;
  fundingChangeAmount: number | null;
  popPeriodLabel: string | null;
  effectiveDate: string | null;
}

export interface Deliverable {
  id: number;
  callOrderId: string | null; // null = BPA-level deliverable
  name: string;
  category: string | null;
  periodLabel: string | null; // reporting month/year the deliverable covers, e.g. "Sep 2026"
  linkType: 'file' | 'url';
  fileHref: string | null;
  url: string | null;
  dueDate: string | null;
  deliveryDate: string | null;
  status: 'pending' | 'delivered' | 'accepted';
}

// ============================================================================
// Risks, Issues, Action Items
// ============================================================================

export type RiskLevel = 'low' | 'medium' | 'high';

export interface Risk {
  id: number;
  callOrderId: string | null; // null = BPA-level risk
  description: string;
  probability: RiskLevel;
  impact: RiskLevel;
  severity: RiskLevel;        // calculated from probability x impact
  mitigation: string | null;
  status: 'open' | 'closed';
  createdAt: string;
  closedAt: string | null;
}

export interface IssueUpdate { date: string; text: string }

export interface Issue {
  id: number;
  callOrderId: string | null; // null = BPA-level issue
  description: string;
  dateIdentified: string;
  assignedTo: string | null;
  status: 'open' | 'closed';
  updatesNarrative: IssueUpdate[];
  createdAt: string;
  closedAt: string | null;
}

export interface ActionItem {
  id: number;
  weeklyReportId: number | null;
  callOrderId: string | null;
  name: string;
  description: string | null;
  dateAssigned: string;
  status: 'open' | 'closed';
  closedAt: string | null;
}

export interface FundingLine { label: string; value: number | null }
export interface ActivityEntry { title: string; text: string }
export interface MsrStaffRow { division: string; name: string; start: string; lcat: string }

export interface MsrSection {
  id: number;
  callOrderId: string;
  title: string | null;
  funding: FundingLine[];
  completed: ActivityEntry[];
  planned: ActivityEntry[];
  risks: string[];
  issues: string[];
  travel: string;
  staffing: MsrStaffRow[] | null;
  drafted: boolean;
}

export interface MonthlyReport {
  id: number;
  period: string;
  periodStart: string | null;
  file: string;
  submittedBy: string;
  dueOn: string | null;
  status: string;
  href: string | null;
  scope: string | null;
  createdByUserId: number | null;
  reportType: 'program' | 'pm';
  parentReportId: number | null;
  customerVisible: boolean;
  customerReleasedAt: string | null;
  customerReleasedBy: number | null;
  sections: Record<string, MsrSection>;
}

export interface ConsolidatedWeeklyReport {
  id: number;
  weekEnding: string;        // YYYY-MM-DD (Sunday)
  weekLabel: string;         // "Sep 8, 2026"
  status: 'draft' | 'submitted';
  customerVisible: boolean;
  customerReleasedAt: string | null;
  customerReleasedBy: number | null;
  createdBy: number;
  createdAt: string;
  updatedAt: string;
  callOrderReports: CallOrderWeeklyReportStatus[];
}

export interface CallOrderWeeklyReportStatus {
  callOrderId: string;
  callOrderName: string;
  pm: string;
  hasReport: boolean;
  reportId: number | null;
  reportStatus: 'draft' | 'submitted' | 'uploaded' | null;
  submittedBy: string | null;
  submittedAt: string | null;
}

export const WEEKLY_SECTIONS = {
  accomplishments: "Accomplishments",
  planned: "Planned activities",
  risks: "Risks",
  issues: "Issues",
  actions: "Customer actions and decisions",
} as const;

export interface PortalConfig {
  staleDaysFinancials: number;
  staleDaysStaffing: number;
  magicLinkTokenExpiryMinutes: number;
}

// ============================================================================
// Approved Users & Magic-Link Authentication (Mission Control Slice 1)
// ============================================================================

export interface ApprovedUser {
  id: number;
  email: string;
  name: string;
  role: 'customer' | 'pm' | 'program_manager';
  addedByUserId: number | null;
  status: 'active' | 'revoked';
  createdAt: string;
  updatedAt: string;
}

export type AuthenticationEventType =
  | 'magic_link_requested' | 'magic_link_approved' | 'magic_link_rejected'
  | 'magic_link_issued' | 'magic_link_used' | 'magic_link_reuse_attempt'
  | 'magic_link_expired_attempt' | 'magic_link_invalid_attempt'
  | 'sso_success' | 'sso_failure' | 'session_start' | 'session_end';

export interface AuthenticationEvent {
  id: number;
  eventType: AuthenticationEventType;
  email: string | null;
  userId: number | null;
  roleAssigned: string | null;
  ipAddress: string | null;
  details: unknown;
  occurredAt: string;
}

export interface PortalSnapshot {
  today: string; // server date, YYYY-MM-DD
  config: PortalConfig;
  contract: Contract;
  callOrders: CallOrder[];
  monthlyReports: MonthlyReport[];
  staffTransfers: StaffTransfer[];
  actor?: { id: number; email: string; role: Role };
}

export interface WeeklyReportInput {
  weekEnding: string;   // free text, e.g. "Sep 8, 2026"
  submittedBy: string;
  accomplishments: string[];
  planned: string[];
  risks: string[];
  issues: string[];
  actions: string[];
}

export interface MsrSectionInput {
  obligated: number | null;
  expended: number | null;
  remaining: number | null;
  eac: number | null;
  over: number | null;
  completed: ActivityEntry[];
  planned: ActivityEntry[];
  risks: string[];
  issues: string[];
  travel: string;
}

export const STATUS_OPTIONS = [
  "Assigned", "Vacant", "On leave", "PIV pending", "Onboarding", "Recruiting", "Offboarded", "No longer available",
];

// ============================================================================
// Audit History & Snapshots
// ============================================================================

export interface CallOrderSnapshot {
  id: number;
  callOrderId: string;
  snapshotTime: string;  // ISO timestamp
  // Financial data
  funded: number;
  spend: number;
  eac: number | null;
  overUnder: number | null;
  // Metadata
  pm: string;
  popStart: string | null;
  popEnd: string | null;
  popLabel: string;
  pending: boolean;
  // Audit trail
  createdByUserId: number | null;
  createdByUserName?: string;  // Joined from users table
  changeReason: string | null;
  changedFields: string[] | null;
  createdAt: string;  // ISO timestamp
}

export interface StaffSnapshot {
  id: number;
  callOrderId: string;
  snapshotTime: string;  // ISO timestamp
  // Staff roster
  staffRoster: StaffMember[];
  // Audit trail
  createdByUserId: number | null;
  createdByUserName?: string;  // Joined from users table
  changeReason: string | null;
  changeType: 'add' | 'update' | 'delete' | null;
  changedStaffId: number | null;
  createdAt: string;  // ISO timestamp
}

export interface AuditLogEntry {
  id: number;
  actor: string;
  role: string;
  action: string;
  entity: string;
  entityId: string | null;
  details: any;
  occurredAt: string;  // ISO timestamp
  userId: number | null;
  snapshotId: number | null;
  snapshotType: 'call_order' | 'staff' | null;
}

export interface HistoryTimelineEntry {
  date: string;  // ISO date
  time: string;  // ISO timestamp
  changeType: 'financial' | 'staff' | 'metadata';
  description: string;
  // Role-based fields (null for customers)
  changedBy?: string | null;  // User name
  reason?: string | null;
  // Change details
  beforeValue?: any;
  afterValue?: any;
  field?: string;
}
