"""
MongoDB JSON Schema validators for critical collections.

Applied at startup (after indexes) via apply_schemas().
Uses validationLevel="moderate" (new inserts + updates to already-valid docs)
and validationAction="error" (reject non-compliant writes).

Collections covered:
- kpi_entries  : champs obligatoires, types numériques, format date, enum source
- users        : champs obligatoires, enum role/status
- stores       : champs obligatoires, enum sync_mode

Design:
- Moderate level: safe for production — existing legacy docs not re-validated
- Focused on truly critical constraints only (not duplicating all Pydantic rules)
- Idempotent: calling multiple times has no effect
"""
import logging
from typing import Any, Dict, Tuple

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Schema definitions
# ---------------------------------------------------------------------------

_DATE_PATTERN = r"^\d{4}-\d{2}-\d{2}$"

SCHEMAS: Dict[str, Dict[str, Any]] = {

    "kpi_entries": {
        "$jsonSchema": {
            "bsonType": "object",
            "required": ["id", "seller_id", "date", "store_id", "source"],
            "properties": {
                "id":        {"bsonType": "string", "description": "UUID de l'entrée"},
                "seller_id": {"bsonType": "string", "description": "UUID du vendeur"},
                "store_id":  {"bsonType": "string", "description": "UUID du magasin"},
                "date":      {
                    "bsonType": "string",
                    "pattern": _DATE_PATTERN,
                    "description": "Date au format YYYY-MM-DD",
                },
                "source": {
                    "bsonType": "string",
                    "enum": ["manual", "api"],
                    "description": "Origine de la saisie",
                },
                "ca_journalier": {"bsonType": ["double", "int", "null"], "minimum": 0},
                "nb_ventes":     {"bsonType": ["int", "null"],           "minimum": 0},
                "nb_clients":    {"bsonType": ["int", "null"],           "minimum": 0},
                "nb_articles":   {"bsonType": ["int", "null"],           "minimum": 0},
                "nb_prospects":  {"bsonType": ["int", "null"],           "minimum": 0},
                "locked":        {"bsonType": ["bool", "null"]},
            },
        }
    },

    "users": {
        "$jsonSchema": {
            "bsonType": "object",
            "required": ["id", "name", "email", "role"],
            "properties": {
                "id":    {"bsonType": "string"},
                "name":  {"bsonType": "string", "minLength": 1},
                "email": {"bsonType": "string"},
                "role": {
                    "bsonType": "string",
                    "enum": ["gerant", "manager", "seller", "super_admin", "it_admin"],
                },
                "status": {
                    "bsonType": ["string", "null"],
                    "enum": ["active", "inactive", "deleted", None],
                },
            },
        }
    },

    "stores": {
        "$jsonSchema": {
            "bsonType": "object",
            "required": ["id", "name", "location"],
            "properties": {
                "id":       {"bsonType": "string"},
                "name":     {"bsonType": "string", "minLength": 1},
                "location": {"bsonType": "string"},
                "active":   {"bsonType": ["bool", "null"]},
                "sync_mode": {
                    "bsonType": ["string", "null"],
                    "enum": ["manual", "api_sync", "scim_sync", None],
                },
            },
        }
    },
}


# ---------------------------------------------------------------------------
# Apply function
# ---------------------------------------------------------------------------

async def apply_schemas(db: Any, logger: logging.Logger = logger) -> Tuple[int, int, int]:
    """
    Apply JSON Schema validators to all collections defined in SCHEMAS.

    Returns (applied, skipped, errors) counts.
    - applied : validator successfully set or updated
    - skipped : collection does not exist yet (validator will be set on first create)
    - errors  : unexpected failure (logged, non-fatal)
    """
    existing = set(await db.list_collection_names())
    applied = skipped = 0
    errors = []

    for collection_name, validator in SCHEMAS.items():
        try:
            if collection_name in existing:
                await db.command(
                    "collMod",
                    collection_name,
                    validator=validator,
                    validationLevel="moderate",
                    validationAction="error",
                )
                applied += 1
                logger.debug("Schema applied: %s", collection_name)
            else:
                # Collection not created yet — skip (schema applied on first write via create_collection)
                skipped += 1
                logger.debug("Schema skipped (collection absent): %s", collection_name)
        except Exception as e:
            errors.append((collection_name, str(e)))
            logger.warning("Schema apply failed for '%s': %s", collection_name, e)

    logger.info(
        "Schemas: %d applied, %d skipped, %d errors",
        applied, skipped, len(errors),
    )
    return applied, skipped, len(errors)
