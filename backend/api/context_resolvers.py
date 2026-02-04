"""
Context resolvers for Manager/Gérant/Seller routes.
Centralizes store_id resolution and seller access verification (audit points 1.4, 2.2, 2.3).
"""
from __future__ import annotations

import logging
from typing import Any, Dict, Optional

from fastapi import Depends, Request

from core.constants import ERR_STORE_ID_REQUIS
from core.exceptions import AppException, ForbiddenError, NotFoundError, ValidationError
from core.security import (
    verify_manager_gerant_or_seller,
    verify_manager_or_gerant,
    verify_store_access_for_user,
    verify_seller_store_access,
)
from api.dependencies import get_manager_service
from services.manager_service import ManagerService

logger = logging.getLogger(__name__)

# Typed dict for autocompletion (context returned by resolve_store_context)
StoreContextDict = Dict[str, Any]  # id, role, store_id, resolved_store_id, view_mode, store_name?, ...


async def resolve_store_context(
    request: Request,
    current_user: Dict[str, Any],
    manager_service: ManagerService,
    *,
    include_seller: bool = False,
) -> StoreContextDict:
    """
    Resolve store_id based on user role (single source of truth).

    - Manager: use assigned store_id.
    - Gérant: store_id from query (with ownership verification). If include_seller=False,
      allows no store_id (gerant_overview). If include_seller=True, store_id is required.
    - Seller (only if include_seller=True): use their assigned store_id.

    Returns dict with current_user fields plus: resolved_store_id, view_mode, store_name?.
    """
    role = current_user.get("role")

    if role == "manager":
        store_id = current_user.get("store_id")
        if not store_id:
            raise ValidationError("Manager n'a pas de magasin assigné")
        return {
            **current_user,
            "resolved_store_id": store_id,
            "view_mode": "manager",
        }

    if role in ["gerant", "gérant"]:
        store_id = request.query_params.get("store_id")
        if not store_id:
            if include_seller:
                raise ValidationError(
                    "Le paramètre store_id est requis pour un gérant. Ex: ?store_id=xxx"
                )
            logger.debug(
                "[resolve_store_context] Gérant %s - no store_id in query params",
                current_user.get("id"),
            )
            return {
                **current_user,
                "resolved_store_id": None,
                "view_mode": "gerant_overview",
            }
        try:
            store = await manager_service.get_store_by_id(
                store_id,
                gerant_id=current_user["id"],
                projection={"_id": 0, "id": 1, "name": 1, "active": 1, "manager_id": 1, "gerant_id": 1},
            )
            if store and not store.get("active"):
                store = None
            if not store:
                logger.warning(
                    "Gérant %s attempted to access store %s which doesn't exist or doesn't belong to them",
                    current_user["id"],
                    store_id,
                )
                if include_seller:
                    store_exists = await manager_service.get_store_by_id_simple(
                        store_id,
                        projection={"_id": 0, "id": 1, "gerant_id": 1, "active": 1},
                    )
                    if store_exists:
                        if store_exists.get("gerant_id") != current_user["id"]:
                            raise ForbiddenError("Ce magasin ne vous appartient pas")
                        if not store_exists.get("active", True):
                            raise ForbiddenError("Ce magasin est inactif")
                    raise NotFoundError("Magasin non trouvé")
                return {
                    **current_user,
                    "resolved_store_id": None,
                    "view_mode": "gerant_overview",
                }
            verify_store_access_for_user(store, current_user)
            logger.debug(
                "[resolve_store_context] Gérant %s - store %s verified",
                current_user.get("id"),
                store_id,
            )
            return {
                **current_user,
                "resolved_store_id": store_id,
                "view_mode": "gerant_as_manager",
                "store_name": store.get("name"),
            }
        except AppException:
            raise
        except Exception as e:
            logger.error("Error verifying store ownership: %s", e, exc_info=True)
            if include_seller:
                raise
            return {
                **current_user,
                "resolved_store_id": None,
                "view_mode": "gerant_overview",
            }

    if include_seller and role == "seller":
        store_id = current_user.get("store_id")
        if not store_id:
            raise ValidationError("Vendeur n'a pas de magasin assigné")
        return {
            **current_user,
            "resolved_store_id": store_id,
            "view_mode": "seller",
        }

    logger.warning("[resolve_store_context] Unauthorized role: %s", role)
    raise ForbiddenError("Rôle non autorisé")


# ----- FastAPI dependencies (inject Request, current_user, manager_service) -----


async def get_store_context(
    request: Request,
    current_user: Dict[str, Any] = Depends(verify_manager_or_gerant),
    manager_service: ManagerService = Depends(get_manager_service),
) -> StoreContextDict:
    """
    Dependency: resolve store context for Manager or Gérant.
    Gérant without store_id gets gerant_overview (resolved_store_id=None).
    """
    return await resolve_store_context(
        request, current_user, manager_service, include_seller=False
    )


async def get_store_context_required(
    context: StoreContextDict = Depends(get_store_context),
) -> StoreContextDict:
    """
    Dependency: same as get_store_context but raises ValidationError if resolved_store_id is missing.
    Use in manager routes that require a store (e.g. seller endpoints, KPI, evaluations).
    """
    if not context.get("resolved_store_id"):
        raise ValidationError(ERR_STORE_ID_REQUIS)
    return context


async def get_store_context_with_seller(
    request: Request,
    current_user: Dict[str, Any] = Depends(verify_manager_gerant_or_seller),
    manager_service: ManagerService = Depends(get_manager_service),
) -> StoreContextDict:
    """
    Dependency: resolve store context for Manager, Gérant, or Seller.
    Gérant must provide store_id when using this dependency.
    """
    return await resolve_store_context(
        request, current_user, manager_service, include_seller=True
    )


async def get_verified_seller(
    seller_id: str,
    context: StoreContextDict = Depends(get_store_context),
    manager_service: ManagerService = Depends(get_manager_service),
) -> Dict[str, Any]:
    """
    Dependency: verify that the seller exists and belongs to the current user's store.
    Use in routes like GET /debriefs/{seller_id} or GET /competences-history/{seller_id}.
    Injects the seller dict; raises NotFoundError or ForbiddenError otherwise.
    """
    resolved_store_id: Optional[str] = context.get("resolved_store_id")
    user_role = context.get("role")
    user_id = context.get("id")
    if not resolved_store_id:
        raise ValidationError("store_id requis pour vérifier l'accès au vendeur")
    return await verify_seller_store_access(
        seller_id=seller_id,
        user_store_id=resolved_store_id,
        user_role=user_role or "",
        user_id=user_id or "",
        manager_service=manager_service,
    )
