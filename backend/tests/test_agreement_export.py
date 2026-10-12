import json
from fastapi import status

def test_agreement_export_json_and_csv(client, analyst_headers, viewer_headers):
    # 1. Create a span annotation task
    task_resp = client.post("/api/tasks", json={
        "name": "Export Validation Task",
        "task_type": "span",
        "labels_schema": ["MED", "DOSAGE"],
    }, headers=analyst_headers)
    assert task_resp.status_code == status.HTTP_201_CREATED
    task_id = task_resp.json()["id"]

    # 2. Add document
    doc_resp = client.post(f"/api/tasks/{task_id}/documents", json={
        "documents": [{"text": "Patient took Ibuprofen 200mg orally."}]
    }, headers=analyst_headers)
    assert doc_resp.status_code == status.HTTP_201_CREATED
    doc_id = doc_resp.json()["document_ids"][0]

    # 3. Add 2 annotations
    client.post("/api/annotations", json={
        "document_id": doc_id,
        "annotator_id": "user_a",
        "annotator_name": "Alice",
        "task_type": "span",
        "spans": [
            {"start": 13, "end": 22, "label": "MED", "text": "Ibuprofen"},
            {"start": 23, "end": 28, "label": "DOSAGE", "text": "200mg"},
        ],
    }, headers=analyst_headers)

    client.post("/api/annotations", json={
        "document_id": doc_id,
        "annotator_id": "user_b",
        "annotator_name": "Bob",
        "task_type": "span",
        "spans": [
            {"start": 13, "end": 22, "label": "MED", "text": "Ibuprofen"},
            {"start": 23, "end": 29, "label": "DOSAGE", "text": "200mg "},
        ],
    }, headers=analyst_headers)

    # 4. Test JSON export
    resp_json = client.get(f"/api/agreement/tasks/{task_id}/export?format=json", headers=viewer_headers)
    assert resp_json.status_code == status.HTTP_200_OK
    assert resp_json.headers["content-type"] == "application/json"
    assert f'attachment; filename="agreement-report-{task_id}.json"' in resp_json.headers["content-disposition"]
    data = resp_json.json()
    assert data["task_id"] == task_id
    assert data["total_documents"] == 1
    assert data["total_annotations"] == 2
    assert len(data["cohen_kappas"]) == 1
    assert data["token_span_f1"] is not None
    assert len(data["boundary_diagnostics"]) >= 1

    # 5. Test CSV export
    resp_csv = client.get(f"/api/agreement/tasks/{task_id}/export?format=csv", headers=viewer_headers)
    assert resp_csv.status_code == status.HTTP_200_OK
    assert "text/csv" in resp_csv.headers["content-type"]
    assert f'attachment; filename="agreement-report-{task_id}.csv"' in resp_csv.headers["content-disposition"]
    csv_text = resp_csv.text
    assert "Summary Metrics" in csv_text
    assert "Pairwise Cohen's Kappa" in csv_text
    assert "Disagreement Matrix" in csv_text
    assert "Top Disagreements" in csv_text
    assert "Boundary Diagnostics" in csv_text
    assert "DOSAGE" in csv_text
    assert "200mg" in csv_text

def test_agreement_export_rbac_and_validation(client, viewer_headers):
    # Unauthenticated rejected
    resp_unauth = client.get("/api/agreement/tasks/nonexistent/export?format=json")
    assert resp_unauth.status_code == status.HTTP_401_UNAUTHORIZED

    # Non-existent task -> 404
    resp_404 = client.get("/api/agreement/tasks/nonexistent/export?format=json", headers=viewer_headers)
    assert resp_404.status_code == status.HTTP_404_NOT_FOUND

    # Invalid format -> 422
    resp_422 = client.get("/api/agreement/tasks/some-task/export?format=invalid", headers=viewer_headers)
    assert resp_422.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

def test_agreement_export_classification_task(client, analyst_headers, viewer_headers):
    # Classification task export
    task_resp = client.post("/api/tasks", json={
        "name": "Sentiment Classification",
        "task_type": "classification",
        "labels_schema": ["POSITIVE", "NEGATIVE", "NEUTRAL"],
    }, headers=analyst_headers)
    task_id = task_resp.json()["id"]

    doc_resp = client.post(f"/api/tasks/{task_id}/documents", json={
        "documents": [{"text": "Great service and fast delivery!"}]
    }, headers=analyst_headers)
    doc_id = doc_resp.json()["document_ids"][0]

    client.post("/api/annotations", json={
        "document_id": doc_id,
        "annotator_id": "rater_1",
        "annotator_name": "Rater 1",
        "task_type": "classification",
        "class_label": "POSITIVE",
    }, headers=analyst_headers)

    client.post("/api/annotations", json={
        "document_id": doc_id,
        "annotator_id": "rater_2",
        "annotator_name": "Rater 2",
        "task_type": "classification",
        "class_label": "POSITIVE",
    }, headers=analyst_headers)

    resp_json = client.get(f"/api/agreement/tasks/{task_id}/export?format=json", headers=viewer_headers)
    assert resp_json.status_code == status.HTTP_200_OK
    data = resp_json.json()
    assert data["task_type"] == "classification"
    assert data["overall_mean_kappa"] == 1.0

    resp_csv = client.get(f"/api/agreement/tasks/{task_id}/export?format=csv", headers=viewer_headers)
    assert resp_csv.status_code == status.HTTP_200_OK
    assert "Summary Metrics" in resp_csv.text
