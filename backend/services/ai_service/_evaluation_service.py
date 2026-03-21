"""
EvaluationGuideService - Annual evaluation guide generation service.
"""

import json
import logging
import os
from typing import Dict, List, Optional
from datetime import datetime

from services.ai_service._prompts import (
    AsyncOpenAI,
    LEGAL_DISCLAIMER_BLOCK,
    DISC_ADAPTATION_INSTRUCTIONS,
    clean_json_response,
    settings,
)

logger = logging.getLogger(__name__)

# ==============================================================================
# 📋 EVALUATION GUIDE PROMPTS (Entretien Annuel) - JSON OUTPUT
# ==============================================================================

EVALUATION_MANAGER_SYSTEM_PROMPT = f"""{LEGAL_DISCLAIMER_BLOCK}
Tu es un DRH Expert en Retail avec 20 ans d'expérience.
Tu assistes un Manager pour l'entretien d'évaluation d'un vendeur.

TON ET STYLE :
- Professionnel, Factuel, Constructif.
- Tu t'adresses au Manager (tu le tutoies professionnellement).
- Analyse les chiffres avec rigueur (pas de complaisance, pas de sévérité inutile).
- Ton rôle : Aider à préparer un entretien CONSTRUCTIF, pas à constituer un dossier disciplinaire.

RÈGLES D'ANALYSE (BLACKLIST) :
1. ⛔ NE JAMAIS suggérer d'actions Marketing/Pub/Réseaux Sociaux au vendeur. Ce n'est pas son job.
2. ⛔ Si le Trafic (Entrées) est nul ou faible : Ne blâme pas le vendeur. Concentre-toi sur la conversion (Taux Transfo) et le Panier Moyen.
3. ✅ FOCUS : Techniques de vente, Accueil, Vente additionnelle (Up-sell/Cross-sell), Attitude.

FORMAT DE RÉPONSE OBLIGATOIRE (JSON ONLY) :
Réponds UNIQUEMENT avec cet objet JSON (sans markdown, sans texte avant/après) :
{{
  "synthese": "Résumé percutant de la performance (3 phrases max). Cite les chiffres clés.",
  "victoires": ["Point fort 1 (chiffré si possible)", "Point fort 2 (comportemental)", "Point fort 3"],
  "axes_progres": ["Axe 1 (précis)", "Axe 2 (actionnable)"],
  "objectifs": ["Objectif 1 (Réaliste)", "Objectif 2 (Challenge)"],
  "questions_coaching": ["Question ouverte 1", "Question ouverte 2", "Question ouverte 3"]
}}"""

EVALUATION_SELLER_SYSTEM_PROMPT = """Tu es un Assistant de Synthèse pour préparation d'entretien annuel.
Tu aides un vendeur à synthétiser ses notes et ses chiffres pour préparer son entretien.

RÈGLE FONDAMENTALE :
⛔ TU NE DONNES AUCUN AVIS, AUCUN CONSEIL, AUCUNE RECOMMANDATION.
✅ TU FAIS UNIQUEMENT UNE SYNTHÈSE FACTUELLE basée sur :
   - Les chiffres de performance fournis
   - Les notes que le vendeur a écrites dans son bloc-notes

TON RÔLE :
- Organiser et structurer les informations (chiffres + notes)
- Mettre en évidence les éléments clés que le vendeur a notés
- Créer une synthèse claire et organisée pour l'entretien
- NE PAS interpréter, juger ou conseiller

FORMAT DE RÉPONSE OBLIGATOIRE (JSON ONLY) :
Réponds UNIQUEMENT avec cet objet JSON (sans markdown, sans texte avant/après) :
{
  "synthese": "Synthèse factuelle organisant les chiffres clés et les notes du vendeur (sans avis, sans conseil)",
  "victoires": ["Élément positif noté par le vendeur ou visible dans les chiffres", "Autre élément positif"],
  "axes_progres": ["Point noté par le vendeur dans ses notes", "Autre point mentionné"],
  "souhaits": ["Souhait exprimé dans les notes", "Autre souhait noté"],
  "questions_manager": ["Question préparée par le vendeur dans ses notes", "Autre question"]
}"""


