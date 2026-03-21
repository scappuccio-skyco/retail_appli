"""
BriefMixin - Morning brief generation methods.
"""

import logging
import re
from typing import Dict, List, Optional
from datetime import datetime, timezone

from services.ai_service._prompts import (
    LEGAL_DISCLAIMER_BLOCK,
)

logger = logging.getLogger(__name__)


class BriefMixin:
    """
    Mixin providing morning brief generation.
    Relies on self._send_message and self.available from CoreMixin.
    """

    # ==============================================================================
    # ☕ BRIEF DU MATIN - Générateur de script pour le brief matinal
    # ==============================================================================

    async def generate_morning_brief(
        self,
        stats: Dict,
        manager_name: str,
        store_name: str,
        context: Optional[str] = None,
        data_date: Optional[str] = None,
        objective_daily: Optional[float] = None,
        team_disc_profiles: Optional[List[Dict]] = None,
    ) -> Dict:
        """
        Génère le script du brief matinal pour le manager.

        Args:
            stats: Statistiques du magasin (dernier jour avec données)
            manager_name: Nom du manager
            store_name: Nom du magasin
            context: Consigne spécifique du manager (optionnel)
            data_date: Date du dernier jour avec des données (format YYYY-MM-DD)

        Returns:
            Dict avec le brief formaté en markdown et les métadonnées
        """
        # Si OpenAI n'est pas disponible, utiliser le fallback
        if not self.available:
            return self._fallback_morning_brief(stats, manager_name, store_name, data_date, objective_daily)

        try:
            # Construire l'instruction de contexte
            context_instruction = ""
            if context and context.strip():
                context_instruction = f"""
🎯 CONSIGNE SPÉCIALE DU MANAGER :
"{context.strip()}"
→ Intègre cette consigne dans ton brief de manière naturelle (dans l'intro ou la mission du jour).
"""
            else:
                context_instruction = "(Aucune consigne spécifique - Brief standard basé sur les chiffres)"

            # Date du jour en français
            today = self._format_date_french(datetime.now())

            # Date des données (dernier jour ouvert)
            if data_date:
                try:
                    data_dt = datetime.strptime(data_date, "%Y-%m-%d")
                    data_date_french = self._format_date_french(data_dt)
                except ValueError:
                    data_date_french = "récemment"
            else:
                data_date_french = "hier"

            # ⭐ Calculer la progression nécessaire si objectif et CA veille disponibles
            progression_text = ""
            ca_yesterday = stats.get('ca_yesterday', stats.get('ca_hier', 0)) or 0
            if objective_daily and objective_daily > 0 and ca_yesterday > 0:
                progression_pct = ((objective_daily / ca_yesterday) - 1) * 100
                # Si le pourcentage est démesuré (> 500%), ne pas insister dessus
                if progression_pct > 500:
                    progression_text = f"\n\nOBJECTIF DU JOUR : {objective_daily:,.0f}€\n→ Nouvel objectif ambitieux pour aujourd'hui. Concentrons-nous sur l'atteinte de cet objectif sans comparer avec hier (écart trop important)."
                else:
                    progression_text = f"\n\nOBJECTIF DU JOUR : {objective_daily:,.0f}€\n→ Pour atteindre cet objectif, nous devons faire {progression_pct:+.1f}% par rapport à {data_date_french.lower()} ({ca_yesterday:,.0f}€)."
            elif objective_daily and objective_daily > 0:
                progression_text = f"\n\nOBJECTIF DU JOUR : {objective_daily:,.0f}€\n→ Nouvel objectif ambitieux pour aujourd'hui."

            # Prompt système pour le brief
            system_prompt = f"""Tu es le bras droit d'un Manager Retail.
Tu rédiges le script du BRIEF MATINAL (3 minutes max à lire à voix haute) pour l'équipe.

{LEGAL_DISCLAIMER_BLOCK}

RÈGLES IMPÉRATIVES :
1. ⛔ Pas de citations génériques ("ensemble on va plus loin", "croyez en vous", etc.)
2. ⛔ Pas de challenge "café" ou récompense alimentaire — pas adapté à tous les contextes
3. ⛔ Ne commence pas par "Bien sûr !", "Voici votre brief" ou toute formule introductive
4. ✅ Chaque phrase doit pouvoir être lue à voix haute naturellement
5. ✅ Cite toujours les chiffres exacts (CA, PM, IV) — jamais de "bons résultats" vague
6. ✅ Le défi du jour doit être basé sur un KPI réel (PM, IV, TV) fourni dans les données

CONSIGNE DU MANAGER :
{context_instruction}

STRUCTURE ATTENDUE (6 sections, Markdown) :

# 📋 Brief du Matin — {today}
## {store_name}

### 1. ⚡ Accroche
(1 phrase percutante qui lance la journée. Intègre la consigne du manager si fournie.)

### 2. 📊 Hier en chiffres — {data_date_french}
- CA réalisé : X€ (chiffre exact)
- Le point fort : (LE KPI le plus positif avec son chiffre)
- Le point de vigilance : (si un KPI est faible, cite-le avec son chiffre)
❌ PAS de comparaison, PAS de pourcentage dans cette section.

### 3. 🌟 Coup de projecteur
(Cite le top vendeur par son prénom et son CA exact. 1-2 phrases max — reconnaître sans créer de compétition négative. Si pas de top vendeur connu, transforme cette section en reconnaissance collective de l'équipe.)

### 4. 🎯 La priorité du jour
{progression_text if progression_text else "(Objectif du jour si fourni, sinon : une action concrète basée sur le point de vigilance identifié ci-dessus. Format : qui fait quoi, comment.)"}

### 5. 💥 Le défi
(Un défi mesurable basé sur un KPI réel des données fournies.
Exemples selon les données :
- Si PM faible : "Aujourd'hui, chaque transaction doit dépasser X€ de PM — proposez systématiquement un produit complémentaire."
- Si IV faible : "Objectif : X articles par vente minimum — pensez aux associations produits."
- Si TV faible : "Transformez chaque contact client — l'objectif est X% de transformation."
Choisissez LE défi le plus pertinent selon les chiffres fournis.)

### 6. 🚀 On y va !
(1 phrase d'élan final, courte et directe. Énergique, concrète, jamais générique. Peut reprendre le défi ou la priorité du jour en une formule mémorable.)

---
*Brief généré par Retail Performer IA*
"""

            # Formater les stats pour le prompt utilisateur (sans objectif dans le flashback)
            stats_text = self._format_brief_stats(stats, include_objective=False)

            # Build team DISC block if profiles are available
            disc_team_block = ""
            if team_disc_profiles:
                disc_lines = "\n".join(
                    f"- {p['first_name']} : profil {p['disc_style']}"
                    for p in team_disc_profiles
                    if p.get("disc_style") and p["disc_style"] != "?"
                )
                if disc_lines:
                    disc_team_block = f"""
🎨 PROFILS DISC DE L'ÉQUIPE :
{disc_lines}

→ Adapte le contenu du brief pour résonner avec ces profils :
  • Profils D → inclure des chiffres précis + challenge résultats
  • Profils I → inclure un moment de reconnaissance collective + enthousiasme
  • Profils S → inclure un message rassurant + cohésion d'équipe
  • Profils C → inclure des données précises + logique derrière les actions
"""

            user_prompt = f"""Génère le brief matinal pour {manager_name}, manager du magasin "{store_name}".

DONNÉES DU {data_date_french.upper()} (dernier jour travaillé) :
{stats_text}

ÉQUIPE ACTIVE LE {data_date_french.upper()} :
{stats.get('team_active_last_day', 'Non renseigné')}
{disc_team_block}
{progression_text if progression_text else ""}

Génère un brief motivant et concret basé sur ces données.
⚠️ RAPPEL : Le Flash-Back doit UNIQUEMENT mentionner le CA réalisé ({data_date_french.lower()}), SANS comparaison ni objectif."""

            # Appel à l'IA
            response = await self._send_message(
                system_message=system_prompt,
                user_prompt=user_prompt,
                model="gpt-4o",
                temperature=0.6  # daily script — varied but consistent
            )

            if response:
                # Parse structured content from the Markdown response
                structured = self._parse_brief_to_structured(response)

                return {
                    "success": True,
                    "brief": response,
                    "structured": structured,
                    "date": today,
                    "data_date": data_date_french,
                    "store_name": store_name,
                    "manager_name": manager_name,
                    "has_context": bool(context and context.strip()),
                    "generated_at": datetime.now(timezone.utc).isoformat()
                }
            else:
                return self._fallback_morning_brief(stats, manager_name, store_name, data_date, objective_daily)

        except Exception as e:
            import traceback
            logger.error(f"Erreur génération brief matinal: {str(e)}\n{traceback.format_exc()}")
            return self._fallback_morning_brief(stats, manager_name, store_name, data_date, objective_daily)

    def _parse_brief_to_structured(self, markdown_brief: str) -> Optional[Dict]:
        """
        Parse le brief Markdown et extrait les sections structurées.

        Returns:
            Dict avec flashback, focus, examples, team_question, booster
            ou None si le parsing échoue
        """
        try:
            structured = {
                "humeur": "",
                "flashback": "",
                "spotlight": "",
                "focus": "",
                "examples": [],
                "team_question": "",
                "booster": ""
            }

            # Découper par sections (### ou ##)
            sections = re.split(r'###?\s+', markdown_brief)

            for section in sections:
                section_lower = section.lower()
                lines = section.strip().split('\n')
                content = '\n'.join(lines[1:]).strip() if len(lines) > 1 else ""

                # Identifier la section par son titre
                if any(kw in section_lower for kw in ['accroche', 'humeur', 'bonjour', 'matin', '⚡', '🌤️']):
                    structured["humeur"] = content
                elif any(kw in section_lower for kw in ['hier', 'flash', 'chiffres', '📊']):
                    structured["flashback"] = content
                elif any(kw in section_lower for kw in ['projecteur', 'spotlight', 'top vendeur', '🌟']):
                    structured["spotlight"] = content
                elif any(kw in section_lower for kw in ['priorité', 'mission', 'objectif', 'focus', '🎯', '💰']):
                    structured["focus"] = content
                    examples = re.findall(r'^[-•]\s*(.+)$', content, re.MULTILINE)
                    if examples:
                        structured["examples"] = examples
                elif any(kw in section_lower for kw in ['défi', 'challenge', 'déf', '💥', '🎲']):
                    structured["team_question"] = content
                elif any(kw in section_lower for kw in ['on y va', 'mot', 'fin', 'booster', 'boost', '🚀']):
                    structured["booster"] = content

            # Vérifier qu'on a au moins le focus et le booster
            if structured["focus"] or structured["booster"]:
                return structured

            return None

        except Exception as e:
            logger.warning(f"Erreur parsing brief structuré: {e}")
            return None

    def _format_date_french(self, dt: datetime) -> str:
        """Formate une date en français"""
        days_fr = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']
        months_fr = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin',
                     'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']

        day_name = days_fr[dt.weekday()]
        day_num = dt.day
        month_name = months_fr[dt.month - 1]
        year = dt.year

        return f"{day_name} {day_num} {month_name} {year}"

    def _format_brief_stats(self, stats: Dict, include_objective: bool = True) -> str:
        """Formate les statistiques pour le brief matinal"""
        lines = []

        # CA d'hier
        ca_hier = stats.get('ca_yesterday', stats.get('ca_hier', 0))
        obj_hier = stats.get('objectif_yesterday', stats.get('objectif_hier', 0))

        if ca_hier:
            lines.append(f"- CA d'hier : {ca_hier:,.0f}€")
            # ⭐ Ne plus inclure la comparaison avec l'objectif dans le flashback
            # if obj_hier and obj_hier > 0 and include_objective:
            #     perf = ((ca_hier / obj_hier) - 1) * 100
            #     emoji = "✅" if perf >= 0 else "⚠️"
            #     lines.append(f"  → Objectif : {obj_hier:,.0f}€ ({emoji} {perf:+.1f}%)")

        # Nombre de ventes
        ventes = stats.get('ventes_yesterday', stats.get('nb_ventes_hier', 0))
        if ventes:
            lines.append(f"- Nombre de ventes hier : {ventes}")

        # Panier moyen
        panier = stats.get('panier_moyen_yesterday', stats.get('panier_moyen_hier', 0))
        if panier:
            lines.append(f"- Panier moyen hier : {panier:,.0f}€")

        # Taux de transformation
        taux_transfo = stats.get('taux_transfo_yesterday', stats.get('taux_transfo_hier', 0))
        if taux_transfo:
            lines.append(f"- Taux de transformation : {taux_transfo:.1f}%")

        # Indice de vente
        iv = stats.get('indice_vente_yesterday', stats.get('iv_hier', 0))
        if iv:
            lines.append(f"- Indice de vente : {iv:.2f}")

        # Top vendeur hier
        top_seller = stats.get('top_seller_yesterday', stats.get('top_vendeur_hier'))
        if top_seller:
            lines.append(f"- 🏆 Top vendeur hier : {top_seller}")

        # CA semaine en cours
        ca_week = stats.get('ca_week', stats.get('ca_semaine', 0))
        obj_week = stats.get('objectif_week', stats.get('objectif_semaine', 0))
        if ca_week:
            lines.append("\n📅 SEMAINE EN COURS :")
            lines.append(f"- CA cumulé : {ca_week:,.0f}€")
            if obj_week:
                progress = (ca_week / obj_week) * 100
                lines.append(f"- Progression vs objectif : {progress:.0f}%")

        return "\n".join(lines) if lines else "Pas de données disponibles pour hier"

    def _fallback_morning_brief(self, stats: Dict, manager_name: str, store_name: str, data_date: Optional[str] = None, objective_daily: Optional[float] = None) -> Dict:
        """Brief de fallback si l'IA n'est pas disponible (mode test)"""
        today = datetime.now(timezone.utc).date().isoformat()
        today_french = datetime.now().strftime("%A %d %B %Y").capitalize()
        ca_hier = stats.get('ca_yesterday', stats.get('ca_hier', 0))

        # Calculer la progression si objectif disponible
        objective_section = ""
        if objective_daily and objective_daily > 0:
            if ca_hier > 0:
                progression_pct = ((objective_daily / ca_hier) - 1) * 100
                if progression_pct > 500:
                    objective_section = f"""### 3. 💰 Objectif du Jour
Nouvel objectif ambitieux pour aujourd'hui : {objective_daily:,.0f}€

"""
                else:
                    objective_section = f"""### 3. 💰 Objectif du Jour
Objectif du jour : {objective_daily:,.0f}€
Pour atteindre cet objectif, nous devons faire {progression_pct:+.1f}% par rapport à hier ({ca_hier:,.0f}€).

"""
            else:
                objective_section = f"""### 3. 💰 Objectif du Jour
Nouvel objectif ambitieux pour aujourd'hui : {objective_daily:,.0f}€

"""

        fallback_brief = f"""# ☕ Brief du Matin - {today_french}
## {store_name}

### 1. 🌤️ L'Humeur du Jour
Bonjour l'équipe ! Une nouvelle journée commence, pleine d'opportunités !

### 2. 📊 Flash-Back d'Hier
- **CA réalisé** : {ca_hier:,.0f}€
- Continuons sur cette lancée !

{objective_section}### 4. 🎯 La Mission du Jour
Objectif : Dépasser notre CA d'hier et offrir une expérience client exceptionnelle !

### 5. 🎲 Le Challenge "Café" ☕
Le premier à atteindre 500€ de CA gagne un café offert par le manager !

### 6. 🚀 Le Mot de la Fin
"Le succès est la somme de petits efforts répétés jour après jour." - Robert Collier

---
*Brief généré par Retail Performer AI*
"""

        # Structured fallback
        structured = {
            "humeur": "Bonjour l'équipe ! Une nouvelle journée commence, pleine d'opportunités !",  # ⭐ Ajout de l'humeur du jour
            "flashback": f"CA réalisé hier : {ca_hier:,.0f}€. Continuons sur cette lancée !",
            "focus": "Dépasser notre CA d'hier et offrir une expérience client exceptionnelle !",
            "examples": [
                "Accueil chaleureux de chaque client",
                "Proposer des articles complémentaires",
                "Fidéliser avec le programme avantages"
            ],
            "team_question": "Quel est votre objectif personnel pour aujourd'hui ?",
            "booster": "Le succès est la somme de petits efforts répétés jour après jour. - Robert Collier"
        }

        return {
            "success": True,
            "brief": fallback_brief,
            "structured": structured,
            "date": today_french,
            "data_date": data_date or stats.get('data_date', datetime.now(timezone.utc).date().isoformat()),
            "store_name": store_name,
            "manager_name": manager_name,
            "has_context": False,
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "fallback": True
        }
