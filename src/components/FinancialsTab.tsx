import { useEffect, useState } from "react";
import type { CallOrder, PortalSnapshot } from "../../shared/types.ts";
import { api } from "../api.ts";
import { useSort } from "../hooks/useSort.ts";
import { burnColor, dateLabel, isStale, pctOf, rate, usd, usdFull } from "../lib/format.ts";
import { Button, Field, SortHeaders, TextInput } from "./ui.tsx";
import type { Mutate } from "../App.tsx";

const LCAT_COLS = [
  { key: "name", label: "BPA labor category" }, { key: "fte", label: "FTE", align: "right" as const },
  { key: "hours", label: "Hours", align: "right" as const }, { key: "rate", label: "Rate", align: "right" as const },
  { key: "ext", label: "Extended", align: "right" as const },
];
const emptyLcatForm = { name: "", fte: "", hours: "", rate: "" };

export function FinancialsTab({ order: c, snapshot, isPm, mutate }: { order: CallOrder; snapshot: PortalSnapshot; isPm: boolean; mutate: Mutate }) {
  const [draft, setDraft] = useState(c.spend.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }));
  useEffect(() => { 
    setDraft(c.spend.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 })); 
  }, [c.id, c.spend]);
  
  const handleSpendChange = (val: string) => {
    // Allow typing numbers and format as currency
    const numericValue = val.replace(/[^0-9]/g, '');
    const formatted = numericValue ? parseInt(numericValue).toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }) : '';
    setDraft(formatted);
  };
  
  const saveDraft = () => {
    const numericValue = draft.replace(/[^0-9]/g, '');
    mutate(() => api.saveSpend(c.id, numericValue));
  };

  // Pending call orders (freshly uploaded, no data yet) open the setup form by default.
  const [editingSetup, setEditingSetup] = useState(c.pending);
  const [setupForm, setSetupForm] = useState({
    popStart: c.popStart ?? "", popEnd: c.popEnd ?? "",
    funded: c.funded ? String(c.funded) : "", eac: c.eac !== null ? String(c.eac) : "",
    overUnder: c.over !== null ? String(c.over) : "", pm: c.pm === "Unassigned" ? "" : c.pm,
  });
  useEffect(() => {
    setEditingSetup(c.pending);
    setSetupForm({
      popStart: c.popStart ?? "", popEnd: c.popEnd ?? "",
      funded: c.funded ? String(c.funded) : "", eac: c.eac !== null ? String(c.eac) : "",
      overUnder: c.over !== null ? String(c.over) : "", pm: c.pm === "Unassigned" ? "" : c.pm,
    });
  }, [c.id]);
  const saveSetup = () => {
    mutate(() => api.saveCallOrderSetup(c.id, setupForm)).then(() => setEditingSetup(false));
  };

  const [showLcatForm, setShowLcatForm] = useState(false);
  const [lcatForm, setLcatForm] = useState(emptyLcatForm);
  const addLcat = () => {
    if (!lcatForm.name.trim()) return;
    mutate(() => api.addLcat(c.id, lcatForm)).then(() => { setLcatForm(emptyLcatForm); setShowLcatForm(false); });
  };
  const removeLcat = (lcatId: number) => mutate(() => api.removeLcat(lcatId));

  const remaining = c.funded - c.spend;
  const pct = pctOf(c.spend, c.funded);
  const ext = (l: { fte: number; hours: number; rate: number }) => l.fte * l.hours * l.rate;
  const lcatTotal = c.laborCategories.reduce((s, l) => s + ext(l), 0);
  const lcatFte = c.laborCategories.reduce((s, l) => s + l.fte, 0);
  const { sorted, cur, toggle } = useSort("lcat", "name", c.laborCategories, {
    name: (l) => l.name, fte: (l) => l.fte, hours: (l) => l.hours, rate: (l) => l.rate, ext,
  });
  const stale = isStale(c, "fin", snapshot.today, snapshot.config);

  const funding: { label: string; value: string; color?: string }[] = [
    { label: "Funds obligated", value: usdFull(c.funded) },
    { label: "Funds expended to date*", value: usdFull(c.spend) },
    { label: "Funds remaining", value: usdFull(remaining) },
    { label: "Estimate at completion", value: usdFull(c.eac) },
    { label: "Over / under", value: usdFull(c.over) },
    { label: "Percent expended", value: c.funded ? pct + "%" : "—", color: c.funded && c.spend ? burnColor(pct) : undefined },
  ];

  return (
    <div className="fin-grid">
      <div className="card">
        <div className="card-head">
          <div>Funding summary</div>
          {isPm && !editingSetup && <Button onClick={() => setEditingSetup(true)}>Edit setup</Button>}
          {!isPm && <div className={"stamp" + (stale ? " stale" : "")}>Financials updated {dateLabel(c.finUpdatedOn)}</div>}
        </div>
        {isPm && editingSetup ? (
          <div className="add-row" style={{ flexDirection: "column", alignItems: "stretch" }}>
            <div className="two-col">
              <Field label="Period start"><input type="date" className="input" value={setupForm.popStart} onChange={(e) => setSetupForm({ ...setupForm, popStart: e.target.value })} /></Field>
              <Field label="Period end"><input type="date" className="input" value={setupForm.popEnd} onChange={(e) => setSetupForm({ ...setupForm, popEnd: e.target.value })} /></Field>
            </div>
            <div className="two-col">
              <Field label="Funds obligated"><TextInput value={setupForm.funded} onChange={(v) => setSetupForm({ ...setupForm, funded: v })} placeholder="$0" /></Field>
              <Field label="Project manager"><TextInput value={setupForm.pm} onChange={(v) => setSetupForm({ ...setupForm, pm: v })} placeholder="Unassigned" /></Field>
            </div>
            <div className="two-col">
              <Field label="Estimate at completion"><TextInput value={setupForm.eac} onChange={(v) => setSetupForm({ ...setupForm, eac: v })} placeholder="$0" /></Field>
              <Field label="Over / under"><TextInput value={setupForm.overUnder} onChange={(v) => setSetupForm({ ...setupForm, overUnder: v })} placeholder="$0" /></Field>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <Button primary onClick={saveSetup}>{c.pending ? "Complete call order setup" : "Save"}</Button>
              {!c.pending && <Button onClick={() => setEditingSetup(false)}>Cancel</Button>}
            </div>
          </div>
        ) : (
          <>
            {isPm && (
              <div className="fin-edit">
                <Field label="Update funds expended to date" style={{ flex: 1 }}>
                  <TextInput value={draft} onChange={handleSpendChange} placeholder="$0" />
                </Field>
                <Button primary onClick={saveDraft}>Save</Button>
              </div>
            )}
            {funding.map((r) => (
              <div key={r.label} className="fin-row">
                <div style={{ color: "var(--ink-3)" }}>{r.label}</div>
                <div className="v num" style={r.color ? { color: r.color, fontWeight: 600 } : undefined}>{r.value}</div>
              </div>
            ))}
            <div className="footnote">* Expenditures lag one invoice cycle</div>
          </>
        )}
      </div>

      <div className="card">
        <div className="card-head wide">
          <div>Contracted labor categories</div>
          {isPm && <Button primary onClick={() => setShowLcatForm((v) => !v)}>{showLcatForm ? "Cancel" : "Add labor category"}</Button>}
        </div>
        {showLcatForm && (
          <div className="add-row">
            <Field label="Labor category" style={{ flex: 1.5 }}><TextInput value={lcatForm.name} onChange={(v) => setLcatForm({ ...lcatForm, name: v })} /></Field>
            <Field label="FTE"><TextInput value={lcatForm.fte} onChange={(v) => setLcatForm({ ...lcatForm, fte: v })} /></Field>
            <Field label="Hours"><TextInput value={lcatForm.hours} onChange={(v) => setLcatForm({ ...lcatForm, hours: v })} /></Field>
            <Field label="Rate"><TextInput value={lcatForm.rate} onChange={(v) => setLcatForm({ ...lcatForm, rate: v })} /></Field>
            <Button primary onClick={addLcat}>Save</Button>
          </div>
        )}
        <div className="grid thead tight lcat-cols" style={isPm ? { gridTemplateColumns: "2fr 0.5fr 0.7fr 0.8fr 1fr 0.6fr" } : undefined}>
          <SortHeaders cols={LCAT_COLS} cur={cur} onSort={toggle} />{isPm && <div className="th right">Actions</div>}
        </div>
        {sorted.map((l) => (
          <div key={l.id} className="grid trow tight lcat-cols num" style={isPm ? { gridTemplateColumns: "2fr 0.5fr 0.7fr 0.8fr 1fr 0.6fr" } : undefined}>
            <div>{l.name}</div>
            <div className="right">{l.fte}</div>
            <div className="right muted">{l.hours.toLocaleString()}</div>
            <div className="right muted">{rate(l.rate)}</div>
            <div className="right">{usd(ext(l))}</div>
            {isPm && <div className="right"><Button onClick={() => removeLcat(l.id)}>Delete</Button></div>}
          </div>
        ))}
        {!c.laborCategories.length && <div className="card-empty">No labor categories have been contracted for this period.</div>}
        <div className="grid tfoot lcat-cols num" style={isPm ? { gridTemplateColumns: "2fr 0.5fr 0.7fr 0.8fr 1fr 0.6fr" } : undefined}>
          <div>Total contracted value</div>
          <div className="right">{lcatFte || "—"}</div>
          <div /><div />
          <div className="right">{lcatTotal ? usd(lcatTotal) : "—"}</div>
          {isPm && <div />}
        </div>
      </div>
    </div>
  );
}
