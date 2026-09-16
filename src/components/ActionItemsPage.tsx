import type { PortalSnapshot } from "../../shared/types.ts";
import { ActionItemsPanel } from "./ActionItemsPanel.tsx";
import type { Mutate } from "../App.tsx";

/** Top-level "Action Items" page: open action items across every call order. */
export function ActionItemsPage({ snapshot, isPm, mutate }: { snapshot: PortalSnapshot; isPm: boolean; mutate: Mutate }) {
  const callOrders = snapshot.callOrders.filter((c) => !c.pending);

  return (
    <div className="page">
      <h1>Action Items</h1>
      <div className="page-sub">Open action items across all call orders.</div>
      {callOrders.map((c) => (
        <div key={c.id} className="card" style={{ marginTop: 16 }}>
          <div className="card-head">{c.name}</div>
          <div style={{ padding: 18 }}>
            <ActionItemsPanel callOrderId={c.id} actionItems={c.actionItems} today={snapshot.today} isPm={isPm} mutate={mutate} />
          </div>
        </div>
      ))}
      {!callOrders.length && <div className="card-empty">No call orders yet.</div>}
    </div>
  );
}
