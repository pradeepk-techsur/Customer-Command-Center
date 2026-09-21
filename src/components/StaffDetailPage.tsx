import { useRef, useState } from "react";
import type { StaffMember } from "../../shared/types.ts";
import { api } from "../api.ts";
import { dateLabel, isDeparted } from "../lib/format.ts";
import { Button, Field, TextInput } from "./ui.tsx";
import type { Mutate } from "../App.tsx";

const ONBOARDING_STAGES: { key: keyof StaffMember; label: string }[] = [
  { key: "offerAcceptedDate", label: "Offer Accepted" },
  { key: "of306SubmittedDate", label: "OF-306 Submitted" },
  { key: "fingerprintsCompleteDate", label: "Fingerprints Complete" },
  { key: "laptopReceivedDate", label: "Laptop Received" },
  { key: "startDate", label: "Start Date" },
  { key: "pivIssuedDate", label: "PIV Issued" },
];

/**
 * A date value with an explicit Edit/Save/Cancel flow (rather than saving on every onChange).
 * Native date inputs fire onChange with an incomplete-looking date while the user is still
 * picking a month/day, so auto-saving on change could silently record the wrong date — this
 * requires a deliberate Save click instead.
 */
function EditableDate({ label, value, isPm, onSave }: { label: string; value: string | null; isPm: boolean; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  if (!isPm) return <div className="fin-row"><div style={{ color: "var(--ink-3)" }}>{label}</div><div className="v">{dateLabel(value)}</div></div>;
  if (!editing) {
    return (
      <div className="fin-row">
        <div style={{ color: "var(--ink-3)" }}>{label}</div>
        <div className="v" style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {dateLabel(value)}
          <button type="button" className="link-text" onClick={() => { setDraft(value ?? ""); setEditing(true); }}>Edit</button>
        </div>
      </div>
    );
  }
  return (
    <div className="fin-row">
      <div style={{ color: "var(--ink-3)" }}>{label}</div>
      <div className="v" style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <input type="date" className="input" value={draft} onChange={(e) => setDraft(e.target.value)} />
        <Button primary onClick={() => { onSave(draft); setEditing(false); }}>Save</Button>
        <Button onClick={() => setEditing(false)}>Cancel</Button>
      </div>
    </div>
  );
}

export function StaffDetailPage({ staff: s, isPm, mutate, onBack }: { staff: StaffMember; isPm: boolean; mutate: Mutate; onBack: () => void }) {
  const [contact, setContact] = useState({ aoEmail: s.aoEmail || "", phone: s.phone || "" });
  const [newEquip, setNewEquip] = useState({ makeModel: "", propertyTagNumber: "" });
  const propertyReturnRef = useRef<HTMLInputElement>(null);
  const departed = isDeparted(s.status);

  const saveContact = () => mutate(() => api.updateStaffContact(s.id, contact));
  const setStageDate = (key: keyof StaffMember, value: string) => mutate(() => api.updateStaffContact(s.id, { [key]: value }));
  const addEquipment = () => {
    if (!newEquip.makeModel.trim()) return;
    mutate(() => api.addStaffEquipment(s.id, newEquip)).then(() => setNewEquip({ makeModel: "", propertyTagNumber: "" }));
  };
  const removeEquipment = (equipmentId: number) => mutate(() => api.removeStaffEquipment(equipmentId));
  const uploadPropertyReturn = () => {
    const file = propertyReturnRef.current?.files?.[0];
    if (file) mutate(() => api.uploadPropertyReturn(s.id, file));
  };

  return (
    <div className="page detail">
      <button type="button" className="back-link" onClick={onBack}><span className="mono">←</span><span>Back to staffing</span></button>
      <h1 style={{ marginBottom: 8 }}>{s.name}</h1>
      <div className="page-sub">{s.laborCategory} · {s.status}</div>

      <div className="fin-grid" style={{ marginTop: 20 }}>
        <div className="card">
          <div className="card-head">Contact information</div>
          <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
            <Field label="AO email"><TextInput value={contact.aoEmail} onChange={(v) => setContact({ ...contact, aoEmail: v })} disabled={!isPm} /></Field>
            <Field label="Phone"><TextInput value={contact.phone} onChange={(v) => setContact({ ...contact, phone: v })} disabled={!isPm} /></Field>
            {isPm && <Button primary onClick={saveContact}>Save contact info</Button>}
            <EditableDate label="Start date" value={s.startDate} isPm={isPm} onSave={(v) => setStageDate("startDate", v)} />
          </div>
        </div>

        <div className="card">
          <div className="card-head">Equipment</div>
          {s.equipment.map((e) => (
            <div key={e.id} className="fin-row">
              <div>{e.makeModel}{e.propertyTagNumber ? ` · Tag ${e.propertyTagNumber}` : ""}</div>
              {isPm && <button type="button" className="remove-btn" onClick={() => removeEquipment(e.id)}>×</button>}
            </div>
          ))}
          {!s.equipment.length && <div className="card-empty">No equipment recorded.</div>}
          {isPm && (
            <div className="add-row">
              <Field label="Make/model" style={{ flex: 1.5 }}><TextInput value={newEquip.makeModel} onChange={(v) => setNewEquip({ ...newEquip, makeModel: v })} /></Field>
              <Field label="Property tag #" style={{ flex: 1 }}><TextInput value={newEquip.propertyTagNumber} onChange={(v) => setNewEquip({ ...newEquip, propertyTagNumber: v })} /></Field>
              <Button primary onClick={addEquipment}>Add</Button>
            </div>
          )}
        </div>
      </div>

      <div className="card" style={{ marginTop: 18 }}>
        <div className="card-head">Onboarding stages</div>
        <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 4 }}>
          {ONBOARDING_STAGES.map((stage) => (
            <EditableDate key={String(stage.key)} label={stage.label} value={s[stage.key] as string | null} isPm={isPm} onSave={(v) => setStageDate(stage.key, v)} />
          ))}
        </div>
      </div>

      {(isPm || departed) && (
        <div className="card" style={{ marginTop: 18 }}>
          <div className="card-head">Offboarding</div>
          <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 4 }}>
            <EditableDate label="End date" value={s.endDate} isPm={isPm} onSave={(v) => setStageDate("endDate", v)} />
            <EditableDate label="Date equipment returned" value={s.equipmentReturnedDate} isPm={isPm} onSave={(v) => setStageDate("equipmentReturnedDate", v)} />
            <div className="fin-row">
              <div style={{ color: "var(--ink-3)" }}>Property return document</div>
              <div className="v">
                {s.propertyReturnDocHref
                  ? <a href={s.propertyReturnDocHref} target="_blank" rel="noreferrer">Open document</a>
                  : "—"}
              </div>
            </div>
            {isPm && (
              <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                <input type="file" ref={propertyReturnRef} />
                <Button onClick={uploadPropertyReturn}>Upload</Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
