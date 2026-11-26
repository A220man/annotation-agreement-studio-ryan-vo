import React, { useState, useEffect, useCallback } from 'react';
import { AuditLogEntry } from '../types/api';
import { api } from '../api/client';

interface AuditFilters {
  event_type: string;
  entity_type: string;
  user_id: string;
}

const EMPTY_FILTERS: AuditFilters = { event_type: '', entity_type: '', user_id: '' };

export const AuditTrailView: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<AuditFilters>(EMPTY_FILTERS);
  const [applied, setApplied] = useState<AuditFilters>(EMPTY_FILTERS);

  const load = useCallback(async (filters: AuditFilters) => {
    setLoading(true);
    setError(null);
    try {
      const active = {
        event_type: filters.event_type.trim() || undefined,
        entity_type: filters.entity_type.trim() || undefined,
        user_id: filters.user_id.trim() || undefined,
      };
      const data = await api.audit.list(active);
      setLogs(data);
      setApplied(filters);
    } catch (err: any) {
      setError(err?.message || 'Failed to load audit records');
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(EMPTY_FILTERS);
  }, [load]);

  const handleApply = (e: React.FormEvent) => {
    e.preventDefault();
    load(draft);
  };

  const handleClear = () => {
    setDraft(EMPTY_FILTERS);
    load(EMPTY_FILTERS);
  };

  const hasActiveFilters = applied.event_type || applied.entity_type || applied.user_id;

  return (
    <div className="page-container">
      <h2 className="audit-title">Audit Trail</h2>
      <p className="audit-subtitle">Immutable event log of system mutations.</p>

      <form className="card audit-filters" onSubmit={handleApply} style={{ padding: '12px', marginBottom: '12px' }}>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <label style={{ display: 'flex', flexDirection: 'column', fontSize: '12px' }}>
            Event type
            <input
              value={draft.event_type}
              onChange={(e) => setDraft({ ...draft, event_type: e.target.value })}
              placeholder="e.g. TASK_CREATED"
              style={{ marginTop: '2px' }}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', fontSize: '12px' }}>
            Entity type
            <input
              value={draft.entity_type}
              onChange={(e) => setDraft({ ...draft, entity_type: e.target.value })}
              placeholder="e.g. Task"
              style={{ marginTop: '2px' }}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', fontSize: '12px' }}>
            User ID
            <input
              value={draft.user_id}
              onChange={(e) => setDraft({ ...draft, user_id: e.target.value })}
              placeholder="Exact user id"
              style={{ marginTop: '2px' }}
            />
          </label>
          <button type="submit" className="btn btn-primary">Apply filters</button>
          <button type="button" className="btn" onClick={handleClear}>Clear</button>
        </div>
      </form>

      {error && <div className="card empty-state" style={{ color: '#b00020', marginBottom: '12px' }}>{error}</div>}

      {loading ? <div className="loading-state">Loading audit records...</div> : logs.length === 0 ? (
        <div className="card empty-state">
          {hasActiveFilters ? 'No audit records match the active filters.' : 'No audit records.'}
        </div>
      ) : (
        <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
          <div className="audit-table">
            <table>
              <thead>
                <tr>
                  <th>Timestamp</th><th>Event Type</th><th>Actor</th><th>Entity</th><th>Details</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td className="audit-timestamp">{new Date(log.created_at).toLocaleString()}</td>
                    <td><span className="badge badge-primary">{log.event_type}</span></td>
                    <td style={{ fontWeight: '500' }}>{log.user_email || log.user_id}</td>
                    <td className="audit-entity">{log.entity_type} ({log.entity_id.substring(0, 8)}...)</td>
                    <td className="audit-details">{JSON.stringify(log.details)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
