import { useCallback, useEffect, useMemo, useState } from "react";
import type { PortalSnapshot, Role } from "../shared/types.ts";
import { api, setActor } from "./api.ts";
import { SortContext, type SortState } from "./hooks/useSort.ts";
import { Masthead, type Page } from "./components/Masthead.tsx";
import { CallOrdersRegister } from "./components/CallOrdersRegister.tsx";
import { CallOrderDetail, type Tab } from "./components/CallOrderDetail.tsx";
import { MonthlyReports } from "./components/MonthlyReports.tsx";

/** Runs a mutation against the API and replaces the snapshot with the server's response. */
export type Mutate = (fn: () => Promise<PortalSnapshot>) => Promise<PortalSnapshot | undefined>;

export default function App() {
  const [snapshot, setSnapshot] = useState<PortalSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<Role>("customer");
  const [page, setPage] = useState<Page>("orders");
  const [selected, setSelected] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("Financials");
  const [sorts, setSorts] = useState<Record<string, SortState>>({});

  useEffect(() => { setActor(role); }, [role]);
  useEffect(() => {
    api.snapshot().then(setSnapshot).catch((e: Error) => setError(e.message));
  }, []);

  const mutate: Mutate = useCallback(async (fn) => {
    try {
      const next = await fn();
      setSnapshot(next);
      setError(null);
      return next;
    } catch (e) {
      setError((e as Error).message);
      return undefined;
    }
  }, []);

  const sortStore = useMemo(() => ({
    get: (key: string, def: string) => sorts[key] || { col: def, dir: "asc" as const },
    toggle: (key: string, def: string, col: string) => setSorts((s) => {
      const cur = s[key] || { col: def, dir: "asc" as const };
      const active = cur.col === col;
      return { ...s, [key]: { col, dir: active && cur.dir === "asc" ? "desc" : "asc" } };
    }),
  }), [sorts]);

  const isPm = role === "pm";
  const order = snapshot && selected ? snapshot.callOrders.find((c) => c.id === selected) : undefined;

  return (
    <SortContext.Provider value={sortStore}>
      <Masthead page={page} role={role} contract={snapshot?.contract || { agency: "AOUSC", vehicle: "BPA for TSO Support Services", number: "47QTCA20D00C6" }}
        onPage={setPage} onRole={setRole} />
      {error && (
        <div className="notice"><div><span>{error}</span><button type="button" onClick={() => setError(null)}>Dismiss</button></div></div>
      )}
      {!snapshot ? (
        <div className="loading">{error ? "The portal data could not be loaded." : "Loading portal data…"}</div>
      ) : page === "msr" ? (
        <MonthlyReports snapshot={snapshot} isPm={isPm} mutate={mutate} />
      ) : order ? (
        <CallOrderDetail snapshot={snapshot} order={order} tab={tab} isPm={isPm} mutate={mutate}
          onBack={() => setSelected(null)} onTab={setTab} onSelectPeriod={setSelected} />
      ) : (
        <CallOrdersRegister snapshot={snapshot} isPm={isPm}
          onOpen={(id, t) => { setSelected(id); setTab(t); }}
          onUpload={(files) => { void mutate(() => api.uploadCallOrders(files)); }} />
      )}
    </SortContext.Provider>
  );
}
