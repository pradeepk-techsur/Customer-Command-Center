import { useState } from "react";

interface LoginPageProps {
  onLogin: (accessToken: string, refreshToken: string) => void;
  onShowRegister: () => void;
}

export function LoginPage({ onLogin, onShowRegister }: LoginPageProps) {
  const [mode, setMode] = useState<"password" | "magic-link">("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [magicLinkMessage, setMagicLinkMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || data.error || "Login failed");
        setLoading(false);
        return;
      }

      onLogin(data.accessToken, data.refreshToken);
    } catch (err) {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  };

  const handleMagicLinkRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMagicLinkMessage("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/magic-link/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      // Same generic message whether or not the address is approved (prevents enumeration).
      setMagicLinkMessage(data.message || "If this address is approved, a secure sign-in link will arrive shortly.");
    } catch (err) {
      setMagicLinkMessage("If this address is approved, a secure sign-in link will arrive shortly.");
    } finally {
      setLoading(false);
    }
  };

  const handleMicrosoftLogin = () => {
    // Redirect to Microsoft OAuth endpoint
    window.location.href = "/api/auth/microsoft/login";
  };

  return (
    <div style={{ 
      display: "flex", 
      justifyContent: "center", 
      alignItems: "center", 
      minHeight: "100vh",
      background: "var(--page)"
    }}>
      <div style={{
        background: "var(--surface)",
        padding: "40px",
        borderRadius: "8px",
        border: "1px solid var(--line)",
        boxShadow: "0 2px 10px rgba(0,0,0,0.06)",
        width: "100%",
        maxWidth: "400px"
      }}>
        <h1 style={{ marginBottom: "10px", fontSize: "24px", color: "var(--ink)" }}>
          TechSur Mission Control
        </h1>
        <p style={{ marginBottom: "30px", color: "var(--muted)", fontSize: "14px" }}>
          Sign in to access your contract information
        </p>

        {error && (
          <div style={{
            padding: "12px",
            marginBottom: "20px",
            background: "#fee",
            border: "1px solid #fcc",
            borderRadius: "4px",
            color: "#c33",
            fontSize: "14px"
          }}>
            {error}
          </div>
        )}

        {magicLinkMessage && (
          <div style={{
            padding: "12px",
            marginBottom: "20px",
            background: "#eef7ee",
            border: "1px solid #cde8cd",
            borderRadius: "4px",
            color: "#2a6b2a",
            fontSize: "14px"
          }}>
            {magicLinkMessage}
          </div>
        )}

        <div style={{ display: "flex", gap: "8px", marginBottom: "20px" }}>
          <button
            type="button"
            onClick={() => { setMode("password"); setMagicLinkMessage(""); setError(""); }}
            style={{
              flex: 1, padding: "8px", borderRadius: "4px", fontSize: "13px", fontWeight: 500,
              border: mode === "password" ? "1px solid var(--accent)" : "1px solid var(--line-input)",
              background: mode === "password" ? "var(--accent-tint)" : "var(--surface)",
              color: mode === "password" ? "var(--accent)" : "var(--muted)", cursor: "pointer",
            }}
          >
            Password
          </button>
          <button
            type="button"
            onClick={() => { setMode("magic-link"); setError(""); }}
            style={{
              flex: 1, padding: "8px", borderRadius: "4px", fontSize: "13px", fontWeight: 500,
              border: mode === "magic-link" ? "1px solid var(--accent)" : "1px solid var(--line-input)",
              background: mode === "magic-link" ? "var(--accent-tint)" : "var(--surface)",
              color: mode === "magic-link" ? "var(--accent)" : "var(--muted)", cursor: "pointer",
            }}
          >
            Email me a sign-in link
          </button>
        </div>

        {mode === "password" ? (
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: "20px" }}>
              <label style={{ display: "block", marginBottom: "8px", fontSize: "14px", fontWeight: "500" }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                style={{
                  width: "100%",
                  padding: "10px",
                  border: "1px solid #ddd",
                  borderRadius: "4px",
                  fontSize: "14px",
                  boxSizing: "border-box"
                }}
                placeholder="you@example.com"
              />
            </div>

            <div style={{ marginBottom: "20px" }}>
              <label style={{ display: "block", marginBottom: "8px", fontSize: "14px", fontWeight: "500" }}>
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                style={{
                  width: "100%",
                  padding: "10px",
                  border: "1px solid #ddd",
                  borderRadius: "4px",
                  fontSize: "14px",
                  boxSizing: "border-box"
                }}
                placeholder="Enter your password"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%",
                padding: "12px",
                background: "var(--accent-fill)",
                color: "var(--accent-fill-ink)",
                border: "none",
                borderRadius: "4px",
                fontSize: "16px",
                fontWeight: "700",
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.7 : 1
              }}
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleMagicLinkRequest}>
            <div style={{ marginBottom: "20px" }}>
              <label style={{ display: "block", marginBottom: "8px", fontSize: "14px", fontWeight: "500" }}>
                Work email address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                style={{
                  width: "100%",
                  padding: "10px",
                  border: "1px solid #ddd",
                  borderRadius: "4px",
                  fontSize: "14px",
                  boxSizing: "border-box"
                }}
                placeholder="you@agency.gov"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%",
                padding: "12px",
                background: "var(--accent-fill)",
                color: "var(--accent-fill-ink)",
                border: "none",
                borderRadius: "4px",
                fontSize: "16px",
                fontWeight: "700",
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.7 : 1
              }}
            >
              {loading ? "Sending…" : "Send sign-in link"}
            </button>
          </form>
        )}

        <div style={{ 
          margin: "20px 0", 
          textAlign: "center", 
          color: "#999",
          fontSize: "14px"
        }}>
          or
        </div>

        <button
          type="button"
          onClick={handleMicrosoftLogin}
          disabled={loading}
          style={{
            width: "100%",
            padding: "12px",
            background: "white",
            color: "#333",
            border: "1px solid #ddd",
            borderRadius: "4px",
            fontSize: "16px",
            fontWeight: "500",
            cursor: loading ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "10px"
          }}
        >
          <svg width="20" height="20" viewBox="0 0 23 23">
            <path fill="#f25022" d="M0 0h11v11H0z"/>
            <path fill="#00a4ef" d="M12 0h11v11H12z"/>
            <path fill="#7fba00" d="M0 12h11v11H0z"/>
            <path fill="#ffb900" d="M12 12h11v11H12z"/>
          </svg>
          Sign in with Microsoft
        </button>

        <div style={{ marginTop: "20px", textAlign: "center", fontSize: "14px" }}>
          <span style={{ color: "var(--muted)" }}>Don't have an account? </span>
          <button
            type="button"
            onClick={onShowRegister}
            disabled={loading}
            style={{
              background: "none",
              border: "none",
              color: "var(--accent)",
              cursor: "pointer",
              textDecoration: "underline",
              fontSize: "14px",
              padding: 0
            }}
          >
            Register
          </button>
        </div>
      </div>
    </div>
  );
}
