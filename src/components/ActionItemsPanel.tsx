import { useState } from "react";
import type { ActionItem } from "../../shared/types.ts";
import { api } from "../api.ts";
import { dateLabel, daysOld } from "../lib/format.ts";
import { Button, Field, showConfirm, TextInput } from "./ui.tsx";
import type { Mutate } from "../App.tsx";

export type ActionItemEditorItem = Pick<ActionItem, "id" | "name" | "description" | "dateAssigned" | "status" | "closedAt">;
export type ActionItemInput = { name: string; description: string };

/** Shared action-item workflow used by call orders, weekly reports, and weekly meetings. */
export function ActionItemsEditor({ actionItems, today, canEdit, onAdd, onToggle, onDelete }: {
  actionItems: ActionItemEditorItem[];
  today: string;
  canEdit: boolean;
  onAdd: (input: ActionItemInput) => Promise<unknown>;
  onToggle: (action: ActionItemEditorItem) => Promise<unknown>;
  onDelete?: (action: ActionItemEditorItem) => Promise<unknown>;
}) {
  const [form, setForm] = useState<ActionItemInput>({ name: "", description: "" });
  const visible = actionItems.filter((a) => a.status === "open" || (a.closedAt && daysOld(a.closedAt, today) <= 7));

  const add = async () => {
    const name = form.name.trim();
    if (!name) return;
    const result = await onAdd({ name, description: form.description.trim() });
    if (result !== undefined && result !== false) setForm({ name: "", description: "" });
  };

  const deleteAction = async (action: ActionItemEditorItem) => {
    if (!onDelete) return;
    const detail = action.description ? `${action.name}: ${action.description}` : action.name;
    if (await showConfirm("Delete action item?", `${detail} will be permanently deleted. The deletion will remain in the audit log.`)) {
      await onDelete(action);
    }
  };

  return (
    <div>
      {visible.map((a) => (
        <div key={a.id} className="report-item action-item-row" style={{ opacity: a.status === "closed" ? 0.6 : 1 }}>
          <div className="dash">—</div>
          <div style={{ flex: 1 }}>
            {a.name}{a.description ? `: ${a.description}` : ""}
            <span style={{ color: "var(--ink-3)", marginLeft: 8 }}>Assigned {dateLabel(a.dateAssigned)}{a.status === "closed" ? ` · Closed ${dateLabel(a.closedAt)}` : ""}</span>
          </div>
          {canEdit && (
            <div className="action-item-controls">
              <Button onClick={() => onToggle(a)}>{a.status === "open" ? "Close" : "Reopen"}</Button>
              {onDelete && <Button onClick={() => deleteAction(a)}>Delete</Button>}
            </div>
          )}
        </div>
      ))}
      {!visible.length && <div className="card-empty">No open action items.</div>}
      {canEdit && (
        <div className="add-row">
          <Field label="Name" style={{ flex: 1 }}><TextInput value={form.name} onChange={(name) => setForm({ ...form, name })} /></Field>
          <Field label="Description" style={{ flex: 1.5 }}><TextInput value={form.description} onChange={(description) => setForm({ ...form, description })} /></Field>
          <Button primary onClick={add}>Add action item</Button>
        </div>
      )}
    </div>
  );
}

/** Open items, plus closed items from the last week only — older closed items live in the searchable archive. */
export function ActionItemsPanel({ callOrderId, weeklyReportId, actionItems, today, isPm, mutate }: {
  callOrderId: string; weeklyReportId?: number; actionItems: ActionItem[]; today: string; isPm: boolean; mutate: Mutate;
}) {
  return (
    <ActionItemsEditor
      actionItems={actionItems}
      today={today}
      canEdit={isPm}
      onAdd={(input) => mutate(() => api.addActionItem(callOrderId, { ...input, weeklyReportId }))}
      onToggle={(action) => mutate(() => api.updateActionItem(callOrderId, action.id, { status: action.status === "open" ? "closed" : "open" }))}
      onDelete={(action) => mutate(() => api.removeActionItem(callOrderId, action.id))}
    />
  );
}
