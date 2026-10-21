from fastapi import status


def test_reconciliation_export_huggingface_format(client, analyst_headers, viewer_headers):
    """Test export endpoint supports HuggingFace format with proper download headers."""
    # 1. Create a span annotation task
    task_resp = client.post("/api/tasks", json={
        "name": "HF Export Test",
        "task_type": "span",
        "labels_schema": ["ORG", "LOC"]
    }, headers=analyst_headers)
    assert task_resp.status_code == status.HTTP_201_CREATED
    task_id = task_resp.json()["id"]

    # 2. Add document
    doc_resp = client.post(f"/api/tasks/{task_id}/documents", json={
        "documents": [{"text": "Apple is hiring in Tokyo."}]
    }, headers=analyst_headers)
    assert doc_resp.status_code == status.HTTP_201_CREATED
    doc_id = doc_resp.json()["document_ids"][0]

    # 3. Add 2 annotations with different spans
    client.post("/api/annotations", json={
        "document_id": doc_id,
        "task_id": task_id,
        "annotator_id": "ann_1",
        "annotator_name": "Annotator One",
        "task_type": "span",
        "class_label": "BUSINESS",
        "spans": [{"start": 0, "end": 5, "label": "ORG", "text": "Apple"}],
    }, headers=analyst_headers)

    client.post("/api/annotations", json={
        "document_id": doc_id,
        "task_id": task_id,
        "annotator_id": "ann_2",
        "annotator_name": "Annotator Two",
        "task_type": "span",
        "class_label": "BUSINESS",
        "spans": [{"start": 0, "end": 5, "label": "ORG", "text": "Apple"}],
    }, headers=analyst_headers)

    # 4. Auto-reconcile
    recon_resp = client.post(f"/api/reconciliation/auto/{task_id}", json={
        "strategy": "majority_vote",
        "auto_approve": True
    }, headers=analyst_headers)
    assert recon_resp.status_code == status.HTTP_200_OK

    # 5. Test HuggingFace format export
    resp_hf = client.get(f"/api/reconciliation/export/{task_id}?format=huggingface", headers=viewer_headers)
    assert resp_hf.status_code == status.HTTP_200_OK
    assert resp_hf.headers["content-type"] == "application/json"
    assert f'attachment; filename="gold-{task_id}.hf.json"' in resp_hf.headers["content-disposition"]
    hf_data = resp_hf.json()
    assert isinstance(hf_data, list)
    assert len(hf_data) == 1
    assert hf_data[0]["id"] == doc_id
    assert "tokens" in hf_data[0]
    assert "ner_tags" in hf_data[0]
    assert "text" in hf_data[0]
    assert any("B-ORG" in tag for tag in hf_data[0]["ner_tags"])


def test_reconciliation_export_jsonl_has_download_header(client, analyst_headers, viewer_headers):
    """Verify JSONL export now includes Content-Disposition header."""
    task_resp = client.post("/api/tasks", json={
        "name": "Header Test",
        "task_type": "classification",
        "labels_schema": ["POS", "NEG"]
    }, headers=analyst_headers)
    task_id = task_resp.json()["id"]

    doc_resp = client.post(f"/api/tasks/{task_id}/documents", json={
        "documents": [{"text": "Good product."}]
    }, headers=analyst_headers)
    doc_id = doc_resp.json()["document_ids"][0]

    client.post("/api/annotations", json={
        "document_id": doc_id,
        "task_id": task_id,
        "annotator_id": "a1",
        "annotator_name": "A1",
        "task_type": "classification",
        "class_label": "POS",
    }, headers=analyst_headers)

    client.post(f"/api/reconciliation/auto/{task_id}", json={
        "strategy": "majority_vote",
        "auto_approve": True
    }, headers=analyst_headers)

    resp_jsonl = client.get(f"/api/reconciliation/export/{task_id}?format=jsonl", headers=viewer_headers)
    assert resp_jsonl.status_code == status.HTTP_200_OK
    assert "application/x-ndjson" in resp_jsonl.headers["content-type"]
    assert f'attachment; filename="gold-{task_id}.jsonl"' in resp_jsonl.headers["content-disposition"]


def test_reconciliation_export_conll_has_download_header(client, analyst_headers, viewer_headers):
    """Verify CoNLL export now includes Content-Disposition header."""
    task_resp = client.post("/api/tasks", json={
        "name": "Header Test CoNLL",
        "task_type": "span",
        "labels_schema": ["ORG"]
    }, headers=analyst_headers)
    task_id = task_resp.json()["id"]

    doc_resp = client.post(f"/api/tasks/{task_id}/documents", json={
        "documents": [{"text": "Microsoft Corp."}]
    }, headers=analyst_headers)
    doc_id = doc_resp.json()["document_ids"][0]

    client.post("/api/annotations", json={
        "document_id": doc_id,
        "task_id": task_id,
        "annotator_id": "a1",
        "annotator_name": "A1",
        "task_type": "span",
        "class_label": "TECH",
        "spans": [{"start": 0, "end": 9, "label": "ORG", "text": "Microsoft"}],
    }, headers=analyst_headers)

    client.post(f"/api/reconciliation/auto/{task_id}", json={
        "strategy": "majority_vote",
        "auto_approve": True
    }, headers=analyst_headers)

    resp_conll = client.get(f"/api/reconciliation/export/{task_id}?format=conll", headers=viewer_headers)
    assert resp_conll.status_code == status.HTTP_200_OK
    assert "text/plain" in resp_conll.headers["content-type"]
    assert f'attachment; filename="gold-{task_id}.conll"' in resp_conll.headers["content-disposition"]


def test_reconciliation_export_rbac_viewer_can_access(client, viewer_headers):
    """Viewer role can access export endpoint."""
    resp = client.get("/api/reconciliation/export/nonexistent?format=huggingface", headers=viewer_headers)
    # 404 because task doesn't exist, not 403
    assert resp.status_code == status.HTTP_404_NOT_FOUND


def test_reconciliation_export_unauthenticated_rejected(client):
    """Unauthenticated requests rejected."""
    resp = client.get("/api/reconciliation/export/anything?format=huggingface")
    assert resp.status_code == status.HTTP_401_UNAUTHORIZED


def test_reconciliation_export_invalid_format_rejected(client, viewer_headers):
    """Invalid format parameter rejected."""
    resp = client.get("/api/reconciliation/export/task?format=invalid", headers=viewer_headers)
    assert resp.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY