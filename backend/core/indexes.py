"""
Centralized MongoDB index definitions.
Single source of truth for lifespan, ensure_indexes script, and any migration.

Index coverage :
- users                    : id (UNIQUE), email (UNIQUE), gerant_id,
                             (store_id, role, status), (gerant_id, role, status)
- workspaces               : id (UNIQUE), gerant_id, stripe_customer_id
- stores                   : id (UNIQUE), gerant_id
- subscriptions            : stripe_customer_id, stripe_subscription_id (UNIQUE), (user_id, status)
- kpi_entries              : id (UNIQUE), (seller_id, date), (store_id, date),
                             (seller_id, store_id, date), (store_id, locked, date)
- manager_kpis             : id (UNIQUE), (store_id, date), (manager_id, date)
- objectives               : (store_id, status), (manager_id, period_start), (store_id, period)
- challenges               : (store_id, status)
- daily_challenges         : (seller_id, date) + TTL 90j
- sales                    : (seller_id, date)
- debriefs                 : (seller_id, created_at)
- diagnostics              : (seller_id, created_at)
- api_keys                 : (key, is_active)
- kpi_configs              : store_id, manager_id
- team_analyses            : (store_id, generated_at)
- team_bilans              : (manager_id, store_id, created_at)
- evaluations              : (seller_id, created_at), (store_id, created_at)
- seller_bilans            : (seller_id, created_at)
- interview_notes          : (seller_id, created_at)
- morning_briefs           : (store_id, created_at), (manager_id, created_at)
- gerant_invitations       : (gerant_id, status) + TTL 30j
- invitations              : (store_id, status) + TTL 30j
- password_resets          : (email) + TTL via expires_at
- achievement_notifications: (user_id, created_at) + TTL 90j
- ai_conversations         : (user_id, created_at)
- ai_messages              : (conversation_id, created_at)
- ai_usage_logs            : (user_id, created_at) + TTL 90j
- manager_requests         : (seller_id, status)
- manager_seller_metadata  : (manager_id, seller_id) UNIQUE
- relationship_consultations: (seller_id, created_at)
- conflict_consultations   : (seller_id, created_at)
- payment_transactions     : (user_id, created_at)
- onboarding_progress      : user_id UNIQUE
- system_logs              : created_at TTL 30j
- sync_logs                : created_at TTL 30j
- admin_logs               : created_at TTL 365j
- stripe_events            : event_id (UNIQUE)

Création au démarrage via lifespan (_create_indexes_background) ou script :
  python -m backend.scripts.ensure_indexes
"""
from typing import Any, Dict, List, Union

# Index spec: "field" or [("field", 1)|(-1), ...]
# Options: background, unique, sparse, name, partialFilterExpression, expireAfterSeconds, etc.
IndexSpec = Dict[str, Any]

# TTL constants (secondes)
_TTL_1H   = 3_600
_TTL_7D   = 604_800
_TTL_30D  = 2_592_000
_TTL_90D  = 7_776_000
_TTL_180D = 15_552_000
_TTL_365D = 31_536_000


def _spec(keys: Union[str, List], **kwargs: Any) -> IndexSpec:
    """Build index spec. keys: field name or list of (field, direction)."""
    return {"keys": keys, "kwargs": {**kwargs}}


# ---------------------------------------------------------------------------
# Index definitions by collection
# ---------------------------------------------------------------------------

