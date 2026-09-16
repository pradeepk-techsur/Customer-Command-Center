import { useState } from "react";
import { api } from "../api.ts";
import { dateLabel } from "../lib/format.ts";
import { Button, TextInput } from "./ui.tsx";

interface ArchivedActionItem {
  id: number;
  name: string;
  description: string | null;
  call_order_name: string | null;
  date_assigned: string;
  closed_at: string;
}

export function ActionItemsArchive({ onBack }: { onBack: () => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<ArchivedActionItem[]>([]);
  const [loading, setLoading] = useState(false);

  const search = () => {
    setLoading(true);
    api.searchClosedActionItems(q).then(setResults).finally(() => setLoading(false));
  };

  return (
    <div className="page">
      <button type="button" className="back-link" onClick={onBack}><span className="mono">←</span><span>Back</span></button>
      <h1>Closed action items archive</h1>
      <div className="page-sub">Search action items closed more than a week ago.</div>
      <div className="add-row" style={{ marginTop: 16 }}>
        <TextInput value={q} onChange={setQ} style={{ flex: 1 }} />
        <Button primary onClick={search}>{loading ? "Searching…" : "Search"}</Button>
      </div>
      <div className="card" style={{ marginTop: 16 }}>
        <div className="grid thead tight" style={{ gridTemplateColumns: "1.5fr 2fr 1fr 1fr 1fr" }}>
          <div className="th">Name</div><div className="th">Description</div><div className="th">Call order</div>
          <div className="th">Assigned</div><div className="th">Closed</div>
        </div>
        {results.map((a) => (
          <div key={a.id} className="grid trow tight" style={{ gridTemplateColumns: "1.5fr 2fr 1fr 1fr 1fr" }}>
            <div>{a.name}</div><div>{a.description || "—"}</div><div>{a.call_order_name || "BPA"}</div>
            <div>{dateLabel(a.date_assigned)}</div><div>{dateLabel(a.closed_at)}</div>
          </div>
        ))}
        {!results.length && <div className="card-empty">No matching action items.</div>}
      </div>
    </div>
  );
}
