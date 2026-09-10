import type { CallOrder, PortalSnapshot } from "../../shared/types.ts";
import { filled, periodState, usd } from "../lib/format.ts";
import { Eyebrow } from "./ui.tsx";
import { groupCallOrders } from "./CallOrdersRegister.tsx";
import { FinancialsTab } from "./FinancialsTab.tsx";
import { PeopleTab } from "./PeopleTab.tsx";
import { WeeklyReportsTab } from "./WeeklyReportsTab.tsx";
import { CallOrderHistory } from "./CallOrderHistory.tsx";
import type { Mutate } from "../App.tsx";

export type Tab = "Financials" | "People" | "Weekly Status Reports" | "History";

// Only Project Managers get Weekly Reports tab in call orders
// Program Managers, Admins, and Customers use top navigation tabs
// History tab is available to all roles
function getTabs(role: string): Tab[] {
  const baseTabs: Tab[] = ["Financials", "People"];
  if (role === "pm") {
    baseTabs.push("Weekly Status Reports");
  }
  baseTabs.push("History");
  return baseTabs;
}

export function CallOrderDetail({ snapshot, order: c, tab, isPm, userName, onBack, onTab, onSelectPeriod, mutate }: {
  snapshot: PortalSnapshot; order: CallOrder; tab: Tab; isPm: boolean; userName?: string;
  onBack: () => void; onTab: (t: Tab) => void; onSelectPeriod: (id: string) => void; mutate: Mutate;
}) {
  const role = snapshot.actor?.role || "customer";
  const TABS = getTabs(role);
  const { today } = snapshot;
  const group = groupCallOrders(snapshot.callOrders, today).find((g) => g.periods.some((p) => p.id === c.id));
  const staffCount = c.staff.length ? filled(c) : "—";

  return (
    <div className="page detail">
      <button type="button" className="back-link" onClick={onBack}><span className="mono">←</span><span>All call orders</span></button>

      <div className="detail-head">
        <div>
          <div className="detail-id">{c.groupKey} · {c.id.replace(/^Call\s+/i, '').split('.')[0]}</div>
          <h1 style={{ marginBottom: 8 }}>{c.groupName}</h1>
          <div className="page-sub">Period of performance {c.pop} · {periodState(c, today)} period · PM {c.pm}</div>
        </div>
        <div className="stat-box">
          <div><Eyebrow>Obligated</Eyebrow><div className="value num" style={{ marginTop: 5 }}>{usd(c.funded)}</div></div>
          <div><Eyebrow>Expended</Eyebrow><div className="value num" style={{ marginTop: 5 }}>{usd(c.spend)}</div></div>
          <div><Eyebrow>People</Eyebrow><div className="value num" style={{ marginTop: 5 }}>{staffCount}</div></div>
        </div>
      </div>

      {group && group.periods.length > 1 && (
        <div style={{ marginBottom: 22 }}>
          <Eyebrow>Option periods</Eyebrow>
          <div className="period-chips" style={{ marginTop: 8 }}>
            {group.periods.map((p) => (
              <button key={p.id} type="button" className={"period-chip" + (p.id === c.id ? " active" : "")} onClick={() => onSelectPeriod(p.id)}>
                <div className="l">{p.id}</div>
                <div className="s">{periodState(p, today)} · {p.pop}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="tabs">
        {TABS.map((t) => <button key={t} type="button" className={"tab" + (t === tab ? " active" : "")} onClick={() => onTab(t)}>{t}</button>)}
      </div>

      {tab === "Financials" && <FinancialsTab order={c} snapshot={snapshot} isPm={isPm} mutate={mutate} />}
      {tab === "People" && <PeopleTab order={c} snapshot={snapshot} isPm={isPm} mutate={mutate} />}
      {tab === "Weekly Status Reports" && <WeeklyReportsTab order={c} isPm={isPm} userName={userName} mutate={mutate} />}
      {tab === "History" && <CallOrderHistory callOrderId={c.id} userRole={snapshot.actor?.role || 'customer'} />}
    </div>
  );
}
