import { useEffect, useState, useRef } from "react";
import type { CallOrder, WeeklyReport } from "../../shared/types.ts";
import { api } from "../api.ts";
import { useSort } from "../hooks/useSort.ts";
import { lines, localDate, todayLabel } from "../lib/format.ts";
import { Button, Eyebrow, Field, FileButton, SortHeaders, TextArea, TextInput } from "./ui.tsx";
import type { Mutate } from "../App.tsx";

const WSR_COLS = [
  { key: "week", label: "Week ending" }, { key: "file", label: "File" },
  { key: "by", label: "Submitted by" }, { key: "status", label: "Status", align: "right" as const },
];
const COLS = "1fr 2fr 1fr 0.8fr";
const emptyForm = { week: "", by: "", acc: "", plan: "", risk: "", issue: "", act: "" };

type SaveStatus = "idle" | "saving" | "saved" | "error";

interface Week {
  value: string;  // YYYY-MM-DD
  label: string;  // "Sep 8, 2026"
}

export function WeeklyReportsTab({ order: c, isPm, userName, mutate }: { order: CallOrder; isPm: boolean; userName?: string; mutate: Mutate }) {
  const reports = c.weeklyReports;
  const [selected, setSelected] = useState<number | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [wf, setWf] = useState(emptyForm);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const saveTimeoutRef = useRef<number | null>(null);
  const editingReportIdRef = useRef<number | null>(null);
  const [weeks, setWeeks] = useState<Week[]>([]);
  
  useEffect(() => { setSelected(null); setFormOpen(false); setEditMode(false); }, [c.id]);
  
  // Load available weeks on mount
  useEffect(() => {
    api.getWeeks()
      .then(data => setWeeks(data.weeks))
      .catch(() => { /* Weeks list will remain empty if loading fails */ });
  }, []);

  const open: WeeklyReport | undefined = reports.find((r) => r.id === selected) || reports[0];
  const { sorted, cur, toggle } = useSort("wsr", "week", reports, {
    week: (r) => localDate(r.weekEnding)?.getTime() ?? 0, file: (r) => r.file, by: (r) => r.submittedBy, status: (r) => r.statusV2 || r.status,
  });

  // Auto-save effect with 3-second debounce
  useEffect(() => {
    if (!editMode || !editingReportIdRef.current) return;
    
    // Clear existing timeout
    if (saveTimeoutRef.current) {
      window.clearTimeout(saveTimeoutRef.current);
    }
    
    // Set new timeout for auto-save
    setSaveStatus("idle");
    saveTimeoutRef.current = window.setTimeout(() => {
      autoSave();
    }, 3000);
    
    return () => {
      if (saveTimeoutRef.current) {
        window.clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [wf, editMode]);
  
  const autoSave = async () => {
    if (!editingReportIdRef.current || !editMode) return;
    
    setSaveStatus("saving");
    try {
      await mutate(() => api.editWeekly(c.id, editingReportIdRef.current!, {
        weekEnding: wf.week, 
        submittedBy: wf.by,
        accomplishments: lines(wf.acc), 
        planned: lines(wf.plan), 
        risks: lines(wf.risk), 
        issues: lines(wf.issue), 
        actions: lines(wf.act),
      }));
      setSaveStatus("saved");
      setLastSaved(new Date());
    } catch (err) {
      setSaveStatus("error");
      // Error status is already reflected in UI
    }
  };

  const openForm = () => {
    // Set default week to the most recent Sunday
    const defaultWeek = weeks.length > 0 ? weeks[0].label : todayLabel();
    // Use logged-in user's name, fallback to call order PM name
    const submittedBy = userName || (c.pm === "—" ? "" : c.pm);
    
    // Check if report already exists for this week
    const existingReport = reports.find(r => r.weekLabel === defaultWeek);
    if (existingReport) {
      // Open existing report in edit mode instead of creating new
      openEditMode(existingReport);
      return;
    }
    
    setWf({ ...emptyForm, week: defaultWeek, by: submittedBy });
    setFormOpen(true);
    setEditMode(false);
    editingReportIdRef.current = null;
  };
  
  const openEditMode = (report: WeeklyReport) => {
    // Load report data into form
    const groups = report.groups;
    const acc = groups.find(g => g.label === "Accomplishments")?.items.join("\n") || "";
    const plan = groups.find(g => g.label === "Planned activities")?.items.join("\n") || "";
    const risk = groups.find(g => g.label === "Risks")?.items.join("\n") || "";
    const issue = groups.find(g => g.label === "Issues")?.items.join("\n") || "";
    const act = groups.find(g => g.label === "Customer actions and decisions")?.items.join("\n") || "";
    
    setWf({ 
      week: report.weekLabel, 
      by: report.submittedBy, 
      acc, 
      plan, 
      risk, 
      issue, 
      act 
    });
    setEditMode(true);
    setFormOpen(true);
    editingReportIdRef.current = report.id;
    setSaveStatus("idle");
    setLastSaved(null);
  };
  const submitAsDraft = () => {
    // Check if report already exists for this week
    const existingReport = reports.find(r => r.weekLabel === wf.week);
    if (existingReport) {
      alert(`A report already exists for week ending ${wf.week}. Please select a different week or edit the existing report.`);
      return;
    }
    
    return mutate(() => api.createWeekly(c.id, {
      weekEnding: wf.week, submittedBy: wf.by,
      accomplishments: lines(wf.acc), planned: lines(wf.plan), risks: lines(wf.risk), issues: lines(wf.issue), actions: lines(wf.act),
    })).then((s) => {
      setFormOpen(false);
      setEditMode(false);
      editingReportIdRef.current = null;
      const created = s?.callOrders.find((x) => x.id === c.id)?.weeklyReports.find((r) => r.createdInPortal);
      if (created) setSelected(created.id);
    });
  };
  
  const submitForReview = async () => {
    // Check if report already exists for this week
    const existingReport = reports.find(r => r.weekLabel === wf.week);
    if (existingReport) {
      alert(`A report already exists for week ending ${wf.week}. Please select a different week or edit the existing report.`);
      return;
    }
    
    // Create the report first
    const s = await mutate(() => api.createWeekly(c.id, {
      weekEnding: wf.week, submittedBy: wf.by,
      accomplishments: lines(wf.acc), planned: lines(wf.plan), risks: lines(wf.risk), issues: lines(wf.issue), actions: lines(wf.act),
    }));
    
    const created = s?.callOrders.find((x) => x.id === c.id)?.weeklyReports.find((r) => r.createdInPortal);
    if (created) {
      // Submit it immediately
      await mutate(() => api.submitWeekly(c.id, created.id));
      setSelected(created.id);
    }
    
    setFormOpen(false);
    setEditMode(false);
    editingReportIdRef.current = null;
  };
  
  const submitDraft = async () => {
    if (!editingReportIdRef.current) return;
    
    // First ensure latest changes are saved
    if (saveTimeoutRef.current) {
      window.clearTimeout(saveTimeoutRef.current);
      await autoSave();
    }
    
    // Then submit the report
    await mutate(() => api.submitWeekly(c.id, editingReportIdRef.current!));
    setFormOpen(false);
    setEditMode(false);
    editingReportIdRef.current = null;
  };
  const uploadFiles = (files: FileList) => mutate(() => api.uploadWeekly(c.id, files)).then((s) => {
    const up = s?.callOrders.find((x) => x.id === c.id)?.weeklyReports.find((r) => r.status === "Uploaded");
    if (up) setSelected(up.id);
  });

  const set = (k: keyof typeof emptyForm) => (v: string) => setWf({ ...wf, [k]: v });
  const pending = !open || open.status === "Uploaded";

  return (
    <>
      {isPm && (
        <div className="uploader">
          <div className="uploader-text">
            <div className="title">Weekly status report</div>
            <div className="desc">The Project Manager records accomplishments, planned activities, risks, issues, customer actions and decisions — filled in here or uploaded as a document.</div>
          </div>
          <Button primary onClick={openForm}>Create report</Button>
          <FileButton onFiles={uploadFiles}>Upload file</FileButton>
        </div>
      )}

      {formOpen && (
        <div className="form-card">
          <div className="form-head">
            {editMode ? "Edit weekly status report (Draft)" : "New weekly status report"}
            {editMode && (
              <span style={{ marginLeft: "auto", fontSize: 13, fontWeight: "normal", color: "#666" }}>
                {saveStatus === "saving" && "Saving..."}
                {saveStatus === "saved" && lastSaved && `Saved at ${lastSaved.toLocaleTimeString()}`}
                {saveStatus === "error" && <span style={{ color: "#d32f2f" }}>Save failed</span>}
              </span>
            )}
          </div>
          <div className="form-body">
            <div className="two-col">
              <Field label="Week ending (Sunday)">
                <select 
                  value={wf.week} 
                  onChange={(e) => set("week")(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    fontSize: 14,
                    border: '1px solid #ddd',
                    borderRadius: 4,
                    backgroundColor: 'white',
                  }}
                >
                  {weeks.map(week => (
                    <option key={week.value} value={week.label}>
                      {week.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Submitted by (Project Manager)">
                <TextInput value={wf.by} onChange={set("by")} disabled={true} />
              </Field>
            </div>
            <div className="two-col">
              <Field label="Accomplishments — one per line"><TextArea rows={5} value={wf.acc} onChange={set("acc")} /></Field>
              <Field label="Planned activities — one per line"><TextArea rows={5} value={wf.plan} onChange={set("plan")} /></Field>
            </div>
            <div className="three-col">
              <Field label="Risks"><TextArea rows={3} value={wf.risk} onChange={set("risk")} /></Field>
              <Field label="Issues"><TextArea rows={3} value={wf.issue} onChange={set("issue")} /></Field>
              <Field label="Customer actions and decisions"><TextArea rows={3} value={wf.act} onChange={set("act")} /></Field>
            </div>
            <div className="form-actions">
              <Button onClick={() => { setFormOpen(false); setEditMode(false); editingReportIdRef.current = null; }}>
                {editMode ? "Close" : "Cancel"}
              </Button>
              {editMode ? (
                open && open.statusV2 === 'submitted' ? (
                  <Button primary onClick={submitDraft}>Update Submission</Button>
                ) : (
                  <Button primary onClick={submitDraft}>Submit for Review</Button>
                )
              ) : (
                <>
                  <Button onClick={submitAsDraft}>Save as Draft</Button>
                  <Button primary onClick={submitForReview}>Submit for Review</Button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="card" style={{ marginBottom: 18 }}>
        <div className="grid thead log" style={{ gridTemplateColumns: COLS }}><SortHeaders cols={WSR_COLS} cur={cur} onSort={toggle} /></div>
        {sorted.map((r) => {
          const status = r.statusV2 || r.status;
          const statusLabel = status === 'draft' ? 'Draft' : status === 'submitted' ? 'Submitted' : status === 'uploaded' ? 'Uploaded' : status;
          return (
            <div key={r.id} className={"grid trow log" + (open && r.id === open.id ? " active" : "")} style={{ gridTemplateColumns: COLS }} onClick={() => setSelected(r.id)}>
              <div className="num">{r.weekLabel}</div>
              <div className="link-text ellipsis">{r.file}</div>
              <div className="muted">{r.submittedBy}</div>
              <div className="right status-token" style={{ color: status === 'draft' ? '#f57c00' : undefined }}>{statusLabel}</div>
            </div>
          );
        })}
        {!reports.length && <div className="card-empty">No weekly reports have been submitted for this call order.</div>}
      </div>

      <div className="card">
        <div className="card-head pane">
          <div>
            <div className="pane-title">{open ? (open.createdInPortal ? `Weekly Status Report — week ending ${open.weekLabel}` : `Weekly Touchpoint — ${open.weekLabel}`) : "No report selected"}</div>
            <div className="pane-sub">
              {open ? `${c.id.replace(/^Call\s+/i, '').split('.')[0]} · ${open.file}${open.submittedBy ? " · " + open.submittedBy : ""}` : ""}
              {open && open.statusV2 === 'draft' && <span style={{ marginLeft: 8, color: '#f57c00', fontWeight: 'bold' }}>· DRAFT</span>}
            </div>
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            {open && open.createdInPortal && (open.statusV2 === 'draft' || open.statusV2 === 'submitted') && isPm && (
              <Button primary onClick={() => openEditMode(open)}>
                {open.statusV2 === 'draft' ? 'Edit Draft' : 'Edit Report'}
              </Button>
            )}
            {open && open.href && <a href={open.href} target="_blank" rel="noreferrer" style={{ fontSize: 12, whiteSpace: "nowrap" }}>Open source document</a>}
          </div>
        </div>
        {pending ? (
          <div className="card-empty">
            {open ? "Uploaded. Accomplishments, risks, issues and actions are extracted from the document once processed." : "No weekly reports have been submitted for this call order."}
          </div>
        ) : (
          <div className="report-body">
            {open!.groups.map((g) => (
              <div key={g.label}>
                <Eyebrow>{g.label}</Eyebrow>
                {g.items.map((h, i) => <div key={i} className="report-item"><div className="dash">—</div><div>{h}</div></div>)}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
