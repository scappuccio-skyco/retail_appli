"""
Gérant store routes: stores CRUD, store detail, KPI routes, bulk-import.
"""
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from datetime import datetime, timezone
from typing import Dict, List

from core.constants import ERR_ACCES_REFUSE_MAGASIN, MONGO_GROUP, MONGO_MATCH
from core.exceptions import AppException, NotFoundError, ValidationError, ForbiddenError
from core.security import get_current_gerant, get_gerant_or_manager
from services.gerant_service import GerantService
from services.manager import ManagerStoreService
from models.kpi_config import get_default_kpi_config
from api.dependencies import (
    get_gerant_service,
    get_manager_store_service,
    get_manager_service,
    get_manager_kpi_service,
    get_ai_service,
)
from api.routes.manager.analyses import run_store_kpi_analysis
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="", tags=["Gérant"])


@router.get("/stores")
async def get_all_stores(
    current_user: dict = Depends(get_current_gerant),
    gerant_service: GerantService = Depends(get_gerant_service)
):
    """
    Get all active stores for the current gérant

    Returns:
        List of stores with their details
    """
    stores = await gerant_service.get_all_stores(current_user['id'])
    return stores


@router.post("/stores")
async def create_store(
    store_data: Dict,
    current_user: dict = Depends(get_current_gerant),
    gerant_service: GerantService = Depends(get_gerant_service)
):
    """
    Create a new store for the current gérant

    Args:
        store_data: {
            "name": "Store Name",
            "location": "City, Postal Code",
            "address": "Full address",
            "phone": "Phone number",
            "opening_hours": "Opening hours"
        }
    """
    try:
        result = await gerant_service.create_store(store_data, current_user['id'])
    except ValueError as e:
        raise ValidationError(str(e))
    return result


@router.delete("/stores/{store_id}")
async def delete_store(
    store_id: str,
    current_user: dict = Depends(get_current_gerant),
    gerant_service: GerantService = Depends(get_gerant_service)
):
    """
    Delete (deactivate) a store

    Note: This soft-deletes the store by setting active=False
    """
    try:
        result = await gerant_service.delete_store(store_id, current_user['id'])
        return result
    except ValueError as e:
        raise NotFoundError(str(e))


@router.put("/stores/{store_id}")
async def update_store(
    store_id: str,
    store_data: Dict,
    current_user: dict = Depends(get_current_gerant),
    gerant_service: GerantService = Depends(get_gerant_service)
):
    """Update store information"""
    try:
        result = await gerant_service.update_store(store_id, store_data, current_user['id'])
    except ValueError as e:
        raise NotFoundError(str(e))
    return result


@router.get("/stores/{store_id}/stats")
async def get_store_stats(
    store_id: str,
    period_type: str = Query('week', regex='^(week|month|year)$'),
    period_offset: int = Query(0, ge=-52, le=52),
    current_user: dict = Depends(get_current_gerant),
    gerant_service: GerantService = Depends(get_gerant_service)
):
    """
    Get detailed statistics for a specific store

    Args:
        store_id: Store ID
        period_type: 'week', 'month', or 'year'
        period_offset: Number of periods to offset (0=current, -1=previous, +1=next)

    Returns:
        Dict with store stats, period KPIs, evolution, team counts
    """
    try:
        stats = await gerant_service.get_store_stats(
            store_id=store_id,
            gerant_id=current_user['id'],
            period_type=period_type,
            period_offset=period_offset
        )
        return stats
    except ValueError as e:
        raise NotFoundError(str(e))


# ===== STORE DETAIL ROUTES (CRITICAL FOR FRONTEND) =====

@router.get("/stores/{store_id}/managers")
async def get_store_managers(
    store_id: str,
    current_user: Dict = Depends(get_current_gerant),
    gerant_service: GerantService = Depends(get_gerant_service)
):
    """Get all managers for a specific store"""
    return await gerant_service.get_store_managers(store_id, current_user['id'])


@router.get("/stores/{store_id}/sellers")
async def get_store_sellers(
    store_id: str,
    current_user: Dict = Depends(get_current_gerant),
    gerant_service: GerantService = Depends(get_gerant_service)
):
    """Get all sellers for a specific store"""
    return await gerant_service.get_store_sellers(store_id, current_user['id'])


