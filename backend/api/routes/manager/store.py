"""
Manager - Store: configuration magasin, sync mode, KPI config, store KPI overview, manager KPI, team bilans, API keys, subscription.
"""
from datetime import datetime, timezone, timedelta
import logging
from typing import Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, Query

from core.constants import ERR_ACCES_REFUSE_MAGASIN_NON_ASSIGNE, QUERY_STORE_ID_REQUIS_GERANT
from core.exceptions import AppException, NotFoundError, ValidationError, ForbiddenError
from core.security import verify_manager_or_gerant
from models.kpi_config import get_default_kpi_config
from models.pagination import PaginatedResponse, PaginationParams
from api.routes.manager.dependencies import get_store_context, get_store_context_required, get_store_context_with_seller
from api.dependencies import (
    get_manager_store_service,
    get_manager_service,
    get_gerant_service,
    get_api_key_service,
)
from services.manager import ManagerStoreService
from services.manager_service import ManagerService, APIKeyService
from services.gerant_service import GerantService

router = APIRouter(prefix="")
logger = logging.getLogger(__name__)


@router.get("/test")
async def test_endpoint():
    """Test endpoint to verify manager router is registered."""
    return {"status": "ok", "message": "Manager router is working", "router_prefix": "/manager"}


# ===== SUBSCRIPTION =====

@router.get("/subscription-status")
async def get_subscription_status(
    store_id: Optional[str] = Query(None, description=QUERY_STORE_ID_REQUIS_GERANT),
    context: dict = Depends(get_store_context),
    gerant_service: GerantService = Depends(get_gerant_service),
):
    """
    Check subscription status for access control.
    Returns isReadOnly: true if trial expired.
    En cas d'erreur, l'exception est propagée (4xx/5xx).
    """
    role = context.get("role")
    if role in ["gerant", "gérant"]:
        workspace_id = context.get("workspace_id")
        if workspace_id:
            workspace = await gerant_service.get_workspace_by_id(workspace_id)
            if workspace:
                subscription_status = workspace.get("subscription_status", "inactive")
                if subscription_status == "active":
                    return {"isReadOnly": False, "status": "active", "message": "Abonnement actif", "viewMode": "gerant"}
                elif subscription_status == "trialing":
                    trial_end = workspace.get("trial_end")
                    if trial_end:
                        if isinstance(trial_end, str):
                            trial_end_dt = datetime.fromisoformat(trial_end.replace("Z", "+00:00"))
                        else:
                            trial_end_dt = trial_end
                        now = datetime.now(timezone.utc)
                        if trial_end_dt.tzinfo is None:
                            trial_end_dt = trial_end_dt.replace(tzinfo=timezone.utc)
                        if now < trial_end_dt:
                            days_left = (trial_end_dt - now).days
                            return {"isReadOnly": False, "status": "trialing", "daysLeft": days_left, "viewMode": "gerant"}
        return {"isReadOnly": False, "status": "gerant_access", "message": "Accès gérant", "viewMode": "gerant"}

    gerant_id = context.get("gerant_id")
    if not gerant_id:
        return {"isReadOnly": True, "status": "no_gerant", "message": "Aucun gérant associé"}
    gerant = await gerant_service.get_gerant_by_id(gerant_id, include_password=False)
    if not gerant:
        return {"isReadOnly": True, "status": "gerant_not_found", "message": "Gérant non trouvé"}
    workspace_id = gerant.get("workspace_id")
    if not workspace_id:
        return {"isReadOnly": True, "status": "no_workspace", "message": "Aucun espace de travail"}
    workspace = await gerant_service.get_workspace_by_id(workspace_id)
    if not workspace:
        return {"isReadOnly": True, "status": "workspace_not_found", "message": "Espace de travail non trouvé"}
    subscription_status = workspace.get("subscription_status", "inactive")
    if subscription_status == "active":
        return {"isReadOnly": False, "status": "active", "message": "Abonnement actif"}
    if subscription_status == "trialing":
        trial_end = workspace.get("trial_end")
        if trial_end:
            if isinstance(trial_end, str):
                trial_end_dt = datetime.fromisoformat(trial_end.replace("Z", "+00:00"))
            else:
                trial_end_dt = trial_end
            now = datetime.now(timezone.utc)
            if trial_end_dt.tzinfo is None:
                trial_end_dt = trial_end_dt.replace(tzinfo=timezone.utc)
            if now < trial_end_dt:
                days_left = (trial_end_dt - now).days
                return {"isReadOnly": False, "status": "trialing", "message": f"Essai gratuit - {days_left} jours restants", "daysLeft": days_left}
    return {"isReadOnly": True, "status": "trial_expired", "message": "Période d'essai terminée. Contactez votre administrateur."}


