import { useRef, useState } from "react";
import type { Deliverable, MonthlyReport } from "../../shared/types.ts";
import { api } from "../api.ts";
import { dateLabel } from "../lib/format.ts";
import { Button, Field, TextInput } from "./ui.tsx";
import type { Mutate } from "../App.tsx";

const emptyForm = { name: "", linkType: "file" as "file" | "url", url: "", dueDate: "" };

export function DeliverablesTab({ callOrderId, deliverables, monthlyReports, isPm, mutate }: {
  callOrderId: string | null; deliverables: Deliverable[]; monthlyReports: MonthlyReport[]; isPm: boolean; mutate: Mutate;
}) {
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // MSR is a deliverable of the BPA itself: auto-list uploaded monthly reports read-only.
  const msrRows = callOrderId === null ? monthlyReports.filter((m) => m.href) : [];

  const add = () => {
    if (!form.name.trim()) return;
    const fd = new FormData();
    fd.append("name", form.name);
    fd.append("linkType", form.linkType);
    fd.append("dueDate", form.dueDate);
    if (form.linkType === "url") fd.append("url", form.url);
    if (form.linkType === "file" && fileRef.current?.files?.[0]) fd.append("file", fileRef.current.files[0]);
    mutate(() => api.addDeliverable(callOrderId, fd)).then(() => { setForm(emptyForm); setShowForm(false); if (fileRef.current) fileRef.current.value = ""; });
  };
  const markDelivered = (d: Deliverable) => mutate(() => api.updateDeliverable(callOrderId, d.id, { status: "delivered", deliveryDate: new Date().toISOString().slice(0, 10) }));
  const markAccepted = (d: Deliverable) => mutate(() => api.updateDeliverable(callOrderId, d.id, { status: "accepted" }));
  const remove = (d: Deliverable) => mutate(() => api.removeDeliverable(callOrderId, d.id));

  return (
    <div className="card">
      <div className="card-head wide">
        <div>Deliverables</div>
        {isPm && <Button primary onClick={() => setShowForm((v) => !v)}>{showForm ? "Cancel" : "Add deliverable"}</Button>}
      </div>
      {showForm && (
        <div className="add-row" style={{ flexWrap: "wrap" }}>
          <Field label="Name"><TextInput value={form.name} onChange={(v) => setForm({ ...form, name: v })} /></Field>
          <Field label="Due date"><input type="date" className="input" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} /></Field>
          <Field label="Link type">
            <select className="select" value={form.linkType} onChange={(e) => setForm({ ...form, linkType: e.target.value as "file" | "url" })}>
              <option value="file">Uploaded file</option>
              <option value="url">External URL</option>
            </select>
          </Field>
          {form.linkType === "url"
            ? <Field label="URL"><TextInput value={form.url} onChange={(v) => setForm({ ...form, url: v })} placeholder="https://…" /></Field>
            : <Field label="File"><input type="file" ref={fileRef} /></Field>}
          <Button primary onClick={add}>Save deliverable</Button>
        </div>
      )}
      <div className="grid thead tight" style={{ gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr" }}>
        <div className="th">Name</div><div className="th">Due date</div><div className="th">Delivered</div>
        <div className="th">Status</div><div className="th right">Actions</div>
      </div>
      {deliverables.map((d) => (
        <div key={d.id} className="grid trow tight" style={{ gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr" }}>
          <div>{d.fileHref ? <a href={d.fileHref} target="_blank" rel="noreferrer">{d.name}</a> : d.url ? <a href={d.url} target="_blank" rel="noreferrer">{d.name}</a> : d.name}</div>
          <div>{dateLabel(d.dueDate)}</div>
          <div>{dateLabel(d.deliveryDate)}</div>
          <div>{d.status}</div>
          <div className="right" style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
            {isPm && d.status === "pending" && <Button onClick={() => markDelivered(d)}>Mark delivered</Button>}
            {isPm && d.status === "delivered" && <Button onClick={() => markAccepted(d)}>Mark accepted</Button>}
            {isPm && <Button onClick={() => remove(d)}>Delete</Button>}
          </div>
        </div>
      ))}
      {msrRows.map((m) => (
        <div key={"msr-" + m.id} className="grid trow tight" style={{ gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr" }}>
          <div><a href={m.href!} target="_blank" rel="noreferrer">Monthly Status Report — {m.period}</a></div>
          <div>{dateLabel(m.dueOn)}</div>
          <div>—</div>
          <div>{m.status}</div>
          <div className="right" />
        </div>
      ))}
      {!deliverables.length && !msrRows.length && <div className="card-empty">No deliverables have been recorded.</div>}
    </div>
  );
}
