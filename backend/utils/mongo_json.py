"""MongoDB → JSON-safe helpers.

Goal: ensure no bson.ObjectId (or other non-JSON types) leak into FastAPI responses.
Use this as a last-resort sanitization layer; prefer repository projections that exclude `_id`.
"""

from __future__ import annotations

from datetime import datetime, date
from typing import Any

try:
    from bson import ObjectId  # type: ignore
except Exception:  # pragma: no cover
    ObjectId = None  # type: ignore


def to_json_safe(value: Any) -> Any:
    """Recursively convert common Mongo/Python types into JSON-serializable equivalents.

    - ObjectId -> str
    - datetime/date -> ISO 8601 string
    - dict/list/tuple/set -> recurse

    Leaves primitives (str/int/float/bool/None) untouched.
    """
    if value is None:
        return None

    # bson.ObjectId
    if ObjectId is not None and isinstance(value, ObjectId):
        return str(value)

    # datetime/date
    if isinstance(value, (datetime, date)):
        return value.isoformat()

    # dict
    if isinstance(value, dict):
        return {str(k): to_json_safe(v) for k, v in value.items()}

    # list/tuple/set
    if isinstance(value, (list, tuple, set)):
        return [to_json_safe(v) for v in value]

    return value
