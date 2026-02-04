"""
Utilitaires de réponse pour les routes manager.
Réduit la duplication des structures de pagination et réponses communes.
"""
from typing import Any, Optional


def pagination_dict(
    result: Optional[Any] = None,
    *,
    total: Optional[int] = None,
    page: Optional[int] = None,
    size: Optional[int] = None,
    pages: Optional[int] = None,
) -> dict:
    """
    Build a standard pagination dict from a result object or from keyword args.
    Use for JSON responses in manager list endpoints.
    """
    if result is not None:
        return {
            "total": result.total,
            "page": result.page,
            "size": result.size,
            "pages": result.pages,
        }
    return {"total": total, "page": page, "size": size, "pages": pages}
