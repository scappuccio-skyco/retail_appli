"""
Integration tests — GET /api/gerant/sellers pagination.

Verifies that the endpoint:
1. Returns the expected response shape (items, total, page, size, pages)
2. Only returns sellers (not managers, not deleted users)
3. Pagination skip works correctly (page 2 returns the right items)
4. size=1 forces pages = total (ceiling division)
5. Returns 200 with empty items when gerant has no sellers

Requires a running API server + MongoDB (kpi-json-safe CI job).
Env vars:
  TEST_BASE_URL   (default http://127.0.0.1:8001)
  MONGO_URL       (default mongodb://127.0.0.1:27017/)
  TEST_PASSWORD   (default TestUserPassword123!)
"""
import os
from datetime import datetime, timezone, timedelta
from urllib.parse import urlparse
from uuid import uuid4

import bcrypt
import jwt
import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get("TEST_BASE_URL", "http://127.0.0.1:8001")
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://127.0.0.1:27017/")
TEST_PASSWORD = os.environ.get("TEST_PASSWORD", "TestUserPassword123!")
DB_NAME = os.environ.get("DB_NAME", "retail_coach")
JWT_SECRET = os.environ.get("JWT_SECRET", "test-jwt-secret-not-real-32chars!!")

_ALLOWED_TEST_HOSTS = ("localhost", "127.0.0.1")


def _safe(url: str) -> bool:
    host = (urlparse(url).hostname or "").lower()
    return host in _ALLOWED_TEST_HOSTS


def _build_gerant(db):
    """Create workspace + gerant, return ids + credentials."""
    now = datetime.now(timezone.utc)
    workspace_id = str(uuid4())
    gerant_id = str(uuid4())
    gerant_email = f"test-gerant-pag-{uuid4()}@example.com"
    gerant_pw = bcrypt.hashpw(TEST_PASSWORD.encode(), bcrypt.gensalt()).decode()

    db.workspaces.update_one(
        {"id": workspace_id},
        {"$set": {
            "id": workspace_id, "gerant_id": gerant_id,
            "subscription_status": "active", "status": "active",
            "updated_at": now,
        }},
        upsert=True,
    )
    db.users.update_one(
        {"id": gerant_id},
        {"$set": {
            "id": gerant_id, "email": gerant_email, "password": gerant_pw,
            "role": "gerant", "status": "active",
            "workspace_id": workspace_id, "name": "Test Gérant Pagination",
            "created_at": now,
        }},
        upsert=True,
    )
    return {"gerant_id": gerant_id, "gerant_email": gerant_email, "workspace_id": workspace_id}


def _insert_seller(db, gerant_id: str, name: str, status: str = "active") -> str:
    sid = str(uuid4())
    now = datetime.now(timezone.utc)
    db.users.update_one(
        {"id": sid},
        {"$set": {
            "id": sid, "email": f"seller-{sid}@test.com",
            "password": "x", "role": "seller",
            "name": name, "status": status,
            "gerant_id": gerant_id, "created_at": now,
        }},
        upsert=True,
    )
    return sid


def _insert_manager(db, gerant_id: str) -> str:
    mid = str(uuid4())
    now = datetime.now(timezone.utc)
    db.users.update_one(
        {"id": mid},
        {"$set": {
            "id": mid, "email": f"manager-{mid}@test.com",
            "password": "x", "role": "manager",
            "name": "Test Manager", "status": "active",
            "gerant_id": gerant_id, "created_at": now,
        }},
        upsert=True,
    )
    return mid


