"""
Integration tests — AI cache (team analysis + morning brief).

Strategy: insert a pre-built document directly in MongoDB, then call the
endpoint. The cache check in the route finds it and returns "cached": true
without making any LLM call. This makes the test deterministic and free.

Requires a running API server + MongoDB (same as kpi-json-safe CI job).
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
import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get("TEST_BASE_URL", "http://127.0.0.1:8001")
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://127.0.0.1:27017/")
TEST_PASSWORD = os.environ.get("TEST_PASSWORD", "TestUserPassword123!")
DB_NAME = os.environ.get("DB_NAME", "retail_coach")

_ALLOWED_TEST_HOSTS = ("localhost", "127.0.0.1")


def _safe(url: str) -> bool:
    host = (urlparse(url).hostname or "").lower()
    return host in _ALLOWED_TEST_HOSTS


def _build_gerant_graph(db):
    """workspace → gerant → manager → store; return ids + credentials."""
    now = datetime.now(timezone.utc)
    workspace_id = str(uuid4())
    gerant_id = str(uuid4())
    manager_id = str(uuid4())
    store_id = str(uuid4())
    gerant_email = f"test-gerant-{uuid4()}@example.com"
    manager_email = f"test-manager-{uuid4()}@example.com"
    pw_hash = bcrypt.hashpw(TEST_PASSWORD.encode(), bcrypt.gensalt()).decode()

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
            "id": gerant_id, "email": gerant_email, "password": pw_hash,
            "role": "gerant", "status": "active",
            "workspace_id": workspace_id, "name": "Test Gérant",
            "created_at": now,
        }},
        upsert=True,
    )
    db.users.update_one(
        {"id": manager_id},
        {"$set": {
            "id": manager_id, "email": manager_email, "password": pw_hash,
            "role": "manager", "status": "active",
            "workspace_id": workspace_id, "store_id": store_id,
            "name": "Test Manager",
            "created_at": now,
        }},
        upsert=True,
    )
    db.stores.update_one(
        {"id": store_id},
        {"$set": {
            "id": store_id, "gerant_id": gerant_id, "active": True,
            "name": "Test Store Cache", "location": "Paris",
            "created_at": now,
        }},
        upsert=True,
    )
    return {
        "workspace_id": workspace_id,
        "gerant_id": gerant_id,
        "manager_id": manager_id,
        "store_id": store_id,
        "gerant_email": gerant_email,
        "manager_email": manager_email,
    }


def _login(email: str) -> str:
    url = f"{BASE_URL}/api/auth/login"
    assert _safe(url)
    r = requests.post(url, json={"email": email, "password": TEST_PASSWORD})
    assert r.status_code == 200, f"Login failed: {r.text}"
    token = r.json().get("token")
    assert token
    return token


# ---------------------------------------------------------------------------
# Team analysis cache
# ---------------------------------------------------------------------------

@pytest.mark.integration
def test_team_analysis_cache_hit():
    """
    Pre-insert a team_analyses doc (generated_at < 6h ago).
    POST /api/manager/analyze-team → must return cached=True without LLM call.
    """
    assert _safe(BASE_URL), "SSRF guard"

    client = MongoClient(MONGO_URL)
    db = client[DB_NAME]

    graph = _build_gerant_graph(db)
    token = _login(graph["manager_email"])
    headers = {"Authorization": f"Bearer {token}"}

    store_id = graph["store_id"]
    today = datetime.now(timezone.utc)
    period_start = (today - timedelta(days=30)).strftime("%Y-%m-%d")
    period_end = today.strftime("%Y-%m-%d")

    # Insert a fresh team analysis (2h ago — within the 6h TTL)
    db.team_analyses.delete_many({"store_id": store_id})
    db.team_analyses.insert_one({
        "id": str(uuid4()),
        "store_id": store_id,
        "manager_id": graph["manager_id"],
        "period_start": period_start,
        "period_end": period_end,
        "analysis": "Analyse test: bonne performance.",
        "generated_at": (today - timedelta(hours=2)).isoformat(),
        "created_at": today.isoformat(),
    })

    url = f"{BASE_URL}/api/manager/analyze-team?store_id={store_id}"
    assert _safe(url)
    payload = {
        "period_filter": "custom",
        "start_date": period_start,
        "end_date": period_end,
        "team_data": {},
    }
    r = requests.post(url, json=payload, headers=headers)

    assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
    data = r.json()
    assert data.get("cached") is True, f"Expected cached=True, got: {data}"
    assert data.get("analysis") == "Analyse test: bonne performance."
    assert data.get("period_start") == period_start
    assert data.get("period_end") == period_end

    # Cleanup
    db.team_analyses.delete_many({"store_id": store_id})


@pytest.mark.integration
def test_team_analysis_cache_miss_no_doc():
    """
    No team_analyses doc in DB → route must NOT return cached=True.
    (It would try to call LLM but OPENAI key is dummy → 500 or partial error,
    the key assertion is just that cached is not True.)
    """
    assert _safe(BASE_URL), "SSRF guard"

    client = MongoClient(MONGO_URL)
    db = client[DB_NAME]

    graph = _build_gerant_graph(db)
    token = _login(graph["manager_email"])
    headers = {"Authorization": f"Bearer {token}"}

    store_id = graph["store_id"]
    today = datetime.now(timezone.utc)
    period_start = (today - timedelta(days=7)).strftime("%Y-%m-%d")
    period_end = today.strftime("%Y-%m-%d")

    # Ensure no cached doc
    db.team_analyses.delete_many({"store_id": store_id})

    url = f"{BASE_URL}/api/manager/analyze-team?store_id={store_id}"
    assert _safe(url)
    payload = {
        "period_filter": "custom",
        "start_date": period_start,
        "end_date": period_end,
        "team_data": {},
    }
    r = requests.post(url, json=payload, headers=headers)

    # May be 200 (with fallback) or 500 (dummy LLM key) — key: NOT a cached response
    data = r.json() if r.status_code == 200 else {}
    assert data.get("cached") is not True, f"Should not be cached when no doc: {data}"


# ---------------------------------------------------------------------------
# Morning brief cache
# ---------------------------------------------------------------------------

@pytest.mark.integration
def test_morning_brief_cache_hit():
    """
    Pre-insert a morning_briefs doc for today (no context).
    POST /api/briefs/morning (no comments) → must return cached=True.
    """
    assert _safe(BASE_URL), "SSRF guard"

    client = MongoClient(MONGO_URL)
    db = client[DB_NAME]

    graph = _build_gerant_graph(db)
    token = _login(graph["gerant_email"])
    headers = {"Authorization": f"Bearer {token}"}

    store_id = graph["store_id"]
    now = datetime.now(timezone.utc)
    today_str = now.strftime("%Y-%m-%d")

    # Insert a morning brief for today, no context
    db.morning_briefs.delete_many({"store_id": store_id})
    db.morning_briefs.insert_one({
        "id": str(uuid4()),
        "store_id": store_id,
        "manager_id": graph["gerant_id"],
        "brief": "Bonjour, belle journée en perspective.",
        "brief_id": str(uuid4()),
        "date": today_str,
        "data_date": today_str,
        "store_name": "Test Store Cache",
        "manager_name": "Test Gérant",
        "generated_at": now.isoformat(),
        "context": None,
        "fallback": False,
        "created_at": now.isoformat(),
    })

    url = f"{BASE_URL}/api/briefs/morning?store_id={store_id}"
    assert _safe(url)
    # No `comments` field → cache check is triggered
    r = requests.post(url, json={}, headers=headers)

    assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
    data = r.json()
    assert data.get("cached") is True, f"Expected cached=True, got: {data}"
    assert data.get("brief") == "Bonjour, belle journée en perspective."

    # Cleanup
    db.morning_briefs.delete_many({"store_id": store_id})


@pytest.mark.integration
def test_morning_brief_cache_bypassed_with_comments():
    """
    Even if a cached brief exists, passing `comments` bypasses the cache
    (customized brief → always fresh LLM call).
    """
    assert _safe(BASE_URL), "SSRF guard"

    client = MongoClient(MONGO_URL)
    db = client[DB_NAME]

    graph = _build_gerant_graph(db)
    token = _login(graph["gerant_email"])
    headers = {"Authorization": f"Bearer {token}"}

    store_id = graph["store_id"]
    now = datetime.now(timezone.utc)
    today_str = now.strftime("%Y-%m-%d")

    # Insert a cached brief
    db.morning_briefs.delete_many({"store_id": store_id})
    db.morning_briefs.insert_one({
        "id": str(uuid4()),
        "store_id": store_id,
        "manager_id": graph["gerant_id"],
        "brief": "Brief mis en cache.",
        "brief_id": str(uuid4()),
        "date": today_str,
        "data_date": today_str,
        "store_name": "Test Store Cache",
        "manager_name": "Test Gérant",
        "generated_at": now.isoformat(),
        "context": None,
        "fallback": False,
        "created_at": now.isoformat(),
    })

    url = f"{BASE_URL}/api/briefs/morning?store_id={store_id}"
    assert _safe(url)
    # Passing `comments` → cache is bypassed
    r = requests.post(url, json={"comments": "Focus sur les objectifs du mois."}, headers=headers)

    # May 200 (with fallback) or 500 (dummy LLM key) — key: NOT a cache hit
    data = r.json() if r.status_code == 200 else {}
    assert data.get("cached") is not True, f"Should not be cached when comments provided: {data}"

    # Cleanup
    db.morning_briefs.delete_many({"store_id": store_id})
