import { Fragment, useEffect, useMemo, useState } from "react";
import type { ReportsData } from "../../shared/types.ts";
import { api } from "../api.ts";
import { dateLabel, rate, usdFull } from "../lib/format.ts";
import { Eyebrow } from "./ui.tsx";

type ReportTab = "bpa" | "staffing";
const popLabel = (start: string | null, end: string | null) => `${dateLabel(start)} – ${dateLabel(end)}`;

export function ReportsPage() {
  const [data, setData] = useState<ReportsData | null>(null);
  const [tab, setTab] = useState<ReportTab>("bpa");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [callOrder, setCallOrder] = useState("all");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getReports().then(setData).catch((err: Error) => setError(err.message));
  }, []);

  const staffingCallOrders = useMemo(() => Array.from(new Set(data?.staffing.map((row) => row.callOrderNumber) || [])), [data]);
  const staffing = useMemo(() => (data?.staffing || []).filter((row) => {
    const needle = query.trim().toLowerCase();
    return (callOrder === "all" || row.callOrderNumber === callOrder)
      && (!needle || row.name.toLowerCase().includes(needle) || row.laborCategory.toLowerCase().includes(needle));
  }), [callOrder, data, query]);

  if (error) return <div className="page"><div className="notice error"><div><span>{error}</span></div></div></div>;
  if (!data) return <div className="loading">Loading reports…</div>;

  return (
    <div className="page">
      <div className="page-head"><div><h1>Reports</h1><div className="page-sub">BPA financial allocation and call order staffing.</div></div><div className="stamp">As of {dateLabel(data.generatedOn)}</div></div>
      <div className="tabs">
        <button type="button" className={`tab${tab === "bpa" ? " active" : ""}`} onClick={() => setTab("bpa")}>BPA Report</button>
        <button type="button" className={`tab${tab === "staffing" ? " active" : ""}`} onClick={() => setTab("staffing")}>Call Order Staffing</button>
      </div>

      {tab === "bpa" ? (
        <>
          <div className="report-stats">
            <div><Eyebrow>Obligated</Eyebrow><strong>{usdFull(data.bpa.obligated)}</strong></div>
            <div><Eyebrow>Expended</Eyebrow><strong>{usdFull(data.bpa.expended)}</strong></div>
            <div><Eyebrow>Remaining available</Eyebrow><strong>{usdFull(data.bpa.remaining)}</strong></div>
          </div>
          <div className="card report-table-wrap">
            <table className="report-table">
              <thead><tr><th>Call order</th><th>Title</th><th>Status</th><th>Period of performance</th><th className="right">Obligated</th><th className="right">Expended</th><th className="right">Remaining</th></tr></thead>
              <tbody>
                {data.bpa.callOrders.map((row) => {
                  const open = expanded.has(row.callOrderNumber);
                  return (
                    <Fragment key={row.callOrderNumber}>
                      <tr className="report-parent-row" onClick={() => setExpanded((current) => { const next = new Set(current); open ? next.delete(row.callOrderNumber) : next.add(row.callOrderNumber); return next; })}>
                        <td><span className={`accordion-chevron${open ? " open" : ""}`}>▶</span> <strong>{row.callOrderNumber}</strong><div className="page-sub">{row.periods.length} funded period{row.periods.length === 1 ? "" : "s"}</div></td>
                        <td>{row.title}</td><td><span className={`status-pill ${row.status}`}>{row.status}</span></td><td>{popLabel(row.popStart, row.popEnd)}</td>
                        <td className="right num">{usdFull(row.obligated)}</td><td className="right num">{usdFull(row.expended)}</td><td className="right num">{usdFull(row.remaining)}</td>
                      </tr>
                      {open && row.periods.map((period) => (
                        <tr className="report-period-row" key={period.id}><td>{period.id}</td><td colSpan={2}>Funded period · <span className={`status-pill ${period.status}`}>{period.status}</span></td><td>{period.pop}</td><td className="right num">{usdFull(period.obligated)}</td><td className="right num">{usdFull(period.expended)}</td><td className="right num">{usdFull(period.remaining)}</td></tr>
                      ))}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <>
          <div className="report-filters">
            <input className="input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search person or LCAT…" />
            <select className="input" value={callOrder} onChange={(event) => setCallOrder(event.target.value)}><option value="all">All call orders</option>{staffingCallOrders.map((number) => <option key={number} value={number}>{number}</option>)}</select>
            <div className="page-sub">{staffing.length} people</div>
          </div>
          <div className="card report-table-wrap">
            <table className="report-table"><thead><tr><th>Call order</th><th>Funded period</th><th>Name</th><th>LCAT</th><th className="right">Contract billing rate</th><th>Status</th></tr></thead>
              <tbody>{staffing.map((row, index) => <tr key={`${row.callOrderPeriod}-${row.name}-${index}`}><td><strong>{row.callOrderNumber}</strong><div className="page-sub">{row.callOrderTitle}</div></td><td>{row.callOrderPeriod}</td><td>{row.name}</td><td>{row.laborCategory}</td><td className="right num">{rate(row.rate)}</td><td>{row.status}</td></tr>)}</tbody>
            </table>
            {!staffing.length && <div className="card-empty">No staffing records match these filters.</div>}
          </div>
        </>
      )}
    </div>
  );
}