# ===== SYNC MODE =====

@router.get("/sync-mode")
async def get_sync_mode(
    store_id: Optional[str] = Query(None, description=QUERY_STORE_ID_REQUIS_GERANT),
    context: dict = Depends(get_store_context_with_seller),
    store_service: ManagerStoreService = Depends(get_manager_store_service),
):
    """Get sync mode configuration for the store. Accessible by Manager, Gérant, Seller."""
    try:
        resolved_store_id = context.get("resolved_store_id")
        if not resolved_store_id:
            return {
                "sync_mode": "manual",
                "external_sync_enabled": False,
                "is_enterprise": False,
                "can_edit_kpi": True,
                "can_edit_objectives": True,
            }
        config = await store_service.get_sync_mode(resolved_store_id)
        return config
    except AppException:
        raise


# ===== STORE KPI OVERVIEW & DATES =====

@router.get("/store-kpi-overview")
async def get_store_kpi_overview(
    date: str = Query(None),
    store_id: Optional[str] = Query(None, description=QUERY_STORE_ID_REQUIS_GERANT),
    context: dict = Depends(get_store_context_required),
    gerant_service: GerantService = Depends(get_gerant_service),
):
    """Get KPI overview for manager's store on a specific date. Delegates to GerantService.get_store_kpi_overview."""
    resolved_store_id = context["resolved_store_id"]
    target_date = date or datetime.now(timezone.utc).strftime("%Y-%m-%d")
    user_id = context.get("id")
    try:
        overview = await gerant_service.get_store_kpi_overview(
            store_id=resolved_store_id, user_id=user_id, date=target_date
        )
    except ValueError as e:
        raise NotFoundError(str(e))
    except Exception as e:
        logger.exception("store-kpi-overview unexpected error: %s", e)
        return _empty_overview_response(target_date, resolved_store_id)
    # Retourner la même structure que la route gérant / le frontend attend (totals.ventes, calculated_kpis, sellers_reported, total_sellers, seller_entries, etc.)
    overview["date"] = target_date
    overview["store_id"] = resolved_store_id
    return overview


def _empty_overview_response(target_date: str, resolved_store_id: str):
    """Réponse vide pour erreur, format attendu par le frontend (DailyKPICards, StoreKPIModalDailyTab)."""
    return {
        "date": target_date,
        "store_id": resolved_store_id,
        "totals": {"ca": 0, "ventes": 0, "clients": 0, "articles": 0, "prospects": 0},
        "calculated_kpis": {"panier_moyen": None, "taux_transformation": None, "indice_vente": None},
        "sellers_reported": 0,
        "total_sellers": 0,
        "seller_entries": [],
        "managers_data": {},
        "sellers_data": {},
    }


@router.get("/dates-with-data")
async def get_dates_with_data(
    year: int = Query(None),
    month: int = Query(None),
    store_id: Optional[str] = Query(None, description=QUERY_STORE_ID_REQUIS_GERANT),
    context: dict = Depends(get_store_context),
    manager_service: ManagerService = Depends(get_manager_service),
):
    """Get list of dates that have KPI data for the store (calendar highlighting)."""
    resolved_store_id = context.get("resolved_store_id")
    query = {"store_id": resolved_store_id}
    if year and month:
        start_date = f"{year}-{month:02d}-01"
        end_date = f"{year + 1}-01-01" if month == 12 else f"{year}-{month + 1:02d}-01"
        query["date"] = {"$gte": start_date, "$lt": end_date}
    dates = await manager_service.get_kpi_distinct_dates(query)
    manager_dates = await manager_service.get_manager_kpi_distinct_dates(query)
    all_dates = sorted(set(dates) | set(manager_dates))
    locked_dates = await manager_service.get_kpi_distinct_dates({**query, "locked": True})
    return {"dates": all_dates, "lockedDates": sorted(locked_dates)}


