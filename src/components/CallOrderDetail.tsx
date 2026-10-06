import { useState } from "react";
import type { CallOrder, PortalSnapshot } from "../../shared/types.ts";
import { api } from "../api.ts";
import { callOrderLabel, filled, normalizeCallOrderId, periodState, usd } from "../lib/format.ts";
import { Button, Eyebrow, Field, TextInput } from "./ui.tsx";
import { groupCallOrders } from "./CallOrdersRegister.tsx";
import { GeneralTab } from "./GeneralTab.tsx";
import { FinancialsTab } from "./FinancialsTab.tsx";
import { PeopleTab } from "./PeopleTab.tsx";
import { WeeklyReportsTab } from "./WeeklyReportsTab.tsx";
import { CallOrderHistory } from "./CallOrderHistory.tsx";
import { InvoicesTab } from "./InvoicesTab.tsx";
import { ContractFileTab } from "./ContractFileTab.tsx";
import { RisksTab } from "./RisksTab.tsx";
import { IssuesTab } from "./IssuesTab.tsx";
import { ActionItemsPanel } from "./ActionItemsPanel.tsx";
import type { Mutate } from "../App.tsx";

export type Tab = "General" | "Financials" | "People" | "Invoices" | "Contract File" | "Risks" | "Issues" | "Action Items" | "Weekly Status Reports" | "History";

// Only Project Managers get Weekly Reports tab in call orders
// Program Managers, Admins, and Customers use top navigation tabs
// History tab is available to all roles
function getTabs(role: string): Tab[] {
  const baseTabs: Tab[] = ["General", "Financials", "Invoices", "Contract File", "People", "Risks", "Issues", "Action Items"];
  if (role === "pm") {
    baseTabs.push("Weekly Status Reports");
  }
  baseTabs.push("History");
  return baseTabs;
}

