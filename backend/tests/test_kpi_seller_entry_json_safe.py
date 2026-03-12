"""Non-regression + business logic: POST /api/kpi/seller/entry.

Covers 3 scenarios:
1. Creation authorized when no entry exists → HTTP 200 + JSON-safe response
2. Blocked (403) when an API-locked entry exists for that date
3. API data overwrites seller data: seller entry exists → direct DB upsert with
   locked=True simulates an API import → the seller entry is no longer modifiable (403)

This is an integration test meant to run against a LOCAL test server + LOCAL Mongo.
SSRF-guarded to localhost/127.0.0.1 only.

Env:
- TEST_BASE_URL  (default http://localhost:8001)
- MONGO_URL      (default mongodb://localhost:27017/)
- TEST_PASSWORD  (default TestUserPassword123!)
"""

import json
import os
from datetime import datetime, timezone
from uuid import uuid4
from urllib.parse import urlparse

import bcrypt
import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get("TEST_BASE_URL", "http://localhost:8001")
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017/")
TEST_PASSWORD = os.environ.get("TEST_PASSWORD", "TestUserPassword123!")

_ALLOWED_TEST_HOSTS = ("localhost", "127.0.0.1")


def _is_safe_request_url(url: str) -> bool:
    parsed = urlparse(url)
    host = (parsed.hostname or "").lower()
    return host in _ALLOWED_TEST_HOSTS


def _build_test_graph(db):
    """Insert workspace → gerant → store → seller, return ids + credentials."""
    workspace_id = str(uuid4())
    gerant_id = str(uuid4())
    store_id = str(uuid4())
    seller_id = str(uuid4())
    now = datetime.now(timezone.utc)

    db.workspaces.update_one(
        {"id": workspace_id},
        {"$set": {"id": workspace_id, "subscription_status": "active", "updated_at": now}},
        upsert=True,
    )

    gerant_email = f"test-gerant-{uuid4()}@example.com"
    gerant_pw = bcrypt.hashpw(TEST_PASSWORD.encode(), bcrypt.gensalt()).decode()
    db.users.update_one(
        {"id": gerant_id},
        {
            "$set": {
                "id": gerant_id,
                "email": gerant_email,
                "password": gerant_pw,
                "role": "gerant",
                "status": "active",
                "workspace_id": workspace_id,
                "created_at": now,
            }
        },
        upsert=True,
    )

    db.stores.update_one(
        {"id": store_id},
        {
            "$set": {
                "id": store_id,
                "gerant_id": gerant_id,
                "active": True,
                "name": "Test Store",
                "created_at": now,
            }
        },
        upsert=True,
    )

    seller_email = f"test-seller-{uuid4()}@example.com"
    seller_pw = bcrypt.hashpw(TEST_PASSWORD.encode(), bcrypt.gensalt()).decode()
    db.users.update_one(
        {"id": seller_id},
        {
            "$set": {
                "id": seller_id,
                "email": seller_email,
                "password": seller_pw,
                "role": "seller",
                "status": "active",
                "gerant_id": gerant_id,
                "store_id": store_id,
                "name": "Test Seller",
                "created_at": now,
            }
        },
        upsert=True,
    )

    return {
        "workspace_id": workspace_id,
        "gerant_id": gerant_id,
        "store_id": store_id,
        "seller_id": seller_id,
        "seller_email": seller_email,
    }


def _login(seller_email: str) -> str:
    login_url = f"{BASE_URL}/api/auth/login"
    assert _is_safe_request_url(login_url)
    r = requests.post(login_url, json={"email": seller_email, "password": TEST_PASSWORD})
    assert r.status_code == 200, f"Login failed: {r.text}"
    token = r.json().get("token")
    assert token
    return token


_BASE_PAYLOAD = {
    "ca_journalier": 123.45,
    "nb_ventes": 3,
    "nb_articles": 5,
    "nb_prospects": 2,
    "comment": "test",
}


