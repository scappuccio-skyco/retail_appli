"""
AnalysisMixin - Team analysis, debrief, and diagnostic generation methods.
"""

import json
import logging
from typing import Dict, List, Optional
from datetime import datetime

from services.ai_service._prompts import (
    TEAM_ANALYSIS_SYSTEM_PROMPT,
    DEBRIEF_SYSTEM_PROMPT,
    DIAGNOSTIC_SYSTEM_PROMPT,
    DISC_ADAPTATION_INSTRUCTIONS,
    anonymize_name_for_ai,
    parse_json_safely,
)

logger = logging.getLogger(__name__)


class AnalysisMixin:
    """
    Mixin providing team analysis, debrief, and diagnostic generation.
    Relies on self._send_message and self.available from CoreMixin.
    """

    # ==========================================================================
    # 🏆 TEAM ANALYSIS (GPT-4o - Premium)
    # ==========================================================================

    async def generate_team_analysis(
        self,
        team_data: Dict,
        period_label: str = "sur 30 jours",
        manager_id: str = None,
        manager_disc_profile: Optional[Dict] = None,
        prev_period_data: Optional[Dict] = None,
        team_objectives: Optional[list] = None,
        previous_recommendations: Optional[list] = None,
        business_context: Optional[Dict] = None,
    ) -> Dict:
        """
        Generate comprehensive team analysis using GPT-4o

        This is the flagship analysis feature - uses the most powerful model
        for detailed managerial insights.

        Args:
            team_data: Team performance data with sellers_details
            period_label: Human-readable period description
            manager_id: Manager ID for session tracking
            manager_disc_profile: DISC profile of the manager (for tone adaptation)
            previous_recommendations: List of previous recommendations to avoid repeating

        Returns:
            Dict with synthese, action_prioritaire, points_forts, points_attention, recommandations
        """
        if not self.available:
            return self._fallback_team_analysis(team_data, period_label)

        # Build sellers summary sorted by CA descending (explicit ranking)
        sellers_raw = team_data.get('sellers_details', [])
        sellers_sorted = sorted(sellers_raw, key=lambda s: s.get('ca', 0), reverse=True)
        sellers_summary = []
        for rank, seller in enumerate(sellers_sorted, 1):
            anonymous_name = anonymize_name_for_ai(seller.get('name', 'Vendeur'))
            rank_label = " 🥇" if rank == 1 else (" ⚠️" if rank == len(sellers_sorted) and len(sellers_sorted) > 1 else "")

            # Core metrics
            ca = seller.get('ca', 0)
            ventes = seller.get('ventes', 0)
            pm = seller.get('panier_moyen', 0)
            iv = seller.get('indice_vente', 0)
            tv = seller.get('taux_transformation', 0)
            jours = seller.get('nb_jours_actifs', 0)
            disc_info = f", DISC: {seller.get('disc_style')}" if seller.get('disc_style') else ""
            competence = seller.get('avg_competence', 0)
            best_skill = seller.get('best_skill', '')
            worst_skill = seller.get('worst_skill', '')

            # Evolution vs previous period
            ca_prev = seller.get('ca_prev', 0)
            evolution_str = ""
            if ca_prev and ca_prev > 0:
                delta = ((ca - ca_prev) / ca_prev) * 100
                arrow = "↗" if delta > 1 else ("↘" if delta < -1 else "→")
                evolution_str = f", évolution CA: {delta:+.0f}% {arrow}"

            # Normalization: CA per working day
            ca_per_day_str = ""
            if jours and jours > 0:
                ca_per_day_str = f", CA/jour: {ca/jours:.0f}€ ({jours}j)"

            line = (
                f"- #{rank}{rank_label} {anonymous_name}: CA {ca:.0f}€, {ventes} ventes, PM {pm:.2f}€"
            )
            if iv > 0:
                line += f", IV: {iv:.2f}"
            if tv > 0:
                line += f", TV: {tv:.1f}%"
            if ca_per_day_str:
                line += ca_per_day_str
            if evolution_str:
                line += evolution_str
            if competence > 0:
                skill_detail = ""
                if best_skill and worst_skill:
                    skill_detail = f" (Fort: {best_skill}, Faible: {worst_skill})"
                elif best_skill:
                    skill_detail = f" (Fort: {best_skill})"
                line += f", Compétences: {competence:.1f}/10{skill_detail}"
            if disc_info:
                line += disc_info
            sellers_summary.append(line)

        # Build DISC adaptation section for the Manager
        manager_disc_style = manager_disc_profile.get('style', 'Non défini') if manager_disc_profile else 'Non défini'
        disc_section = f"""
👤 TON INTERLOCUTEUR (LE GÉRANT/MANAGER) EST DE PROFIL DISC : {manager_disc_style}
Adapte ton résumé exécutif et ton ton à ce style de communication.
{DISC_ADAPTATION_INSTRUCTIONS}
""" if manager_disc_profile else ""

        # Build previous period comparison block
        prev_period_block = ""
        if prev_period_data:
            prev_ca = prev_period_data.get("team_total_ca") or prev_period_data.get("ca_total") or 0
            prev_ventes = prev_period_data.get("team_total_ventes") or prev_period_data.get("ventes") or 0
            prev_pm = prev_period_data.get("team_panier_moyen") or 0
            prev_iv = prev_period_data.get("team_indice_vente") or 0
            curr_ca = team_data.get("team_total_ca", 0) or 0
            curr_ventes = team_data.get("team_total_ventes", 0) or 0
            curr_pm = team_data.get("team_panier_moyen", 0) or 0
            curr_iv = team_data.get("team_indice_vente", 0) or 0
            if prev_ca > 0:
                ca_delta = ((curr_ca - prev_ca) / prev_ca) * 100
                ventes_delta = ((curr_ventes - prev_ventes) / prev_ventes) * 100 if prev_ventes > 0 else 0
                ca_arrow = "↗" if ca_delta > 1 else ("↘" if ca_delta < -1 else "→")
                v_arrow = "↗" if ventes_delta > 1 else ("↘" if ventes_delta < -1 else "→")
                prev_period_block = (
                    f"\n📊 ÉVOLUTION VS PÉRIODE PRÉCÉDENTE :\n"
                    f"- CA : {curr_ca:.0f}€ vs {prev_ca:.0f}€ ({ca_delta:+.1f}%) {ca_arrow}\n"
                    f"- Ventes : {curr_ventes} vs {prev_ventes} ({ventes_delta:+.1f}%) {v_arrow}\n"
                )
                if prev_pm > 0 and curr_pm > 0:
                    pm_delta = ((curr_pm - prev_pm) / prev_pm) * 100
                    pm_arrow = "↗" if pm_delta > 1 else ("↘" if pm_delta < -1 else "→")
                    prev_period_block += f"- PM : {curr_pm:.2f}€ vs {prev_pm:.2f}€ ({pm_delta:+.1f}%) {pm_arrow}\n"
                if prev_iv > 0 and curr_iv > 0:
                    iv_delta = ((curr_iv - prev_iv) / prev_iv) * 100
                    iv_arrow = "↗" if iv_delta > 1 else ("↘" if iv_delta < -1 else "→")
                    prev_period_block += f"- IV : {curr_iv:.2f} vs {prev_iv:.2f} ({iv_delta:+.1f}%) {iv_arrow}\n"
                prev_period_block += "→ Commente OBLIGATOIREMENT les variations >10% dans ta synthèse.\n"

        # Build team objectives block
        team_objectives_block = ""
        if team_objectives:
            obj_lines = []
            for o in team_objectives[:5]:
                kpi_type = o.get("kpi_type", "").upper()
                target = o.get("target_value", 0)
                realized = o.get("realized_value")
                title = o.get("title", kpi_type)
                period_end = o.get("period_end", "")
                if realized is not None and target and target > 0:
                    pct = (realized / target) * 100
                    status = "✅" if pct >= 100 else ("⚠️" if pct >= 70 else "❌")
                    obj_lines.append(
                        f"- {title} : objectif {target} {kpi_type} → réalisé {realized:.0f} ({pct:.0f}%) {status} (échéance {period_end})"
                    )
                else:
                    obj_lines.append(f"- {title} : objectif {target} {kpi_type} (échéance {period_end})")
            if obj_lines:
                team_objectives_block = (
                    "\n🎯 OBJECTIFS ACTIFS DE L'ÉQUIPE :\n"
                    + "\n".join(obj_lines)
                    + "\n→ Indique clairement si l'équipe est en bonne voie, en retard, ou a atteint ses objectifs.\n"
                )

        # Build previous recommendations block
        prev_reco_block = ""
        if previous_recommendations:
            reco_text = "\n".join(f"- {r}" for r in previous_recommendations[:3])
            prev_reco_block = f"\n📋 RECOMMANDATIONS PRÉCÉDENTES (à NE PAS répéter, mais à faire évoluer) :\n{reco_text}\n"

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
                business_context_block = "\n🏪 CONTEXTE MÉTIER DU MAGASIN :\n" + "\n".join(bc_lines) + "\n→ Adapte tes recommandations managériales à ce contexte spécifique.\n"

        # 🎯 UPDATED PROMPT — JSON output
        prompt = f"""Tu es un expert en management retail et coaching d'équipe. Analyse cette équipe de boutique physique et fournis des recommandations managériales pour MOTIVER et DÉVELOPPER l'équipe.

CONTEXTE : Boutique physique avec flux naturel de clients. Focus sur performance commerciale ET dynamique d'équipe.
{business_context_block}

PÉRIODE D'ANALYSE : {period_label}
DATE DU JOUR : {datetime.now().strftime('%d/%m/%Y')} (permet de situer la période en cours)

ÉQUIPE :
- Taille : {team_data.get('total_sellers', 0)} vendeurs
- CA Total : {team_data.get('team_total_ca', 0):.0f} €
- Ventes Totales : {team_data.get('team_total_ventes', 0)}

VENDEURS :
{chr(10).join(sellers_summary)}
{prev_period_block}{disc_section}
{team_objectives_block}{prev_reco_block}
CONSIGNES :
- NE MENTIONNE PAS la complétion KPI (saisie des données) - c'est un sujet administratif, pas commercial
- Concentre-toi sur les PERFORMANCES COMMERCIALES et la DYNAMIQUE D'ÉQUIPE
- Cite TOUJOURS les chiffres exacts (CA, ventes, PM) pour chaque vendeur dans les points forts/attention
- Utilise le classement (#1, #2…) pour situer chaque vendeur dans l'équipe
- Fournis des recommandations MOTIVANTES et CONSTRUCTIVES
- Identifie les leviers de motivation individuels et collectifs
- 1 action_prioritaire = LA priorité managériale absolue pour la prochaine période
- Les points_forts et points_attention doivent inclure les chiffres des vendeurs concernés
- Les recommandations doivent être actionnables et concrètes (max 5 éléments par tableau)

IMPORTANT: Réponds UNIQUEMENT avec un JSON valide, sans markdown, sans balises de code.
Format exact :
{{
  "synthese": "Texte de synthèse de 2-3 phrases résumant la situation de l'équipe avec les chiffres clés (CA total, nombre de vendeurs, panier moyen)",
  "action_prioritaire": "Une seule phrase courte et percutante : LA priorité managériale absolue",
  "points_forts": ["Point fort 1 avec chiffres du vendeur concerné", "Point fort 2", "Point fort 3"],
  "points_attention": ["Point d'attention 1 avec chiffres", "Point d'attention 2"],
  "recommandations": ["Recommandation concrète 1 incluant action par vendeur si pertinent", "Recommandation 2", "Recommandation 3"]
}}"""

        # Use GPT-4o for complex analysis
        response = await self._send_message(
            system_message=TEAM_ANALYSIS_SYSTEM_PROMPT,
            user_prompt=prompt,
            model="gpt-4o",
            temperature=0.5
        )

        if response:
            try:
                import json as _json
                clean = response.strip()
                if clean.startswith("```"):
                    parts = clean.split("```")
                    clean = parts[1] if len(parts) > 1 else clean
                    if clean.startswith("json"):
                        clean = clean[4:]
                return _json.loads(clean.strip())
            except Exception:
                return {
                    "synthese": response,
                    "action_prioritaire": "",
                    "points_forts": [],
                    "points_attention": [],
                    "recommandations": [],
                }
        else:
            return self._fallback_team_analysis(team_data, period_label)

    def _fallback_team_analysis(self, team_data: Dict, period_label: str) -> Dict:
        """Fallback when AI is unavailable — returns structured dict"""
        total_ca = team_data.get('team_total_ca', 0)
        total_ventes = team_data.get('team_total_ventes', 0)
        total_sellers = team_data.get('total_sellers', 0)
        panier_moyen = total_ca / total_ventes if total_ventes > 0 else 0

        points_forts = []
        points_attention = []
        for seller in team_data.get('sellers_details', []):
            name = anonymize_name_for_ai(seller.get('name', 'Vendeur'))
            ca = seller.get('ca', 0)
            ventes = seller.get('ventes', 0)
            if ca > 0:
                points_forts.append(f"{name} : CA {ca:.0f}€, {ventes} ventes")

        return {
            "synthese": (
                f"Équipe de {total_sellers} vendeurs sur {period_label}. "
                f"CA total : {total_ca:.0f}€, {total_ventes} ventes, panier moyen : {panier_moyen:.0f}€. "
                "Analyse IA indisponible — données statistiques uniquement."
            ),
            "action_prioritaire": "Vérifier la configuration du service IA pour obtenir des recommandations personnalisées.",
            "points_forts": points_forts[:3] if points_forts else ["Données insuffisantes pour identifier les points forts"],
            "points_attention": points_attention[:2] if points_attention else [],
            "recommandations": [
                "Analyser les performances individuelles pour identifier les axes d'amélioration.",
                "Organiser un point d'équipe pour partager les bonnes pratiques.",
            ],
        }

    # ==========================================================================
    # 💬 DEBRIEF VENTE (Succès / Échec)
    # ==========================================================================

    async def generate_debrief(
        self,
        debrief_data: Dict,
        current_scores: Dict,
        kpi_context: str = "",
        is_success: bool = True,
        previous_coaching: Optional[List[Dict]] = None,
        disc_style: str = "",
        business_context: Optional[Dict] = None,
    ) -> Dict:
        """
        Generate sales debrief analysis

        Args:
            debrief_data: Debrief form data
            current_scores: Current competence scores
            kpi_context: Optional KPI context
            is_success: True for completed sale, False for missed opportunity

        Returns:
            Dict with analyse, points_travailler, recommandation, exemple_concret, scores
        """
        if not self.available:
            return self._fallback_debrief(current_scores, is_success)

        disc_block = ""
        if disc_style:
            _disc_tones = {
                "D": "Direct et orienté résultats — phrases courtes, chiffres, action immédiate.",
                "I": "Enthousiaste et humain — énergie, valorise l'effort, points d'exclamation.",
                "S": "Rassurant et empathique — explique le pourquoi, ton doux, encourage.",
                "C": "Factuel et analytique — structuré, précis, cite des chiffres et processus.",
            }
            _tone = _disc_tones.get(disc_style.upper(), "Professionnel et bienveillant.")
            disc_block = f"\n🎯 PROFIL DISC DU VENDEUR : {disc_style}\n→ Adapte absolument ton ton : {_tone}\n"

        # Pre-build coaching history block (backslashes not allowed inside f-string expressions in Python < 3.12)
        coaching_block = ""
        if previous_coaching:
            _nl = "\n"
            _lines = _nl.join(
                f"- [{c['date']}] {'OK' if c.get('was_success') else 'KO'} {c['recommendation']}"
                for c in previous_coaching
                if c.get('recommendation')
            )
            if _lines:
                coaching_block = (
                    "\n### HISTORIQUE COACHING RÉCENT\n"
                    + _lines
                    + "\nNe répète pas ces recommandations. Construis sur elles ou adresse un angle différent.\n"
                )

        scores_block = (
            f"COMPÉTENCES ACTUELLES (sur 10) :\n"
            f"- Accueil : {current_scores.get('accueil', 6.0)}\n"
            f"- Découverte : {current_scores.get('decouverte', 6.0)}\n"
            f"- Argumentation : {current_scores.get('argumentation', 6.0)}\n"
            f"- Closing : {current_scores.get('closing', 6.0)}\n"
            f"- Fidélisation : {current_scores.get('fidelisation', 6.0)}"
        )

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
            if business_context.get("duree_vente"):
                bc_lines.append(f"- Durée de vente typique : {business_context['duree_vente']}")
            if business_context.get("kpi_prioritaire"):
                bc_lines.append(f"- KPI prioritaire : {business_context['kpi_prioritaire']}")
            if business_context.get("contexte_libre"):
                bc_lines.append(f"- Contexte : {business_context['contexte_libre']}")
            if bc_lines:
                business_context_block = (
                    "\n🏪 CONTEXTE MÉTIER DU MAGASIN :\n"
                    + "\n".join(bc_lines)
                    + "\n→ Adapte tes conseils aux techniques de vente spécifiques à ce type de commerce.\n"
                )

        json_format = """{
  "analyse": "2-3 phrases percutantes (félicitations si succès / analyse empathique si échec). Cite les faits décrits.",
  "points_travailler": "Point 1\\nPoint 2",
  "recommandation": "1 phrase courte, motivante, avec un levier précis.",
  "exemple_concret": "Phrase ou comportement exact à appliquer dès la prochaine opportunité.",
  "action_immediate": "1 geste à faire AUJOURD'HUI avant la prochaine vente (ex: relire une fiche produit, préparer une phrase d'accroche).",
  "delta_accueil": 0.0,
  "delta_decouverte": 0.0,
  "delta_argumentation": 0.0,
  "delta_closing": 0.0,
  "delta_fidelisation": 0.0
}"""

        if is_success:
            prompt = f"""VENTE CONCLUE AVEC SUCCÈS — Analyse et renforce les compétences mobilisées.
{business_context_block}
DÉTAILS DE LA VENTE :
- Produit : {debrief_data.get('produit', 'Non spécifié')}
- Type de client : {debrief_data.get('type_client', 'Non spécifié')}
- Situation : {debrief_data.get('situation_vente', 'Non spécifié')}
- Déroulé : {debrief_data.get('description_vente', 'Non spécifié')}
- Moment clé du succès : {debrief_data.get('moment_perte_client', 'Non spécifié')}
- Facteurs de réussite : {debrief_data.get('raisons_echec', 'Non spécifié')}
- Ce qui a le mieux fonctionné : {debrief_data.get('amelioration_pensee', 'Non spécifié')}
{kpi_context}

{scores_block}
{disc_block}
RÈGLES DELTA (vente réussie) :
- Compétences qui ont contribué au succès → delta +0.3 à +0.8
- Autres compétences non impliquées → delta 0.0 à +0.2
- JAMAIS de delta négatif sur une vente réussie
- Proportionnel à la qualité décrite
{coaching_block}
FORMAT JSON UNIQUEMENT :
{json_format}"""
        else:
            prompt = f"""OPPORTUNITÉ MANQUÉE — Analyse les causes et propose des leviers d'amélioration concrets.
{business_context_block}
DÉTAILS DE L'ÉCHEC :
- Produit : {debrief_data.get('produit', 'Non spécifié')}
- Type de client : {debrief_data.get('type_client', 'Non spécifié')}
- Situation : {debrief_data.get('situation_vente', 'Non spécifié')}
- Déroulé : {debrief_data.get('description_vente', 'Non spécifié')}
- Moment du blocage : {debrief_data.get('moment_perte_client', 'Non spécifié')}
- Raisons évoquées : {debrief_data.get('raisons_echec', 'Non spécifié')}
- Ce que le vendeur pense faire différemment : {debrief_data.get('amelioration_pensee', 'Non spécifié')}
{kpi_context}

{scores_block}
{disc_block}
RÈGLES DELTA (opportunité manquée) :
- Compétence principale en cause → delta -0.4 à -0.1
- Compétences secondaires liées → delta -0.2 à 0.0
- Compétences non impliquées → delta 0.0
- Si une compétence a bien fonctionné malgré l'échec → delta 0.0 à +0.2
- Sois mesuré : un seul débrief ne doit pas tout changer
{coaching_block}
FORMAT JSON UNIQUEMENT :
{json_format}"""

        response = await self._send_message(
            system_message=DEBRIEF_SYSTEM_PROMPT,
            user_prompt=prompt,
            model="gpt-4o",
            temperature=0.4,
        )

        if response:
            return parse_json_safely(response, self._fallback_debrief(current_scores, is_success))
        else:
            return self._fallback_debrief(current_scores, is_success)

    def _fallback_debrief(self, current_scores: Dict, is_success: bool) -> Dict:
        """Fallback debrief — returns deltas (same contract as AI response)."""
        if is_success:
            return {
                "analyse": "Bravo pour cette vente ! Continue sur cette lancée.",
                "points_travailler": "Argumentation produit\nClosing",
                "recommandation": "Continue à appliquer ces techniques gagnantes.",
                "exemple_concret": "La prochaine fois, propose aussi un produit complémentaire.",
                "delta_accueil": 0.0,
                "delta_decouverte": 0.0,
                "delta_argumentation": 0.5,
                "delta_closing": 0.5,
                "delta_fidelisation": 0.2,
            }
        else:
            return {
                "analyse": "Cette opportunité est une source d'apprentissage. Analysons ensemble.",
                "points_travailler": "Découverte des besoins\nTraitement des objections",
                "recommandation": "Prends plus de temps pour comprendre les motivations du client.",
                "exemple_concret": "Essaie de demander : 'Qu'est-ce qui vous ferait hésiter ?'",
                "delta_accueil": 0.0,
                "delta_decouverte": -0.2,
                "delta_argumentation": 0.0,
                "delta_closing": -0.2,
                "delta_fidelisation": 0.0,
            }

    # ==========================================================================
    # 🎯 DIAGNOSTIC
    # ==========================================================================

    async def generate_diagnostic(
        self,
        responses: List[Dict],
        seller_name: str
    ) -> Dict:
        """Generate DISC diagnostic from seller responses - SÉCURISÉ"""
        if not self.available:
            return {
                "style": "Adaptateur",
                "level": 50,
                "strengths": ["Polyvalence", "Adaptabilité"],
                "axes_de_developpement": ["À explorer avec ton manager"],
                "motivation": "Relation",
                "ai_profile_summary": ""
            }

        # Construire le texte des réponses en utilisant question_id comme référence principale
        # Si 'question' est fourni, l'utiliser pour le prompt, sinon utiliser question_id
        newline = "\n"
        response_lines = []
        for r in responses:
            question_id = r.get('question_id', '?')
            question_text = r.get('question') or f'Question {question_id}'
            response_lines.append(f"Q{question_id}: {question_text}{newline}R: {r['answer']}")
        responses_text = newline.join(response_lines)

        prompt = f"""Analyse les réponses de {seller_name} et détermine son profil DISC + ses axes de développement commercial.

RÉPONSES AU QUESTIONNAIRE :
{responses_text}

RAPPELS CRITIQUES :
- Questions 1-15 → compétences de vente terrain (forces/axes) UNIQUEMENT, PAS pour le DISC
- Questions 16+ → UNIQUEMENT ces réponses déterminent le style D/I/S/C
- Utilise un vocabulaire de développement, jamais de jugement négatif
- Réponds UNIQUEMENT avec le JSON attendu (style, level, strengths, axes_de_developpement, motivation, ai_profile_summary)
- motivation doit être exactement l'un de : Relation, Reconnaissance, Performance, Découverte
- ai_profile_summary : 2-3 phrases personnalisées, positives et actionnables sur le profil de {seller_name}"""

        response = await self._send_message(
            system_message=DIAGNOSTIC_SYSTEM_PROMPT,
            user_prompt=prompt,
            model="gpt-4o",
            temperature=0.3,
        )

        if response:
            result = parse_json_safely(response, {
                "style": "Adaptateur",
                "level": 50,
                "strengths": ["Polyvalence"],
                "axes_de_developpement": ["À explorer"]
            })
            # Migration: convertir 'weaknesses' en 'axes_de_developpement' si présent
            if 'weaknesses' in result and 'axes_de_developpement' not in result:
                result['axes_de_developpement'] = result.pop('weaknesses')
            return result

        return {
            "style": "Adaptateur",
            "level": 50,
            "strengths": ["Polyvalence", "Adaptabilité"],
            "axes_de_developpement": ["À explorer avec ton manager"],
            "motivation": "Relation",
            "ai_profile_summary": ""
        }
