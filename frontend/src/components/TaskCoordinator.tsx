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
      const data = await api.tasks.list({ type: filterType || undefined });
      setTasks(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTasks(); }, [filterType]);

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    const labels = labelsStr.split(',').map(l => l.trim()).filter(Boolean);
    await api.tasks.create({ name: taskName, task_type: taskType, labels_schema: JSON.stringify(labels) });
    setShowCreateModal(false);
    setTaskName('');
    fetchTasks();
  };

  const handleImportDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTaskForImport) return;
    const docs = importText.split('\n').map(t => t.trim()).filter(Boolean);
    await api.tasks.importDocuments(selectedTaskForImport, docs);
    setShowImportModal(false);
    setImportText('');
    fetchTasks();
  };

  const handleSeedSampleData = async () => {
    if (!taskName.trim()) return;
    const labels = labelsStr.split(',').map(l => l.trim()).filter(Boolean);
    await api.tasks.seedSample({ name: taskName, task_type: taskType, labels_schema: JSON.stringify(labels) });
    setShowCreateModal(false);
    setTaskName('');
    fetchTasks();
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h2 className="page-title">Task Coordination</h2>
          <p className="page-subtitle">Manage annotation tasks, taxonomies, and document imports.</p>
        </div>
        {role === 'analyst' || role === 'admin' ? (
          <button onClick={() => setShowCreateModal(true)} className="btn btn-primary">
            <Plus size={15} /> New Task
          </button>
        ) : null}
      </div>

      {loading ? (
        <div className="loading-state">Loading tasks...</div>
      ) : tasks.length === 0 ? (
        <div className="card empty-state">
          {role === 'analyst' || role === 'admin' ? (
            <p>No tasks yet. Create your first task to get started.</p>
          ) : (
            <p>No tasks available.</p>
          )}
        </div>
      ) : (
        <div className="task-grid">
          <div className="task-list">
            {tasks.map((task) => (
              <div
                key={task.id}
                className={`task-card ${selectedTaskId === task.id ? 'task-card-active' : ''}`}
                onClick={() => onSelectTask(task)}
              >
                <div className="task-info">
                  <span className="task-name">{task.name}</span>
                  <span className="task-meta">
                    {task.task_type} • {task.labels_schema ? task.labels_schema.length : 0} labels • {task.documents?.length || 0} docs
                  </span>
                  <span className="task-type-badge">{task.task_type}</span>
                </div>
                <div className="task-actions">
                  <button
                    onClick={(e) => { e.stopPropagation(); setSelectedTaskForImport(task.id); setShowImportModal(true); }}
                    className="task-action-btn"
                    title="Import Documents"
                  >
                    <Database size={16} />
                  </button>
                  {role === 'admin' && (
                    <button
                      onClick={(e) => { e.stopPropagation(); api.tasks.delete(task.id).then(fetchTasks); }}
                      className="task-action-btn task-delete-btn"
                      title="Delete Task"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <aside>
            <div className="task-create-panel">
              <h3 className="task-create-title">Create Task</h3>
              <form onSubmit={handleCreateTask} className="form-group">
                <label className="form-label">Task Name</label>
                <input
                  value={taskName}
                  onChange={(e) => setTaskName(e.target.value)}
                  className="form-input"
                  placeholder="e.g., Clinical NER Annotation"
                  required
                />
                <label className="form-label">Task Type</label>
                <select value={taskType} onChange={(e) => setTaskType(e.target.value as 'classification' | 'span')} className="form-input">
                  <option value="span">Span Extraction (NER, PII, BIO)</option>
                  <option value="classification">Document Classification</option>
                </select>
                <label className="form-label">Labels (comma-separated)</label>
                <input
                  value={labelsStr}
                  onChange={(e) => setLabelsStr(e.target.value)}
                  className="form-input"
                  placeholder="ORG, PER, LOC, MISC"
                />
                <div className="modal-actions">
                  <button type="submit" className="btn btn-primary"><Plus size={15} /> Create</button>
                </div>
              </form>
              <button onClick={() => setShowImportModal(true)} className="btn btn-outline task-import-btn">
                <Database size={15} /> Import Documents
              </button>
              {showCreateModal && (
                <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
                  <div className="modal-box" onClick={(e) => e.stopPropagation()}>
                    <h3 className="modal-title">Create Sample Data</h3>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                      Generates 5 annotated documents across 3 annotators.
                    </p>
                    <div className="modal-actions">
                      <button type="button" onClick={() => setShowCreateModal(false)} className="btn btn-outline">Cancel</button>
                      <button type="button" onClick={handleSeedSampleData} className="btn btn-primary"><Sparkles size={15} /> Create Sample Data</button>
                    </div>
                  </div>
                </div>
              )}
              {showImportModal && (
                <div className="modal-overlay" onClick={() => setShowImportModal(false)}>
                  <div className="modal-box" onClick={(e) => e.stopPropagation()}>
                    <h3 className="modal-title">Import Documents</h3>
                    <form onSubmit={handleImportDoc} className="form-group">
                      <label className="form-label">Documents (one per line)</label>
                      <textarea
                        value={importText}
                        onChange={(e) => setImportText(e.target.value)}
                        className="form-input form-textarea"
                        placeholder="Enter text documents, one per line..."
                        required
                      />
                      <div className="modal-actions">
                        <button type="button" onClick={() => setShowImportModal(false)} className="btn btn-outline">Cancel</button>
                        <button type="submit" className="btn btn-primary"><Database size={15} /> Import</button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
};
