import React, { useState, useEffect } from 'react';
import { Task, AgreementSummary } from '../types/api';
import { api } from '../api/client';
import { Download } from 'lucide-react';

export const AgreementDashboard: React.FC<{ task: Task | null }> = ({ task }) => {
  const [summary, setSummary] = useState<AgreementSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'confusion' | 'disagreement' | 'diagnostics'>('overview');

  useEffect(() => {
    if (!task) return;
    setLoading(true);
    setError(null);
    api.agreement.getTaskSummary(task.id)
      .then(setSummary)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [task]);

  const handleExport = async (format: 'json' | 'csv') => {
    if (!task) return;
    setExporting(true);
    try {
      await api.agreement.exportReport(task.id, format);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setExporting(false);
    }
  };

  if (!task) return <div className="empty-state">Select a task to view metrics.</div>;

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h2 className="page-title">Inter-Annotator Agreement</h2>
          <p className="page-subtitle">Task: {task.name} ({task.task_type})</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button onClick={() => handleExport('json')} disabled={exporting} className="btn btn-outline"><Download size={15} /> Export JSON</button>
          <button onClick={() => handleExport('csv')} disabled={exporting} className="btn btn-outline"><Download size={15} /> Export CSV</button>
        </div>
      </div>

      {loading ? <div className="loading-state">Calculating metrics...</div> : error ? (
        <div className="error-state">{error}</div>
      ) : !summary || summary.cohen_kappas.length === 0 ? (
        <div className="card empty-state">
          <p>Insufficient annotations for agreement calculation.</p>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
            Need at least 2 annotators with overlapping documents.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="agreement-tabs">
            {(['overview', 'confusion', 'disagreement', 'diagnostics'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setActiveTab(t)}
                className={`agreement-tab ${activeTab === t ? 'agreement-tab-active' : ''}`}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>

          {activeTab === 'overview' && (
            <>
              <div className="metrics-grid">
                <div className="metric-card">
                  <div className="metric-label">MEAN COHEN KAPPA</div>
                  <div className="metric-value metric-primary">{summary.overall_mean_kappa.toFixed(4)}</div>
                  <div className="metric-label" style={{ color: 'var(--primary)' }}>
                    {summary.cohen_kappas.length > 0 ? summary.cohen_kappas[0].interpretation : 'N/A'}
                  </div>
                </div>
                <div className="metric-card">
                  <div className="metric-label">FLEISS KAPPA</div>
                  <div className="metric-value metric-accent">{summary.fleiss_kappa !== undefined ? summary.fleiss_kappa.toFixed(4) : 'N/A'}</div>
                  <div className="metric-label" style={{ color: 'var(--accent)' }}>Need 3+ annotators</div>
                </div>
                <div className="metric-card">
                  <div className="metric-label">KRIPPENDORFF ALPHA</div>
                  <div className="metric-value metric-success">{summary.krippendorff_alpha !== undefined ? summary.krippendorff_alpha.toFixed(4) : 'N/A'}</div>
                  <div className="metric-label" style={{ color: 'var(--success)' }}>Need nominal data</div>
                </div>
                <div className="metric-card">
                  <div className="metric-label">AVG SPAN OVERLAP F1</div>
                  <div className="metric-value metric-success">{(summary.token_span_f1 !== undefined ? summary.token_span_f1 * 100 : 0).toFixed(1)}%</div>
                </div>
              </div>

              <div className="card">
                <h3 className="card-title">Pairwise Cohen's Kappa</h3>
                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th>Annotator 1</th><th>Annotator 2</th><th>Kappa</th><th>Observed</th><th>Expected</th><th>Interpretation</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.cohen_kappas.map((k, i) => (
                        <tr key={i}>
                          <td>{k.annotator_1}</td><td>{k.annotator_2}</td><td>{k.kappa.toFixed(4)}</td><td>{k.observed_agreement.toFixed(4)}</td><td>{k.expected_agreement.toFixed(4)}</td><td>{k.interpretation}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {summary.outlier_annotators && summary.outlier_annotators.length > 0 && (
                <div className="card">
                  <h3 className="card-title">Outlier Annotators</h3>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    Annotators with mean pairwise kappa below 0.4: <strong>{summary.outlier_annotators.join(', ')}</strong>
                  </p>
                </div>
              )}
            </>
          )}

          {activeTab === 'confusion' && summary.disagreement_matrix && (
            <div className="card">
              <h3 className="card-title">Confusion Matrix</h3>
              <div style={{ overflowX: 'auto' }}>
                <table className="confusion-matrix">
                  <thead>
                    <tr>
                      <th></th>
                      {Object.keys(summary.disagreement_matrix).map(l => <th key={l} className="confusion-header">{l}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(summary.disagreement_matrix).map(([rowLabel, rowData], i) => (
                      <tr key={rowLabel}>
                        <td className="confusion-header">{rowLabel}</td>
                        {Object.entries(rowData).map(([colLabel, value], j) => (
                          <td key={colLabel} className={i === j ? 'confusion-diagonal' : value > 0.3 ? 'confusion-high' : value > 0.1 ? 'confusion-medium' : ''}>
                            {value.toFixed(2)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'disagreement' && summary.top_disagreements && summary.top_disagreements.length > 0 && (
            <div className="card">
              <h3 className="card-title">Top Disagreement Pairs</h3>
              <div className="disagreement-list">
                {summary.top_disagreements.map((pair, i) => (
                  <div key={i} className="disagreement-item">
                    <div className="disagreement-pair">
                      <span className="badge badge-primary">{pair.label_1}</span>
                      <span>vs</span>
                      <span className="badge badge-warning">{pair.label_2}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <span className="disagreement-count">{pair.count} occurrences</span>
                      <span className="disagreement-pct">{pair.percentage.toFixed(1)}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'diagnostics' && summary.boundary_diagnostics && summary.boundary_diagnostics.length > 0 && (
            <div className="card">
              <h3 className="card-title">Boundary Misalignment Diagnostics</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {summary.boundary_diagnostics.map((diag, i) => (
                  <div key={i} style={{ background: 'var(--bg-subtle)', padding: '0.75rem', borderRadius: '0.375rem', border: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                      <span className={`diag-badge diag-${diag.diagnostic_type}`}>{diag.diagnostic_type.replace('_', ' ')}</span>
                      <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--text-muted)' }}>Doc: {diag.document_id.substring(0, 8)}...</span>
                    </div>
                    <div style={{ fontSize: '0.85rem' }}>
                      <strong>Annotator 1 ({diag.annotator_1}):</strong> [{diag.span_1_start}, {diag.span_1_end}] "{diag.span_1_text}"
                    </div>
                    <div style={{ fontSize: '0.85rem' }}>
                      <strong>Annotator 2 ({diag.annotator_2}):</strong> [{diag.span_2_start}, {diag.span_2_end}] "{diag.span_2_text}"
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                      Offset difference: {diag.offset_difference} chars
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
