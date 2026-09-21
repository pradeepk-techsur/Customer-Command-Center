import { useState } from "react";
import type { Risk, RiskLevel } from "../../shared/types.ts";
import { api } from "../api.ts";
import { Button, Field, TextArea } from "./ui.tsx";
import type { Mutate } from "../App.tsx";

const LEVELS: RiskLevel[] = ["low", "medium", "high"];
const severityColor = (s: RiskLevel) => s === "high" ? "var(--burn-high)" : s === "medium" ? "var(--burn-mid)" : "var(--accent)";
const emptyForm = { description: "", probability: "medium" as RiskLevel, impact: "medium" as RiskLevel, mitigation: "" };

export function RisksTab({ callOrderId, risks, isPm, mutate }: { callOrderId: string | null; risks: Risk[]; isPm: boolean; mutate: Mutate }) {
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState(emptyForm);

  // Closed risks stay visible but sort to the bottom.
  const sorted = [...risks].sort((a, b) => (a.status === b.status ? 0 : a.status === "closed" ? 1 : -1));

  const add = () => {
    if (!form.description.trim()) return;
    mutate(() => api.addRisk(callOrderId, form)).then(() => { setForm(emptyForm); setShowForm(false); });
  };
  const toggleStatus = (r: Risk) => mutate(() => api.updateRisk(callOrderId, r.id, { status: r.status === "open" ? "closed" : "open" }));
  const remove = (r: Risk) => mutate(() => api.removeRisk(callOrderId, r.id));

  const startEdit = (r: Risk) => { setEditingId(r.id); setEditForm({ description: r.description, probability: r.probability, impact: r.impact, mitigation: r.mitigation ?? "" }); };
  const cancelEdit = () => setEditingId(null);
  const saveEdit = (riskId: number) => {
    if (!editForm.description.trim()) return;
    mutate(() => api.updateRisk(callOrderId, riskId, editForm)).then(() => setEditingId(null));
  };

  return (
    <div className="card">
      <div className="card-head wide">
        <div>Risks</div>
        {isPm && <Button primary onClick={() => setShowForm((v) => !v)}>{showForm ? "Cancel" : "Add risk"}</Button>}
      </div>
      {showForm && (
        <div className="add-row" style={{ flexDirection: "column", alignItems: "stretch" }}>
          <Field label="Description"><TextArea rows={2} value={form.description} onChange={(v) => setForm({ ...form, description: v })} /></Field>
          <div className="two-col">
            <Field label="Probability">
              <select className="select" value={form.probability} onChange={(e) => setForm({ ...form, probability: e.target.value as RiskLevel })}>
                {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </Field>
            <Field label="Impact">
              <select className="select" value={form.impact} onChange={(e) => setForm({ ...form, impact: e.target.value as RiskLevel })}>
                {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Mitigation"><TextArea rows={2} value={form.mitigation} onChange={(v) => setForm({ ...form, mitigation: v })} /></Field>
          <Button primary onClick={add}>Save risk</Button>
        </div>
      )}
      {sorted.map((r) => editingId === r.id ? (
        <div key={r.id} className="add-row" style={{ flexDirection: "column", alignItems: "stretch" }}>
          <Field label="Description"><TextArea rows={2} value={editForm.description} onChange={(v) => setEditForm({ ...editForm, description: v })} /></Field>
          <div className="two-col">
            <Field label="Probability">
              <select className="select" value={editForm.probability} onChange={(e) => setEditForm({ ...editForm, probability: e.target.value as RiskLevel })}>
                {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </Field>
            <Field label="Impact">
              <select className="select" value={editForm.impact} onChange={(e) => setEditForm({ ...editForm, impact: e.target.value as RiskLevel })}>
                {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Mitigation"><TextArea rows={2} value={editForm.mitigation} onChange={(v) => setEditForm({ ...editForm, mitigation: v })} /></Field>
          <div style={{ display: "flex", gap: 10 }}>
            <Button primary onClick={() => saveEdit(r.id)}>Save</Button>
            <Button onClick={cancelEdit}>Cancel</Button>
          </div>
        </div>
      ) : (
        <div key={r.id} className="report-item" style={{ display: "block", padding: "9px 20px", opacity: r.status === "closed" ? 0.6 : 1 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
            <div style={{ flex: 1 }}>{r.description}</div>
            <div style={{ color: severityColor(r.severity), fontWeight: 600, whiteSpace: "nowrap" }}>{r.severity} severity</div>
          </div>
          <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 4 }}>
            Probability {r.probability} · Impact {r.impact}{r.mitigation ? ` · Mitigation: ${r.mitigation}` : ""}
          </div>
          {isPm && (
            <div style={{ marginTop: 6, display: "flex", gap: 8 }}>
              <Button onClick={() => startEdit(r)}>Edit</Button>
              <Button onClick={() => toggleStatus(r)}>{r.status === "open" ? "Close" : "Reopen"}</Button>
              <Button onClick={() => remove(r)}>Delete</Button>
            </div>
          )}
        </div>
      ))}
      {!risks.length && <div className="card-empty">No risks have been logged.</div>}
    </div>
  );
}
