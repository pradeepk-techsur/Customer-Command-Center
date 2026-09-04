import { useEffect, useState } from "react";
import type { CallOrder, PortalSnapshot } from "../../shared/types.ts";
import { api } from "../api.ts";
import { useSort } from "../hooks/useSort.ts";
import { burnColor, dateLabel, isStale, pctOf, rate, usd, usdFull } from "../lib/format.ts";
import { Button, Field, SortHeaders, TextInput } from "./ui.tsx";
import type { Mutate } from "../App.tsx";

const LCAT_COLS = [
  { key: "name", label: "BPA labor category" }, { key: "fte", label: "FTE", align: "right" as const },
  { key: "hours", label: "Hours", align: "right" as const }, { key: "rate", label: "Rate", align: "right" as const },
  { key: "ext", label: "Extended", align: "right" as const },
];

export function FinancialsTab({ order: c, snapshot, isPm, mutate }: { order: CallOrder; snapshot: PortalSnapshot; isPm: boolean; mutate: Mutate }) {
  const [draft, setDraft] = useState(String(c.spend));
  useEffect(() => { setDraft(String(c.spend)); }, [c.id, c.spend]);

  const remaining = c.funded - c.spend;
  const pct = pctOf(c.spend, c.funded);
  const ext = (l: { fte: number; hours: number; rate: number }) => l.fte * l.hours * l.rate;
  const lcatTotal = c.laborCategories.reduce((s, l) => s + ext(l), 0);
  const lcatFte = c.laborCategories.reduce((s, l) => s + l.fte, 0);
  const { sorted, cur, toggle } = useSort("lcat", "name", c.laborCategories, {
    name: (l) => l.name, fte: (l) => l.fte, hours: (l) => l.hours, rate: (l) => l.rate, ext,
  });
  const stale = isStale(c, "fin", snapshot.today, snapshot.config);

  const funding: { label: string; value: string; color?: string }[] = [
    { label: "Funds obligated", value: usdFull(c.funded) },
    { label: "Funds expended to date*", value: usdFull(c.spend) },
    { label: "Funds remaining", value: usdFull(remaining) },
    { label: "Estimate at completion", value: usdFull(c.eac) },
    { label: "Over / under", value: usdFull(c.over) },
    { label: "Percent expended", value: c.funded ? pct + "%" : "—", color: c.funded && c.spend ? burnColor(pct) : undefined },
  ];

  return (
    <div className="fin-grid">
      <div className="card">
        <div className="card-head">
          <div>Funding summary</div>
          <div className={"stamp" + (stale ? " stale" : "")}>Financials updated {dateLabel(c.finUpdatedOn)}</div>
        </div>
        {isPm && (
          <div className="fin-edit">
            <Field label="Update funds expended to date" style={{ flex: 1 }}>
              <TextInput value={draft} onChange={setDraft} />
            </Field>
            <Button primary onClick={() => mutate(() => api.saveSpend(c.id, draft))}>Save</Button>
          </div>
        )}
        {funding.map((r) => (
          <div key={r.label} className="fin-row">
            <div style={{ color: "var(--ink-3)" }}>{r.label}</div>
            <div className="v num" style={r.color ? { color: r.color, fontWeight: 600 } : undefined}>{r.value}</div>
          </div>
        ))}
        <div className="footnote">* Expenditures lag one invoice cycle</div>
      </div>

      <div className="card">
        <div className="card-head">Contracted labor categories</div>
        <div className="grid thead tight lcat-cols"><SortHeaders cols={LCAT_COLS} cur={cur} onSort={toggle} /></div>
        {sorted.map((l) => (
          <div key={l.id} className="grid trow tight lcat-cols num">
            <div>{l.name}</div>
            <div className="right">{l.fte}</div>
            <div className="right muted">{l.hours.toLocaleString()}</div>
            <div className="right muted">{rate(l.rate)}</div>
            <div className="right">{usd(ext(l))}</div>
          </div>
        ))}
        {!c.laborCategories.length && <div className="card-empty">No labor categories have been contracted for this period.</div>}
        <div className="grid tfoot lcat-cols num">
          <div>Total contracted value</div>
          <div className="right">{lcatFte || "—"}</div>
          <div /><div />
          <div className="right">{lcatTotal ? usd(lcatTotal) : "—"}</div>
        </div>
      </div>
    </div>
  );
}
