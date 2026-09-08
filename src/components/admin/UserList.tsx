import { useState } from "react";

interface User {
  id: number;
  email: string;
  name: string;
  role: "customer" | "pm" | "admin" | "program_manager";
  auth_provider: "email" | "microsoft";
  status: "active" | "inactive" | "suspended";
  last_login_at: string | null;
  created_at: string;
}

interface UserListProps {
  users: User[];
  onEdit: (user: User) => void;
  onDelete: (user: User) => void;
  onResetPassword: (user: User) => void;
}

export function UserList({ users, onEdit, onDelete, onResetPassword }: UserListProps) {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filteredUsers = users.filter((user) => {
    const matchesSearch = search === "" || 
      user.name.toLowerCase().includes(search.toLowerCase()) ||
      user.email.toLowerCase().includes(search.toLowerCase());
    
    const matchesRole = roleFilter === "all" || user.role === roleFilter;
    const matchesStatus = statusFilter === "all" || user.status === statusFilter;

    return matchesSearch && matchesRole && matchesStatus;
  });

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "Never";
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      customer: "Customer",
      pm: "Project Manager",
      admin: "Administrator",
    };
    return labels[role] || role;
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      active: "#22c55e",
      inactive: "#94a3b8",
      suspended: "#ef4444",
    };
    return colors[status] || "#94a3b8";
  };

  return (
    <div>
      <div style={{ 
        padding: "16px 20px", 
        borderBottom: "1px solid var(--line)",
        display: "flex",
        gap: "12px",
        alignItems: "center",
        background: "var(--surface-2)"
      }}>
        <input
          type="text"
          placeholder="Search users..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            flex: 1,
            padding: "8px 12px",
            border: "1px solid var(--line-input)",
            borderRadius: "3px",
            fontSize: "13px",
          }}
        />
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          style={{
            padding: "8px 12px",
            border: "1px solid var(--line-input)",
            borderRadius: "3px",
            fontSize: "13px",
            background: "white",
          }}
        >
          <option value="all">All Roles</option>
          <option value="customer">Customer</option>
          <option value="pm">Project Manager</option>
          <option value="admin">Administrator</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{
            padding: "8px 12px",
            border: "1px solid var(--line-input)",
            borderRadius: "3px",
            fontSize: "13px",
            background: "white",
          }}
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="suspended">Suspended</option>
        </select>
      </div>

      {filteredUsers.length === 0 ? (
        <div className="card-empty">No users found</div>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "var(--surface-2)", borderBottom: "1px solid var(--line)" }}>
              <th style={{ padding: "12px 20px", textAlign: "left", fontSize: "11px", fontFamily: "var(--mono)", textTransform: "uppercase", color: "var(--label)", fontWeight: 400 }}>Name</th>
              <th style={{ padding: "12px 20px", textAlign: "left", fontSize: "11px", fontFamily: "var(--mono)", textTransform: "uppercase", color: "var(--label)", fontWeight: 400 }}>Email</th>
              <th style={{ padding: "12px 20px", textAlign: "left", fontSize: "11px", fontFamily: "var(--mono)", textTransform: "uppercase", color: "var(--label)", fontWeight: 400 }}>Role</th>
              <th style={{ padding: "12px 20px", textAlign: "left", fontSize: "11px", fontFamily: "var(--mono)", textTransform: "uppercase", color: "var(--label)", fontWeight: 400 }}>Auth</th>
              <th style={{ padding: "12px 20px", textAlign: "left", fontSize: "11px", fontFamily: "var(--mono)", textTransform: "uppercase", color: "var(--label)", fontWeight: 400 }}>Status</th>
              <th style={{ padding: "12px 20px", textAlign: "left", fontSize: "11px", fontFamily: "var(--mono)", textTransform: "uppercase", color: "var(--label)", fontWeight: 400 }}>Last Login</th>
              <th style={{ padding: "12px 20px", textAlign: "right", fontSize: "11px", fontFamily: "var(--mono)", textTransform: "uppercase", color: "var(--label)", fontWeight: 400 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map((user) => (
              <tr key={user.id} style={{ borderBottom: "1px solid var(--line-faint)" }}>
                <td style={{ padding: "14px 20px", fontSize: "13px", fontWeight: 500 }}>{user.name}</td>
                <td style={{ padding: "14px 20px", fontSize: "13px", color: "var(--muted)" }}>{user.email}</td>
                <td style={{ padding: "14px 20px", fontSize: "12px" }}>
                  <span className="eyebrow">{getRoleLabel(user.role)}</span>
                </td>
                <td style={{ padding: "14px 20px", fontSize: "12px", color: "var(--muted)" }}>
                  {user.auth_provider === "email" ? "Email" : "Microsoft"}
                </td>
                <td style={{ padding: "14px 20px" }}>
                  <span style={{
                    display: "inline-block",
                    padding: "3px 8px",
                    borderRadius: "3px",
                    fontSize: "11px",
                    fontWeight: 500,
                    background: `${getStatusColor(user.status)}20`,
                    color: getStatusColor(user.status),
                  }}>
                    {user.status}
                  </span>
                </td>
                <td style={{ padding: "14px 20px", fontSize: "13px", color: "var(--muted)" }}>
                  {formatDate(user.last_login_at)}
                </td>
                <td style={{ padding: "14px 20px", textAlign: "right" }}>
                  <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                    <button
                      onClick={() => onEdit(user)}
                      style={{
                        padding: "5px 10px",
                        fontSize: "12px",
                        border: "1px solid var(--line-input)",
                        borderRadius: "3px",
                        background: "white",
                        cursor: "pointer",
                        color: "var(--ink-2)",
                      }}
                    >
                      Edit
                    </button>
                    {user.auth_provider === "email" && (
                      <button
                        onClick={() => onResetPassword(user)}
                        style={{
                          padding: "5px 10px",
                          fontSize: "12px",
                          border: "1px solid var(--line-input)",
                          borderRadius: "3px",
                          background: "white",
                          cursor: "pointer",
                          color: "var(--ink-2)",
                        }}
                      >
                        Reset Password
                      </button>
                    )}
                    <button
                      onClick={() => onDelete(user)}
                      style={{
                        padding: "5px 10px",
                        fontSize: "12px",
                        border: "1px solid #fee",
                        borderRadius: "3px",
                        background: "#fee",
                        cursor: "pointer",
                        color: "#c33",
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div style={{ 
        padding: "16px 20px", 
        borderTop: "1px solid var(--line)", 
        fontSize: "13px", 
        color: "var(--muted)",
        background: "var(--surface-2)"
      }}>
        {filteredUsers.length} {filteredUsers.length === 1 ? "user" : "users"} {search || roleFilter !== "all" || statusFilter !== "all" ? `(filtered from ${users.length} total)` : ""}
      </div>
    </div>
  );
}
