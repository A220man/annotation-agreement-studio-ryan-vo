import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AgreementDashboard } from './AgreementDashboard';
import { api } from '../api/client';
import { Task, AgreementSummary } from '../types/api';

const mockTask: Task = {
  id: 'task-test-1',
  name: 'Clinical Span Annotation',
  task_type: 'span',
  labels_schema: ['MED', 'DOSAGE'],
  document_count: 5,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const mockSummary: AgreementSummary = {
  task_id: 'task-test-1',
  task_type: 'span',
  total_documents: 5,
  total_annotations: 10,
  annotator_ids: ['ann_1', 'ann_2'],
  cohen_kappas: [
    {
      annotator_1: 'ann_1',
      annotator_2: 'ann_2',
      cohen_kappa: 0.85,
      observed_agreement: 0.9,
      expected_agreement: 0.35,
      items_compared: 15,
      interpretation: 'Almost Perfect (0.81 - 1.00)',
    },
  ],
  overall_mean_kappa: 0.85,
  fleiss_kappa: 0.82,
  krippendorff_alpha: 0.84,
  token_span_f1: 0.89,
  span_exact_match_ratio: 0.78,
  disagreement_matrix: {},
  top_disagreements: [],
  boundary_diagnostics: [],
  outlier_annotators: [],
};

describe('AgreementDashboard Export Controls', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(api.agreement, 'getTaskSummary').mockResolvedValue(mockSummary);
    vi.spyOn(api.agreement, 'exportReport').mockResolvedValue(undefined as any);
  });

  it('renders agreement metrics and export buttons', async () => {
    render(<AgreementDashboard task={mockTask} />);

    await waitFor(() => {
      expect(screen.getByText(/Agreement: Clinical Span Annotation/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Export JSON/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Export CSV/i })).toBeInTheDocument();
    });
  });

  it('triggers exportReport with json format on button click', async () => {
    render(<AgreementDashboard task={mockTask} />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Export JSON/i })).toBeInTheDocument();
    });

    const jsonBtn = screen.getByRole('button', { name: /Export JSON/i });
    fireEvent.click(jsonBtn);

    expect(api.agreement.exportReport).toHaveBeenCalledWith('task-test-1', 'json');
  });

  it('triggers exportReport with csv format on button click', async () => {
    render(<AgreementDashboard task={mockTask} />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Export CSV/i })).toBeInTheDocument();
    });

    const csvBtn = screen.getByRole('button', { name: /Export CSV/i });
    fireEvent.click(csvBtn);

    expect(api.agreement.exportReport).toHaveBeenCalledWith('task-test-1', 'csv');
  });
});
