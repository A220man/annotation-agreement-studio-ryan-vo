import React, { useState, useEffect } from 'react';
import { Task, DocumentItem, ConsensusRecord } from '../types/api';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Sliders, Download, Edit3 } from 'lucide-react';

export const ReconciliationQueue: React.FC<{ task: Task | null }> = ({ task }) => {
  const { role } = useAuth();
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [consensusList, setConsensusList] = useState<ConsensusRecord[]>([]);
  const [strategy, setStrategy] = useState<string>('majority_vote');
  const [loading, setLoading] = useState(false);
  const [reconciling, setReconciling] = useState(false);

  const [editDoc, setEditDoc] = useState<DocumentItem | null>(null);
  const [manualLabel, setManualLabel] = useState('');
  const [manualNotes, setManualNotes] = useState('');

  const refreshData = async () => {
    if (!task) return;
    setLoading(true);
    try {
      const [docs, consensus] = await Promise.all([
        api.tasks.listDocuments(task.id),
        api.reconciliation.listConsensus(task.id),
      ]);
      setDocuments(docs);
      setConsensusList(consensus);
    } catch (err) {
      console.error('Failed to load reconciliation data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refreshData(); }, [task]);

  if (!task) return <div className="empty-state">Select a task to open the adjudication queue.</div>;

  const handleAutoReconcile = async () => {
    setReconciling(true);
    try {
      await api.reconciliation.autoReconcile(task.id, strategy);
      refreshData();
    } catch (err) {
      console.error('Auto-reconcile failed:', err);
    } finally {
      setReconciling(false);
    }
  };

  const handleSaveConsensus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editDoc) return;
    const payload: Record<string, unknown> = { reconciled_by: 'analyst', notes: manualNotes };
    if (task.task_type === 'classification') payload.class_label = manualLabel;
    await api.reconciliation.manualConsensus(editDoc.id, payload);
    setEditDoc(null);
    refreshData();
  };

  const consensusMap = new Map(consensusList.map((c) => [c.document_id, c]));

  const isSpanTask = task.task_type === 'span';

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h2 className="page-title">Consensus Adjudication Queue</h2>
          <p className="page-subtitle">Task: {task.name} ({task.task_type})</p>
        </div>
        {(role === 'analyst' || role === 'admin') && (
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <select value={strategy} onChange={(e) => setStrategy(e.target.value)} className="form-input" style={{ width: 'auto', minWidth: '180px' }}>
              <option value="majority_vote">Majority Vote</option>
              <option value="union">Span Union (Max Recall)</option>
              <option value="intersection">Span Intersection (Max Precision)</option>
            </select>
            <button onClick={handleAutoReconcile} disabled={reconciling} className="btn btn-primary">
              <Sliders size={15} /> {reconciling ? 'Reconciling...' : 'Auto-Reconcile'}
            </button>
            <a href={`/api/reconciliation/export/${task.id}?format=jsonl`} className="btn btn-outline" download><Download size={15} /> Export JSONL</a>
            {isSpanTask && <a href={`/api/reconciliation/export/${task.id}?format=conll`} className="btn btn-outline" download><Download size={15} /> Export CoNLL</a>}
            {isSpanTask && <a href={`/api/reconciliation/export/${task.id}?format=huggingface`} className="btn btn-outline" download><Download size={15} /> Export HuggingFace</a>}
          </div>
        )}
      </div>

      {loading ? <div className="loading-state">Loading adjudication queue...</div> : documents.length === 0 ? (
        <div className="card empty-state">No documents in this task.</div>
      ) : (
        <div className="recon-queue">
          {documents.map((doc) => {
            const consensus = consensusMap.get(doc.id);
            return (
              <div key={doc.id} className="recon-doc">
                <div className="recon-doc-header">
                  <span className="recon-doc-id">{doc.id.substring(0, 8)}... • {doc.text.length} chars</span>
                  <span className={`recon-status recon-status-${consensus?.status || 'draft'}`}>
                    {consensus ? 'approved' : 'Pending'}
                  </span>
                </div>
                <div className="recon-doc-body">
                  {consensus && (
                    <div className="recon-text-preview">
                      {task.task_type === 'span' && consensus.spans && consensus.spans.length > 0 ? (
                        <>
                          {consensus.spans.map((s, i) => (
                            <span key={i} className="recon-span" style={{ '--span-color': `hsl(${Math.abs(s.label.split('').reduce((a, c) => a + c.charCodeAt(0), 0)) % 360}, 70%, 50%)` }}>
                              {s.text} <span className="recon-span-label">{s.label}</span>
                            </span>
                          ))}
                        </>
                      ) : (
                        <span>{consensus.class_label || 'No label'}</span>
                      )}
                    </div>
                  )}
                  {(role === 'analyst' || role === 'admin') && !consensus && (
                    <form onSubmit={handleSaveConsensus} className="recon-form">
                      <h4 style={{ marginBottom: '0.5rem' }}>Manual Consensus</h4>
                      {task.task_type === 'classification' ? (
                        <div className="form-group">
                          <label className="form-label">Class Label</label>
                          <select value={manualLabel} onChange={(e) => setManualLabel(e.target.value)} className="form-input" required>
                            {task.labels_schema.map((l: string) => <option key={l} value={l}>{l}</option>)}
                          </select>
                        </div>
                      ) : (
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Use API for manual span consensus.</p>
                      )}
                      <div className="form-group">
                        <label className="form-label">Adjudication Notes</label>
                        <textarea value={manualNotes} onChange={(e) => setManualNotes(e.target.value)} className="form-input form-textarea" placeholder="Explain your decision..." />
                      </div>
                      <div className="modal-actions">
                        <button type="submit" className="btn btn-primary"><Edit3 size={15} /> Save Consensus</button>
                      </div>
                    </form>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
