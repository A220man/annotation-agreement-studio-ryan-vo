import React, { useState, useEffect } from 'react';
import { Task, DocumentItem, Annotation } from '../types/api';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { BrainCircuit, User } from 'lucide-react';

export const AnnotationWorkbench: React.FC<{ task: Task | null }> = ({ task }) => {
  const { role } = useAuth();
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [loading, setLoading] = useState(false);

  const [annotatorName, setAnnotatorName] = useState('Analyst-1');
  const [classLabel, setClassLabel] = useState('');
  const [spanStart, setSpanStart] = useState<number>(0);
  const [spanEnd, setSpanEnd] = useState<number>(5);
  const [spanLabel, setSpanLabel] = useState('');
  const [activeSpans, setActiveSpans] = useState<Array<{ start: number; end: number; label: string; text?: string }>>([]);

  const [advisoryOpen, setAdvisoryOpen] = useState(false);
  const [advisoryLoading, setAdvisoryLoading] = useState(false);
  const [advisoryResult, setAdvisoryResult] = useState<any>(null);

  useEffect(() => {
    if (!task) return;
    api.tasks.listDocuments(task.id).then((docs) => {
      setDocuments(docs);
      if (docs.length > 0) setSelectedDocId(docs[0].id);
    });
  }, [task]);

  useEffect(() => {
    if (!task || !selectedDocId) return;
    setLoading(true);
    api.annotations.list(task.id, selectedDocId).then(setAnnotations).finally(() => setLoading(false));
  }, [task, selectedDocId]);

  if (!task) return <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Select a task to open workbench.</div>;

  const selectedDoc = documents.find((d) => d.id === selectedDocId);

  const handleAddSpan = () => {
    if (!selectedDoc || spanStart >= spanEnd || spanEnd > selectedDoc.text.length) return;
    const lbl = spanLabel || (task.labels_schema[0] || 'ENTITY');
    setActiveSpans([...activeSpans, { start: spanStart, end: spanEnd, label: lbl, text: selectedDoc.text.slice(spanStart, spanEnd) }]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDoc) return;
    await api.annotations.submit({
      document_id: selectedDoc.id, annotator_id: annotatorName.toLowerCase().replace(/\s+/g, '_'),
      annotator_name: annotatorName, task_type: task.task_type,
      class_label: task.task_type === 'classification' ? (classLabel || task.labels_schema[0]) : undefined,
      spans: task.task_type === 'span' ? activeSpans : undefined,
    });
    setAnnotations(await api.annotations.list(task.id, selectedDoc.id));
    setActiveSpans([]);
  };

  const handleDiagnose = async () => {
    if (!selectedDoc) return;
    setAdvisoryLoading(true);
    setAdvisoryOpen(true);
    try {
      setAdvisoryResult(await api.advisory.diagnose({ document_id: selectedDoc.id }));
    } catch (err: any) {
      setAdvisoryResult({ status: 'error', error_message: err.message });
    } finally {
      setAdvisoryLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '1280px', margin: '1.5rem auto', padding: '0 1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: '700' }}>Workbench: {task.name}</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Compare multi-annotator inputs.</p>
        </div>
        {annotations.length >= 2 && (
          <button onClick={handleDiagnose} className="btn btn-outline" style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}>
            <BrainCircuit size={16} /> Advisory Diagnosis
          </button>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '1.5rem' }}>
        <div className="card" style={{ height: 'fit-content' }}>
          <h3 style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Documents ({documents.length})</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: '500px', overflowY: 'auto' }}>
            {documents.map((d, i) => (
              <div key={d.id} onClick={() => setSelectedDocId(d.id)} style={{ padding: '0.45rem', borderRadius: '0.375rem', background: selectedDocId === d.id ? 'var(--border)' : 'var(--bg-subtle)', cursor: 'pointer', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}><span>#{i + 1}</span><span>{d.annotation_count} anns</span></div>
                <p style={{ fontSize: '0.8rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.text}</p>
              </div>
            ))}
          </div>
        </div>

        <div>
          {selectedDoc ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="card">
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>DOCUMENT TEXT</div>
                <div style={{ background: 'var(--bg-subtle)', padding: '0.75rem', borderRadius: '0.375rem', border: '1px solid var(--border)' }}>{selectedDoc.text}</div>
              </div>

              <div className="card">
                <h4 style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>Annotator Submissions ({annotations.length})</h4>
                {loading ? <div>Loading...</div> : annotations.length === 0 ? <div style={{ color: 'var(--text-muted)' }}>No annotations.</div> : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {annotations.map((a) => (
                      <div key={a.id} style={{ background: 'var(--bg-subtle)', padding: '0.6rem', borderRadius: '0.375rem', border: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                          <span style={{ fontSize: '0.85rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.3rem' }}><User size={13} color="var(--primary)" />{a.annotator_name}</span>
                          {a.class_label && <span className="badge badge-success">{a.class_label}</span>}
                        </div>
                        {a.spans && a.spans.length > 0 && (
                          <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                            {a.spans.map((s, idx) => (
                              <span key={idx} style={{ fontSize: '0.75rem', padding: '0.1rem 0.35rem', borderRadius: '0.25rem', background: 'rgba(56,189,248,0.15)', border: '1px solid rgba(56,189,248,0.3)' }}>
                                <strong>{s.label}</strong>: "{s.text || selectedDoc.text.slice(s.start, s.end)}" [{s.start}:{s.end}]
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {role !== 'viewer' && (
                <div className="card">
                  <h4 style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>Submit Annotation</h4>
                  <form onSubmit={handleSubmit}>
                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                      <div><input value={annotatorName} onChange={(e) => setAnnotatorName(e.target.value)} placeholder="Annotator name" /></div>
                      {task.task_type === 'classification' ? (
                        <div><select value={classLabel} onChange={(e) => setClassLabel(e.target.value)}>{task.labels_schema.map((l) => <option key={l} value={l}>{l}</option>)}</select></div>
                      ) : (
                        <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center', flexWrap: 'wrap' }}>
                          <input type="number" value={spanStart} onChange={(e) => setSpanStart(parseInt(e.target.value) || 0)} style={{ width: '60px' }} placeholder="Start" />
                          <input type="number" value={spanEnd} onChange={(e) => setSpanEnd(parseInt(e.target.value) || 0)} style={{ width: '60px' }} placeholder="End" />
                          <select value={spanLabel} onChange={(e) => setSpanLabel(e.target.value)}>{task.labels_schema.map((l) => <option key={l} value={l}>{l}</option>)}</select>
                          <button type="button" onClick={handleAddSpan} className="btn btn-secondary">+ Span</button>
                        </div>
                      )}
                    </div>
                    {activeSpans.length > 0 && (
                      <div style={{ display: 'flex', gap: '0.3rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                        {activeSpans.map((s, idx) => <span key={idx} className="badge badge-primary">{s.label}: "{s.text}"</span>)}
                      </div>
                    )}
                    <button type="submit" className="btn btn-primary">Save Annotation</button>
                  </form>
                </div>
              )}
            </div>
          ) : <div className="card" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Select an item.</div>}
        </div>
      </div>

      {advisoryOpen && (
        <div className="modal-overlay">
          <div className="modal-box">
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem' }}><BrainCircuit color="var(--accent)" /> Advisory Dispute Diagnosis</h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>{advisoryResult?.advisory_disclaimer || 'Advisory explanation.'}</p>
            {advisoryLoading ? <div>Analyzing...</div> : advisoryResult?.status === 'success' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ background: 'var(--bg-subtle)', padding: '0.6rem', borderRadius: '0.375rem' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--primary)' }}>Analysis</div>
                  <p style={{ fontSize: '0.85rem' }}>{advisoryResult.analysis}</p>
                </div>
                {advisoryResult.guideline_recommendation && (
                  <div style={{ background: 'var(--bg-subtle)', padding: '0.6rem', borderRadius: '0.375rem' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--warning)' }}>Recommendation</div>
                    <p style={{ fontSize: '0.85rem' }}>{advisoryResult.guideline_recommendation}</p>
                  </div>
                )}
              </div>
            ) : <div style={{ color: 'var(--danger)' }}>{advisoryResult?.error_message || 'Unavailable'}</div>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}><button onClick={() => setAdvisoryOpen(false)} className="btn btn-secondary">Close</button></div>
          </div>
        </div>
      )}
    </div>
  );
};
