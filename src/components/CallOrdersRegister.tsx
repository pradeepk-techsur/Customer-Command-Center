import type { CallOrder, PortalSnapshot } from "../../shared/types.ts";
import { useSort } from "../hooks/useSort.ts";
import { burnColor, dateLabel, filled, isVacant, localDate, mostOverdueStamp, pctOf, periodState, usd } from "../lib/format.ts";
import { Eyebrow, FileButton, SortHeaders } from "./ui.tsx";
import type { Tab } from "./CallOrderDetail.tsx";

export interface Group { key: string; name: string; periods: CallOrder[]; current: CallOrder }

/** One row per call order: option periods roll up onto the period that is current today. */
export function groupCallOrders(orders: CallOrder[], today: string): Group[] {
  const groups: Group[] = [];
  for (const c of orders) {
    let g = groups.find((x) => x.key === c.groupKey);
    if (!g) { g = { key: c.groupKey, name: c.groupName, periods: [], current: c }; groups.push(g); }
    g.periods.push(c);
  }
  for (const g of groups) {
    g.current = g.periods.find((p) => periodState(p, today) === "current")
      || g.periods.filter((p) => periodState(p, today) === "prior").slice(-1)[0]
      || g.periods[0];
  }
  return groups;
}

const COLS = [
  { key: "co", label: "Call order" }, { key: "pop", label: "Period of performance" },
  { key: "people", label: "People", align: "right" as const }, { key: "funded", label: "Funded", align: "right" as const },
  { key: "spend", label: "Actual spend", align: "right" as const }, { key: "updated", label: "Last updated", align: "right" as const },
];

export function CallOrdersRegister({ snapshot, isPm, onOpen, onUpload }: {
  snapshot: PortalSnapshot; isPm: boolean; onOpen: (id: string, tab: Tab) => void; onUpload: (files: FileList) => void;
}) {
  const { callOrders: all, today, config } = snapshot;
  const groups = groupCallOrders(all, today);
  const { sorted, cur, toggle } = useSort("register", "co", groups, {
    co: (g) => g.key,
    pop: (g) => localDate(g.current.popStart)?.getTime() ?? 0,
    people: (g) => filled(g.current),
    funded: (g) => g.current.funded,
    spend: (g) => g.current.spend,
    updated: (g) => localDate(mostOverdueStamp(g.current, today, config).stamp)?.getTime() ?? 0,
  });

  const totalFunded = all.reduce((s, c) => s + c.funded, 0);
  const totalSpend = all.reduce((s, c) => s + c.spend, 0);
  const assigned = all.reduce((s, c) => s + filled(c), 0);
  const open = all.reduce((s, c) => s + c.staff.filter((x) => isVacant(x.name)).length, 0);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Call Orders</h1>
          <div className="page-sub">{groups.length} call orders · {all.length} funded periods · {assigned} personnel assigned · {open} open positions</div>
        </div>
        <div className="totals">
          {isPm && (
            <FileButton className="btn outline" onFiles={onUpload}>
              <span className="plus">+</span><span>Upload call order</span>
            </FileButton>
          )}
          <div><Eyebrow>Obligated</Eyebrow><div className="total-value num" style={{ marginTop: 4 }}>{usd(totalFunded)}</div></div>
          <div><Eyebrow>Expended</Eyebrow><div className="total-value num" style={{ marginTop: 4 }}>{usd(totalSpend)}</div></div>
        </div>
      </div>

      <div className="card">
        <div className="grid thead register-cols"><SortHeaders cols={COLS} cur={cur} onSort={toggle} /></div>
        {sorted.map((g) => {
          const c = g.current;
          const pct = pctOf(c.spend, c.funded);
          const stamp = mostOverdueStamp(c, today, config);
          const idLine = c.pending ? `${g.key} · pending setup`
            : g.periods.length > 1 ? `${g.key} · ${c.id} · ${g.periods.length} periods` : `${g.key} · ${c.id}`;
          const burning = c.funded > 0 && c.spend > 0;
          return (
            <div key={g.key} className="grid trow clickable register-cols" onClick={() => onOpen(c.id, "Financials")}>
              <div>
                <div className="register-name">{g.name}</div>
                <div className="register-id">{idLine}</div>
              </div>
              <div className="num" style={{ color: "var(--ink-3)" }}>{c.pop}</div>
              <button type="button" className="people-link num" onClick={(e) => { e.stopPropagation(); onOpen(c.id, "People"); }}>
                {c.staff.length ? filled(c) : "—"}
              </button>
              <div className="num right">{c.funded ? usd(c.funded) : "—"}</div>
              <div className="right">
                <div className="num">{c.funded ? usd(c.spend) : "—"}</div>
                <div className="burn-track"><div className="burn-fill" style={{ width: Math.min(pct, 100) + "%", background: burnColor(pct) }} /></div>
                <div className="burn-pct" style={{ color: burning ? burnColor(pct) : "var(--label)" }}>
                  {c.funded ? (c.spend ? pct + "% expended" : "not yet started") : "awaiting funding data"}
                </div>
              </div>
              <div className={"stamp right" + (stamp.stale ? " stale" : "")}>{dateLabel(stamp.stamp)}</div>
            </div>
          );
        })}
      </div>
      <div className="source-note">Source: Project Financial Analysis (AO EAC Table), Call Order Staffing, Jun 2026 MSR</div>
    </div>
  );
}
