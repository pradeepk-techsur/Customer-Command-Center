import type { CallOrder } from "../../shared/types.ts";
import { dateLabel, localDate, usdFull } from "../lib/format.ts";
import { Eyebrow } from "./ui.tsx";

/** Read-only roll-up shown alongside the weekly narrative: current financials, staffing, risks, issues, and invoice status. */
export function WeeklySummaryPanel({ order: c, today }: { order: CallOrder; today: string }) {
  const remaining = c.funded - c.spend;
  const popEnd = localDate(c.popEnd);
  const daysToEnd = popEnd ? Math.round((popEnd.getTime() - localDate(today)!.getTime()) / 86400000) : null;
  const popRed = daysToEnd !== null && daysToEnd >= 0 && daysToEnd <= 30;
  const eacRed = c.eac !== null && c.eac > c.funded;
  const overRed = c.over !== null && c.over > 0;

  const oneWeekAgo = new Date(localDate(today)!.getTime() - 7 * 86400000);
  const isRecent = (iso: string | null) => iso ? localDate(iso)!.getTime() >= oneWeekAgo.getTime() : false;
  const risks = c.risks.filter((r) => r.status === "open" || (r.closedAt && isRecent(r.closedAt)));
  const issues = c.issues.filter((i) => i.status === "open" || (i.closedAt && isRecent(i.closedAt)));

  const mostRecentInvoice = [...c.invoices].sort((a, b) => (a.invoiceDate < b.invoiceDate ? 1 : -1))[0];
  const showInvoice = mostRecentInvoice && (mostRecentInvoice.paymentStatus === "unpaid" || (mostRecentInvoice.paidDate && isRecent(mostRecentInvoice.paidDate)));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <Eyebrow>Funding and financial summary</Eyebrow>
        <div className="fin-row"><div style={{ color: "var(--ink-3)" }}>Current period of performance</div><div className="v" style={popRed ? { color: "var(--burn-high)", fontWeight: 600 } : undefined}>{c.pop}</div></div>
        <div className="fin-row"><div style={{ color: "var(--ink-3)" }}>Funds obligated</div><div className="v num">{usdFull(c.funded)}</div></div>
        <div className="fin-row"><div style={{ color: "var(--ink-3)" }}>Funds expended to date</div><div className="v num">{usdFull(c.spend)}</div></div>
        <div className="fin-row"><div style={{ color: "var(--ink-3)" }}>Funds remaining</div><div className="v num">{usdFull(remaining)}</div></div>
        <div className="fin-row"><div style={{ color: "var(--ink-3)" }}>Estimate at completion</div><div className="v num" style={eacRed ? { color: "var(--burn-high)", fontWeight: 600 } : undefined}>{usdFull(c.eac)}</div></div>
        <div className="fin-row"><div style={{ color: "var(--ink-3)" }}>Over / under</div><div className="v num" style={overRed ? { color: "var(--burn-high)", fontWeight: 600 } : undefined}>{usdFull(c.over)}</div></div>
      </div>

      <div>
        <Eyebrow>Staffing summary</Eyebrow>
        {c.laborCategories.map((l) => {
          const assigned = c.staff.filter((s) => s.laborCategory === l.name);
          return (
            <div key={l.id} className="fin-row">
              <div style={{ color: "var(--ink-3)" }}>{l.name}</div>
              <div className="v">{assigned.length ? assigned.map((s) => s.name).join(", ") : l.vacancyStatus ? `Open — ${l.vacancyStatus.replace("_", " ")}` : "Open"}</div>
            </div>
          );
        })}
        {!c.laborCategories.length && <div className="card-empty">No labor categories tracked.</div>}
      </div>

      <div>
        <Eyebrow>Risks summary</Eyebrow>
        {risks.map((r) => (
          <div key={r.id} className="report-item" style={{ opacity: r.status === "closed" ? 0.6 : 1 }}>
            <div className="dash">—</div><div>{r.description} ({r.severity} severity{r.status === "closed" ? ", closed" : ""})</div>
          </div>
        ))}
        {!risks.length && <div className="card-empty">No open risks.</div>}
      </div>

      <div>
        <Eyebrow>Issues summary</Eyebrow>
        {issues.map((i) => (
          <div key={i.id} className="report-item" style={{ opacity: i.status === "closed" ? 0.6 : 1 }}>
            <div className="dash">—</div><div>{i.description}{i.status === "closed" ? " (closed)" : ""}</div>
          </div>
        ))}
        {!issues.length && <div className="card-empty">No open issues.</div>}
      </div>

      <div>
        <Eyebrow>Invoice status</Eyebrow>
        {showInvoice ? (
          <div className="fin-row">
            <div style={{ color: "var(--ink-3)" }}>Invoice #{mostRecentInvoice.invoiceNumber} — {dateLabel(mostRecentInvoice.invoiceDate)}</div>
            <div className="v num">{usdFull(mostRecentInvoice.amount)} · {mostRecentInvoice.paymentStatus === "paid" ? `Paid ${dateLabel(mostRecentInvoice.paidDate)}` : "Unpaid"}</div>
          </div>
        ) : <div className="card-empty">No recent invoice activity.</div>}
      </div>
    </div>
  );
}
