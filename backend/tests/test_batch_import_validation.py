import json
from fastapi import status


def test_batch_import_validation_span_exceeds_document(client, analyst_headers):
    """Test batch import rejects spans that exceed document text length."""
    task_resp = client.post("/api/tasks", json={
        "name": "Span Validation Test",
        "task_type": "span",
        "labels_schema": ["MED", "DOSAGE"],
    }, headers=analyst_headers)
    assert task_resp.status_code == status.HTTP_201_CREATED
    task_id = task_resp.json()["id"]

    doc_resp = client.post(f"/api/tasks/{task_id}/documents", json={
        "documents": [{"text": "Aspirin 200mg"}]
    }, headers=analyst_headers)
    assert doc_resp.status_code == status.HTTP_201_CREATED
    doc_id = doc_resp.json()["document_ids"][0]

    batch_payload = {
        "task_id": task_id,
        "annotations": [{
            "document_id": doc_id,
            "annotator_id": "ann1",
            "annotator_name": "Annotator One",
            "task_type": "span",
            "spans": [
                {"start": 0, "end": 7, "label": "MED"},
                {"start": 8, "end": 20, "label": "DOSAGE"}
            ],
        }]
    }
    resp = client.post("/api/annotations/batch", json=batch_payload, headers=analyst_headers)
    assert resp.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
    data = resp.json()
    assert data["detail"]["message"] == "Batch import validation failed"
    assert data["detail"]["failed"] == 1
    assert data["detail"]["imported"] == 0
    assert len(data["detail"]["errors"]) == 1
    err = data["detail"]["errors"][0]
    assert err["error"] == "Span validation failed"
    assert err["index"] == 0
    assert err["document_id"] == doc_id
    span_errs = err["details"]
    assert isinstance(span_errs, list)
    assert len(span_errs) == 1
    assert span_errs[0]["span_index"] == 1
    assert span_errs[0]["error"] == "Span exceeds document length"
    assert "exceeds document text length" in span_errs[0]["details"]


def test_batch_import_validation_invalid_span_range(client, analyst_headers):
    """Test batch import rejects spans with start >= end."""
    task_resp = client.post("/api/tasks", json={
        "name": "Invalid Range Test",
        "task_type": "span",
        "labels_schema": ["MED"],
    }, headers=analyst_headers)
    task_id = task_resp.json()["id"]

    doc_resp = client.post(f"/api/tasks/{task_id}/documents", json={
        "documents": [{"text": "Test document"}]
    }, headers=analyst_headers)
    doc_id = doc_resp.json()["document_ids"][0]

    batch_payload = {
        "task_id": task_id,
        "annotations": [{
            "document_id": doc_id,
            "annotator_id": "ann1",
            "annotator_name": "Annotator One",
            "task_type": "span",
            "spans": [
                {"start": 5, "end": 5, "label": "MED"},
            ],
        }]
    }
    resp = client.post("/api/annotations/batch", json=batch_payload, headers=analyst_headers)
    assert resp.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
    data = resp.json()
    err = data["detail"]["errors"][0]
    span_errs = err["details"]
    assert span_errs[0]["error"] == "Invalid span range"
    assert "start (5) must be less than end (5)" in span_errs[0]["details"]


def test_batch_import_validation_negative_start(client, analyst_headers):
    """Test batch import rejects spans with negative start (caught by Pydantic validation)."""
    task_resp = client.post("/api/tasks", json={
        "name": "Negative Start Test",
        "task_type": "span",
        "labels_schema": ["MED"],
    }, headers=analyst_headers)
    task_id = task_resp.json()["id"]

    doc_resp = client.post(f"/api/tasks/{task_id}/documents", json={
        "documents": [{"text": "Test"}]
    }, headers=analyst_headers)
    doc_id = doc_resp.json()["document_ids"][0]

    batch_payload = {
        "task_id": task_id,
        "annotations": [{
            "document_id": doc_id,
            "annotator_id": "ann1",
            "annotator_name": "Annotator One",
            "task_type": "span",
            "spans": [
                {"start": -1, "end": 3, "label": "MED"},
            ],
        }]
    }
    resp = client.post("/api/annotations/batch", json=batch_payload, headers=analyst_headers)
    assert resp.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
    data = resp.json()
    assert isinstance(data["detail"], list)
    assert len(data["detail"]) >= 1
    assert data["detail"][0]["type"] == "greater_than_equal"
    assert data["detail"][0]["loc"][-1] == "start"
    assert "greater than or equal to 0" in data["detail"][0]["msg"]


def test_batch_import_validation_document_not_found(client, analyst_headers):
    """Test batch import rejects non-existent document IDs."""
    task_resp = client.post("/api/tasks", json={
        "name": "Doc Not Found Test",
        "task_type": "span",
        "labels_schema": ["MED"],
    }, headers=analyst_headers)
    task_id = task_resp.json()["id"]

    batch_payload = {
        "task_id": task_id,
        "annotations": [{
            "document_id": "non-existent-doc-id",
            "annotator_id": "ann1",
            "annotator_name": "Annotator One",
            "task_type": "span",
            "spans": [{"start": 0, "end": 5, "label": "MED"}],
        }]
    }
    resp = client.post("/api/annotations/batch", json=batch_payload, headers=analyst_headers)
    assert resp.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
    data = resp.json()
    err = data["detail"]["errors"][0]
    assert err["error"] == "Document not found"
    assert "non-existent-doc-id" in err["details"]