@router.get("/available-years")
async def get_available_years(
    store_id: Optional[str] = Query(None, description=QUERY_STORE_ID_REQUIS_GERANT),
    context: dict = Depends(get_store_context),
    manager_service: ManagerService = Depends(get_manager_service),
):
    """Get list of years that have KPI data for the store."""
    resolved_store_id = context.get("resolved_store_id")
    dates = await manager_service.get_kpi_distinct_dates({"store_id": resolved_store_id})
    manager_dates = await manager_service.get_manager_kpi_distinct_dates({"store_id": resolved_store_id})
    all_dates = set(dates) | set(manager_dates)
    years = set()
    for date_str in all_dates:
        if date_str and len(date_str) >= 4:
            try:
                years.add(int(date_str[:4]))
            except ValueError:
                pass
    return {"years": sorted(list(years), reverse=True)}


# ===== KPI CONFIG =====

@router.get("/kpi-config")
async def get_kpi_config(
    store_id: Optional[str] = Query(None, description=QUERY_STORE_ID_REQUIS_GERANT),
    context: dict = Depends(get_store_context),
    store_service: ManagerStoreService = Depends(get_manager_store_service),
):
    """Get KPI configuration for the store."""
    try:
        resolved_store_id = context.get("resolved_store_id") or store_id
        if not resolved_store_id:
            return get_default_kpi_config()
        config = await store_service.get_kpi_config(resolved_store_id)
        if not config:
            return get_default_kpi_config(resolved_store_id)
        return config
    except AppException as e:
        logger.error("[KPI-CONFIG] AppException: %s - %s", e.status_code, e.detail)
        raise
    except Exception as e:
        logger.error("[KPI-CONFIG] Error: %s", e, exc_info=True)
        return get_default_kpi_config()


@router.put("/kpi-config")
async def update_kpi_config(
    config_update: dict,
    store_id: Optional[str] = Query(None, description=QUERY_STORE_ID_REQUIS_GERANT),
    context: dict = Depends(get_store_context),
    store_service: ManagerStoreService = Depends(get_manager_store_service),
):
    """Update KPI configuration for the store."""
    try:
        resolved_store_id = context.get("resolved_store_id") or store_id
        manager_id = context.get("id")
        if not resolved_store_id and not manager_id:
            raise ValidationError("Store ID ou Manager ID requis")
        update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
        if "enabled" in config_update:
            update_data["enabled"] = update_data["saisie_enabled"] = config_update["enabled"]
        if "saisie_enabled" in config_update:
            update_data["saisie_enabled"] = update_data["enabled"] = config_update["saisie_enabled"]
        for field in ["seller_track_ca", "manager_track_ca", "seller_track_ventes", "manager_track_ventes", "seller_track_clients", "manager_track_clients", "seller_track_articles", "manager_track_articles", "seller_track_prospects", "manager_track_prospects"]:
            if field in config_update:
                update_data[field] = config_update[field]
        config = await store_service.upsert_kpi_config(resolved_store_id, manager_id, update_data)
        return config or {"store_id": resolved_store_id, "enabled": update_data.get("enabled", True), "saisie_enabled": update_data.get("saisie_enabled", True)}
    except AppException:
        raise


# ===== MANAGER KPI & TEAM BILANS =====

@router.get("/manager-kpi")
async def get_manager_kpis(
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
    store_id: Optional[str] = Query(None, description=QUERY_STORE_ID_REQUIS_GERANT),
    pagination: PaginationParams = Depends(),
    context: dict = Depends(get_store_context),
    manager_service: ManagerService = Depends(get_manager_service),
):
    """Get manager KPI entries for a date range (pagination)."""
    resolved_store_id = context.get("resolved_store_id") or store_id
    if not resolved_store_id:
        return PaginatedResponse(items=[], total=0, page=1, size=pagination.size, pages=0)
    if not start_date or not end_date:
        today = datetime.now(timezone.utc)
        end_date = end_date or today.strftime("%Y-%m-%d")
        start_date = start_date or (today - timedelta(days=30)).strftime("%Y-%m-%d")
    return await manager_service.get_manager_kpis_paginated(
        store_id=resolved_store_id,
        start_date=start_date,
        end_date=end_date,
        page=pagination.page,
        size=pagination.size,
    )


