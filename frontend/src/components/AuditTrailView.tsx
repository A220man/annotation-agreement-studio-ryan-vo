import React, { useState, useEffect } from 'react';
import { AuditLogEntry } from '../types/api';
import { api } from '../api/client';

export const AuditTrailView: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.audit.list()
      .then(setLogs)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ maxWidth: '1280px', margin: '1.5rem auto', padding: '0 1.5rem' }}>
      <h2 style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '0.25rem' }}>Audit Trail</h2>
      <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>Immutable event log of system mutations.</p>

      {loading ? <div style={{ textAlign: 'center', padding: '3rem' }}>Loading audit records...</div> : logs.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>No audit records.</div>
      ) : (
        <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr style={{ background: 'var(--bg-subtle)' }}>
                  <th>Timestamp</th><th>Event Type</th><th>Actor</th><th>Entity</th><th>Details</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td style={{ whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>{new Date(log.created_at).toLocaleString()}</td>
                    <td><span className="badge badge-primary">{log.event_type}</span></td>
                    <td style={{ fontWeight: '500' }}>{log.user_email || log.user_id}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{log.entity_type} ({log.entity_id.substring(0, 8)}...)</td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{JSON.stringify(log.details)}</td>
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
