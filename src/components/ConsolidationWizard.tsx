import { useState, useEffect } from "react";
import type { MonthlyReport } from "../../shared/types.ts";
import { getAccessToken } from "../api.ts";
import { Button, Field, TextInput } from "./ui.tsx";

interface ConsolidationWizardProps {
  period: string;
  pmReports: MonthlyReport[];
  onClose: () => void;
  onComplete: () => void;
}

interface ConsolidationPreview {
  callOrders: Array<{
    callOrderId: string;
    callOrderName: string;
    sources: Array<{
      reportId: number;
      pmName: string;
      hasSection: boolean;
    }>;
  }>;
}

export function ConsolidationWizard({ period, pmReports, onClose, onComplete }: ConsolidationWizardProps) {
  const [step, setStep] = useState<"preview" | "confirm" | "processing">("preview");
  const [preview, setPreview] = useState<ConsolidationPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [consolidatedReportId, setConsolidatedReportId] = useState<number | null>(null);

  useEffect(() => {
    // Build preview of what will be consolidated
    const callOrderMap = new Map<string, { name: string; sources: Array<{ reportId: number; pmName: string; hasSection: boolean }> }>();
    
    for (const report of pmReports) {
      const pmName = report.submittedBy || "Unknown PM";
      for (const [callOrderId, section] of Object.entries(report.sections)) {
        if (!callOrderMap.has(callOrderId)) {
          callOrderMap.set(callOrderId, {
            name: section.title || callOrderId,
            sources: [],
          });
        }
        callOrderMap.get(callOrderId)!.sources.push({
          reportId: report.id,
          pmName,
          hasSection: true,
        });
      }
    }

    const callOrders = Array.from(callOrderMap.entries()).map(([callOrderId, data]) => ({
      callOrderId,
      callOrderName: data.name,
      sources: data.sources,
    }));

    setPreview({ callOrders });
  }, [pmReports]);

  const handleConsolidate = async () => {
    setStep("processing");
    setError(null);

    try {
      const token = getAccessToken();
      const response = await fetch("/api/program-manager/consolidate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token || ''}`,
        },
        body: JSON.stringify({
          period,
          pmReportIds: pmReports.map(r => r.id),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Consolidation failed: ${response.statusText}`);
      }

      const result = await response.json();
      setConsolidatedReportId(result.consolidatedReportId);
      setStep("confirm");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setStep("preview");
    }
  };

  if (step === "processing") {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 500 }}>
          <div className="modal-header">
            <h2>Consolidating Reports...</h2>
          </div>
          <div className="modal-body">
            <div style={{ textAlign: "center", padding: "40px 20px" }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
              <p>Merging {pmReports.length} PM reports into master report...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (step === "confirm") {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 500 }}>
          <div className="modal-header">
            <h2>Consolidation Complete</h2>
          </div>
          <div className="modal-body">
            <div style={{ textAlign: "center", padding: "40px 20px" }}>
              <div style={{ fontSize: 48, marginBottom: 16, color: "#2e7d32" }}>✓</div>
              <p style={{ fontSize: 16, marginBottom: 8 }}>
                Successfully consolidated {pmReports.length} PM reports
              </p>
              <p style={{ color: "#666", fontSize: 14 }}>
                Master report ID: {consolidatedReportId}
              </p>
            </div>
          </div>
          <div className="modal-footer">
            <Button primary onClick={() => { onComplete(); onClose(); }}>
              Done
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 800 }}>
        <div className="modal-header">
          <h2>Consolidate PM Reports for {period}</h2>
          <button type="button" onClick={onClose} style={{ background: "none", border: "none", fontSize: 24, cursor: "pointer" }}>×</button>
        </div>
        
        <div className="modal-body">
          {error && (
            <div style={{ padding: 12, marginBottom: 16, background: "#ffebee", border: "1px solid #ef5350", borderRadius: 4, color: "#c62828" }}>
              <strong>Error:</strong> {error}
            </div>
          )}

          <div style={{ marginBottom: 24 }}>
            <p style={{ marginBottom: 12 }}>
              This will consolidate <strong>{pmReports.length} PM reports</strong> into a single master program report.
            </p>
            <div style={{ padding: 12, background: "#e3f2fd", borderRadius: 4, fontSize: 13 }}>
              <strong>What happens:</strong>
              <ul style={{ marginTop: 8, marginBottom: 0, paddingLeft: 20 }}>
                <li>All PM sections will be merged into one program-level report</li>
                <li>Conflicting data will use the most recent submission</li>
                <li>You can edit the consolidated report afterward</li>
                <li>PM reports remain unchanged</li>
              </ul>
            </div>
          </div>

          {preview && (
            <div>
              <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, textTransform: "uppercase", color: "#666" }}>
                Preview: {preview.callOrders.length} Call Orders
              </h3>
              <div style={{ maxHeight: 300, overflowY: "auto", border: "1px solid #ddd", borderRadius: 4 }}>
                {preview.callOrders.map((co) => (
                  <div key={co.callOrderId} style={{ padding: 12, borderBottom: "1px solid #eee" }}>
                    <div style={{ fontWeight: 500, marginBottom: 6 }}>{co.callOrderName}</div>
                    <div style={{ fontSize: 13, color: "#666" }}>
                      {co.sources.length} section{co.sources.length !== 1 ? 's' : ''} from: {co.sources.map(s => s.pmName).join(", ")}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <Button onClick={onClose}>Cancel</Button>
          <Button primary onClick={handleConsolidate}>
            Consolidate Reports
          </Button>
        </div>
      </div>
    </div>
  );
}
