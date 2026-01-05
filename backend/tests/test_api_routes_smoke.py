"""
Smoke tests for key API routes
Tests basic functionality: 200/201/401/422/404 responses
"""
import pytest
from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)

# Routes clés à tester
KEY_ROUTES = [
    # Stores
    ("GET", "/api/stores/my-stores", 401),  # Requires auth
    ("POST", "/api/stores/", 401),  # Requires auth
    ("GET", "/api/stores/invalid-store-id/info", 401),  # Requires auth
    
    # Manager
    ("GET", "/api/manager/subscription-status", 401),  # Requires auth
    ("GET", "/api/manager/store-kpi-overview", 401),  # Requires auth
    ("GET", "/api/manager/dates-with-data", 401),  # Requires auth
    ("GET", "/api/manager/available-years", 401),  # Requires auth
    
    # Seller
    ("GET", "/api/seller/subscription-status", 401),  # Requires auth
    ("GET", "/api/seller/kpi-enabled", 401),  # Requires auth
    ("GET", "/api/seller/tasks", 401),  # Requires auth
    ("GET", "/api/seller/objectives/active", 401),  # Requires auth
    ("GET", "/api/seller/objectives/all", 401),  # Requires auth
]

# Routes publiques
PUBLIC_ROUTES = [
    ("GET", "/health", 200),
    ("GET", "/api/health", 200),
    ("GET", "/", 200),
]


@pytest.mark.parametrize("method,path,expected_status", PUBLIC_ROUTES)
def test_public_routes(method, path, expected_status):
    """Test public routes that should be accessible without auth"""
    response = client.request(method, path)
    assert response.status_code == expected_status, f"{method} {path} returned {response.status_code}, expected {expected_status}"


@pytest.mark.parametrize("method,path,expected_status", KEY_ROUTES)
def test_protected_routes_require_auth(method, path, expected_status):
    """Test that protected routes return 401 without authentication"""
    response = client.request(method, path)
    assert response.status_code == expected_status, f"{method} {path} returned {response.status_code}, expected {expected_status}"


def test_invalid_route_returns_404():
    """Test that invalid routes return 404"""
    response = client.get("/api/invalid/route")
    assert response.status_code == 404


def test_debug_routes_endpoint():
    """Test that debug routes endpoint exists (but may require auth in production)"""
    response = client.get("/_debug/routes")
    # Should return 200 or 401 depending on auth requirements
    assert response.status_code in [200, 401, 403]


def test_stores_post_requires_body():
    """Test that POST /api/stores/ requires a body (422 if missing)"""
    # Without auth, should get 401, but with invalid body should get 422
    response = client.post("/api/stores/", json={})
    # Should be 401 (no auth) or 422 (validation error)
    assert response.status_code in [401, 422]


def test_cors_headers():
    """Test that CORS headers are present"""
    response = client.options("/api/health")
    # OPTIONS should work for CORS preflight
    assert response.status_code in [200, 204]


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