def test_batch_import_validation_task_mismatch(client, analyst_headers):
    """Test batch import rejects document from different task."""
    task_a_resp = client.post("/api/tasks", json={
        "name": "Task A",
        "task_type": "span",
        "labels_schema": ["MED"],
    }, headers=analyst_headers)
    task_a_id = task_a_resp.json()["id"]

    task_b_resp = client.post("/api/tasks", json={
        "name": "Task B",
        "task_type": "span",
        "labels_schema": ["MED"],
    }, headers=analyst_headers)
    task_b_id = task_b_resp.json()["id"]

    doc_resp = client.post(f"/api/tasks/{task_b_id}/documents", json={
        "documents": [{"text": "Document in task B"}]
    }, headers=analyst_headers)
    doc_id = doc_resp.json()["document_ids"][0]

    batch_payload = {
        "task_id": task_a_id,
        "annotations": [{
            "document_id": doc_id,
            "annotator_id": "ann1",
            "annotator_name": "Annotator One",
            "task_type": "span",
            "spans": [{"start": 0, "end": 5, "label": "MED"}],
        }]
    }
    resp = client.post("/api/annotations/batch", json=batch_payload, headers=analyst_headers)
    assert resp.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
    data = resp.json()
    err = data["detail"]["errors"][0]
    assert err["error"] == "Task mismatch"
    assert task_b_id in err["details"]
    assert task_a_id in err["details"]


def test_batch_import_validation_multiple_errors(client, analyst_headers):
    """Test batch import reports multiple independent errors."""
    task_resp = client.post("/api/tasks", json={
        "name": "Multiple Errors Test",
        "task_type": "span",
        "labels_schema": ["MED"],
    }, headers=analyst_headers)
    task_id = task_resp.json()["id"]

    doc_resp = client.post(f"/api/tasks/{task_id}/documents", json={
        "documents": [{"text": "Short"}]
    }, headers=analyst_headers)
    doc_id = doc_resp.json()["document_ids"][0]

    batch_payload = {
        "task_id": task_id,
        "annotations": [
            {
                "document_id": doc_id,
                "annotator_id": "ann1",
                "annotator_name": "Annotator One",
                "task_type": "span",
                "spans": [{"start": 0, "end": 100, "label": "MED"}],
            },
            {
                "document_id": "missing-doc",
                "annotator_id": "ann2",
                "annotator_name": "Annotator Two",
                "task_type": "span",
                "spans": [{"start": 0, "end": 5, "label": "MED"}],
            },
        ]
    }
    resp = client.post("/api/annotations/batch", json=batch_payload, headers=analyst_headers)
    assert resp.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
    data = resp.json()
    assert data["detail"]["failed"] == 2
    assert data["detail"]["imported"] == 0
    assert len(data["detail"]["errors"]) == 2
    assert data["detail"]["errors"][0]["error"] == "Span validation failed"
    assert data["detail"]["errors"][1]["error"] == "Document not found"


def test_batch_import_success_with_auto_text(client, analyst_headers):
    """Test successful batch import auto-populates span text from document."""
    task_resp = client.post("/api/tasks", json={
        "name": "Auto Text Test",
        "task_type": "span",
        "labels_schema": ["MED", "DOSAGE"],
    }, headers=analyst_headers)
    task_id = task_resp.json()["id"]

    doc_text = "Patient took Ibuprofen 200mg"
    doc_resp = client.post(f"/api/tasks/{task_id}/documents", json={
        "documents": [{"text": doc_text}]
    }, headers=analyst_headers)
    doc_id = doc_resp.json()["document_ids"][0]

    # "Patient" = 0:7, "Ibuprofen" = 13:22, "200mg" = 23:28
    batch_payload = {
        "task_id": task_id,
        "annotations": [{
            "document_id": doc_id,
            "annotator_id": "ann1",
            "annotator_name": "Annotator One",
            "task_type": "span",
            "spans": [
                {"start": 0, "end": 7, "label": "MED"},
                {"start": 13, "end": 22, "label": "MED"},
                {"start": 23, "end": 28, "label": "DOSAGE"},
            ],
        }]
    }
    resp = client.post("/api/annotations/batch", json=batch_payload, headers=analyst_headers)
    assert resp.status_code == status.HTTP_201_CREATED
    assert resp.json()["count"] == 1

    ann_resp = client.get(f"/api/annotations?task_id={task_id}&document_id={doc_id}", headers=analyst_headers)
    annotations = ann_resp.json()
    assert len(annotations) == 1
    spans = annotations[0]["spans"]
    assert spans[0]["text"] == "Patient"
    assert spans[1]["text"] == "Ibuprofen"
    assert spans[2]["text"] == "200mg"