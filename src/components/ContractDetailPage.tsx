import type { PortalSnapshot } from "../../shared/types.ts";
import { filled, usdFull } from "../lib/format.ts";
import { Eyebrow } from "./ui.tsx";

export function ContractDetailPage({ snapshot, onSelectCallOrder }: {
  snapshot: PortalSnapshot; onSelectCallOrder: (id: string) => void;
}) {
  const { contract } = snapshot;
  const callOrders = snapshot.callOrders.filter((c) => !c.pending);

  return (
    <div className="page detail">
      <div className="detail-head">
        <div>
          <div className="detail-id">BPA award · dashboard</div>
          <h1 style={{ marginBottom: 8 }}>{contract.name}</h1>
          <div className="page-sub">{contract.agency} · {contract.vehicle} · {contract.number}</div>
        </div>
        <div className="stat-box">
          <div><Eyebrow>Obligated</Eyebrow><div className="value num" style={{ marginTop: 5 }}>{usdFull(contract.funded)}</div></div>
          <div><Eyebrow>Expended</Eyebrow><div className="value num" style={{ marginTop: 5 }}>{usdFull(contract.spend)}</div></div>
          <div><Eyebrow>People</Eyebrow><div className="value num" style={{ marginTop: 5 }}>{contract.peopleAssigned}</div></div>
        </div>
      </div>

      <div className="fin-grid">
        <div className="card" style={{ gridColumn: "1 / -1" }}>
          <div className="card-head wide">
            <div>Call orders</div>
          </div>
          {callOrders.map((c) => (
            <button key={c.id} type="button" className="fin-row" style={{ width: "100%", textAlign: "left", cursor: "pointer", background: "none", border: 0, borderBottom: "1px solid var(--line-soft)" }} onClick={() => onSelectCallOrder(c.id)}>
              <div style={{ color: "var(--ink-2)" }}>{c.name}<div style={{ color: "var(--ink-3)", fontSize: 11 }}>{filled(c)} people · {usdFull(c.funded)} funded</div></div>
              <div className="v num">{usdFull(c.spend)}</div>
            </button>
          ))}
          {!callOrders.length && <div className="card-empty">No call orders yet.</div>}
        </div>
      </div>
    </div>
  );
}
