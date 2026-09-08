import { useEffect, useState } from "react";
import type { ConsolidatedWeeklyReport, CallOrderWeeklyReportStatus, WEEKLY_SECTIONS } from "../../shared/types.ts";
import { api } from "../api.ts";
import { Button, Field, TextArea, TextInput, showToast, showConfirm } from "./ui.tsx";
import type { Mutate } from "../App.tsx";

interface WeeklyReportDetail {
  id: number;
  callOrderId: string;
  callOrderName: string;
  weekEnding: string;
  weekLabel: string;
  submittedBy: string;
  statusV2: string;
  groups: { label: string; items: string[] }[];
}

interface ReportForm {
  weekEnding: string;
  submittedBy: string;
  accomplishments: string;
  planned: string;
  risks: string;
  issues: string;
  actions: string;
}

interface Week {
  value: string;  // YYYY-MM-DD
  label: string;  // "Sep 8, 2026"
}

export function ProgramManagerWeeklyReports({ mutate }: { mutate: Mutate }) {
  const [weeks, setWeeks] = useState<Week[]>([]);
  const [selectedWeek, setSelectedWeek] = useState<string>("");
  const [consolidatedReport, setConsolidatedReport] = useState<ConsolidatedWeeklyReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Accordion state - start with submitted expanded, missing collapsed
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['submitted']));
  
  // Edit modal state (for individual report editing)
  const [editingReport, setEditingReport] = useState<WeeklyReportDetail | null>(null);
  const [reportForm, setReportForm] = useState<ReportForm>({
    weekEnding: "",
    submittedBy: "",
    accomplishments: "",
    planned: "",
    risks: "",
    issues: "",
    actions: "",
  });
  const [saving, setSaving] = useState(false);
  
  // Consolidated document state
  const [consolidatedDoc, setConsolidatedDoc] = useState<{ [callOrderId: string]: WeeklyReportDetail }>({});
  const [loadingDoc, setLoadingDoc] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [docForm, setDocForm] = useState<{ [callOrderId: string]: ReportForm }>({});

  // Load available weeks on mount
  useEffect(() => {
    api.getWeeks()
      .then(data => {
        setWeeks(data.weeks);
        if (data.weeks.length > 0) {
          setSelectedWeek(data.weeks[0].value); // Select most recent week
        }
      })
      .catch(err => setError("Failed to load weeks: " + err.message));
  }, []);

  // Load consolidated report when week changes
  useEffect(() => {
    if (!selectedWeek) return;
    
    setLoading(true);
    setError(null);
    
    api.getConsolidatedWeeklyReport(selectedWeek)
      .then(report => {
        setConsolidatedReport(report);
        setLoading(false);
        // Load detailed reports for consolidated document view
        loadConsolidatedDocument(report);
      })
      .catch(err => {
        setError("Failed to load report: " + err.message);
        setLoading(false);
      });
  }, [selectedWeek]);
  
  // Load all detailed reports for consolidated document view
  const loadConsolidatedDocument = async (report: ConsolidatedWeeklyReport) => {
    setLoadingDoc(true);
    const docs: { [callOrderId: string]: WeeklyReportDetail } = {};
    const forms: { [callOrderId: string]: ReportForm } = {};
    
    for (const coReport of report.callOrderReports) {
      if (coReport.hasReport && coReport.reportId) {
        try {
          const detail = await api.getWeeklyReport(coReport.callOrderId, coReport.reportId);
          docs[coReport.callOrderId] = {
            ...detail,
            callOrderName: coReport.callOrderName,
          };
          
          // Initialize form data
          const accomplishments = detail.groups.find((g: any) => g.label === "Accomplishments")?.items.join("\n") || "";
          const planned = detail.groups.find((g: any) => g.label === "Planned activities")?.items.join("\n") || "";
          const risks = detail.groups.find((g: any) => g.label === "Risks")?.items.join("\n") || "";
          const issues = detail.groups.find((g: any) => g.label === "Issues")?.items.join("\n") || "";
          const actions = detail.groups.find((g: any) => g.label === "Customer actions")?.items.join("\n") || "";
          
          forms[coReport.callOrderId] = {
            weekEnding: detail.weekLabel,
            submittedBy: detail.submittedBy,
            accomplishments,
            planned,
            risks,
            issues,
            actions,
          };
        } catch (err) {
          // Silently skip reports that fail to load
        }
      }
    }
    
    setConsolidatedDoc(docs);
    setDocForm(forms);
    setLoadingDoc(false);
  };

  const handleSubmitToCustomer = async () => {
    if (!selectedWeek || !consolidatedReport) return;
    
    // Check if all call orders have reports
    const missingReports = consolidatedReport.callOrderReports.filter(r => !r.hasReport);
    
    if (missingReports.length > 0) {
      const confirmMessage = `${missingReports.length} call order(s) are missing reports:\n\n` +
        missingReports.map(r => `• ${r.callOrderName} (PM: ${r.pm})`).join('\n') +
        `\n\nDo you want to submit anyway?`;
      
      const confirmed = await showConfirm(
        "Missing Reports",
        confirmMessage
      );
      
      if (!confirmed) {
        return;
      }
    }

    try {
      await mutate(() => api.submitConsolidatedWeeklyReport(selectedWeek));
      
      // Reload report to get updated status
      const updatedReport = await api.getConsolidatedWeeklyReport(selectedWeek);
      setConsolidatedReport(updatedReport);
      
      showToast("Weekly report has been submitted to customers!", "success");
    } catch (err: any) {
      setError("Failed to submit report: " + err.message);
    }
  };

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case 'draft': return '#f57c00';
      case 'submitted': return '#2e7d32';
      case 'uploaded': return '#1976d2';
      default: return '#757575';
    }
  };

  const getStatusLabel = (status: string | null) => {
    if (!status) return 'Missing';
    return status.charAt(0).toUpperCase() + status.slice(1);
  };
  
  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };;
  
  const handleViewReport = async (callOrderId: string, reportId: number, callOrderName: string) => {
    try {
      const report = await api.getWeeklyReport(callOrderId, reportId);
      
      // Convert groups to form fields
      const accomplishments = report.groups.find((g: any) => g.label === "Accomplishments")?.items.join("\n") || "";
      const planned = report.groups.find((g: any) => g.label === "Planned activities")?.items.join("\n") || "";
      const risks = report.groups.find((g: any) => g.label === "Risks")?.items.join("\n") || "";
      const issues = report.groups.find((g: any) => g.label === "Issues")?.items.join("\n") || "";
      const actions = report.groups.find((g: any) => g.label === "Customer actions")?.items.join("\n") || "";
      
      setEditingReport({ ...report, callOrderName });
      setReportForm({
        weekEnding: report.weekLabel,
        submittedBy: report.submittedBy,
        accomplishments,
        planned,
        risks,
        issues,
        actions,
      });
    } catch (err: any) {
      setError("Failed to load report: " + err.message);
    }
  };
  
  const handleCloseEdit = () => {
    setEditingReport(null);
    setReportForm({
      weekEnding: "",
      submittedBy: "",
      accomplishments: "",
      planned: "",
      risks: "",
      issues: "",
      actions: "",
    });
  };
  
  const handleSaveReport = async () => {
    if (!editingReport) return;
    
    setSaving(true);
    setError(null);
    
    try {
      await mutate(() => api.updateWeeklyReport(editingReport.callOrderId, editingReport.id, reportForm));
      
      // Reload consolidated report
      const updatedReport = await api.getConsolidatedWeeklyReport(selectedWeek);
      setConsolidatedReport(updatedReport);
      
      handleCloseEdit();
      showToast("Report saved successfully!", "success");
    } catch (err: any) {
      setError("Failed to save report: " + err.message);
    } finally {
      setSaving(false);
    }
  };
  
  const handleSaveConsolidatedDoc = async () => {
    if (!consolidatedReport) return;
    
    setSaving(true);
    setError(null);
    
    try {
      // Save each modified report
      for (const callOrderId of Object.keys(docForm)) {
        const doc = consolidatedDoc[callOrderId];
        if (doc) {
          await mutate(() => api.updateWeeklyReport(callOrderId, doc.id, docForm[callOrderId]));
        }
      }
      
      // Reload consolidated report
      const updatedReport = await api.getConsolidatedWeeklyReport(selectedWeek);
      setConsolidatedReport(updatedReport);
      await loadConsolidatedDocument(updatedReport);
      
      setEditMode(false);
      showToast("All reports saved successfully!", "success");
    } catch (err: any) {
      setError("Failed to save reports: " + err.message);
    } finally {
      setSaving(false);
    }
  };
  
  const handleExportPDF = async () => {
    if (!selectedWeek || !consolidatedReport) return;
    window.print();
  };
  
  const handleExportDOCX = async () => {
    if (!selectedWeek || !consolidatedReport) return;
    try {
      // Create a simple text-based export for now
      let content = `Weekly Status Report\n`;
      content += `Week Ending: ${consolidatedReport.weekLabel}\n`;
      content += `Generated: ${new Date().toLocaleDateString()}\n\n`;
      content += `=`.repeat(80) + `\n\n`;
      
      for (const callOrderId of Object.keys(consolidatedDoc).sort()) {
        const doc = consolidatedDoc[callOrderId];
        if (!doc) continue;
        
        content += `${doc.callOrderName}\n`;
        content += `Submitted by: ${doc.submittedBy}\n`;
        content += `-`.repeat(80) + `\n\n`;
        
        for (const group of doc.groups) {
          content += `${group.label}:\n`;
          for (const item of group.items) {
            content += `  • ${item}\n`;
          }
          content += `\n`;
        }
        
        content += `\n`;
      }
      
      // Download as text file (DOCX generation requires server-side library)
      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Weekly_Report_${consolidatedReport.weekLabel.replace(/[^a-zA-Z0-9]/g, '_')}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError("Failed to export: " + err.message);
    }
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Weekly Status Reports</h1>
          <p className="page-subtitle">
            Consolidate and review weekly reports from all Project Managers. Submit the final report to customers.
          </p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-body">
          <div style={{ display: "flex", gap: 24, alignItems: "flex-end" }}>
            <Field label="Week Ending (Sunday)" style={{ flex: 1, maxWidth: 300 }}>
              <select 
                value={selectedWeek} 
                onChange={(e) => setSelectedWeek(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  fontSize: 14,
                  border: '1px solid #ddd',
                  borderRadius: 4,
                  backgroundColor: 'white',
                }}
              >
                {weeks.map(week => (
                  <option key={week.value} value={week.value}>
                    {week.label}
                  </option>
                ))}
              </select>
            </Field>
            
            {consolidatedReport && consolidatedReport.status === 'draft' && (
              <Button primary onClick={handleSubmitToCustomer}>
                Submit to Customer
              </Button>
            )}
            
            {consolidatedReport && consolidatedReport.customerVisible && (
              <div style={{ 
                padding: '8px 16px', 
                backgroundColor: '#e8f5e9', 
                color: '#2e7d32',
                borderRadius: 4,
                fontWeight: 500,
                fontSize: 14,
              }}>
                ✓ Submitted to Customers
              </div>
            )}
          </div>

          {error && (
            <div style={{ 
              marginTop: 16, 
              padding: 12, 
              backgroundColor: '#ffebee', 
              color: '#c62828', 
              borderRadius: 4 
            }}>
              {error}
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="card">
          <div className="card-empty">Loading report data...</div>
        </div>
      ) : consolidatedReport ? (
        <>
          {/* Summary Statistics Card */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-body" style={{ padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                {/* Progress Circle */}
                <div style={{ position: 'relative', width: 80, height: 80, flexShrink: 0 }}>
                  <svg width="80" height="80" style={{ transform: 'rotate(-90deg)' }}>
                    <circle
                      cx="40"
                      cy="40"
                      r="32"
                      fill="none"
                      stroke="#e0e0e0"
                      strokeWidth="8"
                    />
                    <circle
                      cx="40"
                      cy="40"
                      r="32"
                      fill="none"
                      stroke={consolidatedReport.callOrderReports.filter(r => !r.hasReport).length > 0 ? '#ff9800' : '#4caf50'}
                      strokeWidth="8"
                      strokeDasharray={`${2 * Math.PI * 32 * (consolidatedReport.callOrderReports.filter(r => r.hasReport).length / consolidatedReport.callOrderReports.length)} ${2 * Math.PI * 32}`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div style={{ 
                    position: 'absolute', 
                    top: 0, 
                    left: 0, 
                    width: '100%', 
                    height: '100%', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    fontSize: 18,
                    fontWeight: 700,
                    color: consolidatedReport.callOrderReports.filter(r => !r.hasReport).length > 0 ? '#ff9800' : '#4caf50',
                  }}>
                    {Math.round((consolidatedReport.callOrderReports.filter(r => r.hasReport).length / consolidatedReport.callOrderReports.length) * 100)}%
                  </div>
                </div>
                
                {/* Stats */}
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 24, fontWeight: 600, marginBottom: 4 }}>
                    {consolidatedReport.callOrderReports.filter(r => r.hasReport).length} of {consolidatedReport.callOrderReports.length} Reports Submitted
                  </div>
                  <div style={{ fontSize: 14, color: '#666' }}>
                    Week ending {consolidatedReport.weekLabel}
                  </div>
                  {consolidatedReport.callOrderReports.filter(r => !r.hasReport).length > 0 && (
                    <div style={{ 
                      marginTop: 8, 
                      padding: '6px 12px', 
                      backgroundColor: '#fff3e0', 
                      color: '#e65100',
                      borderRadius: 4,
                      display: 'inline-block',
                      fontSize: 13,
                      fontWeight: 500,
                    }}>
                      ⚠️ {consolidatedReport.callOrderReports.filter(r => !r.hasReport).length} missing report{consolidatedReport.callOrderReports.filter(r => !r.hasReport).length !== 1 ? 's' : ''}
                    </div>
                  )}
                  {consolidatedReport.callOrderReports.filter(r => !r.hasReport).length === 0 && (
                    <div style={{ 
                      marginTop: 8, 
                      padding: '6px 12px', 
                      backgroundColor: '#e8f5e9', 
                      color: '#2e7d32',
                      borderRadius: 4,
                      display: 'inline-block',
                      fontSize: 13,
                      fontWeight: 500,
                    }}>
                      ✓ All reports submitted
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
          
          {/* Accordion Sections */}
          <div className="card">
            {/* Submitted Reports Section */}
            {consolidatedReport.callOrderReports.filter(r => r.hasReport).length > 0 && (
              <>
                <div 
                  onClick={() => toggleSection('submitted')}
                  style={{
                    padding: '16px 20px',
                    backgroundColor: '#f5f5f5',
                    borderBottom: '1px solid #ddd',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    userSelect: 'none',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 18, color: '#666', transition: 'transform 0.2s', transform: expandedSections.has('submitted') ? 'rotate(90deg)' : 'rotate(0deg)' }}>
                      ▶
                    </span>
                    <span style={{ fontSize: 16, fontWeight: 600, color: '#2e7d32' }}>
                      ✓ Submitted Reports
                    </span>
                    <span style={{ 
                      fontSize: 13, 
                      color: '#666',
                      backgroundColor: '#e8f5e9',
                      padding: '2px 10px',
                      borderRadius: 12,
                      fontWeight: 500,
                    }}>
                      {consolidatedReport.callOrderReports.filter(r => r.hasReport).length}
                    </span>
                  </div>
                </div>
                
                {expandedSections.has('submitted') && (
                  <div style={{ padding: 0 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ 
                          backgroundColor: '#fafafa', 
                          borderBottom: '1px solid #eee',
                          textAlign: 'left',
                        }}>
                          <th style={{ padding: '10px 20px', fontWeight: 600, fontSize: 12, color: '#666' }}>Call Order</th>
                          <th style={{ padding: '10px 20px', fontWeight: 600, fontSize: 12, color: '#666' }}>PM</th>
                          <th style={{ padding: '10px 20px', fontWeight: 600, fontSize: 12, color: '#666' }}>Submitted By</th>
                          <th style={{ padding: '10px 20px', fontWeight: 600, fontSize: 12, color: '#666' }}>Date</th>
                          <th style={{ padding: '10px 20px', fontWeight: 600, fontSize: 12, color: '#666' }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {consolidatedReport.callOrderReports
                          .filter(r => r.hasReport)
                          .map((report) => (
                            <tr 
                              key={report.callOrderId}
                              style={{
                                borderBottom: '1px solid #f0f0f0',
                                backgroundColor: 'white',
                              }}
                            >
                              <td style={{ padding: '10px 20px', fontSize: 14, fontWeight: 500 }}>
                                {report.callOrderName}
                              </td>
                              <td style={{ padding: '10px 20px', fontSize: 13, color: '#666' }}>
                                {report.pm}
                              </td>
                              <td style={{ padding: '10px 20px', fontSize: 13, color: '#666' }}>
                                {report.submittedBy || '—'}
                              </td>
                              <td style={{ padding: '10px 20px', fontSize: 13, color: '#666' }}>
                                {report.submittedAt 
                                  ? new Date(report.submittedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                                  : '—'}
                              </td>
                              <td style={{ padding: '10px 20px' }}>
                                {report.reportId && (
                                  <button
                                    onClick={() => handleViewReport(report.callOrderId, report.reportId!, report.callOrderName)}
                                    style={{ 
                                      background: 'none',
                                      border: 'none',
                                      color: '#1976d2', 
                                      cursor: 'pointer',
                                      fontSize: 13,
                                      fontWeight: 500,
                                      padding: 0,
                                    }}
                                  >
                                    View →
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
            
            {/* Missing Reports Section */}
            {consolidatedReport.callOrderReports.filter(r => !r.hasReport).length > 0 && (
              <>
                <div 
                  onClick={() => toggleSection('missing')}
                  style={{
                    padding: '16px 20px',
                    backgroundColor: '#fff8f0',
                    borderBottom: '1px solid #ffe0b2',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    userSelect: 'none',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 18, color: '#666', transition: 'transform 0.2s', transform: expandedSections.has('missing') ? 'rotate(90deg)' : 'rotate(0deg)' }}>
                      ▶
                    </span>
                    <span style={{ fontSize: 16, fontWeight: 600, color: '#e65100' }}>
                      ⚠️ Missing Reports
                    </span>
                    <span style={{ 
                      fontSize: 13, 
                      color: '#e65100',
                      backgroundColor: '#fff3e0',
                      padding: '2px 10px',
                      borderRadius: 12,
                      fontWeight: 600,
                    }}>
                      {consolidatedReport.callOrderReports.filter(r => !r.hasReport).length}
                    </span>
                  </div>
                  <span style={{ fontSize: 12, color: '#666', fontStyle: 'italic' }}>
                    Click to expand
                  </span>
                </div>
                
                {expandedSections.has('missing') && (
                  <div style={{ padding: 0 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ 
                          backgroundColor: '#fffbf5', 
                          borderBottom: '1px solid #ffe0b2',
                          textAlign: 'left',
                        }}>
                          <th style={{ padding: '10px 20px', fontWeight: 600, fontSize: 12, color: '#666' }}>Call Order</th>
                          <th style={{ padding: '10px 20px', fontWeight: 600, fontSize: 12, color: '#666' }}>Project Manager</th>
                          <th style={{ padding: '10px 20px', fontWeight: 600, fontSize: 12, color: '#666' }}>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {consolidatedReport.callOrderReports
                          .filter(r => !r.hasReport)
                          .map((report) => (
                            <tr 
                              key={report.callOrderId}
                              style={{
                                borderBottom: '1px solid #fff3e0',
                                backgroundColor: '#fffdf8',
                              }}
                            >
                              <td style={{ padding: '10px 20px', fontSize: 14, fontWeight: 500 }}>
                                {report.callOrderName}
                              </td>
                              <td style={{ padding: '10px 20px', fontSize: 13, color: '#666' }}>
                                {report.pm}
                              </td>
                              <td style={{ padding: '10px 20px' }}>
                                <span style={{
                                  display: 'inline-block',
                                  padding: '4px 12px',
                                  borderRadius: 12,
                                  fontSize: 12,
                                  fontWeight: 600,
                                  backgroundColor: '#ffebee',
                                  color: '#c62828',
                                }}>
                                  Not submitted
                                </span>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>
        </>
      ) : (
        <div className="card">
          <div className="card-empty">Select a week to view reports</div>
        </div>
      )}
      
      {/* Consolidated Document View */}
      {consolidatedReport && Object.keys(consolidatedDoc).length > 0 && (
        <div className="card" style={{ marginTop: 24 }}>
          <div className="card-head">
            <div className="card-title">Consolidated Weekly Status Report</div>
            <div className="card-actions" style={{ display: 'flex', gap: 12 }}>
              {editMode ? (
                <>
                  <Button onClick={() => setEditMode(false)} disabled={saving}>
                    Cancel
                  </Button>
                  <Button primary onClick={handleSaveConsolidatedDoc} disabled={saving}>
                    {saving ? 'Saving...' : 'Save All Changes'}
                  </Button>
                </>
              ) : (
                <>
                  <Button onClick={handleExportDOCX}>
                    Export as Text
                  </Button>
                  <Button onClick={handleExportPDF}>
                    Print/PDF
                  </Button>
                  <Button primary onClick={() => setEditMode(true)}>
                    Edit Document
                  </Button>
                </>
              )}
            </div>
          </div>
          
          <div className="card-body" style={{ padding: 24, backgroundColor: '#fafafa' }}>
            <div style={{ 
              backgroundColor: 'white', 
              padding: 32,
              minHeight: 400,
              border: '1px solid #ddd',
              borderRadius: 4,
            }}>
              <div style={{ marginBottom: 32 }}>
                <h2 style={{ margin: 0, fontSize: 24, fontWeight: 600 }}>
                  Weekly Status Report
                </h2>
                <p style={{ margin: '8px 0 0', fontSize: 14, color: '#666' }}>
                  Week Ending: {consolidatedReport.weekLabel}
                </p>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: '#999' }}>
                  Generated: {new Date().toLocaleDateString()}
                </p>
              </div>
              
              {loadingDoc ? (
                <div style={{ textAlign: 'center', padding: 40, color: '#666' }}>
                  Loading reports...
                </div>
              ) : (
                Object.keys(consolidatedDoc).sort().map((callOrderId) => {
                  const doc = consolidatedDoc[callOrderId];
                  const form = docForm[callOrderId];
                  if (!doc || !form) return null;
                  
                  return (
                    <div key={callOrderId} style={{ marginBottom: 40 }}>
                      <div style={{ 
                        borderBottom: '2px solid #333', 
                        marginBottom: 16,
                        paddingBottom: 8,
                      }}>
                        <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>
                          {doc.callOrderName}
                        </h3>
                        <p style={{ margin: '4px 0 0', fontSize: 13, color: '#666' }}>
                          Submitted by: {doc.submittedBy}
                        </p>
                      </div>
                      
                      {editMode ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                          <div>
                            <label style={{ display: 'block', fontWeight: 600, marginBottom: 8, fontSize: 14 }}>
                              Accomplishments
                            </label>
                            <TextArea
                              rows={5}
                              value={form.accomplishments}
                              onChange={(val) => setDocForm({ 
                                ...docForm, 
                                [callOrderId]: { ...form, accomplishments: val }
                              })}
                              style={{ width: '100%' }}
                            />
                          </div>
                          
                          <div>
                            <label style={{ display: 'block', fontWeight: 600, marginBottom: 8, fontSize: 14 }}>
                              Planned Activities
                            </label>
                            <TextArea
                              rows={5}
                              value={form.planned}
                              onChange={(val) => setDocForm({ 
                                ...docForm, 
                                [callOrderId]: { ...form, planned: val }
                              })}
                              style={{ width: '100%' }}
                            />
                          </div>
                          
                          <div>
                            <label style={{ display: 'block', fontWeight: 600, marginBottom: 8, fontSize: 14 }}>
                              Risks
                            </label>
                            <TextArea
                              rows={3}
                              value={form.risks}
                              onChange={(val) => setDocForm({ 
                                ...docForm, 
                                [callOrderId]: { ...form, risks: val }
                              })}
                              style={{ width: '100%' }}
                            />
                          </div>
                          
                          <div>
                            <label style={{ display: 'block', fontWeight: 600, marginBottom: 8, fontSize: 14 }}>
                              Issues
                            </label>
                            <TextArea
                              rows={3}
                              value={form.issues}
                              onChange={(val) => setDocForm({ 
                                ...docForm, 
                                [callOrderId]: { ...form, issues: val }
                              })}
                              style={{ width: '100%' }}
                            />
                          </div>
                          
                          <div>
                            <label style={{ display: 'block', fontWeight: 600, marginBottom: 8, fontSize: 14 }}>
                              Customer Actions
                            </label>
                            <TextArea
                              rows={3}
                              value={form.actions}
                              onChange={(val) => setDocForm({ 
                                ...docForm, 
                                [callOrderId]: { ...form, actions: val }
                              })}
                              style={{ width: '100%' }}
                            />
                          </div>
                        </div>
                      ) : (
                        <>
                          {doc.groups.map((group, idx) => (
                            <div key={idx} style={{ marginBottom: 20 }}>
                              <h4 style={{ margin: '0 0 8px 0', fontSize: 15, fontWeight: 600, color: '#333' }}>
                                {group.label}
                              </h4>
                              <ul style={{ margin: 0, paddingLeft: 24 }}>
                                {group.items.map((item, itemIdx) => (
                                  <li key={itemIdx} style={{ marginBottom: 4, fontSize: 14, lineHeight: 1.6 }}>
                                    {item}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ))}
                        </>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Edit Report Modal */}
      {editingReport && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: 8,
            maxWidth: 800,
            width: '90%',
            maxHeight: '90vh',
            overflow: 'auto',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
          }}>
            <div style={{
              padding: '24px',
              borderBottom: '1px solid #ddd',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>
                  Edit Weekly Report
                </h2>
                <p style={{ margin: '8px 0 0', fontSize: 14, color: '#666' }}>
                  {editingReport.callOrderName} — {editingReport.weekLabel}
                </p>
              </div>
              <button
                onClick={handleCloseEdit}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: 24,
                  color: '#999',
                  cursor: 'pointer',
                  padding: 0,
                  width: 32,
                  height: 32,
                }}
              >
                ×
              </button>
            </div>
            
            <div style={{ padding: 24 }}>
              <Field label="Week Ending">
                <TextInput 
                  value={reportForm.weekEnding} 
                  disabled={true}
                />
              </Field>
              
              <Field label="Submitted By">
                <TextInput 
                  value={reportForm.submittedBy} 
                  onChange={(val) => setReportForm({ ...reportForm, submittedBy: val })}
                />
              </Field>
              
              <Field label="Accomplishments — one per line">
                <TextArea 
                  rows={5} 
                  value={reportForm.accomplishments} 
                  onChange={(val) => setReportForm({ ...reportForm, accomplishments: val })}
                />
              </Field>
              
              <Field label="Planned activities — one per line">
                <TextArea 
                  rows={5} 
                  value={reportForm.planned} 
                  onChange={(val) => setReportForm({ ...reportForm, planned: val })}
                />
              </Field>
              
              <Field label="Risks">
                <TextArea 
                  rows={3} 
                  value={reportForm.risks} 
                  onChange={(val) => setReportForm({ ...reportForm, risks: val })}
                />
              </Field>
              
              <Field label="Issues">
                <TextArea 
                  rows={3} 
                  value={reportForm.issues} 
                  onChange={(val) => setReportForm({ ...reportForm, issues: val })}
                />
              </Field>
              
              <Field label="Customer actions">
                <TextArea 
                  rows={3} 
                  value={reportForm.actions} 
                  onChange={(val) => setReportForm({ ...reportForm, actions: val })}
                />
              </Field>
              
              {error && (
                <div style={{
                  marginTop: 16,
                  padding: 12,
                  backgroundColor: '#ffebee',
                  color: '#c62828',
                  borderRadius: 4,
                  fontSize: 14,
                }}>
                  {error}
                </div>
              )}
              
              <div style={{ 
                display: 'flex', 
                gap: 12, 
                marginTop: 24,
                justifyContent: 'flex-end',
              }}>
                <Button onClick={handleCloseEdit} disabled={saving}>
                  Cancel
                </Button>
                <Button primary onClick={handleSaveReport} disabled={saving}>
                  {saving ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
