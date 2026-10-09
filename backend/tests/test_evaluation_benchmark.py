from app.services.benchmark_eval import run_evaluation_benchmark

def test_evaluation_benchmark_execution():
    report = run_evaluation_benchmark()
    assert report["dataset_name"] == "AgreementBench-Reference-NLP-v1"
    assert report["total_test_units"] == 5
    assert report["annotator_count"] == 3

    metrics = report["inter_annotator_metrics"]
    assert 0.0 <= metrics["mean_cohen_kappa"] <= 1.0
    assert 0.0 <= metrics["average_span_overlap_f1"] <= 1.0

    adjudication = report["adjudication_performance"]
    assert adjudication["accuracy_against_ground_truth"] >= 0.8

    assert len(report["failure_modes_analyzed"]) >= 3
    assert "PYTHONPATH=backend" in report["reproducible_command"]
