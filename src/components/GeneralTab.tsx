import { useEffect, useState } from "react";
import type { CallOrder } from "../../shared/types.ts";
import { api } from "../api.ts";
import { localDate, periodState } from "../lib/format.ts";
import { TextArea } from "./ui.tsx";
import type { Group } from "./CallOrdersRegister.tsx";
import type { Mutate } from "../App.tsx";

/** True when the period's end date is today or within the next 60 days. */
function endingSoon(p: CallOrder, today: string): boolean {
  const end = localDate(p.popEnd), now = localDate(today);
  if (!end || !now) return false;
  const daysToEnd = Math.round((end.getTime() - now.getTime()) / 86400000);
  return daysToEnd >= 0 && daysToEnd <= 60;
}

export function GeneralTab({ order: c, group, today, isPm, mutate }: {
  order: CallOrder; group: Group | undefined; today: string; isPm: boolean; mutate: Mutate;
}) {
  const periods = group?.periods.length ? group.periods : [c];
  const [draft, setDraft] = useState(c.description);
  useEffect(() => { setDraft(c.description); }, [c.id, c.description]);
  const saveDescription = () => { if (draft !== c.description) mutate(() => api.saveDescription(c.id, draft)); };

  return (
    <div className="fin-grid">
      <div className="card">
        <div className="card-head">Periods of performance</div>
        {periods.map((p) => {
          const isCurrent = periodState(p, today) === "current";
          const soon = isCurrent && endingSoon(p, today);
          return (
            <div key={p.id} className="fin-row">
              <div style={{ color: "var(--ink-3)" }}>{p.id} · {p.pop}</div>
              <div className="v">
                {isCurrent && <span style={soon ? { color: "var(--burn-high)", fontWeight: 600 } : undefined}>Current</span>}
              </div>
            </div>
          );
        })}
        <div className="footnote">"Current" is highlighted in red when the period ends within 60 days.</div>
      </div>

      <div className="card">
        <div className="card-head">Call order description</div>
        {isPm ? (
          <div style={{ padding: 18 }}>
            <TextArea rows={4} value={draft} onChange={setDraft} onBlur={saveDescription} />
          </div>
        ) : (
          <div style={{ padding: 18, fontSize: 13, color: "var(--ink-2)", lineHeight: 1.5 }}>
            {c.description || "No description has been entered for this call order."}
          </div>
        )}
      </div>
    </div>
  );
}
