// Types shared by the API server and the React client.

export type Role = "customer" | "pm";

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
  status: string;             // Submitted | Uploaded
  href: string | null;
  createdInPortal: boolean;
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
  sections: Record<string, MsrSection>;
}

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

export const WEEKLY_SECTIONS = {
  accomplishments: "Accomplishments this week",
  planned: "Planned activities next week",
  risks: "Risks",
  issues: "Issues",
  actions: "Customer actions and decisions",
  touchpoint: "Call order items",
} as const;
