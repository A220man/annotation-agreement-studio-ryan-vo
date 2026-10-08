import pytest
from fastapi import status
from backend.app.core.config import Settings, validate_environment_safety

def test_unauthenticated_request_rejected(client):
    response = client.get("/api/tasks")
    assert response.status_code == status.HTTP_401_UNAUTHORIZED
    assert "Missing Bearer" in response.json()["detail"]

def test_role_denial_viewer_cannot_create_task(client, viewer_headers):
    payload = {
        "name": "Unauthorized Task",
        "task_type": "classification",
        "labels_schema": ["A", "B"],
    }
    response = client.post("/api/tasks", json=payload, headers=viewer_headers)
    assert response.status_code == status.HTTP_403_FORBIDDEN
    assert "Access denied" in response.json()["detail"]

def test_analyst_can_create_task(client, analyst_headers):
    payload = {
        "name": "Authorized Analyst Task",
        "task_type": "classification",
        "labels_schema": ["CAT1", "CAT2"],
    }
    response = client.post("/api/tasks", json=payload, headers=analyst_headers)
    assert response.status_code == status.HTTP_201_CREATED
    assert response.json()["name"] == "Authorized Analyst Task"

def test_viewer_cannot_delete_task(client, viewer_headers, analyst_headers):
    # Create with analyst
    create_resp = client.post(
        "/api/tasks",
        json={"name": "Task to Delete", "task_type": "span", "labels_schema": ["TAG"]},
        headers=analyst_headers,
    )
    task_id = create_resp.json()["id"]

    # Try delete with viewer
    del_resp = client.delete(f"/api/tasks/{task_id}", headers=viewer_headers)
    assert del_resp.status_code == status.HTTP_403_FORBIDDEN

def test_admin_can_delete_task(client, analyst_headers, admin_headers):
    create_resp = client.post(
        "/api/tasks",
        json={"name": "Task to Delete by Admin", "task_type": "span", "labels_schema": ["TAG"]},
        headers=analyst_headers,
    )
    task_id = create_resp.json()["id"]

    del_resp = client.delete(f"/api/tasks/{task_id}", headers=admin_headers)
    assert del_resp.status_code == status.HTTP_200_OK

def test_production_safety_refuses_demo_mode():
    prod_cfg = Settings(ENVIRONMENT="production", DEMO_MODE=True)
    with pytest.raises(RuntimeError) as exc_info:
        validate_environment_safety(prod_cfg)
    assert "FATAL CONFIGURATION ERROR" in str(exc_info.value)
