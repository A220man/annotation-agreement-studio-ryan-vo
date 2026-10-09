import json
from collections import defaultdict
from typing import Dict, List, Tuple
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import require_role, AuthenticatedUser
from app.models.entities import Task, Document, Annotation
from app.services.agreement_engine import (
    SpanItem, PairwiseMetric, DisagreementPair, BoundaryDiagnostic, AgreementSummary,
    interpret_kappa, compute_cohen_kappa, compute_fleiss_kappa, compute_krippendorff_alpha_nominal,
    tokenize_with_offsets, spans_to_bio_tags, compute_span_overlap_f1, diagnose_boundary_misalignment,
)

router = APIRouter(prefix="/agreement", tags=["Agreement"])

@router.get("/tasks/{task_id}", response_model=AgreementSummary)
def get_task_agreement_report(
    task_id: str,
    db: Session = Depends(get_db),
    user: AuthenticatedUser = Depends(require_role("viewer")),
):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    docs = db.query(Document).filter(Document.task_id == task_id).all()
    annotations = db.query(Annotation).filter(Annotation.task_id == task_id).all()
    annotator_ids = sorted(list({a.annotator_id for a in annotations}))
    doc_map = {d.id: d for d in docs}

    doc_anns: Dict[str, Dict[str, Annotation]] = defaultdict(dict)
    for a in annotations:
        doc_anns[a.document_id][a.annotator_id] = a

    pairwise_metrics: List[PairwiseMetric] = []
    disagreement_counts: Dict[str, Dict[str, int]] = defaultdict(lambda: defaultdict(int))
    boundary_diagnostics: List[BoundaryDiagnostic] = []
    span_f1_scores: List[float] = []
    span_exact_matches, span_comparisons = 0, 0
    kappas_per_rater: Dict[str, List[float]] = defaultdict(list)

    for i in range(len(annotator_ids)):
        for j in range(i + 1, len(annotator_ids)):
            ann1, ann2 = annotator_ids[i], annotator_ids[j]
            r1_list, r2_list = [], []

            for doc_id, rater_dict in doc_anns.items():
                if ann1 in rater_dict and ann2 in rater_dict:
                    a1, a2 = rater_dict[ann1], rater_dict[ann2]
                    doc_obj = doc_map.get(doc_id)

                    if task.task_type == "classification":
                        if a1.class_label and a2.class_label:
                            r1_list.append(a1.class_label)
                            r2_list.append(a2.class_label)
                            disagreement_counts[a1.class_label][a2.class_label] += 1
                            if a1.class_label != a2.class_label:
                                disagreement_counts[a2.class_label][a1.class_label] += 1
                    else:
                        s1 = [SpanItem(**s) for s in json.loads(a1.spans_json or "[]")]
                        s2 = [SpanItem(**s) for s in json.loads(a2.spans_json or "[]")]
                        _, _, f1 = compute_span_overlap_f1(s1, s2)
                        span_f1_scores.append(f1)
                        for item in s1:
                            span_comparisons += 1
                            if any(item.start == x.start and item.end == x.end and item.label == x.label for x in s2):
                                span_exact_matches += 1
                        if doc_obj:
                            toks = tokenize_with_offsets(doc_obj.text)
                            r1_list.extend(spans_to_bio_tags(toks, s1))
                            r2_list.extend(spans_to_bio_tags(toks, s2))
                            for item1 in s1:
                                for item2 in s2:
                                    diag = diagnose_boundary_misalignment(doc_obj.text, item1, item2, doc_id, ann1, ann2)
                                    if diag: boundary_diagnostics.append(diag)

            if r1_list:
                k, obs, exp = compute_cohen_kappa(r1_list, r2_list)
                pairwise_metrics.append(PairwiseMetric(
                    annotator_1=ann1, annotator_2=ann2, cohen_kappa=k, observed_agreement=obs,
                    expected_agreement=exp, items_compared=len(r1_list), interpretation=interpret_kappa(k)
                ))
                kappas_per_rater[ann1].append(k)
                kappas_per_rater[ann2].append(k)

    mean_k = round(sum(p.cohen_kappa for p in pairwise_metrics) / len(pairwise_metrics), 4) if pairwise_metrics else 1.0

    fleiss_k, kripp_a = None, None
    if task.task_type == "classification":
        f_matrix, k_units = [], []
        for rater_dict in doc_anns.values():
            if len(rater_dict) >= 2:
                row = [a.class_label for a in rater_dict.values() if a.class_label]
                if len(row) >= 2:
                    f_matrix.append(row)
                    k_units.append({uid: a.class_label for uid, a in rater_dict.items() if a.class_label})
        fleiss_k = compute_fleiss_kappa(f_matrix)
        kripp_a = compute_krippendorff_alpha_nominal(k_units)

    raw_pairs, seen = [], set()
    total_disagreements = 0
    for l1, tmap in disagreement_counts.items():
        for l2, cnt in tmap.items():
            if l1 != l2:
                pk = tuple(sorted([l1, l2]))
                if pk not in seen:
                    seen.add(pk)
                    raw_pairs.append((pk[0], pk[1], cnt))
                    total_disagreements += cnt

    raw_pairs.sort(key=lambda x: x[2], reverse=True)
    top_disagreements = [
        DisagreementPair(label_1=p[0], label_2=p[1], count=p[2], percentage=round((p[2] / max(1, total_disagreements)) * 100, 2))
        for p in raw_pairs[:10]
    ]

    outliers = [uid for uid, klist in kappas_per_rater.items() if (sum(klist) / len(klist)) < (mean_k - 0.20)]
    matrix_out = {l1: dict(tmap) for l1, tmap in disagreement_counts.items()}
    avg_f1 = round(sum(span_f1_scores) / len(span_f1_scores), 4) if span_f1_scores else None
    exact_ratio = round(span_exact_matches / span_comparisons, 4) if span_comparisons > 0 else None

    return AgreementSummary(
        task_id=task_id, task_type=task.task_type, total_documents=len(docs), total_annotations=len(annotations),
        annotator_ids=annotator_ids, cohen_kappas=pairwise_metrics, overall_mean_kappa=mean_k,
        fleiss_kappa=fleiss_k, krippendorff_alpha=kripp_a, token_span_f1=avg_f1, span_exact_match_ratio=exact_ratio,
        disagreement_matrix=matrix_out, top_disagreements=top_disagreements,
        boundary_diagnostics=boundary_diagnostics[:25], outlier_annotators=outliers
    )

@router.get("/documents/{document_id}")
def get_document_agreement(
    document_id: str,
    db: Session = Depends(get_db),
    user: AuthenticatedUser = Depends(require_role("viewer")),
):
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    annotations = db.query(Annotation).filter(Annotation.document_id == document_id).all()
    if len(annotations) < 2:
        return {"document_id": document_id, "status": "insufficient_annotations"}

    ann_map = {
        a.annotator_id: {"name": a.annotator_name, "class": a.class_label, "spans": json.loads(a.spans_json or "[]")}
        for a in annotations
    }
    return {"document_id": document_id, "task_type": doc.task.task_type, "annotations": ann_map}
