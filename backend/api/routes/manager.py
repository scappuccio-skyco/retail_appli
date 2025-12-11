"""
Manager Routes
Team management, KPIs, objectives, challenges for managers
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional
from datetime import datetime, timezone, timedelta

from core.security import get_current_user
from services.manager_service import ManagerService, APIKeyService
from api.dependencies import get_manager_service, get_api_key_service, get_db

router = APIRouter(prefix="/manager", tags=["Manager"])


async def verify_manager(current_user: dict = Depends(get_current_user)) -> dict:
    """Verify current user is a manager"""
    if current_user.get('role') != 'manager':
        raise HTTPException(status_code=403, detail="Access restricted to managers")
    return current_user


async def verify_manager_or_gerant(current_user: dict = Depends(get_current_user)) -> dict:
    """Verify current user is a manager or gérant"""
    if current_user.get('role') not in ['manager', 'gerant', 'gérant']:
        raise HTTPException(status_code=403, detail="Access restricted to managers and gérants")
    return current_user


# ===== SUBSCRIPTION ACCESS CHECK =====

@router.get("/subscription-status")
async def get_subscription_status(
    current_user: dict = Depends(verify_manager),
    db = Depends(get_db)
):
    """
    Check if the manager's gérant has an active subscription.
    Returns isReadOnly: true if trial expired.
    """
    try:
        gerant_id = current_user.get('gerant_id')
        
        if not gerant_id:
            return {"isReadOnly": True, "status": "no_gerant", "message": "Aucun gérant associé"}
        
        # Get gérant info
        gerant = await db.users.find_one({"id": gerant_id}, {"_id": 0})
        
        if not gerant:
            return {"isReadOnly": True, "status": "gerant_not_found", "message": "Gérant non trouvé"}
        
        workspace_id = gerant.get('workspace_id')
        
        if not workspace_id:
            return {"isReadOnly": True, "status": "no_workspace", "message": "Aucun espace de travail"}
        
        workspace = await db.workspaces.find_one({"id": workspace_id}, {"_id": 0})
        
        if not workspace:
            return {"isReadOnly": True, "status": "workspace_not_found", "message": "Espace de travail non trouvé"}
        
        subscription_status = workspace.get('subscription_status', 'inactive')
        
        # Active subscription
        if subscription_status == 'active':
            return {"isReadOnly": False, "status": "active", "message": "Abonnement actif"}
        
        # In trial period
        if subscription_status == 'trialing':
            trial_end = workspace.get('trial_end')
            if trial_end:
                if isinstance(trial_end, str):
                    trial_end_dt = datetime.fromisoformat(trial_end.replace('Z', '+00:00'))
                else:
                    trial_end_dt = trial_end
                
                # Gérer les dates naive vs aware
                now = datetime.now(timezone.utc)
                if trial_end_dt.tzinfo is None:
                    trial_end_dt = trial_end_dt.replace(tzinfo=timezone.utc)
                
                if now < trial_end_dt:
                    days_left = (trial_end_dt - now).days
                    return {"isReadOnly": False, "status": "trialing", "message": f"Essai gratuit - {days_left} jours restants", "daysLeft": days_left}
        
        # Trial expired or inactive
        return {"isReadOnly": True, "status": "trial_expired", "message": "Période d'essai terminée. Contactez votre administrateur."}
        
    except Exception as e:
        return {"isReadOnly": True, "status": "error", "message": str(e)}


# ===== STORE KPI OVERVIEW =====

@router.get("/store-kpi-overview")
async def get_store_kpi_overview(
    date: str = Query(None),
    current_user: dict = Depends(verify_manager),
    db = Depends(get_db)
):
    """
    Get KPI overview for manager's store on a specific date
    Returns aggregated KPIs for all sellers
    """
    store_id = current_user.get('store_id')
    if not store_id:
        raise HTTPException(status_code=400, detail="Manager not assigned to a store")
    
    # Use provided date or today
    target_date = date or datetime.now(timezone.utc).strftime('%Y-%m-%d')
    
    # Get all KPI entries for the store on this date
    kpi_entries = await db.kpi_entries.find({
        "store_id": store_id,
        "date": target_date
    }, {"_id": 0}).to_list(1000)
    
    # Also get manager KPIs
    manager_kpis = await db.manager_kpi.find({
        "store_id": store_id,
        "date": target_date
    }, {"_id": 0}).to_list(100)
    
    # Aggregate totals
    total_ca = sum(e.get('ca_journalier') or e.get('seller_ca') or 0 for e in kpi_entries)
    total_ca += sum(k.get('ca_journalier') or 0 for k in manager_kpis)
    
    total_ventes = sum(e.get('nb_ventes') or 0 for e in kpi_entries)
    total_ventes += sum(k.get('nb_ventes') or 0 for k in manager_kpis)
    
    total_clients = sum(e.get('nb_clients') or 0 for e in kpi_entries)
    total_clients += sum(k.get('nb_clients') or 0 for k in manager_kpis)
    
    total_articles = sum(e.get('nb_articles') or 0 for e in kpi_entries)
    total_articles += sum(k.get('nb_articles') or 0 for k in manager_kpis)
    
    total_prospects = sum(e.get('nb_prospects') or 0 for e in kpi_entries)
    total_prospects += sum(k.get('nb_prospects') or 0 for k in manager_kpis)
    
    # Count sellers who have submitted
    sellers_submitted = len(set(e.get('seller_id') for e in kpi_entries if e.get('seller_id')))
    
    # Calculate derived KPIs
    panier_moyen = total_ca / total_ventes if total_ventes > 0 else 0
    taux_transformation = (total_ventes / total_clients * 100) if total_clients > 0 else 0
    indice_vente = total_articles / total_ventes if total_ventes > 0 else 0
    
    return {
        "date": target_date,
        "store_id": store_id,
        "totals": {
            "ca_journalier": total_ca,
            "nb_ventes": total_ventes,
            "nb_clients": total_clients,
            "nb_articles": total_articles,
            "nb_prospects": total_prospects
        },
        "derived": {
            "panier_moyen": round(panier_moyen, 2),
            "taux_transformation": round(taux_transformation, 2),
            "indice_vente": round(indice_vente, 2)
        },
        "sellers_submitted": sellers_submitted,
        "entries_count": len(kpi_entries) + len(manager_kpis)
    }


@router.get("/dates-with-data")
async def get_dates_with_data(
    year: int = Query(None),
    month: int = Query(None),
    current_user: dict = Depends(verify_manager),
    db = Depends(get_db)
):
    """
    Get list of dates that have KPI data for the manager's store
    Used for calendar highlighting
    
    Returns:
        - dates: list of dates with any KPI data
        - lockedDates: list of dates with locked/validated KPI entries (from API/POS)
    """
    store_id = current_user.get('store_id')
    if not store_id:
        raise HTTPException(status_code=400, detail="Manager not assigned to a store")
    
    # Build date filter
    query = {"store_id": store_id}
    if year and month:
        # Filter by specific month
        start_date = f"{year}-{month:02d}-01"
        if month == 12:
            end_date = f"{year + 1}-01-01"
        else:
            end_date = f"{year}-{month + 1:02d}-01"
        query["date"] = {"$gte": start_date, "$lt": end_date}
    
    # Get distinct dates with data
    dates = await db.kpi_entries.distinct("date", query)
    manager_dates = await db.manager_kpi.distinct("date", query)
    
    all_dates = sorted(set(dates) | set(manager_dates))
    
    # Get locked dates (from API/POS imports - cannot be edited manually)
    locked_query = {**query, "locked": True}
    locked_dates = await db.kpi_entries.distinct("date", locked_query)
    
    return {
        "dates": all_dates,
        "lockedDates": sorted(locked_dates)
    }


@router.get("/available-years")
async def get_available_years(
    current_user: dict = Depends(verify_manager),
    db = Depends(get_db)
):
    """
    Get list of years that have KPI data for the manager's store
    Used for year filter dropdown
    """
    store_id = current_user.get('store_id')
    if not store_id:
        raise HTTPException(status_code=400, detail="Manager not assigned to a store")
    
    # Get distinct dates
    dates = await db.kpi_entries.distinct("date", {"store_id": store_id})
    manager_dates = await db.manager_kpi.distinct("date", {"store_id": store_id})
    
    all_dates = set(dates) | set(manager_dates)
    
    # Extract years
    years = set()
    for date_str in all_dates:
        if date_str and len(date_str) >= 4:
            try:
                years.add(int(date_str[:4]))
            except:
                pass
    
    return {"years": sorted(list(years), reverse=True)}


@router.get("/sellers")
async def get_sellers(
    current_user: dict = Depends(verify_manager),
    manager_service: ManagerService = Depends(get_manager_service)
):
    """
    Get all sellers for manager's store
    
    Returns list of sellers (active and suspended, excluding deleted)
    """
    try:
        store_id = current_user.get('store_id')
        if not store_id:
            raise HTTPException(status_code=400, detail="Manager not assigned to a store")
        
        sellers = await manager_service.get_sellers(
            manager_id=current_user['id'],
            store_id=store_id
        )
        return sellers
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/invitations")
async def get_invitations(
    current_user: dict = Depends(verify_manager),
    manager_service: ManagerService = Depends(get_manager_service)
):
    """Get pending invitations created by manager"""
    try:
        invitations = await manager_service.get_invitations(current_user['id'])
        return invitations
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/sync-mode")
async def get_sync_mode(
    current_user: dict = Depends(verify_manager),
    manager_service: ManagerService = Depends(get_manager_service)
):
    """Get sync mode configuration for manager's store"""
    try:
        store_id = current_user.get('store_id')
        if not store_id:
            raise HTTPException(status_code=400, detail="Manager not assigned to a store")
        
        config = await manager_service.get_sync_mode(store_id)
        return config
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/kpi-config")
async def get_kpi_config(
    current_user: dict = Depends(verify_manager),
    manager_service: ManagerService = Depends(get_manager_service)
):
    """Get KPI configuration for manager's store"""
    try:
        store_id = current_user.get('store_id')
        if not store_id:
            raise HTTPException(status_code=400, detail="Manager not assigned to a store")
        
        config = await manager_service.get_kpi_config(store_id)
        return config
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/team-bilans/all")
async def get_team_bilans_all(
    current_user: dict = Depends(verify_manager),
    manager_service: ManagerService = Depends(get_manager_service)
):
    """Get all team bilans for manager"""
    try:
        store_id = current_user.get('store_id')
        if not store_id:
            raise HTTPException(status_code=400, detail="Manager not assigned to a store")
        
        bilans = await manager_service.get_team_bilans_all(
            manager_id=current_user['id'],
            store_id=store_id
        )
        return bilans
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/store-kpi/stats")
async def get_store_kpi_stats(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    current_user: dict = Depends(verify_manager),
    manager_service: ManagerService = Depends(get_manager_service)
):
    """
    Get aggregated KPI statistics for manager's store
    
    Args:
        start_date: Start date (YYYY-MM-DD), defaults to first day of current month
        end_date: End date (YYYY-MM-DD), defaults to today
    """
    try:
        store_id = current_user.get('store_id')
        if not store_id:
            raise HTTPException(status_code=400, detail="Manager not assigned to a store")
        
        stats = await manager_service.get_store_kpi_stats(
            store_id=store_id,
            start_date=start_date,
            end_date=end_date
        )
        return stats
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/objectives/active")
async def get_active_objectives(
    current_user: dict = Depends(verify_manager),
    manager_service: ManagerService = Depends(get_manager_service)
):
    """Get active objectives for manager's team"""
    try:
        store_id = current_user.get('store_id')
        if not store_id:
            raise HTTPException(status_code=400, detail="Manager not assigned to a store")
        
        objectives = await manager_service.get_active_objectives(
            manager_id=current_user['id'],
            store_id=store_id
        )
        return objectives
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/challenges/active")
async def get_active_challenges(
    current_user: dict = Depends(verify_manager),
    manager_service: ManagerService = Depends(get_manager_service)
):
    """Get active challenges for manager's team"""
    try:
        store_id = current_user.get('store_id')
        if not store_id:
            raise HTTPException(status_code=400, detail="Manager not assigned to a store")
        
        challenges = await manager_service.get_active_challenges(
            manager_id=current_user['id'],
            store_id=store_id
        )
        return challenges
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



