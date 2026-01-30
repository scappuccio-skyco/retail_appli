"""
Centralized MongoDB index definitions (Audit 2.6 & 3.1).
Single source of truth for lifespan, ensure_indexes script, and any migration.
Includes mandatory indexes on users.id, users.email (UNIQUE), users.gerant_id,
workspaces.id, workspaces.gerant_id, stores.id, stores.gerant_id.

Audit Point 3.2 – Index composés recommandés (déjà présents ici) :
- Users : email_unique (contrainte d’unicité comptes), gerant_id_idx (recherches par gérant).
- Stores : gerant_id_idx (find_by_gerant).
- Vendeurs / users : (store_id, role, status) → store_role_status_idx.
- KPIs : (seller_id, date) → seller_date_idx sur kpi_entries.
- Objectives : manager_period_start_idx, store_period_idx (centralisés ici).
- Débriefs : (seller_id, created_at) → seller_created_at_idx sur debriefs.
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
        _spec(
            [("manager_id", 1), ("date", -1), ("store_id", 1)],
            background=True,
            name="manager_date_store_idx",
        ),
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
