"""
KPI Routes
Seller and manager KPI management
"""
from fastapi import APIRouter, Depends, HTTPException
from typing import Dict

from models.kpis import KPIEntryCreate
from services.kpi_service import KPIService
from api.dependencies import get_kpi_service
from core.security import get_current_user, get_current_seller, get_current_manager

router = APIRouter(prefix="/kpi", tags=["KPI Management"])


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
        HTTPException 403: If KPI is locked (from API)
        HTTPException 400: Validation error
    """
    try:
        result = await kpi_service.create_or_update_seller_kpi(
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
        return result
    except Exception as e:
        if "logiciel de caisse" in str(e):
            raise HTTPException(status_code=403, detail=str(e))
        raise HTTPException(status_code=400, detail=str(e))


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
    try:
        entries = await kpi_service.kpi_repo.find_by_date_range(
            seller_id=current_user['id'],
            start_date=start_date,
            end_date=end_date
        )
        
        return entries
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


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
    try:
        summary = await kpi_service.get_seller_kpi_summary(
            seller_id=current_user['id'],
            start_date=start_date,
            end_date=end_date
        )
        return summary
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


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
    try:
        if not current_user.get('store_id'):
            raise HTTPException(status_code=400, detail="Manager has no assigned store")
        
        summary = await kpi_service.aggregate_store_kpis(
            store_id=current_user['store_id'],
            date=date
        )
        return summary
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ===== GERANT KPI ENDPOINTS =====

@router.get("/gerant/all-stores")
async def get_all_stores_kpis(
    date: str,
    current_user: Dict = Depends(get_current_user),
    kpi_service: KPIService = Depends(get_kpi_service)
):
    """
    Get KPI summary for all stores owned by gérant
    
    Args:
        date: Date (YYYY-MM-DD)
        current_user: Authenticated gérant
        kpi_service: KPI service instance
        
    Returns:
        List of store KPI summaries
    """
    try:
        # Get gérant's stores
        from repositories.store_repository import StoreRepository
        from core.database import get_db
        
        db = await get_db()
        store_repo = StoreRepository(db)
        
        stores = await store_repo.find_by_gerant(current_user['id'])
        
        # Aggregate KPIs for each store
        results = []
        for store in stores:
            summary = await kpi_service.aggregate_store_kpis(
                store_id=store['id'],
                date=date
            )
            results.append({
                "store": store,
                "kpis": summary
            })
        
        return results
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
