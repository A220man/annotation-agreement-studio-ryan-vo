import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { ReconciliationQueue } from './ReconciliationQueue';
import { AuthProvider } from '../context/AuthContext';
import { api } from '../api/client';
import { Task, DocumentItem, ConsensusRecord } from '../types/api';

const mockTask: Task = {
  id: 'task-test-1',
  name: 'Span Reconciliation Task',
  task_type: 'span',
  labels_schema: ['ORG', 'LOC'],
  document_count: 2,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const mockDocuments: DocumentItem[] = [
  { id: 'doc-1', task_id: 'task-test-1', text: 'Apple is in Cupertino.', metadata: {}, annotation_count: 2, has_consensus: true, created_at: new Date().toISOString() },
  { id: 'doc-2', task_id: 'task-test-1', text: 'Microsoft is in Redmond.', metadata: {}, annotation_count: 2, has_consensus: true, created_at: new Date().toISOString() },
];

const mockConsensus: ConsensusRecord[] = [
  {
    id: 'cons-1',
    task_id: 'task-test-1',
    document_id: 'doc-1',
    reconciled_by: 'system',
    status: 'approved',
    task_type: 'span',
    class_label: 'TECH',
    spans: [{ start: 0, end: 5, label: 'ORG', text: 'Apple' }],
    reconciliation_method: 'majority_vote',
    notes: 'Auto reconciled',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

const renderWithAuth = (ui: React.ReactElement) => {
  return render(<AuthProvider>{ui}</AuthProvider>);
};

describe('ReconciliationQueue Export Controls', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(api.tasks, 'listDocuments').mockResolvedValue(mockDocuments);
    vi.spyOn(api.reconciliation, 'listConsensus').mockResolvedValue(mockConsensus);
  });

  it('renders export buttons for JSONL, CoNLL, and HuggingFace for span tasks', async () => {
    renderWithAuth(<ReconciliationQueue task={mockTask} />);

    await waitFor(() => {
      expect(screen.getByRole('link', { name: /JSONL/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /CoNLL/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /HuggingFace/i })).toBeInTheDocument();
    });
  });

  it('JSONL export link has correct href', async () => {
    renderWithAuth(<ReconciliationQueue task={mockTask} />);

    await waitFor(() => {
      const jsonlLink = screen.getByRole('link', { name: /JSONL/i });
      expect(jsonlLink).toHaveAttribute('href', '/api/reconciliation/export/task-test-1?format=jsonl');
      expect(jsonlLink).toHaveAttribute('download', '');
    });
  });

  it('CoNLL export link has correct href', async () => {
    renderWithAuth(<ReconciliationQueue task={mockTask} />);

    await waitFor(() => {
      const conllLink = screen.getByRole('link', { name: /CoNLL/i });
      expect(conllLink).toHaveAttribute('href', '/api/reconciliation/export/task-test-1?format=conll');
      expect(conllLink).toHaveAttribute('download', '');
    });
  });

  it('HuggingFace export link has correct href', async () => {
    renderWithAuth(<ReconciliationQueue task={mockTask} />);

    await waitFor(() => {
      const hfLink = screen.getByRole('link', { name: /HuggingFace/i });
      expect(hfLink).toHaveAttribute('href', '/api/reconciliation/export/task-test-1?format=huggingface');
      expect(hfLink).toHaveAttribute('download', '');
    });
  });

  it('does not show CoNLL or HuggingFace for classification tasks', async () => {
    const classificationTask: Task = { ...mockTask, task_type: 'classification' };
    renderWithAuth(<ReconciliationQueue task={classificationTask} />);

    await waitFor(() => {
      expect(screen.getByRole('link', { name: /JSONL/i })).toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /CoNLL/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /HuggingFace/i })).not.toBeInTheDocument();
    });
  });
});