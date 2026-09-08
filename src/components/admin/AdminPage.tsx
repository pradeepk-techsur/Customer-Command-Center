import { useState, useEffect } from "react";
import { UserList } from "./UserList.tsx";
import { UserForm } from "./UserForm.tsx";
import type { Role } from "../../../shared/types.ts";

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

export function AdminPage({ role }: { role: Role }) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | undefined>();
  const [resetPasswordUser, setResetPasswordUser] = useState<User | undefined>();
  const [newPassword, setNewPassword] = useState("");
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(null);
  const [tempPasswordEmail, setTempPasswordEmail] = useState("");
  
  const isProgramManager = role === "program_manager";

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const res = await fetch("/api/admin/users", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
        },
      });

      if (!res.ok) {
        throw new Error("Failed to load users");
      }

      const data = await res.json();
      setUsers(data.users);
      setLoading(false);
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  const handleAddUser = () => {
    setEditingUser(undefined);
    setShowForm(true);
  };

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setShowForm(true);
  };

  const handleSaveUser = async (
    userData: Partial<User> & { password?: string },
    callOrderIds?: string[]
  ) => {
    try {
      const url = editingUser
        ? `/api/admin/users/${editingUser.id}`
        : "/api/admin/users";
      
      const method = editingUser ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(userData),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to save user");
      }

      const savedData = await res.json();
      const userId = editingUser?.id || savedData.user.id;

      // Show temporary password if provided (only for customers with email auth)
      if (savedData.temporaryPassword) {
        setTemporaryPassword(savedData.temporaryPassword);
        setTempPasswordEmail(savedData.user.email);
      }

      // Update call order assignments for PMs only (customers have automatic full access)
      if (userData.role === "pm" && callOrderIds !== undefined && userId) {
        await updateCallOrderAssignments(userId, callOrderIds);
      }

      setShowForm(false);
      setEditingUser(undefined);
      await loadUsers();
    } catch (err: any) {
      throw err;
    }
  };

  const updateCallOrderAssignments = async (userId: number, newCallOrderIds: string[]) => {
    try {
      const token = localStorage.getItem("accessToken");
      
      // Get current assignments
      const currentRes = await fetch(`/api/admin/users/${userId}/call-orders`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (!currentRes.ok) {
        throw new Error("Failed to load current assignments");
      }
      
      const currentData = await currentRes.json();
      const currentIds = currentData.hasFullAccess ? [] : 
        currentData.assignments.map((a: any) => a.call_order_id);
      
      // Determine which assignments to add and remove
      const toAdd = newCallOrderIds.filter(id => !currentIds.includes(id));
      const toRemove = currentIds.filter((id: string) => !newCallOrderIds.includes(id));
      
      // Add new assignments
      for (const callOrderId of toAdd) {
        await fetch(`/api/admin/users/${userId}/call-orders`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ callOrderId }),
        });
      }
      
      // Remove old assignments
      for (const callOrderId of toRemove) {
        await fetch(`/api/admin/users/${userId}/call-orders/${callOrderId}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });
      }
    } catch (err) {
      console.error("Failed to update call order assignments:", err);
      // Don't throw - user was saved successfully, just assignments failed
    }
  };

  const handleDeleteUser = async (user: User) => {
    if (!confirm(`Are you sure you want to delete ${user.name}? This action cannot be undone.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
        },
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to delete user");
      }

      await loadUsers();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleResetPassword = (user: User) => {
    setResetPasswordUser(user);
    setNewPassword("");
  };

  const handleConfirmResetPassword = async () => {
    if (!resetPasswordUser || !newPassword) return;

    try {
      const res = await fetch(`/api/admin/users/${resetPasswordUser.id}/reset-password`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password: newPassword }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to reset password");
      }

      alert("Password reset successfully. User must log in again.");
      setResetPasswordUser(undefined);
      setNewPassword("");
    } catch (err: any) {
      alert(err.message);
    }
  };

  if (loading) {
    return <div className="loading">Loading users...</div>;
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>{isProgramManager ? "User Management" : "User Administration"}</h1>
          <div className="page-sub">{isProgramManager ? "Manage customer and project manager accounts" : "Manage portal users and permissions"}</div>
        </div>
        <button
          onClick={handleAddUser}
          style={{
            padding: "10px 20px",
            background: "var(--accent)",
            color: "white",
            border: "none",
            borderRadius: "3px",
            fontSize: "13px",
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          + {isProgramManager ? "Add User" : "Add User"}
        </button>
      </div>

      {error && (
        <div style={{
          padding: "12px 16px",
          marginBottom: "20px",
          background: "#fee",
          border: "1px solid #fcc",
          borderRadius: "4px",
          color: "#c33",
          fontSize: "13px",
        }}>
          {error}
        </div>
      )}

      <div className="card">
        <UserList
          users={users}
          onEdit={handleEditUser}
          onDelete={handleDeleteUser}
          onResetPassword={handleResetPassword}
        />
      </div>

      {showForm && (
        <UserForm
          user={editingUser}
          onSave={handleSaveUser}
          onCancel={() => {
            setShowForm(false);
            setEditingUser(undefined);
          }}
          isProgramManager={isProgramManager}
        />
      )}

      {resetPasswordUser && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(0,0,0,0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000,
        }}>
          <div style={{
            background: "white",
            borderRadius: "8px",
            width: "100%",
            maxWidth: "400px",
            boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
          }}>
            <div style={{
              padding: "20px 24px",
              borderBottom: "1px solid var(--line)",
            }}>
              <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 600 }}>
                Reset Password for {resetPasswordUser.name}
              </h2>
            </div>
            <div style={{ padding: "24px" }}>
              <label style={{ display: "block", marginBottom: "8px", fontSize: "13px", fontWeight: 500 }}>
                New Password
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                style={{
                  width: "100%",
                  padding: "10px",
                  border: "1px solid var(--line-input)",
                  borderRadius: "3px",
                  fontSize: "13px",
                  boxSizing: "border-box",
                }}
              />
              <div style={{ fontSize: "12px", color: "var(--muted)", marginTop: "8px" }}>
                Must be 8+ characters with uppercase, lowercase, number, and special character
              </div>
            </div>
            <div style={{
              padding: "16px 24px",
              borderTop: "1px solid var(--line)",
              display: "flex",
              gap: "12px",
              justifyContent: "flex-end",
            }}>
              <button
                onClick={() => {
                  setResetPasswordUser(undefined);
                  setNewPassword("");
                }}
                style={{
                  padding: "10px 20px",
                  border: "1px solid var(--line-input)",
                  borderRadius: "3px",
                  background: "white",
                  fontSize: "13px",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmResetPassword}
                disabled={!newPassword || newPassword.length < 8}
                style={{
                  padding: "10px 20px",
                  border: "none",
                  borderRadius: "3px",
                  background: "var(--accent)",
                  color: "white",
                  fontSize: "13px",
                  fontWeight: 500,
                  cursor: !newPassword || newPassword.length < 8 ? "not-allowed" : "pointer",
                  opacity: !newPassword || newPassword.length < 8 ? 0.5 : 1,
                }}
              >
                Reset Password
              </button>
            </div>
          </div>
        </div>
      )}

      {temporaryPassword && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(0,0,0,0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000,
        }}>
          <div style={{
            background: "white",
            borderRadius: "8px",
            width: "100%",
            maxWidth: "500px",
            boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
          }}>
            <div style={{
              padding: "20px 24px",
              borderBottom: "1px solid var(--line)",
            }}>
              <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 600, color: "#0a7" }}>
                ✓ Customer Account Created
              </h2>
            </div>
            <div style={{ padding: "24px" }}>
              <div style={{ marginBottom: "20px" }}>
                <p style={{ margin: "0 0 16px 0", fontSize: "14px", lineHeight: 1.5 }}>
                  Customer account has been created successfully. Share these credentials with <strong>{tempPasswordEmail}</strong>:
                </p>
              </div>
              
              <div style={{
                background: "#f5f5f5",
                padding: "16px",
                borderRadius: "4px",
                marginBottom: "20px",
              }}>
                <div style={{ marginBottom: "12px" }}>
                  <label style={{ display: "block", fontSize: "12px", color: "var(--muted)", marginBottom: "4px" }}>
                    Email
                  </label>
                  <div style={{ fontSize: "14px", fontFamily: "monospace", wordBreak: "break-all" }}>
                    {tempPasswordEmail}
                  </div>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12px", color: "var(--muted)", marginBottom: "4px" }}>
                    Temporary Password
                  </label>
                  <div style={{
                    fontSize: "16px",
                    fontFamily: "monospace",
                    fontWeight: 600,
                    color: "#c33",
                    wordBreak: "break-all",
                  }}>
                    {temporaryPassword}
                  </div>
                </div>
              </div>

              <div style={{
                padding: "12px",
                background: "#fff4e5",
                border: "1px solid #ffd699",
                borderRadius: "4px",
                fontSize: "13px",
                lineHeight: 1.4,
              }}>
                <strong>⚠️ Important:</strong> The customer must change this password on first login. Copy this password now - it will not be shown again.
              </div>
            </div>
            <div style={{
              padding: "16px 24px",
              borderTop: "1px solid var(--line)",
              display: "flex",
              justifyContent: "flex-end",
            }}>
              <button
                onClick={() => {
                  setTemporaryPassword(null);
                  setTempPasswordEmail("");
                }}
                style={{
                  padding: "10px 20px",
                  border: "none",
                  borderRadius: "3px",
                  background: "var(--accent)",
                  color: "white",
                  fontSize: "13px",
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
