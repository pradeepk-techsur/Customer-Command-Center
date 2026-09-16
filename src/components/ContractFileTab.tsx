import { useState } from "react";
import type { ContractDocument } from "../../shared/types.ts";
import { api } from "../api.ts";
import { useSort } from "../hooks/useSort.ts";
import { dateLabel, usdFull } from "../lib/format.ts";
import { Button, FileButton, SortHeaders } from "./ui.tsx";
import type { Mutate } from "../App.tsx";

const COLS = [
  { key: "name", label: "Name" }, { key: "effectiveDate", label: "Effective date" },
  { key: "isAdminMod", label: "Admin mod" }, { key: "isFundingMod", label: "Funding mod" },
  { key: "fundingChangeAmount", label: "Funding change", align: "right" as const },
];
const GRID_COLS = "2fr 1fr 0.8fr 0.8fr 1fr 0.8fr";

/** Base period funding expires before the next option period's — order groups Base, Option 1, Option 2, … */
function periodRank(label: string): number {
  if (/^base/i.test(label)) return 0;
  const m = label.match(/option\s*(\d+)/i);
  return m ? Number(m[1]) : Infinity;
}

export function ContractFileTab({ callOrderId, documents, isPm, mutate }: {
  callOrderId: string | null; documents: ContractDocument[]; isPm: boolean; mutate: Mutate;
}) {
  const [uploading, setUploading] = useState(false);
  const { sorted, cur, toggle } = useSort("contractfile", "effectiveDate", documents, {
    name: (d) => d.name,
    effectiveDate: (d) => d.effectiveDate ?? "",
    isAdminMod: (d) => (d.isAdminMod ? 1 : 0),
    isFundingMod: (d) => (d.isFundingMod ? 1 : 0),
    fundingChangeAmount: (d) => d.fundingChangeAmount ?? 0,
  });

  // Group by period of performance, ordered Base → Option 1 → Option 2 … funding does not carry forward between periods.
  const groups = new Map<string, ContractDocument[]>();
  for (const d of sorted) {
    const key = d.popPeriodLabel || "Unspecified period";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(d);
  }
  const orderedGroups = [...groups.entries()].sort((a, b) => periodRank(a[0]) - periodRank(b[0]));

  // Name, effective date, mod type, and funding change are read directly from the uploaded document — no manual entry.
  const uploadDocument = (files: FileList) => {
    const fd = new FormData();
    fd.append("file", files[0]);
    setUploading(true);
    mutate(() => api.addContractDocument(callOrderId, fd)).finally(() => setUploading(false));
  };
  const remove = (d: ContractDocument) => mutate(() => api.removeContractDocument(callOrderId, d.id));

  return (
    <div className="card">
      <div className="card-head wide">
        <div>Contract file</div>
        {isPm && (
          <FileButton primary onFiles={uploadDocument}>
            {uploading ? "Uploading…" : "Upload document"}
          </FileButton>
        )}
      </div>
      {orderedGroups.map(([period, docs]) => (
        <div key={period} style={{ marginTop: 12 }}>
          <div style={{ fontWeight: 600, padding: "6px 20px", color: "var(--ink-2)" }}>{period}</div>
          <div className="grid thead tight" style={{ gridTemplateColumns: GRID_COLS }}>
            <SortHeaders cols={COLS} cur={cur} onSort={toggle} />
            <div className="th right">Actions</div>
          </div>
          {docs.map((d) => (
            <div key={d.id} className="grid trow tight" style={{ gridTemplateColumns: GRID_COLS }}>
              <div>{d.fileHref ? <a href={d.fileHref} target="_blank" rel="noreferrer">{d.name}</a> : d.name}</div>
              <div>{dateLabel(d.effectiveDate)}</div>
              <div>{d.isAdminMod ? "Y" : "N"}</div>
              <div>{d.isFundingMod ? "Y" : "N"}</div>
              <div className="num">{d.isFundingMod ? usdFull(d.fundingChangeAmount) : "—"}</div>
              <div className="right">{isPm && <Button onClick={() => remove(d)}>Delete</Button>}</div>
            </div>
          ))}
        </div>
      ))}
      {!documents.length && <div className="card-empty">No contract documents have been uploaded.</div>}
    </div>
  );
}