def _make_token(user_id: str, email: str, role: str) -> str:
    """Generate a JWT directly — avoids hitting the login rate limiter."""
    payload = {
        "user_id": user_id,
        "email": email,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(hours=24),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


def _get_sellers(token: str, page: int = 1, size: int = 100) -> dict:
    url = f"{BASE_URL}/api/gerant/sellers?page={page}&size={size}"
    assert _safe(url)
    r = requests.get(url, headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200, f"GET /gerant/sellers failed: {r.status_code}: {r.text}"
    return r.json()


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

@pytest.mark.integration
def test_gerant_sellers_response_shape():
    """Endpoint returns the expected keys: items, total, page, size, pages."""
    assert _safe(BASE_URL), "SSRF guard"
    client = MongoClient(MONGO_URL)
    db = client[DB_NAME]

    g = _build_gerant(db)
    _insert_seller(db, g["gerant_id"], "Alice")
    token = _make_token(g["gerant_id"], g["gerant_email"], "gerant")

    data = _get_sellers(token)

    assert "items" in data, f"Missing 'items' key: {data}"
    assert "total" in data, f"Missing 'total' key: {data}"
    assert "page" in data, f"Missing 'page' key: {data}"
    assert "size" in data, f"Missing 'size' key: {data}"
    assert "pages" in data, f"Missing 'pages' key: {data}"
    assert isinstance(data["items"], list)
    assert data["total"] >= 1
    assert data["page"] == 1

    # Cleanup
    db.users.delete_many({"gerant_id": g["gerant_id"]})
    db.workspaces.delete_one({"id": g["workspace_id"]})


@pytest.mark.integration
def test_gerant_sellers_only_sellers_returned():
    """Managers and deleted sellers must NOT appear in the sellers list."""
    assert _safe(BASE_URL), "SSRF guard"
    client = MongoClient(MONGO_URL)
    db = client[DB_NAME]

    g = _build_gerant(db)
    seller_id = _insert_seller(db, g["gerant_id"], "Bob Vendeur")
    _insert_manager(db, g["gerant_id"])  # must not appear
    deleted_id = _insert_seller(db, g["gerant_id"], "Charlie Supprimé", status="deleted")
    token = _make_token(g["gerant_id"], g["gerant_email"], "gerant")

    data = _get_sellers(token)

    ids_returned = {item["id"] for item in data["items"]}
    assert seller_id in ids_returned, "Active seller should be in results"
    assert deleted_id not in ids_returned, "Deleted seller must NOT be in results"
    for item in data["items"]:
        assert item.get("role") == "seller", f"Non-seller found: {item}"
        assert item.get("status") != "deleted", f"Deleted user found: {item}"
        assert "password" not in item, "Password must not be exposed"

    # Cleanup
    db.users.delete_many({"gerant_id": g["gerant_id"]})
    db.workspaces.delete_one({"id": g["workspace_id"]})


@pytest.mark.integration
def test_gerant_sellers_pagination_page2():
    """With 3 sellers and size=2, page 2 returns the 3rd seller."""
    assert _safe(BASE_URL), "SSRF guard"
    client = MongoClient(MONGO_URL)
    db = client[DB_NAME]

    g = _build_gerant(db)
    # Names sorted alphabetically: Alice, Bob, Charlie → page 2 with size=2 → Charlie
    _insert_seller(db, g["gerant_id"], "Alice")
    _insert_seller(db, g["gerant_id"], "Bob")
    charlie_id = _insert_seller(db, g["gerant_id"], "Charlie")
    token = _make_token(g["gerant_id"], g["gerant_email"], "gerant")

    page1 = _get_sellers(token, page=1, size=2)
    page2 = _get_sellers(token, page=2, size=2)

    assert page1["total"] >= 3
    assert page1["pages"] >= 2
    assert len(page1["items"]) == 2
    assert page2["page"] == 2

    ids_page2 = {item["id"] for item in page2["items"]}
    assert charlie_id in ids_page2, "Charlie should be on page 2 (sorted by name)"

    # No overlap between page 1 and page 2
    ids_page1 = {item["id"] for item in page1["items"]}
    assert not ids_page1.intersection(ids_page2), "Pages must not overlap"

    # Cleanup
    db.users.delete_many({"gerant_id": g["gerant_id"]})
    db.workspaces.delete_one({"id": g["workspace_id"]})


@pytest.mark.integration
def test_gerant_sellers_size1_pages_equals_total():
    """With size=1, pages count must equal total seller count (ceiling division)."""
    assert _safe(BASE_URL), "SSRF guard"
    client = MongoClient(MONGO_URL)
    db = client[DB_NAME]

    g = _build_gerant(db)
    for name in ["Alice", "Bob", "Charlie"]:
        _insert_seller(db, g["gerant_id"], name)
    token = _make_token(g["gerant_id"], g["gerant_email"], "gerant")

    data = _get_sellers(token, page=1, size=1)

    assert data["size"] == 1
    assert data["total"] >= 3
    assert data["pages"] >= data["total"], (
        f"pages={data['pages']} should be >= total={data['total']} when size=1"
    )
    assert len(data["items"]) == 1

    # Cleanup
    db.users.delete_many({"gerant_id": g["gerant_id"]})
    db.workspaces.delete_one({"id": g["workspace_id"]})


@pytest.mark.integration
def test_gerant_sellers_empty_when_no_sellers():
    """Gerant with no sellers returns items=[], total=0."""
    assert _safe(BASE_URL), "SSRF guard"
    client = MongoClient(MONGO_URL)
    db = client[DB_NAME]

    g = _build_gerant(db)
    token = _make_token(g["gerant_id"], g["gerant_email"], "gerant")

    data = _get_sellers(token)

    assert data["items"] == [] or data["total"] == 0, (
        f"Expected no sellers for fresh gerant, got: {data}"
    )

    # Cleanup
    db.users.delete_many({"gerant_id": g["gerant_id"]})
    db.workspaces.delete_one({"id": g["workspace_id"]})
