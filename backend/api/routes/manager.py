"""
Manager Routes
Team management, KPIs, objectives, challenges for managers
"""
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from typing import Optional
from datetime import datetime, timezone, timedelta
import logging

from core.security import get_current_user
from services.manager_service import ManagerService, APIKeyService
from api.dependencies import get_manager_service, get_api_key_service, get_db

router = APIRouter(prefix="/manager", tags=["Manager"])
logger = logging.getLogger(__name__)


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


async def verify_manager_gerant_or_seller(current_user: dict = Depends(get_current_user)) -> dict:
    """Verify current user is a manager, gérant, or seller"""
    if current_user.get('role') not in ['manager', 'gerant', 'gérant', 'seller']:
        raise HTTPException(status_code=403, detail="Access restricted to managers, gérants, and sellers")
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


async def get_store_context_with_seller(
    request: Request,
    current_user: dict = Depends(verify_manager_gerant_or_seller),
    db = Depends(get_db)
) -> dict:
    """
    Resolve store_id based on user role (includes sellers):
    - Seller: Use their assigned store_id directly
    - Manager: Use their assigned store_id
    - Gérant: Use store_id from query params (with ownership verification)
    
    Returns dict with user info + resolved store_id
    """
    role = current_user.get('role')
    
    if role == 'seller':
        # Seller: use their store_id directly
        store_id = current_user.get('store_id')
        if not store_id:
            raise HTTPException(status_code=400, detail="Vendeur n'a pas de magasin assigné")
        return {**current_user, 'resolved_store_id': store_id, 'view_mode': 'seller'}
    
    elif role == 'manager':
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
    context: dict = Depends(get_store_context_with_seller),  # 🔧 Now includes sellers
    manager_service: ManagerService = Depends(get_manager_service)
):
    """
    Get sync mode configuration for the store.
    
    Accessible by: Manager, Gérant, and Seller
    - Sellers need this to know if their store is in Enterprise mode (read-only)
    """
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


