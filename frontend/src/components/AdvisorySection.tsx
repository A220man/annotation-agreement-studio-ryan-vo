import React, { useState, useEffect } from 'react';
import { Task, DocumentItem } from '../types/api';
import { api } from '../api/client';
import { Brain, AlertTriangle, Loader2, X, Check } from 'lucide-react';

interface AdvisoryStatus {
  enabled: boolean;
  provider: string;
  model: string;
  timeout_seconds: number;
  disclaimer: string;
}

interface AdvisoryResponse {
  status: 'success' | 'error' | 'offline';
  provider: string;
  model_used: string;
  explanation: string;
  recommendations: string[];
  confidence: number;
}

export const AdvisorySection: React.FC<{ task: Task | null; selectedDocument: DocumentItem | null }> = ({ task, selectedDocument }) => {
  const [status, setStatus] = useState<AdvisoryStatus | null>(null);
  const [diagnosing, setDiagnosing] = useState(false);
  const [result, setResult] = useState<AdvisoryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [customText, setCustomText] = useState('');

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const data = await api.advisory.getStatus();
        setStatus(data);
      } catch (err: any) {
        console.error('Failed to fetch advisory status:', err);
      }
    };
    fetchStatus();
  }, []);

  const handleDiagnose = async () => {
    if (!task) return;
    setDiagnosing(true);
    setError(null);
    setResult(null);
    try {
      const conflicts = selectedDocument
        ? [] // In a real app, we'd fetch annotations for this document
        : [];
      const payload = {
        document_id: selectedDocument?.id,
        custom_text: customText || selectedDocument?.text,
        task_type: task.task_type,
        conflicting_annotations: conflicts,
        guidelines: task.guidelines,
      };
      const data = await api.advisory.diagnose(payload);
      setResult(data);
    } catch (err: any) {
      setError(err.message || 'Failed to get advisory explanation');
    } finally {
      setDiagnosing(false);
    }
  };

  if (!task) return <div className="empty-state">Select a task to use the advisory service.</div>;

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h2 className="page-title">
            <Brain size={22} style={{ verticalAlign: 'middle', marginRight: '0.5rem' }} />
            LLM Advisory Explainer
          </h2>
          <p className="page-subtitle">Opt-in grounded linguistic assistance for annotation disagreements.</p>
        </div>
        {status && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <span className={`badge ${status.enabled ? 'badge-success' : 'badge-warning'}`}>
              {status.enabled ? <Check size={12} /> : <X size={12} />} {status.enabled ? 'Enabled' : 'Offline'}
            </span>
            <span className="badge badge-primary">{status.provider}</span>
            <span className="badge badge-outline">{status.model}</span>
          </div>
        )}
      </div>

      {status && !status.enabled && (
        <div className="card warning-card" style={{ borderColor: 'var(--warning)', background: 'rgba(245, 158, 11, 0.1)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
            <AlertTriangle size={20} color="var(--warning)" />
            <div>
              <h4 style={{ margin: '0 0 0.5rem', color: 'var(--warning)' }}>Advisory Service Offline</h4>
              <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                {status.disclaimer} Configure <code>LLM_API_KEY</code> and <code>LLM_PROVIDER</code> environment variables to enable.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="card" style={{ marginTop: '1.5rem' }}>
        <h3 className="card-title">Diagnose Annotation Disagreement</h3>
        <p className="card-subtitle" style={{ marginBottom: '1rem', color: 'var(--text-muted)' }}>
          Provide a document or select one from the task to get an advisory explanation of annotator disagreements.
        </p>

        <div style={{ marginBottom: '1rem' }}>
          <label className="form-label" style={{ display: 'block', marginBottom: '0.5rem' }}>
            Document Text <span className="required" style={{ color: 'var(--danger)' }}>*</span>
          </label>
          <textarea
            value={customText || (selectedDocument?.text || '')}
            onChange={(e) => setCustomText(e.target.value)}
            placeholder={selectedDocument ? 'Using selected document...' : 'Paste document text here...'}
            className="form-textarea"
            style={{ minHeight: '120px', width: '100%', fontFamily: 'monospace', fontSize: '0.85rem' }}
            disabled={!!selectedDocument || diagnosing}
          />
          {selectedDocument && (
            <p className="form-hint" style={{ marginTop: '0.25rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Using document: {selectedDocument.id.substring(0, 8)}... ({selectedDocument.text.length} chars)
            </p>
          )}
        </div>

        <button
          onClick={handleDiagnose}
          disabled={diagnosing || !status?.enabled || (!customText && !selectedDocument)}
          className="btn btn-primary"
          style={{ width: '100%', maxWidth: '300px' }}
        >
          <Loader2 size={15} className={diagnosing ? 'spin' : ''} style={{ display: diagnosing ? 'inline' : 'none' }} />
          {diagnosing ? 'Analyzing...' : 'Get Advisory Explanation'}
        </button>

        {error && (
          <div className="error-state" style={{ marginTop: '1rem' }}>
            <AlertTriangle size={15} style={{ verticalAlign: 'middle', marginRight: '0.5rem' }} />
            {error}
          </div>
        )}

        {result && (
          <div className="advisory-result" style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border)' }}>
            <h4 style={{ margin: '0 0 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Brain size={18} color="var(--primary)" />
              Advisory Response
            </h4>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem', fontSize: '0.85rem' }}>
              <span className="badge badge-primary">{result.provider}</span>
              <span className="badge badge-outline">{result.model_used}</span>
              <span className={`badge ${result.status === 'success' ? 'badge-success' : result.status === 'offline' ? 'badge-warning' : 'badge-danger'}`}>
                {result.status}
              </span>
              <span className="badge badge-info">Confidence: {(result.confidence * 100).toFixed(0)}%</span>
            </div>

            <div className="advisory-explanation" style={{ 
              background: 'var(--bg-tertiary)', 
              borderRadius: '8px', 
              padding: '1rem',
              marginBottom: '1rem',
              whiteSpace: 'pre-wrap',
              lineHeight: '1.6'
            }}>
              {result.explanation}
            </div>

            {result.recommendations && result.recommendations.length > 0 && (
              <div className="advisory-recommendations">
                <h5 style={{ margin: '0 0 0.75rem', fontSize: '0.9rem', color: 'var(--text)' }}>Recommendations:</h5>
                <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
                  {result.recommendations.map((rec, idx) => (
                    <li key={idx} style={{ marginBottom: '0.5rem', lineHeight: '1.5' }}>{rec}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="card" style={{ marginTop: '1.5rem' }}>
        <h3 className="card-title">How It Works</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
          <div className="feature-item">
            <h5 style={{ margin: '0 0 0.5rem' }}>Grounded Analysis</h5>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Advisory explanations are grounded in the actual document text, conflicting annotator labels, and task guidelines.
            </p>
          </div>
          <div className="feature-item">
            <h5 style={{ margin: '0 0 0.5rem' }}>Non-Authoritative</h5>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              LLM output is strictly advisory. Human adjudicators retain full authority over consensus decisions.
            </p>
          </div>
          <div className="feature-item">
            <h5 style={{ margin: '0 0 0.5rem' }}>Multiple Providers</h5>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Supports OpenAI-compatible APIs, Anthropic, Google Gemini, and local Ollama models.
            </p>
          </div>
          <div className="feature-item">
            <h5 style={{ margin: '0 0 0.5rem' }}>Audit Trail</h5>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              All advisory requests are logged in the immutable audit trail with provider and status.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdvisorySection;
