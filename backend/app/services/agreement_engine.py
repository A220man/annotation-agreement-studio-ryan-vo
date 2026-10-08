import math
import re
from typing import List, Dict, Tuple, Optional
from pydantic import BaseModel

class SpanItem(BaseModel):
    start: int
    end: int
    label: str
    text: Optional[str] = None

class PairwiseMetric(BaseModel):
    annotator_1: str
    annotator_2: str
    cohen_kappa: float
    observed_agreement: float
    expected_agreement: float
    items_compared: int
    interpretation: str

class DisagreementPair(BaseModel):
    label_1: str
    label_2: str
    count: int
    percentage: float

class BoundaryDiagnostic(BaseModel):
    document_id: str
    annotator_1: str
    annotator_2: str
    label: str
    span_1: Tuple[int, int]
    span_2: Tuple[int, int]
    text_1: str
    text_2: str
    misalignment_type: str
    offset_difference: int

class AgreementSummary(BaseModel):
    task_id: str
    task_type: str
    total_documents: int
    total_annotations: int
    annotator_ids: List[str]
    cohen_kappas: List[PairwiseMetric]
    overall_mean_kappa: float
    fleiss_kappa: Optional[float] = None
    krippendorff_alpha: Optional[float] = None
    token_span_f1: Optional[float] = None
    span_exact_match_ratio: Optional[float] = None
    disagreement_matrix: Dict[str, Dict[str, int]]
    top_disagreements: List[DisagreementPair]
    boundary_diagnostics: List[BoundaryDiagnostic]
    outlier_annotators: List[str]

def interpret_kappa(k: float) -> str:
    if k < 0.0: return "Poor (< 0.00)"
    if k <= 0.20: return "Slight (0.00 - 0.20)"
    if k <= 0.40: return "Fair (0.21 - 0.40)"
    if k <= 0.60: return "Moderate (0.41 - 0.60)"
    if k <= 0.80: return "Substantial (0.61 - 0.80)"
    return "Almost Perfect (0.81 - 1.00)"

def compute_cohen_kappa(ratings_1: List[str], ratings_2: List[str]) -> Tuple[float, float, float]:
    if not ratings_1 or len(ratings_1) != len(ratings_2): return 0.0, 0.0, 0.0
    n = len(ratings_1)
    if n == 0: return 0.0, 0.0, 0.0
    categories = sorted(list(set(ratings_1) | set(ratings_2)))
    cat_to_idx = {c: i for i, c in enumerate(categories)}
    num_cats = len(categories)
    if num_cats <= 1: return 1.0, 1.0, 1.0

    matrix = [[0] * num_cats for _ in range(num_cats)]
    for r1, r2 in zip(ratings_1, ratings_2): matrix[cat_to_idx[r1]][cat_to_idx[r2]] += 1
    observed = sum(matrix[i][i] for i in range(num_cats)) / n
    row_sums = [sum(matrix[i][j] for j in range(num_cats)) for i in range(num_cats)]
    col_sums = [sum(matrix[i][j] for i in range(num_cats)) for j in range(num_cats)]
    expected = sum(row_sums[i] * col_sums[i] for i in range(num_cats)) / (n * n)

    kappa = 1.0 if math.isclose(expected, 1.0, abs_tol=1e-9) else (observed - expected) / (1.0 - expected)
    return round(kappa, 4), round(observed, 4), round(expected, 4)

def compute_fleiss_kappa(ratings_matrix: List[List[str]]) -> Optional[float]:
    valid_items = [item for item in ratings_matrix if len(item) >= 2]
    if not valid_items: return None
    all_categories = sorted(list({c for item in valid_items for c in item}))
    k = len(all_categories)
    if k <= 1: return 1.0
    cat_idx = {c: idx for idx, c in enumerate(all_categories)}
    n = min(len(item) for item in valid_items)
    valid_items = [item[:n] for item in valid_items]
    m = len(valid_items)
    if n < 2 or m == 0: return None

    counts = [[0] * k for _ in range(m)]
    for i, item in enumerate(valid_items):
        for cat in item: counts[i][cat_idx[cat]] += 1

    p_j = [sum(counts[i][j] for i in range(m)) / (m * n) for j in range(k)]
    p_i = [(sum(counts[i][j] ** 2 for j in range(k)) - n) / (n * (n - 1)) for i in range(m)]
    mean_p = sum(p_i) / m
    mean_pe = sum(pj ** 2 for pj in p_j)
    if math.isclose(mean_pe, 1.0, abs_tol=1e-9): return 1.0
    return round((mean_p - mean_pe) / (1.0 - mean_pe), 4)

