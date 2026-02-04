"""
Manager package dependencies: ré-exports des résolveurs de contexte et de la sécurité.
Permet au package manager d'avoir une seule source d'import pour get_store_context,
get_verified_seller, verify_manager_or_gerant, etc.
"""
from api.context_resolvers import (
    get_store_context,
    get_store_context_required,
    get_store_context_with_seller,
    get_verified_seller,
)
from core.security import verify_manager_or_gerant

__all__ = [
    "get_store_context",
    "get_store_context_required",
    "get_store_context_with_seller",
    "get_verified_seller",
    "verify_manager_or_gerant",
]
