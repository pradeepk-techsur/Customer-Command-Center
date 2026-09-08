import { useEffect, useState } from "react";
import { getAccessToken } from "../api.ts";
import { monthLabel } from "../lib/format.ts";
import { Button, Field, TextInput } from "./ui.tsx";

interface PmSubmission {
  userId: number;
  userName: string;
  email: string;
  hasSubmitted: boolean;
  reportId: number | null;
  status: string | null;
  submittedAt: string | null;
}

interface SubmissionStatusResponse {
  period: string;
  submissions: PmSubmission[];
}

export function SubmissionDashboard() {
  const [period, setPeriod] = useState(monthLabel());
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<SubmissionStatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = getAccessToken();
      const response = await fetch(`/api/program-manager/submission-status/${encodeURIComponent(period)}`, {
        headers: {
          'Authorization': `Bearer ${token || ''}`,
        },
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch submission status: ${response.statusText}`);
      }
      const result = await response.json() as SubmissionStatusResponse;
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleSearch = () => {
    fetchStatus();
  };

  const submittedCount = data?.submissions.filter(s => s.hasSubmitted).length || 0;
  const totalCount = data?.submissions.length || 0;
  const pendingCount = totalCount - submittedCount;

  return (
    <div className="page-section">
      <div className="page-header">
        <div>
          <h1 className="page-title">PM Submission Dashboard</h1>
          <p className="page-subtitle">Track which Project Managers have submitted their monthly reports</p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <div className="card-body">
          <div style={{ display: "flex", gap: 12, alignItems: "flex-end" }}>
            <Field label="Reporting period (e.g. June 2026)" style={{ flex: 1 }}>
              <TextInput value={period} onChange={setPeriod} />
            </Field>
            <Button primary onClick={handleSearch} disabled={loading}>
              {loading ? "Loading..." : "View Status"}
            </Button>
          </div>
        </div>
      </div>

      {error && (
        <div className="card" style={{ marginBottom: 18, borderColor: "#d32f2f" }}>
          <div className="card-body" style={{ color: "#d32f2f" }}>
            <strong>Error:</strong> {error}
          </div>
        </div>
      )}

      {data && (
        <>
          <div style={{ display: "flex", gap: 16, marginBottom: 18 }}>
            <div className="stat-card" style={{ flex: 1, padding: 16, background: "#f5f5f5", borderRadius: 8 }}>
              <div style={{ fontSize: 13, color: "#666", marginBottom: 4 }}>Total PMs</div>
              <div style={{ fontSize: 28, fontWeight: 600 }}>{totalCount}</div>
            </div>
            <div className="stat-card" style={{ flex: 1, padding: 16, background: "#e8f5e9", borderRadius: 8 }}>
              <div style={{ fontSize: 13, color: "#2e7d32", marginBottom: 4 }}>Submitted</div>
              <div style={{ fontSize: 28, fontWeight: 600, color: "#2e7d32" }}>{submittedCount}</div>
            </div>
            <div className="stat-card" style={{ flex: 1, padding: 16, background: "#fff3e0", borderRadius: 8 }}>
              <div style={{ fontSize: 13, color: "#e65100", marginBottom: 4 }}>Pending</div>
              <div style={{ fontSize: 28, fontWeight: 600, color: "#e65100" }}>{pendingCount}</div>
            </div>
            <div className="stat-card" style={{ flex: 1, padding: 16, background: "#e3f2fd", borderRadius: 8 }}>
              <div style={{ fontSize: 13, color: "#1565c0", marginBottom: 4 }}>Completion</div>
              <div style={{ fontSize: 28, fontWeight: 600, color: "#1565c0" }}>
                {totalCount > 0 ? Math.round((submittedCount / totalCount) * 100) : 0}%
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <div className="card-title">Project Manager Submissions for {data.period}</div>
            </div>
            
            <div className="grid thead" style={{ gridTemplateColumns: "2fr 2fr 1.5fr 1fr 1fr" }}>
              <div>Project Manager</div>
              <div>Email</div>
              <div>Status</div>
              <div>Report Status</div>
              <div>Submitted</div>
            </div>

            {data.submissions.length === 0 ? (
              <div className="card-empty">No Project Managers found in the system.</div>
            ) : (
              data.submissions.map((sub) => (
                <div 
                  key={sub.userId} 
                  className="grid trow" 
                  style={{ gridTemplateColumns: "2fr 2fr 1.5fr 1fr 1fr" }}
                >
                  <div style={{ fontWeight: 500 }}>{sub.userName}</div>
                  <div className="muted">{sub.email}</div>
                  <div>
                    {sub.hasSubmitted ? (
                      <span style={{ 
                        padding: "4px 12px", 
                        borderRadius: 4, 
                        background: "#e8f5e9", 
                        color: "#2e7d32",
                        fontSize: 13,
                        fontWeight: 500,
                      }}>
                        ✓ Submitted
                      </span>
                    ) : (
                      <span style={{ 
                        padding: "4px 12px", 
                        borderRadius: 4, 
                        background: "#fff3e0", 
                        color: "#e65100",
                        fontSize: 13,
                        fontWeight: 500,
                      }}>
                        ⏳ Pending
                      </span>
                    )}
                  </div>
                  <div className={sub.status ? "status-token" : "muted"}>
                    {sub.status || "—"}
                  </div>
                  <div className="muted">
                    {sub.submittedAt 
                      ? new Date(sub.submittedAt).toLocaleDateString()
                      : "—"
                    }
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
