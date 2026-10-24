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
    <div className="page-container">
      <div className="page-header">
        <div>
          <h2 className="eval-title">AI/ML Evaluation &amp; Benchmark</h2>
          <p className="eval-subtitle">Reproducible empirical inter-annotator evaluation baseline.</p>
        </div>
        <button onClick={handleRun} disabled={running} className="btn btn-primary">
          <Play size={15} /> {running ? 'Evaluating...' : 'Run Benchmark'}
        </button>
      </div>

      {loading ? <div className="loading-state">Loading baseline...</div> : !report ? (
        <div className="card empty-state">No report available.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="card">
            <h3 className="eval-dataset"><Award color="var(--primary)" size={17} /> Data Provenance: {report.dataset_name}</h3>
            <p className="eval-desc">
              Evaluates {report.total_test_units} curated NLP items across {report.annotator_count} annotators with intentional boundary shifts and polysemous ambiguities against verified gold truth.
            </p>
          </div>

          <div className="eval-metrics">
            <div className="eval-metric">
              <div className="eval-metric-label">MEAN COHEN KAPPA</div>
              <div className="eval-metric-value" style={{ color: 'var(--primary)' }}>{report.inter_annotator_metrics.mean_cohen_kappa.toFixed(4)}</div>
            </div>
            <div className="eval-metric">
              <div className="eval-metric-label">FLEISS KAPPA</div>
              <div className="eval-metric-value" style={{ color: 'var(--accent)' }}>{report.inter_annotator_metrics.fleiss_kappa.toFixed(4)}</div>
            </div>
            <div className="eval-metric">
              <div className="eval-metric-label">SPAN OVERLAP F1</div>
              <div className="eval-metric-value" style={{ color: 'var(--success)' }}>{(report.inter_annotator_metrics.average_span_overlap_f1 * 100).toFixed(1)}%</div>
            </div>
            <div className="eval-metric">
              <div className="eval-metric-label">ADJUDICATION ACCURACY</div>
              <div className="eval-metric-value" style={{ color: 'var(--success)' }}>{(report.adjudication_performance.accuracy_against_ground_truth * 100).toFixed(1)}%</div>
            </div>
          </div>

          <div className="card">
            <h3 className="card-title">Failure Modes &amp; Mitigations</h3>
            <div className="failure-modes">
              {report.failure_modes_analyzed.map((fm, idx) => (
                <div key={idx} className="failure-mode">
                  <div className="failure-case">{fm.case}</div>
                  <div className="failure-impact"><strong>Impact:</strong> {fm.impact}</div>
                  <div className="failure-mitigation"><strong>Mitigation:</strong> {fm.mitigation}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="eval-command">
            <Terminal size={16} color="var(--primary)" />
            <span>{report.reproducible_command}</span>
          </div>
        </div>
      )}
    </div>
  );
};
