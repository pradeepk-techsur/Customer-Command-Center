import { useState } from "react";
import type { CallOrder, WeeklyReport, MonthlyReport, PortalSnapshot } from "../../shared/types.ts";
import { api } from "../api.ts";
import { useSort } from "../hooks/useSort.ts";
import { localDate, monthLabel } from "../lib/format.ts";
import { Button, SortHeaders, Field, TextInput } from "./ui.tsx";
import type { Mutate } from "../App.tsx";

const WEEKLY_COLS = [
  { key: "call", label: "Call Order" },
  { key: "week", label: "Week ending" },
  { key: "file", label: "File" },
  { key: "status", label: "Status", align: "right" as const },
];
const MONTHLY_COLS = [
  { key: "period", label: "Period" },
  { key: "file", label: "File" },
  { key: "status", label: "Status", align: "right" as const },
];
const WEEKLY_GRID = "1.5fr 1fr 2fr 0.8fr";
const MONTHLY_GRID = "1fr 2fr 0.8fr";

type ReportType = "weekly" | "monthly";

export function MyReports({ snapshot, userId, mutate, onNavigate }: { 
  snapshot: PortalSnapshot; 
  userId: number;
  mutate: Mutate;
  onNavigate: (callOrderId: string) => void;
}) {
  const [reportType, setReportType] = useState<ReportType>("weekly");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newPeriod, setNewPeriod] = useState(monthLabel());
  
  // Get all weekly reports created by this user
  const allWeeklyReports: Array<WeeklyReport & { callOrderId: string; callOrderName: string }> = [];
  for (const co of snapshot.callOrders) {
    for (const report of co.weeklyReports) {
      if (report.createdByUserId === userId) {
        allWeeklyReports.push({
          ...report,
          callOrderId: co.id,
          callOrderName: co.name,
        });
      }
    }
  }
  
  // Get all PM monthly reports created by this user
  const myMonthlyReports = snapshot.monthlyReports.filter(
    r => r.reportType === 'pm' && r.createdByUserId === userId
  );
  
  const weeklySort = useSort("myweekly", "week", allWeeklyReports, {
    call: (r) => r.callOrderName,
    week: (r) => localDate(r.weekEnding)?.getTime() ?? 0,
    file: (r) => r.file,
    status: (r) => r.statusV2 || r.status,
  });
  
  const monthlySort = useSort("mymonthly", "period", myMonthlyReports, {
    period: (r) => localDate(r.periodStart)?.getTime() ?? 0,
    file: (r) => r.file,
    status: (r) => r.status,
  });

  const weeklyCount = allWeeklyReports.length;
  const monthlyCount = myMonthlyReports.length;
  const draftCount = allWeeklyReports.filter(r => r.statusV2 === 'draft').length;
  
  const createMonthlyReport = (mode: "blank" | "draft") => {
    mutate(() => api.createPmMonthly(newPeriod, mode)).then((s) => {
      setShowCreateModal(false);
      setNewPeriod(monthLabel());
    });
  };

  return (
    <div className="page-section">
      <div className="page-header">
        <div>
          <h1 className="page-title">My Reports</h1>
          <p className="page-subtitle">View and manage all your weekly and monthly status reports</p>
        </div>
      </div>

      <div className="report-type-selector" style={{ marginBottom: 24, display: "flex", gap: 12 }}>
        <button
          type="button"
          className={reportType === "weekly" ? "tab-button active" : "tab-button"}
          onClick={() => setReportType("weekly")}
          style={{
            padding: "8px 16px",
            border: "1px solid #ddd",
            borderRadius: 4,
            background: reportType === "weekly" ? "#2563eb" : "white",
            color: reportType === "weekly" ? "white" : "#333",
            cursor: "pointer",
            fontWeight: 500,
          }}
        >
          Weekly Reports ({weeklyCount})
          {draftCount > 0 && <span style={{ marginLeft: 8, opacity: 0.8 }}>· {draftCount} draft{draftCount !== 1 ? 's' : ''}</span>}
        </button>
        <button
          type="button"
          className={reportType === "monthly" ? "tab-button active" : "tab-button"}
          onClick={() => setReportType("monthly")}
          style={{
            padding: "8px 16px",
            border: "1px solid #ddd",
            borderRadius: 4,
            background: reportType === "monthly" ? "#2563eb" : "white",
            color: reportType === "monthly" ? "white" : "#333",
            cursor: "pointer",
            fontWeight: 500,
          }}
        >
          Monthly Reports ({monthlyCount})
        </button>
      </div>

      {reportType === "weekly" ? (
        <div className="card">
          <div className="card-head">
            <div className="card-title">Weekly Status Reports</div>
          </div>
          <div className="grid thead log" style={{ gridTemplateColumns: WEEKLY_GRID }}>
            <SortHeaders cols={WEEKLY_COLS} cur={weeklySort.cur} onSort={weeklySort.toggle} />
          </div>
          {weeklySort.sorted.map((r) => {
            const status = r.statusV2 || r.status;
            const statusLabel = status === 'draft' ? 'Draft' : status === 'submitted' ? 'Submitted' : status === 'uploaded' ? 'Uploaded' : status;
            return (
              <div
                key={`${r.callOrderId}-${r.id}`}
                className="grid trow log clickable"
                style={{ gridTemplateColumns: WEEKLY_GRID, cursor: "pointer" }}
                onClick={() => onNavigate(r.callOrderId)}
              >
                <div className="link-text ellipsis">{r.callOrderName}</div>
                <div className="num">{r.weekLabel}</div>
                <div className="ellipsis">{r.file}</div>
                <div className="right status-token" style={{ color: status === 'draft' ? '#f57c00' : undefined }}>
                  {statusLabel}
                </div>
              </div>
            );
          })}
          {weeklyCount === 0 && (
            <div className="card-empty">
              You haven't created any weekly reports yet. Weekly reports are created from the Call Orders page.
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="uploader" style={{ marginBottom: 18 }}>
            <div className="uploader-text">
              <div className="title">Monthly Status Report</div>
              <div className="desc">Create a monthly report covering all your assigned call orders for a specific period.</div>
            </div>
            <Button primary onClick={() => setShowCreateModal(true)}>Create Report</Button>
          </div>
          
          {showCreateModal && (
            <div className="form-card" style={{ marginBottom: 18 }}>
              <div className="form-head">New Monthly Status Report</div>
              <div className="form-body">
                <Field label="Reporting period (e.g. June 2026)">
                  <TextInput value={newPeriod} onChange={setNewPeriod} />
                </Field>
                <div className="form-actions">
                  <Button onClick={() => setShowCreateModal(false)}>Cancel</Button>
                  <Button onClick={() => createMonthlyReport("blank")}>Create blank</Button>
                  <Button primary onClick={() => createMonthlyReport("draft")}>Draft from portal data</Button>
                </div>
              </div>
            </div>
          )}
        
          <div className="card">
            <div className="card-head">
              <div className="card-title">Monthly Status Reports</div>
            </div>
          <div className="grid thead log" style={{ gridTemplateColumns: MONTHLY_GRID }}>
            <SortHeaders cols={MONTHLY_COLS} cur={monthlySort.cur} onSort={monthlySort.toggle} />
          </div>
          {monthlySort.sorted.map((r) => (
            <div
              key={r.id}
              className="grid trow log"
              style={{ gridTemplateColumns: MONTHLY_GRID }}
            >
              <div className="num">{r.period}</div>
              <div className="link-text ellipsis">{r.file}</div>
              <div className="right status-token">{r.status}</div>
            </div>
          ))}
          {monthlyCount === 0 && (
            <div className="card-empty">
              You haven't created any monthly reports yet. Create one from the Monthly Status Reports page.
            </div>
          )}
        </div>
        </>
      )}
    </div>
  );
}
