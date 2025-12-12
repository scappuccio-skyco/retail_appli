"""
Manager Routes
Team management, KPIs, objectives, challenges for managers
"""
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from typing import Optional
from datetime import datetime, timezone, timedelta

from core.security import get_current_user
from services.manager_service import ManagerService, APIKeyService
from api.dependencies import get_manager_service, get_api_key_service, get_db

router = APIRouter(prefix="/manager", tags=["Manager"])


# ===== RBAC: ROLE-BASED ACCESS CONTROL =====

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


async def get_store_context(
    request: Request,
    current_user: dict = Depends(verify_manager_or_gerant),
    db = Depends(get_db)
) -> dict:
    """
    Resolve store_id based on user role:
    - Manager: Use their assigned store_id
    - Gérant: Use store_id from query params (with ownership verification)
    
    Returns dict with user info + resolved store_id
    """
    role = current_user.get('role')
    
    if role == 'manager':
        # Manager: use their store_id
        store_id = current_user.get('store_id')
        if not store_id:
            raise HTTPException(status_code=400, detail="Manager n'a pas de magasin assigné")
        return {**current_user, 'resolved_store_id': store_id, 'view_mode': 'manager'}
    
    elif role in ['gerant', 'gérant']:
        # Gérant: get store_id from query params
        store_id = request.query_params.get('store_id')
        
        if not store_id:
            raise HTTPException(
                status_code=400, 
                detail="Le paramètre store_id est requis pour un gérant. Ex: ?store_id=xxx"
            )
        
        # Security: Verify the gérant owns this store
        store = await db.stores.find_one(
            {"id": store_id, "gerant_id": current_user['id'], "active": True},
            {"_id": 0, "id": 1, "name": 1}
        )
        
        if not store:
            raise HTTPException(
                status_code=403, 
                detail="Ce magasin n'existe pas ou ne vous appartient pas"
            )
        
        return {
            **current_user, 
            'resolved_store_id': store_id, 
            'view_mode': 'gerant_as_manager',
            'store_name': store.get('name')
        }
    
    else:
        raise HTTPException(status_code=403, detail="Rôle non autorisé")


# ===== SUBSCRIPTION ACCESS CHECK =====

@router.get("/subscription-status")
async def get_subscription_status(
    store_id: Optional[str] = Query(None, description="Store ID (requis pour gérant)"),
    context: dict = Depends(get_store_context),
    db = Depends(get_db)
):
    """
    Check subscription status for access control.
    Returns isReadOnly: true if trial expired.
    
    - Manager: Checks their gérant's subscription
    - Gérant: Checks their own subscription (always has access)
    """
    try:
        role = context.get('role')
        
        # If gérant is viewing, they always have active access (or they check their own status)
        if role in ['gerant', 'gérant']:
            workspace_id = context.get('workspace_id')
            if workspace_id:
                workspace = await db.workspaces.find_one({"id": workspace_id}, {"_id": 0})
                if workspace:
                    subscription_status = workspace.get('subscription_status', 'inactive')
                    if subscription_status == 'active':
                        return {"isReadOnly": False, "status": "active", "message": "Abonnement actif", "viewMode": "gerant"}
                    elif subscription_status == 'trialing':
                        trial_end = workspace.get('trial_end')
                        if trial_end:
                            if isinstance(trial_end, str):
                                trial_end_dt = datetime.fromisoformat(trial_end.replace('Z', '+00:00'))
                            else:
                                trial_end_dt = trial_end
                            now = datetime.now(timezone.utc)
                            if trial_end_dt.tzinfo is None:
                                trial_end_dt = trial_end_dt.replace(tzinfo=timezone.utc)
                            if now < trial_end_dt:
                                days_left = (trial_end_dt - now).days
                                return {"isReadOnly": False, "status": "trialing", "daysLeft": days_left, "viewMode": "gerant"}
            return {"isReadOnly": False, "status": "gerant_access", "message": "Accès gérant", "viewMode": "gerant"}
        
        # Manager: check their gérant's subscription
        gerant_id = context.get('gerant_id')
        
        if not gerant_id:
            return {"isReadOnly": True, "status": "no_gerant", "message": "Aucun gérant associé"}
        
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
        
        if subscription_status == 'active':
            return {"isReadOnly": False, "status": "active", "message": "Abonnement actif"}
        
        if subscription_status == 'trialing':
            trial_end = workspace.get('trial_end')
            if trial_end:
                if isinstance(trial_end, str):
                    trial_end_dt = datetime.fromisoformat(trial_end.replace('Z', '+00:00'))
                else:
                    trial_end_dt = trial_end
                
                now = datetime.now(timezone.utc)
                if trial_end_dt.tzinfo is None:
                    trial_end_dt = trial_end_dt.replace(tzinfo=timezone.utc)
                
                if now < trial_end_dt:
                    days_left = (trial_end_dt - now).days
                    return {"isReadOnly": False, "status": "trialing", "message": f"Essai gratuit - {days_left} jours restants", "daysLeft": days_left}
        
        return {"isReadOnly": True, "status": "trial_expired", "message": "Période d'essai terminée. Contactez votre administrateur."}
        
    except Exception as e:
        return {"isReadOnly": True, "status": "error", "message": str(e)}


