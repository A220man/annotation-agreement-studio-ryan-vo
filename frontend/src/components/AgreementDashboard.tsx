import React, { useState, useEffect } from 'react';
import { Task, AgreementSummary } from '../types/api';
import { api } from '../api/client';
import { Split, UserX } from 'lucide-react';

export const AgreementDashboard: React.FC<{ task: Task | null }> = ({ task }) => {
  const [summary, setSummary] = useState<AgreementSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!task) return;
    setLoading(true);
    setError(null);
    api.agreement.getTaskSummary(task.id)
      .then(setSummary)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [task]);

  if (!task) return <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Select a task to view metrics.</div>;

  return (
    <div style={{ maxWidth: '1280px', margin: '1.5rem auto', padding: '0 1.5rem' }}>
      <h2 style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '0.25rem' }}>Agreement: {task.name}</h2>
      <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>Cohen/Fleiss kappa, confusion matrix, and span boundary diagnostics.</p>

      {loading ? <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>Calculating metrics...</div> : error ? (
        <div style={{ padding: '1rem', color: 'var(--danger)', background: 'rgba(248,113,113,0.1)', borderRadius: '0.375rem' }}>{error}</div>
      ) : !summary || summary.cohen_kappas.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <Split size={36} color="var(--text-muted)" style={{ marginBottom: '0.5rem' }} />
          <h3>Insufficient Annotations</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Need at least 2 annotators on overlapping items.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {summary.outlier_annotators.length > 0 && (
            <div style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid var(--warning)', padding: '0.75rem', borderRadius: '0.375rem', display: 'flex', gap: '0.5rem', alignItems: 'center', fontSize: '0.85rem' }}>
              <UserX color="var(--warning)" size={18} />
              <span><strong>Outlier Annotators:</strong> [{summary.outlier_annotators.join(', ')}] deviate from group mean agreement.</span>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
            <div className="card">
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>MEAN COHEN KAPPA</div>
              <div style={{ fontSize: '1.75rem', fontWeight: '700', color: summary.overall_mean_kappa >= 0.7 ? 'var(--success)' : 'var(--warning)' }}>{summary.overall_mean_kappa.toFixed(3)}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{summary.cohen_kappas.length} pairs</div>
            </div>
            {summary.fleiss_kappa != null && (
              <div className="card">
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>FLEISS KAPPA</div>
                <div style={{ fontSize: '1.75rem', fontWeight: '700', color: summary.fleiss_kappa >= 0.7 ? 'var(--success)' : 'var(--warning)' }}>{summary.fleiss_kappa.toFixed(3)}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Multi-rater</div>
              </div>
            )}
            {summary.krippendorff_alpha != null && (
              <div className="card">
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>KRIPPENDORFF ALPHA</div>
                <div style={{ fontSize: '1.75rem', fontWeight: '700', color: 'var(--accent)' }}>{summary.krippendorff_alpha.toFixed(3)}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Nominal coincidence</div>
              </div>
            )}
            {summary.token_span_f1 != null && (
              <div className="card">
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>SPAN OVERLAP F1</div>
                <div style={{ fontSize: '1.75rem', fontWeight: '700', color: 'var(--primary)' }}>{(summary.token_span_f1 * 100).toFixed(1)}%</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Relaxed match</div>
              </div>
            )}
            {summary.span_exact_match_ratio != null && (
              <div className="card">
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>EXACT MATCH RATIO</div>
                <div style={{ fontSize: '1.75rem', fontWeight: '700', color: 'var(--success)' }}>{(summary.span_exact_match_ratio * 100).toFixed(1)}%</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Identical offsets</div>
              </div>
            )}
          </div>

          <div className="card">
            <h3 style={{ fontSize: '0.95rem', marginBottom: '0.75rem' }}>Pairwise Cohen Kappa</h3>
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr><th>Annotator 1</th><th>Annotator 2</th><th>Kappa</th><th>Observed</th><th>Expected</th><th>Interpretation</th></tr>
                </thead>
                <tbody>
                  {summary.cohen_kappas.map((p, idx) => (
                    <tr key={idx}>
                      <td style={{ fontWeight: '500' }}>{p.annotator_1}</td>
                      <td style={{ fontWeight: '500' }}>{p.annotator_2}</td>
                      <td style={{ fontWeight: '700', color: p.cohen_kappa >= 0.7 ? 'var(--success)' : 'var(--warning)' }}>{p.cohen_kappa.toFixed(3)}</td>
                      <td>{(p.observed_agreement * 100).toFixed(1)}%</td>
                      <td>{(p.expected_agreement * 100).toFixed(1)}%</td>
                      <td><span className={`badge ${p.cohen_kappa >= 0.7 ? 'badge-success' : 'badge-warning'}`}>{p.interpretation}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {Object.keys(summary.disagreement_matrix).length > 0 && (
            <div className="card">
              <h3 style={{ fontSize: '0.95rem', marginBottom: '0.75rem' }}>Confusion Matrix</h3>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ textAlign: 'center' }}>
                  <thead>
                    <tr><th style={{ background: 'var(--bg-subtle)' }}>Labels</th>{Object.keys(summary.disagreement_matrix).map((c) => <th key={c} style={{ background: 'var(--bg-subtle)' }}>{c}</th>)}</tr>
                  </thead>
                  <tbody>
                    {Object.keys(summary.disagreement_matrix).map((row) => (
                      <tr key={row}>
                        <td style={{ fontWeight: '600', background: 'var(--bg-subtle)' }}>{row}</td>
                        {Object.keys(summary.disagreement_matrix).map((col) => {
                          const val = summary.disagreement_matrix[row]?.[col] || 0;
                          return <td key={col} style={{ color: row === col ? 'var(--success)' : val > 0 ? 'var(--danger)' : 'var(--text-muted)', fontWeight: val > 0 ? '600' : '400' }}>{val}</td>;
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {summary.boundary_diagnostics.length > 0 && (
            <div className="card">
              <h3 style={{ fontSize: '0.95rem', marginBottom: '0.75rem' }}>Span Boundary Misalignment Diagnostics</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {summary.boundary_diagnostics.map((b, idx) => (
                  <div key={idx} style={{ background: 'var(--bg-subtle)', padding: '0.6rem', borderRadius: '0.375rem', border: '1px solid var(--border)', fontSize: '0.8rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span className="badge badge-warning">{b.misalignment_type.toUpperCase()}</span>
                      <span style={{ color: 'var(--text-muted)' }}>Delta: {b.offset_difference} chars</span>
                    </div>
                    <div style={{ marginTop: '0.25rem', color: 'var(--text-muted)' }}>
                      <span>{b.annotator_1}: "{b.text_1}" [{b.span_1[0]}:{b.span_1[1]}]</span> vs <span>{b.annotator_2}: "{b.text_2}" [{b.span_2[0]}:{b.span_2[1]}]</span>
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
