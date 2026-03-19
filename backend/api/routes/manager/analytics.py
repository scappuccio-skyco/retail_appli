"""
Manager - Analytics: KPIs magasin, graphiques, statistiques, bilans équipe, analyses IA.
"""
from datetime import datetime, timezone, timedelta
import logging
from typing import Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, Query, Request

from config.limits import SELLERS_LIST_LIMIT
from core.constants import (
    ERR_STORE_ID_REQUIS,
    MONGO_GROUP,
    MONGO_IFNULL,
    MONGO_MATCH,
    QUERY_STORE_ID_REQUIS_GERANT,
)
from core.exceptions import AppException, NotFoundError, ValidationError, ForbiddenError
from api.routes.manager.dependencies import get_store_context
from api.routes.manager.response_utils import pagination_dict
from api.dependencies import (
    get_manager_service,
    get_manager_kpi_service,
    get_gerant_service,
    get_ai_service,
)
from api.dependencies_rate_limiting import rate_limit
from core.security import verify_seller_store_access
from models.pagination import PaginatedResponse, PaginationParams
from services.manager_service import ManagerService
from services.manager import ManagerKpiService
from services.gerant_service import GerantService
from services.ai_service import AIService, TEAM_ANALYSIS_SYSTEM_PROMPT, DISC_ADAPTATION_INSTRUCTIONS

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
    if len(seller_ids) > 50:
        raise ValidationError("Maximum 50 vendeurs par requête")

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
        seller_ids, resolved_store_id, role="seller", limit=50, projection={"_id": 0, "id": 1}
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


# ===== TEAM ANALYSES =====

@router.get("/team-analyses-history")
async def get_team_analyses_history(
    request: Request,
    store_id: Optional[str] = Query(None, description=QUERY_STORE_ID_REQUIS_GERANT),
    context: dict = Depends(get_store_context),
    manager_service: ManagerService = Depends(get_manager_service),
):
    """Get history of team AI analyses for this store."""
    try:
        resolved_store_id = context.get("resolved_store_id")
        if not resolved_store_id:
            return {"analyses": []}
        analyses_result = await manager_service.get_team_analyses_paginated(store_id=resolved_store_id, page=1, size=50)
        return {
            "analyses": analyses_result.items,
            "pagination": pagination_dict(analyses_result),
        }
    except Exception as e:
        logger.error("Error loading team analyses history: %s", e)
        return {"analyses": []}


