import { useState } from "react";
import type { Deliverable, PortalSnapshot } from "../../shared/types.ts";
import { api } from "../api.ts";
import { useSort } from "../hooks/useSort.ts";
import { dateLabel } from "../lib/format.ts";
import { Button, Field, FileButton, SortHeaders, TextInput } from "./ui.tsx";
import type { Mutate } from "../App.tsx";

const COLS = [
  { key: "name", label: "Name" }, { key: "category", label: "Category" }, { key: "period", label: "Month/Year" },
  { key: "scope", label: "Call order" }, { key: "dueDate", label: "Due date" }, { key: "deliveryDate", label: "Delivery date" },
  { key: "accepted", label: "Accepted" }, { key: "status", label: "Status" },
];
const GRID_COLS = "1.6fr 1.2fr 1fr 1.2fr 1fr 1fr 0.8fr 1fr 0.8fr";

type Row = Deliverable & { scopeName: string };

export function ContractDeliverablesPage({ snapshot, isPm, mutate }: { snapshot: PortalSnapshot; isPm: boolean; mutate: Mutate }) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [period, setPeriod] = useState("");
  const [uploading, setUploading] = useState(false);

  const callOrders = snapshot.callOrders.filter((c) => !c.pending);
  const rows: Row[] = [
    ...snapshot.contract.deliverables.map((d) => ({ ...d, scopeName: "BPA" })),
    ...callOrders.flatMap((c) => c.deliverables.map((d) => ({ ...d, scopeName: c.name }))),
  ];
  const { sorted, cur, toggle } = useSort("contractdeliverables", "dueDate", rows, {
    name: (d) => d.name,
    category: (d) => d.category ?? "",
    period: (d) => d.periodLabel ?? "",
    scope: (d) => d.scopeName,
    dueDate: (d) => d.dueDate ?? "",
    deliveryDate: (d) => d.deliveryDate ?? "",
    accepted: (d) => (d.status === "accepted" ? 1 : 0),
    status: (d) => d.status,
  });

  // Name, category, and month/year are entered up front; the file upload creates the record.
  const uploadDeliverable = (files: FileList) => {
    if (!name.trim()) return;
    const fd = new FormData();
    fd.append("name", name);
    fd.append("category", category);
    fd.append("periodLabel", period);
    fd.append("linkType", "file");
    fd.append("file", files[0]);
    setUploading(true);
    mutate(() => api.addDeliverable(null, fd)).then(() => { setName(""); setCategory(""); setPeriod(""); }).finally(() => setUploading(false));
  };
  const markDelivered = (d: Row) => mutate(() => api.updateDeliverable(d.callOrderId, d.id, { status: "delivered", deliveryDate: new Date().toISOString().slice(0, 10) }));
  const markAccepted = (d: Row) => mutate(() => api.updateDeliverable(d.callOrderId, d.id, { status: "accepted" }));
  const remove = (d: Row) => mutate(() => api.removeDeliverable(d.callOrderId, d.id));

  return (
    <div className="page">
      <h1>Contracts Deliverables</h1>
      <div className="page-sub">Contractual deliverables across the BPA and every call order.</div>

      {isPm && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-head">Upload deliverable</div>
          <div className="add-row" style={{ flexWrap: "wrap" }}>
            <Field label="Name" style={{ flex: 1 }}><TextInput value={name} onChange={setName} /></Field>
            <Field label="Category"><TextInput value={category} onChange={setCategory} placeholder="Monthly Status Report…" /></Field>
            <Field label="Month/Year"><TextInput value={period} onChange={setPeriod} placeholder="Sep 2026" /></Field>
            <FileButton primary onFiles={uploadDeliverable}>{uploading ? "Uploading…" : "Upload deliverable"}</FileButton>
          </div>
        </div>
      )}

      <div className="card" style={{ marginTop: 16 }}>
        <div className="grid thead tight" style={{ gridTemplateColumns: GRID_COLS }}>
          <SortHeaders cols={COLS} cur={cur} onSort={toggle} />
          <div className="th right">Actions</div>
        </div>
        {sorted.map((d) => (
          <div key={d.callOrderId + ":" + d.id} className="grid trow tight" style={{ gridTemplateColumns: GRID_COLS }}>
            <div>{d.fileHref ? <a href={d.fileHref} target="_blank" rel="noreferrer">{d.name}</a> : d.url ? <a href={d.url} target="_blank" rel="noreferrer">{d.name}</a> : d.name}</div>
            <div>{d.category || "—"}</div>
            <div>{d.periodLabel || "—"}</div>
            <div>{d.scopeName}</div>
            <div>{dateLabel(d.dueDate)}</div>
            <div>{dateLabel(d.deliveryDate)}</div>
            <div>{d.status === "accepted" ? "Y" : "N"}</div>
            <div>{d.status}</div>
            <div className="right" style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
              {isPm && d.status === "pending" && <Button onClick={() => markDelivered(d)}>Mark delivered</Button>}
              {isPm && d.status === "delivered" && <Button onClick={() => markAccepted(d)}>Mark accepted</Button>}
              {isPm && <Button onClick={() => remove(d)}>Delete</Button>}
            </div>
          </div>
        ))}
        {!rows.length && <div className="card-empty">No deliverables have been recorded.</div>}
      </div>
    </div>
  );
}
