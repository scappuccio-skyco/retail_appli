"""
KPI Routes
Seller and manager KPI management
"""
from fastapi import APIRouter, Depends
from typing import Dict

from core.exceptions import ValidationError
from models.kpis import KPIEntryCreate
from services.kpi_service import KPIService
from api.dependencies import get_kpi_service
from core.security import get_current_user, get_current_seller, get_current_manager, require_active_space

router = APIRouter(
    prefix="/kpi",
    tags=["KPI Management"],
    dependencies=[Depends(require_active_space)]
)


# ===== SELLER UTILS =====

@router.get("/seller/kpi-enabled")
async def check_kpi_enabled(
    current_user: Dict = Depends(get_current_seller),
    kpi_service: KPIService = Depends(get_kpi_service)
):
    """
    Check if KPI entry is enabled for current seller
    
    Checks store configuration to see if manual KPI entry is allowed
    Returns whether seller can submit KPIs manually
    """
    store_id = current_user.get('store_id')
    if not store_id:
        return {"enabled": True, "sync_mode": "manual"}
    return await kpi_service.check_kpi_entry_enabled(store_id)


# ===== SELLER KPI ENDPOINTS =====

@router.post("/seller/entry")
async def create_seller_kpi(
    kpi_data: KPIEntryCreate,
    current_user: Dict = Depends(get_current_seller),
    kpi_service: KPIService = Depends(get_kpi_service)
):
    """
    Create or update KPI entry for current seller
    
    Args:
        kpi_data: KPI entry data
        current_user: Authenticated seller
        kpi_service: KPI service instance
        
    Returns:
        Created/updated KPI entry
        
    Raises:
        ForbiddenError: If KPI is locked (from API)
        ValidationError: Validation error
    """
    return await kpi_service.create_or_update_seller_kpi(
        seller_id=current_user['id'],
        date=kpi_data.date,
        kpi_data={
            'ca_journalier': kpi_data.ca_journalier,
            'nb_ventes': kpi_data.nb_ventes,
            'nb_articles': kpi_data.nb_articles,
            'nb_prospects': kpi_data.nb_prospects,
            'comment': kpi_data.comment
        }
    )


@router.get("/seller/entries")
async def get_seller_kpis(
    start_date: str,
    end_date: str,
    current_user: Dict = Depends(get_current_seller),
    kpi_service: KPIService = Depends(get_kpi_service)
):
    """
    Get KPI entries for current seller within date range
    
    Args:
        start_date: Start date (YYYY-MM-DD)
        end_date: End date (YYYY-MM-DD)
        current_user: Authenticated seller
        kpi_service: KPI service instance
        
    Returns:
        List of KPI entries
    """
    return await kpi_service.get_kpis_by_date_range(
        current_user['id'],
        start_date,
        end_date,
    )


@router.get("/seller/summary")
async def get_seller_kpi_summary(
    start_date: str,
    end_date: str,
    current_user: Dict = Depends(get_current_seller),
    kpi_service: KPIService = Depends(get_kpi_service)
):
    """
    Get aggregated KPI summary for current seller
    
    Args:
        start_date: Start date (YYYY-MM-DD)
        end_date: End date (YYYY-MM-DD)
        current_user: Authenticated seller
        kpi_service: KPI service instance
        
    Returns:
        Aggregated KPI summary
    """
    return await kpi_service.get_seller_kpi_summary(
        seller_id=current_user['id'],
        start_date=start_date,
        end_date=end_date
    )


# ===== MANAGER KPI ENDPOINTS =====

@router.get("/manager/store-summary")
async def get_store_kpi_summary(
    date: str,
    current_user: Dict = Depends(get_current_manager),
    kpi_service: KPIService = Depends(get_kpi_service)
):
    """
    Get aggregated KPI summary for manager's store
    
    Args:
        date: Date (YYYY-MM-DD)
        current_user: Authenticated manager
        kpi_service: KPI service instance
        
    Returns:
        Store KPI summary
    """
    if not current_user.get('store_id'):
        raise ValidationError("Manager has no assigned store")
    
    summary = await kpi_service.aggregate_store_kpis(
        store_id=current_user['store_id'],
        date=date
    )
    return summary


# ===== GERANT KPI ENDPOINTS =====

@router.get("/gerant/all-stores")
async def get_all_stores_kpis(
    date: str,
    current_user: Dict = Depends(get_current_user),
    kpi_service: KPIService = Depends(get_kpi_service)
):
    """
    Get KPI summary for all stores owned by gérant.
    Route calls service method only (no repository instantiation).
    """
    return await kpi_service.get_stores_kpi_summary_for_gerant(
        gerant_id=current_user["id"],
        date=date,
    )
