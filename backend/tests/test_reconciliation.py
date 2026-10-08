from backend.app.services.reconciliation_engine import (
    reconcile_classification,
    reconcile_spans,
    export_to_jsonl,
    export_to_conll,
    export_to_huggingface,
)

def test_classification_majority_vote():
    annotations = [
        {"annotator_id": "r1", "class_label": "POSITIVE"},
        {"annotator_id": "r2", "class_label": "POSITIVE"},
        {"annotator_id": "r3", "class_label": "NEUTRAL"},
    ]
    res = reconcile_classification(annotations, strategy="majority_vote")
    assert res.class_label == "POSITIVE"
    assert res.agreement_ratio >= 0.66

def test_classification_expert_priority():
    annotations = [
        {"annotator_id": "junior", "class_label": "POSITIVE"},
        {"annotator_id": "lead", "class_label": "NEUTRAL"},
    ]
    res = reconcile_classification(annotations, strategy="expert_priority", priority_annotator_id="lead")
    assert res.class_label == "NEUTRAL"
    assert res.strategy_used == "expert_priority"

def test_span_reconciliation_strategies():
    text = "Patient had acute hypertension symptoms."
    anns = [
        {"annotator_id": "r1", "spans": [{"start": 12, "end": 30, "label": "CONDITION", "text": "acute hypertension"}]},
        {"annotator_id": "r2", "spans": [{"start": 18, "end": 30, "label": "CONDITION", "text": "hypertension"}]},
    ]
    # Union
    u_res = reconcile_spans(anns, text, strategy="union")
    assert len(u_res.spans) == 1
    assert u_res.spans[0]["start"] == 12
    assert u_res.spans[0]["end"] == 30

    # Intersection
    i_res = reconcile_spans(anns, text, strategy="intersection")
    assert len(i_res.spans) == 1
    assert i_res.spans[0]["start"] == 18
    assert i_res.spans[0]["end"] == 30

def test_gold_dataset_exports():
    records = [
        {
            "id": "doc-01",
            "text": "Apple is hiring in Tokyo.",
            "class_label": "TECH",
            "spans": [{"start": 0, "end": 5, "label": "ORG"}, {"start": 19, "end": 24, "label": "LOC"}],
        }
    ]
    jsonl = export_to_jsonl(records)
    assert "Apple is hiring in Tokyo." in jsonl
    assert "TECH" in jsonl

    conll = export_to_conll(records)
    assert "Apple\tB-ORG" in conll
    assert "Tokyo.\tB-LOC" in conll or "Tokyo" in conll

    hf = export_to_huggingface(records)
    assert len(hf) == 1
    assert hf[0]["id"] == "doc-01"
    assert "B-ORG" in hf[0]["ner_tags"]
