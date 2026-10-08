from fastapi import status

def test_full_annotation_agreement_workflow(client, analyst_headers, viewer_headers):
    # 1. Create a span annotation task
    task_payload = {
        "name": "Biomedical Named Entity Recognition",
        "description": "Evaluating agreement on clinical entity boundaries",
        "task_type": "span",
        "guidelines": "Label disease and medication spans accurately.",
        "labels_schema": ["DISEASE", "MEDICATION"],
    }
    create_task_resp = client.post("/api/tasks", json=task_payload, headers=analyst_headers)
    assert create_task_resp.status_code == status.HTTP_201_CREATED
    task_id = create_task_resp.json()["id"]

    # 2. Add documents to the task
    docs_payload = {
        "documents": [
            {"text": "Aspirin is prescribed for myocardial infarction symptoms."}
        ]
    }
    add_docs_resp = client.post(f"/api/tasks/{task_id}/documents", json=docs_payload, headers=analyst_headers)
    assert add_docs_resp.status_code == status.HTTP_201_CREATED
    doc_id = add_docs_resp.json()["document_ids"][0]

    # 3. Submit annotations from 2 independent annotators
    # Annotator A: "Aspirin" [0:7] MEDICATION, "myocardial infarction" [26:47] DISEASE
    ann_a = {
        "document_id": doc_id,
        "annotator_id": "annotator_alpha",
        "annotator_name": "Dr. Alpha",
        "task_type": "span",
        "spans": [
            {"start": 0, "end": 7, "label": "MEDICATION", "text": "Aspirin"},
            {"start": 26, "end": 47, "label": "DISEASE", "text": "myocardial infarction"},
        ],
    }
    res_a = client.post("/api/annotations", json=ann_a, headers=analyst_headers)
    assert res_a.status_code == status.HTTP_201_CREATED

    # Annotator B: "Aspirin" [0:7] MEDICATION, "myocardial infarction symptoms" [26:56] DISEASE (boundary shift)
    ann_b = {
        "document_id": doc_id,
        "annotator_id": "annotator_beta",
        "annotator_name": "Dr. Beta",
        "task_type": "span",
        "spans": [
            {"start": 0, "end": 7, "label": "MEDICATION", "text": "Aspirin"},
            {"start": 26, "end": 56, "label": "DISEASE", "text": "myocardial infarction symptoms"},
        ],
    }
    res_b = client.post("/api/annotations", json=ann_b, headers=analyst_headers)
    assert res_b.status_code == status.HTTP_201_CREATED

    # 4. Calculate agreement metrics
    agree_resp = client.get(f"/api/agreement/tasks/{task_id}", headers=viewer_headers)
    assert agree_resp.status_code == status.HTTP_200_OK
    data = agree_resp.json()
    assert data["total_documents"] == 1
    assert data["total_annotations"] == 2
    assert len(data["cohen_kappas"]) == 1
    assert data["cohen_kappas"][0]["cohen_kappa"] > 0.5
    assert len(data["boundary_diagnostics"]) >= 1

    # 5. Auto-reconcile using majority vote
    auto_rec_resp = client.post(
        f"/api/reconciliation/auto/{task_id}",
        json={"strategy": "majority_vote", "auto_approve": True},
        headers=analyst_headers,
    )
    assert auto_rec_resp.status_code == status.HTTP_200_OK
    assert auto_rec_resp.json()["reconciled_documents"] == 1

    # 6. Export consensus dataset in JSONL
    export_resp = client.get(f"/api/reconciliation/export/{task_id}?format=jsonl", headers=viewer_headers)
    assert export_resp.status_code == status.HTTP_200_OK
    export_content = export_resp.text
    assert "Aspirin" in export_content
    assert "myocardial infarction" in export_content

    # 7. Verify immutable audit trail recorded actions
    audit_resp = client.get("/api/audit", headers=viewer_headers)
    assert audit_resp.status_code == status.HTTP_200_OK
    audit_logs = audit_resp.json()
    event_types = [log["event_type"] for log in audit_logs]
    assert "TASK_CREATED" in event_types
    assert "DOCUMENTS_IMPORTED" in event_types
    assert "ANNOTATION_SUBMITTED" in event_types
    assert "AUTO_RECONCILIATION_RUN" in event_types
