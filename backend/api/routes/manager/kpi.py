"""
Manager - KPI routes: store KPI overview, dates, manager KPI entries, seller metrics.
"""
from datetime import datetime, timezone, timedelta
import asyncio
import logging
from typing import Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, Query, Request

from config.limits import SELLERS_LIST_LIMIT
from core.constants import (
    ERR_STORE_ID_REQUIS,
    QUERY_STORE_ID_REQUIS_GERANT,
)
from core.exceptions import NotFoundError, ValidationError, ForbiddenError
from core.cache import invalidate_store_cache
from core.audit import log_action
from core.database import get_db
from core.validators import validate_date
from api.routes.manager.dependencies import get_store_context
from api.dependencies import (
    get_manager_service,
    get_manager_kpi_service,
    get_gerant_service,
    get_competence_service,
)
from services.competence_service import CompetenceService
from api.dependencies_rate_limiting import rate_limit
from core.security import verify_seller_store_access
from models.pagination import PaginatedResponse, PaginationParams
from services.manager_service import ManagerService
from services.manager import ManagerKpiService
from services.gerant_service import GerantService

router = APIRouter(prefix="")
logger = logging.getLogger(__name__)


# ===== STORE KPI OVERVIEW & DATES =====

@router.get("/store-kpi-overview")
async def get_store_kpi_overview(
    request: Request,
    date: str = Query(None),
    store_id: Optional[str] = Query(None, description=QUERY_STORE_ID_REQUIS_GERANT),
    context: dict = Depends(get_store_context),
    gerant_service: GerantService = Depends(get_gerant_service),
):
    """Get KPI overview for manager's store on a specific date. Delegates to GerantService."""
    resolved_store_id = context.get("resolved_store_id")
    if not resolved_store_id:
        raise ValidationError(ERR_STORE_ID_REQUIS)
    target_date = date or datetime.now(timezone.utc).strftime("%Y-%m-%d")
    user_id = context.get("id")
    overview = await gerant_service.get_store_kpi_overview(store_id=resolved_store_id, user_id=user_id, date=target_date)
    calculated_kpis = overview.get("calculated_kpis", {})
    totals = overview.get("totals", {})
    return {
        "date": target_date,
        "store_id": resolved_store_id,
        "totals": {
            "ca": totals.get("ca", 0),
            "nb_ventes": totals.get("ventes", 0),
            "nb_clients": totals.get("clients", 0),
            "nb_articles": totals.get("articles", 0),
            "nb_prospects": totals.get("prospects", 0),
        },
        "derived": {
            "panier_moyen": calculated_kpis.get("panier_moyen"),
            "taux_transformation": calculated_kpis.get("taux_transformation"),
            "indice_vente": calculated_kpis.get("indice_vente"),
        },
        "sellers_submitted": len(overview.get("seller_entries", [])),
        "entries_count": len(overview.get("seller_entries", [])),
    }


@router.get("/dates-with-data")
async def get_dates_with_data(
    request: Request,
    year: int = Query(None),
    month: int = Query(None),
    store_id: Optional[str] = Query(None, description=QUERY_STORE_ID_REQUIS_GERANT),
    context: dict = Depends(get_store_context),
    kpi_service: ManagerKpiService = Depends(get_manager_kpi_service),
):
    """Get list of dates that have KPI data for the store (calendar highlighting)."""
    resolved_store_id = context.get("resolved_store_id")
    query = {"store_id": resolved_store_id}
    if year and month:
        start_date = f"{year}-{month:02d}-01"
        end_date = f"{year}-{month + 1:02d}-01" if month != 12 else f"{year + 1}-01-01"
        query["date"] = {"$gte": start_date, "$lt": end_date}
    dates = await kpi_service.get_kpi_distinct_dates(query)
    manager_dates = await kpi_service.get_manager_kpi_distinct_dates(query)
    all_dates = sorted(set(dates) | set(manager_dates))
    locked_query = {**query, "locked": True}
    locked_dates = await kpi_service.get_kpi_distinct_dates(locked_query)
    locked_sellers_by_date = await kpi_service.get_locked_seller_ids_by_date(
        resolved_store_id, date_filter=query.get("date")
    )
    return {
        "dates": all_dates,
        "lockedDates": sorted(locked_dates),
        "lockedSellersByDate": locked_sellers_by_date,
    }


@router.get("/available-years")
async def get_available_years(
    request: Request,
    store_id: Optional[str] = Query(None, description=QUERY_STORE_ID_REQUIS_GERANT),
    context: dict = Depends(get_store_context),
    kpi_service: ManagerKpiService = Depends(get_manager_kpi_service),
):
    """Get list of years that have KPI data for the store."""
    resolved_store_id = context.get("resolved_store_id")
    dates = await kpi_service.get_kpi_distinct_dates({"store_id": resolved_store_id})
    manager_dates = await kpi_service.get_manager_kpi_distinct_dates({"store_id": resolved_store_id})
    all_dates = set(dates) | set(manager_dates)
    years = set()
    for date_str in all_dates:
        if date_str and len(date_str) >= 4:
            try:
                years.add(int(date_str[:4]))
            except Exception:
                pass
    return {"years": sorted(list(years), reverse=True)}


