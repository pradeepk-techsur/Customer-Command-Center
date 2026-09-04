import { useEffect, useState } from "react";
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

export function WeeklyReportsTab({ order: c, isPm, mutate }: { order: CallOrder; isPm: boolean; mutate: Mutate }) {
  const reports = c.weeklyReports;
  const [selected, setSelected] = useState<number | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [wf, setWf] = useState(emptyForm);
  useEffect(() => { setSelected(null); setFormOpen(false); }, [c.id]);

  const open: WeeklyReport | undefined = reports.find((r) => r.id === selected) || reports[0];
  const { sorted, cur, toggle } = useSort("wsr", "week", reports, {
    week: (r) => localDate(r.weekEnding)?.getTime() ?? 0, file: (r) => r.file, by: (r) => r.submittedBy, status: (r) => r.status,
  });

  const openForm = () => {
    setWf({ ...emptyForm, week: todayLabel(), by: c.pm === "—" ? "" : c.pm });
    setFormOpen(true);
  };
  const submit = () => mutate(() => api.createWeekly(c.id, {
    weekEnding: wf.week, submittedBy: wf.by,
    accomplishments: lines(wf.acc), planned: lines(wf.plan), risks: lines(wf.risk), issues: lines(wf.issue), actions: lines(wf.act),
  })).then((s) => {
    setFormOpen(false);
    const created = s?.callOrders.find((x) => x.id === c.id)?.weeklyReports.find((r) => r.createdInPortal);
    if (created) setSelected(created.id);
  });
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
          <div className="form-head">New weekly status report</div>
          <div className="form-body">
            <div className="two-col">
              <Field label="Week ending"><TextInput value={wf.week} onChange={set("week")} /></Field>
              <Field label="Submitted by (Project Manager)"><TextInput value={wf.by} onChange={set("by")} /></Field>
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
              <Button onClick={() => setFormOpen(false)}>Cancel</Button>
              <Button primary onClick={submit}>Submit report</Button>
            </div>
          </div>
        </div>
      )}

      <div className="card" style={{ marginBottom: 18 }}>
        <div className="grid thead log" style={{ gridTemplateColumns: COLS }}><SortHeaders cols={WSR_COLS} cur={cur} onSort={toggle} /></div>
        {sorted.map((r) => (
          <div key={r.id} className={"grid trow log" + (open && r.id === open.id ? " active" : "")} style={{ gridTemplateColumns: COLS }} onClick={() => setSelected(r.id)}>
            <div className="num">{r.weekLabel}</div>
            <div className="link-text ellipsis">{r.file}</div>
            <div className="muted">{r.submittedBy}</div>
            <div className="right status-token">{r.status}</div>
          </div>
        ))}
        {!reports.length && <div className="card-empty">No weekly reports have been submitted for this call order.</div>}
      </div>

      <div className="card">
        <div className="card-head pane">
          <div>
            <div className="pane-title">{open ? (open.createdInPortal ? `Weekly Status Report — week ending ${open.weekLabel}` : `Weekly Touchpoint — ${open.weekLabel}`) : "No report selected"}</div>
            <div className="pane-sub">{open ? `${c.id} · ${open.file}${open.submittedBy ? " · " + open.submittedBy : ""}` : ""}</div>
          </div>
          {open && open.href && <a href={open.href} target="_blank" rel="noreferrer" style={{ fontSize: 12, whiteSpace: "nowrap" }}>Open source document</a>}
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
