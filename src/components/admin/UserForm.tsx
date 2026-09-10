import { useState, useEffect } from "react";

interface User {
  id?: number;
  email: string;
  name: string;
  role: "customer" | "pm" | "admin" | "program_manager";
  auth_provider: "email" | "microsoft";
  status: "active" | "inactive" | "suspended";
}

interface CallOrder {
  id: string;
  name: string;
  group_name: string;
}

interface UserFormProps {
  user?: User;
  onSave: (userData: Partial<User> & { password?: string }, callOrderIds?: string[]) => Promise<void>;
  onCancel: () => void;
  isProgramManager?: boolean;
}

export function UserForm({ user, onSave, onCancel, isProgramManager = false }: UserFormProps) {
  const isEdit = !!user?.id;
  const [formData, setFormData] = useState<Partial<User> & { password?: string }>({
    email: user?.email || "",
    name: user?.name || "",
    role: user?.role || "customer",
    auth_provider: isProgramManager ? "email" : (user?.auth_provider || "email"),
    status: user?.status || "active",
    password: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [callOrders, setCallOrders] = useState<CallOrder[]>([]);
  const [assignedCallOrders, setAssignedCallOrders] = useState<string[]>([]);
  const [loadingCallOrders, setLoadingCallOrders] = useState(false);

  // Load available call orders
  useEffect(() => {
    const loadCallOrders = async () => {
      setLoadingCallOrders(true);
      try {
        const token = localStorage.getItem("accessToken");
        const response = await fetch("/api/admin/call-orders", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        
        if (response.ok) {
          const data = await response.json();
          setCallOrders(data.callOrders || []);
        }
      } catch (err) {
        console.error("Failed to load call orders:", err);
      } finally {
        setLoadingCallOrders(false);
      }
    };
    
    loadCallOrders();
  }, []);

  // Load assigned call orders when editing a Project Manager
  useEffect(() => {
    if (user?.id && user.role === "pm") {
      const loadAssignments = async () => {
        try {
          const token = localStorage.getItem("accessToken");
          const response = await fetch(`/api/admin/users/${user.id}/call-orders`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
          
          if (response.ok) {
            const data = await response.json();
            if (!data.hasFullAccess && data.assignments) {
              setAssignedCallOrders(data.assignments.map((a: any) => a.call_order_id));
            }
          }
        } catch (err) {
          console.error("Failed to load assignments:", err);
        }
      };
      
      loadAssignments();
    }
  }, [user?.id, user?.role]);

  useEffect(() => {
    if (user) {
      setFormData({
        email: user.email,
        name: user.name,
        role: user.role,
        auth_provider: user.auth_provider,
        status: user.status,
      });
      // Reset assignments when role changes (only PMs use assignments)
      if (user.role !== "pm") {
        setAssignedCallOrders([]);
      }
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // Validate password for new email users (skip for PM-created customers - password is auto-generated)
      if (!isEdit && formData.auth_provider === "email" && !isProgramManager) {
        if (!formData.password || formData.password.length < 8) {
          setError("Password must be at least 8 characters");
          setLoading(false);
          return;
        }
      }

      // Pass call order assignments only for PMs (customers have automatic full access)
      const callOrdersToSave = formData.role === "pm" ? assignedCallOrders : undefined;
      await onSave(formData, callOrdersToSave);
      setLoading(false);
    } catch (err: any) {
      setError(err.message || "Failed to save user");
      setLoading(false);
    }
  };

  const handleToggleCallOrder = (callOrderId: string) => {
    setAssignedCallOrders(prev =>
      prev.includes(callOrderId)
        ? prev.filter(id => id !== callOrderId)
        : [...prev, callOrderId]
    );
  };

  const handleRoleChange = (newRole: string) => {
    setFormData({ ...formData, role: newRole as any });
    // Clear assignments when changing away from PM role (customers don't use assignments)
    if (newRole !== "pm") {
      setAssignedCallOrders([]);
    }
  };

  return (
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
        maxHeight: "90vh",
        overflow: "auto",
        boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
      }}>
        <div style={{
          padding: "20px 24px",
          borderBottom: "1px solid var(--line)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}>
          <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 600 }}>
            {isEdit ? "Edit User" : "Add New User"}
          </h2>
          <button
            onClick={onCancel}
            disabled={loading}
            style={{
              background: "none",
              border: "none",
              fontSize: "24px",
              cursor: "pointer",
              color: "var(--muted)",
              padding: 0,
              width: "30px",
              height: "30px",
            }}
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ padding: "24px" }}>
            {error && (
              <div style={{
                padding: "12px",
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

            <div style={{ marginBottom: "20px" }}>
              <label style={{ display: "block", marginBottom: "8px", fontSize: "13px", fontWeight: 500 }}>
                Full Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                disabled={loading}
                style={{
                  width: "100%",
                  padding: "10px",
                  border: "1px solid var(--line-input)",
                  borderRadius: "3px",
                  fontSize: "13px",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div style={{ marginBottom: "20px" }}>
              <label style={{ display: "block", marginBottom: "8px", fontSize: "13px", fontWeight: 500 }}>
                Email *
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
                disabled={loading || isEdit}
                style={{
                  width: "100%",
                  padding: "10px",
                  border: "1px solid var(--line-input)",
                  borderRadius: "3px",
                  fontSize: "13px",
                  boxSizing: "border-box",
                  background: isEdit ? "var(--surface-2)" : "white",
                }}
              />
              {isEdit && (
                <div style={{ fontSize: "12px", color: "var(--muted)", marginTop: "4px" }}>
                  Email cannot be changed
                </div>
              )}
            </div>

            <div style={{ marginBottom: "20px" }}>
              <label style={{ display: "block", marginBottom: "8px", fontSize: "13px", fontWeight: 500 }}>
                Role *
              </label>
              <select
                value={formData.role}
                onChange={(e) => handleRoleChange(e.target.value)}
                required
                disabled={loading || isEdit}
                style={{
                  width: "100%",
                  padding: "10px",
                  border: "1px solid var(--line-input)",
                  borderRadius: "3px",
                  fontSize: "13px",
                  boxSizing: "border-box",
                  background: isEdit ? "var(--surface-2)" : "white",
                }}
              >
                <option value="customer">Customer</option>
                <option value="pm">Project Manager</option>
                {!isProgramManager && (
                  <>
                    <option value="program_manager">Program Manager</option>
                    <option value="admin">Administrator</option>
                  </>
                )}
              </select>
              {isEdit && (
                <div style={{ fontSize: "12px", color: "var(--muted)", marginTop: "4px" }}>
                  Role cannot be changed
                </div>
              )}
            </div>

            {isProgramManager && !isEdit && formData.role === "customer" && (
              <div style={{
                padding: "12px",
                background: "#e8f4fd",
                border: "1px solid #b3d9f2",
                borderRadius: "4px",
                marginBottom: "20px",
                fontSize: "13px",
              }}>
                <strong>Creating Customer Account</strong>
                <div style={{ marginTop: "4px", color: "var(--muted)" }}>
                  A temporary password will be generated. The customer must change it on first login.
                </div>
              </div>
            )}

            {isProgramManager && !isEdit && formData.role === "pm" && (
              <div style={{
                padding: "12px",
                background: "#fff3cd",
                border: "1px solid #ffc107",
                borderRadius: "4px",
                marginBottom: "20px",
                fontSize: "13px",
              }}>
                <strong>📋 SSO-Based Account</strong>
                <div style={{ marginTop: "4px", color: "var(--muted)" }}>
                  Project Managers use Microsoft Single Sign-On (Azure AD). The user will log in with their TechSur email and Microsoft credentials. No password creation needed.
                </div>
              </div>
            )}

            {formData.role === "customer" && (
              <div style={{
                padding: "12px",
                background: "#f0f9ff",
                border: "1px solid #bfdbfe",
                borderRadius: "4px",
                marginBottom: "20px",
                fontSize: "13px",
              }}>
                <strong>ℹ️ Full Access</strong>
                <div style={{ marginTop: "4px", color: "var(--muted)" }}>
                  Customers automatically have read-only access to all call orders, weekly reports, and monthly reports. No assignment needed.
                </div>
              </div>
            )}

            {formData.role === "pm" && (
              <div style={{ marginBottom: "20px" }}>
                <label style={{ display: "block", marginBottom: "8px", fontSize: "13px", fontWeight: 500 }}>
                  Call Order Access (Project Managers)
                </label>
                <div style={{
                  border: "1px solid var(--line-input)",
                  borderRadius: "3px",
                  padding: "12px",
                  maxHeight: "200px",
                  overflowY: "auto",
                  background: "var(--surface-1)",
                }}>
                  {loadingCallOrders ? (
                    <div style={{ fontSize: "13px", color: "var(--muted)", padding: "8px" }}>
                      Loading call orders...
                    </div>
                  ) : callOrders.length === 0 ? (
                    <div style={{ fontSize: "13px", color: "var(--muted)", padding: "8px" }}>
                      No call orders available
                    </div>
                  ) : (
                    callOrders.map((co) => (
                      <label
                        key={co.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          padding: "6px 8px",
                          cursor: "pointer",
                          borderRadius: "3px",
                          fontSize: "13px",
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = "var(--surface-2)"}
                        onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                      >
                        <input
                          type="checkbox"
                          checked={assignedCallOrders.includes(co.id)}
                          onChange={() => handleToggleCallOrder(co.id)}
                          disabled={loading}
                          style={{ marginRight: "8px" }}
                        />
                        <span>
                          {co.name} <span style={{ color: "var(--muted)" }}>({co.group_name})</span>
                        </span>
                      </label>
                    ))
                  )}
                </div>
                <div style={{ fontSize: "12px", color: "var(--muted)", marginTop: "4px" }}>
                  {assignedCallOrders.length === 0
                    ? "No call orders selected - user will have no access"
                    : `${assignedCallOrders.length} call order(s) selected`}
                </div>
                <div style={{ fontSize: "12px", color: "var(--muted)", marginTop: "2px", fontStyle: "italic" }}>
                  PMs and Admins automatically have access to all call orders
                </div>
              </div>
            )}

            {!isEdit && !isProgramManager && (
              <div style={{ marginBottom: "20px" }}>
                <label style={{ display: "block", marginBottom: "8px", fontSize: "13px", fontWeight: 500 }}>
                  Authentication Provider *
                </label>
                <select
                  value={formData.auth_provider}
                  onChange={(e) => setFormData({ ...formData, auth_provider: e.target.value as any })}
                  required
                  disabled={loading}
                  style={{
                    width: "100%",
                    padding: "10px",
                    border: "1px solid var(--line-input)",
                    borderRadius: "3px",
                    fontSize: "13px",
                    boxSizing: "border-box",
                  }}
                >
                  <option value="email">Email/Password</option>
                  <option value="microsoft">Microsoft (Azure AD)</option>
                </select>
              </div>
            )}

            {!isEdit && !isProgramManager && formData.auth_provider === "email" && (
              <div style={{ marginBottom: "20px" }}>
                <label style={{ display: "block", marginBottom: "8px", fontSize: "13px", fontWeight: 500 }}>
                  Password *
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required={!isEdit && formData.auth_provider === "email"}
                  disabled={loading}
                  style={{
                    width: "100%",
                    padding: "10px",
                    border: "1px solid var(--line-input)",
                    borderRadius: "3px",
                    fontSize: "13px",
                    boxSizing: "border-box",
                  }}
                />
                <div style={{ fontSize: "12px", color: "var(--muted)", marginTop: "4px" }}>
                  Must be 8+ characters with uppercase, lowercase, number, and special character
                </div>
              </div>
            )}

            <div style={{ marginBottom: "20px" }}>
              <label style={{ display: "block", marginBottom: "8px", fontSize: "13px", fontWeight: 500 }}>
                Status *
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                required
                disabled={loading}
                style={{
                  width: "100%",
                  padding: "10px",
                  border: "1px solid var(--line-input)",
                  borderRadius: "3px",
                  fontSize: "13px",
                  boxSizing: "border-box",
                }}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="suspended">Suspended</option>
              </select>
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
              type="button"
              onClick={onCancel}
              disabled={loading}
              style={{
                padding: "10px 20px",
                border: "1px solid var(--line-input)",
                borderRadius: "3px",
                background: "white",
                fontSize: "13px",
                cursor: "pointer",
                color: "var(--ink-2)",
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: "10px 20px",
                border: "none",
                borderRadius: "3px",
                background: "var(--accent)",
                color: "white",
                fontSize: "13px",
                fontWeight: 500,
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? "Saving..." : isEdit ? "Update User" : "Create User"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
