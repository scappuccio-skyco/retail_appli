"""
Manager - Sellers: vendeurs, invitations, équipe, profils vendeur (stats, kpi-history, profile).
"""
from datetime import datetime, timezone, timedelta
import logging
from typing import Optional

from fastapi import APIRouter, Depends, Query, Request

from core.exceptions import AppException, NotFoundError, ValidationError
from core.security import verify_seller_store_access
from api.routes.manager.dependencies import get_store_context, get_verified_seller
from api.dependencies import (
    get_manager_service,
    get_manager_seller_management_service,
    get_manager_kpi_service,
    get_competence_service,
)
from api.dependencies_rate_limiting import rate_limit
from models.pagination import PaginatedResponse, PaginationParams
from services.manager_service import ManagerService
from services.manager import ManagerSellerManagementService, ManagerKpiService
from services.competence_service import CompetenceService

router = APIRouter(prefix="")
logger = logging.getLogger(__name__)


@router.get("/sellers", dependencies=[rate_limit("100/minute")])
async def get_sellers(
    store_id: Optional[str] = Query(None, description="Store ID (requis pour gérant)"),
    pagination: PaginationParams = Depends(),
    context: dict = Depends(get_store_context),
    seller_service: ManagerSellerManagementService = Depends(
        get_manager_seller_management_service
    ),
):
    """Get paginated sellers for the store. Uses PaginationParams (page, size)."""
    try:
        resolved_store_id = context.get("resolved_store_id")
        result = await seller_service.get_sellers_for_store_paginated(
            resolved_store_id, page=pagination.page, size=pagination.size
        )
        return {
            "sellers": result.items,
            "pagination": {
                "total": result.total,
                "page": result.page,
                "size": result.size,
                "pages": result.pages,
            },
        }
    except AppException:
        raise


@router.get("/invitations")
async def get_invitations(
    store_id: Optional[str] = Query(None, description="Store ID (requis pour gérant)"),
    context: dict = Depends(get_store_context),
    seller_service: ManagerSellerManagementService = Depends(
        get_manager_seller_management_service
    ),
):
    """Get pending invitations for the store."""
    manager_id = context.get("id")
    return await seller_service.get_invitations(manager_id)


@router.get("/sellers/archived")
async def get_archived_sellers(
    store_id: Optional[str] = Query(None, description="Store ID (requis pour gérant)"),
    page: int = Query(1, ge=1, description="Numéro de page"),
    size: int = Query(50, ge=1, le=100, description="Taille de page"),
    context: dict = Depends(get_store_context),
    seller_service: ManagerSellerManagementService = Depends(
        get_manager_seller_management_service
    ),
):
    """Get list of suspended (en veille) sellers. Deleted sellers are permanently hidden."""
    try:
        resolved_store_id = context.get("resolved_store_id")
        suspended_sellers_result = await seller_service.get_sellers_by_status_paginated(
            resolved_store_id, "suspended", page=page, size=size
        )
        return {
            "sellers": suspended_sellers_result.items,
            "pagination": {
                "total": suspended_sellers_result.total,
                "page": suspended_sellers_result.page,
                "size": suspended_sellers_result.size,
                "pages": suspended_sellers_result.pages,
            },
        }
    except Exception:
        raise