INDEXES: Dict[str, List[IndexSpec]] = {

    # ── Users ────────────────────────────────────────────────────────────────
    "users": [
        _spec("id",    unique=True,  background=True, name="id_unique"),
        _spec("email", unique=True,  background=True, name="email_unique"),
        _spec("gerant_id",           background=True, name="gerant_id_idx"),
        _spec([("store_id", 1), ("role", 1), ("status", 1)],
              background=True, name="store_role_status_idx"),
        _spec([("store_id", 1), ("role", 1)],
              background=True, name="store_role_idx"),
        # Requêtes paginées gérant : get_all_sellers / get_all_managers
        _spec([("gerant_id", 1), ("role", 1), ("status", 1)],
              background=True, name="gerant_role_status_idx"),
        _spec("stripe_customer_id", sparse=True, background=True),
    ],

    # ── Workspaces / Stores ──────────────────────────────────────────────────
    "workspaces": [
        _spec("id",      unique=True, background=True, name="id_unique"),
        _spec("gerant_id",            background=True, name="gerant_id_idx"),
        _spec("stripe_customer_id",  sparse=True, background=True),
    ],
    "stores": [
        _spec("id",      unique=True, background=True, name="id_unique"),
        _spec("gerant_id",            background=True, name="gerant_id_idx"),
    ],

    # ── Subscriptions / Stripe ───────────────────────────────────────────────
    "subscriptions": [
        _spec("stripe_customer_id", sparse=True, background=True),
        _spec("stripe_subscription_id", unique=True,
              partialFilterExpression={
                  "stripe_subscription_id": {"$exists": True, "$type": "string", "$gt": ""}
              },
              background=True, name="unique_stripe_subscription_id"),
        _spec([("user_id", 1), ("status", 1)],
              background=True, name="user_status_idx"),
        _spec([("workspace_id", 1), ("status", 1)],
              sparse=True, background=True, name="workspace_status_idx"),
        _spec([("user_id", 1), ("workspace_id", 1), ("status", 1)],
              sparse=True, background=True, name="user_workspace_status_idx"),
    ],
    "stripe_events": [
        _spec("event_id", unique=True, background=True, name="event_id_unique"),
    ],

    # ── KPI (Time Series collection) ─────────────────────────────────────────
    # kpi_entries est une MongoDB Time Series collection (timeField=ts, metaField=store_id).
    # ⚠️  Les collections Time Series n'acceptent PAS d'index secondaire unique.
    #     L'index sur `id` est donc non-unique (collision uuid4 ≈ 0).
    # ℹ️  L'index {store_id, ts} est créé automatiquement par MongoDB (compound clustered).
    #     On conserve {store_id, date} pour les requêtes par date string.
    "kpi_entries": [
        _spec("id", background=True, name="id_idx"),  # non-unique (TS limitation)
        _spec([("seller_id", 1), ("date", -1)],  background=True, name="seller_date_idx"),
        _spec([("store_id", 1),  ("date", -1)],  background=True, name="store_date_idx"),
        # Passport vendeur : agrégation par (seller_id, store_id, date)
        _spec([("seller_id", 1), ("store_id", 1), ("date", -1)],
              background=True, name="seller_store_date_idx"),
        _spec([("store_id", 1), ("locked", 1), ("date", -1)],
              background=True, name="store_locked_date_idx"),
    ],
    "manager_kpis": [
        _spec("id", unique=True, background=True, name="id_unique"),
        _spec([("store_id",   1), ("date", -1)], background=True, name="store_date_idx"),
        _spec([("manager_id", 1), ("date", -1)], background=True, name="manager_date_idx"),
    ],

    # ── Objectives / Challenges ──────────────────────────────────────────────
    "objectives": [
        _spec([("store_id",   1), ("status", 1)],       background=True, name="store_status_idx"),
        _spec([("seller_id",  1), ("status", 1)],       background=True),
        _spec([("manager_id", 1), ("period_start", 1)], background=True, name="manager_period_start_idx"),
        _spec([("store_id",   1), ("period_start", 1), ("period_end", 1)],
              background=True, name="store_period_idx"),
    ],
    "challenges": [
        _spec([("store_id", 1), ("status", 1)], background=True, name="store_status_idx"),
    ],
    # Daily challenges : (seller_id, date) pour find_by_seller_and_date + TTL 90j
    "daily_challenges": [
        _spec([("seller_id", 1), ("date", -1)], background=True, name="seller_date_idx"),
        _spec("created_at", expireAfterSeconds=_TTL_90D, background=True, name="ttl_90d"),
    ],

    # ── Sales / Debriefs / Diagnostics ───────────────────────────────────────
    "sales": [
        _spec([("seller_id", 1), ("date", -1)], background=True, name="seller_date_idx"),
    ],
    "debriefs": [
        _spec([("seller_id", 1), ("created_at", -1)], background=True, name="seller_created_at_idx"),
    ],
    "diagnostics": [
        _spec([("seller_id", 1), ("created_at", -1)], background=True, name="seller_created_at_idx"),
    ],

    # ── Evaluations / Bilans ─────────────────────────────────────────────────
    "evaluations": [
        _spec([("seller_id", 1), ("created_at", -1)], background=True, name="seller_created_idx"),
        _spec([("store_id",  1), ("created_at", -1)], background=True, name="store_created_idx"),
    ],
    "seller_bilans": [
        _spec([("seller_id", 1), ("created_at", -1)], background=True, name="seller_created_idx"),
    ],
    "team_bilans": [
        _spec([("manager_id", 1), ("store_id", 1), ("created_at", -1)],
              background=True, name="manager_store_created_idx"),
    ],
    "interview_notes": [
        _spec([("seller_id", 1), ("created_at", -1)], background=True, name="seller_created_idx"),
    ],

    # ── AI / Analyses ────────────────────────────────────────────────────────
    "team_analyses": [
        _spec([("store_id", 1), ("generated_at", -1)],
              background=True, name="store_generated_idx"),
    ],
    "ai_conversations": [
        _spec([("user_id", 1), ("created_at", -1)], background=True, name="user_created_idx"),
    ],
    "ai_messages": [
        _spec([("conversation_id", 1), ("created_at", -1)],
              background=True, name="conv_created_idx"),
    ],
    # ai_usage_logs : TTL 90j — pas besoin de garder plus pour analytics
    "ai_usage_logs": [
        _spec([("user_id", 1), ("created_at", -1)], background=True, name="user_created_idx"),
        _spec("created_at", expireAfterSeconds=_TTL_90D, background=True, name="ttl_90d"),
    ],

    # ── Morning Briefs ───────────────────────────────────────────────────────
    "morning_briefs": [
        _spec([("store_id",   1), ("created_at", -1)], background=True, name="store_created_idx"),
        _spec([("manager_id", 1), ("created_at", -1)], background=True, name="manager_created_idx"),
    ],

    # ── Invitations ──────────────────────────────────────────────────────────
    "gerant_invitations": [
        _spec([("gerant_id", 1), ("status", 1)], background=True, name="gerant_status_idx"),
        # TTL 30j : une invitation non acceptée après 1 mois est obsolète
        _spec("created_at", expireAfterSeconds=_TTL_30D, background=True, name="ttl_30d"),
    ],
    "invitations": [
        _spec([("store_id",   1), ("status", 1)],  background=True, name="store_status_idx"),
        _spec([("manager_id", 1), ("status", 1)],  background=True, name="manager_status_idx"),
        _spec("created_at", expireAfterSeconds=_TTL_30D, background=True, name="ttl_30d"),
    ],

    # ── Password Resets ──────────────────────────────────────────────────────
    # SÉCURITÉ : TTL via expires_at (expireAfterSeconds=0 → supprime quand expires_at < now)
    "password_resets": [
        _spec("email", background=True, name="email_idx"),
        _spec("expires_at", expireAfterSeconds=0, background=True, name="ttl_expires_at"),
    ],

    # ── Notifications ────────────────────────────────────────────────────────
    "achievement_notifications": [
        _spec([("user_id", 1), ("created_at", -1)], background=True, name="user_created_idx"),
        _spec("created_at", expireAfterSeconds=_TTL_90D, background=True, name="ttl_90d"),
    ],
    "notifications": [
        _spec([("user_id", 1), ("read", 1), ("created_at", -1)], background=True, name="user_read_created_idx"),
        _spec("created_at", expireAfterSeconds=_TTL_90D, background=True, name="ttl_90d"),
    ],

    # ── Manager Metadata / Requests ──────────────────────────────────────────
    "manager_requests": [
        _spec([("seller_id", 1), ("status", 1)], background=True, name="seller_status_idx"),
    ],
    "manager_seller_metadata": [
        _spec([("manager_id", 1), ("seller_id", 1)],
              unique=True, background=True, name="manager_seller_unique"),
    ],
    "manager_diagnostics": [
        _spec([("manager_id", 1), ("created_at", -1)], background=True, name="manager_created_idx"),
    ],
    "manager_diagnostic_results": [
        _spec([("manager_id", 1), ("created_at", -1)], background=True, name="manager_created_idx"),
    ],

    # ── Consultations ────────────────────────────────────────────────────────
    "relationship_consultations": [
        _spec([("seller_id", 1), ("created_at", -1)], background=True, name="seller_created_idx"),
    ],
    "conflict_consultations": [
        _spec([("seller_id", 1), ("created_at", -1)], background=True, name="seller_created_idx"),
    ],

    # ── Paiements / Facturation ──────────────────────────────────────────────
    "payment_transactions": [
        _spec([("user_id", 1), ("created_at", -1)], background=True, name="user_created_idx"),
    ],
    "billing_profiles": [
        _spec("gerant_id", unique=True, background=True, name="gerant_id_unique"),
    ],

    # ── Onboarding ───────────────────────────────────────────────────────────
    "onboarding_progress": [
        _spec("user_id", unique=True, background=True, name="user_id_unique"),
    ],

    # ── Configs / API Keys ───────────────────────────────────────────────────
    "api_keys": [
        _spec([("key", 1), ("is_active", 1)], background=True, name="key_active_idx"),
    ],
    "kpi_configs": [
        _spec("store_id",   sparse=True, background=True, name="store_id_idx"),
        _spec("manager_id", sparse=True, background=True, name="manager_id_idx"),
    ],

    # ── Logs (TTL automatique) ───────────────────────────────────────────────
    "system_logs": [
        _spec("created_at", expireAfterSeconds=_TTL_30D, background=True, name="ttl_30d"),
    ],
    "sync_logs": [
        _spec("created_at", expireAfterSeconds=_TTL_30D, background=True, name="ttl_30d"),
    ],
    "admin_logs": [
        _spec("created_at", expireAfterSeconds=_TTL_365D, background=True, name="ttl_365d"),
    ],

    # ── Audit logs métier (KPI, objectifs, évaluations — toutes mutations) ───
    "audit_logs": [
        _spec([("store_id", 1), ("created_at", -1)], background=True, name="store_created_idx"),
        _spec([("user_id",  1), ("created_at", -1)], background=True, name="user_created_idx"),
        _spec("created_at", expireAfterSeconds=_TTL_365D, background=True, name="ttl_365d"),
    ],
}


def get_indexes_for_collection(collection: str) -> List[IndexSpec]:
    """Return index specs for a collection, or empty list if unknown."""
    return INDEXES.get(collection, [])


async def apply_indexes(db, *, logger=None):
    """
    Create all indexes from INDEXES on the given Motor database.
    Returns (created, skipped, errors).
    """
    import logging
    if logger is None:
        logger = logging.getLogger(__name__)
    created = skipped = 0
    errors: List[tuple] = []
    for coll_name, specs in INDEXES.items():
        col = getattr(db, coll_name)
        for s in specs:
            keys = s["keys"]
            kwargs = {k: v for k, v in s["kwargs"].items()}
            try:
                await col.create_index(keys, **kwargs)
                created += 1
                logger.debug("Index created: %s on %s", keys, coll_name)
            except Exception as e:
                msg = str(e).lower()
                if "already exists" in msg or "duplicate" in msg:
                    skipped += 1
                else:
                    errors.append((coll_name, keys, e))
                    logger.warning("Index creation failed %s %s: %s", coll_name, keys, e)
    return created, skipped, errors
