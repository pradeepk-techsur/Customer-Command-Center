import { useState } from "react";
import type { CallOrder, PortalSnapshot, StaffMember } from "../../shared/types.ts";
import { STATUS_OPTIONS } from "../../shared/types.ts";
import { api } from "../api.ts";
import { useSort } from "../hooks/useSort.ts";
import { dateLabel, filled, isDeparted, isStale, isVacant, rate } from "../lib/format.ts";
import { Button, Eyebrow, Field, SortHeaders, TextInput } from "./ui.tsx";
import type { Mutate } from "../App.tsx";

const STAFF_COLS = [
  { key: "name", label: "Name" }, { key: "lcat", label: "Labor category" },
  { key: "rate", label: "Rate", align: "right" as const }, { key: "status", label: "Status", align: "right" as const },
];

const nameClass = (s: StaffMember) => "name" + (isVacant(s.name) ? " vacant" : isDeparted(s.status) ? " departed" : "");

export function PeopleTab({ order: c, snapshot, isPm, mutate, onSelectStaff }: {
  order: CallOrder; snapshot: PortalSnapshot; isPm: boolean; mutate: Mutate; onSelectStaff?: (staffId: number) => void;
}) {
  const [ns, setNs] = useState({ name: "", laborCategory: "", rate: "" });
  // Accordion: both sections start open; collapsing either reclaims vertical space on long rosters.
  const [openRoster, setOpenRoster] = useState(true);
  const [openSourcing, setOpenSourcing] = useState(true);
  // Editing a roster row in place — lets a PM fill a vacant slot or correct an LCAT/rate without
  // deleting and re-adding the person (which would lose their onboarding/equipment history).
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ name: "", laborCategory: "", rate: "" });
  const startEdit = (s: StaffMember) => { setEditingId(s.id); setEditForm({ name: s.name, laborCategory: s.laborCategory, rate: String(s.rate) }); };
  const cancelEdit = () => { setEditingId(null); };
  const saveEdit = (staffId: number) => mutate(() => api.updateStaff(staffId, editForm)).then(() => setEditingId(null));
  const { sorted, cur, toggle } = useSort("staff", "name", c.staff, {
    name: (s) => s.name, lcat: (s) => s.laborCategory, rate: (s) => s.rate, status: (s) => s.status,
  });
  const stale = isStale(c, "people", snapshot.today, snapshot.config);
  const contractedFte = c.laborCategories.reduce((s, l) => s + l.fte, 0);
  const tiles = [
    { label: "Contracted FTE", value: contractedFte || "—" },
    { label: "Assigned", value: filled(c) },
    { label: "Vacant", value: c.staff.filter((s) => isVacant(s.name)).length },
    { label: "Departed", value: c.staff.filter((s) => isDeparted(s.status)).length },
    { label: "Labor categories", value: new Set(c.laborCategories.map((l) => l.name)).size || "—" },
  ];
  const cols = isPm ? "1.5fr 1.5fr 0.7fr 1fr 0.6fr 0.5fr" : "1.6fr 1.6fr 0.8fr 0.8fr";

  const addPerson = () => {
    if (!ns.name.trim()) return;
    mutate(() => api.addStaff(c.id, ns)).then(() => setNs({ name: "", laborCategory: "", rate: "" }));
  };

  return (
    <>
      <div className="tiles">
        {tiles.map((t) => <div key={t.label} className="tile"><Eyebrow>{t.label}</Eyebrow><div className="value num">{t.value}</div></div>)}
      </div>

      <div className="card">
        <button type="button" className="card-head wide accordion-toggle" onClick={() => setOpenRoster((v) => !v)}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className={"accordion-chevron" + (openRoster ? " open" : "")}>▶</span>
            <span>Assigned personnel</span>
          </div>
          <div className={"stamp" + (stale ? " stale" : "")}>Staffing updated {dateLabel(c.peopleUpdatedOn)}</div>
        </button>
        {openRoster && (
          <>
            <div className="grid thead" style={{ gridTemplateColumns: cols, padding: "10px 20px" }}>
              <SortHeaders cols={STAFF_COLS} cur={cur} onSort={toggle} />
              {isPm && <div className="th static right">Edit</div>}
              {isPm && <div className="th static right">Remove</div>}
            </div>
            {sorted.map((s) => {
              // A stored status outside the vocabulary (a free-text note) stays selectable so it is never overwritten by accident.
              const options = STATUS_OPTIONS.includes(s.status) ? STATUS_OPTIONS : [s.status, ...STATUS_OPTIONS];
              if (isPm && editingId === s.id) {
                return (
                  <div key={s.id} className="add-row" style={{ flexDirection: "column", alignItems: "stretch" }}>
                    <div className="two-col">
                      <Field label="Name"><TextInput value={editForm.name} onChange={(v) => setEditForm({ ...editForm, name: v })} /></Field>
                      <Field label="Labor category"><TextInput value={editForm.laborCategory} onChange={(v) => setEditForm({ ...editForm, laborCategory: v })} /></Field>
                    </div>
                    <Field label="Rate" style={{ width: 140 }}><TextInput value={editForm.rate} onChange={(v) => setEditForm({ ...editForm, rate: v })} /></Field>
                    <div style={{ display: "flex", gap: 10 }}>
                      <Button primary onClick={() => saveEdit(s.id)}>Save</Button>
                      <Button onClick={cancelEdit}>Cancel</Button>
                    </div>
                  </div>
                );
              }
              return (
                <div key={s.id} className="grid trow roster" style={{ gridTemplateColumns: cols }}>
                  {onSelectStaff ? (
                    <button type="button" className={nameClass(s) + " link-text"} style={{ textAlign: "left" }} onClick={() => onSelectStaff(s.id)}>{s.name}</button>
                  ) : (
                    <div className={nameClass(s)}>{s.name}</div>
                  )}
                  <div style={{ color: "var(--ink-3)" }}>{s.laborCategory}</div>
                  <div className="right num muted">{rate(s.rate)}</div>
                  {isPm ? (
                    <>
                      <select className="select" value={s.status} onChange={(e) => mutate(() => api.setStaffStatus(s.id, e.target.value))}>
                        {options.map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                      <button type="button" className="link-text right" onClick={() => startEdit(s)}>Edit</button>
                      <button type="button" className="remove-btn" title="Remove person" onClick={() => mutate(() => api.removeStaff(s.id))}>×</button>
                    </>
                  ) : (
                    <div className="right status-token" style={{ color: "var(--ink)" }}>{s.status}</div>
                  )}
                </div>
              );
            })}
            {!c.staff.length && <div className="card-empty">No personnel have been assigned to this period yet.</div>}
            {isPm && (
              <div className="add-row">
                <Field label="Name" style={{ flex: 1.5 }}><TextInput value={ns.name} onChange={(v) => setNs({ ...ns, name: v })} /></Field>
                <Field label="Labor category" style={{ flex: 1.5 }}><TextInput value={ns.laborCategory} onChange={(v) => setNs({ ...ns, laborCategory: v })} /></Field>
                <Field label="Rate" style={{ width: 110 }}><TextInput value={ns.rate} onChange={(v) => setNs({ ...ns, rate: v })} /></Field>
                <Button primary onClick={addPerson}>Add person</Button>
              </div>
            )}
          </>
        )}
      </div>

      {isPm && (
        <div className="card" style={{ marginTop: 18 }}>
          <button type="button" className="card-head accordion-toggle" onClick={() => setOpenSourcing((v) => !v)}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className={"accordion-chevron" + (openSourcing ? " open" : "")}>▶</span>
              <span>Open billet sourcing status</span>
            </div>
          </button>
          {openSourcing && (
            <>
              {c.laborCategories.map((l) => (
                <div key={l.id} className="fin-row">
                  <div style={{ color: "var(--ink-3)" }}>{l.name}</div>
                  <select className="select" value={l.vacancyStatus || ""} onChange={(e) => mutate(() => api.setLcatVacancyStatus(l.id, e.target.value))}>
                    <option value="">Not tracked</option>
                    <option value="sourcing">Sourcing</option>
                    <option value="on_hold">On hold</option>
                    <option value="onboarding">Onboarding</option>
                  </select>
                </div>
              ))}
              {!c.laborCategories.length && <div className="card-empty">No labor categories to track.</div>}
            </>
          )}
        </div>
      )}
    </>
  );
}
