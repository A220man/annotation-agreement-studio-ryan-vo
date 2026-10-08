import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from './App';
import { api } from './api/client';

describe('Annotation Agreement Studio Frontend', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(api.auth, 'getConfig').mockResolvedValue({
      demo_mode: true,
      environment: 'development',
      oidc_issuer_url: 'http://127.0.0.1:8080/realms/annotation-realm',
      oidc_client_id: 'annotation-agreement-studio-client',
      oidc_audience: 'annotation-agreement-studio',
      oidc_discovery_url: 'http://127.0.0.1:8080/realms/annotation-realm/.well-known/openid-configuration',
      supported_roles: ['viewer', 'analyst', 'admin'],
    });

    vi.spyOn(api.auth, 'getDemoToken').mockResolvedValue({
      access_token: 'synthetic-test-token',
      role: 'analyst',
      username: 'demo-analyst',
    });

    vi.spyOn(api.auth, 'getMe').mockResolvedValue({
      user_id: 'demo-analyst',
      name: 'Demo Analyst',
      email: 'analyst@example.com',
      roles: ['analyst', 'viewer'],
    });

    vi.spyOn(api.tasks, 'listDocuments').mockResolvedValue([]);

    vi.spyOn(api.tasks, 'list').mockResolvedValue([
      {
        id: 'task-test-1',
        name: 'Clinical Span Annotation',
        description: 'Testing medical entity recognition',
        task_type: 'span',
        labels_schema: ['MED', 'DOSAGE'],
        document_count: 5,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ]);

    vi.spyOn(api.evaluation, 'getBenchmark').mockResolvedValue({
      dataset_name: 'AgreementBench-Reference-NLP-v1',
      total_test_units: 5,
      annotator_count: 3,
      inter_annotator_metrics: {
        mean_cohen_kappa: 0.8123,
        fleiss_kappa: 0.7854,
        krippendorff_alpha: 0.8211,
        pairwise_kappas: { 'A_vs_B': 0.82 },
        average_span_overlap_f1: 0.892,
      },
      adjudication_performance: {
        strategy: 'majority_vote',
        accuracy_against_ground_truth: 1.0,
        resolved_items: 5,
      },
      failure_modes_analyzed: [
        {
          case: 'Boundary whitespace attachment',
          impact: 'Offset mismatch',
          mitigation: 'Whitespace trimming',
        },
      ],
      reproducible_command: 'PYTHONPATH=backend python3 -m backend.app.services.benchmark_eval',
    });
  });

  it('renders application title, Ryan Vo branding, and navigation tabs', async () => {
    render(<App />);
    expect(screen.getAllByText(/Annotation Agreement Studio/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Ryan Vo \| AI & Machine Learning/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Tasks/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Evaluation/i })).toBeInTheDocument();
  });

  it('switches between navigation tabs and displays task list', async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText('Clinical Span Annotation')).toBeInTheDocument();
    });

    const evalTab = screen.getByRole('button', { name: /Evaluation/i });
    fireEvent.click(evalTab);

    await waitFor(() => {
      expect(screen.getByText(/AI\/ML Evaluation & Benchmark/i)).toBeInTheDocument();
      expect(screen.getByText(/Data Provenance: AgreementBench-Reference-NLP-v1/i)).toBeInTheDocument();
    });
  });

  it('allows switching demo RBAC roles in navbar', async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /ADMIN/i })).toBeInTheDocument();
    });

    const adminBtn = screen.getByRole('button', { name: /ADMIN/i });
    fireEvent.click(adminBtn);

    await waitFor(() => {
      expect(api.auth.getDemoToken).toHaveBeenCalledWith('admin', 'demo-admin', 'admin@example.com');
    });
  });
});
