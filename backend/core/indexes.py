"""
Centralized MongoDB index definitions.
Single source of truth for lifespan, ensure_indexes script, and any migration.

Index coverage :
- users        : id (UNIQUE), email (UNIQUE), gerant_id, (store_id, role, status)
- workspaces   : id (UNIQUE), gerant_id, stripe_customer_id
- stores       : id (UNIQUE), gerant_id
- subscriptions: stripe_customer_id, stripe_subscription_id (UNIQUE), (user_id, status)
- kpi_entries  : id (UNIQUE), (seller_id, date), (store_id, date), (store_id, locked, date)
- manager_kpis : id (UNIQUE), (store_id, date), (manager_id, date)
- objectives   : (store_id, status), (manager_id, period_start), (store_id, period)
- challenges   : (store_id, status)
- sales        : (seller_id, date)
- debriefs     : (seller_id, created_at)
- diagnostics  : (seller_id, created_at)
- api_keys     : (key, is_active)
- kpi_configs  : store_id, manager_id
- team_analyses: (store_id, generated_at)
- team_bilans  : (manager_id, store_id, created_at)
- evaluations  : (seller_id, created_at), (store_id, created_at)
- seller_bilans: (seller_id, created_at)

Création au démarrage via lifespan (_create_indexes_background) ou script :
  python -m backend.scripts.ensure_indexes
"""
from typing import Any, Dict, List, Union

# Index spec: "field" or [("field", 1)|(-1), ...]
# Options: background, unique, sparse, name, partialFilterExpression, etc.
IndexSpec = Dict[str, Any]


def _spec(keys: Union[str, List], **kwargs: Any) -> IndexSpec:
    """Build index spec. keys: field name or list of (field, direction)."""
    return {"keys": keys, "kwargs": {**kwargs}}


# ---------------------------------------------------------------------------
# Index definitions by collection
# ---------------------------------------------------------------------------

INDEXES: Dict[str, List[IndexSpec]] = {
    "users": [
        _spec("id", unique=True, background=True, name="id_unique"),
        _spec("email", unique=True, background=True, name="email_unique"),
        _spec("gerant_id", background=True, name="gerant_id_idx"),
        _spec([("store_id", 1), ("role", 1), ("status", 1)], background=True, name="store_role_status_idx"),
        _spec([("store_id", 1), ("role", 1)], background=True, name="store_role_idx"),
        _spec("stripe_customer_id", sparse=True, background=True),
    ],
    "workspaces": [
        _spec("id", unique=True, background=True, name="id_unique"),
        _spec("gerant_id", background=True, name="gerant_id_idx"),
        _spec("stripe_customer_id", sparse=True, background=True),
    ],
    "stores": [
        _spec("id", unique=True, background=True, name="id_unique"),
        _spec("gerant_id", background=True, name="gerant_id_idx"),
    ],
    "subscriptions": [
        _spec("stripe_customer_id", sparse=True, background=True),
        _spec(
            "stripe_subscription_id",
            unique=True,
            partialFilterExpression={
                "stripe_subscription_id": {"$exists": True, "$type": "string", "$gt": ""}
            },
            background=True,
            name="unique_stripe_subscription_id",
        ),
        _spec([("user_id", 1), ("status", 1)], background=True, name="user_status_idx"),
        _spec(
            [("workspace_id", 1), ("status", 1)],
            sparse=True,
            background=True,
            name="workspace_status_idx",
        ),
        _spec(
            [("user_id", 1), ("workspace_id", 1), ("status", 1)],
            sparse=True,
            background=True,
            name="user_workspace_status_idx",
        ),
    ],
    "kpi_entries": [
        _spec([("seller_id", 1), ("date", -1)], background=True, name="seller_date_idx"),
        _spec([("store_id", 1), ("date", -1)], background=True, name="store_date_idx"),
        _spec([("seller_id", 1), ("store_id", 1), ("date", -1)], background=True),
        # Lookup par id interne (update_one / find_one par id)
        _spec("id", unique=True, background=True, name="id_unique"),
        # Requêtes de verrou API : {store_id, locked: True} et {store_id, locked: True, date: range}
        _spec([("store_id", 1), ("locked", 1), ("date", -1)], background=True, name="store_locked_date_idx"),
    ],
    "objectives": [
        _spec([("store_id", 1), ("status", 1)], background=True, name="store_status_idx"),
        _spec([("seller_id", 1), ("status", 1)], background=True),
        _spec([("manager_id", 1), ("period_start", 1)], background=True, name="manager_period_start_idx"),
        _spec([("store_id", 1), ("period_start", 1), ("period_end", 1)], background=True, name="store_period_idx"),
    ],
    "challenges": [
        _spec([("store_id", 1), ("status", 1)], background=True, name="store_status_idx"),
    ],
    # --- Collections sans index : ajout prioritaire ---
    # api_keys : appelé sur CHAQUE requête d'intégration externe (sync KPI, SCIM)
    "api_keys": [
        _spec([("key", 1), ("is_active", 1)], unique=False, background=True, name="key_active_idx"),
    ],
    # kpi_configs : fetch par store à chaque opération KPI (config des champs actifs)
    "kpi_configs": [
        _spec("store_id", sparse=True, background=True, name="store_id_idx"),
        _spec("manager_id", sparse=True, background=True, name="manager_id_idx"),
    ],
    # team_analyses : historique des analyses IA par magasin
    "team_analyses": [
        _spec([("store_id", 1), ("generated_at", -1)], background=True, name="store_generated_idx"),
    ],
    # team_bilans : bilans équipe par manager + magasin
    "team_bilans": [
        _spec([("manager_id", 1), ("store_id", 1), ("created_at", -1)], background=True, name="manager_store_created_idx"),
    ],
    # evaluations : évaluations de vente par vendeur et par magasin
    "evaluations": [
        _spec([("seller_id", 1), ("created_at", -1)], background=True, name="seller_created_idx"),
        _spec([("store_id", 1), ("created_at", -1)], background=True, name="store_created_idx"),
    ],
    # seller_bilans : bilans vendeur individuels
    "seller_bilans": [
        _spec([("seller_id", 1), ("created_at", -1)], background=True, name="seller_created_idx"),
    ],
    "sales": [
        _spec([("seller_id", 1), ("date", -1)], background=True, name="seller_date_idx"),
    ],
    "debriefs": [
        _spec([("seller_id", 1), ("created_at", -1)], background=True, name="seller_created_at_idx"),
    ],
    "diagnostics": [
        _spec([("seller_id", 1), ("created_at", -1)], background=True, name="seller_created_at_idx"),
    ],
    "manager_kpis": [
        # ⚠️ Index corrigé : store_id en prefix car les requêtes sont {store_id, date}
        # L'ancien (manager_id, date, store_id) était inutilisable pour les requêtes store-centric
        _spec([("store_id", 1), ("date", -1)], background=True, name="store_date_idx"),
        _spec([("manager_id", 1), ("date", -1)], background=True, name="manager_date_idx"),
        # Lookup par id interne (update_one / find_one par id)
        _spec("id", unique=True, background=True, name="id_unique"),
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