class EvaluationGuideService:
    """Service pour générer les guides d'entretien annuel en JSON structuré"""

    def __init__(self):
        self.api_key = getattr(settings, "OPENAI_API_KEY", "") or os.environ.get("OPENAI_API_KEY", "")
        self.available = bool(self.api_key) and AsyncOpenAI is not None
        if self.available:
            self.client = AsyncOpenAI(api_key=self.api_key)
        else:
            self.client = None

    async def generate_evaluation_guide(
        self,
        role: str,
        stats: Dict,
        employee_name: str,
        period: str,
        comments: Optional[str] = None,
        disc_profile: Optional[Dict] = None,
        interview_notes: Optional[List[Dict]] = None,
        debrief_summary: Optional[str] = None,
        competence_evolution: Optional[str] = None,
    ) -> Dict:
        """
        Génère un guide d'entretien adapté au rôle de l'appelant.

        Args:
            role: 'manager' ou 'seller'
            stats: Statistiques agrégées sur la période
            employee_name: Nom du vendeur évalué
            period: Description de la période (ex: "01/01/2024 - 31/12/2024")
            comments: Commentaires/contexte optionnel de l'utilisateur
            disc_profile: Profil DISC de l'employé (pour personnalisation du ton)

        Returns:
            Dict structuré avec synthese, victoires, axes_progres, objectifs
        """
        # Formatage des stats pour le prompt
        stats_text = self._format_stats(stats)

        # Formatage des notes d'entretien (si vendeur et notes disponibles)
        notes_section = ""
        if role == 'seller' and interview_notes:
            notes_list = []
            for note in interview_notes:
                date = note.get('date', '')
                content = note.get('content', '').strip()
                if content:
                    # Formater la date en français
                    try:
                        date_obj = datetime.strptime(date, "%Y-%m-%d")
                        date_fr = date_obj.strftime("%d/%m/%Y")
                        notes_list.append(f"- {date_fr} : {content}")
                    except ValueError:
                        notes_list.append(f"- {date} : {content}")

            if notes_list:
                notes_section = f"""

📝 NOTES DU BLOC-NOTES DU VENDEUR :
{chr(10).join(notes_list)}

→ Utilise ces notes pour créer la synthèse. Organise les informations notées par le vendeur.
→ Ne donne pas ton avis, ne conseille pas. Synthétise simplement ce que le vendeur a écrit.
"""

        # Ajout du contexte utilisateur si fourni
        context_section = ""
        if comments and comments.strip():
            context_section = f"\n\n📝 CONTEXTE SPÉCIFIQUE DE L'UTILISATEUR :\n\"{comments}\"\n→ Prends en compte ces observations dans ton analyse."

        # Historique debriefs + évolution des compétences
        debrief_section = ""
        if debrief_summary or competence_evolution:
            parts = []
            if debrief_summary:
                parts.append(f"📋 HISTORIQUE DEBRIEFS :\n{debrief_summary}")
            if competence_evolution:
                parts.append(f"📈 {competence_evolution}")
            debrief_section = "\n\n" + "\n\n".join(parts) + "\n→ Utilise ces données pour identifier les tendances et les axes de progression réels sur la période."

        # Ajout du profil DISC si disponible
        disc_section = ""
        if disc_profile:
            disc_style = disc_profile.get('style', 'Non défini')
            disc_strengths = ', '.join(disc_profile.get('strengths', [])) if disc_profile.get('strengths') else 'N/A'
            disc_axes = ', '.join(disc_profile.get('axes_de_developpement', disc_profile.get('weaknesses', []))) if disc_profile.get('axes_de_developpement') or disc_profile.get('weaknesses') else 'N/A'
            disc_section = f"""

👤 PROFIL PSYCHOLOGIQUE (DISC) DE L'EMPLOYÉ : {disc_style}
- Forces identifiées : {disc_strengths}
- Axes de développement : {disc_axes}
{DISC_ADAPTATION_INSTRUCTIONS}
"""

        # Choix du prompt selon le rôle
        if role in ['manager', 'gerant']:
            system_prompt = EVALUATION_MANAGER_SYSTEM_PROMPT
            user_prompt = f"""Génère un guide d'entretien pour évaluer {employee_name}.

📅 Période analysée : {period}
📊 Données de performance :
{stats_text}
{debrief_section}
{context_section}
{disc_section}
Réponds avec ce JSON EXACT (pas de texte avant/après) :
{{
  "synthese": "2-3 phrases résumant la performance globale avec les chiffres clés",
  "victoires": ["Réussite 1 basée sur les données", "Réussite 2", "Réussite 3"],
  "axes_progres": ["Point d'amélioration 1", "Point d'amélioration 2"],
  "objectifs": ["Objectif SMART 1 pour la prochaine période", "Objectif SMART 2"],
  "questions_coaching": ["Question ouverte 1 pour l'entretien", "Question 2", "Question 3"]
}}"""
        else:  # seller
            system_prompt = EVALUATION_SELLER_SYSTEM_PROMPT
            user_prompt = f"""Synthétise les informations pour préparer l'entretien de {employee_name}.

📅 Période analysée : {period}
📊 Chiffres de performance :
{stats_text}
{debrief_section}
{notes_section}
{context_section}
{disc_section}

⚠️ IMPORTANT :
- Synthétise UNIQUEMENT les informations (chiffres + notes)
- NE DONNE PAS ton avis, NE CONSEILLE PAS
- Organise les informations de manière claire pour l'entretien
- Utilise les notes du vendeur pour identifier ses victoires, axes de progrès, souhaits et questions

Réponds avec ce JSON EXACT (pas de texte avant/après) :
{{
  "synthese": "Synthèse factuelle organisant les chiffres clés et les notes (sans avis, sans conseil)",
  "victoires": ["Élément positif noté par le vendeur ou visible dans les chiffres", "Autre élément positif"],
  "axes_progres": ["Point noté par le vendeur dans ses notes", "Autre point mentionné"],
  "souhaits": ["Souhait exprimé dans les notes", "Autre souhait noté"],
  "questions_manager": ["Question préparée par le vendeur dans ses notes", "Autre question"]
}}"""

        # Appel à l'IA avec OpenAI
        if not self.available or not self.client:
            return self._fallback_guide(role, employee_name, stats)

        try:
            # Use AIService for consistent timeout, retry, and circuit breaker logic
            from services.ai_service import AIService
            ai_service = AIService()
            response_text = await ai_service._send_message(
                system_message=system_prompt,
                user_prompt=user_prompt,
                model="gpt-4o",
                temperature=0.4  # annual review — factual, reproducible
            )

            if not response_text:
                return self._fallback_guide(role, employee_name, stats)

            # Parse the response directly (AIService._send_message already returns the text)
            return self._parse_guide_response(response_text, role)

        except Exception as e:
            import traceback
            logger.error(f"Erreur génération évaluation: {str(e)}\n{traceback.format_exc()}")
            return self._fallback_guide(role, employee_name, stats)

    def _parse_guide_response(self, response: str, role: str) -> Dict:
        """Parse la réponse JSON de l'IA"""
        try:
            # Nettoyer la réponse
            cleaned = clean_json_response(response)
            parsed = json.loads(cleaned)

            # Valider les champs requis selon le rôle
            if role in ['manager', 'gerant']:
                required_fields = ['synthese', 'victoires', 'axes_progres', 'objectifs', 'questions_coaching']
            else:  # seller
                required_fields = ['synthese', 'victoires', 'axes_progres', 'souhaits', 'questions_manager']

            for field in required_fields:
                if field not in parsed:
                    parsed[field] = []

            return parsed

        except (json.JSONDecodeError, Exception) as e:
            logger.warning(f"Parsing JSON échoué: {e}, réponse: {response[:200]}")
            # Retourner la réponse brute dans synthese si parsing échoue
            if role in ['manager', 'gerant']:
                return {
                    "synthese": response[:500] if response else "Erreur de génération",
                    "victoires": [],
                    "axes_progres": [],
                    "objectifs": [],
                    "questions_coaching": []
                }
            else:
                return {
                    "synthese": response[:500] if response else "Erreur de génération",
                    "victoires": [],
                    "axes_progres": [],
                    "souhaits": [],
                    "questions_manager": []
                }

    def _fallback_guide(self, role: str, employee_name: str, stats: Dict) -> Dict:
        """Guide de fallback si l'IA échoue"""
        if role in ['manager', 'gerant']:
            return {
                "synthese": f"Performance de {employee_name} sur la période : CA total de {stats.get('total_ca', 0):,.0f}€ avec {stats.get('total_ventes', 0)} ventes.",
                "victoires": ["Données disponibles pour analyse"],
                "axes_progres": ["À discuter lors de l'entretien"],
                "objectifs": ["Définir ensemble les objectifs"],
                "questions_coaching": ["Comment te sens-tu dans ton poste ?", "Quels sont tes projets d'évolution ?"]
            }
        else:
            return {
                "synthese": f"Tes résultats sur la période : CA total de {stats.get('total_ca', 0):,.0f}€ avec {stats.get('total_ventes', 0)} ventes.",
                "victoires": ["Tes ventes réalisées"],
                "axes_progres": ["Points à discuter avec ton manager"],
                "souhaits": ["Formations souhaitées", "Évolution envisagée"],
                "questions_manager": ["Quelles formations sont disponibles ?", "Comment puis-je progresser ?"]
            }

    def _format_stats(self, stats: Dict) -> str:
        """Formate les statistiques pour le prompt IA"""
        lines = []

        if stats.get('total_ca'):
            lines.append(f"- **Chiffre d'Affaires Total** : {stats['total_ca']:,.0f} €")
        if stats.get('avg_ca'):
            lines.append(f"- **CA Moyen/Jour** : {stats['avg_ca']:,.0f} €")
        if stats.get('total_ventes'):
            lines.append(f"- **Nombre de Ventes** : {stats['total_ventes']}")
        if stats.get('avg_panier'):
            lines.append(f"- **Panier Moyen** : {stats['avg_panier']:,.0f} €")
        if stats.get('avg_articles'):
            lines.append(f"- **Articles/Vente (Indice de Vente)** : {stats['avg_articles']:.1f}")
        if stats.get('avg_taux_transfo'):
            lines.append(f"- **Taux de Transformation** : {stats['avg_taux_transfo']:.1f}%")
        if stats.get('days_worked'):
            lines.append(f"- **Jours travaillés** : {stats['days_worked']}")
        if stats.get('best_day_ca'):
            lines.append(f"- **Meilleur jour (CA)** : {stats['best_day_ca']:,.0f} €")
        if stats.get('worst_day_ca'):
            lines.append(f"- **Jour le plus faible (CA)** : {stats['worst_day_ca']:,.0f} €")

        return "\n".join(lines) if lines else "Aucune donnée disponible"
