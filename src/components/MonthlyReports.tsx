import { useEffect, useState } from "react";
import type { CallOrder, MonthlyReport, MsrSection, PortalSnapshot } from "../../shared/types.ts";
import { api } from "../api.ts";
import { useSort } from "../hooks/useSort.ts";
import { dateLabel, fromEntries, lines, localDate, monthLabel, toEntries, usdFull } from "../lib/format.ts";
import { Button, Eyebrow, Field, FileButton, SortHeaders, TextArea, TextInput } from "./ui.tsx";
import type { Mutate } from "../App.tsx";

const MSR_COLS = [
  { key: "period", label: "Reporting period" }, { key: "file", label: "File" },
  { key: "by", label: "Submitted by" }, { key: "due", label: "Due" }, { key: "status", label: "Status", align: "right" as const },
];
const LOG_COLS = "1fr 2fr 1fr 0.9fr 0.9fr";
const EMP_COLS = [
  { key: "division", label: "Division" }, { key: "name", label: "Staff" }, { key: "start", label: "Start date" }, { key: "lcat", label: "TSO LCAT" },
];

interface SectionForm { obligated: string; expended: string; remaining: string; eac: string; over: string; completed: string; planned: string; risks: string; issues: string; travel: string }

function formFor(sec: MsrSection | null, co: CallOrder): SectionForm {
  const f = (i: number) => sec && sec.funding[i] && sec.funding[i].value !== null ? String(sec.funding[i].value) : "";
  return sec ? {
    obligated: f(0), expended: f(1), remaining: f(2), eac: f(3), over: f(4),
    completed: fromEntries(sec.completed), planned: fromEntries(sec.planned),
    risks: sec.risks.join("\n"), issues: sec.issues.join("\n"), travel: sec.travel,
  } : {
    obligated: String(co.funded), expended: String(co.spend), remaining: String(co.funded - co.spend),
    eac: co.eac === null ? "" : String(co.eac), over: co.over === null ? "" : String(co.over),
    completed: "", planned: "", risks: "", issues: "", travel: "N/A",
  };
}

