import { useState } from "react";
import type { Clin } from "../../shared/types.ts";
import { api } from "../api.ts";
import { usdFull } from "../lib/format.ts";
import { Button, Field, TextInput } from "./ui.tsx";
import type { Mutate } from "../App.tsx";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

const emptyForm = { name: "", fundedAmount: "" };

function monthLabel(month: string) {
  const d = new Date(month + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

export function ClinSection({ callOrderId, clins, isPm, mutate }: { callOrderId: string | null; clins: Clin[]; isPm: boolean; mutate: Mutate }) {
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [selectedClin, setSelectedClin] = useState<number | null>(clins[0]?.id ?? null);
  const [monthInput, setMonthInput] = useState({ month: "", projectedAmount: "", actualAmount: "" });

  const add = () => {
    if (!form.name.trim()) return;
    mutate(() => api.addClin(callOrderId, form)).then(() => { setForm(emptyForm); setShowForm(false); });
  };
  const remove = (id: number) => mutate(() => api.removeClin(callOrderId, id));
  const saveMonth = () => {
    const clin = clins.find((c) => c.id === selectedClin);
    if (!clin || !monthInput.month) return;
    mutate(() => api.setClinMonthlySpend(callOrderId, clin.id, monthInput.month, {
      projectedAmount: monthInput.projectedAmount, actualAmount: monthInput.actualAmount,
    })).then(() => setMonthInput({ month: "", projectedAmount: "", actualAmount: "" }));
  };

  // Merge all CLINs' monthly points onto a common month axis for the chart.
  const months = [...new Set(clins.flatMap((c) => c.monthlySpend.map((m) => m.month)))].sort();
  const chartData = months.map((month) => {
    const point: Record<string, number | string> = { month: monthLabel(month) };
    let projectedTotal = 0, actualTotal = 0;
    for (const c of clins) {
      const m = c.monthlySpend.find((x) => x.month === month);
      projectedTotal += m?.projectedAmount || 0;
      actualTotal += m?.actualAmount || 0;
    }
    point.Projected = projectedTotal;
    point.Actual = actualTotal;
    return point;
  });

  return (
    <div className="card">
      <div className="card-head wide">
        <div>CLIN breakdown</div>
        {isPm && <Button primary onClick={() => setShowForm((v) => !v)}>{showForm ? "Cancel" : "Add CLIN"}</Button>}
      </div>
      {showForm && (
        <div className="add-row">
          <Field label="CLIN name" style={{ flex: 1.5 }}><TextInput value={form.name} onChange={(v) => setForm({ ...form, name: v })} /></Field>
          <Field label="Funded amount"><TextInput value={form.fundedAmount} onChange={(v) => setForm({ ...form, fundedAmount: v })} /></Field>
          <Button primary onClick={add}>Save CLIN</Button>
        </div>
      )}
      <div className="grid thead tight" style={{ gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr" }}>
        <div className="th">CLIN</div><div className="th right">Funded</div><div className="th right">Expended</div>
        <div className="th right">Remaining</div><div className="th right">Actions</div>
      </div>
      {clins.map((c) => {
        const expended = c.monthlySpend.reduce((s, m) => s + (m.actualAmount || 0), 0);
        return (
          <div key={c.id} className="grid trow tight" style={{ gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr" }}>
            <button type="button" className="link-text" style={{ textAlign: "left" }} onClick={() => setSelectedClin(c.id)}>{c.name}</button>
            <div className="num right">{usdFull(c.fundedAmount)}</div>
            <div className="num right">{usdFull(expended)}</div>
            <div className="num right">{usdFull(c.fundedAmount - expended)}</div>
            <div className="right">{isPm && <Button onClick={() => remove(c.id)}>Delete</Button>}</div>
          </div>
        );
      })}
      {!clins.length && <div className="card-empty">No CLINs have been entered for this period.</div>}

      {clins.length > 0 && (
        <>
          <div className="card-head" style={{ marginTop: 12 }}>Monthly spend</div>
          {chartData.length > 0 && (
            <div style={{ padding: 18, height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis tickFormatter={(v) => usdFull(v)} width={90} />
                  <Tooltip formatter={(v: number) => usdFull(v)} />
                  <Legend />
                  <Line type="monotone" dataKey="Projected" stroke="var(--accent)" strokeDasharray="4 4" />
                  <Line type="monotone" dataKey="Actual" stroke="var(--burn-mid)" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
          {isPm && (
            <div className="add-row">
              <Field label="CLIN">
                <select className="select" value={selectedClin ?? ""} onChange={(e) => setSelectedClin(Number(e.target.value))}>
                  {clins.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
              <Field label="Month"><input type="month" className="input" value={monthInput.month} onChange={(e) => setMonthInput({ ...monthInput, month: e.target.value + "-01" })} /></Field>
              <Field label="Projected"><TextInput value={monthInput.projectedAmount} onChange={(v) => setMonthInput({ ...monthInput, projectedAmount: v })} /></Field>
              <Field label="Actual"><TextInput value={monthInput.actualAmount} onChange={(v) => setMonthInput({ ...monthInput, actualAmount: v })} /></Field>
              <Button primary onClick={saveMonth}>Save month</Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
