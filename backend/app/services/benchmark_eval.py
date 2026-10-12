from typing import Dict, Any, List
from app.services.agreement_engine import (
    compute_cohen_kappa,
    compute_fleiss_kappa,
    compute_krippendorff_alpha_nominal,
    compute_span_overlap_f1,
    SpanItem,
)
from app.services.reconciliation_engine import (
    reconcile_classification,
    reconcile_spans,
)

def _sp(items):
    return [{"start": s[0], "end": s[1], "label": s[2], "text": s[3]} for s in items]

BENCHMARK_DATASET = [
    {
        "id": "item-01",
        "text": "Alphabet reported quarterly revenues above Wall Street estimates on Tuesday.",
        "task_type": "span",
        "ground_truth_spans": _sp([(0, 8, "ORG", "Alphabet"), (43, 54, "ORG", "Wall Street"), (68, 75, "DATE", "Tuesday")]),
        "annotator_annotations": [
            {"annotator_id": "annotator_A", "spans": _sp([(0, 8, "ORG", "Alphabet"), (43, 54, "ORG", "Wall Street"), (68, 75, "DATE", "Tuesday")])},
            {"annotator_id": "annotator_B", "spans": _sp([(0, 8, "ORG", "Alphabet"), (43, 54, "MISC", "Wall Street"), (68, 75, "DATE", "Tuesday")])},
            {"annotator_id": "annotator_C", "spans": _sp([(0, 8, "ORG", "Alphabet"), (43, 55, "ORG", "Wall Street "), (68, 75, "DATE", "Tuesday")])},
        ],
    },
    {
        "id": "item-02",
        "text": "Dr. Sarah Lin prescribed amoxicillin 500mg for acute sinusitis symptoms.",
        "task_type": "span",
        "ground_truth_spans": _sp([(0, 13, "PER", "Dr. Sarah Lin"), (25, 36, "MED", "amoxicillin"), (37, 42, "DOSAGE", "500mg"), (47, 62, "CONDITION", "acute sinusitis")]),
        "annotator_annotations": [
            {"annotator_id": "annotator_A", "spans": _sp([(4, 13, "PER", "Sarah Lin"), (25, 36, "MED", "amoxicillin"), (37, 42, "DOSAGE", "500mg"), (47, 62, "CONDITION", "acute sinusitis")])},
            {"annotator_id": "annotator_B", "spans": _sp([(0, 13, "PER", "Dr. Sarah Lin"), (25, 36, "MED", "amoxicillin"), (37, 42, "DOSAGE", "500mg"), (47, 71, "CONDITION", "acute sinusitis symptoms")])},
            {"annotator_id": "annotator_C", "spans": _sp([(0, 13, "PER", "Dr. Sarah Lin"), (25, 36, "MED", "amoxicillin"), (37, 42, "DOSAGE", "500mg"), (47, 62, "CONDITION", "acute sinusitis")])},
        ],
    },
    {
        "id": "item-03",
        "text": "The patient denied chest pain, nausea, or shortness of breath.",
        "task_type": "classification",
        "ground_truth_label": "NEGATIVE_SYMPTOMS",
        "annotator_annotations": [
            {"annotator_id": "annotator_A", "class_label": "NEGATIVE_SYMPTOMS"},
            {"annotator_id": "annotator_B", "class_label": "NEGATIVE_SYMPTOMS"},
            {"annotator_id": "annotator_C", "class_label": "NEGATIVE_SYMPTOMS"},
        ],
    },
    {
        "id": "item-04",
        "text": "Service was adequate but delivery took over two weeks with zero updates.",
        "task_type": "classification",
        "ground_truth_label": "NEGATIVE",
        "annotator_annotations": [
            {"annotator_id": "annotator_A", "class_label": "NEGATIVE"},
            {"annotator_id": "annotator_B", "class_label": "MIXED"},
            {"annotator_id": "annotator_C", "class_label": "NEGATIVE"},
        ],
    },
    {
        "id": "item-05",
        "text": "The update broke core export functionality without providing any migration guide.",
        "task_type": "classification",
        "ground_truth_label": "BUG_REPORT",
        "annotator_annotations": [
            {"annotator_id": "annotator_A", "class_label": "BUG_REPORT"},
            {"annotator_id": "annotator_B", "class_label": "BUG_REPORT"},
            {"annotator_id": "annotator_C", "class_label": "FEATURE_REQUEST"},
        ],
    },
]

