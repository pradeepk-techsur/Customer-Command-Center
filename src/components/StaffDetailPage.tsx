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
];

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
            <div className="fin-row"><div style={{ color: "var(--ink-3)" }}>Start date</div><div className="v">{dateLabel(s.startDate)}</div></div>
            {departed && <div className="fin-row"><div style={{ color: "var(--ink-3)" }}>End date</div><div className="v">{dateLabel(s.endDate)}</div></div>}
            <div className="fin-row"><div style={{ color: "var(--ink-3)" }}>PIV issued</div><div className="v">{dateLabel(s.pivIssuedDate)}</div></div>
            {isPm && !s.pivIssuedDate && (
              <Field label="Record PIV issuance date">
                <input type="date" className="input" onChange={(e) => setStageDate("pivIssuedDate", e.target.value)} />
              </Field>
            )}
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
        <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 10 }}>
          {ONBOARDING_STAGES.map((stage) => {
            const value = s[stage.key] as string | null;
            return (
              <div key={String(stage.key)} className="fin-row">
                <div style={{ color: "var(--ink-3)" }}>{stage.label}</div>
                {value ? <div className="v">{dateLabel(value)}</div>
                  : isPm ? <input type="date" className="input" onChange={(e) => setStageDate(stage.key, e.target.value)} />
                  : <div className="v">—</div>}
              </div>
            );
          })}
        </div>
      </div>

      {departed && (
        <div className="card" style={{ marginTop: 18 }}>
          <div className="card-head">Property return</div>
          <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 10 }}>
            {s.propertyReturnDocHref
              ? <a href={s.propertyReturnDocHref} target="_blank" rel="noreferrer">Open property return document</a>
              : <div className="card-empty">No property return document uploaded.</div>}
            {isPm && (
              <div style={{ display: "flex", gap: 8 }}>
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
