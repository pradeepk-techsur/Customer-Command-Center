import { createContext, useContext } from "react";

export type Dir = "asc" | "desc";
export interface SortState { col: string; dir: Dir }
export type SortStore = { get: (key: string, def: string) => SortState; toggle: (key: string, def: string, col: string) => void };

// Sort state is keyed by table and kept at the app level so it survives navigating between views.
export const SortContext = createContext<SortStore>({ get: (_k, def) => ({ col: def, dir: "asc" }), toggle: () => {} });

export type Getters<T> = Record<string, (row: T) => string | number | null | undefined>;

export function useSort<T>(key: string, def: string, rows: T[], getters: Getters<T>) {
  const store = useContext(SortContext);
  const cur = store.get(key, def);
  const g = getters[cur.col];
  let sorted = rows;
  if (g) {
    sorted = rows.slice().sort((a, b) => {
      const x = g(a), y = g(b);
      if (typeof x === "number" && typeof y === "number") return x - y;
      return String(x ?? "").localeCompare(String(y ?? ""), undefined, { numeric: true });
    });
    if (cur.dir === "desc") sorted.reverse();
  }
  return { sorted, cur, toggle: (col: string) => store.toggle(key, def, col) };
}
