import { useEffect, useState } from "react";
import type { CallOrderSnapshot, StaffSnapshot, Role } from "../../shared/types.ts";
import { getAccessToken } from "../api.ts";
import { dateLabel } from "../lib/format.ts";

interface RecentChange {
  snapshot: CallOrderSnapshot | StaffSnapshot;
  type: 'financial' | 'staff';
}

export function RecentChangesWidget({ 
  userRole 
}: { 
  userRole: Role;
}) {
  const [changes, setChanges] = useState<RecentChange[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const showUserInfo = userRole !== 'customer';

  useEffect(() => {
    loadRecentChanges();
  }, []);

  const loadRecentChanges = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = getAccessToken();
      const response = await fetch(`/api/audit/recent-changes?limit=20`, {
        headers: {
          'Authorization': `Bearer ${token || ''}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to load recent changes: ${response.statusText}`);
      }

      const data = await response.json();
      setChanges(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const getDescription = (change: RecentChange): string => {
    if (change.type === 'financial') {
      const snapshot = change.snapshot as CallOrderSnapshot;
      return `${snapshot.callOrderId}: ${snapshot.changedFields?.join(', ') || 'Financial update'}`;
    } else {
      const snapshot = change.snapshot as StaffSnapshot;
      let action = 'updated';
      if (snapshot.changeType === 'add') action = 'added';
      else if (snapshot.changeType === 'delete') action = 'removed';
      return `${snapshot.callOrderId}: Staff ${action}`;
    }
  };

  const getIcon = (change: RecentChange): string => {
    return change.type === 'financial' ? '💰' : '👥';
  };

  const getTimeAgo = (timestamp: string): string => {
    const now = new Date();
    const then = new Date(timestamp);
    const diffMs = now.getTime() - then.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'yesterday';
    return `${diffDays}d ago`;
  };

  if (loading) {
    return (
      <div className="card">
        <div className="card-body">
          <h3 style={{ marginBottom: 12 }}>Recent Changes</h3>
          <div style={{ textAlign: "center", color: "#6c757d", padding: 24 }}>Loading...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card">
        <div className="card-body">
          <h3 style={{ marginBottom: 12 }}>Recent Changes</h3>
          <div className="notice error">
            <div><span>{error}</span></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-body">
        <h3 style={{ marginBottom: 12 }}>Recent Changes</h3>
        
        {changes.length === 0 ? (
          <div style={{ textAlign: "center", color: "#6c757d", padding: 24 }}>
            No recent changes
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
            {changes.map((change, idx) => {
              const snapshot = change.snapshot;
              const isFinancial = change.type === 'financial';
              const userName = showUserInfo 
                ? (isFinancial 
                    ? (snapshot as CallOrderSnapshot).createdByUserName 
                    : (snapshot as StaffSnapshot).createdByUserName)
                : undefined;

              return (
                <div
                  key={`${change.type}-${snapshot.id}`}
                  style={{
                    padding: "10px 12px",
                    borderBottom: idx < changes.length - 1 ? "1px solid #e9ecef" : "none",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    fontSize: 13,
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                      <span>{getIcon(change)}</span>
                      <span style={{ fontWeight: 500, color: "#212529" }}>
                        {getDescription(change)}
                      </span>
                    </div>
                    
                    {showUserInfo && userName && (
                      <div style={{ color: "#6c757d", fontSize: 12, marginLeft: 22 }}>
                        by {userName}
                      </div>
                    )}
                  </div>
                  
                  <div style={{ color: "#868e96", fontSize: 12, whiteSpace: "nowrap", marginLeft: 12 }}>
                    {getTimeAgo(snapshot.snapshotTime)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