@router.post("/analyze-team")
async def analyze_team(
    request: Request,
    analysis_data: dict,
    store_id: Optional[str] = Query(None, description=QUERY_STORE_ID_REQUIS_GERANT),
    context: dict = Depends(get_store_context),
    ai_service: AIService = Depends(get_ai_service),
    manager_service: ManagerService = Depends(get_manager_service),
):
    """Generate AI-powered analysis of team performance. Uses GPT-4o."""
    from uuid import uuid4
    resolved_store_id = context.get("resolved_store_id")
    manager_id = context.get("id")
    team_data = analysis_data.get("team_data", {})
    period_filter = analysis_data.get("period_filter", "30")
    start_date = analysis_data.get("start_date")
    end_date = analysis_data.get("end_date")
    today = datetime.now(timezone.utc)
    if period_filter == "custom" and start_date and end_date:
        period_start, period_end = start_date, end_date
        period_label = f"du {start_date} au {end_date}"
    elif period_filter == "all":
        period_start = (today - timedelta(days=365)).strftime("%Y-%m-%d")
        period_end = today.strftime("%Y-%m-%d")
        period_label = "sur l'année"
    elif period_filter == "90":
        period_start = (today - timedelta(days=90)).strftime("%Y-%m-%d")
        period_end = today.strftime("%Y-%m-%d")
        period_label = "sur 3 mois"
    elif period_filter == "7":
        period_start = (today - timedelta(days=7)).strftime("%Y-%m-%d")
        period_end = today.strftime("%Y-%m-%d")
        period_label = "sur 7 jours"
    else:
        days_val = int(period_filter) if str(period_filter).isdigit() else 30
        period_start = (today - timedelta(days=days_val)).strftime("%Y-%m-%d")
        period_end = today.strftime("%Y-%m-%d")
        period_label = f"sur {days_val} jours"
    # R7: Fetch previous period data for temporal evolution
    prev_period_data = None
    try:
        from datetime import datetime as _dt, timedelta as _tdd
        _curr_start = _dt.strptime(period_start, "%Y-%m-%d")
        _curr_end = _dt.strptime(period_end, "%Y-%m-%d")
        _duration = (_curr_end - _curr_start).days + 1
        _prev_end = (_curr_start - _tdd(days=1)).strftime("%Y-%m-%d")
        _prev_start = (_curr_start - _tdd(days=_duration)).strftime("%Y-%m-%d")
        if resolved_store_id:
            prev_kpi_stats = await manager_service.get_store_kpi_stats(
                store_id=resolved_store_id,
                start_date=_prev_start,
                end_date=_prev_end,
            )
            if prev_kpi_stats:
                prev_total_ca = prev_kpi_stats.get("ca_total") or prev_kpi_stats.get("total_ca") or 0
                prev_total_ventes = prev_kpi_stats.get("ventes") or prev_kpi_stats.get("total_ventes") or 0
                prev_total_articles = prev_kpi_stats.get("articles") or prev_kpi_stats.get("total_articles") or 0
                prev_pm = (prev_total_ca / prev_total_ventes) if prev_total_ventes > 0 else 0
                prev_iv = (prev_total_articles / prev_total_ventes) if prev_total_ventes > 0 else 0
                prev_period_data = {
                    "team_total_ca": prev_total_ca,
                    "team_total_ventes": prev_total_ventes,
                    "team_panier_moyen": round(prev_pm, 2),
                    "team_indice_vente": round(prev_iv, 2),
                }
    except Exception as _e:
        logger.warning("Could not fetch previous period data for team analysis: %s", _e)

    # Fetch manager DISC profile for tone adaptation
    manager_disc_profile = None
    if manager_id:
        try:
            mgr_diag = await manager_service.manager_diagnostic_repo.find_latest_by_manager(manager_id)
            if mgr_diag:
                manager_disc_profile = mgr_diag.get("profile") or mgr_diag.get("disc_profile")
        except Exception as _e:
            logger.warning("Could not fetch manager DISC for team analysis: %s", _e)

    # Fetch active team objectives for the period
    team_objectives = []
    if resolved_store_id and manager_id:
        try:
            all_objs = await manager_service.get_active_objectives(manager_id, resolved_store_id)
            team_objectives = [
                o for o in (all_objs or [])
                if o.get("period_start", "") <= period_end and o.get("period_end", "") >= period_start
            ][:5]
        except Exception as _e:
            logger.warning("Could not fetch team objectives for team analysis: %s", _e)

    # Compute realized values for objectives
    if team_objectives and resolved_store_id:
        try:
            kpi_stats = await manager_service.get_store_kpi_stats(
                store_id=resolved_store_id, start_date=period_start, end_date=period_end
            )
            if kpi_stats:
                curr_ca = (kpi_stats.get("ca_total") or kpi_stats.get("total_ca") or 0)
                curr_ventes = (kpi_stats.get("ventes") or kpi_stats.get("total_ventes") or 0)
                curr_articles = (kpi_stats.get("articles") or kpi_stats.get("total_articles") or 0)
                curr_prospects = (kpi_stats.get("prospects") or kpi_stats.get("total_prospects") or 0)
                curr_pm = curr_ca / curr_ventes if curr_ventes > 0 else 0
                curr_iv = curr_articles / curr_ventes if curr_ventes > 0 else 0
                curr_tv = (curr_ventes / curr_prospects * 100) if curr_prospects > 0 else 0
                kpi_map = {
                    "ca": curr_ca, "ventes": curr_ventes, "panier_moyen": curr_pm,
                    "indice_vente": curr_iv, "taux_transformation": curr_tv,
                }
                for obj in team_objectives:
                    kpi_key = obj.get("kpi_type", "").lower()
                    if kpi_key in kpi_map:
                        obj["realized_value"] = round(kpi_map[kpi_key], 2)
        except Exception as _e:
            logger.warning("Could not compute realized values for objectives: %s", _e)

    # Enrich team_data with computed aggregate metrics if not already present
    if resolved_store_id and not team_data.get("team_panier_moyen"):
        try:
            kpi_stats = await manager_service.get_store_kpi_stats(
                store_id=resolved_store_id, start_date=period_start, end_date=period_end
            )
            if kpi_stats:
                total_ca = kpi_stats.get("ca_total") or kpi_stats.get("total_ca") or 0
                total_ventes = kpi_stats.get("ventes") or kpi_stats.get("total_ventes") or 0
                total_articles = kpi_stats.get("articles") or kpi_stats.get("total_articles") or 0
                if total_ventes > 0:
                    team_data["team_panier_moyen"] = round(total_ca / total_ventes, 2)
                    team_data["team_indice_vente"] = round(total_articles / total_ventes, 2)
        except Exception as _e:
            logger.warning("Could not enrich team_data with aggregate metrics: %s", _e)

    # Fetch previous recommendations from last saved analysis
    previous_recommendations = []
    if resolved_store_id:
        try:
            history = await manager_service.get_team_analyses_paginated(store_id=resolved_store_id, page=1, size=1)
            if history and history.items:
                last = history.items[0]
                last_analysis = last.get("analysis")
                if isinstance(last_analysis, dict):
                    previous_recommendations = last_analysis.get("recommandations", [])
        except Exception as _e:
            logger.warning("Could not fetch previous recommendations for team analysis: %s", _e)

    analysis_result = await ai_service.generate_team_analysis(
        team_data=team_data,
        period_label=period_label,
        manager_id=manager_id,
        manager_disc_profile=manager_disc_profile,
        prev_period_data=prev_period_data,
        team_objectives=team_objectives,
        previous_recommendations=previous_recommendations,
    )
    analysis_record = {
        "id": str(uuid4()),
        "store_id": resolved_store_id,
        "manager_id": manager_id,
        "period_start": period_start,
        "period_end": period_end,
        "analysis": analysis_result,
        "team_stats": {"total_sellers": team_data.get("total_sellers", 0), "team_total_ca": team_data.get("team_total_ca", 0), "team_total_ventes": team_data.get("team_total_ventes", 0)},
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }
    await manager_service.create_team_analysis(analysis_record)
    return {"analysis": analysis_result, "period_start": period_start, "period_end": period_end, "generated_at": analysis_record["generated_at"]}