# ---------------------------------------------------------------------------
# Scenario 1 — Creation authorized when no entry exists
# ---------------------------------------------------------------------------
@pytest.mark.integration
def test_kpi_seller_entry_scenario1_creation_authorized():
    """No existing entry for date → POST returns 200 + JSON-safe payload."""
    assert _is_safe_request_url(BASE_URL), "SSRF guard: TEST_BASE_URL must be localhost/127.0.0.1"

    client = MongoClient(MONGO_URL)
    db = client["retail_coach"]

    graph = _build_test_graph(db)
    token = _login(graph["seller_email"])
    headers = {"Authorization": f"Bearer {token}"}

    date = "2026-03-01"
    # Ensure clean slate
    db.kpi_entries.delete_many({"seller_id": graph["seller_id"], "date": date})

    url = f"{BASE_URL}/api/kpi/seller/entry"
    assert _is_safe_request_url(url)
    r = requests.post(url, json={"date": date, **_BASE_PAYLOAD}, headers=headers)

    assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
    data = r.json()
    json.dumps(data)  # must not raise — no bson.ObjectId leak
    assert data.get("seller_id") == graph["seller_id"]
    assert data.get("date") == date
    assert data.get("source") == "manual"
    assert data.get("locked") is False


# ---------------------------------------------------------------------------
# Scenario 2 — Blocked when an API-locked entry already exists
# ---------------------------------------------------------------------------
@pytest.mark.integration
def test_kpi_seller_entry_scenario2_blocked_by_api_lock():
    """API-locked entry exists for date → seller POST returns 403."""
    assert _is_safe_request_url(BASE_URL), "SSRF guard: TEST_BASE_URL must be localhost/127.0.0.1"

    client = MongoClient(MONGO_URL)
    db = client["retail_coach"]

    graph = _build_test_graph(db)
    token = _login(graph["seller_email"])
    headers = {"Authorization": f"Bearer {token}"}

    date = "2026-03-02"
    # Simulate an API import: insert a locked entry directly in DB
    db.kpi_entries.delete_many({"seller_id": graph["seller_id"], "date": date})
    db.kpi_entries.insert_one({
        "id": str(uuid4()),
        "seller_id": graph["seller_id"],
        "store_id": graph["store_id"],
        "date": date,
        "ca_journalier": 500.0,
        "nb_ventes": 10,
        "nb_articles": 15,
        "nb_prospects": 8,
        "source": "api",
        "locked": True,
        "created_at": datetime.now(timezone.utc),
    })

    url = f"{BASE_URL}/api/kpi/seller/entry"
    assert _is_safe_request_url(url)
    r = requests.post(url, json={"date": date, **_BASE_PAYLOAD}, headers=headers)

    assert r.status_code == 403, f"Expected 403 (locked by API), got {r.status_code}: {r.text}"


# ---------------------------------------------------------------------------
# Scenario 3 — API data overwrites seller data
# ---------------------------------------------------------------------------
@pytest.mark.integration
def test_kpi_seller_entry_scenario3_api_overwrites_seller():
    """
    Seller creates an entry (200), then API import upserts the same date with
    locked=True. After the import the entry is locked: seller can no longer
    modify it (403), and the stored values reflect the API data.
    """
    assert _is_safe_request_url(BASE_URL), "SSRF guard: TEST_BASE_URL must be localhost/127.0.0.1"

    client = MongoClient(MONGO_URL)
    db = client["retail_coach"]

    graph = _build_test_graph(db)
    token = _login(graph["seller_email"])
    headers = {"Authorization": f"Bearer {token}"}

    date = "2026-03-03"
    db.kpi_entries.delete_many({"seller_id": graph["seller_id"], "date": date})

    url = f"{BASE_URL}/api/kpi/seller/entry"
    assert _is_safe_request_url(url)

    # Step A: seller creates the entry manually → must succeed
    r = requests.post(url, json={"date": date, **_BASE_PAYLOAD}, headers=headers)
    assert r.status_code == 200, f"Step A failed: {r.status_code}: {r.text}"
    data = r.json()
    json.dumps(data)
    assert data.get("source") == "manual"
    assert data.get("locked") is False

    # Step B: API import overwrites the entry (direct DB upsert, source=api, locked=True)
    api_ca = 999.99
    db.kpi_entries.update_one(
        {"seller_id": graph["seller_id"], "date": date},
        {
            "$set": {
                "ca_journalier": api_ca,
                "nb_ventes": 20,
                "source": "api",
                "locked": True,
                "updated_at": datetime.now(timezone.utc),
            }
        },
    )

    # Verify DB reflects API data
    entry = db.kpi_entries.find_one({"seller_id": graph["seller_id"], "date": date}, {"_id": 0})
    assert entry is not None
    assert entry.get("locked") is True
    assert entry.get("source") == "api"
    assert entry.get("ca_journalier") == api_ca

    # Step C: seller tries to update again → must be blocked (403)
    r2 = requests.post(url, json={"date": date, **_BASE_PAYLOAD}, headers=headers)
    assert r2.status_code == 403, f"Step C: expected 403 after API lock, got {r2.status_code}: {r2.text}"
