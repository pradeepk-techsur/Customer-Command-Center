import type { PortalSnapshot } from "../../shared/types.ts";
import { ContractFileTab } from "./ContractFileTab.tsx";
import type { Mutate } from "../App.tsx";

/** Top-level "Contract File" page: BPA-level contract documents (callOrderId null), same UI as a call order's Contract File tab. */
export function ContractFilePage({ snapshot, isPm, mutate }: { snapshot: PortalSnapshot; isPm: boolean; mutate: Mutate }) {
  return (
    <div className="page">
      <h1>Contract File</h1>
      <div className="page-sub">Contract-level (BPA) documents and modifications.</div>
      <div style={{ marginTop: 16 }}>
        <ContractFileTab callOrderId={null} documents={snapshot.contract.contractDocuments} isPm={isPm} mutate={mutate} />
      </div>
    </div>
  );
}
