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
      const [docs, cons] = await Promise.all([
        api.tasks.listDocuments(task.id),
        api.reconciliation.listConsensus(task.id),
      ]);
      setDocuments(docs);
      setConsensusList(cons);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refreshData(); }, [task]);

  if (!task) return <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Select a task to open the adjudication queue.</div>;

  const handleAutoReconcile = async () => {
    setReconciling(true);
    try {
      await api.reconciliation.autoReconcile(task.id, strategy);
      await refreshData();
    } finally {
      setReconciling(false);
    }
  };

  const handleSaveConsensus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editDoc) return;
    await api.reconciliation.manualConsensus(editDoc.id, {
      status: 'approved',
      class_label: task.task_type === 'classification' ? manualLabel : undefined,
      reconciliation_method: 'manual',
      notes: manualNotes,
    });
    setEditDoc(null);
    refreshData();
  };

  const consensusMap = new Map(consensusList.map((c) => [c.document_id, c]));

  return (
    <div style={{ maxWidth: '1280px', margin: '1.5rem auto', padding: '0 1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: '700' }}>Adjudication Queue: {task.name}</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Resolve disputes and export consensus datasets.</p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          {role !== 'viewer' && (
            <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
              <select value={strategy} onChange={(e) => setStrategy(e.target.value)}>
                <option value="majority_vote">Majority Vote</option>
                {task.task_type === 'span' && (
                  <>
                    <option value="union">Span Union</option>
                    <option value="intersection">Span Intersection</option>
                  </>
                )}
              </select>
              <button onClick={handleAutoReconcile} disabled={reconciling} className="btn btn-primary">
                <Sliders size={15} /> {reconciling ? 'Running...' : 'Auto-Reconcile'}
              </button>
            </div>
          )}
          <a href={`/api/reconciliation/export/${task.id}?format=jsonl`} download className="btn btn-outline" style={{ textDecoration: 'none' }}>
            <Download size={15} /> JSONL
          </a>
          {task.task_type === 'span' && (
            <a href={`/api/reconciliation/export/${task.id}?format=conll`} download className="btn btn-outline" style={{ textDecoration: 'none' }}>
              <Download size={15} /> CoNLL
            </a>
          )}
        </div>
      </div>

      {loading ? <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>Loading records...</div> : documents.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>No documents in this task.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {documents.map((doc, idx) => {
            const consensus = consensusMap.get(doc.id);
            return (
              <div key={doc.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '260px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>#{idx + 1}</span>
                    {consensus ? (
                      <span className={`badge ${consensus.status === 'approved' ? 'badge-success' : 'badge-warning'}`}>
                        {consensus.status.toUpperCase()} ({consensus.reconciliation_method})
                      </span>
                    ) : (
                      <span className="badge badge-danger">PENDING</span>
                    )}
                  </div>
                  <p style={{ fontSize: '0.85rem', marginBottom: '0.5rem' }}>{doc.text}</p>
                  {consensus && (
                    <div style={{ background: 'var(--bg-subtle)', padding: '0.5rem 0.75rem', borderRadius: '0.375rem', fontSize: '0.8rem', border: '1px solid var(--border)' }}>
                      {consensus.class_label && <div><strong>Gold Label:</strong> <span style={{ color: 'var(--success)' }}>{consensus.class_label}</span></div>}
                      {consensus.spans && consensus.spans.length > 0 && (
                        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.2rem' }}>
                          <strong>Gold Spans:</strong>
                          {consensus.spans.map((s, sidx) => (
                            <span key={sidx} style={{ padding: '0.1rem 0.35rem', borderRadius: '0.25rem', background: 'rgba(52,211,153,0.15)', color: 'var(--success)' }}>
                              {s.label}: "{s.text}" [{s.start}:{s.end}]
                            </span>
                          ))}
                        </div>
                      )}
                      {consensus.notes && <div style={{ color: 'var(--text-muted)', marginTop: '0.2rem' }}><em>Notes:</em> {consensus.notes}</div>}
                    </div>
                  )}
                </div>
                {role !== 'viewer' && (
                  <button onClick={() => { setEditDoc(doc); setManualLabel(consensus?.class_label || task.labels_schema[0] || ''); setManualNotes(consensus?.notes || ''); }} className="btn btn-secondary" style={{ fontSize: '0.8rem' }}>
                    <Edit3 size={13} /> Adjudicate
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {editDoc && (
        <div className="modal-overlay">
          <div className="modal-box">
            <h3 style={{ marginBottom: '0.5rem' }}>Adjudication Override</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>"{editDoc.text}"</p>
            <form onSubmit={handleSaveConsensus}>
              {task.task_type === 'classification' && (
                <div style={{ marginBottom: '0.75rem' }}>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Label</label>
                  <select style={{ width: '100%' }} value={manualLabel} onChange={(e) => setManualLabel(e.target.value)}>
                    {task.labels_schema.map((l) => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
              )}
              <div style={{ marginBottom: '0.75rem' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Rationale / Audit Notes</label>
                <textarea rows={3} style={{ width: '100%' }} value={manualNotes} onChange={(e) => setManualNotes(e.target.value)} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button type="button" onClick={() => setEditDoc(null)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary">Approve Consensus</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