@router.get("/seller/{seller_id}/stats", dependencies=[rate_limit("100/minute")])
async def get_seller_stats(
    request: Request,
    seller_id: str,
    days: int = Query(30, description="Number of days for stats calculation"),
    store_id: Optional[str] = Query(None, description="Store ID (requis pour gérant)"),
    context: dict = Depends(get_store_context),
    competence_service: CompetenceService = Depends(get_competence_service),
    manager_service: ManagerService = Depends(get_manager_service),
):
    """Get aggregated statistics for a specific seller (CA, ventes, compétences)."""
    resolved_store_id = context.get("resolved_store_id")
    if not resolved_store_id:
        raise ValidationError("store_id requis")
    seller = await verify_seller_store_access(
        seller_id=seller_id,
        user_store_id=resolved_store_id,
        user_role=context.get("role"),
        user_id=context.get("id"),
        manager_service=manager_service,
    )
    end_dt = datetime.now(timezone.utc)
    start_dt = end_dt - timedelta(days=days)
    start_date = start_dt.strftime("%Y-%m-%d")
    end_date = end_dt.strftime("%Y-%m-%d")
    pipeline = [
        {"$match": {"seller_id": seller_id, "date": {"$gte": start_date, "$lte": end_date}}},
        {"$group": {
            "_id": None,
            "total_ca": {"$sum": {"$ifNull": ["$ca_journalier", {"$ifNull": ["$seller_ca", 0]}]}},
            "total_ventes": {"$sum": {"$ifNull": ["$nb_ventes", 0]}},
            "total_clients": {"$sum": {"$ifNull": ["$nb_clients", 0]}},
            "total_articles": {"$sum": {"$ifNull": ["$nb_articles", 0]}},
            "total_prospects": {"$sum": {"$ifNull": ["$nb_prospects", 0]}},
            "entries_count": {"$sum": 1},
        }},
    ]
    result = await manager_service.aggregate_kpi(pipeline, max_results=1)
    diagnostic = await manager_service.get_diagnostic_by_seller(seller_id)
    debriefs = await manager_service.get_debriefs_by_seller(seller_id, limit=5)
    avg_radar_scores = await competence_service.calculate_seller_performance_scores(
        seller_id=seller_id, diagnostic=diagnostic, debriefs=debriefs
    )
    if result:
        stats = result[0]
        total_ca = stats.get("total_ca", 0)
        total_ventes = stats.get("total_ventes", 0)
        total_clients = stats.get("total_clients", 0)
        total_articles = stats.get("total_articles", 0)
        return {
            "seller_id": seller_id,
            "seller_name": seller.get("name", "Unknown"),
            "period": {"start": start_date, "end": end_date, "days": days},
            "total_ca": total_ca,
            "total_ventes": total_ventes,
            "total_clients": total_clients,
            "total_articles": total_articles,
            "total_prospects": stats.get("total_prospects", 0),
            "entries_count": stats.get("entries_count", 0),
            "panier_moyen": round(total_ca / total_ventes, 2) if total_ventes > 0 else 0,
            "taux_transformation": round((total_ventes / total_clients * 100), 1) if total_clients > 0 else 0,
            "uvc": round(total_articles / total_ventes, 2) if total_ventes > 0 else 0,
            "avg_radar_scores": avg_radar_scores,
        }
    return {
        "seller_id": seller_id,
        "seller_name": seller.get("name", "Unknown"),
        "period": {"start": start_date, "end": end_date, "days": days},
        "total_ca": 0,
        "total_ventes": 0,
        "total_clients": 0,
        "total_articles": 0,
        "total_prospects": 0,
        "entries_count": 0,
        "panier_moyen": 0,
        "taux_transformation": 0,
        "uvc": 0,
        "avg_radar_scores": avg_radar_scores,
    }


