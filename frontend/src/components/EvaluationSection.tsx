import React, { useState, useEffect } from 'react';
import { BenchmarkReport } from '../types/api';
import { api } from '../api/client';
import { Award, Terminal, Play } from 'lucide-react';

export const EvaluationSection: React.FC = () => {
  const [report, setReport] = useState<BenchmarkReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);

  const fetchBenchmark = async () => {
    setLoading(true);
    try {
      const data = await api.evaluation.getBenchmark();
      setReport(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchBenchmark(); }, []);

  const handleRun = async () => {
    setRunning(true);
    try {
      const data = await api.evaluation.runBenchmark();
      setReport(data);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div style={{ maxWidth: '1280px', margin: '1.5rem auto', padding: '0 1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: '700' }}>AI/ML Evaluation &amp; Benchmark</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Reproducible empirical inter-annotator evaluation baseline.</p>
        </div>
        <button onClick={handleRun} disabled={running} className="btn btn-primary">
          <Play size={15} /> {running ? 'Evaluating...' : 'Run Benchmark'}
        </button>
      </div>

      {loading ? <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>Loading baseline...</div> : !report ? (
        <div className="card" style={{ textAlign: 'center' }}>No report available.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="card">
            <h3 style={{ fontSize: '0.95rem', fontWeight: '600', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Award color="var(--primary)" size={17} /> Data Provenance: {report.dataset_name}
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
              Evaluates {report.total_test_units} curated NLP items across {report.annotator_count} annotators with intentional boundary shifts and polysemous ambiguities against verified gold truth.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            <div className="card">
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>MEAN COHEN KAPPA</div>
              <div style={{ fontSize: '1.75rem', fontWeight: '700', color: 'var(--primary)' }}>{report.inter_annotator_metrics.mean_cohen_kappa.toFixed(4)}</div>
            </div>
            <div className="card">
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>FLEISS KAPPA</div>
              <div style={{ fontSize: '1.75rem', fontWeight: '700', color: 'var(--accent)' }}>{report.inter_annotator_metrics.fleiss_kappa.toFixed(4)}</div>
            </div>
            <div className="card">
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>SPAN OVERLAP F1</div>
              <div style={{ fontSize: '1.75rem', fontWeight: '700', color: 'var(--success)' }}>{(report.inter_annotator_metrics.average_span_overlap_f1 * 100).toFixed(1)}%</div>
            </div>
            <div className="card">
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>ADJUDICATION ACCURACY</div>
              <div style={{ fontSize: '1.75rem', fontWeight: '700', color: 'var(--success)' }}>{(report.adjudication_performance.accuracy_against_ground_truth * 100).toFixed(1)}%</div>
            </div>
          </div>

          <div className="card">
            <h3 style={{ fontSize: '0.95rem', marginBottom: '0.75rem' }}>Failure Modes &amp; Mitigations</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {report.failure_modes_analyzed.map((fm, idx) => (
                <div key={idx} style={{ background: 'var(--bg-subtle)', padding: '0.75rem', borderRadius: '0.375rem', border: '1px solid var(--border)', fontSize: '0.8rem' }}>
                  <div style={{ fontWeight: '600', color: 'var(--warning)', marginBottom: '0.2rem' }}>{fm.case}</div>
                  <div style={{ color: 'var(--text-muted)' }}><strong>Impact:</strong> {fm.impact}</div>
                  <div style={{ color: 'var(--success)' }}><strong>Mitigation:</strong> {fm.mitigation}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ background: 'var(--bg-subtle)', padding: '0.75rem 1rem', borderRadius: '0.375rem', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontFamily: 'monospace', fontSize: '0.85rem' }}>
            <Terminal size={16} color="var(--primary)" />
            <span>{report.reproducible_command}</span>
          </div>
        </div>
      )}
    </div>
  );
};
