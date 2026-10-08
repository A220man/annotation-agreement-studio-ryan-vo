import json
from collections import Counter
from typing import List, Dict, Any, Optional, Tuple
from backend.app.services.agreement_engine import SpanItem, tokenize_with_offsets, spans_to_bio_tags

class ReconciliationResult:
    def __init__(self, task_type: str, class_label: Optional[str] = None, spans: Optional[List[Dict[str, Any]]] = None, agreement_ratio: float = 1.0, strategy_used: str = "majority_vote", notes: str = ""):
        self.task_type = task_type
        self.class_label = class_label
        self.spans = spans or []
        self.agreement_ratio = agreement_ratio
        self.strategy_used = strategy_used
        self.notes = notes

def reconcile_classification(annotations: List[Dict[str, Any]], strategy: str = "majority_vote", priority_annotator_id: Optional[str] = None) -> ReconciliationResult:
    if not annotations: return ReconciliationResult("classification", None, agreement_ratio=0.0)
    labels = [a.get("class_label") for a in annotations if a.get("class_label")]
    if not labels: return ReconciliationResult("classification", None, agreement_ratio=0.0)
    counts = Counter(labels)
    if strategy == "expert_priority" and priority_annotator_id:
        for a in annotations:
            if a.get("annotator_id") == priority_annotator_id and a.get("class_label"):
                return ReconciliationResult("classification", a["class_label"], agreement_ratio=round(counts[a["class_label"]] / len(labels), 4), strategy_used="expert_priority", notes=f"Expert: {priority_annotator_id}")
    top_label, top_count = counts.most_common(1)[0]
    return ReconciliationResult("classification", top_label, agreement_ratio=round(top_count / len(labels), 4), strategy_used="majority_vote", notes=f"Majority: {top_count}/{len(labels)}")

def reconcile_spans(annotations: List[Dict[str, Any]], text: str, strategy: str = "majority_vote", priority_annotator_id: Optional[str] = None, min_overlap_ratio: float = 0.5) -> ReconciliationResult:
    if not annotations: return ReconciliationResult("span", spans=[], agreement_ratio=0.0)
    total_raters = len(annotations)
    if strategy == "expert_priority" and priority_annotator_id:
        for a in annotations:
            if a.get("annotator_id") == priority_annotator_id:
                return ReconciliationResult("span", spans=a.get("spans") or [], strategy_used="expert_priority")

    all_spans: List[Tuple[SpanItem, str]] = []
    for ann in annotations:
        rater = ann.get("annotator_id", "rater")
        for s in ann.get("spans") or []:
            all_spans.append((SpanItem(start=s["start"], end=s["end"], label=s["label"], text=s.get("text")), rater))

    if not all_spans: return ReconciliationResult("span", spans=[], agreement_ratio=1.0)

    clusters: List[List[Tuple[SpanItem, str]]] = []
    for item, rater in all_spans:
        placed = False
        for c in clusters:
            if any(cand[0].label == item.label and max(cand[0].start, item.start) < min(cand[0].end, item.end) for cand in c):
                c.append((item, rater)); placed = True; break
        if not placed: clusters.append([(item, rater)])

    reconciled = []
    for cluster in clusters:
        unique_raters = len(set(r for _, r in cluster))
        ratio = unique_raters / total_raters
        if strategy == "majority_vote" and ratio < min_overlap_ratio: continue
        starts = [s.start for s, _ in cluster]
        ends = [s.end for s, _ in cluster]
        if strategy == "union": f_start, f_end = min(starts), max(ends)
        elif strategy == "intersection":
            f_start, f_end = max(starts), min(ends)
            if f_start >= f_end: f_start, f_end = sorted(starts)[len(starts)//2], sorted(ends)[len(ends)//2]
        else: f_start, f_end = sorted(starts)[len(starts)//2], sorted(ends)[len(ends)//2]

        span_text = text[f_start:f_end] if 0 <= f_start < f_end <= len(text) else ""
        reconciled.append({"start": f_start, "end": f_end, "label": cluster[0][0].label, "text": span_text, "confidence": round(ratio, 2)})

    reconciled.sort(key=lambda x: x["start"])
    return ReconciliationResult("span", spans=reconciled, agreement_ratio=round(len(reconciled) / max(1, len(clusters)), 4), strategy_used=strategy)

def export_to_jsonl(records: List[Dict[str, Any]]) -> str:
    return "\n".join(json.dumps(r, ensure_ascii=False) for r in records)

def export_to_conll(records: List[Dict[str, Any]]) -> str:
    out = []
    for doc in records:
        toks = tokenize_with_offsets(doc.get("text", ""))
        tags = spans_to_bio_tags(toks, [SpanItem(start=s["start"], end=s["end"], label=s["label"]) for s in doc.get("spans", [])])
        out.append(f"# -DOCSTART- {doc.get('id', '')}")
        for (t, _, _), tag in zip(toks, tags): out.append(f"{t}\t{tag}")
        out.append("")
    return "\n".join(out)

def export_to_huggingface(records: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    dataset = []
    for doc in records:
        toks = tokenize_with_offsets(doc.get("text", ""))
        tags = spans_to_bio_tags(toks, [SpanItem(start=s["start"], end=s["end"], label=s["label"]) for s in doc.get("spans", [])])
        dataset.append({"id": doc.get("id"), "tokens": [t[0] for t in toks], "ner_tags": tags, "text": doc.get("text")})
    return dataset