@router.get("/seller/{seller_id}/kpi-history")
async def get_seller_kpi_history(
    seller_id: str,
    days: int = Query(90, description="Number of days"),
    store_id: Optional[str] = Query(None, description="Store ID (requis pour gérant)"),
    context: dict = Depends(get_store_context),
    manager_service: ManagerService = Depends(get_manager_service),
    kpi_service: ManagerKpiService = Depends(get_manager_kpi_service),
):
    """Get detailed KPI history for a seller with daily breakdown."""
    try:
        resolved_store_id = context.get("resolved_store_id")
        if not resolved_store_id:
            raise ValidationError("store_id requis")
        seller = await verify_seller_store_access(
            seller_id=seller_id,
            user_store_id=resolved_store_id,
            user_role=context.get("role"),
            user_id=context.get("id"),
            manager_service=manager_service,
        )
        end_dt = datetime.now(timezone.utc)
        start_dt = end_dt - timedelta(days=days)
        query_kpi = {
            "seller_id": seller_id,
            "date": {"$gte": start_dt.strftime("%Y-%m-%d"), "$lte": end_dt.strftime("%Y-%m-%d")},
        }
        entries = await kpi_service.get_kpi_entries_paginated(query_kpi, page=1, size=50)
        return {
            "seller_id": seller_id,
            "seller_name": seller.get("name", "Unknown"),
            "period": {"start": start_dt.strftime("%Y-%m-%d"), "end": end_dt.strftime("%Y-%m-%d"), "days": days},
            "entries": entries.items if isinstance(entries, PaginatedResponse) else entries,
            "pagination": (
                {
                    "total": entries.total,
                    "page": entries.page,
                    "size": entries.size,
                    "pages": entries.pages,
                }
                if isinstance(entries, PaginatedResponse)
                else None
            ),
            "entries_count": len(entries.items) if isinstance(entries, PaginatedResponse) else len(entries),
        }
    except AppException:
        raise


@router.get("/seller/{seller_id}/profile")
async def get_seller_profile(
    seller_id: str,
    store_id: Optional[str] = Query(None, description="Store ID (requis pour gérant)"),
    context: dict = Depends(get_store_context),
    manager_service: ManagerService = Depends(get_manager_service),
):
    """Get complete seller profile including diagnostic and recent performance."""
    try:
        resolved_store_id = context.get("resolved_store_id")
        if not resolved_store_id:
            raise ValidationError("store_id requis")
        seller = await verify_seller_store_access(
            seller_id=seller_id,
            user_store_id=resolved_store_id,
            user_role=context.get("role"),
            user_id=context.get("id"),
            manager_service=manager_service,
        )
        diagnostic = await manager_service.get_diagnostic_by_seller(seller_id)
        end_dt = datetime.now(timezone.utc)
        start_dt = end_dt - timedelta(days=7)
        recent_kpis_result = await manager_service.get_kpi_entries_paginated(
            {"seller_id": seller_id, "date": {"$gte": start_dt.strftime("%Y-%m-%d")}}, page=1, size=7
        )
        recent_kpis = recent_kpis_result.items
        return {**seller, "diagnostic": diagnostic, "recent_kpis": recent_kpis}
    except AppException:
        raise


# ===== KPI ENTRIES, DIAGNOSTIC, DEBRIEFS, COMPETENCES HISTORY =====

@router.get("/kpi-entries/{seller_id}", dependencies=[rate_limit("100/minute")])
async def get_seller_kpi_entries(
    request: Request,
    seller_id: str,
    days: int = Query(30, description="Number of days to fetch"),
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
    store_id: Optional[str] = Query(None, description="Store ID (requis pour gérant)"),
    pagination: PaginationParams = Depends(),
    context: dict = Depends(get_store_context),
    manager_service: ManagerService = Depends(get_manager_service),
):
    """Get paginated KPI entries for a specific seller. IDOR-safe: seller must belong to user's store."""
    resolved_store_id = context.get("resolved_store_id")
    if not resolved_store_id:
        raise ValidationError("store_id requis")
    seller = await verify_seller_store_access(
        seller_id=seller_id,
        user_store_id=resolved_store_id,
        user_role=context.get("role"),
        user_id=context.get("id"),
        manager_service=manager_service,
    )
    if not seller:
        raise NotFoundError("Vendeur non trouvé ou n'appartient pas à ce magasin")
    query = {"seller_id": seller_id}
    if start_date and end_date:
        query["date"] = {"$gte": start_date, "$lte": end_date}
    else:
        end_dt = datetime.now(timezone.utc)
        start_dt = end_dt - timedelta(days=days)
        query["date"] = {"$gte": start_dt.strftime("%Y-%m-%d"), "$lte": end_dt.strftime("%Y-%m-%d")}
    return await manager_service.get_kpi_entries_paginated(
        query, page=pagination.page, size=pagination.size
    )


