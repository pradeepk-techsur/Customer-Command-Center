import { useState, useEffect, type ReactNode } from "react";
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

export function TextInput({ value, onChange, small, style, disabled }: { value: string; onChange: (v: string) => void; small?: boolean; style?: React.CSSProperties; disabled?: boolean }) {
  return <input type="text" className={"input num" + (small ? " small" : "")} value={value} onChange={(e) => onChange(e.target.value)} style={style} disabled={disabled} />;
}

export function TextArea({ value, onChange, rows, small }: { value: string; onChange: (v: string) => void; rows: number; small?: boolean }) {
  return <textarea className={"textarea" + (small ? " small" : "")} rows={rows} value={value} onChange={(e) => onChange(e.target.value)} />;
}

// Toast notification system
let toastId = 0;
const toastListeners = new Set<(toasts: ToastMessage[]) => void>();
let activeToasts: ToastMessage[] = [];

interface ToastMessage {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

export function showToast(message: string, type: 'success' | 'error' | 'info' = 'success') {
  const toast: ToastMessage = { id: ++toastId, message, type };
  activeToasts = [...activeToasts, toast];
  toastListeners.forEach(fn => fn(activeToasts));
  
  setTimeout(() => {
    activeToasts = activeToasts.filter(t => t.id !== toast.id);
    toastListeners.forEach(fn => fn(activeToasts));
  }, 4000);
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  
  useEffect(() => {
    toastListeners.add(setToasts);
    return () => { toastListeners.delete(setToasts); };
  }, []);
  
  if (toasts.length === 0) return null;
  
  return (
    <div style={{
      position: 'fixed',
      top: '20px',
      right: '20px',
      zIndex: 10000,
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      maxWidth: '400px',
    }}>
      {toasts.map(toast => (
        <div
          key={toast.id}
          style={{
            background: toast.type === 'error' ? 'var(--burn-high)' : toast.type === 'success' ? 'var(--accent)' : 'var(--ink-2)',
            color: 'white',
            padding: '12px 16px',
            borderRadius: '3px',
            fontSize: '13px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            animation: 'slideIn 0.2s ease-out',
          }}
        >
          {toast.message}
        </div>
      ))}
    </div>
  );
}

// Confirmation dialog system
let confirmListeners = new Set<(state: ConfirmState | null) => void>();
let currentConfirm: ConfirmState | null = null;

interface ConfirmState {
  message: string;
  details?: string;
  onConfirm: () => void;
  onCancel?: () => void;
}

export function showConfirm(message: string, details?: string): Promise<boolean> {
  return new Promise((resolve) => {
    currentConfirm = {
      message,
      details,
      onConfirm: () => {
        currentConfirm = null;
        confirmListeners.forEach(fn => fn(null));
        resolve(true);
      },
      onCancel: () => {
        currentConfirm = null;
        confirmListeners.forEach(fn => fn(null));
        resolve(false);
      },
    };
    confirmListeners.forEach(fn => fn(currentConfirm));
  });
}

export function ConfirmDialog() {
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  
  useEffect(() => {
    confirmListeners.add(setConfirm);
    return () => { confirmListeners.delete(setConfirm); };
  }, []);
  
  if (!confirm) return null;
  
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10001,
    }} onClick={confirm.onCancel}>
      <div
        className="card"
        style={{ maxWidth: '480px', width: '90%' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="card-head">{confirm.message}</div>
        {confirm.details && (
          <div style={{ padding: '16px 18px', fontSize: '13px', color: 'var(--ink-2)', whiteSpace: 'pre-wrap' }}>
            {confirm.details}
          </div>
        )}
        <div style={{ padding: '14px 18px', borderTop: '1px solid var(--line)', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <Button onClick={confirm.onCancel}>Cancel</Button>
          <Button primary onClick={confirm.onConfirm}>Confirm</Button>
        </div>
      </div>
    </div>
  );
}
