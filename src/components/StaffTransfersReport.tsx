import { useState } from "react";
import type { CallOrder, StaffTransfer } from "../../shared/types.ts";
import { api } from "../api.ts";
import { dateLabel } from "../lib/format.ts";
import { Button, Field, TextInput } from "./ui.tsx";
import type { Mutate } from "../App.tsx";

export function StaffTransfersReport({ transfers, callOrders, isPm, mutate }: {
  transfers: StaffTransfer[]; callOrders: CallOrder[]; isPm: boolean; mutate: Mutate;
}) {
  const [form, setForm] = useState({ staffId: "", toCallOrderId: "", toLcat: "", effectiveDate: "", notes: "" });

  const allStaff = callOrders.flatMap((c) => c.staff.map((s) => ({ ...s, callOrderName: c.name })));

  const add = () => {
    if (!form.staffId || !form.effectiveDate) return;
    mutate(() => api.addStaffTransfer({
      staffId: Number(form.staffId), toCallOrderId: form.toCallOrderId || undefined, toLcat: form.toLcat || undefined,
      effectiveDate: form.effectiveDate, notes: form.notes || undefined,
    })).then(() => setForm({ staffId: "", toCallOrderId: "", toLcat: "", effectiveDate: "", notes: "" }));
  };
  const complete = (t: StaffTransfer) => mutate(() => api.completeStaffTransfer(t.id));
  const remove = (t: StaffTransfer) => mutate(() => api.removeStaffTransfer(t.id));

  return (
    <div className="card">
      <div className="card-head wide">Staff transfers</div>
      {isPm && (
        <div className="add-row" style={{ flexWrap: "wrap" }}>
          <Field label="Staff member" style={{ flex: 1.5 }}>
            <select className="select" value={form.staffId} onChange={(e) => setForm({ ...form, staffId: e.target.value })}>
              <option value="">Select…</option>
              {allStaff.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.callOrderName})</option>)}
            </select>
          </Field>
          <Field label="Future call order">
            <select className="select" value={form.toCallOrderId} onChange={(e) => setForm({ ...form, toCallOrderId: e.target.value })}>
              <option value="">No change</option>
              {callOrders.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="Future LCAT"><TextInput value={form.toLcat} onChange={(v) => setForm({ ...form, toLcat: v })} /></Field>
          <Field label="Effective date"><input type="date" className="input" value={form.effectiveDate} onChange={(e) => setForm({ ...form, effectiveDate: e.target.value })} /></Field>
          <Field label="Notes" style={{ flex: 1.5 }}><TextInput value={form.notes} onChange={(v) => setForm({ ...form, notes: v })} /></Field>
          <Button primary onClick={add}>Add transfer</Button>
        </div>
      )}
      <div className="grid thead tight" style={{ gridTemplateColumns: "1.3fr 1fr 1fr 1fr 1fr 1fr 1fr" }}>
        <div className="th">Name</div><div className="th">Current call order</div><div className="th">Current LCAT</div>
        <div className="th">Future call order</div><div className="th">Future LCAT</div><div className="th">Effective date</div><div className="th right">Actions</div>
      </div>
      {transfers.map((t) => (
        <div key={t.id} className="grid trow tight" style={{ gridTemplateColumns: "1.3fr 1fr 1fr 1fr 1fr 1fr 1fr" }}>
          <div>{t.staffName}</div>
          <div>{callOrders.find((c) => c.id === t.fromCallOrderId)?.name || "—"}</div>
          <div>{t.fromLcat || "—"}</div>
          <div>{callOrders.find((c) => c.id === t.toCallOrderId)?.name || "—"}</div>
          <div>{t.toLcat || "—"}</div>
          <div>{dateLabel(t.effectiveDate)}</div>
          <div className="right" style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
            {isPm && t.status === "pending" && <Button onClick={() => complete(t)}>Complete</Button>}
            {isPm && <Button onClick={() => remove(t)}>Delete</Button>}
            {t.status === "completed" && <span style={{ color: "var(--ink-3)" }}>Completed</span>}
          </div>
        </div>
      ))}
      {!transfers.length && <div className="card-empty">No staff transfers recorded.</div>}
    </div>
  );
}
