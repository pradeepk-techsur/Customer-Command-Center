// Types shared by the API server and the React client.

export type Role = "customer" | "pm" | "admin" | "program_manager";

export interface LaborCategory {
  id: number;
  name: string;
  fte: number;
  hours: number;
  rate: number;
}

export interface StaffMember {
  id: number;
  name: string;
  laborCategory: string;
  rate: number;
  status: string;
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
}

export interface PortalSnapshot {
  today: string; // server date, YYYY-MM-DD
  config: PortalConfig;
  contract: { agency: string; vehicle: string; number: string };
  callOrders: CallOrder[];
  monthlyReports: MonthlyReport[];
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
