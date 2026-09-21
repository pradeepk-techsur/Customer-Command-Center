import { useState } from "react";
import type { Issue } from "../../shared/types.ts";
import { api } from "../api.ts";
import { dateLabel } from "../lib/format.ts";
import { Button, Field, TextArea, TextInput } from "./ui.tsx";
import type { Mutate } from "../App.tsx";

const emptyForm = { description: "", assignedTo: "" };

export function IssuesTab({ callOrderId, issues, isPm, mutate }: { callOrderId: string | null; issues: Issue[]; isPm: boolean; mutate: Mutate }) {
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [notes, setNotes] = useState<Record<number, string>>({});

  // Closed issues stay visible but sort to the bottom.
  const sorted = [...issues].sort((a, b) => (a.status === b.status ? 0 : a.status === "closed" ? 1 : -1));

  const add = () => {
    if (!form.description.trim()) return;
    mutate(() => api.addIssue(callOrderId, form)).then(() => { setForm(emptyForm); setShowForm(false); });
  };
  const toggleStatus = (i: Issue) => mutate(() => api.updateIssue(callOrderId, i.id, { status: i.status === "open" ? "closed" : "open" }));
  const remove = (i: Issue) => mutate(() => api.removeIssue(callOrderId, i.id));
  const appendUpdate = (i: Issue) => {
    const note = notes[i.id];
    if (!note?.trim()) return;
    mutate(() => api.updateIssue(callOrderId, i.id, { appendUpdate: note })).then(() => setNotes({ ...notes, [i.id]: "" }));
  };

  return (
    <div className="card">
      <div className="card-head wide">
        <div>Issues</div>
        {isPm && <Button primary onClick={() => setShowForm((v) => !v)}>{showForm ? "Cancel" : "Add issue"}</Button>}
      </div>
      {showForm && (
        <div className="add-row" style={{ flexDirection: "column", alignItems: "stretch" }}>
          <Field label="Description"><TextArea rows={2} value={form.description} onChange={(v) => setForm({ ...form, description: v })} /></Field>
          <Field label="Assigned to"><TextInput value={form.assignedTo} onChange={(v) => setForm({ ...form, assignedTo: v })} /></Field>
          <Button primary onClick={add}>Save issue</Button>
        </div>
      )}
      {sorted.map((i) => (
        <div key={i.id} className="report-item" style={{ display: "block", padding: "9px 20px", opacity: i.status === "closed" ? 0.6 : 1 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
            <div style={{ flex: 1 }}>{i.description}</div>
            <div style={{ color: "var(--ink-3)", whiteSpace: "nowrap" }}>{i.status}</div>
          </div>
          <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 4 }}>
            Identified {dateLabel(i.dateIdentified)}{i.assignedTo ? ` · Assigned to ${i.assignedTo}` : ""}
          </div>
          {i.updatesNarrative.map((u, idx) => (
            <div key={idx} style={{ fontSize: 12, marginTop: 4, paddingLeft: 12 }}>— {dateLabel(u.date)}: {u.text}</div>
          ))}
          {isPm && (
            <div style={{ marginTop: 6, display: "flex", gap: 8, alignItems: "center" }}>
              <TextInput value={notes[i.id] || ""} onChange={(v) => setNotes({ ...notes, [i.id]: v })} style={{ flex: 1 }} />
              <Button onClick={() => appendUpdate(i)}>Add update</Button>
              <Button onClick={() => toggleStatus(i)}>{i.status === "open" ? "Close" : "Reopen"}</Button>
              <Button onClick={() => remove(i)}>Delete</Button>
            </div>
          )}
        </div>
      ))}
      {!issues.length && <div className="card-empty">No issues have been logged.</div>}
    </div>
  );
}
