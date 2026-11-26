import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AuditTrailView } from './AuditTrailView';
import { api } from '../api/client';
import { AuditLogEntry } from '../types/api';

const makeLog = (overrides: Partial<AuditLogEntry>): AuditLogEntry => ({
  id: 'log-1',
  event_type: 'TASK_CREATED',
  user_id: 'user-1',
  user_email: 'analyst@example.com',
  entity_type: 'Task',
  entity_id: 'task-abcdef123456',
  details: { name: 'Demo Task' },
  created_at: new Date().toISOString(),
  ...overrides,
});

describe('AuditTrailView filtering', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('loads audit logs on mount and renders rows', async () => {
    vi.spyOn(api.audit, 'list').mockResolvedValue([makeLog({})]);
    render(<AuditTrailView />);
    await waitFor(() => {
      expect(screen.getByText('TASK_CREATED')).toBeInTheDocument();
    });
    expect(screen.getByText('analyst@example.com')).toBeInTheDocument();
    expect(api.audit.list).toHaveBeenCalledWith({ event_type: undefined, entity_type: undefined, user_id: undefined });
  });

  it('applies event_type filter when the form is submitted', async () => {
    const spy = vi.spyOn(api.audit, 'list').mockResolvedValue([makeLog({ event_type: 'TASK_CREATED' })]);
    render(<AuditTrailView />);
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(1));

    fireEvent.change(screen.getByPlaceholderText('e.g. TASK_CREATED'), { target: { value: 'TASK_CREATED' } });
    fireEvent.click(screen.getByRole('button', { name: /apply filters/i }));

    await waitFor(() => expect(spy).toHaveBeenCalledTimes(2));
    expect(spy).toHaveBeenLastCalledWith({ event_type: 'TASK_CREATED', entity_type: undefined, user_id: undefined });
  });

  it('clears filters and reloads the full log', async () => {
    const spy = vi.spyOn(api.audit, 'list').mockResolvedValue([]);
    render(<AuditTrailView />);
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(1));

    fireEvent.change(screen.getByPlaceholderText('e.g. Task'), { target: { value: 'Task' } });
    fireEvent.click(screen.getByRole('button', { name: /apply filters/i }));
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(2));

    fireEvent.click(screen.getByRole('button', { name: /^clear$/i }));
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(3));
    expect(spy).toHaveBeenLastCalledWith({ event_type: undefined, entity_type: undefined, user_id: undefined });
  });

  it('shows an error message when loading fails', async () => {
    vi.spyOn(api.audit, 'list').mockRejectedValue(new Error('HTTP 500 boom'));
    render(<AuditTrailView />);
    await waitFor(() => {
      expect(screen.getByText('HTTP 500 boom')).toBeInTheDocument();
    });
  });
});