@router.post("/manager-kpi")
async def save_manager_kpi(
    kpi_data: dict,
    store_id: Optional[str] = Query(None, description=QUERY_STORE_ID_REQUIS_GERANT),
    context: dict = Depends(get_store_context),
    manager_service: ManagerService = Depends(get_manager_service),
):
    """Save manager KPI entries (sellers_data and/or nb_prospects)."""
    resolved_store_id = context.get("resolved_store_id") or store_id
    manager_id = context.get("id")
    role = context.get("role")
    if not resolved_store_id:
        raise ValidationError("Store ID requis. Veuillez fournir ?store_id=xxx" if role in ["gerant", "gérant"] else "Store ID requis.")
    store = await manager_service.get_store_by_id_simple(
        resolved_store_id, projection={"_id": 0, "id": 1, "name": 1, "gerant_id": 1, "active": 1}
    )
    if not store or not store.get("active"):
        raise NotFoundError(f"Magasin {resolved_store_id} non trouvé ou inactif")
    if role in ["gerant", "gérant"] and store.get("gerant_id") != manager_id:
        raise ForbiddenError("Accès refusé : ce magasin ne vous appartient pas")
    if role == "manager" and context.get("store_id") != resolved_store_id:
        raise ForbiddenError(ERR_ACCES_REFUSE_MAGASIN_NON_ASSIGNE)
    date = kpi_data.get("date", datetime.now(timezone.utc).strftime("%Y-%m-%d"))
    locked_entries = await manager_service.get_kpi_entries_locked_or_api(resolved_store_id, date, limit=1)
    if locked_entries:
        raise ForbiddenError("Cette date est verrouillée (données API/ERP).")
    results = {"sellers_entries": [], "prospects_entry": None}
    sellers_data = kpi_data.get("sellers_data", [])
    if sellers_data and not isinstance(sellers_data, list):
        raise ValidationError("Le champ 'sellers_data' doit être un tableau.")
    if sellers_data:
        seller_ids = [s.get("seller_id") for s in sellers_data if s.get("seller_id")]
        if not seller_ids:
            raise ValidationError("sellers_data doit contenir au moins un seller_id valide.")
        sellers = await manager_service.get_users_by_ids_and_store(
            seller_ids, resolved_store_id, role="seller", limit=50, projection={"_id": 0, "id": 1, "name": 1}
        )
        valid_ids = {s["id"] for s in sellers}
        invalid = set(seller_ids) - valid_ids
        if invalid:
            raise ValidationError(f"Vendeurs n'appartenant pas à ce magasin: {invalid}")
        for seller_entry in sellers_data:
            seller_id = seller_entry.get("seller_id")
            if not seller_id:
                continue
            seller = await manager_service.get_seller_by_id_and_store(seller_id, resolved_store_id)
            seller_name = seller.get("name", "Vendeur") if seller else "Vendeur"
            seller_manager_id = seller.get("manager_id") if seller else manager_id
            existing = await manager_service.get_kpi_entry_by_seller_and_date(seller_id, date)
            if existing and existing.get("locked"):
                raise ForbiddenError(f"Entrée verrouillée pour {seller_name}.")
            entry_data = {
                "seller_id": seller_id,
                "seller_name": seller_name,
                "manager_id": seller_manager_id,
                "store_id": resolved_store_id,
                "date": date,
                "seller_ca": seller_entry.get("ca_journalier") or seller_entry.get("seller_ca") or 0,
                "ca_journalier": seller_entry.get("ca_journalier") or seller_entry.get("seller_ca") or 0,
                "nb_ventes": seller_entry.get("nb_ventes") or 0,
                "nb_clients": seller_entry.get("nb_clients") or 0,
                "nb_articles": seller_entry.get("nb_articles") or 0,
                "nb_prospects": seller_entry.get("nb_prospects") or 0,
                "source": "manual",
                "created_by": "manager",
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }
            if existing:
                await manager_service.update_kpi_entry_one({"id": existing.get("id")}, entry_data)
                entry_data["id"] = existing.get("id")
            else:
                entry_data["id"] = str(uuid4())
                entry_data["created_at"] = datetime.now(timezone.utc).isoformat()
                await manager_service.insert_kpi_entry_one(entry_data)
            entry_data.pop("_id", None)
            results["sellers_entries"].append(entry_data)
    nb_prospects = kpi_data.get("nb_prospects")
    if nb_prospects is not None and nb_prospects > 0:
        existing_prospects = await manager_service.get_manager_kpi_by_store_and_date(resolved_store_id, date)
        if existing_prospects and existing_prospects.get("locked"):
            raise ForbiddenError("Entrée verrouillée (données API).")
        prospects_entry_data = {
            "store_id": resolved_store_id,
            "manager_id": manager_id,
            "date": date,
            "ca_journalier": 0,
            "nb_ventes": 0,
            "nb_clients": 0,
            "nb_articles": 0,
            "nb_prospects": nb_prospects,
            "source": "manual",
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        if existing_prospects:
            await manager_service.update_manager_kpi_one(
                {"id": existing_prospects.get("id")},
                {"nb_prospects": nb_prospects, "updated_at": datetime.now(timezone.utc).isoformat()},
            )
            prospects_entry_data["id"] = existing_prospects.get("id")
        else:
            prospects_entry_data["id"] = str(uuid4())
            prospects_entry_data["created_at"] = datetime.now(timezone.utc).isoformat()
            await manager_service.insert_manager_kpi_one(prospects_entry_data)
        prospects_entry_data.pop("_id", None)
        results["prospects_entry"] = prospects_entry_data
    return results


@router.get("/team-bilans/all")
async def get_team_bilans_all(
    store_id: Optional[str] = Query(None, description=QUERY_STORE_ID_REQUIS_GERANT),
    context: dict = Depends(get_store_context),
    manager_service: ManagerService = Depends(get_manager_service),
):
    """Get all team bilans for the store."""
    resolved_store_id = context.get("resolved_store_id")
    manager_id = context.get("id")
    return await manager_service.get_team_bilans_all(manager_id=manager_id, store_id=resolved_store_id)


@router.get("/store-kpi/stats")
async def get_store_kpi_stats(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    store_id: Optional[str] = Query(None, description=QUERY_STORE_ID_REQUIS_GERANT),
    context: dict = Depends(get_store_context),
    manager_service: ManagerService = Depends(get_manager_service),
):
    """Get aggregated KPI statistics for the store."""
    resolved_store_id = context.get("resolved_store_id")
    return await manager_service.get_store_kpi_stats(
        store_id=resolved_store_id, start_date=start_date, end_date=end_date
    )


# ===== API KEYS =====

@router.post("/api-keys")
async def create_api_key(
    key_data: dict,
    current_user: dict = Depends(verify_manager_or_gerant),
    api_key_service: APIKeyService = Depends(get_api_key_service),
):
    """Create a new API key for integrations (Manager/Gérant)."""
    gerant_id = current_user.get("id") if current_user["role"] in ["gerant", "gérant"] else None
    return await api_key_service.create_api_key(
        user_id=current_user["id"],
        store_id=current_user.get("store_id"),
        gerant_id=gerant_id,
        name=key_data.get("name", "API Key"),
        permissions=key_data.get("permissions", ["write:kpi", "read:stats", "stores:read", "stores:write", "users:write"]),
        store_ids=key_data.get("store_ids"),
        expires_days=key_data.get("expires_days"),
    )


@router.get("/api-keys")
async def list_api_keys(
    current_user: dict = Depends(verify_manager_or_gerant),
    api_key_service: APIKeyService = Depends(get_api_key_service),
):
    """List all API keys for current user (Manager/Gérant)."""
    return await api_key_service.list_api_keys(current_user["id"])


@router.delete("/api-keys/{key_id}")
async def delete_api_key(
    key_id: str,
    current_user: dict = Depends(verify_manager_or_gerant),
    api_key_service: APIKeyService = Depends(get_api_key_service),
):
    """Deactivate an API key (Manager/Gérant)."""
    try:
        return await api_key_service.deactivate_api_key(key_id, current_user["id"])
    except ValueError as e:
        raise NotFoundError(str(e))


@router.post("/api-keys/{key_id}/regenerate")
async def regenerate_api_key(
    key_id: str,
    current_user: dict = Depends(verify_manager_or_gerant),
    api_key_service: APIKeyService = Depends(get_api_key_service),
):
    """Regenerate an API key (Manager/Gérant)."""
    try:
        return await api_key_service.regenerate_api_key(key_id, current_user["id"])
    except ValueError as e:
        raise NotFoundError(str(e))
    except Exception as e:
        raise ValidationError(str(e))


@router.delete("/api-keys/{key_id}/permanent")
async def delete_api_key_permanent(
    key_id: str,
    current_user: dict = Depends(verify_manager_or_gerant),
    api_key_service: APIKeyService = Depends(get_api_key_service),
):
    """Permanently delete an inactive API key (Manager/Gérant)."""
    try:
        return await api_key_service.delete_api_key_permanent(key_id, current_user["id"], current_user["role"])
    except ValueError as e:
        raise ValidationError(str(e))
    except PermissionError as e:
        raise ForbiddenError(str(e))
