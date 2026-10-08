import os
import pytest
from sqlalchemy import create_engine
from sqlalchemy.pool import StaticPool
from sqlalchemy.orm import sessionmaker
from fastapi.testclient import TestClient
from backend.app.core.database import Base, get_db
from backend.app.core.config import settings
from backend.app.core.security import create_demo_access_token
from backend.app.main import app

settings.ENVIRONMENT = "test"
settings.DEMO_MODE = True
settings.DATABASE_URL = "sqlite:///:memory:"

test_engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

@pytest.fixture(autouse=True)
def setup_test_db():
    Base.metadata.create_all(bind=test_engine)
    yield
    Base.metadata.drop_all(bind=test_engine)

@pytest.fixture
def db_session():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

@pytest.fixture
def client(db_session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()

@pytest.fixture
def analyst_headers():
    token = create_demo_access_token("test-analyst", "analyst@example.com", "Test Analyst", "analyst")
    return {"Authorization": f"Bearer {token}"}

@pytest.fixture
def viewer_headers():
    token = create_demo_access_token("test-viewer", "viewer@example.com", "Test Viewer", "viewer")
    return {"Authorization": f"Bearer {token}"}

@pytest.fixture
def admin_headers():
    token = create_demo_access_token("test-admin", "admin@example.com", "Test Admin", "admin")
    return {"Authorization": f"Bearer {token}"}