@router.get("/stores/{store_id}/kpi-overview")
async def get_store_kpi_overview(
    store_id: str,
    date: str = None,
    current_user: Dict = Depends(get_current_gerant),
    gerant_service: GerantService = Depends(get_gerant_service)
):
    """Vue consolidée du magasin pour le gérant (chiffres de tous les managers/vendeurs). Réservé aux gérants."""
    return await gerant_service.get_store_overview_for_gerant(store_id, current_user["id"], date)


@router.get("/stores/{store_id}/kpi-history")
async def get_store_kpi_history(
    store_id: str,
    days: int = 30,
    start_date: str = None,
    end_date: str = None,
    current_user: Dict = Depends(get_gerant_or_manager),
    gerant_service: GerantService = Depends(get_gerant_service)
):
    """
    Get historical KPI data for a specific store

    Args:
        store_id: Store identifier
        days: Number of days to retrieve (default: 30) - used if no dates provided
        start_date: Start date in YYYY-MM-DD format (optional)
        end_date: End date in YYYY-MM-DD format (optional)

    Returns:
        List of daily aggregated KPI data sorted by date

    Security: Accessible to gérants and managers
    """
    try:
        user_id = current_user["id"]
        return await gerant_service.get_store_kpi_history(
            store_id, user_id, days, start_date, end_date
        )
    except ValueError as e:
        raise NotFoundError(str(e))
    except Exception as e:
        logger.exception("get_store_kpi_history unexpected error: %s", e)
        return []


@router.get("/stores/{store_id}/available-years")
async def get_store_available_years(
    store_id: str,
    current_user: Dict = Depends(get_gerant_or_manager),
    gerant_service: GerantService = Depends(get_gerant_service)
):
    """
    Get available years with KPI data for this store

    Returns list of years (integers) in descending order (most recent first)
    Used for date filter dropdowns in the frontend

    Security: Accessible to gérants and managers
    """
    try:
        user_id = current_user["id"]
        return await gerant_service.get_store_available_years(store_id, user_id)
    except ValueError as e:
        raise NotFoundError(str(e))
    except Exception as e:
        logger.exception("get_store_available_years unexpected error: %s", e)
        return {"years": []}


@router.get("/stores/{store_id}/kpi-dates")
async def get_store_kpi_dates(
    store_id: str,
    current_user: Dict = Depends(get_gerant_or_manager),
    gerant_service: GerantService = Depends(get_gerant_service),
):
    """
    Get dates with KPI data for this store

    Returns list of dates (YYYY-MM-DD strings) where KPI data exists
    Used for calendar highlighting in the frontend
    """
    try:
        # Get all distinct dates with KPI data for this store
        pipeline = [
            {MONGO_MATCH: {"store_id": store_id}},
            {MONGO_GROUP: {"_id": "$date"}},
            {"$sort": {"_id": -1}},
            {"$limit": 365}  # Last year of dates
        ]

        results = await gerant_service.aggregate_kpi(pipeline, max_results=365)
        dates = [r['_id'] for r in results if r['_id']]

        return {"dates": dates}
    except ValueError as e:
        raise NotFoundError(str(e))


@router.get("/stores/{store_id}/kpi-config")
async def get_store_kpi_config_gerant(
    store_id: str,
    current_user: Dict = Depends(get_current_gerant),
    gerant_service: GerantService = Depends(get_gerant_service),
    store_service: ManagerStoreService = Depends(get_manager_store_service),
):
    """
    Récupère la configuration KPI du magasin pour un gérant (magasin dont il est propriétaire).
    Évite le 403 quand StoreKPIModal est ouvert depuis le dashboard gérant.
    """
    stores = await gerant_service.get_all_stores(current_user["id"])
    if not any(s.get("id") == store_id for s in stores):
        raise ForbiddenError(ERR_ACCES_REFUSE_MAGASIN)
    try:
        config = await store_service.get_kpi_config(store_id)
        return config if config else get_default_kpi_config(store_id)
    except Exception as e:
        logger.warning("get_store_kpi_config_gerant: %s", e)
        return get_default_kpi_config(store_id)


