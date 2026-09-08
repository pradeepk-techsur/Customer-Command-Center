import { useEffect, useState } from "react";
import { api } from "../api.ts";
import { Eyebrow } from "./ui.tsx";

interface CustomerWeeklyReport {
  id: number;
  weekEnding: string;
  weekLabel: string;
  status: string;
  customerVisible: boolean;
  customerReleasedAt: string | null;
  reports: Array<{
    id: number;
    callOrderId: string;
    callOrderName: string;
    weekLabel: string;
    submittedBy: string;
    submittedAt: string | null;
    groups?: Array<{ label: string; items: string[] }>;
  }>;
}

export function CustomerWeeklyReports() {
  const [weeklyReports, setWeeklyReports] = useState<CustomerWeeklyReport[]>([]);
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedCallOrders, setExpandedCallOrders] = useState<Set<number>>(new Set());

  useEffect(() => {
    loadWeeklyReports();
  }, []);

  const loadWeeklyReports = async () => {
    try {
      setLoading(true);
      const data = await api.getCustomerWeeklyReports();
      
      // Load detailed report data for each report
      const snapshot = await api.snapshot();
      const enrichedReports = data.weeklyReports.map((weekReport: CustomerWeeklyReport) => ({
        ...weekReport,
        reports: weekReport.reports.map(report => {
          const callOrder = snapshot.callOrders.find(co => co.id === report.callOrderId);
          const fullReport = callOrder?.weeklyReports.find(r => r.id === report.id);
          return {
            ...report,
            groups: fullReport?.groups || []
          };
        })
      }));
      
      setWeeklyReports(enrichedReports);
      // Auto-select first week if available
      if (enrichedReports.length > 0) {
        setSelectedWeek(enrichedReports[0].id);
      }
      setLoading(false);
    } catch (err: any) {
      setError("Failed to load weekly reports: " + err.message);
      setLoading(false);
    }
  };

  const toggleCallOrder = (reportId: number) => {
    setExpandedCallOrders(prev => {
      const next = new Set(prev);
      if (next.has(reportId)) {
        next.delete(reportId);
      } else {
        next.add(reportId);
      }
      return next;
    });
  };

  if (loading) {
    return (
      <div className="page">
        <div className="card">
          <div className="card-empty">Loading weekly reports...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page">
        <div className="card">
          <div className="card-empty" style={{ color: '#c62828' }}>{error}</div>
        </div>
      </div>
    );
  }

  if (weeklyReports.length === 0) {
    return (
      <div className="page">
        <div className="page-head">
          <div>
            <h1 className="page-title">Weekly Status Reports</h1>
            <p className="page-subtitle">View weekly status reports submitted by the program office</p>
          </div>
        </div>
        <div className="card">
          <div className="card-empty">No weekly reports have been submitted yet.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Weekly Status Reports</h1>
          <p className="page-subtitle">View weekly status reports submitted by the program office</p>
        </div>
      </div>

      {/* Week selector dropdown */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
          <label style={{ fontSize: 14, fontWeight: 500, color: '#333' }}>Week Ending:</label>
          <select 
            value={selectedWeek || ''} 
            onChange={(e) => setSelectedWeek(Number(e.target.value))}
            style={{ padding: '8px 12px', fontSize: 14, border: '1px solid #ddd', borderRadius: 4, minWidth: 200 }}
          >
            {weeklyReports.map(wr => (
              <option key={wr.id} value={wr.id}>
                {wr.weekLabel} ({wr.reports.length} report{wr.reports.length !== 1 ? 's' : ''})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Consolidated report view for selected week */}
      {selectedWeek && (() => {
        const weekReport = weeklyReports.find(wr => wr.id === selectedWeek);
        if (!weekReport) return null;

        return (
          <div className="card">
            <div className="card-head">
              <div>
                <div className="card-title">Weekly Status Report — {weekReport.weekLabel}</div>
                <div className="card-subtitle">{weekReport.reports.length} call order report{weekReport.reports.length !== 1 ? 's' : ''} submitted</div>
              </div>
            </div>

            {weekReport.reports.map((report, idx) => (
              <div key={report.id} style={{ borderTop: idx > 0 ? '1px solid #e0e0e0' : 'none' }}>
                <div 
                  style={{ 
                    padding: '16px 20px',
                    cursor: 'pointer',
                    backgroundColor: expandedCallOrders.has(report.id) ? '#fafafa' : 'white',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                  onClick={() => toggleCallOrder(report.id)}
                >
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: '#1a1a1a', marginBottom: 4 }}>
                      {report.callOrderName}
                    </div>
                    <div style={{ fontSize: 13, color: '#666' }}>
                      Submitted by {report.submittedBy}
                      {report.submittedAt && ` on ${new Date(report.submittedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
                    </div>
                  </div>
                  <div style={{ 
                    fontSize: 18, 
                    color: '#666',
                    transform: expandedCallOrders.has(report.id) ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.2s'
                  }}>
                    ▼
                  </div>
                </div>

                {expandedCallOrders.has(report.id) && report.groups && report.groups.length > 0 && (
                  <div style={{ padding: '0 20px 20px 20px', backgroundColor: '#fafafa' }}>
                    {report.groups.map((g, gIdx) => (
                      <div key={gIdx} style={{ marginTop: gIdx > 0 ? 20 : 0 }}>
                        <Eyebrow>{g.label}</Eyebrow>
                        <ul className="report-list">
                          {g.items.map((item, i) => (
                            <li key={i}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}

                {expandedCallOrders.has(report.id) && (!report.groups || report.groups.length === 0) && (
                  <div style={{ padding: '0 20px 20px 20px', backgroundColor: '#fafafa' }}>
                    <div style={{ fontSize: 13, color: '#999', fontStyle: 'italic' }}>
                      No report details available
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        );
      })()}
    </div>
  );
}
