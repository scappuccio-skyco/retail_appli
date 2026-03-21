"""
SellerMixin - Daily challenge and seller bilan generation methods.
"""

import json
import logging
import re
from typing import Dict, List, Optional

from services.ai_service._prompts import (
    CHALLENGE_SYSTEM_PROMPT,
    SELLER_STRICT_SYSTEM_PROMPT,
    DISC_ADAPTATION_INSTRUCTIONS,
    anonymize_name_for_ai,
    parse_json_safely,
)

logger = logging.getLogger(__name__)


class SellerMixin:
    """
    Mixin providing daily challenge and seller bilan generation.
    Relies on self._send_message and self.available from CoreMixin.
    """

    # ==========================================================================
    # 🎯 DAILY CHALLENGE
    # ==========================================================================

    async def generate_daily_challenge(
        self,
        seller_profile: Dict,
        recent_kpis: List[Dict],
        target_competence: str = "",
        competence_scores: Optional[Dict] = None,
        recent_challenge_titles: Optional[List[str]] = None,
    ) -> Dict:
        """
        Generate personalized daily challenge with DISC adaptation.

        Args:
            seller_profile: DISC profile dict (style, level, strengths)
            recent_kpis: Recent KPI entries (last 7 days)
            target_competence: Pre-selected competence to focus on (weakest not recently used)
            competence_scores: Dict of {competence: score} for all 5 skills
            recent_challenge_titles: Titles of the last N challenges (to avoid repetition)
        """
        _fallback = {
            "title": "Augmente ton panier moyen",
            "description": "Propose 2 produits complémentaires à chaque client",
            "competence": target_competence or "vente_additionnelle",
        }
        if not self.available:
            return _fallback

        avg_ca = sum(k.get('ca_journalier', 0) for k in recent_kpis) / len(recent_kpis) if recent_kpis else 0
        disc_style = seller_profile.get('style', 'Non défini')
        disc_level = seller_profile.get('level', 50)
        disc_strengths = ', '.join(seller_profile.get('strengths', [])) if seller_profile.get('strengths') else 'N/A'

        # Scores block — helps AI understand the priority
        scores_block = ""
        if competence_scores:
            scores_lines = "\n".join(
                f"- {k.capitalize()} : {v:.1f}/10" for k, v in competence_scores.items()
            )
            scores_block = f"\n📊 SCORES DE COMPÉTENCES ACTUELS :\n{scores_lines}\n"

        # Competence target block
        target_block = ""
        if target_competence:
            target_block = f"\n🎯 COMPÉTENCE CIBLÉE AUJOURD'HUI : **{target_competence}** (c'est la compétence à travailler en priorité — assure-toi que le défi porte bien sur elle)\n"

        # Anti-repeat block
        avoid_block = ""
        if recent_challenge_titles:
            avoid_block = (
                "\n⛔ DÉFIS RÉCENTS À NE PAS RÉPÉTER (même idée ou même titre) :\n"
                + "\n".join(f"- {t}" for t in recent_challenge_titles[:7])
                + "\n"
            )

        prompt = f"""🎯 VENDEUR À CHALLENGER :
- Profil DISC : {disc_style} (niveau {disc_level}/100)
- Forces connues : {disc_strengths}
- Performance récente : CA moyen {avg_ca:.0f}€/jour
{scores_block}{target_block}{avoid_block}
{DISC_ADAPTATION_INSTRUCTIONS}

📋 MISSION : Génère UN défi quotidien personnalisé qui :
1. CIBLE obligatoirement la compétence indiquée ci-dessus
2. CORRESPOND au style DISC du vendeur (ton, formulation)
3. Est original — différent des défis récents listés
4. Est réalisable en une journée en boutique

Réponds UNIQUEMENT avec ce JSON :
{{"title": "Titre accrocheur adapté au profil", "description": "Description motivante en 1-2 phrases", "competence": "{target_competence or 'vente_additionnelle'}"}}"""

        response = await self._send_message(
            system_message=CHALLENGE_SYSTEM_PROMPT,
            user_prompt=prompt,
            model="gpt-4o-mini",
            temperature=0.8
        )

        if response:
            result = parse_json_safely(response, _fallback)
            # Ensure the returned competence matches what was targeted
            if target_competence:
                result['competence'] = target_competence
            return result

        return _fallback

    # ==========================================================================
    # 📈 SELLER BILAN
    # ==========================================================================

    async def generate_seller_bilan(
        self,
        seller_data: Dict,
        kpis: List[Dict],
        prev_kpis: Optional[List[Dict]] = None,
        objectives: Optional[List[Dict]] = None,
    ) -> Dict:
        """
        Generate structured performance report for seller.

        BUSINESS RULES:
        - Never mention traffic/visitor counting (Manager's responsibility)
        - Focus only on what seller controls: CA, PM, IV, sales count
        - Returns JSON dict with sections for rich frontend rendering
        """
        seller_name = anonymize_name_for_ai(seller_data.get('name', 'Vendeur'))

        if not self.available:
            return {
                "synthese": f"Bilan pour {seller_name}: Performance en cours d'analyse.",
                "points_forts": [],
                "axes_progres": [],
                "objectif_demain": "",
                "disc_note": "",
            }

        # ── Période courante ────────────────────────────────────────────────────
        kpis_sorted = sorted(kpis, key=lambda x: x.get("date", ""))
        total_ca = sum(k.get("ca_journalier", 0) or 0 for k in kpis)
        total_ventes = sum(k.get("nb_ventes", 0) or 0 for k in kpis)
        total_articles = sum(k.get("nb_articles", 0) or 0 for k in kpis)
        jours_actifs = len([k for k in kpis if (k.get("ca_journalier") or 0) > 0])
        days_count = len(kpis)
        pm = total_ca / total_ventes if total_ventes > 0 else 0
        iv = total_articles / total_ventes if total_ventes > 0 else 0

        # Tendance : compare 1ère moitié vs 2ème moitié de la période
        tendance_text = ""
        if len(kpis_sorted) >= 6:
            mid = len(kpis_sorted) // 2
            ca_first = sum(k.get("ca_journalier", 0) or 0 for k in kpis_sorted[:mid])
            ca_second = sum(k.get("ca_journalier", 0) or 0 for k in kpis_sorted[mid:])
            if ca_first > 0:
                delta = ((ca_second / ca_first) - 1) * 100
                tendance_text = f"Tendance sur la période : {delta:+.1f}% (2ème moitié vs 1ère moitié)"

        # ── Période précédente ──────────────────────────────────────────────────
        prev_block = ""
        if prev_kpis:
            prev_ca = sum(k.get("ca_journalier", 0) or 0 for k in prev_kpis)
            prev_ventes = sum(k.get("nb_ventes", 0) or 0 for k in prev_kpis)
            prev_articles = sum(k.get("nb_articles", 0) or 0 for k in prev_kpis)
            prev_pm = prev_ca / prev_ventes if prev_ventes > 0 else 0
            prev_iv = prev_articles / prev_ventes if prev_ventes > 0 else 0
            evol_ca = f"{((total_ca / prev_ca) - 1) * 100:+.1f}%" if prev_ca > 0 else "N/A"
            evol_pm = f"{((pm / prev_pm) - 1) * 100:+.1f}%" if prev_pm > 0 else "N/A"
            evol_iv = f"{((iv / prev_iv) - 1) * 100:+.1f}%" if prev_iv > 0 else "N/A"
            prev_block = f"""
PÉRIODE PRÉCÉDENTE (comparaison) :
- CA : {prev_ca:.0f}€  → évolution : {evol_ca}
- PM : {prev_pm:.2f}€  → évolution : {evol_pm}
- IV : {prev_iv:.1f}   → évolution : {evol_iv}"""

        # ── Objectifs actifs ────────────────────────────────────────────────────
        obj_block = ""
        if objectives:
            active_objs = [o for o in objectives if o.get("status") in ("active", "en_cours", None)][:3]
            if active_objs:
                lines = []
                for o in active_objs:
                    label = o.get("label") or o.get("objective_type", "Objectif")
                    target = o.get("target_value") or o.get("value")
                    realized = o.get("realized") or o.get("current_value")
                    if target and realized is not None:
                        pct = (realized / target) * 100
                        lines.append(f"- {label} : {realized:.0f} / {target:.0f} ({pct:.0f}%)")
                    elif target:
                        lines.append(f"- {label} : objectif {target:.0f}")
                if lines:
                    obj_block = "OBJECTIFS ACTIFS :\n" + "\n".join(lines)

        # ── Profil DISC ─────────────────────────────────────────────────────────
        disc_style = seller_data.get("disc_style") or seller_data.get("disc_profile")
        disc_block = ""
        if disc_style and disc_style != "?":
            disc_map = {
                "D": "Direct, orienté résultats → message court, chiffres + défi",
                "I": "Enthousiaste, sociable → message positif, reconnaissance, élan collectif",
                "S": "Stable, loyal → message rassurant, progression pas à pas, encouragement",
                "C": "Analytique, rigoureux → données précises, logique, explication des causes",
            }
            hint = disc_map.get(disc_style.upper(), "")
            if hint:
                disc_block = f"\nPROFIL DISC : {disc_style} — {hint}"

        system_prompt = f"""{SELLER_STRICT_SYSTEM_PROMPT}

FORMAT DE RÉPONSE OBLIGATOIRE (JSON ONLY) :
Réponds UNIQUEMENT avec cet objet JSON (sans markdown, sans texte avant/après) :
{{
  "synthese": "Résumé percutant de la performance (2-3 phrases). Cite les chiffres clés. Valorise la progression si présente.",
  "points_forts": ["Point fort 1 (chiffré)", "Point fort 2 (comportemental/technique)"],
  "axes_progres": ["Axe 1 : levier précis avec chiffre cible", "Axe 2 : geste concret en boutique"],
  "objectif_demain": "Un seul objectif pour demain, mesurable, basé sur le KPI le plus perfectible.",
  "disc_note": "Phrase d'encouragement adaptée au profil DISC (vide si profil inconnu)."
}}"""

        user_prompt = f"""Génère le bilan de performance de {seller_name} sur les {days_count} derniers jours ({jours_actifs} jours actifs).

MÉTRIQUES ACTUELLES :
- CA total : {total_ca:.0f}€
- Nombre de ventes : {total_ventes}
- Panier Moyen (PM) : {pm:.2f}€
- Indice de Vente (IV) : {iv:.1f} articles/vente
{tendance_text}
{prev_block}
{obj_block}
{disc_block}

⚠️ Ne mentionne jamais le trafic ou les entrées magasin."""

        response = await self._send_message(
            system_message=system_prompt,
            user_prompt=user_prompt,
            model="gpt-4o",
            temperature=0.4,
        )

        if not response:
            return {"synthese": f"Bilan pour {seller_name}: Performance en cours d'analyse.", "points_forts": [], "axes_progres": [], "objectif_demain": "", "disc_note": ""}

        try:
            cleaned = response.strip()
            if cleaned.startswith("```"):
                cleaned = re.sub(r"^```[a-z]*\n?", "", cleaned)
                cleaned = re.sub(r"\n?```$", "", cleaned)
            return json.loads(cleaned)
        except Exception:
            return {"synthese": response, "points_forts": [], "axes_progres": [], "objectif_demain": "", "disc_note": ""}
