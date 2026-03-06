"""Non-regression: POST /api/kpi/seller/entry must always return JSON-serializable payloads.

Covers:
- create then update (same seller/date)
- HTTP 200
- response.json() is json.dumps()-serializable (no bson.ObjectId leaks)

This is an integration test meant to run against a LOCAL test server + LOCAL Mongo.
It is intentionally SSRF-guarded to localhost/127.0.0.1 only.

Env:
- TEST_BASE_URL (default http://localhost:8001)
- MONGO_URL (default mongodb://localhost:27017/)
- TEST_PASSWORD (default TestUserPassword123!)
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


@pytest.mark.integration
def test_post_kpi_seller_entry_is_json_safe_create_and_update():
    # SSRF guard: do not run if TEST_BASE_URL is not local
    assert _is_safe_request_url(BASE_URL), "SSRF guard: TEST_BASE_URL must be localhost/127.0.0.1"

    client = MongoClient(MONGO_URL)
    db = client["retail_coach"]

    # --- Create minimal graph: workspace -> gerant -> store -> seller ---
    workspace_id = str(uuid4())
    gerant_id = str(uuid4())
    store_id = str(uuid4())
    seller_id = str(uuid4())

    now = datetime.now(timezone.utc)

    # workspace (active subscription => write allowed)
    db.workspaces.update_one(
        {"id": workspace_id},
        {"$set": {"id": workspace_id, "subscription_status": "active", "updated_at": now}},
        upsert=True,
    )

    # gerant
    gerant_email = f"test-gerant-{uuid4()}@example.com"
    gerant_pw = bcrypt.hashpw(TEST_PASSWORD.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
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

    # store
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

    # seller
    seller_email = f"test-seller-{uuid4()}@example.com"
    seller_pw = bcrypt.hashpw(TEST_PASSWORD.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
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

    # --- Login as seller ---
    login_url = f"{BASE_URL}/api/auth/login"
    assert _is_safe_request_url(login_url)
    r = requests.post(login_url, json={"email": seller_email, "password": TEST_PASSWORD})
    assert r.status_code == 200
    token = r.json().get("token")
    assert token

    headers = {"Authorization": f"Bearer {token}"}
    date = "2026-03-01"

    # --- CREATE ---
    create_url = f"{BASE_URL}/api/kpi/seller/entry"
    assert _is_safe_request_url(create_url)
    payload = {
        "date": date,
        "ca_journalier": 123.45,
        "nb_ventes": 3,
        "nb_articles": 5,
        "nb_prospects": 2,
        "comment": "json-safe-create",
    }
    r1 = requests.post(create_url, json=payload, headers=headers)
    assert r1.status_code == 200
    data1 = r1.json()
    json.dumps(data1)  # must not raise

    # --- UPDATE (same date) ---
    payload2 = dict(payload)
    payload2["comment"] = "json-safe-update"
    payload2["nb_ventes"] = 4

    r2 = requests.post(create_url, json=payload2, headers=headers)
    assert r2.status_code == 200
    data2 = r2.json()
    json.dumps(data2)  # must not raise

    # basic sanity
    assert data2.get("seller_id") == seller_id
    assert data2.get("date") == date