@router.delete("/team-analysis/{analysis_id}")
async def delete_team_analysis(
    request: Request,
    analysis_id: str,
    store_id: Optional[str] = Query(None, description=QUERY_STORE_ID_REQUIS_GERANT),
    context: dict = Depends(get_store_context),
    manager_service: ManagerService = Depends(get_manager_service),
):
    """Delete a team analysis from history."""
    try:
        resolved_store_id = context.get("resolved_store_id")
        deleted = await manager_service.delete_team_analysis_one({"id": analysis_id, "store_id": resolved_store_id})
        if not deleted:
            raise NotFoundError("Analyse non trouvée")
        return {"success": True, "message": "Analyse supprimée"}
    except AppException:
        raise


# ===== AI STORE KPI ANALYSIS (shared logic for manager + gerant) =====


async def run_store_kpi_analysis(
    resolved_store_id: str,
    analysis_data: dict,
    manager_service: ManagerService,
    kpi_service: ManagerKpiService,
    ai_service: AIService,
    manager_id: str = None,
):
    """
    Shared logic: generate AI-powered analysis of store KPIs.
    Used by both /manager/analyze-store-kpis and /gerant/stores/{store_id}/analyze-store-kpis.
    """
    store = await manager_service.get_store_by_id_simple(
        resolved_store_id,
        projection={"_id": 0, "name": 1, "location": 1},
    )
    if not store:
        raise NotFoundError("Magasin non trouvé")
    store_name = store.get("name", "Magasin")
    start_date = analysis_data.get("start_date") or analysis_data.get("startDate")
    end_date = analysis_data.get("end_date") or analysis_data.get("endDate")
    if not end_date:
        end_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    if not start_date:
        start_dt = datetime.now(timezone.utc) - timedelta(days=30)
        start_date = start_dt.strftime("%Y-%m-%d")
    days_diff = (
        datetime.strptime(end_date, "%Y-%m-%d") - datetime.strptime(start_date, "%Y-%m-%d")
    ).days
    if days_diff <= 1:
        period_text = f"le {end_date}"
    elif days_diff <= 7:
        period_text = f"la semaine du {start_date} au {end_date}"
    elif days_diff <= 31:
        period_text = f"le mois du {start_date} au {end_date}"
    else:
        period_text = f"la période du {start_date} au {end_date}"
    kpi_aggregate_pipeline = [
        {
            MONGO_MATCH: {
                "store_id": resolved_store_id,
                "date": {"$gte": start_date, "$lte": end_date},
            }
        },
        {
            MONGO_GROUP: {
                "_id": None,
                "total_ca": {"$sum": {MONGO_IFNULL: ["$ca_journalier", {MONGO_IFNULL: ["$seller_ca", 0]}]}},
                "total_ventes": {"$sum": {MONGO_IFNULL: ["$nb_ventes", 0]}},
                "total_clients": {"$sum": {MONGO_IFNULL: ["$nb_clients", 0]}},
                "total_articles": {"$sum": {MONGO_IFNULL: ["$nb_articles", 0]}},
                "total_prospects": {"$sum": {MONGO_IFNULL: ["$nb_prospects", 0]}},
                "unique_sellers": {"$addToSet": "$seller_id"},
                "unique_dates": {"$addToSet": "$date"},
            }
        },
    ]
    manager_kpi_aggregate_pipeline = [
        {
            MONGO_MATCH: {
                "store_id": resolved_store_id,
                "date": {"$gte": start_date, "$lte": end_date},
            }
        },
        {
            MONGO_GROUP: {
                "_id": None,
                "total_ca": {"$sum": {MONGO_IFNULL: ["$ca_journalier", 0]}},
                "total_ventes": {"$sum": {MONGO_IFNULL: ["$nb_ventes", 0]}},
            }
        },
    ]
    kpi_result = await kpi_service.aggregate_kpi(kpi_aggregate_pipeline, max_results=1)
    manager_kpi_result = await kpi_service.aggregate_manager_kpi(
        manager_kpi_aggregate_pipeline, max_results=1
    )
    kpi_data = kpi_result[0] if kpi_result else {}
    manager_kpi_data = manager_kpi_result[0] if manager_kpi_result else {}
    total_ca = (kpi_data.get("total_ca", 0) or 0) + (manager_kpi_data.get("total_ca", 0) or 0)
    total_ventes = (kpi_data.get("total_ventes", 0) or 0) + (
        manager_kpi_data.get("total_ventes", 0) or 0
    )
    total_clients = kpi_data.get("total_clients", 0) or 0
    total_articles = kpi_data.get("total_articles", 0) or 0
    total_prospects = kpi_data.get("total_prospects", 0) or 0
    sellers_count = len(kpi_data.get("unique_sellers", []))
    days_count = len(kpi_data.get("unique_dates", []))
    panier_moyen = (total_ca / total_ventes) if total_ventes > 0 else 0
    taux_transformation = (total_ventes / total_prospects * 100) if total_prospects > 0 else 0
    indice_vente = (total_articles / total_ventes) if total_ventes > 0 else 0
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

    # Previous period comparison
    prev_period_block = ""
    try:
        _curr_start = datetime.strptime(start_date, "%Y-%m-%d")
        _curr_end = datetime.strptime(end_date, "%Y-%m-%d")
        _duration = (_curr_end - _curr_start).days + 1
        _prev_end = (_curr_start - timedelta(days=1)).strftime("%Y-%m-%d")
        _prev_start = (_curr_start - timedelta(days=_duration)).strftime("%Y-%m-%d")
        prev_stats = await manager_service.get_store_kpi_stats(
            store_id=resolved_store_id, start_date=_prev_start, end_date=_prev_end
        )
        if prev_stats:
            prev_ca = prev_stats.get("ca_total") or prev_stats.get("total_ca") or 0
            prev_ventes = prev_stats.get("ventes") or prev_stats.get("total_ventes") or 0
            if prev_ca > 0:
                def _pct(cur, prev):
                    if prev == 0: return "N/A"
                    d = ((cur - prev) / prev) * 100
                    return f"+{d:.0f}%" if d >= 0 else f"{d:.0f}%"
                prev_period_block = (
                    f"\n📊 PÉRIODE PRÉCÉDENTE ({_prev_start} → {_prev_end}) :\n"
                    f"- CA : {prev_ca:.0f}€  ({_pct(total_ca, prev_ca)} vs période actuelle)\n"
                    f"- Ventes : {prev_ventes}  ({_pct(total_ventes, prev_ventes)})\n"
                )
                # Also compute PM and IV for previous period if available
                prev_articles = prev_stats.get("articles") or prev_stats.get("total_articles") or 0
                prev_pm = (prev_ca / prev_ventes) if prev_ventes > 0 else 0
                prev_iv = (prev_articles / prev_ventes) if prev_ventes > 0 else 0
                if prev_pm > 0 and panier_moyen > 0:
                    pm_delta = ((panier_moyen - prev_pm) / prev_pm) * 100
                    pm_arrow = "↗" if pm_delta > 1 else ("↘" if pm_delta < -1 else "→")
                    prev_period_block += f"- PM : {panier_moyen:.2f}€ vs {prev_pm:.2f}€ ({_pct(panier_moyen, prev_pm)}) {pm_arrow}\n"
                if prev_iv > 0 and indice_vente > 0:
                    iv_delta = ((indice_vente - prev_iv) / prev_iv) * 100
                    iv_arrow = "↗" if iv_delta > 1 else ("↘" if iv_delta < -1 else "→")
                    prev_period_block += f"- IV : {indice_vente:.2f} vs {prev_iv:.2f} ({_pct(indice_vente, prev_iv)}) {iv_arrow}\n"
                prev_period_block += "→ Commente OBLIGATOIREMENT les variations significatives (>10%) dans ton analyse.\n"
    except Exception as _e:
        logger.warning("Could not fetch prev period for store KPI analysis: %s", _e)

    # Manager DISC for tone adaptation
    disc_block = ""
    if manager_id:
        try:
            mgr_diag = await manager_service.manager_diagnostic_repo.find_latest_by_manager(manager_id)
            if mgr_diag:
                disc_style = (mgr_diag.get("profile") or mgr_diag.get("disc_profile") or {}).get("style", "")
                if disc_style:
                    disc_block = (
                        f"\n👤 TON INTERLOCUTEUR (MANAGER) EST DE PROFIL DISC : {disc_style}\n"
                        f"{DISC_ADAPTATION_INSTRUCTIONS}\n"
                    )
        except Exception as _e:
            logger.warning("Could not fetch manager DISC for store KPI analysis: %s", _e)

    # Top sellers breakdown for store KPI analysis
    top_sellers_block = ""
    try:
        sellers_kpi = await kpi_service.aggregate_kpi([
            {
                "$match": {
                    "store_id": resolved_store_id,
                    "date": {"$gte": start_date, "$lte": end_date},
                }
            },
            {
                "$group": {
                    "_id": "$seller_id",
                    "total_ca": {"$sum": {"$ifNull": ["$ca_journalier", {"$ifNull": ["$seller_ca", 0]}]}},
                    "total_ventes": {"$sum": {"$ifNull": ["$nb_ventes", 0]}},
                    "total_articles": {"$sum": {"$ifNull": ["$nb_articles", 0]}},
                }
            },
            {"$sort": {"total_ca": -1}},
            {"$limit": 3},
        ], max_results=3)
        if sellers_kpi:
            seller_lines = []
            for i, s in enumerate(sellers_kpi, 1):
                s_ca = s.get("total_ca", 0)
                s_ventes = s.get("total_ventes", 0)
                s_articles = s.get("total_articles", 0)
                s_pm = s_ca / s_ventes if s_ventes > 0 else 0
                s_iv = s_articles / s_ventes if s_ventes > 0 else 0
                try:
                    s_id = s.get("_id", "")
                    seller_profile = await manager_service.user_repo.find_by_id(s_id)
                    s_name = seller_profile.get("name", f"Vendeur {i}").split()[0] if seller_profile else f"Vendeur {i}"
                except Exception:
                    s_name = f"Vendeur {i}"
                medal = "🥇" if i == 1 else ("🥈" if i == 2 else "🥉")
                line = f"- {medal} {s_name}: CA {s_ca:.0f}€, {s_ventes} ventes, PM {s_pm:.2f}€"
                if s_iv > 0:
                    line += f", IV {s_iv:.2f}"
                seller_lines.append(line)
            top_sellers_block = "\n🏆 TOP VENDEURS SUR LA PÉRIODE :\n" + "\n".join(seller_lines) + "\n→ Identifie les écarts entre vendeurs et explique ce qu'ils révèlent sur la dynamique du magasin.\n"
    except Exception as _e:
        logger.warning("Could not fetch top sellers for store KPI analysis: %s", _e)

    # Intra-period trend: last 5 days vs full period average
    trend_block = ""
    try:
        if days_count >= 7:  # Only meaningful for longer periods
            last5_pipeline = [
                {
                    "$match": {
                        "store_id": resolved_store_id,
                        "date": {"$gte": start_date, "$lte": end_date},
                    }
                },
                {"$sort": {"date": -1}},
                {"$limit": 5},
                {
                    "$group": {
                        "_id": None,
                        "ca_last5": {"$sum": {"$ifNull": ["$ca_journalier", {"$ifNull": ["$seller_ca", 0]}]}},
                        "ventes_last5": {"$sum": {"$ifNull": ["$nb_ventes", 0]}},
                    }
                }
            ]
            last5_result = await kpi_service.aggregate_kpi(last5_pipeline, max_results=1)
            if last5_result:
                ca_last5 = last5_result[0].get("ca_last5", 0)
                ca_avg_per_day = total_ca / days_count if days_count > 0 else 0
                ca_last5_per_day = ca_last5 / 5 if ca_last5 > 0 else 0
                if ca_avg_per_day > 0 and ca_last5_per_day > 0:
                    trend_pct = ((ca_last5_per_day - ca_avg_per_day) / ca_avg_per_day) * 100
                    trend_dir = "en hausse" if trend_pct > 5 else ("en baisse" if trend_pct < -5 else "stable")
                    trend_block = (
                        f"\n📈 TENDANCE (5 derniers jours vs moyenne de la période) :\n"
                        f"- CA moyen/jour sur la période : {ca_avg_per_day:.0f}€\n"
                        f"- CA moyen/jour sur les 5 derniers jours : {ca_last5_per_day:.0f}€ ({trend_pct:+.0f}%)\n"
                        f"→ Tendance {trend_dir} — {'Momentum positif à entretenir.' if trend_pct > 5 else ('Alerte : le rythme ralentit.' if trend_pct < -5 else 'Rythme constant.')}\n"
                    )
    except Exception as _e:
        logger.warning("Could not compute trend for store KPI analysis: %s", _e)

    # Active store objectives with realized progress
    objectives_block = ""
    if manager_id and resolved_store_id:
        try:
            all_objs = await manager_service.get_active_objectives(manager_id, resolved_store_id)
            period_objs = [
                o for o in (all_objs or [])
                if o.get("period_start", "") <= end_date and o.get("period_end", "") >= start_date
            ][:4]
            if period_objs:
                kpi_map = {
                    "ca": total_ca, "ventes": total_ventes,
                    "panier_moyen": panier_moyen, "indice_vente": indice_vente,
                    "taux_transformation": taux_transformation,
                }
                obj_lines = []
                for o in period_objs:
                    kpi_key = o.get("kpi_type", "").lower()
                    target = o.get("target_value", 0)
                    title = o.get("title", kpi_key.upper())
                    period_end_obj = o.get("period_end", "")
                    realized = kpi_map.get(kpi_key)
                    if realized is not None and target and target > 0:
                        pct = (realized / target) * 100
                        status = "✅" if pct >= 100 else ("⚠️" if pct >= 70 else "❌")
                        obj_lines.append(
                            f"- {title} : objectif {target} → réalisé {realized:.0f} ({pct:.0f}%) {status} (échéance {period_end_obj})"
                        )
                    else:
                        obj_lines.append(f"- {title} : objectif {target} (échéance {period_end_obj})")
                if obj_lines:
                    objectives_block = (
                        "\n🎯 OBJECTIFS DU MAGASIN :\n"
                        + "\n".join(obj_lines)
                        + "\n→ Indique clairement si les objectifs sont atteints, en bonne voie, ou en retard.\n"
                    )
        except Exception as _e:
            logger.warning("Could not fetch objectives for store KPI analysis: %s", _e)

    prompt = f"""Tu es un expert en analyse de performance retail pour BOUTIQUES PHYSIQUES. Analyse UNIQUEMENT les données disponibles ci-dessous pour {period_text}. Ne mentionne PAS les données manquantes.
{disc_block}
CONTEXTE IMPORTANT : Il s'agit d'une boutique avec flux naturel de clients. Les "prospects" représentent les visiteurs entrés en boutique, PAS de prospection active à faire. Le travail consiste à transformer les visiteurs en acheteurs.

Magasin : {store_name}
Période analysée : {period_text}
DATE DU JOUR : {datetime.now().strftime('%d/%m/%Y')}
Points de données : {days_count} jours, {sellers_count} vendeurs

KPIs Disponibles :
{chr(10).join(['- ' + kpi for kpi in available_kpis]) if available_kpis else '(Aucun KPI calculé)'}

Totaux :
{chr(10).join(['- ' + total for total in available_totals]) if available_totals else '(Aucune donnée)'}
{prev_period_block}{top_sellers_block}{objectives_block}{trend_block}
CONSIGNES STRICTES :
- Analyse UNIQUEMENT les données présentes
- Cite TOUJOURS les chiffres exacts dans tes observations
- Commente les variations vs période précédente si disponible (>10% = notable)
- Si des objectifs sont fournis, indique explicitement s'ils sont atteints ou non
- Sois concis et direct (2-3 points max par section)
- Fournis des insights actionnables pour BOUTIQUE PHYSIQUE
- Focus sur : accueil, découverte besoins, argumentation, closing, fidélisation
- NE RECOMMANDE PAS de prospection active (boutique = flux entrant)
- NE COMMENCE PAS par "Bien sûr !" ou une formule introductive

IMPORTANT: Réponds UNIQUEMENT avec un JSON valide, sans markdown, sans balises de code.
Format exact :
{{
  "synthese": "Synthèse de 2-3 phrases avec les KPIs clés, les variations notables vs période précédente, et le statut des objectifs si disponibles",
  "action_prioritaire": "LA priorité absolue et concrète pour améliorer les KPIs du magasin cette semaine",
  "points_forts": ["KPI fort 1 avec chiffre exact et comparaison si possible", "KPI fort 2"],
  "points_attention": ["KPI à améliorer 1 avec chiffre et impact", "Point d'attention 2"],
  "recommandations": ["Action concrète 1 pour boutique physique (qui fait quoi, quand)", "Action 2", "Action 3"]
}}"""
    if not ai_service.available:
        fallback_kpis_text = chr(10).join(['- ' + kpi for kpi in available_kpis]) if available_kpis else '- Aucun KPI calculé'
        fallback_totals_text = chr(10).join(['- ' + total for total in available_totals]) if available_totals else '- Aucune donnée'
        fallback_analysis = {
            "synthese": f"Magasin {store_name} — {period_text}. {fallback_totals_text.replace(chr(10), ', ')}. Service IA indisponible.",
            "action_prioritaire": "Configurer le service IA pour obtenir des recommandations personnalisées.",
            "points_forts": [kpi for kpi in available_kpis[:2]] if available_kpis else [],
            "points_attention": [],
            "recommandations": [
                "Analyser le taux de transformation pour identifier les opportunités d'amélioration.",
                "Suivre l'évolution du panier moyen sur les prochaines semaines.",
            ],
        }
        return {
            "analysis": fallback_analysis,
            "store_name": store_name,
            "period": {"start": start_date, "end": end_date},
            "kpis": {
                "total_ca": total_ca,
                "total_ventes": total_ventes,
                "panier_moyen": round(panier_moyen, 2),
                "taux_transformation": round(taux_transformation, 1),
            },
        }
    try:
        raw_response = await ai_service._send_message(
            system_message=TEAM_ANALYSIS_SYSTEM_PROMPT,
            user_prompt=prompt,
            model="gpt-4o",
            temperature=0.5,
        )
        if not raw_response:
            raise Exception("No response from AI")
        import json as _json
        clean = raw_response.strip()
        if clean.startswith("```"):
            parts = clean.split("```")
            clean = parts[1] if len(parts) > 1 else clean
            if clean.startswith("json"):
                clean = clean[4:]
        analysis_dict = _json.loads(clean.strip())
    except Exception as ai_error:
        logger.error("Store KPI AI error: %s", ai_error)
        kpis_text = chr(10).join(['- ' + kpi for kpi in available_kpis]) if available_kpis else '- Aucun KPI'
        totals_text = chr(10).join(['- ' + total for total in available_totals]) if available_totals else '- Aucune donnée'
        analysis_dict = {
            "synthese": f"Magasin {store_name} — {period_text}. {totals_text.replace(chr(10), ', ')}.",
            "action_prioritaire": "Analyse IA temporairement indisponible — vérifier la configuration.",
            "points_forts": [kpi for kpi in available_kpis[:2]] if available_kpis else [],
            "points_attention": ["Service IA temporairement indisponible"],
            "recommandations": [
                "Réessayer l'analyse IA dans quelques instants.",
                "Consulter les KPIs manuellement en attendant.",
            ],
        }
    return {
        "analysis": analysis_dict,
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
            "days_count": days_count,
        },
    }


@router.post("/analyze-store-kpis")
async def analyze_store_kpis(
    request: Request,
    analysis_data: dict,
    store_id: Optional[str] = Query(None, description=QUERY_STORE_ID_REQUIS_GERANT),
    context: dict = Depends(get_store_context),
    ai_service: AIService = Depends(get_ai_service),
    manager_service: ManagerService = Depends(get_manager_service),
    kpi_service: ManagerKpiService = Depends(get_manager_kpi_service),
):
    """
    Generate AI-powered analysis of store KPIs (manager only).
    Uses GPT-4o with expert retail prompts for physical stores.
    """
    resolved_store_id = context.get("resolved_store_id") or store_id
    if not resolved_store_id:
        raise ValidationError("Le paramètre store_id est requis pour analyser les KPIs d'un magasin")
    return await run_store_kpi_analysis(
        resolved_store_id, analysis_data, manager_service, kpi_service, ai_service,
        manager_id=context.get("id"),
    )
