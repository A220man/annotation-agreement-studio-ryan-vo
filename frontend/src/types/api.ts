export interface User {
  user_id: string;
  email?: string;
  name?: string;
  roles: string[];
}

export interface Task {
  id: string;
  name: string;
  description?: string;
  task_type: 'classification' | 'span';
  guidelines?: string;
  labels_schema: string[];
  document_count: number;
  created_at: string;
  updated_at: string;
}

export interface DocumentItem {
  id: string;
  task_id: string;
  text: string;
  metadata: Record<string, any>;
  annotation_count: number;
  has_consensus: boolean;
  created_at: string;
}

export interface Span {
  start: number;
  end: number;
  label: string;
  text?: string;
  confidence?: number;
}

export interface Annotation {
  id: string;
  document_id: string;
  task_id: string;
  annotator_id: string;
  annotator_name: string;
  task_type: string;
  class_label?: string;
  spans: Span[];
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface PairwiseMetric {
  annotator_1: string;
  annotator_2: string;
  cohen_kappa: number;
  observed_agreement: number;
  expected_agreement: number;
  items_compared: number;
  interpretation: string;
}

export interface DisagreementPair {
  label_1: string;
  label_2: string;
  count: number;
  percentage: number;
}

export interface BoundaryDiagnostic {
  document_id: string;
  annotator_1: string;
  annotator_2: string;
  label: string;
  span_1: [number, number];
  span_2: [number, number];
  text_1: string;
  text_2: string;
  misalignment_type: string;
  offset_difference: number;
}

export interface AgreementSummary {
  task_id: string;
  task_type: string;
  total_documents: number;
  total_annotations: number;
  annotator_ids: string[];
  cohen_kappas: PairwiseMetric[];
  overall_mean_kappa: number;
  fleiss_kappa?: number;
  krippendorff_alpha?: number;
  token_span_f1?: number;
  span_exact_match_ratio?: number;
  disagreement_matrix: Record<string, Record<string, number>>;
  top_disagreements: DisagreementPair[];
  boundary_diagnostics: BoundaryDiagnostic[];
  outlier_annotators: string[];
}

export interface ConsensusRecord {
  id: string;
  document_id: string;
  task_id: string;
  reconciled_by: string;
  status: 'draft' | 'approved';
  task_type: string;
  class_label?: string;
  spans: Span[];
  reconciliation_method: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface AuditLogEntry {
  id: string;
  event_type: string;
  user_id: string;
  user_email?: string;
  entity_type: string;
  entity_id: string;
  details: Record<string, any>;
  created_at: string;
}

export interface BenchmarkReport {
  dataset_name: string;
  total_test_units: number;
  annotator_count: number;
  inter_annotator_metrics: {
    mean_cohen_kappa: number;
    fleiss_kappa: number;
    krippendorff_alpha: number;
    pairwise_kappas: Record<string, number>;
    average_span_overlap_f1: number;
  };
  adjudication_performance: {
    strategy: string;
    accuracy_against_ground_truth: number;
    resolved_items: number;
  };
  failure_modes_analyzed: Array<{
    case: string;
    impact: string;
    mitigation: string;
  }>;
  reproducible_command: string;
}