def compute_krippendorff_alpha_nominal(units_ratings: List[Dict[str, str]]) -> Optional[float]:
    if not units_ratings: return None
    values = sorted(list({v for u in units_ratings for v in u.values()}))
    v_len = len(values)
    if v_len <= 1: return 1.0
    val_idx = {v: i for i, v in enumerate(values)}
    coincidence = [[0.0] * v_len for _ in range(v_len)]
    total_pairs = 0.0

    for unit in units_ratings:
        ratings = list(unit.values())
        m_u = len(ratings)
        if m_u < 2: continue
        factor = 1.0 / (m_u - 1)
        for i in range(m_u):
            for j in range(m_u):
                if i != j:
                    coincidence[val_idx[ratings[i]]][val_idx[ratings[j]]] += factor
                    total_pairs += factor

    if total_pairs == 0: return None
    obs_disagreement = sum(coincidence[i][j] for i in range(v_len) for j in range(v_len) if i != j)
    n_v = [sum(coincidence[i][j] for j in range(v_len)) for i in range(v_len)]
    total_n = sum(n_v)
    if total_n <= 1: return 1.0
    exp_disagreement = sum(n_v[i] * n_v[j] for i in range(v_len) for j in range(v_len) if i != j) / (total_n - 1)
    if math.isclose(exp_disagreement, 0.0, abs_tol=1e-9): return 1.0
    return round(1.0 - (obs_disagreement / exp_disagreement), 4)

def tokenize_with_offsets(text: str) -> List[Tuple[str, int, int]]:
    return [(m.group(), m.start(), m.end()) for m in re.finditer(r'\S+', text)]

def spans_to_bio_tags(tokens: List[Tuple[str, int, int]], spans: List[SpanItem]) -> List[str]:
    tags = ["O"] * len(tokens)
    for span in sorted(spans, key=lambda s: (s.start, s.end)):
        first = True
        for idx, (_, ts, te) in enumerate(tokens):
            if max(ts, span.start) < min(te, span.end):
                tags[idx] = f"B-{span.label}" if first else f"I-{span.label}"
                first = False
    return tags

def compute_span_iou(s1: SpanItem, s2: SpanItem) -> float:
    if s1.label != s2.label: return 0.0
    inter = max(0, min(s1.end, s2.end) - max(s1.start, s2.start))
    if inter == 0: return 0.0
    union = max(1, max(s1.end, s2.end) - min(s1.start, s2.start))
    return round(inter / union, 4)

def compute_span_overlap_f1(spans_1: List[SpanItem], spans_2: List[SpanItem], min_iou: float = 0.5) -> Tuple[float, float, float]:
    if not spans_1 and not spans_2: return 1.0, 1.0, 1.0
    if not spans_1 or not spans_2: return 0.0, 0.0, 0.0
    matched_2 = set()
    tp = 0
    for s1 in spans_1:
        best_match = None
        best_iou = 0.0
        for idx, s2 in enumerate(spans_2):
            if idx not in matched_2 and s1.label == s2.label:
                iou = compute_span_iou(s1, s2)
                if iou >= min_iou and iou > best_iou:
                    best_iou, best_match = iou, idx
        if best_match is not None:
            tp += 1
            matched_2.add(best_match)
    p = tp / len(spans_1) if spans_1 else 0.0
    r = tp / len(spans_2) if spans_2 else 0.0
    f1 = (2 * p * r) / (p + r) if (p + r) > 0 else 0.0
    return round(p, 4), round(r, 4), round(f1, 4)

def diagnose_boundary_misalignment(text: str, s1: SpanItem, s2: SpanItem, doc_id: str, a1: str, a2: str) -> Optional[BoundaryDiagnostic]:
    if (s1.start == s2.start and s1.end == s2.end) or max(s1.start, s2.start) >= min(s1.end, s2.end): return None
    t1, t2 = text[s1.start:s1.end], text[s2.start:s2.end]
    if t1.strip() == t2.strip(): m_type = "whitespace_trim"
    elif re.sub(r'^[^\w]+|[^\w]+$', '', t1) == re.sub(r'^[^\w]+|[^\w]+$', '', t2): m_type = "punctuation_boundary"
    elif s1.start > s2.start and s1.end == s2.end: m_type = "prefix_extension"
    elif s1.start == s2.start and s1.end != s2.end: m_type = "suffix_extension"
    else: m_type = "partial_shift"
    diff = abs((s1.end - s1.start) - (s2.end - s2.start)) + abs(s1.start - s2.start)
    return BoundaryDiagnostic(
        document_id=doc_id, annotator_1=a1, annotator_2=a2, label=s1.label,
        span_1=(s1.start, s1.end), span_2=(s2.start, s2.end), text_1=t1, text_2=t2,
        misalignment_type=m_type, offset_difference=diff
    )
