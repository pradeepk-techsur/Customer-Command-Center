import { useState } from "react";
import type { Invoice, InvoiceCreateInput, InvoicePreview } from "../../shared/types.ts";
import { api } from "../api.ts";
import { useSort } from "../hooks/useSort.ts";
import { daysOld, dateLabel, localDate, usdFull } from "../lib/format.ts";
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
const blankInvoice: InvoiceCreateInput = {
  invoiceNumber: "",
  invoiceDate: "",
  amount: "",
  periodStart: "",
  periodEnd: "",
};

const COLS = [
  { key: "invoiceNumber", label: "Invoice #" }, { key: "invoiceDate", label: "Invoice date" },
  { key: "amount", label: "Amount", align: "right" as const }, { key: "period", label: "Period" },
  { key: "status", label: "Status" },
];

export function InvoicesTab({ callOrderId, invoices, today, isPm, mutate }: {
  callOrderId: string | null; invoices: Invoice[]; today: string; isPm: boolean; mutate: Mutate;
}) {
  const [filter, setFilter] = useState(emptyFilter);
  const [stage, setStage] = useState<"closed" | "choose" | "form">("closed");
  const [source, setSource] = useState<"pdf" | "manual">("manual");
  const [draft, setDraft] = useState<InvoiceCreateInput>(blankInvoice);
  const [file, setFile] = useState<File>();
  const [preview, setPreview] = useState<InvoicePreview>();
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [attachingId, setAttachingId] = useState<number>();
  const [error, setError] = useState("");
  const [attachmentError, setAttachmentError] = useState("");

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

  const change = (field: keyof InvoiceCreateInput, value: string) => setDraft((current) => ({ ...current, [field]: value }));
  const resetCreator = () => {
    setStage("closed");
    setSource("manual");
    setDraft(blankInvoice);
    setFile(undefined);
    setPreview(undefined);
    setError("");
  };
  const readInvoice = async (files: FileList) => {
    const selected = files[0];
    if (!selected) return;
    setReading(true);
    setError("");
    try {
      const parsed = await api.previewInvoice(callOrderId, selected);
      setSource("pdf");
      setFile(selected);
      setPreview(parsed);
      setDraft(parsed.draft);
      setStage("form");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setReading(false);
    }
  };
  const enterManually = () => {
    setSource("manual");
    setDraft(blankInvoice);
    setFile(undefined);
    setPreview(undefined);
    setError("");
    setStage("form");
  };
  const selectManualFile = (files: FileList) => {
    const selected = files[0];
    if (!selected) return;
    setFile(selected);
    setError("");
  };
  const saveInvoice = async () => {
    if (!draft.invoiceNumber.trim()) { setError("Enter the invoice number."); return; }
    if (!draft.invoiceDate) { setError("Enter the invoice date."); return; }
    if (!draft.amount.trim()) { setError("Enter the invoice amount."); return; }
    if (!draft.periodStart || !draft.periodEnd) { setError("Enter the complete billing period."); return; }
    if (draft.periodEnd < draft.periodStart) { setError("Billing period end must be on or after the start date."); return; }
    setSaving(true);
    setError("");
    const saved = await mutate(() => api.addInvoice(callOrderId, draft, file, source));
    if (saved) resetCreator();
    else setError("The invoice could not be saved. Review the message above and try again.");
    setSaving(false);
  };
  const markPaid = (inv: Invoice) => mutate(() => api.updateInvoice(callOrderId, inv.id, { paymentStatus: "paid" }));
  const remove = (inv: Invoice) => mutate(() => api.removeInvoice(callOrderId, inv.id));
  const attachFile = async (inv: Invoice, files: FileList) => {
    const selected = files[0];
    if (!selected) return;
    setAttachingId(inv.id);
    setAttachmentError("");
    const saved = await mutate(() => api.attachInvoiceFile(callOrderId, inv.id, selected));
    if (!saved) setAttachmentError(`The PDF for invoice ${inv.invoiceNumber} could not be saved.`);
    setAttachingId(undefined);
  };

  return (
    <div className="card">
      <div className="card-head wide">
        <div>Invoices</div>
        {isPm && <Button primary={stage === "closed"} onClick={() => stage === "closed" ? setStage("choose") : resetCreator()}>{stage === "closed" ? "Add invoice" : "Cancel"}</Button>}
      </div>
      {stage === "choose" && (
        <div className="invoice-source-grid">
          <div className="invoice-source-card">
            <div className="detail-id">PDF-assisted</div>
            <h3>Upload invoice</h3>
            <p>Extract invoice details from a PDF, then review and complete every required value before saving.</p>
            <FileButton primary accept=".pdf,application/pdf" multiple={false} onFiles={readInvoice}>
              {reading ? "Reading invoice…" : "Choose PDF"}
            </FileButton>
          </div>
          <div className="invoice-source-card">
            <div className="detail-id">Optional PDF</div>
            <h3>Enter manually</h3>
            <p>Enter invoice details yourself and optionally retain the invoice PDF for later access.</p>
            <Button onClick={enterManually}>Enter details</Button>
          </div>
        </div>
      )}
      {stage === "form" && (
        <div className="invoice-editor">
          <div className="invoice-editor-head">
            <div>
              <strong>{source === "pdf" ? "Review extracted details" : "Enter invoice details"}</strong>
              <div>{file ? file.name : "Manual invoice · no file attached"}</div>
            </div>
            <span>Payment status: Unpaid</span>
          </div>
          {preview?.warnings.length ? <div className="invoice-warning">{preview.warnings.join(" ")} Complete the missing fields below.</div> : null}
          {error && <div className="setup-error">{error}</div>}
          <div className="three-col">
            <Field label="Invoice number *"><TextInput value={draft.invoiceNumber} onChange={(value) => change("invoiceNumber", value)} /></Field>
            <Field label="Invoice date *"><input type="date" className="input" value={draft.invoiceDate} onChange={(e) => change("invoiceDate", e.target.value)} /></Field>
            <Field label="Amount *"><input type="number" min="0" step="0.01" className="input num" value={draft.amount} onChange={(e) => change("amount", e.target.value)} /></Field>
          </div>
          <div className="two-col">
            <Field label="Billing period start *"><input type="date" className="input" value={draft.periodStart} onChange={(e) => change("periodStart", e.target.value)} /></Field>
            <Field label="Billing period end *"><input type="date" className="input" value={draft.periodEnd} onChange={(e) => change("periodEnd", e.target.value)} /></Field>
          </div>
          {source === "manual" && (
            <div className="invoice-file-row">
              <div>
                <strong>Invoice PDF (optional)</strong>
                <div>{file ? file.name : "No file attached"}</div>
              </div>
              <FileButton accept=".pdf,application/pdf" multiple={false} onFiles={selectManualFile}>
                {file ? "Choose different PDF" : "Attach PDF"}
              </FileButton>
              {file && <Button onClick={() => setFile(undefined)}>Remove</Button>}
            </div>
          )}
          <div className="form-actions">
            <Button onClick={() => setStage("choose")} disabled={saving}>Choose another method</Button>
            <Button primary onClick={saveInvoice} disabled={saving}>{saving ? "Saving…" : "Save invoice"}</Button>
          </div>
        </div>
      )}
      {attachmentError && <div className="invoice-attachment-error setup-error">{attachmentError}</div>}
      <div className="add-row">
        <Field label="Filter by invoice #"><TextInput value={filter.invoiceNumber} onChange={(v) => setFilter({ ...filter, invoiceNumber: v })} /></Field>
        <Field label="Filter by invoice date"><input type="date" className="input" value={filter.invoiceDate} onChange={(e) => setFilter({ ...filter, invoiceDate: e.target.value })} /></Field>
        {(filter.invoiceNumber || filter.invoiceDate) && <Button onClick={() => setFilter(emptyFilter)}>Clear</Button>}
      </div>
      <div className="grid thead tight" style={{ gridTemplateColumns: "1fr 1fr 1fr 1fr 0.8fr 1.8fr" }}>
        <SortHeaders cols={COLS} cur={cur} onSort={toggle} />
        <div className="th right">Actions</div>
      </div>
      {sorted.map((inv) => {
        const color = agingColor(inv, today);
        return (
          <div key={inv.id} className="grid trow tight" style={{ gridTemplateColumns: "1fr 1fr 1fr 1fr 0.8fr 1.8fr" }}>
            <div style={color ? { color, fontWeight: 600 } : undefined}>
              {inv.fileHref ? <a href={inv.fileHref} target="_blank" rel="noreferrer">#{inv.invoiceNumber}</a> : `#${inv.invoiceNumber}`}
            </div>
            <div style={color ? { color, fontWeight: 600 } : undefined}>{dateLabel(inv.invoiceDate)}</div>
            <div className="num">{usdFull(inv.amount)}</div>
            <div>{inv.periodStart && inv.periodEnd ? `${dateLabel(inv.periodStart)} – ${dateLabel(inv.periodEnd)}` : dateLabel(inv.periodEnd)}</div>
            <div style={color ? { color, fontWeight: 600 } : undefined}>{inv.paymentStatus === "paid" ? `Paid ${dateLabel(inv.paidDate)}` : "Unpaid"}</div>
            <div className="right" style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
              {inv.fileHref && <a className="btn invoice-file-link" href={inv.fileHref} target="_blank" rel="noreferrer">View PDF</a>}
              {isPm && inv.paymentStatus === "unpaid" && <Button onClick={() => markPaid(inv)}>Mark paid</Button>}
              {isPm && (attachingId === inv.id
                ? <span className="muted">Uploading...</span>
                : <FileButton accept=".pdf,application/pdf" multiple={false} onFiles={(files) => attachFile(inv, files)}>{inv.fileHref ? "Replace PDF" : "Attach PDF"}</FileButton>)}
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
