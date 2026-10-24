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
    <div className="page-container">
      <h2 className="audit-title">Audit Trail</h2>
      <p className="audit-subtitle">Immutable event log of system mutations.</p>

      {loading ? <div className="loading-state">Loading audit records...</div> : logs.length === 0 ? (
        <div className="card empty-state">No audit records.</div>
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
