import { useState } from "react";
import type { Invoice } from "../../shared/types.ts";
import { api } from "../api.ts";
import { useSort } from "../hooks/useSort.ts";
import { daysOld, dateLabel, localDate, usdFull, todayLabel } from "../lib/format.ts";
import { Button, Field, FileButton, SortHeaders, TextInput } from "./ui.tsx";
import type { Mutate } from "../App.tsx";

/** Amber past 20 days unpaid, red past 30 days unpaid. */
function agingColor(inv: Invoice, today: string): string | undefined {
  if (inv.paymentStatus === "paid") return undefined;
  const age = daysOld(inv.invoiceDate, today);
  if (age >= 30) return "var(--burn-high)";
  if (age >= 20) return "var(--burn-mid)";
  return undefined;
}

const emptyFilter = { invoiceNumber: "", invoiceDate: "" };

const COLS = [
  { key: "invoiceNumber", label: "Invoice #" }, { key: "invoiceDate", label: "Invoice date" },
  { key: "amount", label: "Amount", align: "right" as const }, { key: "period", label: "Period" },
  { key: "status", label: "Status" },
];

export function InvoicesTab({ callOrderId, invoices, today, isPm, mutate }: {
  callOrderId: string | null; invoices: Invoice[]; today: string; isPm: boolean; mutate: Mutate;
}) {
  const [filter, setFilter] = useState(emptyFilter);
  const [uploading, setUploading] = useState(false);

  const filtered = invoices.filter((inv) =>
    (!filter.invoiceNumber || inv.invoiceNumber.toLowerCase().includes(filter.invoiceNumber.toLowerCase()))
    && (!filter.invoiceDate || inv.invoiceDate === filter.invoiceDate));
  const { sorted, cur, toggle } = useSort("invoices", "invoiceDate", filtered, {
    invoiceNumber: (inv) => inv.invoiceNumber,
    invoiceDate: (inv) => localDate(inv.invoiceDate)?.getTime() ?? 0,
    amount: (inv) => inv.amount,
    period: (inv) => localDate(inv.periodEnd)?.getTime() ?? 0,
    status: (inv) => inv.paymentStatus,
  });

  // Invoice number, date, amount, and billing period are read directly from the uploaded PDF — no manual entry.
  const uploadInvoice = (files: FileList) => {
    const fd = new FormData();
    fd.append("file", files[0]);
    setUploading(true);
    mutate(() => api.addInvoice(callOrderId, fd)).finally(() => setUploading(false));
  };
  const markPaid = (inv: Invoice) => mutate(() => api.updateInvoice(callOrderId, inv.id, { paymentStatus: "paid", paidDate: todayLabel() }));
  const remove = (inv: Invoice) => mutate(() => api.removeInvoice(callOrderId, inv.id));

  return (
    <div className="card">
      <div className="card-head wide">
        <div>Invoices</div>
        {isPm && (
          <FileButton primary onFiles={uploadInvoice}>
            {uploading ? "Uploading…" : "Upload invoice"}
          </FileButton>
        )}
      </div>
      <div className="add-row">
        <Field label="Filter by invoice #"><TextInput value={filter.invoiceNumber} onChange={(v) => setFilter({ ...filter, invoiceNumber: v })} /></Field>
        <Field label="Filter by invoice date"><input type="date" className="input" value={filter.invoiceDate} onChange={(e) => setFilter({ ...filter, invoiceDate: e.target.value })} /></Field>
        {(filter.invoiceNumber || filter.invoiceDate) && <Button onClick={() => setFilter(emptyFilter)}>Clear</Button>}
      </div>
      <div className="grid thead tight" style={{ gridTemplateColumns: "1fr 1fr 1fr 1fr 0.8fr 0.8fr" }}>
        <SortHeaders cols={COLS} cur={cur} onSort={toggle} />
        <div className="th right">Actions</div>
      </div>
      {sorted.map((inv) => {
        const color = agingColor(inv, today);
        return (
          <div key={inv.id} className="grid trow tight" style={{ gridTemplateColumns: "1fr 1fr 1fr 1fr 0.8fr 0.8fr" }}>
            <div style={color ? { color, fontWeight: 600 } : undefined}>
              {inv.fileHref ? <a href={inv.fileHref} target="_blank" rel="noreferrer">#{inv.invoiceNumber}</a> : `#${inv.invoiceNumber}`}
            </div>
            <div style={color ? { color, fontWeight: 600 } : undefined}>{dateLabel(inv.invoiceDate)}</div>
            <div className="num">{usdFull(inv.amount)}</div>
            <div>{dateLabel(inv.periodEnd)}</div>
            <div style={color ? { color, fontWeight: 600 } : undefined}>{inv.paymentStatus === "paid" ? `Paid ${dateLabel(inv.paidDate)}` : "Unpaid"}</div>
            <div className="right" style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
              {isPm && inv.paymentStatus === "unpaid" && <Button onClick={() => markPaid(inv)}>Mark paid</Button>}
              {isPm && <Button onClick={() => remove(inv)}>Delete</Button>}
            </div>
          </div>
        );
      })}
      {!invoices.length && <div className="card-empty">No invoices have been recorded.</div>}
      {invoices.length > 0 && !sorted.length && <div className="card-empty">No invoices match the current filter.</div>}
    </div>
  );
}
