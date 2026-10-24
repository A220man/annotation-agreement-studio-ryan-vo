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
      if (docs.length > 0 && !selectedDocId) setSelectedDocId(docs[0].id);
    });
  }, [task]);

  useEffect(() => {
    if (!task || !selectedDocId) return;
    api.annotations.list(task.id, selectedDocId).then(setAnnotations);
  }, [task, selectedDocId]);

  if (!task) return <div className="empty-state">Select a task to open workbench.</div>;

  const selectedDoc = documents.find((d) => d.id === selectedDocId);

  const handleAddSpan = () => {
    if (!spanLabel || spanStart >= spanEnd) return;
    const text = selectedDoc?.text.substring(spanStart, spanEnd);
    setActiveSpans([...activeSpans, { start: spanStart, end: spanEnd, label: spanLabel, text }]);
    setSpanStart(0);
    setSpanEnd(5);
    setSpanLabel('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!task || !selectedDocId) return;
    const payload: any = { task_id: task.id, document_id: selectedDocId, annotator_name: annotatorName, task_type: task.task_type };
    if (task.task_type === 'classification') payload.class_label = classLabel;
    else payload.spans = activeSpans;
    await api.annotations.submit(payload);
    api.annotations.list(task.id, selectedDocId).then(setAnnotations);
    setActiveSpans([]);
    setClassLabel('');
  };

  const handleDiagnose = async () => {
    setAdvisoryLoading(true);
    try {
      const conflicts = annotations.filter(a => a.annotator_name !== annotatorName);
      const result = await api.advisory.diagnose({
        document_text: selectedDoc?.text || '',
        task_type: task.task_type,
        conflicting_annotations: conflicts,
      });
      setAdvisoryResult(result);
      setAdvisoryOpen(true);
    } finally {
      setAdvisoryLoading(false);
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h2 className="page-title">Annotation Workbench</h2>
          <p className="page-subtitle">Task: {task.name} ({task.task_type})</p>
        </div>
      </div>

      <div className="workbench-grid">
        <div className="workbench-docs">
          <div className="workbench-docs-header">
            <span style={{ fontWeight: 600 }}>Documents</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{documents.length}</span>
          </div>
          <div className="workbench-doc-list">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className={`workbench-doc-item ${selectedDocId === doc.id ? 'workbench-doc-item-active' : ''}`}
                onClick={() => setSelectedDocId(doc.id)}
              >
                <div className="workbench-doc-title">{doc.text.substring(0, 60)}...</div>
                <div className="workbench-doc-meta">{doc.annotation_count} annotations</div>
              </div>
            ))}
          </div>
        </div>

        <div className="workbench-editor">
          <div className="card">
            <h3 className="card-title">Document Text</h3>
            <div className="workbench-text">{selectedDoc?.text || 'No document selected'}</div>
          </div>

          {role === 'analyst' || role === 'admin' ? (
            <form onSubmit={handleSubmit} className="workbench-form">
              <h3 className="card-title">Create Annotation</h3>
              <div className="form-group">
                <label className="form-label">Annotator Name</label>
                <input value={annotatorName} onChange={(e) => setAnnotatorName(e.target.value)} className="form-input" required />
              </div>

              {task.task_type === 'classification' ? (
                <div className="form-group">
                  <label className="form-label">Class Label</label>
                  <select value={classLabel} onChange={(e) => setClassLabel(e.target.value)} className="form-input" required>
                    {task.labels_schema.map((l: string) => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
              ) : (
                <>
                  <div className="form-group">
                    <label className="form-label">Add Span</label>
                    <div className="workbench-span-form">
                      <input type="number" value={spanStart} onChange={(e) => setSpanStart(Number(e.target.value))} className="form-input workbench-span-input" placeholder="Start" min="0" />
                      <input type="number" value={spanEnd} onChange={(e) => setSpanEnd(Number(e.target.value))} className="form-input workbench-span-input" placeholder="End" min="1" />
                      <select value={spanLabel} onChange={(e) => setSpanLabel(e.target.value)} className="form-input workbench-span-input" required>
                        <option value="">Select label</option>
                        {task.labels_schema.map((l: string) => <option key={l} value={l}>{l}</option>)}
                      </select>
                      <button type="button" onClick={handleAddSpan} className="btn btn-primary" style={{ padding: '0.45rem 0.85rem' }}>Add</button>
                    </div>
                  </div>
                  {activeSpans.length > 0 && (
                    <div className="workbench-active-spans">
                      {activeSpans.map((s, i) => (
                        <span key={i} className="workbench-active-span">
                          [{s.start}:{s.end}] {s.label} {s.text && `("${s.text}")`}
                        </span>
                      ))}
                    </div>
                  )}
                </>
              )}

              <button type="submit" className="btn btn-primary"><User size={15} /> Submit Annotation</button>
            </form>
          ) : (
            <p className="empty-state">View-only mode. Requires analyst or admin role.</p>
          )}

          {selectedDoc && annotations.length > 1 && (role === 'analyst' || role === 'admin') && (
            <div className="card">
              <h3 className="card-title">Advisory LLM Analysis</h3>
              <button onClick={handleDiagnose} disabled={advisoryLoading} className="btn btn-outline workbench-advisory-btn">
                <BrainCircuit size={15} /> {advisoryLoading ? 'Analyzing...' : 'Explain Conflicts'}
              </button>
            </div>
          )}

          {advisoryOpen && advisoryResult && (
            <div className="advisory-panel">
              <div className="advisory-header">
                <span className="advisory-title">Advisory Analysis</span>
                <button onClick={() => setAdvisoryOpen(false)} style={{ background: 'transparent', color: 'var(--text-muted)' }}>✕</button>
              </div>
              <div className="advisory-body">
                <div className="advisory-result">{advisoryResult.analysis || 'No analysis available'}</div>
                {advisoryResult.guideline_recommendation && (
                  <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'rgba(56,189,248,0.1)', borderRadius: '0.375rem', border: '1px solid var(--primary)' }}>
                    <strong>Guideline Recommendation:</strong> {advisoryResult.guideline_recommendation}
                  </div>
                )}
                <div className="advisory-disclaimer">{advisoryResult.advisory_disclaimer}</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
