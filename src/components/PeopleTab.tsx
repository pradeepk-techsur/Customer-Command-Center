import { useState } from "react";
import type { CallOrder, PortalSnapshot, StaffMember } from "../../shared/types.ts";
import { STATUS_OPTIONS } from "../../shared/types.ts";
import { api } from "../api.ts";
import { useSort } from "../hooks/useSort.ts";
import { dateLabel, filled, isAssigned, isDeparted, isStale, isVacant, normalizeLcat, rate } from "../lib/format.ts";
import { Button, Eyebrow, Field, SortHeaders, TextInput } from "./ui.tsx";
import type { Mutate } from "../App.tsx";

const STAFF_COLS = [
  { key: "name", label: "Name" }, { key: "lcat", label: "Labor category" },
  { key: "rate", label: "Rate", align: "right" as const }, { key: "status", label: "Status", align: "right" as const },
];

const nameClass = (s: StaffMember) => "name" + (isVacant(s.name) ? " vacant" : isDeparted(s.status) ? " departed" : "");

interface LcatGroup { name: string; fte: number; rate: number; people: StaffMember[]; assigned: number }

/** Files each person under a contracted category: exact normalized match first, then a full-string prefix match. */
function groupByLcat(c: CallOrder): LcatGroup[] {
  const byName = new Map<string, LcatGroup>();
  for (const l of c.laborCategories) {
    const g = byName.get(l.name) || { name: l.name, fte: 0, rate: l.rate, people: [], assigned: 0 };
    g.fte += l.fte;
    byName.set(l.name, g);
  }
  for (const s of c.staff) {
    const target = normalizeLcat(s.laborCategory);
    const keys = [...byName.keys()];
    const k = keys.find((n) => normalizeLcat(n) === target)
      || keys.find((n) => normalizeLcat(n).startsWith(target) || target.startsWith(normalizeLcat(n)))
      || s.laborCategory;
    const g = byName.get(k) || { name: k, fte: 0, rate: s.rate, people: [], assigned: 0 };
    g.people.push(s);
    if (isAssigned(s)) g.assigned += 1;
    byName.set(k, g);
  }
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function PeopleTab({ order: c, snapshot, isPm, mutate }: { order: CallOrder; snapshot: PortalSnapshot; isPm: boolean; mutate: Mutate }) {
  const [ns, setNs] = useState({ name: "", laborCategory: "", rate: "" });
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
  const cols = isPm ? "1.5fr 1.5fr 0.7fr 1fr 0.5fr" : "1.6fr 1.6fr 0.8fr 0.8fr";

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
        <div className="card-head wide">
          <div>Assigned personnel</div>
          <div className={"stamp" + (stale ? " stale" : "")}>Staffing updated {dateLabel(c.peopleUpdatedOn)}</div>
        </div>
        <div className="grid thead" style={{ gridTemplateColumns: cols, padding: "10px 20px" }}>
          <SortHeaders cols={STAFF_COLS} cur={cur} onSort={toggle} />
          {isPm && <div className="th static right">Remove</div>}
        </div>
        {sorted.map((s) => {
          // A stored status outside the vocabulary (a free-text note) stays selectable so it is never overwritten by accident.
          const options = STATUS_OPTIONS.includes(s.status) ? STATUS_OPTIONS : [s.status, ...STATUS_OPTIONS];
          return (
            <div key={s.id} className="grid trow roster" style={{ gridTemplateColumns: cols }}>
              <div className={nameClass(s)}>{s.name}</div>
              <div style={{ color: "var(--ink-3)" }}>{s.laborCategory}</div>
              <div className="right num muted">{rate(s.rate)}</div>
              {isPm ? (
                <>
                  <select className="select" value={s.status} onChange={(e) => mutate(() => api.setStaffStatus(s.id, e.target.value))}>
                    {options.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
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
      </div>

      <div className="card" style={{ marginTop: 18 }}>
        <div className="card-head wide">By labor category</div>
        {groupByLcat(c).map((g) => (
          <div key={g.name} style={{ borderBottom: "1px solid var(--line-soft)" }}>
            <div className="grid lcat-group-head lcat-group-cols">
              <div style={{ fontWeight: 600 }}>{g.name}</div>
              <div className="right status-token">{g.fte || "—"} FTE</div>
              <div className={"right status-token" + (g.fte && g.assigned > g.fte ? " over-fte" : "")} title={g.fte && g.assigned > g.fte ? "Assigned resources exceed contracted FTE" : undefined}>
                {g.assigned} filled{g.fte && g.assigned > g.fte ? " · over" : ""}
              </div>
              <div className="right num muted">{rate(g.rate)}</div>
            </div>
            {!g.people.length && <div className="lcat-group-empty">No resources assigned to this category</div>}
            {g.people.map((p) => (
              <div key={p.id} className="grid lcat-group-row lcat-group-cols">
                <div className={nameClass(p)}>{p.name}</div>
                <div />
                <div className="right status-token" style={{ color: "var(--label)" }}>{p.status}</div>
                <div className="right num">{rate(p.rate)}</div>
              </div>
            ))}
          </div>
        ))}
        {!c.laborCategories.length && !c.staff.length && <div className="card-empty">No labor categories or personnel have been recorded for this period.</div>}
      </div>
    </>
  );
}
