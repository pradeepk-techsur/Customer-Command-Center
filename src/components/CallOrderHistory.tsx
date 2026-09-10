import { useEffect, useState } from "react";
import type { CallOrderSnapshot, StaffSnapshot, Role } from "../../shared/types.ts";
import { getAccessToken } from "../api.ts";
import { Button, Eyebrow, Field, TextInput } from "./ui.tsx";
import { dateLabel, usd } from "../lib/format.ts";

interface HistoryEntry {
  id: string;
  date: string;
  time: string;
  type: 'financial' | 'staff';
  description: string;
  changedBy?: string;
  details: any;
  snapshot: CallOrderSnapshot | StaffSnapshot;
}

export function CallOrderHistory({ 
  callOrderId, 
  userRole 
}: { 
  callOrderId: string; 
  userRole: Role;
}) {
  const [coHistory, setCoHistory] = useState<CallOrderSnapshot[]>([]);
  const [staffHistory, setStaffHistory] = useState<StaffSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'financial' | 'staff'>('all');
  const [compareMode, setCompareMode] = useState(false);
  const [date1, setDate1] = useState("");
  const [date2, setDate2] = useState("");
  const [comparison, setComparison] = useState<any>(null);

  const showUserInfo = userRole !== 'customer';

  useEffect(() => {
    loadHistory();
  }, [callOrderId]);

  const loadHistory = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = getAccessToken();
      const response = await fetch(`/api/call-orders/${callOrderId}/history`, {
        headers: {
          'Authorization': `Bearer ${token || ''}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to load history: ${response.statusText}`);
      }

      const data = await response.json();
      setCoHistory(data.callOrderHistory || []);
      setStaffHistory(data.staffHistory || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const runComparison = async () => {
    if (!date1 || !date2) {
      setError("Please select both dates for comparison");
      return;
    }

    try {
      const token = getAccessToken();
      const response = await fetch(
        `/api/call-orders/${callOrderId}/history/compare?date1=${encodeURIComponent(date1)}&date2=${encodeURIComponent(date2)}`,
        {
          headers: { 'Authorization': `Bearer ${token || ''}` },
        }
      );

      if (!response.ok) throw new Error(`Comparison failed: ${response.statusText}`);

      const data = await response.json();
      setComparison(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  // Merge and sort all history entries
  const allEntries: HistoryEntry[] = [];

  if (filter === 'all' || filter === 'financial') {
    coHistory.forEach((snapshot) => {
      const date = new Date(snapshot.snapshotTime);
      const description = snapshot.changedFields?.join(', ') || 'Financial update';
      
      allEntries.push({
        id: `co-${snapshot.id}`,
        date: date.toISOString().split('T')[0],
        time: snapshot.snapshotTime,
        type: 'financial',
        description: `💰 ${description}`,
        changedBy: showUserInfo ? snapshot.createdByUserName : undefined,
        details: {
          funded: snapshot.funded,
          spend: snapshot.spend,
          eac: snapshot.eac,
          pm: snapshot.pm,
        },
        snapshot,
      });
    });
  }

  if (filter === 'all' || filter === 'staff') {
    staffHistory.forEach((snapshot) => {
      const date = new Date(snapshot.snapshotTime);
      let description = '👥 Staff roster updated';
      
      if (snapshot.changeType === 'add') {
        description = `👥 Staff member added`;
      } else if (snapshot.changeType === 'update') {
        description = `👥 Staff member updated`;
      } else if (snapshot.changeType === 'delete') {
        description = `👥 Staff member removed`;
      }
      
      allEntries.push({
        id: `staff-${snapshot.id}`,
        date: date.toISOString().split('T')[0],
        time: snapshot.snapshotTime,
        type: 'staff',
        description,
        changedBy: showUserInfo ? snapshot.createdByUserName : undefined,
        details: {
          staffCount: snapshot.staffRoster.length,
          changeType: snapshot.changeType,
          reason: snapshot.changeReason,
        },
        snapshot,
      });
    });
  }

  // Sort by time descending (most recent first)
  allEntries.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

  if (loading) {
    return <div className="loading">Loading history...</div>;
  }

  if (error) {
    return (
      <div className="notice error">
        <div><span>{error}</span><button type="button" onClick={() => setError(null)}>Dismiss</button></div>
      </div>
    );
  }

  return (
    <div className="page-section">
      <div className="page-header">
        <div>
          <h2>Change History</h2>
          <p className="page-subtitle">
            {showUserInfo 
              ? "Complete audit trail with user attribution" 
              : "View what changed and when"}
          </p>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <Button onClick={() => setCompareMode(!compareMode)}>
            {compareMode ? "View Timeline" : "Compare Dates"}
          </Button>
        </div>
      </div>

      {!compareMode ? (
        <>
          {/* Filter buttons */}
          <div style={{ marginBottom: 18, display: "flex", gap: 8 }}>
            <button
              className={`btn ${filter === 'all' ? 'primary' : 'outline'}`}
              onClick={() => setFilter('all')}
            >
              All Changes
            </button>
            <button
              className={`btn ${filter === 'financial' ? 'primary' : 'outline'}`}
              onClick={() => setFilter('financial')}
            >
              Financial Only
            </button>
            <button
              className={`btn ${filter === 'staff' ? 'primary' : 'outline'}`}
              onClick={() => setFilter('staff')}
            >
              People Only
            </button>
          </div>

          {/* Timeline */}
          <div className="card">
            {allEntries.length === 0 ? (
              <div className="card-empty">No history available for this call order.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {allEntries.map((entry) => (
                  <div
                    key={entry.id}
                    style={{
                      padding: 16,
                      border: "1px solid #e0e0e0",
                      borderRadius: 8,
                      backgroundColor: "#fafafa",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                      <div style={{ fontWeight: 600, color: "#1b1e21" }}>
                        {entry.description}
                      </div>
                      <div style={{ fontSize: 13, color: "#6c757d" }}>
                        {dateLabel(entry.date)}
                      </div>
                    </div>
                    
                    {showUserInfo && entry.changedBy && (
                      <div style={{ fontSize: 13, color: "#6c757d", marginBottom: 8 }}>
                        Changed by: {entry.changedBy}
                      </div>
                    )}
                    
                    {entry.details.reason && (
                      <div style={{ fontSize: 13, color: "#495057", marginBottom: 8 }}>
                        {entry.details.reason}
                      </div>
                    )}
                    
                    {entry.type === 'financial' && (
                      <div style={{ fontSize: 13, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                        <div>
                          <Eyebrow>Funded</Eyebrow>
                          <div>{usd(entry.details.funded)}</div>
                        </div>
                        <div>
                          <Eyebrow>Spend</Eyebrow>
                          <div>{usd(entry.details.spend)}</div>
                        </div>
                        {entry.details.eac && (
                          <div>
                            <Eyebrow>EAC</Eyebrow>
                            <div>{usd(entry.details.eac)}</div>
                          </div>
                        )}
                      </div>
                    )}
                    
                    {entry.type === 'staff' && (
                      <div style={{ fontSize: 13 }}>
                        <Eyebrow>Staff Count</Eyebrow>
                        <div>{entry.details.staffCount} personnel</div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          {/* Comparison mode */}
          <div className="card" style={{ marginBottom: 18 }}>
            <div className="card-body">
              <h3 style={{ marginBottom: 16 }}>Compare States at Two Dates</h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, alignItems: "flex-end" }}>
                <Field label="Earlier Date">
                  <TextInput type="date" value={date1} onChange={setDate1} />
                </Field>
                <Field label="Later Date">
                  <TextInput type="date" value={date2} onChange={setDate2} />
                </Field>
                <Button primary onClick={runComparison}>
                  Compare
                </Button>
              </div>
            </div>
          </div>

          {comparison && (
            <div className="card">
              <div className="card-body">
                <h3 style={{ marginBottom: 16 }}>Comparison Results</h3>
                
                {comparison.changes.length === 0 ? (
                  <div>No changes detected between these dates.</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {comparison.changes.map((change: any, idx: number) => (
                      <div
                        key={idx}
                        style={{
                          padding: 12,
                          border: "1px solid #dee2e6",
                          borderRadius: 6,
                          backgroundColor: "#f8f9fa",
                        }}
                      >
                        <div style={{ fontWeight: 600, marginBottom: 4, textTransform: "capitalize" }}>
                          {change.field.replace('_', ' ')}
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 8, fontSize: 13 }}>
                          <div>
                            <Eyebrow>Before</Eyebrow>
                            <div>{typeof change.before === 'number' ? usd(change.before) : String(change.before)}</div>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", color: "#6c757d" }}>→</div>
                          <div>
                            <Eyebrow>After</Eyebrow>
                            <div>{typeof change.after === 'number' ? usd(change.after) : String(change.after)}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