# ===== MANAGER KPI =====

@router.get("/manager-kpi")
async def get_manager_kpis(
    request: Request,
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    store_id: Optional[str] = Query(None, description=QUERY_STORE_ID_REQUIS_GERANT),
    pagination: PaginationParams = Depends(),
    context: dict = Depends(get_store_context),
    manager_service: ManagerService = Depends(get_manager_service),
):
    """Get manager KPI entries for a date range (paginated)."""
    try:
        resolved_store_id = context.get("resolved_store_id") or store_id
        if not resolved_store_id:
            return PaginatedResponse(items=[], total=0, page=1, size=pagination.size, pages=0)
        if not start_date or not end_date:
            today = datetime.now(timezone.utc)
            end_date = end_date or today.strftime("%Y-%m-%d")
            start_date = start_date or (today - timedelta(days=30)).strftime("%Y-%m-%d")
        result = await manager_service.get_manager_kpis_paginated(
            store_id=resolved_store_id, start_date=start_date, end_date=end_date, page=pagination.page, size=pagination.size
        )
        return result
    except Exception as e:
        logger.error("Error fetching manager KPIs: %s", e, exc_info=True)
        raise


@router.post("/manager-kpi")
async def save_manager_kpi(
    request: Request,
    kpi_data: dict,
    store_id: Optional[str] = Query(None, description=QUERY_STORE_ID_REQUIS_GERANT),
    context: dict = Depends(get_store_context),
    manager_service: ManagerService = Depends(get_manager_service),
    db=Depends(get_db),
):
    """
    Save manager KPI entries (sellers_data per seller, nb_prospects global).
    Date locked by API/ERP raises ForbiddenError.
    """
    resolved_store_id = context.get("resolved_store_id") or store_id
    manager_id = context.get("id")
    role = context.get("role")
    if not resolved_store_id:
        raise ValidationError("Store ID requis." if role in ["gerant", "gérant"] else "Le manager doit avoir un magasin assigné.")
    store = await manager_service.get_store_by_id_simple(resolved_store_id, projection={"_id": 0, "id": 1, "name": 1, "gerant_id": 1, "active": 1})
    if not store or not store.get("active"):
        raise NotFoundError(f"Magasin {resolved_store_id} non trouvé ou inactif")
    if role in ["gerant", "gérant"] and store.get("gerant_id") != manager_id:
        raise ForbiddenError("Ce magasin ne vous appartient pas")
    if role == "manager" and context.get("store_id") != resolved_store_id:
        raise ForbiddenError("Ce magasin ne vous est pas assigné")
    date = kpi_data.get("date", datetime.now(timezone.utc).strftime("%Y-%m-%d"))
    results = {"sellers_entries": [], "prospects_entry": None}
    sellers_data = kpi_data.get("sellers_data", [])
    if sellers_data and not isinstance(sellers_data, list):
        raise ValidationError("Le champ 'sellers_data' doit être un tableau.")
    if sellers_data:
        seller_ids = [s.get("seller_id") for s in sellers_data if s.get("seller_id")]
        if not seller_ids:
            raise ValidationError("Au moins un 'seller_id' valide requis dans sellers_data.")
        sellers = await manager_service.get_users_by_ids_and_store(seller_ids, resolved_store_id, role="seller", limit=SELLERS_LIST_LIMIT, projection={"_id": 0, "id": 1, "name": 1})
        valid_ids = {s["id"] for s in sellers}
        invalid = set(seller_ids) - valid_ids
        if invalid:
            raise ValidationError(f"Certains vendeurs n'appartiennent pas à ce magasin: {invalid}")
        for seller_entry in sellers_data:
            seller_id = seller_entry.get("seller_id")
            if not seller_id:
                continue
            seller = await manager_service.get_seller_by_id_and_store(seller_id, resolved_store_id)
            seller_name = seller.get("name", "Vendeur") if seller else "Vendeur"
            seller_manager_id = seller.get("manager_id") if seller else manager_id
            existing = await manager_service.get_kpi_entry_by_seller_and_date(seller_id, date)
            if existing and existing.get("locked"):
                results.setdefault("skipped_locked", []).append(seller_id)
                continue
            entry_data = {
                "seller_id": seller_id,
                "seller_name": seller_name,
                "manager_id": seller_manager_id,
                "store_id": resolved_store_id,
                "date": date,
                "ca_journalier": seller_entry.get("ca_journalier") or seller_entry.get("seller_ca") or 0,
                "seller_ca": seller_entry.get("ca_journalier") or seller_entry.get("seller_ca") or 0,
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
            raise ForbiddenError("Cette entrée est verrouillée (données API).")
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

    # Invalider le cache Redis KPI pour ce magasin après toute mutation
    if results.get("sellers_entries") or results.get("prospects_entry"):
        try:
            await invalidate_store_cache(resolved_store_id)
        except Exception:
            pass  # fallback silencieux

        # Audit log (fire-and-forget)
        asyncio.create_task(log_action(
            db=db,
            user_id=manager_id or "unknown",
            user_role=role,
            store_id=resolved_store_id,
            action="kpi_upsert",
            resource_type="kpi_entry",
            details={
                "date": date,
                "sellers_count": len(results.get("sellers_entries", [])),
                "has_prospects": results.get("prospects_entry") is not None,
            },
        ))

    return results


@router.get("/store-kpi/stats")
async def get_store_kpi_stats(
    request: Request,
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    store_id: Optional[str] = Query(None, description=QUERY_STORE_ID_REQUIS_GERANT),
    context: dict = Depends(get_store_context),
    kpi_service: ManagerKpiService = Depends(get_manager_kpi_service),
):
    """Get aggregated KPI statistics for the store."""
    validate_date(start_date, "start_date")
    validate_date(end_date, "end_date")
    resolved_store_id = context.get("resolved_store_id")
    return await kpi_service.get_store_kpi_stats(store_id=resolved_store_id, start_date=start_date, end_date=end_date)


@router.get("/team-bilans/all")
async def get_team_bilans_all(
    request: Request,
    store_id: Optional[str] = Query(None, description=QUERY_STORE_ID_REQUIS_GERANT),
    context: dict = Depends(get_store_context),
    kpi_service: ManagerKpiService = Depends(get_manager_kpi_service),
):
    """Get all team bilans for the store."""
    resolved_store_id = context.get("resolved_store_id")
    manager_id = context.get("id")
    return await kpi_service.get_team_bilans_all(manager_id=manager_id, store_id=resolved_store_id)


# ===== KPI ENTRIES (seller) =====

@router.get("/seller/{seller_id}/kpi-metrics", dependencies=[rate_limit("200/minute")])
async def get_seller_kpi_metrics(
    request: Request,
    seller_id: str,
    start_date: Optional[str] = Query(None, description="Start date YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="End date YYYY-MM-DD"),
    days: int = Query(30, description="Nombre de jours si start/end non fournis"),
    store_id: Optional[str] = Query(None, description=QUERY_STORE_ID_REQUIS_GERANT),
    context: dict = Depends(get_store_context),
    manager_service: ManagerService = Depends(get_manager_service),
) -> dict:
    """
    Métriques KPI agrégées server-side pour un vendeur (vue manager).
    Source de vérité unique — même pipeline que /seller/kpi-metrics.
    Retourne: ca, ventes, articles, prospects, panier_moyen, indice_vente, taux_transformation, nb_jours.
    """
    resolved_store_id = context.get("resolved_store_id")
    if not resolved_store_id:
        raise ValidationError(ERR_STORE_ID_REQUIS)
    await verify_seller_store_access(
        seller_id=seller_id,
        user_store_id=resolved_store_id,
        user_role=context.get("role"),
        user_id=context.get("id"),
        manager_service=manager_service,
    )
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
    return await manager_service.get_seller_kpi_metrics(seller_id, start_date, end_date)


@router.post("/team/kpi-metrics", dependencies=[rate_limit("60/minute")])
async def get_team_kpi_metrics(
    request: Request,
    payload: dict,
    store_id: Optional[str] = Query(None, description=QUERY_STORE_ID_REQUIS_GERANT),
    context: dict = Depends(get_store_context),
    manager_service: ManagerService = Depends(get_manager_service),
) -> dict:
    """
    Métriques KPI agrégées pour toute l'équipe en un seul appel.
    Remplace N appels /seller/{id}/kpi-metrics → 1 seul POST.

    Body: { "seller_ids": [...], "days": 30 }
          ou { "seller_ids": [...], "start_date": "YYYY-MM-DD", "end_date": "YYYY-MM-DD" }

    Retourne: { seller_id: { ca, ventes, articles, prospects, panier_moyen, ... } }
    """
    import asyncio

    resolved_store_id = context.get("resolved_store_id")
    if not resolved_store_id:
        raise ValidationError(ERR_STORE_ID_REQUIS)

    seller_ids: list = payload.get("seller_ids", [])
    if not seller_ids or not isinstance(seller_ids, list):
        raise ValidationError("seller_ids doit être un tableau non vide")
    if len(seller_ids) > 200:
        raise ValidationError("Maximum 200 vendeurs par requête")

    # Validation dates
    start_date: Optional[str] = payload.get("start_date")
    end_date: Optional[str] = payload.get("end_date")
    days: int = min(int(payload.get("days", 30)), 365)
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

    # Vérification sécurité : tous les sellers doivent appartenir au magasin
    valid_sellers = await manager_service.get_users_by_ids_and_store(
        seller_ids, resolved_store_id, role="seller", limit=200, projection={"_id": 0, "id": 1}
    )
    valid_ids = {s["id"] for s in valid_sellers}
    invalid = set(seller_ids) - valid_ids
    if invalid:
        raise ValidationError(f"Certains vendeurs n'appartiennent pas à ce magasin: {invalid}")

    # Pipeline en parallèle pour tous les sellers validés
    results = await asyncio.gather(*[
        manager_service.get_seller_kpi_metrics(sid, start_date, end_date)
        for sid in valid_ids
    ])
    return {sid: metrics for sid, metrics in zip(valid_ids, results)}


@router.post("/team/seller-profiles", dependencies=[rate_limit("60/minute")])
async def get_team_seller_profiles(
    request: Request,
    payload: dict,
    store_id: Optional[str] = Query(None, description=QUERY_STORE_ID_REQUIS_GERANT),
    context: dict = Depends(get_store_context),
    manager_service: ManagerService = Depends(get_manager_service),
    competence_service: CompetenceService = Depends(get_competence_service),
) -> dict:
    """
    Batch: radar scores + niveau pour N vendeurs en 1 seul appel.
    Remplace N×2 appels /seller/{id}/stats + /seller/{id}/diagnostic.

    Body: { "seller_ids": ["id1", "id2", ...] }
    Retourne: { seller_id: { avg_radar_scores: {...}, niveau: str|null, has_diagnostic: bool } }
    """
    import asyncio as _asyncio

    resolved_store_id = context.get("resolved_store_id")
    if not resolved_store_id:
        raise ValidationError(ERR_STORE_ID_REQUIS)

    seller_ids: list = payload.get("seller_ids", [])
    if not seller_ids or not isinstance(seller_ids, list):
        raise ValidationError("seller_ids doit être un tableau non vide")
    if len(seller_ids) > 100:
        raise ValidationError("Maximum 100 vendeurs par requête")

    valid_sellers = await manager_service.get_users_by_ids_and_store(
        seller_ids, resolved_store_id, role="seller", limit=100, projection={"_id": 0, "id": 1}
    )
    valid_ids = {s["id"] for s in valid_sellers}

    async def get_profile(sid: str):
        diagnostic = await manager_service.get_diagnostic_by_seller(sid)
        debriefs = await manager_service.get_debriefs_by_seller(sid, limit=5)
        avg_radar_scores = await competence_service.calculate_seller_performance_scores(
            seller_id=sid, diagnostic=diagnostic, debriefs=debriefs
        )
        return sid, {
            "avg_radar_scores": avg_radar_scores,
            "niveau": diagnostic.get("level") if diagnostic else None,
            "has_diagnostic": bool(diagnostic),
        }

    results = await _asyncio.gather(*[get_profile(sid) for sid in valid_ids])
    return dict(results)


@router.get("/kpi-entries/{seller_id}", dependencies=[rate_limit("200/minute")])
async def get_seller_kpi_entries(
    request: Request,
    seller_id: str,
    days: int = Query(30),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    store_id: Optional[str] = Query(None, description=QUERY_STORE_ID_REQUIS_GERANT),
    pagination: PaginationParams = Depends(),
    context: dict = Depends(get_store_context),
    manager_service: ManagerService = Depends(get_manager_service),
) -> PaginatedResponse:
    """Get paginated KPI entries for a specific seller."""
    resolved_store_id = context.get("resolved_store_id")
    if not resolved_store_id:
        raise ValidationError(ERR_STORE_ID_REQUIS)
    await verify_seller_store_access(
        seller_id=seller_id,
        user_store_id=resolved_store_id,
        user_role=context.get("role"),
        user_id=context.get("id"),
        manager_service=manager_service,
    )
    query = {"seller_id": seller_id}
    if start_date and end_date:
        query["date"] = {"$gte": start_date, "$lte": end_date}
    else:
        end_dt = datetime.now(timezone.utc)
        start_dt = end_dt - timedelta(days=days - 1)
        query["date"] = {"$gte": start_dt.strftime("%Y-%m-%d"), "$lte": end_dt.strftime("%Y-%m-%d")}
    # Taille garantie suffisante pour couvrir la période demandée (graphiques time-series)
    fetch_size = max(pagination.size, days + 1)
    return await manager_service.get_kpi_entries_paginated(query, page=pagination.page, size=min(fetch_size, 365))