export function MonthlyReports({ snapshot, isPm, mutate }: { snapshot: PortalSnapshot; isPm: boolean; mutate: Mutate }) {
  const reports = snapshot.monthlyReports;
  const orders = snapshot.callOrders.filter((c) => !c.pending);
  const [selectedReport, setSelectedReport] = useState<number | null>(null);
  const [selectedCall, setSelectedCall] = useState<string | null>(null);
  const [period, setPeriod] = useState(monthLabel());
  const [sf, setSf] = useState<SectionForm | null>(null);

  const rep: MonthlyReport | undefined = reports.find((r) => r.id === selectedReport) || reports[0];
  const co = orders.find((c) => c.id === selectedCall) || orders[0];
  const sec: MsrSection | null = rep && co ? rep.sections[co.id] || null : null;
  useEffect(() => { setSf(null); }, [rep?.id, co?.id]);

  const { sorted, cur, toggle } = useSort("msr", "period", reports, {
    period: (r) => localDate(r.periodStart)?.getTime() ?? 0, file: (r) => r.file, by: (r) => r.submittedBy,
    due: (r) => localDate(r.dueOn)?.getTime() ?? 0, status: (r) => r.status,
  });
  const staffRows = sec?.staffing || [];
  const emp = useSort("msrstaff", "name", staffRows, {
    division: (s) => s.division, name: (s) => s.name, start: (s) => Date.parse(s.start) || 0, lcat: (s) => s.lcat,
  });

  const create = (mode: "blank" | "draft") => mutate(() => api.createMonthly(period, mode)).then((s) => {
    if (!s) return;
    const newest = [...s.monthlyReports].sort((a, b) => b.id - a.id)[0];
    if (newest) setSelectedReport(newest.id);
  });
  const uploadFiles = (files: FileList) => mutate(() => api.uploadMonthly(period, files)).then((s) => {
    if (!s) return;
    const newest = [...s.monthlyReports].sort((a, b) => b.id - a.id)[0];
    if (newest) setSelectedReport(newest.id);
  });

  const saveSection = () => {
    if (!rep || !co || !sf) return;
    mutate(() => api.saveSection(rep.id, co.id, {
      obligated: numOrNull(sf.obligated), expended: numOrNull(sf.expended), remaining: numOrNull(sf.remaining),
      eac: numOrNull(sf.eac), over: numOrNull(sf.over),
      completed: toEntries(sf.completed), planned: toEntries(sf.planned),
      risks: lines(sf.risks), issues: lines(sf.issues), travel: sf.travel,
    })).then(() => setSf(null));
  };
  const set = (k: keyof SectionForm) => (v: string) => setSf((f) => (f ? { ...f, [k]: v } : f));

  const hasSections = !!rep && (Object.keys(rep.sections).length > 0 || isPm);
  const draftedEmpty = !!sec && sec.drafted && !sec.completed.length;

  return (
    <div className="page">
      <div style={{ marginBottom: 22 }}>
        <h1>Monthly Status Reports</h1>
        <div className="page-sub">Contractual deliverable submitted at the BPA level. Each report covers all active call orders.</div>
      </div>

      {isPm && (
        <div className="uploader msr">
          <div className="uploader-text">
            <div className="title">Monthly status report</div>
            <div className="desc">One document per reporting period, covering funding, monthly activity, staffing, travel, issues and risks for every call order. Due the 15th of the following month. A draft assembles funding from the portal and activity from the weekly reports each PM submitted.</div>
          </div>
          <Field label="Reporting period"><TextInput value={period} onChange={setPeriod} style={{ width: 150 }} /></Field>
          <Button primary onClick={() => create("blank")}>New report</Button>
          <Button onClick={() => create("draft")}>Draft from portal data</Button>
          <FileButton onFiles={uploadFiles}>Upload file</FileButton>
        </div>
      )}

      <div className="card" style={{ marginBottom: 22 }}>
        <div className="grid thead log" style={{ gridTemplateColumns: LOG_COLS }}><SortHeaders cols={MSR_COLS} cur={cur} onSort={toggle} /></div>
        {sorted.map((r) => (
          <div key={r.id} className={"grid trow log" + (rep && r.id === rep.id ? " active" : "")} style={{ gridTemplateColumns: LOG_COLS }} onClick={() => setSelectedReport(r.id)}>
            <div className="num">{r.period}</div>
            <div className="link-text ellipsis">{r.file}</div>
            <div className="muted">{r.submittedBy}</div>
            <div className="muted num">{dateLabel(r.dueOn)}</div>
            <div className="right status-token">{r.status}</div>
          </div>
        ))}
        {!reports.length && <div className="card-empty">No monthly status reports have been submitted yet.</div>}
      </div>

      {rep && (
        <div className="card">
          <div className="card-head pane">
            <div>
              <div className="pane-title">Monthly Status Report — {rep.period}</div>
              <div className="pane-sub">{rep.file} · {rep.scope || "reporting period " + rep.period} · submitted by {rep.submittedBy} · {rep.status}</div>
            </div>
            {rep.href && <a href={rep.href} target="_blank" rel="noreferrer" style={{ fontSize: 12, whiteSpace: "nowrap" }}>Open source document</a>}
          </div>

          {!hasSections ? (
            <div className="card-empty">Uploaded. Call order sections are extracted from the document once processed.</div>
          ) : (
            <div className="msr-layout">
              <div className="rail">
                <Eyebrow>Call order sections</Eyebrow>
                {orders.map((o) => {
                  const has = !!rep.sections[o.id];
                  return (
                    <button key={o.id} type="button" className={"rail-item" + (co && o.id === co.id ? " active" : "") + (has ? "" : " missing")} onClick={() => setSelectedCall(o.id)}>
                      <div className="l">{o.id}</div>
                      <div className="s">{has ? o.name : "No section yet"}</div>
                    </button>
                  );
                })}
              </div>
              {co && (
                <div>
                  <div className="section-head">
                    <div>
                      <div className="t">{sec?.title || `${co.id} — ${co.name}`}</div>
                      <div className="s">{co.id} · {co.name} · reporting period {rep.period}</div>
                    </div>
                    {isPm && <Button onClick={() => setSf(formFor(sec, co))}>{sec ? "Edit section" : "Add section for this call order"}</Button>}
                  </div>

                  {sf && (
                    <div className="sf-card">
                      <div className="form-head">{(sec ? "Edit" : "Add") + " section — " + co.id}</div>
                      <div className="form-body">
                        <div>
                          <Eyebrow>Funding information</Eyebrow>
                          <div className="five-col" style={{ marginTop: 8 }}>
                            <Field label="Obligated" plain><TextInput small value={sf.obligated} onChange={set("obligated")} /></Field>
                            <Field label="Expended" plain><TextInput small value={sf.expended} onChange={set("expended")} /></Field>
                            <Field label="Remaining" plain><TextInput small value={sf.remaining} onChange={set("remaining")} /></Field>
                            <Field label="EAC" plain><TextInput small value={sf.eac} onChange={set("eac")} /></Field>
                            <Field label="Over / under" plain><TextInput small value={sf.over} onChange={set("over")} /></Field>
                          </div>
                        </div>
                        <div className="two-col">
                          <Field label='Activities completed — one per line, optional "Workstream: text"'><TextArea small rows={7} value={sf.completed} onChange={set("completed")} /></Field>
                          <Field label="Activities planned — one per line"><TextArea small rows={7} value={sf.planned} onChange={set("planned")} /></Field>
                        </div>
                        <div className="risk-cols">
                          <Field label="High priority risks"><TextArea small rows={4} value={sf.risks} onChange={set("risks")} /></Field>
                          <Field label="High priority issues"><TextArea small rows={4} value={sf.issues} onChange={set("issues")} /></Field>
                          <Field label="Requested travel"><TextArea small rows={4} value={sf.travel} onChange={set("travel")} /></Field>
                        </div>
                        <div className="form-actions">
                          <Button onClick={() => setSf(null)}>Cancel</Button>
                          <Button primary onClick={saveSection}>Save section</Button>
                        </div>
                      </div>
                    </div>
                  )}

                  {draftedEmpty && (
                    <div className="section-note">Drafted from portal data. No weekly status reports were submitted for this call order in this period, so the activity sections are empty.</div>
                  )}

                  {sec ? (
                    <div className="section-grid">
                      <div className="section-col">
                        <Eyebrow>Funding information</Eyebrow>
                        {sec.funding.map((f) => <div key={f.label} className="kv"><div style={{ color: "var(--ink-3)" }}>{f.label}</div><div className="v num">{usdFull(f.value)}</div></div>)}
                        <Eyebrow className="spaced">High priority risks</Eyebrow>
                        {(sec.risks.length ? sec.risks : ["N/A"]).map((r, i) => <div key={i} className="prose gap">{r}</div>)}
                        <Eyebrow className="spaced-sm">High priority issues</Eyebrow>
                        {(sec.issues.length ? sec.issues : ["N/A"]).map((r, i) => <div key={i} className="prose">{r}</div>)}
                        <Eyebrow className="spaced">Requested travel</Eyebrow>
                        <div className="prose">{sec.travel}</div>
                      </div>
                      <div className="section-col right-col">
                        <Eyebrow>Activities completed this period</Eyebrow>
                        {sec.completed.map((a, i) => <div key={i} className="activity"><b>{a.title}</b> {a.text}</div>)}
                        <Eyebrow className="spaced">Activities planned next period</Eyebrow>
                        {sec.planned.map((a, i) => <div key={i} className="activity"><b>{a.title}</b> {a.text}</div>)}
                        {staffRows.length > 0 && (
                          <>
                            <Eyebrow className="spaced">Employee listing</Eyebrow>
                            <div className="emp-cols head"><SortHeaders cols={EMP_COLS} cur={emp.cur} onSort={emp.toggle} /></div>
                            {emp.sorted.map((p, i) => (
                              <div key={i} className="emp-cols row">
                                <div style={{ color: "var(--label)" }}>{p.division}</div>
                                <div className="name">{p.name}</div>
                                <div className="muted num">{p.start}</div>
                                <div style={{ color: "var(--ink-3)" }}>{p.lcat}</div>
                              </div>
                            ))}
                          </>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="section-empty">
                      This call order has no section in the {rep.period} report.{isPm ? " Use “Add section for this call order” above to enter it." : ""}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function numOrNull(v: string): number | null {
  const n = parseFloat(String(v).replace(/[^0-9.\-]/g, ""));
  return isNaN(n) ? null : n;
}
