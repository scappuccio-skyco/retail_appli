"""
Gérant-specific Routes
Dashboard stats, subscription status, and workspace management
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from datetime import datetime, timezone
from typing import Dict
from motor.motor_asyncio import AsyncIOMotorDatabase

from core.security import get_current_gerant
from services.gerant_service import GerantService
from api.dependencies import get_gerant_service, get_db

router = APIRouter(prefix="/gerant", tags=["Gérant"])


@router.get("/dashboard/stats")
async def get_dashboard_stats(
    current_user: dict = Depends(get_current_gerant),
    gerant_service: GerantService = Depends(get_gerant_service)
):
    """
    Get global statistics for gérant dashboard (all stores aggregated)
    
    Returns:
        Dict with total stores, managers, sellers, and monthly KPI aggregations
    """
    try:
        stats = await gerant_service.get_dashboard_stats(current_user['id'])
        return stats
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/subscription/status")
async def get_subscription_status(
    current_user: dict = Depends(get_current_gerant),
    gerant_service: GerantService = Depends(get_gerant_service)
):
    """
    Get subscription status for the current gérant
    
    Checks:
    1. Workspace trial status (priority)
    2. Stripe subscription status
    3. Local database subscription fallback
    
    Returns:
        Dict with subscription details, plan, seats, trial info
    """
    try:
        status = await gerant_service.get_subscription_status(current_user['id'])
        return status
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


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
    try:
        stores = await gerant_service.get_all_stores(current_user['id'])
        return stores
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/managers")
async def get_all_managers(
    current_user: dict = Depends(get_current_gerant),
    gerant_service: GerantService = Depends(get_gerant_service)
):
    """
    Get all managers (active and suspended, excluding deleted)
    
    Returns:
        List of managers with their details (password excluded)
    """
    try:
        managers = await gerant_service.get_all_managers(current_user['id'])
        return managers
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/sellers")
async def get_all_sellers(
    current_user: dict = Depends(get_current_gerant),
    gerant_service: GerantService = Depends(get_gerant_service)
):
    """
    Get all sellers (active and suspended, excluding deleted)
    
    Returns:
        List of sellers with their details (password excluded)
    """
    try:
        sellers = await gerant_service.get_all_sellers(current_user['id'])
        return sellers
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


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
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



# ===== STORE DETAIL ROUTES (CRITICAL FOR FRONTEND) =====

@router.get("/stores/{store_id}/managers")
async def get_store_managers(
    store_id: str,
    current_user: Dict = Depends(get_current_gerant),
    gerant_service: GerantService = Depends(get_gerant_service)
):
    """Get all managers for a specific store"""
    try:
        return await gerant_service.get_store_managers(store_id, current_user['id'])
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))




@router.get("/stores/{store_id}/sellers")
async def get_store_sellers(
    store_id: str,
    current_user: Dict = Depends(get_current_gerant),
    gerant_service: GerantService = Depends(get_gerant_service)
):
    """Get all sellers for a specific store"""
    try:
        return await gerant_service.get_store_sellers(store_id, current_user['id'])
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/stores/{store_id}/kpi-overview")
async def get_store_kpi_overview(
    store_id: str,
    date: str = None,
    current_user: Dict = Depends(get_current_gerant),
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """
    Get consolidated store KPI overview for a specific date
    
    Returns:
    - Store info
    - Manager aggregated data
    - Seller aggregated data
    - Individual seller entries
    - Calculated KPIs (panier moyen, taux transformation, indice vente)
    
    Security: Verify that the store belongs to the current gérant
    """
    from datetime import datetime, timezone
    
    # Verify store ownership
    store = await db.stores.find_one(
        {"id": store_id, "gerant_id": current_user['id'], "active": True},
        {"_id": 0}
    )
    if not store:
        raise HTTPException(status_code=404, detail="Magasin non trouvé ou accès non autorisé")
    
    # Default to today
    if not date:
        date = datetime.now(timezone.utc).strftime('%Y-%m-%d')
    
    # Get all managers and sellers in this store
    managers = await db.users.find({
        "store_id": store_id,
        "role": "manager",
        "status": "active"
    }, {"_id": 0, "id": 1, "name": 1}).to_list(100)
    
    sellers = await db.users.find({
        "store_id": store_id,
        "role": "seller",
        "status": "active"
    }, {"_id": 0, "id": 1, "name": 1}).to_list(100)
    
    # Get ALL KPI entries for this store directly by store_id
    seller_entries = await db.kpi_entries.find({
        "store_id": store_id,
        "date": date
    }, {"_id": 0}).to_list(100)
    
    # Enrich seller entries with names
    for entry in seller_entries:
        seller = next((s for s in sellers if s['id'] == entry.get('seller_id')), None)
        if seller:
            entry['seller_name'] = seller['name']
        else:
            entry['seller_name'] = entry.get('seller_name', 'Vendeur (historique)')
    
    # Get manager KPIs for this store
    manager_kpis_list = await db.manager_kpi.find({
        "store_id": store_id,
        "date": date
    }, {"_id": 0}).to_list(100)
    
    # Aggregate totals from managers
    managers_total = {
        "ca_journalier": sum((kpi.get("ca_journalier") or 0) for kpi in manager_kpis_list),
        "nb_ventes": sum((kpi.get("nb_ventes") or 0) for kpi in manager_kpis_list),
        "nb_clients": sum((kpi.get("nb_clients") or 0) for kpi in manager_kpis_list),
        "nb_articles": sum((kpi.get("nb_articles") or 0) for kpi in manager_kpis_list),
        "nb_prospects": sum((kpi.get("nb_prospects") or 0) for kpi in manager_kpis_list)
    }
    
    # Aggregate totals from sellers
    sellers_total = {
        "ca_journalier": sum((entry.get("seller_ca") or entry.get("ca_journalier") or 0) for entry in seller_entries),
        "nb_ventes": sum((entry.get("nb_ventes") or 0) for entry in seller_entries),
        "nb_clients": sum((entry.get("nb_clients") or 0) for entry in seller_entries),
        "nb_articles": sum((entry.get("nb_articles") or 0) for entry in seller_entries),
        "nb_prospects": sum((entry.get("nb_prospects") or 0) for entry in seller_entries),
        "nb_sellers_reported": len(seller_entries)
    }
    
    # Calculate store totals
    total_ca = managers_total["ca_journalier"] + sellers_total["ca_journalier"]
    total_ventes = managers_total["nb_ventes"] + sellers_total["nb_ventes"]
    total_clients = managers_total["nb_clients"] + sellers_total["nb_clients"]
    total_articles = managers_total["nb_articles"] + sellers_total["nb_articles"]
    total_prospects = managers_total["nb_prospects"] + sellers_total["nb_prospects"]
    
    # Calculate derived KPIs
    calculated_kpis = {
        "panier_moyen": round(total_ca / total_ventes, 2) if total_ventes > 0 else None,
        "taux_transformation": round((total_ventes / total_prospects) * 100, 2) if total_prospects > 0 else None,
        "indice_vente": round(total_articles / total_ventes, 2) if total_ventes > 0 else None
    }
    
    return {
        "date": date,
        "store": store,
        "managers_data": managers_total,
        "sellers_data": sellers_total,
        "seller_entries": seller_entries,
        "total_managers": len(managers),
        "total_sellers": len(sellers),
        "sellers_reported": len(seller_entries),
        "calculated_kpis": calculated_kpis,
        "totals": {
            "ca": total_ca,
            "ventes": total_ventes,
            "clients": total_clients,
            "articles": total_articles,
            "prospects": total_prospects
        },
        "kpi_config": {
            "seller_track_ca": True,
            "seller_track_ventes": True,
            "seller_track_clients": True,
            "seller_track_articles": True,
            "seller_track_prospects": True
        }
    }


@router.get("/stores/{store_id}/kpi-history")
async def get_store_kpi_history(
    store_id: str,
    days: int = 30,
    current_user: Dict = Depends(get_current_gerant),
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """
    Get historical KPI data for a specific store
    
    Args:
        store_id: Store identifier
        days: Number of days to retrieve (default: 30)
    
    Returns:
        List of daily aggregated KPI data sorted by date
    
    Security: Verify that the store belongs to the current gérant
    """
    from datetime import datetime, timezone, timedelta
    
    # Verify store ownership
    store = await db.stores.find_one(
        {"id": store_id, "gerant_id": current_user['id'], "active": True},
        {"_id": 0}
    )
    if not store:
        raise HTTPException(status_code=404, detail="Magasin non trouvé ou accès non autorisé")
    
    # Calculate date range
    end_date = datetime.now(timezone.utc)
    start_date = end_date - timedelta(days=days)
    
    # Get ALL KPI entries for this store directly by store_id
    seller_entries = await db.kpi_entries.find({
        "store_id": store_id,
        "date": {"$gte": start_date.strftime('%Y-%m-%d'), "$lte": end_date.strftime('%Y-%m-%d')}
    }, {"_id": 0}).to_list(10000)
    
    # Get manager KPIs for this store
    manager_kpis = await db.manager_kpi.find({
        "store_id": store_id,
        "date": {"$gte": start_date.strftime('%Y-%m-%d'), "$lte": end_date.strftime('%Y-%m-%d')}
    }, {"_id": 0}).to_list(10000)
    
    # Aggregate data by date
    date_map = {}
    
    # Add manager KPIs
    for kpi in manager_kpis:
        date = kpi['date']
        if date not in date_map:
            date_map[date] = {
                "date": date,
                "ca_journalier": 0,
                "nb_ventes": 0,
                "nb_clients": 0,
                "nb_articles": 0,
                "nb_prospects": 0
            }
        date_map[date]["ca_journalier"] += kpi.get("ca_journalier") or 0
        date_map[date]["nb_ventes"] += kpi.get("nb_ventes") or 0
        date_map[date]["nb_clients"] += kpi.get("nb_clients") or 0
        date_map[date]["nb_articles"] += kpi.get("nb_articles") or 0
        date_map[date]["nb_prospects"] += kpi.get("nb_prospects") or 0
    
    # Add seller entries
    for entry in seller_entries:
        date = entry['date']
        if date not in date_map:
            date_map[date] = {
                "date": date,
                "ca_journalier": 0,
                "nb_ventes": 0,
                "nb_clients": 0,
                "nb_articles": 0,
                "nb_prospects": 0
            }
        # Handle both field names for CA
        ca_value = entry.get("seller_ca") or entry.get("ca_journalier") or 0
        date_map[date]["ca_journalier"] += ca_value
        date_map[date]["nb_ventes"] += entry.get("nb_ventes") or 0
        date_map[date]["nb_clients"] += entry.get("nb_clients") or 0
        date_map[date]["nb_articles"] += entry.get("nb_articles") or 0
        date_map[date]["nb_prospects"] += entry.get("nb_prospects") or 0
    
    # Convert to sorted list
    historical_data = sorted(date_map.values(), key=lambda x: x['date'])
    
    return historical_data


@router.get("/stores/{store_id}/available-years")
async def get_store_available_years(
    store_id: str,
    current_user: Dict = Depends(get_current_gerant),
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """
    Get available years with KPI data for this store
    
    Returns list of years (integers) in descending order (most recent first)
    Used for date filter dropdowns in the frontend
    
    Security: Verify that the store belongs to the current gérant
    """
    # Verify store ownership
    store = await db.stores.find_one(
        {"id": store_id, "gerant_id": current_user['id'], "active": True},
        {"_id": 0}
    )
    if not store:
        raise HTTPException(status_code=404, detail="Magasin non trouvé ou accès non autorisé")
    
    # Get distinct years from kpi_entries
    kpi_years = await db.kpi_entries.distinct("date", {"store_id": store_id})
    years_set = set()
    for date_str in kpi_years:
        if date_str and len(date_str) >= 4:
            year = int(date_str[:4])
            years_set.add(year)
    
    # Get distinct years from manager_kpi
    manager_years = await db.manager_kpi.distinct("date", {"store_id": store_id})
    for date_str in manager_years:
        if date_str and len(date_str) >= 4:
            year = int(date_str[:4])
            years_set.add(year)
    
    # Sort descending (most recent first)
    years = sorted(list(years_set), reverse=True)
    
    return {"years": years}




# ===== SELLER MANAGEMENT ROUTES =====

@router.post("/sellers/{seller_id}/transfer")
async def transfer_seller_to_store(
    seller_id: str,
    transfer_data: Dict,
    current_user: Dict = Depends(get_current_gerant),
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """
    Transfer a seller to another store with a new manager
    
    Args:
        seller_id: Seller user ID
        transfer_data: {
            "new_store_id": "store_uuid",
            "new_manager_id": "manager_uuid"
        }
    
    Security:
        - Verifies seller belongs to current gérant
        - Verifies new store belongs to current gérant
        - Verifies new store is active
        - Verifies new manager exists in new store
    
    Auto-reactivation:
        - If seller was suspended due to inactive store, automatically reactivates
    """
    from datetime import datetime, timezone
    from models.sellers import SellerTransfer
    
    # Validate input
    try:
        transfer = SellerTransfer(**transfer_data)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid transfer data: {str(e)}")
    
    # Verify seller exists and belongs to current gérant
    seller = await db.users.find_one({
        "id": seller_id,
        "gerant_id": current_user['id'],
        "role": "seller"
    }, {"_id": 0})
    
    if not seller:
        raise HTTPException(status_code=404, detail="Vendeur non trouvé ou accès non autorisé")
    
    # Verify new store exists, is active, and belongs to current gérant
    new_store = await db.stores.find_one({
        "id": transfer.new_store_id,
        "gerant_id": current_user['id']
    }, {"_id": 0})
    
    if not new_store:
        raise HTTPException(status_code=404, detail="Nouveau magasin non trouvé ou accès non autorisé")
    
    if not new_store.get('active', False):
        raise HTTPException(
            status_code=400,
            detail=f"Le magasin '{new_store['name']}' est inactif. Impossible de transférer vers un magasin inactif."
        )
    
    # Verify new manager exists and is in the new store
    new_manager = await db.users.find_one({
        "id": transfer.new_manager_id,
        "store_id": transfer.new_store_id,
        "role": "manager",
        "status": "active"
    }, {"_id": 0})
    
    if not new_manager:
        raise HTTPException(
            status_code=404,
            detail="Manager non trouvé dans ce magasin ou manager inactif"
        )
    
    # Prepare update fields
    update_fields = {
        "store_id": transfer.new_store_id,
        "manager_id": transfer.new_manager_id,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    unset_fields = {}
    
    # Auto-reactivation if seller was suspended due to inactive store
    if seller.get('status') == 'suspended' and seller.get('suspended_reason', '').startswith('Magasin'):
        update_fields["status"] = "active"
        update_fields["reactivated_at"] = datetime.now(timezone.utc).isoformat()
        unset_fields = {
            "suspended_at": "",
            "suspended_by": "",
            "suspended_reason": ""
        }
    
    # Execute transfer
    update_operation = {"$set": update_fields}
    if unset_fields:
        update_operation["$unset"] = unset_fields
    
    await db.users.update_one(
        {"id": seller_id},
        update_operation
    )
    
    # Build response message
    message = f"Vendeur transféré avec succès vers {new_store['name']}"
    if update_fields.get("status") == "active":
        message += " et réactivé automatiquement"
    
    return {
        "success": True,
        "message": message,
        "new_store": new_store['name'],
        "new_manager": new_manager['name'],
        "reactivated": update_fields.get("status") == "active"
    }