@router.put("/kpi-config")
async def update_kpi_config(
    config_update: dict,
    store_id: Optional[str] = Query(None, description="Store ID (requis pour gérant)"),
    context: dict = Depends(get_store_context),
    db = Depends(get_db)
):
    """
    Update KPI configuration for the store.
    
    Fields:
    - enabled: bool - Whether sellers can input KPIs
    - saisie_enabled: bool - Alias for enabled
    - seller_track_*: bool - Whether sellers track this KPI
    - manager_track_*: bool - Whether manager tracks this KPI
    """
    try:
        resolved_store_id = context.get('resolved_store_id') or store_id
        manager_id = context.get('id')
        
        if not resolved_store_id and not manager_id:
            raise HTTPException(status_code=400, detail="Store ID ou Manager ID requis")
        
        # Prepare update data
        update_data = {
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        # Handle 'enabled' field (controls if sellers can input KPIs)
        if 'enabled' in config_update:
            update_data['enabled'] = config_update['enabled']
            update_data['saisie_enabled'] = config_update['enabled']
        
        if 'saisie_enabled' in config_update:
            update_data['saisie_enabled'] = config_update['saisie_enabled']
            update_data['enabled'] = config_update['saisie_enabled']
        
        # Handle seller_track_* and manager_track_* fields
        track_fields = [
            'seller_track_ca', 'manager_track_ca',
            'seller_track_ventes', 'manager_track_ventes',
            'seller_track_clients', 'manager_track_clients',
            'seller_track_articles', 'manager_track_articles',
            'seller_track_prospects', 'manager_track_prospects'
        ]
        
        for field in track_fields:
            if field in config_update:
                update_data[field] = config_update[field]
        
        # Build query - prefer store_id, fallback to manager_id
        query = {}
        if resolved_store_id:
            query["store_id"] = resolved_store_id
        else:
            query["manager_id"] = manager_id
        
        # Upsert config
        result = await db.kpi_configs.update_one(
            query,
            {
                "$set": update_data,
                "$setOnInsert": {
                    "store_id": resolved_store_id,
                    "manager_id": manager_id,
                    "created_at": datetime.now(timezone.utc).isoformat()
                }
            },
            upsert=True
        )
        
        # Fetch and return updated config
        config = await db.kpi_configs.find_one(query, {"_id": 0})
        
        return config or {
            "store_id": resolved_store_id,
            "enabled": update_data.get('enabled', True),
            "saisie_enabled": update_data.get('saisie_enabled', True)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating KPI config: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ===== MANAGER KPI ENDPOINTS =====

@router.get("/manager-kpi")
async def get_manager_kpis(
    start_date: str = Query(..., description="Start date (YYYY-MM-DD)"),
    end_date: str = Query(..., description="End date (YYYY-MM-DD)"),
    store_id: Optional[str] = Query(None, description="Store ID (requis pour gérant)"),
    context: dict = Depends(get_store_context),
    db = Depends(get_db)
):
    """
    Get manager KPI entries for a date range.
    Used to fetch KPIs entered by the manager (not sellers).
    """
    try:
        resolved_store_id = context.get('resolved_store_id') or store_id
        
        if not resolved_store_id:
            return []
        
        query = {
            "store_id": resolved_store_id,
            "date": {"$gte": start_date, "$lte": end_date}
        }
        
        kpis = await db.manager_kpi.find(query, {"_id": 0}).sort("date", -1).to_list(500)
        
        return kpis
        
    except Exception as e:
        logger.error(f"Error fetching manager KPIs: {e}")
        return []


@router.post("/manager-kpi")
async def save_manager_kpi(
    kpi_data: dict,
    store_id: Optional[str] = Query(None, description="Store ID (requis pour gérant)"),
    context: dict = Depends(get_store_context),
    db = Depends(get_db)
):
    """
    Save manager KPI entry for a specific date.
    This is for KPIs that the manager tracks (not sellers).
    """
    from uuid import uuid4
    
    try:
        resolved_store_id = context.get('resolved_store_id') or store_id
        manager_id = context.get('id')
        
        if not resolved_store_id:
            raise HTTPException(status_code=400, detail="Store ID requis")
        
        date = kpi_data.get('date', datetime.now(timezone.utc).strftime('%Y-%m-%d'))
        
        # 🔒 Vérifier si cette date est verrouillée (données API)
        locked_entry = await db.kpis.find_one({
            "store_id": resolved_store_id,
            "date": date,
            "$or": [
                {"locked": True},
                {"source": "api"}
            ]
        }, {"_id": 0, "locked": 1})
        
        if locked_entry:
            raise HTTPException(
                status_code=403,
                detail="🔒 Cette date est verrouillée. Les données proviennent de l'API/ERP."
            )
        
        # Check if entry exists for this date
        existing = await db.manager_kpi.find_one({
            "store_id": resolved_store_id,
            "date": date
        })
        
        # Vérifier si l'entrée existante est verrouillée
        if existing and existing.get('locked'):
            raise HTTPException(
                status_code=403,
                detail="🔒 Cette entrée est verrouillée (données API)."
            )
        
        entry_data = {
            "store_id": resolved_store_id,
            "manager_id": manager_id,
            "date": date,
            "ca_journalier": kpi_data.get('ca_journalier') or 0,
            "nb_ventes": kpi_data.get('nb_ventes') or 0,
            "nb_clients": kpi_data.get('nb_clients') or 0,
            "nb_articles": kpi_data.get('nb_articles') or 0,
            "nb_prospects": kpi_data.get('nb_prospects') or 0,
            "source": "manual",
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        if existing:
            await db.manager_kpi.update_one(
                {"_id": existing['_id']},
                {"$set": entry_data}
            )
            entry_data['id'] = existing.get('id', str(existing['_id']))
        else:
            entry_data['id'] = str(uuid4())
            entry_data['created_at'] = datetime.now(timezone.utc).isoformat()
            await db.manager_kpi.insert_one(entry_data)
        
        if '_id' in entry_data:
            del entry_data['_id']
        
        return entry_data
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error saving manager KPI: {e}")
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
    
    🏺 LEGACY RESTORED - Uses GPT-4o with expert retail prompts
    
    Analyzes store performance with focus on:
    - Boutique physique context (not active prospection)
    - Transformation des visiteurs en acheteurs
    - Actionnable insights for retail
    """
    from services.ai_service import AIService
    
    try:
        resolved_store_id = context.get('resolved_store_id')
        user_id = context.get('id')
        
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
        
        # Calculate period label for display
        days_diff = (datetime.strptime(end_date, '%Y-%m-%d') - datetime.strptime(start_date, '%Y-%m-%d')).days
        if days_diff <= 1:
            period_text = f"le {end_date}"
        elif days_diff <= 7:
            period_text = f"la semaine du {start_date} au {end_date}"
        elif days_diff <= 31:
            period_text = f"le mois du {start_date} au {end_date}"
        else:
            period_text = f"la période du {start_date} au {end_date}"
        
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
        total_prospects = sum(e.get('nb_prospects') or 0 for e in kpi_entries)
        
        panier_moyen = (total_ca / total_ventes) if total_ventes > 0 else 0
        taux_transformation = (total_ventes / total_prospects * 100) if total_prospects > 0 else 0
        indice_vente = (total_articles / total_ventes) if total_ventes > 0 else 0
        
        # Get seller count
        sellers_count = len(set(e.get('seller_id') for e in kpi_entries if e.get('seller_id')))
        days_count = len(set(e.get('date') for e in kpi_entries))
        
        # 🏺 LEGACY PROMPT RESTORED - Build context with only available data
        available_kpis = []
        if panier_moyen > 0:
            available_kpis.append(f"Panier Moyen : {panier_moyen:.2f} €")
        if taux_transformation > 0:
            available_kpis.append(f"Taux de Transformation : {taux_transformation:.1f} %")
        if indice_vente > 0:
            available_kpis.append(f"Indice de Vente (UPT) : {indice_vente:.2f}")
        
        available_totals = []
        if total_ca > 0:
            available_totals.append(f"CA Total : {total_ca:.2f} €")
        if total_ventes > 0:
            available_totals.append(f"Ventes : {total_ventes}")
        if total_clients > 0:
            available_totals.append(f"Clients : {total_clients}")
        if total_articles > 0:
            available_totals.append(f"Articles : {total_articles}")
        if total_prospects > 0:
            available_totals.append(f"Prospects : {total_prospects}")
        
        # 🎯 LEGACY PROMPT - Expert retail analysis for physical stores
        prompt = f"""Tu es un expert en analyse de performance retail pour BOUTIQUES PHYSIQUES. Analyse UNIQUEMENT les données disponibles ci-dessous pour {period_text}. Ne mentionne PAS les données manquantes.

CONTEXTE IMPORTANT : Il s'agit d'une boutique avec flux naturel de clients. Les "prospects" représentent les visiteurs entrés en boutique, PAS de prospection active à faire. Le travail consiste à transformer les visiteurs en acheteurs.

Magasin : {store_name}
Période analysée : {period_text}
Points de données : {days_count} jours, {sellers_count} vendeurs

KPIs Disponibles :
{chr(10).join(['- ' + kpi for kpi in available_kpis]) if available_kpis else '(Aucun KPI calculé)'}

Totaux :
{chr(10).join(['- ' + total for total in available_totals]) if available_totals else '(Aucune donnée)'}

CONSIGNES STRICTES :
- Analyse UNIQUEMENT les données présentes
- Ne mentionne JAMAIS les données manquantes ou absentes
- Sois concis et direct (2-3 points max par section)
- Fournis des insights actionnables pour BOUTIQUE PHYSIQUE
- Si c'est une période longue, identifie les tendances
- NE RECOMMANDE PAS de prospection active (c'est une boutique, pas de la vente externe)
- Focus sur : accueil, découverte besoins, argumentation, closing, fidélisation

Fournis une analyse en 2 parties courtes :

## ANALYSE
- Observation clé sur les performances globales
- Point d'attention ou tendance notable
- Comparaison ou contexte si pertinent

## RECOMMANDATIONS
- Actions concrètes et prioritaires pour améliorer la vente en boutique (2-3 max)
- Focus sur l'amélioration des KPIs faibles (taux de transformation, panier moyen, indice de vente)

Format : Markdown simple et concis."""

        # Initialize AI service and use the generate_store_kpi_analysis method
        ai_service = AIService()
        
        if not ai_service.available:
            # Return fallback analysis if AI not available
            return {
                "analysis": f"""## Analyse des KPIs du magasin {store_name}

📊 **Période** : {period_text}

**KPIs Disponibles :**
{chr(10).join(['- ' + kpi for kpi in available_kpis]) if available_kpis else '- Aucun KPI calculé'}

**Totaux :**
{chr(10).join(['- ' + total for total in available_totals]) if available_totals else '- Aucune donnée'}

💡 Pour une analyse IA détaillée, veuillez configurer le service IA.""",
                "store_name": store_name,
                "period": {"start": start_date, "end": end_date},
                "kpis": {
                    "total_ca": total_ca,
                    "total_ventes": total_ventes,
                    "panier_moyen": round(panier_moyen, 2),
                    "taux_transformation": round(taux_transformation, 1)
                }
            }
        
        # 🎯 Use GPT-4o for store analysis (Legacy Restored)
        try:
            chat = ai_service._create_chat(
                session_id=f"kpi-analysis-{user_id}-{end_date}",
                system_message="Tu es un expert en analyse de performance retail avec 15 ans d'expérience.",
                model="gpt-4o"  # 🏺 Premium model restored
            )
            
            analysis_text = await ai_service._send_message(chat, prompt)
            
            if not analysis_text:
                raise Exception("No response from AI")
                
        except Exception as ai_error:
            logger.error(f"Store KPI AI error: {ai_error}")
            analysis_text = f"""## Résumé automatique des KPIs

📊 **Magasin** : {store_name}
**Période** : {period_text}

**KPIs :**
{chr(10).join(['- ' + kpi for kpi in available_kpis]) if available_kpis else '- Aucun KPI'}

**Totaux :**
{chr(10).join(['- ' + total for total in available_totals]) if available_totals else '- Aucune donnée'}

⚠️ Analyse IA temporairement indisponible."""
        
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
                "taux_transformation": round(taux_transformation, 1),
                "indice_vente": round(indice_vente, 2),
                "sellers_count": sellers_count,
                "days_count": days_count
            }
        }
        
    except Exception as e:
        logger.error(f"Error in analyze_store_kpis: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ===== SELLER DETAILS ENDPOINTS =====
# Individual seller data access for Manager AND Gérant roles
# These endpoints require store context verification

@router.get("/kpi-entries/{seller_id}")
async def get_seller_kpi_entries(
    seller_id: str,
    days: int = Query(30, description="Number of days to fetch"),
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
    store_id: Optional[str] = Query(None, description="Store ID (requis pour gérant)"),
    context: dict = Depends(get_store_context),
    db = Depends(get_db)
):
    """
    Get KPI entries for a specific seller.
    
    Accessible by both Manager and Gérant roles.
    Gérant must provide store_id and seller must belong to that store.
    
    Returns list of KPI entries sorted by date descending.
    """
    try:
        resolved_store_id = context.get('resolved_store_id')
        
        # Verify seller belongs to the store (security check)
        seller = await db.users.find_one(
            {"id": seller_id, "store_id": resolved_store_id, "role": "seller"},
            {"_id": 0, "id": 1, "name": 1}
        )
        
        if not seller:
            raise HTTPException(
                status_code=404, 
                detail="Vendeur non trouvé ou n'appartient pas à ce magasin"
            )
        
        # Build date filter
        query = {"seller_id": seller_id}
        
        if start_date and end_date:
            query["date"] = {"$gte": start_date, "$lte": end_date}
        else:
            # Use days parameter
            end_dt = datetime.now(timezone.utc)
            start_dt = end_dt - timedelta(days=days)
            query["date"] = {
                "$gte": start_dt.strftime('%Y-%m-%d'),
                "$lte": end_dt.strftime('%Y-%m-%d')
            }
        
        # Fetch KPI entries
        entries = await db.kpi_entries.find(
            query,
            {"_id": 0}
        ).sort("date", -1).to_list(1000)
        
        return entries
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/seller/{seller_id}/stats")
async def get_seller_stats(
    seller_id: str,
    days: int = Query(30, description="Number of days for stats calculation"),
    store_id: Optional[str] = Query(None, description="Store ID (requis pour gérant)"),
    context: dict = Depends(get_store_context),
    db = Depends(get_db)
):
    """
    Get aggregated statistics for a specific seller.
    
    Returns: total CA, total sales, average basket, conversion rate, etc.
    """
    try:
        resolved_store_id = context.get('resolved_store_id')
        
        # Verify seller belongs to the store
        seller = await db.users.find_one(
            {"id": seller_id, "store_id": resolved_store_id, "role": "seller"},
            {"_id": 0, "id": 1, "name": 1, "status": 1, "created_at": 1}
        )
        
        if not seller:
            raise HTTPException(
                status_code=404, 
                detail="Vendeur non trouvé ou n'appartient pas à ce magasin"
            )
        
        # Calculate date range
        end_dt = datetime.now(timezone.utc)
        start_dt = end_dt - timedelta(days=days)
        start_date = start_dt.strftime('%Y-%m-%d')
        end_date = end_dt.strftime('%Y-%m-%d')
        
        # Aggregate KPIs
        pipeline = [
            {"$match": {
                "seller_id": seller_id,
                "date": {"$gte": start_date, "$lte": end_date}
            }},
            {"$group": {
                "_id": None,
                "total_ca": {"$sum": {"$ifNull": ["$seller_ca", {"$ifNull": ["$ca_journalier", 0]}]}},
                "total_ventes": {"$sum": {"$ifNull": ["$nb_ventes", 0]}},
                "total_clients": {"$sum": {"$ifNull": ["$nb_clients", 0]}},
                "total_articles": {"$sum": {"$ifNull": ["$nb_articles", 0]}},
                "total_prospects": {"$sum": {"$ifNull": ["$nb_prospects", 0]}},
                "entries_count": {"$sum": 1}
            }}
        ]
        
        result = await db.kpi_entries.aggregate(pipeline).to_list(1)
        
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
                "uvc": round(total_articles / total_ventes, 2) if total_ventes > 0 else 0
            }
        else:
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
                "uvc": 0
            }
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/seller/{seller_id}/diagnostic")
async def get_seller_diagnostic(
    seller_id: str,
    store_id: Optional[str] = Query(None, description="Store ID (requis pour gérant)"),
    context: dict = Depends(get_store_context),
    db = Depends(get_db)
):
    """
    Get DISC diagnostic profile for a specific seller.
    
    Returns the seller's behavioral profile and recommendations.
    """
    try:
        resolved_store_id = context.get('resolved_store_id')
        
        # Verify seller belongs to the store
        seller = await db.users.find_one(
            {"id": seller_id, "store_id": resolved_store_id, "role": "seller"},
            {"_id": 0, "id": 1, "name": 1}
        )
        
        if not seller:
            raise HTTPException(
                status_code=404, 
                detail="Vendeur non trouvé ou n'appartient pas à ce magasin"
            )
        
        # Fetch diagnostic
        diagnostic = await db.diagnostics.find_one(
            {"seller_id": seller_id},
            {"_id": 0}
        )
        
        if not diagnostic:
            # Return default profile if no diagnostic exists
            return {
                "seller_id": seller_id,
                "seller_name": seller.get("name", "Unknown"),
                "has_diagnostic": False,
                "style": "Non défini",
                "level": 0,
                "strengths": [],
                "weaknesses": [],
                "recommendations": []
            }
        
        return {
            "seller_id": seller_id,
            "seller_name": seller.get("name", "Unknown"),
            "has_diagnostic": True,
            **diagnostic
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/sellers/archived")
async def get_archived_sellers(
    store_id: Optional[str] = Query(None, description="Store ID (requis pour gérant)"),
    context: dict = Depends(get_store_context),
    db = Depends(get_db)
):
    """
    Get list of suspended (en veille) sellers for the store.
    
    Only returns sellers with status 'suspended' - NOT deleted sellers.
    Deleted sellers are permanently hidden.
    """
    try:
        resolved_store_id = context.get('resolved_store_id')
        
        # Fetch only suspended sellers (en veille), NOT deleted ones
        suspended_sellers = await db.users.find(
            {
                "store_id": resolved_store_id,
                "role": "seller",
                "status": "suspended"  # Only suspended, not deleted or archived
            },
            {"_id": 0, "password": 0}
        ).sort("updated_at", -1).to_list(100)
        
        return suspended_sellers
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ===== ADDITIONAL SELLER MANAGEMENT ROUTES =====

@router.get("/seller/{seller_id}/kpi-history")
async def get_seller_kpi_history(
    seller_id: str,
    days: int = Query(90, description="Number of days"),
    store_id: Optional[str] = Query(None, description="Store ID (requis pour gérant)"),
    context: dict = Depends(get_store_context),
    db = Depends(get_db)
):
    """
    Get detailed KPI history for a seller with daily breakdown.
    Used for charts and trend analysis.
    """
    try:
        resolved_store_id = context.get('resolved_store_id')
        
        # Verify seller belongs to the store
        seller = await db.users.find_one(
            {"id": seller_id, "store_id": resolved_store_id, "role": "seller"},
            {"_id": 0, "id": 1, "name": 1}
        )
        
        if not seller:
            raise HTTPException(
                status_code=404, 
                detail="Vendeur non trouvé ou n'appartient pas à ce magasin"
            )
        
        # Calculate date range
        end_dt = datetime.now(timezone.utc)
        start_dt = end_dt - timedelta(days=days)
        
        # Fetch daily KPIs
        entries = await db.kpi_entries.find(
            {
                "seller_id": seller_id,
                "date": {
                    "$gte": start_dt.strftime('%Y-%m-%d'),
                    "$lte": end_dt.strftime('%Y-%m-%d')
                }
            },
            {"_id": 0}
        ).sort("date", 1).to_list(1000)
        
        return {
            "seller_id": seller_id,
            "seller_name": seller.get("name", "Unknown"),
            "period": {
                "start": start_dt.strftime('%Y-%m-%d'),
                "end": end_dt.strftime('%Y-%m-%d'),
                "days": days
            },
            "entries": entries,
            "entries_count": len(entries)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/seller/{seller_id}/profile")
async def get_seller_profile(
    seller_id: str,
    store_id: Optional[str] = Query(None, description="Store ID (requis pour gérant)"),
    context: dict = Depends(get_store_context),
    db = Depends(get_db)
):
    """
    Get complete seller profile including diagnostic and recent performance.
    """
    try:
        resolved_store_id = context.get('resolved_store_id')
        
        # Fetch seller
        seller = await db.users.find_one(
            {"id": seller_id, "store_id": resolved_store_id, "role": "seller"},
            {"_id": 0, "password": 0}
        )
        
        if not seller:
            raise HTTPException(
                status_code=404, 
                detail="Vendeur non trouvé ou n'appartient pas à ce magasin"
            )
        
        # Fetch diagnostic
        diagnostic = await db.diagnostics.find_one(
            {"seller_id": seller_id},
            {"_id": 0}
        )
        
        # Get recent KPIs summary (last 7 days)
        end_dt = datetime.now(timezone.utc)
        start_dt = end_dt - timedelta(days=7)
        
        recent_kpis = await db.kpi_entries.find(
            {
                "seller_id": seller_id,
                "date": {"$gte": start_dt.strftime('%Y-%m-%d')}
            },
            {"_id": 0}
        ).sort("date", -1).to_list(7)
        
        return {
            **seller,
            "diagnostic": diagnostic,
            "recent_kpis": recent_kpis
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



# ===== TEAM AI ANALYSIS ENDPOINTS =====

@router.get("/team-analyses-history")
async def get_team_analyses_history(
    store_id: Optional[str] = Query(None, description="Store ID (requis pour gérant)"),
    context: dict = Depends(get_store_context),
    db = Depends(get_db)
):
    """
    Get history of team AI analyses for this store.
    """
    try:
        resolved_store_id = context.get('resolved_store_id')
        
        # Fetch analyses history
        analyses = await db.team_analyses.find(
            {"store_id": resolved_store_id},
            {"_id": 0}
        ).sort("generated_at", -1).to_list(50)
        
        return {"analyses": analyses}
        
    except Exception as e:
        logger.error(f"Error loading team analyses history: {e}")
        return {"analyses": []}


@router.post("/analyze-team")
async def analyze_team(
    analysis_data: dict,
    store_id: Optional[str] = Query(None, description="Store ID (requis pour gérant)"),
    context: dict = Depends(get_store_context),
    db = Depends(get_db)
):
    """
    Generate AI-powered analysis of team performance.
    
    🏺 LEGACY RESTORED - Uses GPT-4o with expert retail management prompts
    
    Analyzes seller KPIs, identifies top performers, areas for improvement,
    and provides actionable recommendations.
    """
    from services.ai_service import AIService
    from uuid import uuid4
    
    try:
        resolved_store_id = context.get('resolved_store_id')
        manager_id = context.get('id')
        
        # Get team data from request
        team_data = analysis_data.get('team_data', {})
        period_filter = analysis_data.get('period_filter', '30')
        start_date = analysis_data.get('start_date')
        end_date = analysis_data.get('end_date')
        
        # Calculate period
        today = datetime.now(timezone.utc)
        
        if period_filter == 'custom' and start_date and end_date:
            period_start = start_date
            period_end = end_date
            period_label = f"du {start_date} au {end_date}"
        elif period_filter == 'all':
            period_start = (today - timedelta(days=365)).strftime('%Y-%m-%d')
            period_end = today.strftime('%Y-%m-%d')
            period_label = "sur l'année"
        elif period_filter == '90':
            period_start = (today - timedelta(days=90)).strftime('%Y-%m-%d')
            period_end = today.strftime('%Y-%m-%d')
            period_label = "sur 3 mois"
        elif period_filter == '7':
            period_start = (today - timedelta(days=7)).strftime('%Y-%m-%d')
            period_end = today.strftime('%Y-%m-%d')
            period_label = "sur 7 jours"
        else:  # default '30'
            days = int(period_filter) if period_filter.isdigit() else 30
            period_start = (today - timedelta(days=days)).strftime('%Y-%m-%d')
            period_end = today.strftime('%Y-%m-%d')
            period_label = f"sur {days} jours"
        
        # Initialize AI service (Legacy Restored with GPT-4o)
        ai_service = AIService()
        
        # 🎯 Use the restored generate_team_analysis method with GPT-4o
        analysis_text = await ai_service.generate_team_analysis(
            team_data=team_data,
            period_label=period_label,
            manager_id=manager_id
        )
        
        # Extract stats for storage
        total_sellers = team_data.get('total_sellers', 0)
        team_total_ca = team_data.get('team_total_ca', 0)
        team_total_ventes = team_data.get('team_total_ventes', 0)
        
        # Save analysis to history
        analysis_record = {
            "id": str(uuid4()),
            "store_id": resolved_store_id,
            "manager_id": manager_id,
            "period_start": period_start,
            "period_end": period_end,
            "analysis": analysis_text,
            "team_stats": {
                "total_sellers": total_sellers,
                "team_total_ca": team_total_ca,
                "team_total_ventes": team_total_ventes
            },
            "generated_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.team_analyses.insert_one(analysis_record)
        
        return {
            "analysis": analysis_text,
            "period_start": period_start,
            "period_end": period_end,
            "generated_at": analysis_record["generated_at"]
        }
        
    except Exception as e:
        logger.error(f"Error analyzing team: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/team-analysis/{analysis_id}")
async def delete_team_analysis(
    analysis_id: str,
    store_id: Optional[str] = Query(None, description="Store ID (requis pour gérant)"),
    context: dict = Depends(get_store_context),
    db = Depends(get_db)
):
    """Delete a team analysis from history."""
    try:
        resolved_store_id = context.get('resolved_store_id')
        
        result = await db.team_analyses.delete_one(
            {"id": analysis_id, "store_id": resolved_store_id}
        )
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Analyse non trouvée")
        
        return {"success": True, "message": "Analyse supprimée"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



# ===== RELATIONSHIP ADVICE ENDPOINTS =====
# 🏺 LEGACY RESTORED - AI-powered relationship and conflict management

from pydantic import BaseModel

class RelationshipAdviceRequest(BaseModel):
    seller_id: str
    advice_type: str  # "relationnel" or "conflit"
    situation_type: str  # "augmentation", "conflit_equipe", "demotivation", etc.
    description: str


@router.post("/relationship-advice")
async def get_relationship_advice(
    request: RelationshipAdviceRequest,
    store_id: Optional[str] = Query(None, description="Store ID (requis pour gérant)"),
    context: dict = Depends(get_store_context),
    db = Depends(get_db)
):
    """
    Generate AI-powered relationship/conflict management advice for managers.
    
    🏺 LEGACY RESTORED - Uses GPT-4o with manager & seller profiles
    
    Uses manager profile, seller profile, KPIs, and recent debriefs
    to provide personalized advice.
    """
    from services.ai_service import AIService
    from uuid import uuid4
    import json
    
    try:
        resolved_store_id = context.get('resolved_store_id')
        manager_id = context.get('id')
        current_user = context
        
        # Get seller info
        seller = await db.users.find_one(
            {"id": request.seller_id, "store_id": resolved_store_id},
            {"_id": 0, "password": 0}
        )
        if not seller:
            raise HTTPException(status_code=404, detail="Vendeur non trouvé")
        
        # Get manager profile
        manager_diagnostic = await db.manager_diagnostic_results.find_one(
            {"manager_id": manager_id},
            {"_id": 0}
        )
        
        # Get seller profile
        seller_diagnostic = await db.diagnostics.find_one(
            {"seller_id": request.seller_id},
            {"_id": 0}
        )
        
        # Get seller KPIs (last 30 days)
        thirty_days_ago = (datetime.now(timezone.utc) - timedelta(days=30)).strftime('%Y-%m-%d')
        kpi_entries = await db.kpi_entries.find(
            {
                "seller_id": request.seller_id,
                "date": {"$gte": thirty_days_ago}
            },
            {"_id": 0}
        ).to_list(100)
        
        # Get recent shared debriefs (last 5)
        recent_debriefs = await db.debriefs.find(
            {
                "seller_id": request.seller_id,
                "shared_with_manager": True
            },
            {"_id": 0}
        ).sort("created_at", -1).limit(5).to_list(5)
        
        # Prepare data summary for AI
        kpi_summary = f"KPIs sur les 30 derniers jours : {len(kpi_entries)} entrées"
        if kpi_entries:
            total_ca = sum(entry.get('ca_journalier', 0) or entry.get('ca', 0) for entry in kpi_entries)
            total_ventes = sum(entry.get('nb_ventes', 0) or entry.get('ventes', 0) for entry in kpi_entries)
            kpi_summary += f"\n- CA total : {total_ca:.2f}€\n- Ventes totales : {total_ventes}"
        
        debrief_summary = f"{len(recent_debriefs)} debriefs récents"
        if recent_debriefs:
            debrief_summary += ":\n" + "\n".join([
                f"- {d.get('date', 'Date inconnue')}: {d.get('summary', d.get('analyse', 'Pas de résumé'))[:100]}"
                for d in recent_debriefs
            ])
        
        # Build AI prompt
        advice_type_fr = "relationnelle" if request.advice_type == "relationnel" else "de conflit"
        
        system_message = f"""Tu es un expert en management d'équipe retail et en gestion {advice_type_fr}.
Tu dois fournir des conseils personnalisés basés sur les profils de personnalité et les performances."""

        user_prompt = f"""# Situation {advice_type_fr.upper()}

**Type de situation :** {request.situation_type}
**Description :** {request.description}

## Contexte Manager
**Prénom :** {current_user.get('first_name', current_user.get('name', 'Manager'))}
**Profil de personnalité :** {json.dumps(manager_diagnostic.get('profile', {}), ensure_ascii=False) if manager_diagnostic else 'Non disponible'}

## Contexte Vendeur
**Prénom :** {seller.get('first_name', seller.get('name', 'Vendeur'))}
**Statut :** {seller.get('status', 'actif')}
**Profil de personnalité :** {json.dumps(seller_diagnostic.get('profile', {}), ensure_ascii=False) if seller_diagnostic else 'Non disponible'}

## Performances
{kpi_summary}

## Debriefs récents
{debrief_summary}

# Ta mission
Fournis une recommandation CONCISE et ACTIONNABLE (maximum 400 mots) structurée avec :

## Analyse de la situation (2-3 phrases max)
- Diagnostic rapide en tenant compte des profils de personnalité

## Conseils pratiques (3 actions concrètes max)
- Actions spécifiques et immédiatement applicables
- Adaptées aux profils de personnalité

## Phrases clés (2-3 phrases max)
- Formulations précises adaptées au profil du vendeur

## Points de vigilance (2 points max)
- Ce qu'il faut éviter compte tenu des profils

IMPORTANT : Sois CONCIS, DIRECT et PRATIQUE. Évite les longues explications théoriques."""

        # Initialize AI service
        ai_service = AIService()
        
        if not ai_service.available:
            raise HTTPException(status_code=503, detail="Service IA non disponible")
        
        # Use GPT-4o for relationship advice
        chat = ai_service._create_chat(
            session_id=f"relationship_{manager_id}_{request.seller_id}_{datetime.now(timezone.utc).isoformat()}",
            system_message=system_message,
            model="gpt-4o"
        )
        
        ai_response = await ai_service._send_message(chat, user_prompt)
        
        if not ai_response:
            raise HTTPException(status_code=500, detail="Erreur lors de la génération du conseil")
        
        # Save to history
        consultation_id = str(uuid4())
        seller_name = f"{seller.get('first_name', '')} {seller.get('last_name', '')}".strip() or seller.get('name', 'Vendeur')
        
        consultation = {
            "id": consultation_id,
            "store_id": resolved_store_id,
            "manager_id": manager_id,
            "seller_id": request.seller_id,
            "seller_name": seller_name,
            "seller_status": seller.get('status', 'active'),
            "advice_type": request.advice_type,
            "situation_type": request.situation_type,
            "description": request.description,
            "recommendation": ai_response,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.relationship_consultations.insert_one(consultation)
        
        return {
            "consultation_id": consultation_id,
            "recommendation": ai_response,
            "seller_name": seller_name
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating relationship advice: {e}")
        raise HTTPException(status_code=500, detail=f"Erreur: {str(e)}")


@router.get("/relationship-history")
async def get_relationship_history(
    seller_id: Optional[str] = Query(None, description="Filter by seller ID"),
    store_id: Optional[str] = Query(None, description="Store ID (requis pour gérant)"),
    context: dict = Depends(get_store_context),
    db = Depends(get_db)
):
    """
    Get manager's relationship consultation history.
    
    Optionally filter by seller_id.
    """
    try:
        resolved_store_id = context.get('resolved_store_id')
        manager_id = context.get('id')
        
        # Build query
        query = {"manager_id": manager_id, "store_id": resolved_store_id}
        if seller_id:
            query["seller_id"] = seller_id
        
        # Get consultations
        consultations = await db.relationship_consultations.find(
            query,
            {"_id": 0}
        ).sort("created_at", -1).to_list(100)
        
        return {"consultations": consultations}
        
    except Exception as e:
        logger.error(f"Error fetching relationship history: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/relationship-consultation/{consultation_id}")
async def delete_relationship_consultation(
    consultation_id: str,
    store_id: Optional[str] = Query(None, description="Store ID (requis pour gérant)"),
    context: dict = Depends(get_store_context),
    db = Depends(get_db)
):
    """Delete a relationship consultation from history."""
    try:
        resolved_store_id = context.get('resolved_store_id')
        manager_id = context.get('id')
        
        result = await db.relationship_consultations.delete_one(
            {"id": consultation_id, "manager_id": manager_id, "store_id": resolved_store_id}
        )
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Consultation non trouvée")
        
        return {"success": True, "message": "Consultation supprimée"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



# ===== SELLER DETAILS ENDPOINTS (for Manager/Gérant viewing seller profiles) =====

@router.get("/debriefs/{seller_id}")
async def get_seller_debriefs(
    seller_id: str,
    store_id: Optional[str] = Query(None, description="Store ID (requis pour gérant)"),
    context: dict = Depends(get_store_context),
    db = Depends(get_db)
):
    """
    Get all debriefs for a specific seller
    Accessible to managers (same store) and gérants (owner of seller's store)
    """
    try:
        user_role = context.get('role')
        user_id = context.get('id')
        resolved_store_id = context.get('resolved_store_id')
        
        # Get seller info
        seller = await db.users.find_one({
            "id": seller_id,
            "role": "seller"
        }, {"_id": 0})
        
        if not seller:
            raise HTTPException(status_code=404, detail="Vendeur non trouvé")
        
        seller_store_id = seller.get('store_id')
        
        # Check access rights
        has_access = False
        
        if user_role == 'manager':
            # Manager can only see sellers from their own store
            has_access = (seller_store_id == resolved_store_id)
        elif user_role in ['gerant', 'gérant']:
            # Gérant can see sellers from any store they own
            store = await db.stores.find_one({
                "id": seller_store_id,
                "gerant_id": user_id,
                "active": True
            })
            has_access = store is not None
        
        if not has_access:
            raise HTTPException(status_code=403, detail="Accès non autorisé à ce vendeur")
        
        # Get all debriefs for this seller
        debriefs = await db.debriefs.find(
            {"seller_id": seller_id},
            {"_id": 0}
        ).sort("created_at", -1).to_list(1000)
        
        return debriefs
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/competences-history/{seller_id}")
async def get_seller_competences_history(
    seller_id: str,
    store_id: Optional[str] = Query(None, description="Store ID (requis pour gérant)"),
    context: dict = Depends(get_store_context),
    db = Depends(get_db)
):
    """
    Get seller's competences evolution history
    Accessible to managers (same store) and gérants (owner of seller's store)
    """
    try:
        user_role = context.get('role')
        user_id = context.get('id')
        resolved_store_id = context.get('resolved_store_id')
        
        # Get seller info
        seller = await db.users.find_one({
            "id": seller_id,
            "role": "seller"
        }, {"_id": 0})
        
        if not seller:
            raise HTTPException(status_code=404, detail="Vendeur non trouvé")
        
        seller_store_id = seller.get('store_id')
        
        # Check access rights
        has_access = False
        
        if user_role == 'manager':
            has_access = (seller_store_id == resolved_store_id)
        elif user_role in ['gerant', 'gérant']:
            store = await db.stores.find_one({
                "id": seller_store_id,
                "gerant_id": user_id,
                "active": True
            })
            has_access = store is not None
        
        if not has_access:
            raise HTTPException(status_code=403, detail="Accès non autorisé à ce vendeur")
        
        history = []
        
        # Get diagnostic (initial scores)
        diagnostic = await db.diagnostics.find_one({"seller_id": seller_id}, {"_id": 0})
        if diagnostic:
            history.append({
                "type": "diagnostic",
                "date": diagnostic.get('created_at'),
                "score_accueil": diagnostic.get('score_accueil', 3.0),
                "score_decouverte": diagnostic.get('score_decouverte', 3.0),
                "score_argumentation": diagnostic.get('score_argumentation', 3.0),
                "score_closing": diagnostic.get('score_closing', 3.0),
                "score_fidelisation": diagnostic.get('score_fidelisation', 3.0)
            })
        
        # Get all debriefs (evolution over time)
        debriefs = await db.debriefs.find(
            {"seller_id": seller_id},
            {"_id": 0}
        ).sort("created_at", 1).to_list(1000)
        
        for debrief in debriefs:
            history.append({
                "type": "debrief",
                "date": debrief.get('created_at'),
                "score_accueil": debrief.get('score_accueil', 3.0),
                "score_decouverte": debrief.get('score_decouverte', 3.0),
                "score_argumentation": debrief.get('score_argumentation', 3.0),
                "score_closing": debrief.get('score_closing', 3.0),
                "score_fidelisation": debrief.get('score_fidelisation', 3.0)
            })
        
        return history
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
