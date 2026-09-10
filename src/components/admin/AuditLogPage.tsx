import { useEffect, useState } from "react";
import type { AuditLogEntry } from "../../../shared/types.ts";
import { getAccessToken } from "../../api.ts";
import { Button, Field, TextInput } from "../ui.tsx";
import { dateLabel } from "../../lib/format.ts";

export function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [filters, setFilters] = useState({
    userId: "",
    startDate: "",
    endDate: "",
    action: "",
    entity: "",
    entityId: "",
  });

  useEffect(() => {
    loadAuditLog();
  }, []);

  const loadAuditLog = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = getAccessToken();
      
      // Build query string from filters
      const params = new URLSearchParams();
      if (filters.userId) params.append('userId', filters.userId);
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      if (filters.action) params.append('action', filters.action);
      if (filters.entity) params.append('entity', filters.entity);
      if (filters.entityId) params.append('entityId', filters.entityId);

      const url = `/api/audit/report${params.toString() ? '?' + params.toString() : ''}`;
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token || ''}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to load audit log: ${response.statusText}`);
      }

      const data = await response.json();
      setLogs(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const updateFilter = (field: keyof typeof filters, value: string) => {
    setFilters({ ...filters, [field]: value });
  };

  const clearFilters = () => {
    setFilters({
      userId: "",
      startDate: "",
      endDate: "",
      action: "",
      entity: "",
      entityId: "",
    });
  };

  const exportToCsv = () => {
    if (logs.length === 0) return;

    const headers = ['ID', 'Date', 'Time', 'Actor', 'Role', 'Action', 'Entity', 'Entity ID', 'Details'];
    const rows = logs.map(log => {
      const date = new Date(log.occurredAt);
      return [
        log.id,
        date.toISOString().split('T')[0],
        date.toTimeString().split(' ')[0],
        log.actor,
        log.role,
        log.action,
        log.entity,
        log.entityId,
        JSON.stringify(log.details),
      ];
    });

    const csv = [headers, ...rows].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-log-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="page">
      <div className="page-section">
        <div className="page-header">
          <div>
            <h1>Audit Log</h1>
            <p className="page-subtitle">Complete system audit trail (admin only)</p>
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <Button onClick={exportToCsv} disabled={logs.length === 0}>
              Export to CSV
            </Button>
            <Button primary onClick={loadAuditLog}>
              {loading ? 'Loading...' : 'Refresh'}
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="card" style={{ marginBottom: 18 }}>
          <div className="card-body">
            <h3 style={{ marginBottom: 16 }}>Filters</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 12 }}>
              <Field label="User ID">
                <TextInput
                  value={filters.userId}
                  onChange={(v) => updateFilter('userId', v)}
                  placeholder="e.g. 123"
                />
              </Field>
              <Field label="Start Date">
                <TextInput
                  type="date"
                  value={filters.startDate}
                  onChange={(v) => updateFilter('startDate', v)}
                />
              </Field>
              <Field label="End Date">
                <TextInput
                  type="date"
                  value={filters.endDate}
                  onChange={(v) => updateFilter('endDate', v)}
                />
              </Field>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
              <Field label="Action">
                <TextInput
                  value={filters.action}
                  onChange={(v) => updateFilter('action', v)}
                  placeholder="e.g. call_order.spend"
                />
              </Field>
              <Field label="Entity">
                <TextInput
                  value={filters.entity}
                  onChange={(v) => updateFilter('entity', v)}
                  placeholder="e.g. call_order"
                />
              </Field>
              <Field label="Entity ID">
                <TextInput
                  value={filters.entityId}
                  onChange={(v) => updateFilter('entityId', v)}
                  placeholder="e.g. Call 2.3"
                />
              </Field>
            </div>
            <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <Button onClick={clearFilters}>Clear Filters</Button>
              <Button primary onClick={loadAuditLog}>Apply Filters</Button>
            </div>
          </div>
        </div>

        {error && (
          <div className="notice error" style={{ marginBottom: 18 }}>
            <div><span>{error}</span><button type="button" onClick={() => setError(null)}>Dismiss</button></div>
          </div>
        )}

        {/* Audit Log Table */}
        <div className="card">
          <div className="card-body" style={{ padding: 0 }}>
            {loading ? (
              <div style={{ textAlign: "center", padding: 48, color: "#6c757d" }}>
                Loading audit log...
              </div>
            ) : logs.length === 0 ? (
              <div style={{ textAlign: "center", padding: 48, color: "#6c757d" }}>
                No audit log entries found. Try adjusting your filters.
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Date/Time</th>
                      <th>Actor</th>
                      <th>Role</th>
                      <th>Action</th>
                      <th>Entity</th>
                      <th>Entity ID</th>
                      <th>Details</th>
                      <th>Snapshot</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => {
                      const date = new Date(log.occurredAt);
                      return (
                        <tr key={log.id}>
                          <td style={{ fontSize: 12, color: "#6c757d" }}>{log.id}</td>
                          <td style={{ fontSize: 12 }}>
                            <div>{dateLabel(date.toISOString().split('T')[0])}</div>
                            <div style={{ color: "#6c757d" }}>{date.toTimeString().split(' ')[0]}</div>
                          </td>
                          <td>{log.actor}</td>
                          <td>
                            <span style={{
                              padding: "2px 8px",
                              borderRadius: 4,
                              fontSize: 11,
                              fontWeight: 600,
                              backgroundColor: log.role === 'admin' ? '#e3f2fd' : log.role === 'customer' ? '#fff3e0' : '#f1f3f5',
                              color: log.role === 'admin' ? '#1976d2' : log.role === 'customer' ? '#f57c00' : '#495057',
                            }}>
                              {log.role}
                            </span>
                          </td>
                          <td style={{ fontFamily: "monospace", fontSize: 11 }}>{log.action}</td>
                          <td>{log.entity}</td>
                          <td style={{ fontFamily: "monospace", fontSize: 12 }}>{log.entityId}</td>
                          <td style={{ fontSize: 12, maxWidth: 300 }}>
                            <details>
                              <summary style={{ cursor: "pointer", color: "#007bff" }}>View</summary>
                              <pre style={{ 
                                marginTop: 8, 
                                fontSize: 11, 
                                padding: 8, 
                                backgroundColor: "#f8f9fa",
                                borderRadius: 4,
                                overflow: "auto",
                                maxHeight: 200
                              }}>
                                {JSON.stringify(log.details, null, 2)}
                              </pre>
                            </details>
                          </td>
                          <td style={{ fontSize: 12, color: "#6c757d" }}>
                            {log.snapshotId ? (
                              <span title={`${log.snapshotType} snapshot #${log.snapshotId}`}>
                                {log.snapshotType} #{log.snapshotId}
                              </span>
                            ) : (
                              <span>—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {logs.length > 0 && (
          <div style={{ marginTop: 12, textAlign: "center", color: "#6c757d", fontSize: 13 }}>
            Showing {logs.length} entries (limited to 1,000 most recent)
          </div>
        )}
      </div>
    </div>
  );
}