# ===== API KEYS MANAGEMENT =====
# NOTE: These routes are accessible by both Manager AND Gérant roles
# The frontend uses /api/manager/api-keys for both roles
# Uses verify_manager_or_gerant defined at the top of this file


@router.post("/api-keys")
async def create_api_key(
    key_data: dict,
    current_user: dict = Depends(verify_manager_or_gerant),
    api_key_service: APIKeyService = Depends(get_api_key_service)
):
    """
    Create a new API key for integrations
    
    Accessible by both Manager and Gérant roles
    Used for external integrations (N8N, Zapier, etc.)
    """
    try:
        gerant_id = current_user.get('id') if current_user['role'] in ['gerant', 'gérant'] else None
        
        result = await api_key_service.create_api_key(
            user_id=current_user['id'],
            store_id=current_user.get('store_id'),
            gerant_id=gerant_id,
            name=key_data.get('name', 'API Key'),
            permissions=key_data.get('permissions', ["write:kpi", "read:stats"]),
            store_ids=key_data.get('store_ids'),
            expires_days=key_data.get('expires_days')
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/api-keys")
async def list_api_keys(
    current_user: dict = Depends(verify_manager_or_gerant),
    api_key_service: APIKeyService = Depends(get_api_key_service)
):
    """
    List all API keys for current user
    
    Accessible by both Manager and Gérant roles
    Returns list of API keys (without the actual key value for security)
    """
    try:
        return await api_key_service.list_api_keys(current_user['id'])
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/api-keys/{key_id}")
async def delete_api_key(
    key_id: str,
    current_user: dict = Depends(verify_manager_or_gerant),
    api_key_service: APIKeyService = Depends(get_api_key_service)
):
    """
    Delete (deactivate) an API key
    
    Accessible by both Manager and Gérant roles
    Deactivates the key instead of deleting for audit trail
    """
    try:
        return await api_key_service.deactivate_api_key(key_id, current_user['id'])
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/api-keys/{key_id}/regenerate")
async def regenerate_api_key(
    key_id: str,
    current_user: dict = Depends(verify_manager_or_gerant),
    api_key_service: APIKeyService = Depends(get_api_key_service)
):
    """
    Regenerate an API key (creates new key, deactivates old)
    
    Accessible by both Manager and Gérant roles
    Useful when key is compromised or needs rotation
    """
    try:
        return await api_key_service.regenerate_api_key(key_id, current_user['id'])
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/api-keys/{key_id}/permanent")
async def delete_api_key_permanent(
    key_id: str,
    current_user: dict = Depends(verify_manager_or_gerant),
    api_key_service: APIKeyService = Depends(get_api_key_service)
):
    """
    Permanently delete an inactive API key
    
    Accessible by both Manager and Gérant roles
    Can only delete keys that have been deactivated first
    """
    try:
        return await api_key_service.delete_api_key_permanent(
            key_id, 
            current_user['id'],
            current_user['role']
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

