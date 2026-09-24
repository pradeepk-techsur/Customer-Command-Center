import { useState } from "react";
import type { ActionItem } from "../../shared/types.ts";
import { api } from "../api.ts";
import { dateLabel, daysOld } from "../lib/format.ts";
import { Button, Field, TextInput } from "./ui.tsx";
import type { Mutate } from "../App.tsx";

/** Open items, plus closed items from the last week only — older closed items live in the searchable archive. */
export function ActionItemsPanel({ callOrderId, weeklyReportId, actionItems, today, isPm, mutate }: {
  callOrderId: string; weeklyReportId?: number; actionItems: ActionItem[]; today: string; isPm: boolean; mutate: Mutate;
}) {
  const [form, setForm] = useState({ name: "", description: "" });
  const visible = actionItems.filter((a) => a.status === "open" || (a.closedAt && daysOld(a.closedAt, today) <= 7));

  const add = () => {
    if (!form.name.trim()) return;
    mutate(() => api.addActionItem(callOrderId, { ...form, weeklyReportId })).then(() => setForm({ name: "", description: "" }));
  };
  const toggleStatus = (a: ActionItem) => mutate(() => api.updateActionItem(callOrderId, a.id, { status: a.status === "open" ? "closed" : "open" }));

  return (
    <div>
      {visible.map((a) => (
        <div key={a.id} className="report-item" style={{ opacity: a.status === "closed" ? 0.6 : 1 }}>
          <div className="dash">—</div>
          <div style={{ flex: 1 }}>
            {a.name}{a.description ? `: ${a.description}` : ""}
            <span style={{ color: "var(--ink-3)", marginLeft: 8 }}>Assigned {dateLabel(a.dateAssigned)}{a.status === "closed" ? ` · Closed ${dateLabel(a.closedAt)}` : ""}</span>
          </div>
          {isPm && <Button onClick={() => toggleStatus(a)}>{a.status === "open" ? "Close" : "Reopen"}</Button>}
        </div>
      ))}
      {!visible.length && <div className="card-empty">No open action items.</div>}
      {isPm && (
        <div className="add-row">
          <Field label="Name" style={{ flex: 1 }}><TextInput value={form.name} onChange={(v) => setForm({ ...form, name: v })} /></Field>
          <Field label="Description" style={{ flex: 1.5 }}><TextInput value={form.description} onChange={(v) => setForm({ ...form, description: v })} /></Field>
          <Button primary onClick={add}>Add action item</Button>
        </div>
      )}
    </div>
  );
}
