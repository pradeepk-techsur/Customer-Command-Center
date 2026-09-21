import { useEffect, useState } from "react";

interface ApprovedUser {
  id: number;
  email: string;
  name: string;
  role: "customer" | "pm" | "program_manager";
  status: "active" | "revoked";
  createdAt: string;
  updatedAt: string;
}

const emptyForm = { email: "", name: "", role: "customer" as ApprovedUser["role"] };

/** Manages the magic-link sign-in allowlist. Paul, Aidan, and Jessica can all use this (spec decision #4). */
export function ApprovedUsersPanel() {
  const [approvedUsers, setApprovedUsers] = useState<ApprovedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);

  const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem("accessToken")}` });

  const load = async () => {
    try {
      const res = await fetch("/api/approved-users", { headers: authHeaders() });
      if (!res.ok) throw new Error("Failed to load approved users");
      const data = await res.json();
      setApprovedUsers(data.approvedUsers);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email.trim() || !form.name.trim()) return;
    try {
      const res = await fetch("/api/approved-users", {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add approved user");
      setForm(emptyForm);
      setShowForm(false);
      await load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const toggleStatus = async (u: ApprovedUser) => {
    const status = u.status === "active" ? "revoked" : "active";
    try {
      const res = await fetch(`/api/approved-users/${u.id}`, {
        method: "PATCH",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Failed to update approved user");
      await load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const remove = async (u: ApprovedUser) => {
    if (!confirm(`Remove ${u.email} from the approved sign-in list?`)) return;
    try {
      const res = await fetch(`/api/approved-users/${u.id}`, { method: "DELETE", headers: authHeaders() });
      if (!res.ok) throw new Error("Failed to remove approved user");
      await load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (loading) return <div className="loading">Loading approved users…</div>;

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <div style={{ fontWeight: 600 }}>Approved Sign-in List</div>
          <div className="page-sub">Email addresses allowed to request a magic sign-in link</div>
        </div>
        <button
          type="button"
          onClick={() => setShowForm((s) => !s)}
          style={{ padding: "8px 16px", background: "var(--accent)", color: "white", border: "none", borderRadius: 3, fontSize: 13, fontWeight: 500, cursor: "pointer" }}
        >
          {showForm ? "Cancel" : "+ Add approved user"}
        </button>
      </div>

      {error && (
        <div style={{ padding: "10px 14px", marginBottom: 16, background: "#fee", border: "1px solid #fcc", borderRadius: 4, color: "#c33", fontSize: 13 }}>
          {error}
        </div>
      )}

      {showForm && (
        <form onSubmit={handleAdd} style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          <input className="input" placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={{ flex: "1 1 160px" }} />
          <input className="input" type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} style={{ flex: "1 1 200px" }} />
          <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as ApprovedUser["role"] })} style={{ flex: "0 0 160px" }}>
            <option value="customer">Customer (COR)</option>
            <option value="pm">PM Support</option>
            <option value="program_manager">Program Manager</option>
          </select>
          <button type="submit" style={{ padding: "8px 16px", background: "var(--accent)", color: "white", border: "none", borderRadius: 3, fontSize: 13, cursor: "pointer" }}>
            Add
          </button>
        </form>
      )}

      <table className="table">
        <thead>
          <tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th></th></tr>
        </thead>
        <tbody>
          {approvedUsers.map((u) => (
            <tr key={u.id}>
              <td>{u.name}</td>
              <td>{u.email}</td>
              <td>{u.role}</td>
              <td>{u.status}</td>
              <td style={{ textAlign: "right", display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button type="button" onClick={() => toggleStatus(u)} style={{ fontSize: 12, cursor: "pointer" }}>
                  {u.status === "active" ? "Revoke" : "Reactivate"}
                </button>
                <button type="button" onClick={() => remove(u)} style={{ fontSize: 12, cursor: "pointer", color: "#c33" }}>
                  Remove
                </button>
              </td>
            </tr>
          ))}
          {approvedUsers.length === 0 && (
            <tr><td colSpan={5} style={{ textAlign: "center", color: "var(--muted)" }}>No approved users yet.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
