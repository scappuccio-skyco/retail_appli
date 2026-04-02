"""
Analyse IA KPIs magasin — logique partagée manager + gérant.
run_store_kpi_analysis() est importée par gerant/stores.py.
"""
from datetime import datetime, timezone, timedelta
import logging
from typing import Optional

from fastapi import APIRouter, Depends, Query, Request

from core.constants import (
    MONGO_GROUP,
    MONGO_IFNULL,
    MONGO_MATCH,
    QUERY_STORE_ID_REQUIS_GERANT,
)
from core.exceptions import NotFoundError, ValidationError
from api.routes.manager.dependencies import get_store_context
from api.dependencies_rate_limiting import rate_limit
from api.dependencies import get_manager_service, get_manager_kpi_service, get_ai_service
from services.manager_service import ManagerService
from services.manager import ManagerKpiService
from services.ai_service import AIService, TEAM_ANALYSIS_SYSTEM_PROMPT, DISC_ADAPTATION_INSTRUCTIONS

router = APIRouter(prefix="")
logger = logging.getLogger(__name__)


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
