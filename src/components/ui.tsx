import type { ReactNode } from "react";
import type { SortState } from "../hooks/useSort.ts";

export function Eyebrow({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={"eyebrow " + className}>{children}</div>;
}

export interface Column { key: string; label: string; align?: "right" }

/** Sortable table header cells. Every column sorts both directions; the active column is accent-colored. */
export function SortHeaders({ cols, cur, onSort }: { cols: Column[]; cur: SortState; onSort: (col: string) => void }) {
  return (
    <>
      {cols.map((c) => {
        const active = cur.col === c.key;
        return (
          <button key={c.key} type="button" className={"th" + (active ? " active" : "") + (c.align === "right" ? " right" : "")} onClick={() => onSort(c.key)}>
            {c.label}{active ? (cur.dir === "asc" ? " ↑" : " ↓") : ""}
          </button>
        );
      })}
    </>
  );
}

export function Button({ primary, onClick, children, disabled }: { primary?: boolean; onClick?: () => void; children: ReactNode; disabled?: boolean }) {
  return <button type="button" className={"btn" + (primary ? " primary" : "")} onClick={onClick} disabled={disabled}>{children}</button>;
}

/** A button that opens the OS file picker and hands the chosen files to onFiles. */
export function FileButton({ onFiles, children, primary, className }: { onFiles: (f: FileList) => void; children: ReactNode; primary?: boolean; className?: string }) {
  return (
    <label className={className || ("btn" + (primary ? " primary" : ""))}>
      {children}
      <input type="file" multiple onChange={(e) => { if (e.target.files && e.target.files.length) onFiles(e.target.files); e.target.value = ""; }} />
    </label>
  );
}

export function Field({ label, plain, children, style }: { label: string; plain?: boolean; children: ReactNode; style?: React.CSSProperties }) {
  return (
    <label className="field" style={style}>
      <span className={plain ? "plain" : undefined}>{label}</span>
      {children}
    </label>
  );
}

export function TextInput({ value, onChange, small, style }: { value: string; onChange: (v: string) => void; small?: boolean; style?: React.CSSProperties }) {
  return <input type="text" className={"input num" + (small ? " small" : "")} value={value} onChange={(e) => onChange(e.target.value)} style={style} />;
}

export function TextArea({ value, onChange, rows, small }: { value: string; onChange: (v: string) => void; rows: number; small?: boolean }) {
  return <textarea className={"textarea" + (small ? " small" : "")} rows={rows} value={value} onChange={(e) => onChange(e.target.value)} />;
}
