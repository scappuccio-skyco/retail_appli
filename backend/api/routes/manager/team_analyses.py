"""
Manager - Analyses IA équipe : historique, génération, suppression.
"""
from datetime import datetime, timezone, timedelta
import logging
from typing import Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, Query, Request

from core.constants import QUERY_STORE_ID_REQUIS_GERANT
from core.exceptions import AppException, NotFoundError
from api.routes.manager.dependencies import get_store_context
from api.dependencies_rate_limiting import rate_limit
from api.routes.manager.response_utils import pagination_dict
from api.dependencies import get_manager_service, get_ai_service
from services.manager_service import ManagerService
from services.ai_service import AIService, TEAM_ANALYSIS_SYSTEM_PROMPT, DISC_ADAPTATION_INSTRUCTIONS

router = APIRouter(prefix="")
logger = logging.getLogger(__name__)


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


@router.post("/analyze-team", dependencies=[rate_limit("30/hour")])
async def analyze_team(
    request: Request,
    analysis_data: dict,
    store_id: Optional[str] = Query(None, description=QUERY_STORE_ID_REQUIS_GERANT),
    context: dict = Depends(get_store_context),
    ai_service: AIService = Depends(get_ai_service),
    manager_service: ManagerService = Depends(get_manager_service),
):
    """Generate AI-powered analysis of team performance. Uses GPT-4o."""
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

    # Cache check: retourner une analyse récente (<6h) pour le même store+période
    if resolved_store_id:
        try:
            cached = await manager_service.get_cached_team_analysis(
                store_id=resolved_store_id,
                period_start=period_start,
                period_end=period_end,
            )
            if cached and cached.get("analysis"):
                logger.info(
                    "Cache hit: team analysis store=%s period=%s/%s",
                    resolved_store_id, period_start, period_end,
                )
                return {
                    "analysis": cached["analysis"],
                    "period_start": period_start,
                    "period_end": period_end,
                    "generated_at": cached["generated_at"],
                    "cached": True,
                }
        except Exception as _e:
            logger.warning("Cache check failed for team analysis: %s", _e)

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

    # Fetch store business context for AI personalization
    store_business_context = None
    if resolved_store_id:
        try:
            store_doc = await manager_service.get_store_by_id_simple(
                resolved_store_id, projection={"_id": 0, "business_context": 1}
            )
            if store_doc:
                store_business_context = store_doc.get("business_context")
        except Exception as _e:
            logger.warning("Could not fetch business context for team analysis: %s", _e)

    analysis_result = await ai_service.generate_team_analysis(
        team_data=team_data,
        period_label=period_label,
        manager_id=manager_id,
        manager_disc_profile=manager_disc_profile,
        prev_period_data=prev_period_data,
        team_objectives=team_objectives,
        previous_recommendations=previous_recommendations,
        business_context=store_business_context,
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