@router.get("/seller/{seller_id}/diagnostic")
async def get_seller_diagnostic(
    seller_id: str,
    store_id: Optional[str] = Query(None, description="Store ID (requis pour gérant)"),
    context: dict = Depends(get_store_context),
    manager_service: ManagerService = Depends(get_manager_service),
):
    """Get DISC diagnostic profile for a specific seller. IDOR-safe."""
    resolved_store_id = context.get("resolved_store_id")
    if not resolved_store_id:
        raise ValidationError("store_id requis")
    seller = await verify_seller_store_access(
        seller_id=seller_id,
        user_store_id=resolved_store_id,
        user_role=context.get("role"),
        user_id=context.get("id"),
        manager_service=manager_service,
    )
    diagnostic = await manager_service.get_diagnostic_by_seller(seller_id)
    if not diagnostic:
        return {
            "seller_id": seller_id,
            "seller_name": seller.get("name", "Unknown"),
            "has_diagnostic": False,
            "style": "Non défini",
            "level": 0,
            "strengths": [],
            "weaknesses": [],
            "recommendations": [],
        }
    return {
        "seller_id": seller_id,
        "seller_name": seller.get("name", "Unknown"),
        "has_diagnostic": True,
        **diagnostic,
    }


@router.get("/debriefs/{seller_id}")
async def get_seller_debriefs(
    pagination: PaginationParams = Depends(),
    seller: dict = Depends(get_verified_seller),
    manager_service: ManagerService = Depends(get_manager_service),
):
    """
    Get paginated debriefs for a specific seller. Access via get_verified_seller (same store).
    Uses PaginationParams (page, size) to avoid loading massive lists into memory.
    """
    seller_id = seller.get("id")
    result = await manager_service.get_debriefs_by_seller_paginated(
        seller_id, page=pagination.page, size=pagination.size
    )
    return {
        "debriefs": result.items,
        "pagination": {
            "total": result.total,
            "page": result.page,
            "size": result.size,
            "pages": result.pages,
        },
    }


# Cap pour éviter de charger des milliers de debriefs en mémoire (préférer pagination côté client).
_COMPETENCES_HISTORY_DEBRIEFS_CAP = 200


@router.get("/competences-history/{seller_id}")
async def get_seller_competences_history(
    seller: dict = Depends(get_verified_seller),
    manager_service: ManagerService = Depends(get_manager_service),
):
    """
    Get seller's competences evolution history (diagnostic + debriefs). Access via get_verified_seller.

    ⚠️ Sécurité / scalabilité : les debriefs sont limités à _COMPETENCES_HISTORY_DEBRIEFS_CAP
    (200) pour éviter de charger des objets massifs en mémoire. Pour une liste complète paginée,
    utiliser GET /debriefs/{seller_id} avec PaginationParams.
    """
    seller_id = seller.get("id")
    history = []
    diagnostic = await manager_service.get_diagnostic_by_seller(seller_id)
    if diagnostic:
        history.append({
            "type": "diagnostic",
            "date": diagnostic.get("created_at"),
            "score_accueil": diagnostic.get("score_accueil", 3.0),
            "score_decouverte": diagnostic.get("score_decouverte", 3.0),
            "score_argumentation": diagnostic.get("score_argumentation", 3.0),
            "score_closing": diagnostic.get("score_closing", 3.0),
            "score_fidelisation": diagnostic.get("score_fidelisation", 3.0),
        })
    debriefs = await manager_service.get_debriefs_by_seller(
        seller_id, limit=_COMPETENCES_HISTORY_DEBRIEFS_CAP, skip=0
    )
    for debrief in debriefs:
        history.append({
            "type": "debrief",
            "date": debrief.get("created_at"),
            "score_accueil": debrief.get("score_accueil", 3.0),
            "score_decouverte": debrief.get("score_decouverte", 3.0),
            "score_argumentation": debrief.get("score_argumentation", 3.0),
            "score_closing": debrief.get("score_closing", 3.0),
            "score_fidelisation": debrief.get("score_fidelisation", 3.0),
        })
    return history