export function CallOrderDetail({ snapshot, order: c, tab, isPm, canManageCallOrders, userName, onBack, onEditSetup, onTab, onSelectPeriod, onSelectStaff, mutate }: {
  snapshot: PortalSnapshot; order: CallOrder; tab: Tab; isPm: boolean; canManageCallOrders: boolean; userName?: string;
  onBack: () => void; onEditSetup: () => void; onTab: (t: Tab) => void; onSelectPeriod: (id: string) => void; onSelectStaff?: (staffId: number) => void; mutate: Mutate;
}) {
  const role = snapshot.actor?.role || "customer";
  const TABS = getTabs(role);
  const { today } = snapshot;
  const group = groupCallOrders(snapshot.callOrders, today).find((g) => g.periods.some((p) => p.id === c.id));
  const staffCount = c.staff.length ? filled(c) : "—";

  const [showAddPeriod, setShowAddPeriod] = useState(false);
  const [periodForm, setPeriodForm] = useState({ callOrderId: "", popStart: "", popEnd: "", funded: "" });
  const [periodError, setPeriodError] = useState("");
  const addPeriod = () => {
    const enteredId = normalizeCallOrderId(periodForm.callOrderId);
    if (!enteredId) { setPeriodError("Enter a valid call-order ID, such as Call 13.1."); return; }
    if (!periodForm.popStart || !periodForm.popEnd) { setPeriodError("Enter the complete period of performance."); return; }
    if (periodForm.popEnd < periodForm.popStart) { setPeriodError("Period end must be on or after the start date."); return; }
    setPeriodError("");
    mutate(() => api.addCallOrderPeriod(c.groupKey, periodForm)).then((snap) => {
      if (!snap) return;
      setShowAddPeriod(false);
      setPeriodForm({ callOrderId: "", popStart: "", popEnd: "", funded: "" });
      const created = snap.callOrders.find((o) => o.id === enteredId);
      if (created) onSelectPeriod(created.id);
    });
  };

  return (
    <div className="page detail">
      <button type="button" className="back-link" onClick={onBack}><span className="mono">←</span><span>All call orders</span></button>

      <div className="detail-head">
        <div>
          <div className="detail-id">Funded period · {c.id}</div>
          <h1 style={{ marginBottom: 8 }}>{callOrderLabel(c.groupName, c.groupKey)}</h1>
          <div className="page-sub">Period of performance {c.pop} · {periodState(c, today)} period · PM {c.pm}</div>
        </div>
        <div className="detail-actions">
          {canManageCallOrders && <Button primary onClick={onEditSetup}>{c.pending ? "Complete setup" : "Edit setup"}</Button>}
          <div className="stat-box">
            <div><Eyebrow>Obligated</Eyebrow><div className="value num" style={{ marginTop: 5 }}>{usd(c.funded)}</div></div>
            <div><Eyebrow>Expended</Eyebrow><div className="value num" style={{ marginTop: 5 }}>{usd(c.spend)}</div></div>
            <div><Eyebrow>People</Eyebrow><div className="value num" style={{ marginTop: 5 }}>{staffCount}</div></div>
          </div>
        </div>
      </div>

      {group && (
        <div style={{ marginBottom: 22 }}>
          <Eyebrow>Option periods</Eyebrow>
          <div className="period-chips" style={{ marginTop: 8 }}>
            {group.periods.map((p) => (
              <button key={p.id} type="button" className={"period-chip" + (p.id === c.id ? " active" : "")} onClick={() => onSelectPeriod(p.id)}>
                <div className="l">{callOrderLabel(p.name, p.id)}</div>
                <div className="s">{periodState(p, today)} · {p.pop}</div>
              </button>
            ))}
            {canManageCallOrders && !showAddPeriod && (
              <button type="button" className="period-chip" onClick={() => { setPeriodError(""); setShowAddPeriod(true); }}>
                <div className="l">+ Add period</div>
              </button>
            )}
          </div>
          {canManageCallOrders && showAddPeriod && (
            <div style={{ marginTop: 10 }}>
              {periodError && <div className="setup-error" style={{ marginBottom: 0 }}>{periodError}</div>}
              <div className="add-row" style={{ flexWrap: "wrap" }}>
                <Field label="Call-order ID"><TextInput value={periodForm.callOrderId} onChange={(v) => setPeriodForm({ ...periodForm, callOrderId: v })} placeholder="Call 13.1" /></Field>
                <Field label="Period start"><input type="date" className="input" value={periodForm.popStart} onChange={(e) => setPeriodForm({ ...periodForm, popStart: e.target.value })} /></Field>
                <Field label="Period end"><input type="date" className="input" value={periodForm.popEnd} onChange={(e) => setPeriodForm({ ...periodForm, popEnd: e.target.value })} /></Field>
                <Field label="Funded amount"><TextInput value={periodForm.funded} onChange={(v) => setPeriodForm({ ...periodForm, funded: v })} placeholder="$0" /></Field>
                <Button primary onClick={addPeriod}>Save period</Button>
                <Button onClick={() => { setPeriodError(""); setShowAddPeriod(false); }}>Cancel</Button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="tabs">
        {TABS.map((t) => <button key={t} type="button" className={"tab" + (t === tab ? " active" : "")} onClick={() => onTab(t)}>{t}</button>)}
      </div>

      {tab === "General" && <GeneralTab order={c} group={group} today={today} isPm={isPm} mutate={mutate} />}
      {tab === "Financials" && <FinancialsTab order={c} snapshot={snapshot} isPm={isPm} mutate={mutate} />}
      {tab === "Invoices" && <InvoicesTab callOrderId={c.id} invoices={c.invoices} today={today} isPm={isPm} mutate={mutate} />}
      {tab === "Contract File" && <ContractFileTab callOrderId={c.id} documents={c.contractDocuments} isPm={isPm} mutate={mutate} />}
      {tab === "People" && <PeopleTab order={c} snapshot={snapshot} isPm={isPm} mutate={mutate} onSelectStaff={onSelectStaff} />}
      {tab === "Risks" && <RisksTab callOrderId={c.id} risks={c.risks} isPm={isPm} mutate={mutate} />}
      {tab === "Issues" && <IssuesTab callOrderId={c.id} issues={c.issues} isPm={isPm} mutate={mutate} />}
      {tab === "Action Items" && (
        <div className="card">
          <div className="card-head">Action items</div>
          <div style={{ padding: 18 }}>
            <ActionItemsPanel callOrderId={c.id} actionItems={c.actionItems} today={today} isPm={isPm} mutate={mutate} />
          </div>
        </div>
      )}
      {tab === "Weekly Status Reports" && <WeeklyReportsTab order={c} isPm={isPm} userName={userName} today={snapshot.today} mutate={mutate} />}
      {tab === "History" && <CallOrderHistory callOrderId={c.id} userRole={snapshot.actor?.role || 'customer'} />}
    </div>
  );
}
