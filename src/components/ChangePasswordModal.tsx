import { useState } from "react";

interface ChangePasswordModalProps {
  email: string;
  onSuccess: () => void;
  onCancel?: () => void;
  isForced?: boolean;
}

export function ChangePasswordModal({ email, onSuccess, onCancel, isForced = false }: ChangePasswordModalProps) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Validate passwords match
    if (newPassword !== confirmPassword) {
      setError("New passwords do not match");
      return;
    }

    // Validate password strength
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters long");
      return;
    }

    if (!/[A-Z]/.test(newPassword)) {
      setError("Password must contain at least one uppercase letter");
      return;
    }

    if (!/[a-z]/.test(newPassword)) {
      setError("Password must contain at least one lowercase letter");
      return;
    }

    if (!/[0-9]/.test(newPassword)) {
      setError("Password must contain at least one number");
      return;
    }

    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(newPassword)) {
      setError("Password must contain at least one special character");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to change password");
      }

      onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
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
      zIndex: 2000,
    }}>
      <div style={{
        background: "white",
        borderRadius: "8px",
        width: "100%",
        maxWidth: "450px",
        boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
      }}>
        <div style={{
          padding: "20px 24px",
          borderBottom: "1px solid var(--line)",
        }}>
          <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 600 }}>
            {isForced ? "⚠️ Change Your Password" : "Change Password"}
          </h2>
          {isForced && (
            <p style={{ margin: "8px 0 0 0", fontSize: "13px", color: "var(--muted)" }}>
              You must change your temporary password before continuing.
            </p>
          )}
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
                Email
              </label>
              <input
                type="text"
                value={email}
                disabled
                style={{
                  width: "100%",
                  padding: "10px",
                  border: "1px solid var(--line-input)",
                  borderRadius: "3px",
                  fontSize: "13px",
                  boxSizing: "border-box",
                  background: "var(--surface-2)",
                  color: "var(--muted)",
                }}
              />
            </div>

            <div style={{ marginBottom: "20px" }}>
              <label style={{ display: "block", marginBottom: "8px", fontSize: "13px", fontWeight: 500 }}>
                Current Password *
              </label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                disabled={loading}
                autoFocus
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
                New Password *
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
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
                Confirm New Password *
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
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

            <div style={{
              padding: "12px",
              background: "#f5f5f5",
              borderRadius: "4px",
              fontSize: "12px",
              lineHeight: 1.5,
            }}>
              <strong>Password Requirements:</strong>
              <ul style={{ margin: "8px 0 0 0", paddingLeft: "20px" }}>
                <li>At least 8 characters long</li>
                <li>At least one uppercase letter (A-Z)</li>
                <li>At least one lowercase letter (a-z)</li>
                <li>At least one number (0-9)</li>
                <li>At least one special character (!@#$%^&*...)</li>
              </ul>
            </div>
          </div>

          <div style={{
            padding: "16px 24px",
            borderTop: "1px solid var(--line)",
            display: "flex",
            gap: "12px",
            justifyContent: "flex-end",
          }}>
            {!isForced && onCancel && (
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
                  cursor: loading ? "not-allowed" : "pointer",
                  opacity: loading ? 0.5 : 1,
                }}
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              disabled={loading || !currentPassword || !newPassword || !confirmPassword}
              style={{
                padding: "10px 20px",
                border: "none",
                borderRadius: "3px",
                background: "var(--accent)",
                color: "white",
                fontSize: "13px",
                fontWeight: 500,
                cursor: loading || !currentPassword || !newPassword || !confirmPassword ? "not-allowed" : "pointer",
                opacity: loading || !currentPassword || !newPassword || !confirmPassword ? 0.5 : 1,
              }}
            >
              {loading ? "Changing..." : "Change Password"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