# ===== STORE KPI OVERVIEW =====

@router.get("/store-kpi-overview")
async def get_store_kpi_overview(
    date: str = Query(None),
    store_id: Optional[str] = Query(None, description="Store ID (requis pour gérant)"),
    context: dict = Depends(get_store_context),
    db = Depends(get_db)
):
    """
    Get KPI overview for manager's store on a specific date.
    Returns aggregated KPIs for all sellers.
    
    - Manager: Uses their assigned store
    - Gérant: Must provide store_id query param
    """
    resolved_store_id = context.get('resolved_store_id')
    
    # Use provided date or today
    target_date = date or datetime.now(timezone.utc).strftime('%Y-%m-%d')
    
    # Get all KPI entries for the store on this date
    kpi_entries = await db.kpi_entries.find({
        "store_id": resolved_store_id,
        "date": target_date
    }, {"_id": 0}).to_list(1000)
    
    # Also get manager KPIs
    manager_kpis = await db.manager_kpi.find({
        "store_id": resolved_store_id,
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
    store_id: Optional[str] = Query(None, description="Store ID (requis pour gérant)"),
    context: dict = Depends(get_store_context),
    db = Depends(get_db)
):
    """
    Get list of dates that have KPI data for the store.
    Used for calendar highlighting.
    
    Returns:
        - dates: list of dates with any KPI data
        - lockedDates: list of dates with locked/validated KPI entries
    """
    resolved_store_id = context.get('resolved_store_id')
    
    # Build date filter
    query = {"store_id": resolved_store_id}
    if year and month:
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
    
    # Get locked dates
    locked_query = {**query, "locked": True}
    locked_dates = await db.kpi_entries.distinct("date", locked_query)
    
    return {
        "dates": all_dates,
        "lockedDates": sorted(locked_dates)
    }


@router.get("/available-years")
async def get_available_years(
    store_id: Optional[str] = Query(None, description="Store ID (requis pour gérant)"),
    context: dict = Depends(get_store_context),
    db = Depends(get_db)
):
    """Get list of years that have KPI data for the store"""
    resolved_store_id = context.get('resolved_store_id')
    
    dates = await db.kpi_entries.distinct("date", {"store_id": resolved_store_id})
    manager_dates = await db.manager_kpi.distinct("date", {"store_id": resolved_store_id})
    
    all_dates = set(dates) | set(manager_dates)
    
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
    store_id: Optional[str] = Query(None, description="Store ID (requis pour gérant)"),
    context: dict = Depends(get_store_context),
    manager_service: ManagerService = Depends(get_manager_service)
):
    """Get all sellers for the store"""
    try:
        resolved_store_id = context.get('resolved_store_id')
        manager_id = context.get('id')
        
        sellers = await manager_service.get_sellers(
            manager_id=manager_id,
            store_id=resolved_store_id
        )
        return sellers
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/invitations")
async def get_invitations(
    store_id: Optional[str] = Query(None, description="Store ID (requis pour gérant)"),
    context: dict = Depends(get_store_context),
    manager_service: ManagerService = Depends(get_manager_service)
):
    """Get pending invitations for the store"""
    try:
        manager_id = context.get('id')
        invitations = await manager_service.get_invitations(manager_id)
        return invitations
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/sync-mode")
async def get_sync_mode(
    store_id: Optional[str] = Query(None, description="Store ID (requis pour gérant)"),
    context: dict = Depends(get_store_context),
    manager_service: ManagerService = Depends(get_manager_service)
):
    """Get sync mode configuration for the store"""
    try:
        resolved_store_id = context.get('resolved_store_id')
        config = await manager_service.get_sync_mode(resolved_store_id)
        return config
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/kpi-config")
async def get_kpi_config(
    store_id: Optional[str] = Query(None, description="Store ID (requis pour gérant)"),
    context: dict = Depends(get_store_context),
    manager_service: ManagerService = Depends(get_manager_service)
):
    """Get KPI configuration for the store"""
    try:
        resolved_store_id = context.get('resolved_store_id')
        config = await manager_service.get_kpi_config(resolved_store_id)
        return config
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/team-bilans/all")
async def get_team_bilans_all(
    store_id: Optional[str] = Query(None, description="Store ID (requis pour gérant)"),
    context: dict = Depends(get_store_context),
    manager_service: ManagerService = Depends(get_manager_service)
):
    """Get all team bilans for the store"""
    try:
        resolved_store_id = context.get('resolved_store_id')
        manager_id = context.get('id')
        
        bilans = await manager_service.get_team_bilans_all(
            manager_id=manager_id,
            store_id=resolved_store_id
        )
        return bilans
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/store-kpi/stats")
async def get_store_kpi_stats(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    store_id: Optional[str] = Query(None, description="Store ID (requis pour gérant)"),
    context: dict = Depends(get_store_context),
    manager_service: ManagerService = Depends(get_manager_service)
):
    """Get aggregated KPI statistics for the store"""
    try:
        resolved_store_id = context.get('resolved_store_id')
        
        stats = await manager_service.get_store_kpi_stats(
            store_id=resolved_store_id,
            start_date=start_date,
            end_date=end_date
        )
        return stats
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/objectives/active")
async def get_active_objectives(
    store_id: Optional[str] = Query(None, description="Store ID (requis pour gérant)"),
    context: dict = Depends(get_store_context),
    manager_service: ManagerService = Depends(get_manager_service)
):
    """Get active objectives for the store's team"""
    try:
        resolved_store_id = context.get('resolved_store_id')
        manager_id = context.get('id')
        
        objectives = await manager_service.get_active_objectives(
            manager_id=manager_id,
            store_id=resolved_store_id
        )
        return objectives
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/challenges/active")
async def get_active_challenges(
    store_id: Optional[str] = Query(None, description="Store ID (requis pour gérant)"),
    context: dict = Depends(get_store_context),
    manager_service: ManagerService = Depends(get_manager_service)
):
    """Get active challenges for the store's team"""
    try:
        resolved_store_id = context.get('resolved_store_id')
        manager_id = context.get('id')
        
        challenges = await manager_service.get_active_challenges(
            manager_id=manager_id,
            store_id=resolved_store_id
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




# ===== OBJECTIVES CRUD =====
# Full CRUD operations for team objectives
# Accessible by both Manager and Gérant (with store_id param)

@router.get("/objectives")
async def get_all_objectives(
    store_id: Optional[str] = Query(None, description="Store ID (requis pour gérant)"),
    context: dict = Depends(get_store_context),
    db = Depends(get_db)
):
    """
    Get ALL objectives for the store (active + inactive)
    Used by the manager settings modal
    """
    try:
        resolved_store_id = context.get('resolved_store_id')
        
        objectives = await db.objectives.find(
            {"store_id": resolved_store_id},
            {"_id": 0}
        ).sort("created_at", -1).to_list(100)
        
        return objectives
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/objectives")
async def create_objective(
    objective_data: dict,
    store_id: Optional[str] = Query(None, description="Store ID (requis pour gérant)"),
    context: dict = Depends(get_store_context),
    db = Depends(get_db)
):
    """Create a new team objective"""
    from uuid import uuid4
    
    try:
        resolved_store_id = context.get('resolved_store_id')
        manager_id = context.get('id')
        
        objective = {
            "id": str(uuid4()),
            "store_id": resolved_store_id,
            "manager_id": manager_id,
            "title": objective_data.get("title", ""),
            "description": objective_data.get("description", ""),
            "target_value": objective_data.get("target_value", 0),
            "current_value": 0,
            "kpi_type": objective_data.get("kpi_type", "ca_journalier"),
            "period_start": objective_data.get("period_start") or objective_data.get("start_date"),
            "period_end": objective_data.get("period_end") or objective_data.get("end_date"),
            "start_date": objective_data.get("start_date") or objective_data.get("period_start"),
            "end_date": objective_data.get("end_date") or objective_data.get("period_end"),
            "status": "active",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.objectives.insert_one(objective)
        objective.pop("_id", None)
        
        return objective
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/objectives/{objective_id}")
async def update_objective(
    objective_id: str,
    objective_data: dict,
    store_id: Optional[str] = Query(None, description="Store ID (requis pour gérant)"),
    context: dict = Depends(get_store_context),
    db = Depends(get_db)
):
    """Update an existing objective"""
    try:
        resolved_store_id = context.get('resolved_store_id')
        
        # Verify objective belongs to this store
        existing = await db.objectives.find_one(
            {"id": objective_id, "store_id": resolved_store_id}
        )
        
        if not existing:
            raise HTTPException(status_code=404, detail="Objectif non trouvé")
        
        update_fields = {
            "title": objective_data.get("title", existing.get("title")),
            "description": objective_data.get("description", existing.get("description")),
            "target_value": objective_data.get("target_value", existing.get("target_value")),
            "kpi_type": objective_data.get("kpi_type", existing.get("kpi_type")),
            "period_start": objective_data.get("period_start") or objective_data.get("start_date") or existing.get("period_start"),
            "period_end": objective_data.get("period_end") or objective_data.get("end_date") or existing.get("period_end"),
            "start_date": objective_data.get("start_date") or objective_data.get("period_start") or existing.get("start_date"),
            "end_date": objective_data.get("end_date") or objective_data.get("period_end") or existing.get("end_date"),
            "status": objective_data.get("status", existing.get("status")),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.objectives.update_one(
            {"id": objective_id},
            {"$set": update_fields}
        )
        
        return {"success": True, "message": "Objectif mis à jour", "id": objective_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/objectives/{objective_id}")
async def delete_objective(
    objective_id: str,
    store_id: Optional[str] = Query(None, description="Store ID (requis pour gérant)"),
    context: dict = Depends(get_store_context),
    db = Depends(get_db)
):
    """Delete an objective"""
    try:
        resolved_store_id = context.get('resolved_store_id')
        
        result = await db.objectives.delete_one(
            {"id": objective_id, "store_id": resolved_store_id}
        )
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Objectif non trouvé")
        
        return {"success": True, "message": "Objectif supprimé"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/objectives/{objective_id}/progress")
async def update_objective_progress(
    objective_id: str,
    progress_data: dict,
    store_id: Optional[str] = Query(None, description="Store ID (requis pour gérant)"),
    context: dict = Depends(get_store_context),
    db = Depends(get_db)
):
    """Update progress on an objective"""
    try:
        resolved_store_id = context.get('resolved_store_id')
        
        existing = await db.objectives.find_one(
            {"id": objective_id, "store_id": resolved_store_id}
        )
        
        if not existing:
            raise HTTPException(status_code=404, detail="Objectif non trouvé")
        
        current_value = progress_data.get("current_value", existing.get("current_value", 0))
        
        await db.objectives.update_one(
            {"id": objective_id},
            {"$set": {
                "current_value": current_value,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        return {"success": True, "current_value": current_value}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ===== CHALLENGES CRUD =====
# Full CRUD operations for team challenges
# Accessible by both Manager and Gérant (with store_id param)

@router.get("/challenges")
async def get_all_challenges(
    store_id: Optional[str] = Query(None, description="Store ID (requis pour gérant)"),
    context: dict = Depends(get_store_context),
    db = Depends(get_db)
):
    """
    Get ALL challenges for the store (active + inactive)
    Used by the manager settings modal
    """
    try:
        resolved_store_id = context.get('resolved_store_id')
        
        challenges = await db.challenges.find(
            {"store_id": resolved_store_id},
            {"_id": 0}
        ).sort("created_at", -1).to_list(100)
        
        return challenges
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/challenges")
async def create_challenge(
    challenge_data: dict,
    store_id: Optional[str] = Query(None, description="Store ID (requis pour gérant)"),
    context: dict = Depends(get_store_context),
    db = Depends(get_db)
):
    """Create a new team challenge"""
    from uuid import uuid4
    
    try:
        resolved_store_id = context.get('resolved_store_id')
        manager_id = context.get('id')
        
        challenge = {
            "id": str(uuid4()),
            "store_id": resolved_store_id,
            "manager_id": manager_id,
            "title": challenge_data.get("title", ""),
            "description": challenge_data.get("description", ""),
            "target_value": challenge_data.get("target_value", 0),
            "current_value": 0,
            "reward": challenge_data.get("reward", ""),
            "kpi_type": challenge_data.get("kpi_type", "ca_journalier"),
            "period_start": challenge_data.get("period_start") or challenge_data.get("start_date"),
            "period_end": challenge_data.get("period_end") or challenge_data.get("end_date"),
            "start_date": challenge_data.get("start_date") or challenge_data.get("period_start"),
            "end_date": challenge_data.get("end_date") or challenge_data.get("period_end"),
            "status": "active",
            "participants": challenge_data.get("participants", []),
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.challenges.insert_one(challenge)
        challenge.pop("_id", None)
        
        return challenge
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/challenges/{challenge_id}")
async def update_challenge(
    challenge_id: str,
    challenge_data: dict,
    store_id: Optional[str] = Query(None, description="Store ID (requis pour gérant)"),
    context: dict = Depends(get_store_context),
    db = Depends(get_db)
):
    """Update an existing challenge"""
    try:
        resolved_store_id = context.get('resolved_store_id')
        
        existing = await db.challenges.find_one(
            {"id": challenge_id, "store_id": resolved_store_id}
        )
        
        if not existing:
            raise HTTPException(status_code=404, detail="Challenge non trouvé")
        
        update_fields = {
            "title": challenge_data.get("title", existing.get("title")),
            "description": challenge_data.get("description", existing.get("description")),
            "target_value": challenge_data.get("target_value", existing.get("target_value")),
            "reward": challenge_data.get("reward", existing.get("reward")),
            "kpi_type": challenge_data.get("kpi_type", existing.get("kpi_type")),
            "period_start": challenge_data.get("period_start") or challenge_data.get("start_date") or existing.get("period_start"),
            "period_end": challenge_data.get("period_end") or challenge_data.get("end_date") or existing.get("period_end"),
            "start_date": challenge_data.get("start_date") or challenge_data.get("period_start") or existing.get("start_date"),
            "end_date": challenge_data.get("end_date") or challenge_data.get("period_end") or existing.get("end_date"),
            "status": challenge_data.get("status", existing.get("status")),
            "participants": challenge_data.get("participants", existing.get("participants", [])),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.challenges.update_one(
            {"id": challenge_id},
            {"$set": update_fields}
        )
        
        return {"success": True, "message": "Challenge mis à jour", "id": challenge_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/challenges/{challenge_id}")
async def delete_challenge(
    challenge_id: str,
    store_id: Optional[str] = Query(None, description="Store ID (requis pour gérant)"),
    context: dict = Depends(get_store_context),
    db = Depends(get_db)
):
    """Delete a challenge"""
    try:
        resolved_store_id = context.get('resolved_store_id')
        
        result = await db.challenges.delete_one(
            {"id": challenge_id, "store_id": resolved_store_id}
        )
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Challenge non trouvé")
        
        return {"success": True, "message": "Challenge supprimé"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/challenges/{challenge_id}/progress")
async def update_challenge_progress(
    challenge_id: str,
    progress_data: dict,
    store_id: Optional[str] = Query(None, description="Store ID (requis pour gérant)"),
    context: dict = Depends(get_store_context),
    db = Depends(get_db)
):
    """Update progress on a challenge"""
    try:
        resolved_store_id = context.get('resolved_store_id')
        
        existing = await db.challenges.find_one(
            {"id": challenge_id, "store_id": resolved_store_id}
        )
        
        if not existing:
            raise HTTPException(status_code=404, detail="Challenge non trouvé")
        
        current_value = progress_data.get("current_value", existing.get("current_value", 0))
        
        await db.challenges.update_one(
            {"id": challenge_id},
            {"$set": {
                "current_value": current_value,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        return {"success": True, "current_value": current_value}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ===== AI STORE KPI ANALYSIS =====

@router.post("/analyze-store-kpis")
async def analyze_store_kpis(
    analysis_data: dict,
    store_id: Optional[str] = Query(None, description="Store ID (requis pour gérant)"),
    context: dict = Depends(get_store_context),
    db = Depends(get_db)
):
    """
    Generate AI-powered analysis of store KPIs
    
    Uses OpenAI via Emergent LLM key to analyze store performance
    and provide recommendations.
    """
    from services.ai_service import AIService
    
    try:
        resolved_store_id = context.get('resolved_store_id')
        
        # Get store info
        store = await db.stores.find_one(
            {"id": resolved_store_id},
            {"_id": 0, "name": 1, "location": 1}
        )
        
        store_name = store.get('name', 'Magasin') if store else 'Magasin'
        
        # Get date range from request
        start_date = analysis_data.get('start_date') or analysis_data.get('startDate')
        end_date = analysis_data.get('end_date') or analysis_data.get('endDate')
        
        # Default to last 30 days if no dates provided
        if not end_date:
            end_date = datetime.now(timezone.utc).strftime('%Y-%m-%d')
        if not start_date:
            start_dt = datetime.now(timezone.utc) - timedelta(days=30)
            start_date = start_dt.strftime('%Y-%m-%d')
        
        # Fetch KPI data for the period
        kpi_entries = await db.kpi_entries.find({
            "store_id": resolved_store_id,
            "date": {"$gte": start_date, "$lte": end_date}
        }, {"_id": 0}).to_list(1000)
        
        # Also get manager KPIs
        manager_kpis = await db.manager_kpi.find({
            "store_id": resolved_store_id,
            "date": {"$gte": start_date, "$lte": end_date}
        }, {"_id": 0}).to_list(100)
        
        # Calculate aggregates
        total_ca = sum(e.get('ca_journalier') or e.get('seller_ca') or 0 for e in kpi_entries)
        total_ca += sum(k.get('ca_journalier') or 0 for k in manager_kpis)
        
        total_ventes = sum(e.get('nb_ventes') or 0 for e in kpi_entries)
        total_ventes += sum(k.get('nb_ventes') or 0 for k in manager_kpis)
        
        total_clients = sum(e.get('nb_clients') or 0 for e in kpi_entries)
        total_articles = sum(e.get('nb_articles') or 0 for e in kpi_entries)
        
        panier_moyen = (total_ca / total_ventes) if total_ventes > 0 else 0
        taux_conversion = (total_ventes / total_clients * 100) if total_clients > 0 else 0
        uvc = (total_articles / total_ventes) if total_ventes > 0 else 0
        
        # Get seller count
        sellers_count = len(set(e.get('seller_id') for e in kpi_entries if e.get('seller_id')))
        days_count = len(set(e.get('date') for e in kpi_entries))
        
        # Prepare context for AI
        kpi_summary = f"""
Magasin: {store_name}
Période: {start_date} à {end_date} ({days_count} jours)
Vendeurs actifs: {sellers_count}

KPIs agrégés:
- Chiffre d'affaires total: {total_ca:.2f}€
- Nombre de ventes: {total_ventes}
- Nombre de clients: {total_clients}
- Articles vendus: {total_articles}
- Panier moyen: {panier_moyen:.2f}€
- Taux de transformation: {taux_conversion:.1f}%
- UVC (articles/vente): {uvc:.2f}
"""
        
        # Initialize AI service
        ai_service = AIService()
        
        if not ai_service.client:
            # Return mock analysis if AI not available
            return {
                "analysis": f"📊 Analyse des KPIs du magasin {store_name}\n\n{kpi_summary}\n\n💡 Pour une analyse IA détaillée, veuillez configurer le service IA.",
                "store_name": store_name,
                "period": {"start": start_date, "end": end_date},
                "kpis": {
                    "total_ca": total_ca,
                    "total_ventes": total_ventes,
                    "panier_moyen": round(panier_moyen, 2),
                    "taux_conversion": round(taux_conversion, 1)
                }
            }
        
        # Generate AI analysis
        try:
            response = ai_service.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": """Tu es un expert en performance commerciale retail.
Analyse les KPIs du magasin et fournis:
1. Un résumé des performances
2. Points forts identifiés
3. Axes d'amélioration
4. 3 recommandations concrètes

Sois concis, pratique et actionnable. Utilise des emojis pour rendre l'analyse lisible."""},
                    {"role": "user", "content": f"Analyse ces KPIs et donne des recommandations:\n{kpi_summary}"}
                ],
                temperature=0.7,
                max_tokens=1000
            )
            
            analysis_text = response.choices[0].message.content
            
        except Exception as ai_error:
            analysis_text = f"📊 Résumé automatique des KPIs\n\n{kpi_summary}\n\n⚠️ Analyse IA temporairement indisponible: {str(ai_error)}"
        
        return {
            "analysis": analysis_text,
            "store_name": store_name,
            "period": {"start": start_date, "end": end_date},
            "kpis": {
                "total_ca": total_ca,
                "total_ventes": total_ventes,
                "total_clients": total_clients,
                "total_articles": total_articles,
                "panier_moyen": round(panier_moyen, 2),
                "taux_conversion": round(taux_conversion, 1),
                "uvc": round(uvc, 2),
                "sellers_count": sellers_count,
                "days_count": days_count
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
