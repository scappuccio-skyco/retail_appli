"""
Seller KPI Routes
Routes for KPI configuration, metrics, and entries management.
"""
from fastapi import APIRouter, Depends, Query
from typing import Dict, Optional
from datetime import datetime, timezone, timedelta

from services.seller_service import SellerService
from api.dependencies import get_seller_service
from core.security import get_current_seller
from core.exceptions import ValidationError, ForbiddenError, NotFoundError
from models.pagination import PaginationParams

router = APIRouter()


# ===== CALENDAR DATA =====

@router.get("/dates-with-data")
async def get_seller_dates_with_data(
    year: int = Query(None),
    month: int = Query(None),
    current_user: Dict = Depends(get_current_seller),
    seller_service: SellerService = Depends(get_seller_service),
):
    """
    Get list of dates that have KPI data for the seller
    Used for calendar highlighting

    Returns:
        - dates: list of dates with any KPI data
        - lockedDates: list of dates with locked/validated KPI entries (from API/POS)
    """
    seller_id = current_user['id']

    # Build date filter
    query = {"seller_id": seller_id}
    if year and month:
        start_date = f"{year}-{month:02d}-01"
        if month == 12:
            end_date = f"{year + 1}-01-01"
        else:
            end_date = f"{year}-{month + 1:02d}-01"
        query["date"] = {"$gte": start_date, "$lt": end_date}

    dates = await seller_service.get_kpi_distinct_dates(query)
    all_dates = sorted(set(dates))
    locked_query = {**query, "locked": True}
    locked_dates = await seller_service.get_kpi_distinct_dates(locked_query)

    return {
        "dates": all_dates,
        "lockedDates": sorted(locked_dates)
    }


# ===== KPI CONFIG FOR SELLER =====

@router.get("/kpi-config")
async def get_seller_kpi_config(
    store_id: Optional[str] = Query(None, description="Store ID (optionnel, utilise celui du vendeur si non fourni)"),
    current_user: Dict = Depends(get_current_seller),
    seller_service: SellerService = Depends(get_seller_service),
):
    """
    Get KPI configuration that applies to this seller for a specific store.
    Returns which KPIs the seller should track (based on store's config).

    CRITICAL: Uses store_id to ensure config is store-specific, not manager-specific.
    This allows sellers and managers to work across multiple stores.
    """
    user = await seller_service.get_seller_profile(current_user["id"])
    effective_store_id = store_id or (user.get('store_id') if user else None)

    if not effective_store_id:
        return {
            "track_ca": True,
            "track_ventes": True,
            "track_clients": True,
            "track_articles": True,
            "track_prospects": True
        }

    config = await seller_service.get_kpi_config_by_store(effective_store_id)
    if not config:
        return {
            "track_ca": True,
            "track_ventes": True,
            "track_clients": True,
            "track_articles": True,
            "track_prospects": True
        }

    return {
        "track_ca": config.get('seller_track_ca') if 'seller_track_ca' in config else config.get('track_ca', True),
        "track_ventes": config.get('seller_track_ventes') if 'seller_track_ventes' in config else config.get('track_ventes', True),
        "track_clients": config.get('seller_track_clients') if 'seller_track_clients' in config else config.get('track_clients', True),
        "track_articles": config.get('seller_track_articles') if 'seller_track_articles' in config else config.get('track_articles', True),
        "track_prospects": config.get('seller_track_prospects') if 'seller_track_prospects' in config else config.get('track_prospects', True)
    }


# ===== KPI ENTRIES FOR SELLER =====

