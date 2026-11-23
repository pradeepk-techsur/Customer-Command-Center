import { useState } from "react";

export function ForgotPasswordPage({ onBack }: { onBack: () => void }) {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    const generic = "If an account with that email exists, a password reset link has been sent.";
    try {
      await fetch("/api/auth/password-reset/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setMessage(generic);
    } catch {
      setMessage(generic);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>Reset your password</h1>
        <p className="auth-sub">Enter your account email and we’ll send a secure reset link.</p>
        {message ? (
          <>
            <div className="auth-message success">{message}</div>
            <p className="auth-help">Microsoft accounts should continue using “Sign in with Microsoft.”</p>
          </>
        ) : (
          <form onSubmit={submit}>
            <label className="auth-field">Email
              <input className="input" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required disabled={loading} autoComplete="email" />
            </label>
            <button className="auth-primary" type="submit" disabled={loading}>{loading ? "Sending…" : "Send reset link"}</button>
          </form>
        )}
        <button className="auth-link" type="button" onClick={onBack}>Back to sign in</button>
      </div>
    </div>
  );
}