@router.put("/stores/{store_id}/kpi-config")
async def update_store_kpi_config_gerant(
    store_id: str,
    config_update: Dict,
    current_user: Dict = Depends(get_current_gerant),
    gerant_service: GerantService = Depends(get_gerant_service),
    store_service: ManagerStoreService = Depends(get_manager_store_service),
):
    """
    Met à jour la configuration KPI du magasin (gérant propriétaire).
    """
    stores = await gerant_service.get_all_stores(current_user["id"])
    if not any(s.get("id") == store_id for s in stores):
        raise ForbiddenError(ERR_ACCES_REFUSE_MAGASIN)
    update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
    for field in [
        "enabled", "saisie_enabled",
        "seller_track_ca", "manager_track_ca", "seller_track_ventes", "manager_track_ventes",
        "seller_track_clients", "manager_track_clients", "seller_track_articles", "manager_track_articles",
        "seller_track_prospects", "manager_track_prospects",
    ]:
        if field in config_update:
            update_data[field] = config_update[field]
    config = await store_service.upsert_kpi_config(store_id, current_user["id"], update_data)
    return config


@router.post("/stores/{store_id}/analyze-store-kpis")
async def analyze_store_kpis_gerant(
    store_id: str,
    analysis_data: dict,
    current_user: Dict = Depends(get_current_gerant),
    gerant_service: GerantService = Depends(get_gerant_service),
    manager_service=Depends(get_manager_service),
    kpi_service=Depends(get_manager_kpi_service),
    ai_service=Depends(get_ai_service),
):
    """
    Génère une analyse IA des KPIs du magasin (gérant propriétaire).
    Évite le 403 quand le modal d'analyse IA est ouvert depuis le dashboard gérant.
    """
    stores = await gerant_service.get_all_stores(current_user["id"])
    if not any(s.get("id") == store_id for s in stores):
        raise ForbiddenError(ERR_ACCES_REFUSE_MAGASIN)
    return await run_store_kpi_analysis(
        store_id, analysis_data, manager_service, kpi_service, ai_service
    )


# ===== BULK IMPORT STORES =====

class BulkStoreImportRequest(BaseModel):
    """Request body pour l'import massif de magasins"""
    stores: List[Dict]  # Liste de {name, location, address, phone, external_id}
    mode: str = "create_or_update"  # "create_only" | "update_only" | "create_or_update"

class BulkImportResponse(BaseModel):
    """Response de l'import massif"""
    success: bool
    total_processed: int
    created: int
    updated: int
    failed: int
    errors: List[Dict] = []


@router.post("/stores/import-bulk", response_model=BulkImportResponse)
async def bulk_import_stores(
    request: BulkStoreImportRequest,
    current_user: dict = Depends(get_current_gerant),
    gerant_service: GerantService = Depends(get_gerant_service)
):
    """
    Import massif de magasins pour un Gérant.

    Cette fonctionnalité était auparavant réservée à l'espace Enterprise.
    Elle permet d'importer plusieurs magasins en une seule opération.

    Sécurité:
    - Réservé aux Gérants avec abonnement actif
    - Option future: limiter aux comptes avec flag 'can_bulk_import'

    Modes disponibles:
    - create_only: Ne crée que les nouveaux magasins
    - update_only: Ne met à jour que les magasins existants
    - create_or_update: Crée ou met à jour selon l'existence

    Exemple de payload:
    ```json
    {
        "stores": [
            {"name": "Magasin Paris", "location": "Paris", "address": "123 rue..."},
            {"name": "Magasin Lyon", "location": "Lyon"}
        ],
        "mode": "create_or_update"
    }
    ```
    """
    try:
        # Vérifier que le gérant a un workspace
        workspace_id = current_user.get('workspace_id')
        if not workspace_id:
            raise ValidationError("Aucun espace de travail associé. Créez d'abord un magasin manuellement.")

        # Validation du mode
        if request.mode not in ["create_only", "update_only", "create_or_update"]:
            raise ValidationError("Mode invalide. Utilisez: create_only, update_only, ou create_or_update")

        # Validation des données
        if not request.stores:
            raise ValidationError("La liste des magasins est vide")

        if len(request.stores) > 500:
            raise ValidationError("Maximum 500 magasins par import. Divisez votre fichier.")

        # Exécuter l'import
        results = await gerant_service.bulk_import_stores(
            gerant_id=current_user['id'],
            workspace_id=workspace_id,
            stores=request.stores,
            mode=request.mode
        )

        logger.info(f"Import massif par {current_user['email']}: {results['created']} créés, {results['updated']} mis à jour, {results['failed']} échecs")

        return BulkImportResponse(
            success=results['failed'] == 0,
            total_processed=results['total_processed'],
            created=results['created'],
            updated=results['updated'],
            failed=results['failed'],
            errors=results['errors'][:20]  # Limiter les erreurs retournées
        )
    except AppException:
        raise
    except Exception as e:
        raise AppException(detail=str(e), status_code=500)
