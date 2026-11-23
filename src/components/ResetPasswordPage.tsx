import { useState } from "react";

export function ResetPasswordPage({ token, onBack }: { token: string; onBack: () => void }) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState(token ? "" : "This password reset link is invalid.");
  const [complete, setComplete] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    if (password !== confirmation) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      const response = await fetch("/api/auth/password-reset/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(data?.message || data?.error || "Password reset failed.");
        return;
      }
      setComplete(true);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>{complete ? "Password updated" : "Choose a new password"}</h1>
        {complete ? (
          <>
            <div className="auth-message success">Your password was reset. Sign in with your new password.</div>
            <button className="auth-primary" type="button" onClick={onBack}>Return to sign in</button>
          </>
        ) : (
          <>
            <p className="auth-sub">Use at least 8 characters with uppercase, lowercase, number, and special characters.</p>
            {error && <div className="auth-message error">{error}</div>}
            <form onSubmit={submit}>
              <label className="auth-field">New password
                <input className="input" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required disabled={loading || !token} autoComplete="new-password" />
              </label>
              <label className="auth-field">Confirm new password
                <input className="input" type="password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} required disabled={loading || !token} autoComplete="new-password" />
              </label>
              <button className="auth-primary" type="submit" disabled={loading || !token}>{loading ? "Updating…" : "Reset password"}</button>
            </form>
            <button className="auth-link" type="button" onClick={onBack}>Back to sign in</button>
          </>
        )}
      </div>
    </div>
  );
}
