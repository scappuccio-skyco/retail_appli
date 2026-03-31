"""
Manager - Analyses IA : team analyses, store KPI analysis (partagée manager + gérant).
"""
from datetime import datetime, timezone, timedelta
import logging
from typing import Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, Query, Request
from motor.motor_asyncio import AsyncIOMotorDatabase

from core.constants import (
    MONGO_GROUP,
    MONGO_IFNULL,
    MONGO_MATCH,
    QUERY_STORE_ID_REQUIS_GERANT,
)
from core.exceptions import AppException, NotFoundError, ValidationError
from api.routes.manager.dependencies import get_store_context
from api.dependencies_rate_limiting import rate_limit
from api.routes.manager.response_utils import pagination_dict
from api.dependencies import (
    get_manager_service,
    get_manager_kpi_service,
    get_ai_service,
)
from core.database import get_db
from services.manager_service import ManagerService
from services.manager import ManagerKpiService
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


@router.post("/compatibility-advice", dependencies=[rate_limit("20/minute")])
async def generate_compatibility_advice(
    request: Request,
    body: dict,
    context: dict = Depends(get_store_context),
    ai_service: AIService = Depends(get_ai_service),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Generate personalized AI compatibility advice between a manager and a seller."""
    manager_diagnostic = body.get("manager_diagnostic") or {}
    seller_name = body.get("seller_name", "Le vendeur")
    seller_style = body.get("seller_style", "")
    seller_id = body.get("seller_id")

    # Extract manager data for the prompt
    mgr_style = manager_diagnostic.get("profil_nom") or manager_diagnostic.get("management_style", "")
    disc = manager_diagnostic.get("disc_percentages") or {}
    disc_str = f"D:{disc.get('D',0)}% / I:{disc.get('I',0)}% / S:{disc.get('S',0)}% / C:{disc.get('C',0)}%"
    disc_dom = manager_diagnostic.get("disc_dominant", "")
    force_1 = manager_diagnostic.get("force_1", "")
    force_2 = manager_diagnostic.get("force_2", "")
    axe = manager_diagnostic.get("axe_progression", "")

    system_message = (
        "Tu es un expert en management, psychologie comportementale et développement commercial. "
        "Tu génères des conseils hyper-personnalisés basés sur les profils DISC et les styles de management/vente. "
        "Tes conseils sont concrets, actionnables, bienveillants et basés sur les données réelles fournies. "
        "Tu réponds UNIQUEMENT en JSON valide, sans markdown, sans commentaire."
    )

    user_prompt = f"""Génère des conseils de collaboration personnalisés pour ce duo manager-vendeur.

PROFIL MANAGER :
- Style de management : {mgr_style}
- DISC : {disc_str} (dominant : {disc_dom})
- Force 1 : {force_1}
- Force 2 : {force_2}
- Axe de progression : {axe}

PROFIL VENDEUR :
- Nom : {seller_name}
- Style de vente : {seller_style}

Génère 4 conseils personnalisés pour le manager et 4 conseils pour le vendeur.
Les conseils doivent être spécifiquement basés sur les scores DISC du manager et le style de vente du vendeur.
Chaque conseil doit être concret, court (1-2 phrases) et directement actionnable.

Réponds UNIQUEMENT avec ce JSON (sans markdown) :
{{
  "manager": [
    "conseil 1 personnalisé pour le manager",
    "conseil 2",
    "conseil 3",
    "conseil 4"
  ],
  "seller": [
    "conseil 1 personnalisé pour {seller_name}",
    "conseil 2",
    "conseil 3",
    "conseil 4"
  ]
}}"""

    if not ai_service.available:
        raise AppException(status_code=503, message="Service IA non disponible")

    try:
        raw = await ai_service._send_message(
            system_message=system_message,
            user_prompt=user_prompt,
            model="gpt-4o",
        )
        import json as _json
        # Strip potential markdown fences
        cleaned = raw.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("```")[1]
            if cleaned.startswith("json"):
                cleaned = cleaned[4:]
        advice = _json.loads(cleaned)
        result = {
            "manager": advice.get("manager", []),
            "seller": advice.get("seller", []),
            "data_used": {
                "manager_style": mgr_style,
                "disc": disc_str,
                "disc_dominant": disc_dom,
                "force_1": force_1,
                "force_2": force_2,
                "axe_progression": axe,
                "seller_style": seller_style,
            },
        }
        # Persist advice so seller can retrieve it later
        if seller_id:
            try:
                manager_id = context.get("id")
                record = {
                    "seller_id": seller_id,
                    "manager_id": manager_id,
                    "advice": result,
                    "generated_at": datetime.now(timezone.utc).isoformat(),
                }
                await db["compatibility_advices"].update_one(
                    {"seller_id": seller_id},
                    {"$set": record},
                    upsert=True,
                )
            except Exception as _e:
                logger.warning("Could not persist compatibility advice: %s", _e)
        return result
    except Exception as e:
        logger.error("Error generating compatibility advice: %s", e)
        raise AppException(status_code=500, message="Erreur lors de la génération des conseils IA")


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
        projection={"_id": 0, "name": 1, "location": 1, "business_context": 1},
    )
    if not store:
        raise NotFoundError("Magasin non trouvé")
    store_name = store.get("name", "Magasin")
    business_context = store.get("business_context") or {}
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

    # Build business context block
    business_context_block = ""
    if business_context:
        bc_lines = []
        if business_context.get("type_commerce"):
            bc_lines.append(f"- Type : {business_context['type_commerce']}")
        if business_context.get("positionnement"):
            bc_lines.append(f"- Positionnement : {business_context['positionnement']}")
        if business_context.get("clientele_cible"):
            cible = business_context["clientele_cible"]
            if isinstance(cible, list):
                cible = ", ".join(cible)
            bc_lines.append(f"- Clientèle cible : {cible}")
        if business_context.get("format_magasin"):
            bc_lines.append(f"- Format : {business_context['format_magasin']}")
        if business_context.get("duree_vente"):
            bc_lines.append(f"- Durée de vente typique : {business_context['duree_vente']}")
        if business_context.get("kpi_prioritaire"):
            bc_lines.append(f"- KPI prioritaire : {business_context['kpi_prioritaire']}")
        if business_context.get("saisonnalite"):
            bc_lines.append(f"- Saisonnalité : {business_context['saisonnalite']}")
        if business_context.get("contexte_libre"):
            bc_lines.append(f"- Contexte : {business_context['contexte_libre']}")
        if bc_lines:
            business_context_block = "\n🏪 CONTEXTE MÉTIER DU MAGASIN :\n" + "\n".join(bc_lines) + "\n→ Adapte tes recommandations à ce contexte spécifique.\n"

    _default_store_context = "" if business_context_block else (
        'CONTEXTE IMPORTANT : Il s\'agit d\'une boutique avec flux naturel de clients. '
        'Les "prospects" représentent les visiteurs entrés en boutique, PAS de prospection active à faire. '
        'Le travail consiste à transformer les visiteurs en acheteurs.\n'
    )
    _no_prospection_rule = "" if business_context_block else "- NE RECOMMANDE PAS de prospection active (boutique = flux entrant)\n"
    prompt = f"""Tu es un expert en analyse de performance retail. Analyse UNIQUEMENT les données disponibles ci-dessous pour {period_text}. Ne mentionne PAS les données manquantes.
{disc_block}
{_default_store_context}{business_context_block}
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
- Fournis des insights actionnables adaptés au contexte du magasin
- Focus sur : accueil, découverte besoins, argumentation, closing, fidélisation
{_no_prospection_rule}- NE COMMENCE PAS par "Bien sûr !" ou une formule introductive

IMPORTANT: Réponds UNIQUEMENT avec un JSON valide, sans markdown, sans balises de code.
Format exact :
{{
  "synthese": "Synthèse de 2-3 phrases avec les KPIs clés, les variations notables vs période précédente, et le statut des objectifs si disponibles",
  "action_prioritaire": "LA priorité absolue et concrète pour améliorer les KPIs du magasin cette semaine",
  "points_forts": ["KPI fort 1 avec chiffre exact et comparaison si possible", "KPI fort 2"],
  "points_attention": ["KPI à améliorer 1 avec chiffre et impact", "Point d'attention 2"],
  "recommandations": ["Action concrète 1 adaptée au contexte du magasin (qui fait quoi, quand)", "Action 2", "Action 3"]
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


@router.post("/analyze-store-kpis", dependencies=[rate_limit("30/hour")])
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