def run_evaluation_benchmark() -> Dict[str, Any]:
    class_items = [i for i in BENCHMARK_DATASET if i["task_type"] == "classification"]
    ratings_A = [item["annotator_annotations"][0]["class_label"] for item in class_items]
    ratings_B = [item["annotator_annotations"][1]["class_label"] for item in class_items]
    ratings_C = [item["annotator_annotations"][2]["class_label"] for item in class_items]

    fleiss_matrix = [[a["class_label"] for a in item["annotator_annotations"]] for item in class_items]
    kripp_units = [{a["annotator_id"]: a["class_label"] for a in item["annotator_annotations"]} for item in class_items]

    k_AB, _, _ = compute_cohen_kappa(ratings_A, ratings_B)
    k_AC, _, _ = compute_cohen_kappa(ratings_A, ratings_C)
    k_BC, _, _ = compute_cohen_kappa(ratings_B, ratings_C)
    mean_kappa = round((k_AB + k_AC + k_BC) / 3, 4)

    fleiss_k = compute_fleiss_kappa(fleiss_matrix)
    kripp_a = compute_krippendorff_alpha_nominal(kripp_units)

    span_items = [i for i in BENCHMARK_DATASET if i["task_type"] == "span"]
    f1_list = []
    for item in span_items:
        anns = {a["annotator_id"]: [SpanItem(**s) for s in a["spans"]] for a in item["annotator_annotations"]}
        _, _, f1_ab = compute_span_overlap_f1(anns["annotator_A"], anns["annotator_B"])
        _, _, f1_ac = compute_span_overlap_f1(anns["annotator_A"], anns["annotator_C"])
        f1_list.extend([f1_ab, f1_ac])
    avg_span_f1 = round(sum(f1_list) / len(f1_list), 4) if f1_list else 1.0

    majority_correct = 0
    for item in BENCHMARK_DATASET:
        if item["task_type"] == "classification":
            rec = reconcile_classification(item["annotator_annotations"], strategy="majority_vote")
            if rec.class_label == item["ground_truth_label"]:
                majority_correct += 1
        else:
            rec = reconcile_spans(item["annotator_annotations"], item["text"], strategy="majority_vote")
            gt = [SpanItem(**s) for s in item["ground_truth_spans"]]
            rec_spans = [SpanItem(**s) for s in rec.spans]
            _, _, f1 = compute_span_overlap_f1(rec_spans, gt)
            if f1 >= 0.8:
                majority_correct += 1

    return {
        "dataset_name": "AgreementBench-Reference-NLP-v1",
        "total_test_units": len(BENCHMARK_DATASET),
        "annotator_count": 3,
        "inter_annotator_metrics": {
            "mean_cohen_kappa": mean_kappa,
            "fleiss_kappa": fleiss_k,
            "krippendorff_alpha": kripp_a,
            "pairwise_kappas": {"A_vs_B": k_AB, "A_vs_C": k_AC, "B_vs_C": k_BC},
            "average_span_overlap_f1": avg_span_f1,
        },
        "adjudication_performance": {
            "strategy": "majority_vote",
            "accuracy_against_ground_truth": round(majority_correct / len(BENCHMARK_DATASET), 4),
            "resolved_items": len(BENCHMARK_DATASET),
        },
        "failure_modes_analyzed": [
            {"case": "Boundary whitespace attachment", "impact": "Exact offset mismatch despite 100% semantic agreement", "mitigation": "Automated whitespace_trim boundary normalizer"},
            {"case": "Honorific/prefix omission", "impact": "Partial multi-word overlap ('Sarah Lin' vs 'Dr. Sarah Lin')", "mitigation": "Majority vote boundary resolution selects complete span"},
            {"case": "Category boundary ambiguity", "impact": "Reduces raw kappa on multi-aspect sentiment", "mitigation": "Flags items with kappa < 0.70 to adjudication queue"}
        ],
        "reproducible_command": "PYTHONPATH=backend python3 -m app.services.benchmark_eval",
    }

if __name__ == "__main__":
    import json
    print(json.dumps(run_evaluation_benchmark(), indent=2))
