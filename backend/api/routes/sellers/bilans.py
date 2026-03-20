"""
Seller Bilans Routes
Routes for store info and bilan individuel IA.
"""
from fastapi import APIRouter, Depends, Query
from typing import Dict, Optional
from datetime import datetime, timezone
import uuid
import logging

from api.dependencies_rate_limiting import rate_limit
from services.seller_service import SellerService
from api.dependencies import get_seller_service
from core.security import get_current_seller
from core.exceptions import NotFoundError, ValidationError

router = APIRouter()
logger = logging.getLogger(__name__)


# ===== STORE INFO FOR SELLER =====

@router.get("/store-info")
async def get_seller_store_info(
    current_user: Dict = Depends(get_current_seller),
    seller_service: SellerService = Depends(get_seller_service),
):
    """Get basic store info for the seller's store."""
    try:
        seller = await seller_service.get_seller_profile(
            current_user['id'],
            projection={"_id": 0, "store_id": 1}
        )

        if not seller or not seller.get('store_id'):
            return {"name": "Magasin", "id": None}

        store = await seller_service.get_store_by_id(
            store_id=seller['store_id'],
            projection={"_id": 0, "id": 1, "name": 1, "location": 1}
        )

        if not store:
            return {"name": "Magasin", "id": seller['store_id']}

        return store

    except Exception as e:
        return {"name": "Magasin", "id": None}


# ===== BILAN INDIVIDUEL =====

@router.get("/bilan-individuel/all")
async def get_all_bilans_individuels(
    current_user: Dict = Depends(get_current_seller),
    seller_service: SellerService = Depends(get_seller_service),
):
    """Get all individual performance reports (bilans) for seller."""
    bilans_result = await seller_service.get_bilans_paginated(
        current_user['id'], page=1, size=50
    )
    return {
        "status": "success",
        "bilans": bilans_result.items,
        "pagination": {
            "total": bilans_result.total,
            "page": bilans_result.page,
            "size": bilans_result.size,
            "pages": bilans_result.pages
        }
    }