@router.get("/kpi-metrics")
async def get_my_kpi_metrics(
    start_date: Optional[str] = Query(None, description="Start date YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="End date YYYY-MM-DD"),
    days: int = Query(30, description="Nombre de jours si start/end non fournis"),
    current_user: Dict = Depends(get_current_seller),
    seller_service: SellerService = Depends(get_seller_service),
):
    """
    Métriques KPI agrégées server-side pour le vendeur connecté.
    Source de vérité unique — même pipeline que /manager/seller/{id}/kpi-metrics.
    Retourne: ca, ventes, articles, prospects, panier_moyen, indice_vente, taux_transformation, nb_jours.
    """
    seller_id = current_user["id"]
    try:
        if start_date:
            datetime.strptime(start_date, "%Y-%m-%d")
        if end_date:
            datetime.strptime(end_date, "%Y-%m-%d")
    except ValueError:
        raise ValidationError("Format de date invalide. Utilisez YYYY-MM-DD")
    if not end_date:
        end_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    if not start_date:
        start_date = (datetime.now(timezone.utc) - timedelta(days=days - 1)).strftime("%Y-%m-%d")
    return await seller_service.get_seller_kpi_metrics(seller_id, start_date, end_date)


@router.get("/kpi-entries")
async def get_my_kpi_entries(
    days: int = Query(None, description="Number of days to fetch"),
    start_date: Optional[str] = Query(None, description="Start date YYYY-MM-DD (filtre période)"),
    end_date: Optional[str] = Query(None, description="End date YYYY-MM-DD (filtre période)"),
    pagination: PaginationParams = Depends(),
    current_user: Dict = Depends(get_current_seller),
    seller_service: SellerService = Depends(get_seller_service),
):
    """
    Get seller's KPI entries.
    Returns KPI data for the seller.
    Si start_date + end_date fournis, filtre par période (pour bilan semaine précise).
    """
    seller_id = current_user["id"]
    if start_date and end_date:
        return await seller_service.get_kpis_for_period_paginated(
            seller_id, start_date, end_date, page=pagination.page, size=pagination.size
        )
    size = days if days and days <= 365 else pagination.size
    result = await seller_service.get_kpi_entries_paginated(
        seller_id, pagination.page, min(size, 365)
    )
    return result


# ===== KPI ENTRY (Create/Update) =====

@router.post("/kpi-entry")
async def save_kpi_entry(
    kpi_data: dict,
    current_user: Dict = Depends(get_current_seller),
    seller_service: SellerService = Depends(get_seller_service),
):
    """
    Create or update a KPI entry for the seller.
    This is the main endpoint used by sellers to record their daily KPIs.
    """
    from uuid import uuid4
    seller_id = current_user['id']
    date = kpi_data.get('date', datetime.now(timezone.utc).strftime('%Y-%m-%d'))
    seller = await seller_service.get_seller_profile(seller_id)
    if not seller:
        raise NotFoundError("Seller not found")
    store_id = seller.get("store_id")
    if await seller_service.check_kpi_date_locked(store_id, date):
        raise ForbiddenError(
            "Cette date est verrouillée. Les données proviennent de l'API/ERP et ne peuvent pas être modifiées manuellement."
        )
    existing = await seller_service.get_kpi_entry_for_seller_date(seller_id, date)
    if existing and existing.get('locked'):
        raise ForbiddenError("Cette entrée est verrouillée (données API). Impossible de modifier.")
    entry_data = {
        "seller_id": seller_id,
        "seller_name": seller.get('name', current_user.get('name', 'Vendeur')),
        "manager_id": seller.get('manager_id'),
        "store_id": store_id,
        "date": date,
        "seller_ca": kpi_data.get('seller_ca') or kpi_data.get('ca_journalier') or 0,
        "ca_journalier": kpi_data.get('ca_journalier') or kpi_data.get('seller_ca') or 0,
        "nb_ventes": kpi_data.get('nb_ventes') or 0,
        "nb_clients": kpi_data.get('nb_clients') or 0,
        "nb_articles": kpi_data.get('nb_articles') or 0,
        "nb_prospects": kpi_data.get('nb_prospects') or 0,
        "source": "manual",
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    if existing:
        await seller_service.update_kpi_entry_by_id(existing.get("id"), entry_data)
        entry_data["id"] = existing.get("id")
    else:
        entry_data["id"] = str(uuid4())
        entry_data["created_at"] = datetime.now(timezone.utc).isoformat()
        await seller_service.create_kpi_entry(entry_data)
    if '_id' in entry_data:
        del entry_data['_id']
    return entry_data
