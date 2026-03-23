"""
Input validators for query parameters.

Centralises format checks to prevent unexpected values reaching MongoDB queries.
All functions raise ValidationError (HTTP 422) on bad input.
"""
import re
from typing import Optional
from core.exceptions import ValidationError

_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
_SAFE_ID_RE = re.compile(r"^[a-zA-Z0-9_\-]{1,128}$")


def validate_date(value: Optional[str], field: str = "date") -> Optional[str]:
    """
    Ensure value is either None or a valid YYYY-MM-DD date string.
    Raises ValidationError (422) if the format is wrong.
    """
    if value is None:
        return None
    if not _DATE_RE.match(value):
        raise ValidationError(
            f"Le champ '{field}' doit être au format YYYY-MM-DD. Reçu : {value!r}"
        )
    return value


def validate_id(value: Optional[str], field: str = "id") -> Optional[str]:
    """
    Ensure value is either None or an alphanumeric ID (UUID-safe).
    Prevents NoSQL operator injection via ID fields.
    """
    if value is None:
        return None
    if not _SAFE_ID_RE.match(value):
        raise ValidationError(
            f"Le champ '{field}' contient des caractères non autorisés."
        )
    return value