@router.post("/bilan-individuel", dependencies=[rate_limit("5/minute")])
async def generate_bilan_individuel(
    start_date: Optional[str] = Query(None, description="Start date YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="End date YYYY-MM-DD"),
    current_user: Dict = Depends(get_current_seller),
    seller_service: SellerService = Depends(get_seller_service),
):
    """Generate an individual performance report for a period."""
    from uuid import uuid4
    from services.ai_service import AIService
    import json

    seller_id = current_user['id']
    # Dates par défaut : 7 derniers jours si non fournies
    from datetime import date as _date, timedelta as _timedelta
    eff_start = start_date or (_date.today() - _timedelta(days=6)).isoformat()
    eff_end = end_date or _date.today().isoformat()

    # Source unique de vérité — agrégation 100% server-side (pas de pagination, pas d'approximation)
    metrics = await seller_service.get_seller_kpi_metrics(seller_id, eff_start, eff_end)
    total_ca = metrics['ca']
    total_ventes = metrics['ventes']
    total_articles = metrics['articles']
    total_prospects = metrics['prospects']
    panier_moyen = metrics['panier_moyen']
    indice_vente = metrics['indice_vente']
    taux_transformation = metrics['taux_transformation']
    nb_jours = metrics['nb_jours']

    # Try to generate AI bilan with structured format
    ai_service = AIService()
    seller_data = await seller_service.get_seller_profile(seller_id)
    seller_name = seller_data.get('name', 'Vendeur') if seller_data else 'Vendeur'
    # Retrieve seller DISC profile for personalization
    diagnostic = await seller_service.get_diagnostic_for_seller(seller_id)
    disc_profile = diagnostic.get('profile', {}) if diagnostic else {}
    disc_style = disc_profile.get('style', '') if disc_profile else ''
    synthese = ""
    points_forts = []
    points_attention = []
    recommandations = []
    action_prioritaire = ""

    # Calcul du libellé de période et des bornes (utilisé par IA + fallback)
    from datetime import date as _date2
    _start = _date2.fromisoformat(eff_start)
    _end = _date2.fromisoformat(eff_end)
    _nb_days = (_end - _start).days + 1
    if _nb_days == 1:
        _period_label = f"le {_start.strftime('%d/%m/%Y')}"
    elif _nb_days <= 7:
        _period_label = f"la semaine du {_start.strftime('%d/%m')} au {_end.strftime('%d/%m/%Y')}"
    elif _nb_days <= 31:
        _period_label = f"le mois du {_start.strftime('%d/%m')} au {_end.strftime('%d/%m/%Y')}"
    else:
        _period_label = f"la période du {_start.strftime('%d/%m/%Y')} au {_end.strftime('%d/%m/%Y')}"

    if ai_service.available and nb_jours > 0:
            try:
                # --- Période précédente (même durée) pour comparaison ---
                prev_metrics_block = ""
                try:
                    _prev_end = (_start - _timedelta(days=1))
                    _prev_start = (_start - _timedelta(days=_nb_days))
                    prev_m = await seller_service.get_seller_kpi_metrics(
                        seller_id, _prev_start.isoformat(), _prev_end.isoformat()
                    )
                    if prev_m.get('nb_jours', 0) > 0:
                        def _pct(cur, prev):
                            if prev == 0:
                                return "N/A"
                            diff = ((cur - prev) / prev) * 100
                            return f"+{diff:.0f}%" if diff >= 0 else f"{diff:.0f}%"
                        prev_metrics_block = (
                            f"\n📊 PÉRIODE PRÉCÉDENTE ({_prev_start.strftime('%d/%m')} → {_prev_end.strftime('%d/%m')}) :\n"
                            f"- CA : {prev_m['ca']:.0f}€  ({_pct(total_ca, prev_m['ca'])} vs période actuelle)\n"
                            f"- Ventes : {prev_m['ventes']}  ({_pct(total_ventes, prev_m['ventes'])})\n"
                            f"- Panier moyen : {prev_m['panier_moyen']:.2f}€  ({_pct(panier_moyen, prev_m['panier_moyen'])})\n"
                        )
                        if prev_m.get('indice_vente', 0) > 0:
                            prev_metrics_block += f"- IV : {prev_m['indice_vente']:.2f}  ({_pct(indice_vente, prev_m['indice_vente'])})\n"
                        prev_metrics_block += "→ Commente OBLIGATOIREMENT les variations significatives (>10%) dans ta synthèse.\n"
                except Exception as _e:
                    logger.warning("Could not fetch previous period metrics: %s", _e)

                # --- Objectifs actifs pour la période ---
                objectives_block = ""
                try:
                    active_objectives = await seller_service.get_seller_objectives_active(seller_id)
                    period_objs = [
                        o for o in (active_objectives or [])
                        if o.get("period_start", "") <= eff_end and o.get("period_end", "") >= eff_start
                    ]
                    if period_objs:
                        obj_lines = []
                        for o in period_objs[:3]:
                            target = o.get("target_value", 0)
                            kpi = o.get("kpi_type", "")
                            if kpi == "ca":
                                realized = total_ca
                                unit = "€"
                            elif kpi == "ventes":
                                realized = total_ventes
                                unit = " ventes"
                            elif kpi == "panier_moyen":
                                realized = panier_moyen
                                unit = "€"
                            elif kpi == "indice_vente":
                                realized = indice_vente
                                unit = ""
                            else:
                                continue
                            pct_obj = (realized / target * 100) if target > 0 else 0
                            obj_lines.append(
                                f"- Objectif {kpi.upper()} : {target}{unit} → réalisé {realized:.0f}{unit} ({pct_obj:.0f}%)"
                            )
                        if obj_lines:
                            objectives_block = (
                                "\n🎯 OBJECTIFS DE LA PÉRIODE :\n"
                                + "\n".join(obj_lines)
                                + "\n→ Indique clairement si les objectifs sont atteints ou non, avec les écarts chiffrés.\n"
                            )
                except Exception as _e:
                    logger.warning("Could not fetch objectives for bilan: %s", _e)

                # --- KPI optionnels ---
                optional_kpis = []
                if total_prospects > 0:
                    optional_kpis.append(f"- Prospects contactés : {total_prospects} → taux de transformation : {taux_transformation:.1f}%")
                if total_articles > 0:
                    optional_kpis.append(f"- Articles vendus : {total_articles} → indice de vente : {indice_vente:.2f} art/vente")
                optional_block = "\n".join(optional_kpis) if optional_kpis else ""

                # --- Meilleur jour + jour de semaine le plus fort (périodes > 7 jours) ---
                best_day_block = ""
                if _nb_days > 7:
                    try:
                        from collections import defaultdict
                        from datetime import datetime as _dt
                        _best_page = await seller_service.get_kpis_for_period_paginated(seller_id, eff_start, eff_end, page=1, size=400)
                        entries_for_best = _best_page.items if hasattr(_best_page, 'items') else []
                        if entries_for_best:
                            active_entries = [e for e in entries_for_best if e.get("ca_journalier", 0) > 0]
                            if active_entries:
                                best = max(active_entries, key=lambda e: e.get("ca_journalier", 0))
                                worst = min(active_entries, key=lambda e: e.get("ca_journalier", 0))
                                best_day_block = f"\n📅 MEILLEUR JOUR : {best.get('date','')} — {best.get('ca_journalier',0):.0f}€, {best.get('nb_ventes',0)} ventes"
                                if worst.get("date") != best.get("date"):
                                    best_day_block += f"\n📅 JOUR LE PLUS FAIBLE : {worst.get('date','')} — {worst.get('ca_journalier',0):.0f}€"
                                # Jour de semaine le plus performant
                                _day_names = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"]
                                _dow = defaultdict(lambda: {"ca": 0.0, "n": 0})
                                for e in active_entries:
                                    try:
                                        _d = _dt.fromisoformat(e["date"])
                                        _dow[_d.weekday()]["ca"] += e.get("ca_journalier", 0)
                                        _dow[_d.weekday()]["n"] += 1
                                    except Exception:
                                        pass
                                _dow_avgs = {k: v["ca"] / v["n"] for k, v in _dow.items() if v["n"] > 0}
                                if len(_dow_avgs) >= 3:
                                    _best_dow = max(_dow_avgs, key=_dow_avgs.get)
                                    _worst_dow = min(_dow_avgs, key=_dow_avgs.get)
                                    best_day_block += (
                                        f"\n📆 MEILLEUR JOUR DE SEMAINE : {_day_names[_best_dow]} (moy. {_dow_avgs[_best_dow]:.0f}€/jour)"
                                        f"\n📆 JOUR LE PLUS FAIBLE : {_day_names[_worst_dow]} (moy. {_dow_avgs[_worst_dow]:.0f}€/jour)"
                                    )
                                best_day_block += "\n→ Cite ces patterns dans tes recommandations (ex : renforcer la préparation le jour faible).\n"
                    except Exception as _e:
                        logger.warning("Could not fetch entries for best day: %s", _e)

                # --- DISC block ---
                disc_block = ""
                if disc_style:
                    disc_block = f"\n🎭 PROFIL DISC : {disc_style} — adapte ton ton (D=direct/résultats, I=enthousiaste, S=rassurant, C=factuel/chiffres).\n"

                # --- Scores de compétences (avec fiabilité selon nb debriefs) ---
                scores_block = ""
                if diagnostic:
                    # Fetch total debrief count + most recent debrief scores
                    _total_debrief_count = 0
                    _score_source = "questionnaire initial"
                    try:
                        _all_debriefs_scores = await seller_service.get_debriefs_by_seller(
                            seller_id,
                            projection={"_id": 0, "score_accueil": 1, "score_decouverte": 1,
                                        "score_argumentation": 1, "score_closing": 1,
                                        "score_fidelisation": 1, "date": 1},
                            limit=200,
                            sort=[("date", -1)],
                        )
                        _total_debrief_count = len(_all_debriefs_scores)
                        if _total_debrief_count > 0:
                            _latest = _all_debriefs_scores[0]
                            # Use latest debrief scores if all keys are present and non-zero
                            if _latest.get('score_accueil') or _latest.get('score_argumentation'):
                                diagnostic = {**diagnostic,
                                    'score_accueil': _latest.get('score_accueil', diagnostic.get('score_accueil', 6.0)),
                                    'score_decouverte': _latest.get('score_decouverte', diagnostic.get('score_decouverte', 6.0)),
                                    'score_argumentation': _latest.get('score_argumentation', diagnostic.get('score_argumentation', 6.0)),
                                    'score_closing': _latest.get('score_closing', diagnostic.get('score_closing', 6.0)),
                                    'score_fidelisation': _latest.get('score_fidelisation', diagnostic.get('score_fidelisation', 6.0)),
                                }
                                _score_source = f"{_total_debrief_count} debrief(s)"
                    except Exception as _e:
                        logger.warning("Could not fetch debrief scores for bilan: %s", _e)

                    scores = {
                        "Accueil": diagnostic.get('score_accueil', 6.0),
                        "Découverte": diagnostic.get('score_decouverte', 6.0),
                        "Argumentation": diagnostic.get('score_argumentation', 6.0),
                        "Closing": diagnostic.get('score_closing', 6.0),
                        "Fidélisation": diagnostic.get('score_fidelisation', 6.0),
                    }
                    sorted_scores = sorted(scores.items(), key=lambda x: x[1])
                    weakest = sorted_scores[:2]
                    strongest = sorted_scores[-2:]
                    _score_reliability = (
                        "⚠️ FIABILITÉ FAIBLE (scores basés sur questionnaire initial uniquement — 0 debrief soumis)"
                        if _total_debrief_count == 0
                        else f"📊 Fiabilité : {_total_debrief_count} debrief(s) soumis — scores progressivement affinés"
                    )
                    scores_block = (
                        f"\n📈 COMPÉTENCES (sur 10) — source : {_score_source} :\n"
                        + "".join(f"- {k} : {v:.1f}/10\n" for k, v in scores.items())
                        + f"→ Forces : {', '.join(f'{k} ({v:.1f})' for k,v in strongest)}\n"
                        + f"→ À travailler : {', '.join(f'{k} ({v:.1f})' for k,v in weakest)}\n"
                        + f"→ {_score_reliability}\n"
                        + ("→ Ne signale PAS ces scores comme 'à améliorer' sauf si score < 5.0 ET au moins 3 debriefs soumis. "
                           "Si fiabilité faible, INVITE le vendeur à soumettre des debriefs pour affiner son profil de compétences.\n"
                           if _total_debrief_count < 3
                           else "→ Ces scores sont fiables — souligne les axes de progression dans les recommandations.\n")
                        + "→ Lie chaque recommandation à une compétence précise.\n"
                    )

                # --- Debriefs ---
                debrief_bilan_block = ""
                try:
                    all_debriefs_bilan = await seller_service.get_debriefs_by_seller(
                        seller_id,
                        projection={"_id": 0, "vente_conclue": 1, "moment_perte_client": 1, "raison_perte": 1, "date": 1},
                        limit=100,
                        sort=[("date", -1)],
                    )
                    period_debriefs_bilan = [
                        d for d in all_debriefs_bilan
                        if eff_start <= (d.get("date") or "") <= eff_end
                    ]
                    if period_debriefs_bilan:
                        nb_d = len(period_debriefs_bilan)
                        nb_success_d = sum(1 for d in period_debriefs_bilan if d.get("vente_conclue"))
                        nb_fail_d = nb_d - nb_success_d
                        pertes = [
                            d.get("moment_perte_client", "") or d.get("raison_perte", "")
                            for d in period_debriefs_bilan
                            if not d.get("vente_conclue")
                        ]
                        pertes = [p for p in pertes if p]
                        most_common_perte = max(set(pertes), key=pertes.count) if pertes else None
                        taux_debrief = (nb_success_d / nb_d * 100) if nb_d > 0 else 0
                        debrief_bilan_block = (
                            f"\n🗒️ DEBRIEFS ({nb_d} soumis) : {nb_success_d} ✅ ventes conclues ({taux_debrief:.0f}%), {nb_fail_d} ❌ manquées\n"
                        )
                        if most_common_perte:
                            debrief_bilan_block += f"  - Perte récurrente : \"{most_common_perte}\"\n"
                        debrief_bilan_block += "→ Lie directement ces résultats aux scores de compétences pour des recommandations précises.\n"
                except Exception as _e:
                    logger.warning("Could not fetch debriefs for bilan: %s", _e)

                # --- Continuité avec le bilan précédent ---
                prev_bilan_block = ""
                try:
                    prev_bilans = await seller_service.get_bilans_paginated(seller_id, page=1, size=1)
                    prev_items = prev_bilans.items if hasattr(prev_bilans, 'items') else (prev_bilans if isinstance(prev_bilans, list) else [])
                    if prev_items:
                        prev_recos = prev_items[0].get("recommandations", [])
                        if prev_recos:
                            prev_bilan_block = (
                                "\n📋 RECOMMANDATIONS DU BILAN PRÉCÉDENT (construis dessus, ne répète pas) :\n"
                                + "\n".join(f"- {r}" for r in prev_recos[:3])
                                + "\n"
                            )
                except Exception as _e:
                    logger.warning("Could not fetch previous bilan: %s", _e)

                # --- Benchmarks équipe (moyenne des autres vendeurs du même magasin) ---
                team_benchmark_block = ""
                try:
                    store_id = current_user.get("store_id") or seller_data.get("store_id") if seller_data else None
                    if store_id:
                        _team_pipeline = [
                            {"$match": {"store_id": store_id, "date": {"$gte": eff_start, "$lte": eff_end}}},
                            {"$group": {
                                "_id": "$seller_id",
                                "total_ca": {"$sum": {"$ifNull": ["$ca_journalier", 0]}},
                                "total_ventes": {"$sum": {"$ifNull": ["$nb_ventes", 0]}},
                                "total_articles": {"$sum": {"$ifNull": ["$nb_articles", 0]}},
                            }},
                            {"$group": {
                                "_id": None,
                                "nb_sellers": {"$sum": 1},
                                "avg_ca": {"$avg": "$total_ca"},
                                "avg_ventes": {"$avg": "$total_ventes"},
                                "avg_pm": {"$avg": {
                                    "$cond": [{"$gt": ["$total_ventes", 0]},
                                              {"$divide": ["$total_ca", "$total_ventes"]}, 0]
                                }},
                                "avg_iv": {"$avg": {
                                    "$cond": [{"$gt": ["$total_articles", 0]},
                                              {"$cond": [{"$gt": ["$total_ventes", 0]},
                                                         {"$divide": ["$total_articles", "$total_ventes"]}, 0]}, 0]
                                }},
                            }},
                        ]
                        _team_res = await seller_service.kpi_repo.aggregate(_team_pipeline, max_results=1)
                        if _team_res and _team_res[0].get("nb_sellers", 0) > 1:
                            _t = _team_res[0]
                            _nb_s = _t["nb_sellers"]
                            def _vs_team(val, avg):
                                if avg == 0: return ""
                                diff = ((val - avg) / avg) * 100
                                return f" ({'au-dessus' if diff > 0 else 'en-dessous'} de {abs(diff):.0f}% de la moy. équipe)"
                            team_benchmark_block = (
                                f"\n🏆 COMPARAISON ÉQUIPE ({_nb_s} vendeurs, même période) :\n"
                                f"- CA moyen équipe : {_t['avg_ca']:.0f}€ → toi : {total_ca:.0f}€{_vs_team(total_ca, _t['avg_ca'])}\n"
                                f"- PM moyen équipe : {_t['avg_pm']:.2f}€ → toi : {panier_moyen:.2f}€{_vs_team(panier_moyen, _t['avg_pm'])}\n"
                            )
                            if _t.get("avg_iv", 0) > 0 and indice_vente > 0:
                                team_benchmark_block += f"- IV moyen équipe : {_t['avg_iv']:.2f} → toi : {indice_vente:.2f}{_vs_team(indice_vente, _t['avg_iv'])}\n"
                            team_benchmark_block += "→ Mentionne OBLIGATOIREMENT ces comparaisons dans ta synthèse et tes points forts/attention.\n"
                except Exception as _e:
                    logger.warning("Could not fetch team benchmarks: %s", _e)

                # --- Adaptation selon la durée de la période ---
                if _nb_days == 1:
                    period_context = "C'est une analyse JOURNALIÈRE. Sois concis (1-2 points max par section). Focus sur ce qui s'est passé aujourd'hui spécifiquement."
                    min_points = 2
                elif _nb_days <= 7:
                    period_context = "C'est une analyse HEBDOMADAIRE. 2-3 points par section. Identifie les tendances de la semaine."
                    min_points = 2
                elif _nb_days <= 31:
                    period_context = "C'est une analyse MENSUELLE. 3 points par section. Donne une vue d'ensemble du mois avec les temps forts."
                    min_points = 3
                else:
                    period_context = "C'est une analyse ANNUELLE. 3-4 points par section. Analyse les grandes tendances, les mois forts/faibles, et la progression globale."
                    min_points = 3

                # SELLER PROMPT V6 — Context-rich, team-benchmarked, period-aware
                prompt = f"""Tu es un coach de vente retail expert. Génère un bilan PERSONNALISÉ pour {seller_name}.
{disc_block}
⏱️ TYPE D'ANALYSE : {period_context}

📊 DONNÉES DE {_period_label.upper()} :
- CA : {total_ca:.0f}€  |  Jours avec données : {nb_jours}/{_nb_days}
- Ventes : {total_ventes}  |  Panier moyen : {panier_moyen:.2f}€
{optional_block}
{prev_metrics_block}
{team_benchmark_block}
{objectives_block}
{best_day_block}
{scores_block}
{debrief_bilan_block}
{prev_bilan_block}
🚫 RÈGLES :
1. Cite TOUJOURS les chiffres réels (CA, PM, IV, scores, % variation, position équipe).
2. INTERDIT : conseils vagues, "saisie des KPI", trafic, marketing, promotions.
3. Si tu as les benchmarks équipe, positionne le vendeur clairement (meilleur/dans la moyenne/en-dessous).
4. Si une variation vs période précédente est notable (>10%), explique-la avec un levier d'action.
5. Points forts = chiffres ÉLEVÉS, PROGRESSIONS ou POSITION HAUTE dans l'équipe.
6. Points d'amélioration = scores BAS, ratios sous-performants ou retard vs équipe, avec valeur + impact.
7. Recommandations = techniques de vente concrètes et spécifiques applicables dès demain.
8. action_prioritaire = UNE seule priorité absolue pour la prochaine période (phrase courte, percutante).
9. Minimum {min_points} éléments par section (sauf action_prioritaire = 1).

Réponds en JSON :
{{
  "synthese": "2-4 phrases : CA ({total_ca:.0f}€), position vs équipe si disponible, évolution vs période précédente",
  "action_prioritaire": "La seule chose à faire absolument cette période — courte, précise, avec chiffre cible",
  "points_forts": ["Fort 1 avec chiffre précis", "Fort 2", ...],
  "points_attention": ["Axe 1 : chiffre + impact terrain", "Axe 2", ...],
  "recommandations": ["Action terrain précise 1 (technique + geste)", "Action 2", ...]
}}"""

                # Import the strict prompt + DISC adaptation instructions
                from services.ai_service import SELLER_STRICT_SYSTEM_PROMPT, DISC_ADAPTATION_INSTRUCTIONS
                system_prompt = SELLER_STRICT_SYSTEM_PROMPT + "\n" + DISC_ADAPTATION_INSTRUCTIONS + "\nRéponds uniquement en JSON valide."

                response = await ai_service._send_message(
                    system_message=system_prompt,
                    user_prompt=prompt,
                    model="gpt-4o",
                    temperature=0.4,
                )

                if response:
                    # Parse JSON
                    clean = response.strip()
                    if "```json" in clean:
                        clean = clean.split("```json")[1].split("```")[0]
                    elif "```" in clean:
                        clean = clean.split("```")[1].split("```")[0]

                    try:
                        parsed = json.loads(clean.strip())
                        synthese = parsed.get('synthese', '')
                        action_prioritaire = parsed.get('action_prioritaire', '')
                        points_forts = parsed.get('points_forts', [])
                        points_attention = parsed.get('points_attention', [])
                        recommandations = parsed.get('recommandations', [])
                    except:
                        # Fallback: use raw response as synthese
                        synthese = response[:500] if response else ""

            except Exception as e:
                logger.error("AI bilan error: %s", e, exc_info=True)
    # If no AI, generate basic bilan
    if not synthese:
        if nb_jours > 0:
            synthese = f"Sur {_period_label}, tu as réalisé {total_ventes} ventes pour un CA de {total_ca:.0f}€ (panier moyen : {panier_moyen:.0f}€)."
            points_forts = [f"CA de {total_ca:.0f}€ sur la période"]
            points_attention = ["Continue à développer tes compétences de closing"]
            recommandations = ["Fixe-toi un objectif quotidien de ventes", "Analyse tes meilleures ventes pour reproduire les succès"]
        else:
            synthese = "Aucune donnée KPI pour cette période. Commence à saisir tes performances !"
            points_attention = ["Pense à saisir tes KPIs quotidiennement"]
            recommandations = ["Saisis tes ventes chaque jour pour obtenir un bilan personnalisé"]
    periode = f"{eff_start} - {eff_end}"
    bilan = {
        "id": str(uuid4()),
        "seller_id": seller_id,
        "periode": periode,
        "period_start": eff_start,
        "period_end": eff_end,
        "kpi_resume": {
            "ca": round(total_ca, 2),
            "ventes": total_ventes,
            "articles": total_articles,
            "prospects": total_prospects,
            "panier_moyen": round(panier_moyen, 2),
            "indice_vente": round(indice_vente, 2),
            "taux_transformation": round(taux_transformation, 1),
            "jours": nb_jours,
        },
        "synthese": synthese,
        "action_prioritaire": action_prioritaire,
        "points_forts": points_forts,
        "points_attention": points_attention,
        "recommandations": recommandations,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await seller_service.create_bilan(bilan)
    if '_id' in bilan:
        del bilan['_id']
    return bilan

