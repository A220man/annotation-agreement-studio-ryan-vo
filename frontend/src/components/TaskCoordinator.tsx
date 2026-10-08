import React, { useState, useEffect } from 'react';
import { Task } from '../types/api';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Plus, Database, Sparkles, Trash2 } from 'lucide-react';

interface TaskCoordinatorProps {
  selectedTaskId: string | null;
  onSelectTask: (task: Task) => void;
}

export const TaskCoordinator: React.FC<TaskCoordinatorProps> = ({ selectedTaskId, onSelectTask }) => {
  const { role } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [filterType, setFilterType] = useState<string>('');

  const [taskName, setTaskName] = useState('');
  const [taskType, setTaskType] = useState<'classification' | 'span'>('span');
  const [labelsStr, setLabelsStr] = useState('ORG, PER, MED, DOSAGE, DATE');

  const [importText, setImportText] = useState('');
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedTaskForImport, setSelectedTaskForImport] = useState<string | null>(null);

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const data = await api.tasks.list(filterType || undefined);
      setTasks(data);
      if (data.length > 0 && !selectedTaskId) onSelectTask(data[0]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTasks(); }, [filterType]);

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    const labels = labelsStr.split(',').map((s) => s.trim()).filter(Boolean);
    const newTask = await api.tasks.create({ name: taskName, task_type: taskType, labels_schema: labels });
    setShowCreateModal(false);
    setTaskName('');
    fetchTasks();
    onSelectTask(newTask);
  };

  const handleImportDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTaskForImport || !importText.trim()) return;
    const lines = importText.split('\n').filter((l) => l.trim().length > 0);
    await api.tasks.addDocuments(selectedTaskForImport, lines.map((text) => ({ text: text.trim() })));
    setShowImportModal(false);
    setImportText('');
    fetchTasks();
  };

  const handleSeedSampleData = async () => {
    setLoading(true);
    try {
      const spanTask = await api.tasks.create({
        name: 'Clinical & Financial Entity Spans', task_type: 'span',
        guidelines: 'Annotate exact boundaries. Exclude honorifics.',
        labels_schema: ['ORG', 'PER', 'MED', 'DOSAGE', 'DATE'],
      });

      await api.tasks.addDocuments(spanTask.id, [
        { text: 'Alphabet reported quarterly revenues above Wall Street estimates on Tuesday.' },
        { text: 'Dr. Sarah Lin prescribed amoxicillin 500mg for acute sinusitis symptoms.' },
      ]);

      const docs = await api.tasks.listDocuments(spanTask.id);
      if (docs.length >= 2) {
        await api.annotations.batchImport(spanTask.id, [
          {
            document_id: docs[0].id, annotator_id: 'annotator_1', annotator_name: 'Elena Rostova', task_type: 'span',
            spans: [{ start: 0, end: 8, label: 'ORG', text: 'Alphabet' }, { start: 43, end: 54, label: 'ORG', text: 'Wall Street' }, { start: 68, end: 75, label: 'DATE', text: 'Tuesday' }],
          },
          {
            document_id: docs[0].id, annotator_id: 'annotator_2', annotator_name: 'Marcus Chen', task_type: 'span',
            spans: [{ start: 0, end: 8, label: 'ORG', text: 'Alphabet' }, { start: 43, end: 55, label: 'ORG', text: 'Wall Street ' }, { start: 68, end: 75, label: 'DATE', text: 'Tuesday' }],
          },
          {
            document_id: docs[1].id, annotator_id: 'annotator_1', annotator_name: 'Elena Rostova', task_type: 'span',
            spans: [{ start: 4, end: 13, label: 'PER', text: 'Sarah Lin' }, { start: 25, end: 36, label: 'MED', text: 'amoxicillin' }, { start: 37, end: 42, label: 'DOSAGE', text: '500mg' }],
          },
          {
            document_id: docs[1].id, annotator_id: 'annotator_2', annotator_name: 'Marcus Chen', task_type: 'span',
            spans: [{ start: 0, end: 13, label: 'PER', text: 'Dr. Sarah Lin' }, { start: 25, end: 36, label: 'MED', text: 'amoxicillin' }, { start: 37, end: 42, label: 'DOSAGE', text: '500mg' }],
          },
        ]);
      }
      await fetchTasks();
      onSelectTask(spanTask);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '1280px', margin: '1.5rem auto', padding: '0 1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: '700' }}>Tasks</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Manage annotation datasets and schemas.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={handleSeedSampleData} className="btn btn-outline"><Sparkles size={16} color="var(--primary)" /> Seed Reference Data</button>
          {role !== 'viewer' && <button onClick={() => setShowCreateModal(true)} className="btn btn-primary"><Plus size={16} /> New Task</button>}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', alignItems: 'center' }}>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Type:</span>
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)}>
          <option value="">All Types</option>
          <option value="classification">Classification</option>
          <option value="span">Span Tagging</option>
        </select>
      </div>

      {loading ? <div style={{ textAlign: 'center', padding: '3rem' }}>Loading...</div> : tasks.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <Database size={36} color="var(--text-muted)" style={{ marginBottom: '0.5rem' }} />
          <h3>No tasks available</h3>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
          {tasks.map((t) => (
            <div key={t.id} onClick={() => onSelectTask(t)} className="card" style={{ borderColor: selectedTaskId === t.id ? 'var(--primary)' : 'var(--border)', cursor: 'pointer' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: '600' }}>{t.name}</h3>
                <span className={`badge ${t.task_type === 'span' ? 'badge-primary' : 'badge-success'}`}>{t.task_type.toUpperCase()}</span>
              </div>
              <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                {t.labels_schema.slice(0, 5).map((l) => (
                  <span key={l} style={{ fontSize: '0.7rem', padding: '0.1rem 0.35rem', background: 'var(--bg-subtle)', borderRadius: '0.25rem', border: '1px solid var(--border)' }}>{l}</span>
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border)', paddingTop: '0.4rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                <span>{t.document_count} units</span>
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  {role !== 'viewer' && <button onClick={(e) => { e.stopPropagation(); setSelectedTaskForImport(t.id); setShowImportModal(true); }} className="btn btn-secondary" style={{ padding: '0.2rem 0.4rem', fontSize: '0.75rem' }}>+ Docs</button>}
                  {role === 'admin' && <button onClick={(e) => { e.stopPropagation(); api.tasks.delete(t.id).then(fetchTasks); }} style={{ background: 'transparent', color: 'var(--danger)' }}><Trash2 size={13} /></button>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreateModal && (
        <div className="modal-overlay">
          <div className="modal-box">
            <h3 style={{ marginBottom: '0.75rem' }}>Create Task</h3>
            <form onSubmit={handleCreateTask}>
              <div style={{ marginBottom: '0.5rem' }}><label style={{ display: 'block', fontSize: '0.75rem' }}>Name</label><input required style={{ width: '100%' }} value={taskName} onChange={(e) => setTaskName(e.target.value)} /></div>
              <div style={{ marginBottom: '0.5rem' }}><label style={{ display: 'block', fontSize: '0.75rem' }}>Type</label><select style={{ width: '100%' }} value={taskType} onChange={(e) => setTaskType(e.target.value as any)}><option value="span">Span Tagging</option><option value="classification">Classification</option></select></div>
              <div style={{ marginBottom: '0.5rem' }}><label style={{ display: 'block', fontSize: '0.75rem' }}>Labels (comma-separated)</label><input required style={{ width: '100%' }} value={labelsStr} onChange={(e) => setLabelsStr(e.target.value)} /></div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}><button type="button" onClick={() => setShowCreateModal(false)} className="btn btn-secondary">Cancel</button><button type="submit" className="btn btn-primary">Create</button></div>
            </form>
          </div>
        </div>
      )}

      {showImportModal && (
        <div className="modal-overlay">
          <div className="modal-box">
            <h3 style={{ marginBottom: '0.5rem' }}>Import Text</h3>
            <form onSubmit={handleImportDoc}>
              <textarea required rows={5} style={{ width: '100%', marginBottom: '0.75rem' }} placeholder="One line per document..." value={importText} onChange={(e) => setImportText(e.target.value)} />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}><button type="button" onClick={() => setShowImportModal(false)} className="btn btn-secondary">Cancel</button><button type="submit" className="btn btn-primary">Import</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
