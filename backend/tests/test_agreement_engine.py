import pytest
from backend.app.services.agreement_engine import (
    compute_cohen_kappa,
    compute_fleiss_kappa,
    compute_krippendorff_alpha_nominal,
    tokenize_with_offsets,
    spans_to_bio_tags,
    compute_span_iou,
    compute_span_overlap_f1,
    diagnose_boundary_misalignment,
    SpanItem,
    interpret_kappa,
)

def test_cohen_kappa_perfect_agreement():
    r1 = ["POS", "NEG", "NEU", "POS"]
    r2 = ["POS", "NEG", "NEU", "POS"]
    kappa, obs, exp = compute_cohen_kappa(r1, r2)
    assert kappa == 1.0
    assert obs == 1.0
    assert interpret_kappa(kappa) == "Almost Perfect (0.81 - 1.00)"

def test_cohen_kappa_chance_agreement():
    r1 = ["POS", "POS", "NEG", "NEG"]
    r2 = ["NEG", "NEG", "POS", "POS"]
    kappa, obs, exp = compute_cohen_kappa(r1, r2)
    assert kappa < 0.0
    assert interpret_kappa(kappa).startswith("Poor")

def test_fleiss_kappa_multi_rater():
    matrix = [
        ["CAT_A", "CAT_A", "CAT_A"],
        ["CAT_B", "CAT_B", "CAT_B"],
        ["CAT_A", "CAT_A", "CAT_B"],
    ]
    kappa = compute_fleiss_kappa(matrix)
    assert kappa is not None
    assert 0.5 <= kappa <= 1.0

def test_krippendorff_alpha_nominal():
    units = [
        {"rater1": "A", "rater2": "A", "rater3": "A"},
        {"rater1": "B", "rater2": "B", "rater3": "B"},
        {"rater1": "A", "rater2": "B", "rater3": "A"},
    ]
    alpha = compute_krippendorff_alpha_nominal(units)
    assert alpha is not None
    assert alpha > 0.5

def test_tokenization_and_bio_conversion():
    text = "Alphabet reported in California today."
    tokens = tokenize_with_offsets(text)
    assert len(tokens) == 5
    assert tokens[0][0] == "Alphabet"
    assert tokens[0][1] == 0
    assert tokens[0][2] == 8

    spans = [
        SpanItem(start=0, end=8, label="ORG"),
        SpanItem(start=21, end=31, label="LOC"),
    ]
    bio = spans_to_bio_tags(tokens, spans)
    assert bio[0] == "B-ORG"
    assert bio[1] == "O"
    assert bio[2] == "O"
    assert bio[3] == "B-LOC"

def test_span_iou_and_overlap_f1():
    s1 = SpanItem(start=10, end=20, label="PER")
    s2 = SpanItem(start=10, end=20, label="PER")
    assert compute_span_iou(s1, s2) == 1.0

    s3 = SpanItem(start=15, end=25, label="PER")
    assert 0.3 <= compute_span_iou(s1, s3) <= 0.4

    p, r, f1 = compute_span_overlap_f1([s1], [s2])
    assert f1 == 1.0

def test_boundary_misalignment_diagnosis():
    text = "The Google Inc. announced earnings."
    s1 = SpanItem(start=4, end=14, label="ORG")   # "Google Inc"
    s2 = SpanItem(start=4, end=15, label="ORG")   # "Google Inc." (punctuation)
    diag = diagnose_boundary_misalignment(text, s1, s2, "doc-1", "ann1", "ann2")
    assert diag is not None
    assert diag.misalignment_type == "punctuation_boundary"
