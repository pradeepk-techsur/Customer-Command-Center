import { useState } from "react";
import type { CallOrder, CallOrderAwardPreview, CallOrderSetupInput } from "../../shared/types.ts";
import { api } from "../api.ts";
import { Button, Field, FileButton, TextArea, TextInput } from "./ui.tsx";

const blankSetup: CallOrderSetupInput = {
  callNumber: "",
  name: "",
  description: "",
  narrative: "",
  popStart: "",
  popEnd: "",
  funded: "",
  spend: "0",
  eac: "",
  overUnder: "",
  pm: "",
};

function setupFromOrder(order: CallOrder): CallOrderSetupInput {
  return {
    callNumber: order.id,
    name: order.name,
    description: order.description,
    narrative: order.narrative,
    popStart: order.popStart ?? "",
    popEnd: order.popEnd ?? "",
    funded: String(order.funded),
    spend: String(order.spend),
    eac: order.eac === null ? "" : String(order.eac),
    overUnder: order.over === null ? "" : String(order.over),
    pm: order.pm === "Unassigned" ? "" : order.pm,
  };
}

export function CallOrderSetupPage({ mode, order, onCancel, onSubmit }: {
  mode: "create" | "edit";
  order?: CallOrder;
  onCancel: () => void;
  onSubmit: (input: CallOrderSetupInput, award?: File) => Promise<boolean>;
}) {
  const [form, setForm] = useState<CallOrderSetupInput>(() => order ? setupFromOrder(order) : blankSetup);
  const [award, setAward] = useState<File>();
  const [preview, setPreview] = useState<CallOrderAwardPreview>();
  const [stage, setStage] = useState<"choose" | "form">(mode === "edit" ? "form" : "choose");
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const change = (field: keyof CallOrderSetupInput, value: string) => setForm((current) => ({ ...current, [field]: value }));
  const readAward = async (files: FileList) => {
    const file = files[0];
    if (!file) return;
    setReading(true);
    setError("");
    try {
      const parsed = await api.previewCallOrderAward(file);
      setAward(file);
      setPreview(parsed);
      setForm({ ...parsed.draft, callNumber: form.callNumber ?? "" });
      setStage("form");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setReading(false);
    }
  };

  const submit = async () => {
    if (!form.callNumber?.trim()) { setError("Enter the call-order ID."); return; }
    if (!form.name.trim()) { setError("Enter the call-order name."); return; }
    if (!form.popStart || !form.popEnd) { setError("Enter the complete period of performance."); return; }
    if (form.popEnd < form.popStart) { setError("Period end must be on or after the start date."); return; }
    setSaving(true);
    setError("");
    const saved = await onSubmit(form, award);
    if (!saved) setError("The call order could not be saved. Review the message above and try again.");
    setSaving(false);
  };

  if (stage === "choose") {
    return (
      <div className="page detail">
        <button type="button" className="back-link" onClick={onCancel}><span className="mono">←</span><span>BPA dashboard</span></button>
        <div className="page-head">
          <div><div className="detail-id">Call-order setup</div><h1>Add call order</h1><div className="page-sub">Start from the award document or enter the setup details manually.</div></div>
        </div>
        {error && <div className="setup-error">{error}</div>}
        <div className="setup-source-grid">
          <div className="setup-source-card">
            <div className="detail-id">Recommended</div>
            <h2>Upload award document</h2>
            <p>Read the order number, title, funding, and period of performance from a PDF or DOCX, then review every value before submission.</p>
            <FileButton primary accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" multiple={false} onFiles={readAward}>
              {reading ? "Reading award…" : "Choose award"}
            </FileButton>
          </div>
          <div className="setup-source-card">
            <div className="detail-id">No document required</div>
            <h2>Enter manually</h2>
            <p>Create the call order from the same complete setup form without attaching an award document.</p>
            <Button onClick={() => setStage("form")}>Enter details</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page detail">
      <button type="button" className="back-link" onClick={onCancel}><span className="mono">←</span><span>{mode === "create" ? "Cancel new call order" : `Back to ${order?.id}`}</span></button>
      <div className="page-head">
        <div>
          <div className="detail-id">{mode === "create" ? "Review and submit" : `${order?.id} · Setup`}</div>
          <h1>{mode === "create" ? "New call order" : "Edit call-order setup"}</h1>
          <div className="page-sub">{mode === "create" ? "Confirm the award-derived values and complete any missing fields." : `The ID may be corrected within ${order?.groupKey}. Related records will move with it.`}</div>
        </div>
      </div>

      {award && (
        <div className="setup-file">
          <div><strong>{award.name}</strong>{preview?.externalOrderNumber && <span> · Order {preview.externalOrderNumber}</span>}</div>
          <div>{preview?.warnings.length ? preview.warnings.join(" ") : "Award fields extracted. Review them before submission."}</div>
        </div>
      )}
      {error && <div className="setup-error">{error}</div>}

      <div className="form-card">
        <div className="form-head">Identity and ownership</div>
        <div className="form-body">
          <div className="two-col">
            <Field label="Call-order ID"><TextInput value={form.callNumber ?? ""} onChange={(v) => change("callNumber", v)} placeholder={mode === "create" ? "Call 20" : "Call 13.1"} /></Field>
            <Field label="Project Manager"><TextInput value={form.pm} onChange={(v) => change("pm", v)} placeholder="Unassigned" /></Field>
          </div>
          <Field label="Call-order name"><TextInput value={form.name} onChange={(v) => change("name", v)} placeholder="Enterprise Architecture Support" /></Field>
          <Field label="Description"><TextArea rows={4} value={form.description} onChange={(v) => change("description", v)} /></Field>
          <Field label="Narrative"><TextArea rows={3} value={form.narrative} onChange={(v) => change("narrative", v)} /></Field>
        </div>
      </div>

      <div className="form-card">
        <div className="form-head">Period and financial setup</div>
        <div className="form-body">
          <div className="two-col">
            <Field label="Period start"><input type="date" className="input" value={form.popStart} onChange={(e) => change("popStart", e.target.value)} /></Field>
            <Field label="Period end"><input type="date" className="input" value={form.popEnd} onChange={(e) => change("popEnd", e.target.value)} /></Field>
          </div>
          <div className="two-col">
            <Field label="Funds obligated"><TextInput value={form.funded} onChange={(v) => change("funded", v)} placeholder="$0.00" /></Field>
            <Field label="Funds expended"><TextInput value={form.spend} onChange={(v) => change("spend", v)} placeholder="$0.00" /></Field>
          </div>
          <div className="two-col">
            <Field label="Estimate at completion"><TextInput value={form.eac} onChange={(v) => change("eac", v)} placeholder="$0.00" /></Field>
            <Field label="Over / under"><TextInput value={form.overUnder} onChange={(v) => change("overUnder", v)} placeholder="$0.00" /></Field>
          </div>
          <div className="form-actions">
            <Button onClick={onCancel} disabled={saving}>Cancel</Button>
            <Button primary onClick={submit} disabled={saving}>{saving ? "Saving…" : mode === "create" ? "Create call order" : "Save setup"}</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
