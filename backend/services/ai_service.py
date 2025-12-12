"""
AI Service - Integration with Emergent LLM (Legacy Restored)
============================================================
🏺 ARCHAEOLOGICAL RESTORATION - December 2025

This service has been restored from the _archived_legacy/server.py
to bring back the sophisticated AI prompts and proper integration
with emergentintegrations library.

Key Changes:
- Fixed import: using LlmChat + UserMessage (not get_client)
- Restored expert prompts with 15+ years experience persona
- Using GPT-4o for complex analysis, GPT-4o-mini for quick tasks
- Proper JSON parsing with fallback handling
"""

import os
import json
import uuid
import logging
import re
from typing import Dict, List, Optional
from datetime import datetime, timezone

# ✅ CORRECT IMPORT (Legacy)
try:
    from emergentintegrations.llm.chat import LlmChat, UserMessage
    EMERGENT_AVAILABLE = True
except ImportError:
    EMERGENT_AVAILABLE = False
    LlmChat = None
    UserMessage = None

from core.config import settings

logger = logging.getLogger(__name__)

# AI Configuration
EMERGENT_KEY = settings.EMERGENT_LLM_KEY

# ==============================================================================
# 🎯 SYSTEM PROMPTS (Legacy Restored)
# ==============================================================================

# Expert Retail Management (Team Analysis)
TEAM_ANALYSIS_SYSTEM_PROMPT = """Tu es un expert en management d'équipe retail avec 15 ans d'expérience."""

# Coach for Team Bilan (JSON output)
TEAM_BILAN_SYSTEM_PROMPT = """Tu es un coach en management retail. Tu réponds TOUJOURS en JSON valide uniquement."""

# Coach for Debrief (JSON output)
DEBRIEF_SYSTEM_PROMPT = """Tu es un coach en vente retail professionnel. Tu réponds UNIQUEMENT en JSON valide."""

# Feedback Coach
FEEDBACK_SYSTEM_PROMPT = """Tu es un coach retail expert qui donne des conseils positifs et constructifs."""

# DISC Diagnostic
DIAGNOSTIC_SYSTEM_PROMPT = """Tu es un expert en analyse comportementale DISC pour le commerce de détail.
Analyse les réponses du vendeur et détermine son profil DISC principal.
Réponds UNIQUEMENT avec un JSON contenant: style, level, strengths, weaknesses."""

# Daily Challenge
CHALLENGE_SYSTEM_PROMPT = """Tu es un coach commercial qui génère des défis quotidiens personnalisés.
Crée un défi adapté au niveau et au style du vendeur.
Réponds en JSON avec: title, description, competence."""


# ==============================================================================
# 🛡️ UTILITY FUNCTIONS
# ==============================================================================

def anonymize_name_for_ai(full_name: str) -> str:
    """Anonymize seller name: keep only first name"""
    if not full_name:
        return "Vendeur"
    parts = full_name.strip().split()
    return parts[0] if parts else "Vendeur"


def clean_json_response(response: str) -> str:
    """
    Clean AI response to extract valid JSON
    Handles markdown code blocks and extra text
    """
    response_clean = response.strip()
    
    # Remove markdown code blocks
    if "```json" in response_clean:
        response_clean = response_clean.split("```json")[1].split("```")[0].strip()
    elif "```" in response_clean:
        parts = response_clean.split("```")
        if len(parts) >= 2:
            response_clean = parts[1].strip()
    
    # Find JSON object boundaries
    start_idx = response_clean.find('{')
    end_idx = response_clean.rfind('}') + 1
    
    if start_idx >= 0 and end_idx > start_idx:
        response_clean = response_clean[start_idx:end_idx]
    
    return response_clean


def parse_json_safely(response: str, fallback: Dict) -> Dict:
    """
    Safely parse JSON response with fallback
    """
    try:
        cleaned = clean_json_response(response)
        return json.loads(cleaned)
    except (json.JSONDecodeError, Exception) as e:
        logger.warning(f"JSON parsing failed: {e}")
        return fallback


# ==============================================================================
# 🧠 MAIN AI SERVICE CLASS
# ==============================================================================

class AIService:
    """
    Service for AI operations with Emergent LLM
    
    Uses LlmChat from emergentintegrations library
    Models:
    - gpt-4o: Complex analysis (team analysis, detailed bilans)
    - gpt-4o-mini: Quick tasks (daily challenges, feedback)
    """
    
    def __init__(self):
        self.api_key = EMERGENT_KEY
        self.available = EMERGENT_AVAILABLE and bool(self.api_key)
        
        # For backward compatibility with existing code
        self.client = self if self.available else None
    
    def _create_chat(self, session_id: str, system_message: str, model: str = "gpt-4o-mini") -> Optional[LlmChat]:
        """
        Create a new LlmChat instance
        
        Args:
            session_id: Unique session identifier
            system_message: System prompt for the AI
            model: Model to use (gpt-4o or gpt-4o-mini)
            
        Returns:
            Configured LlmChat instance or None
        """
        if not self.available:
            return None
        
        try:
            chat = LlmChat(
                api_key=self.api_key,
                session_id=session_id,
                system_message=system_message
            ).with_model("openai", model)
            return chat
        except Exception as e:
            logger.error(f"Failed to create LlmChat: {e}")
            return None
    
    async def _send_message(self, chat: LlmChat, prompt: str) -> Optional[str]:
        """
        Send a message to the AI and get response
        
        Args:
            chat: LlmChat instance
            prompt: User prompt
            
        Returns:
            AI response text or None
        """
        if not chat:
            return None
        
        try:
            user_message = UserMessage(text=prompt)
            response = await chat.send_message(user_message)
            return response
        except Exception as e:
            logger.error(f"AI message failed: {e}")
            return None

    # ==========================================================================
    # 🏆 TEAM ANALYSIS (GPT-4o - Premium)
    # ==========================================================================
    
    async def generate_team_analysis(
        self,
        team_data: Dict,
        period_label: str = "sur 30 jours",
        manager_id: str = None
    ) -> str:
        """
        Generate comprehensive team analysis using GPT-4o
        
        This is the flagship analysis feature - uses the most powerful model
        for detailed managerial insights.
        
        Args:
            team_data: Team performance data with sellers_details
            period_label: Human-readable period description
            manager_id: Manager ID for session tracking
            
        Returns:
            Formatted markdown analysis
        """
        if not self.available:
            return self._fallback_team_analysis(team_data, period_label)
        
        # Build sellers summary with anonymized names
        sellers_summary = []
        for seller in team_data.get('sellers_details', []):
            anonymous_name = anonymize_name_for_ai(seller.get('name', 'Vendeur'))
            sellers_summary.append(
                f"- {anonymous_name}: CA {seller.get('ca', 0):.0f}€, {seller.get('ventes', 0)} ventes, "
                f"PM {seller.get('panier_moyen', 0):.2f}€, Compétences {seller.get('avg_competence', 5):.1f}/10 "
                f"(Fort: {seller.get('best_skill', 'N/A')}, Faible: {seller.get('worst_skill', 'N/A')})"
            )
        
        # 🎯 LEGACY PROMPT RESTORED
        prompt = f"""Tu es un expert en management retail et coaching d'équipe. Analyse cette équipe de boutique physique et fournis des recommandations managériales pour MOTIVER et DÉVELOPPER l'équipe.

CONTEXTE : Boutique physique avec flux naturel de clients. Focus sur performance commerciale ET dynamique d'équipe.

PÉRIODE D'ANALYSE : {period_label}

ÉQUIPE :
- Taille : {team_data.get('total_sellers', 0)} vendeurs
- CA Total : {team_data.get('team_total_ca', 0):.0f} €
- Ventes Totales : {team_data.get('team_total_ventes', 0)}

VENDEURS :
{chr(10).join(sellers_summary)}

CONSIGNES :
- NE MENTIONNE PAS la complétion KPI (saisie des données) - c'est un sujet administratif, pas commercial
- Concentre-toi sur les PERFORMANCES COMMERCIALES et la DYNAMIQUE D'ÉQUIPE
- **IMPORTANT : Mentionne SYSTÉMATIQUEMENT les données chiffrées (CA, nombre de ventes, panier moyen) pour chaque vendeur dans ton analyse**
- Fournis des recommandations MOTIVANTES et CONSTRUCTIVES basées sur les chiffres
- Identifie les leviers de motivation individuels et collectifs
- Sois concis et actionnable (3 sections, 2-4 points par section)

Fournis l'analyse en 3 parties :

## ANALYSE D'ÉQUIPE
- Commence par rappeler les chiffres clés de l'équipe sur la période (CA total, nombre de ventes, panier moyen)
- Forces collectives et dynamique positive (avec données chiffrées à l'appui)
- Points d'amélioration ou déséquilibres à corriger (écarts de performance chiffrés)
- Opportunités de développement

## ACTIONS PAR VENDEUR
- Pour CHAQUE vendeur, mentionne ses résultats chiffrés (CA, ventes, PM) puis donne des recommandations personnalisées
- Format : "**[Nom]** (CA: XXX€, XX ventes, PM: XXX€) : [analyse et recommandations]"
- Focus sur développement des compétences et motivation
- Actions concrètes et bienveillantes

## RECOMMANDATIONS MANAGÉRIALES
- Actions pour renforcer la cohésion d'équipe
- Techniques de motivation adaptées à chaque profil
- Rituels ou animations pour dynamiser les ventes

Format : Markdown simple et structuré."""

        # Use GPT-4o for complex analysis
        session_id = f"team-analysis-{manager_id or uuid.uuid4()}"
        chat = self._create_chat(
            session_id=session_id,
            system_message=TEAM_ANALYSIS_SYSTEM_PROMPT,
            model="gpt-4o"  # 🎯 Premium model for team analysis
        )
        
        response = await self._send_message(chat, prompt)
        
        if response:
            return response
        else:
            return self._fallback_team_analysis(team_data, period_label)
    
    def _fallback_team_analysis(self, team_data: Dict, period_label: str) -> str:
        """Fallback when AI is unavailable"""
        total_ca = team_data.get('team_total_ca', 0)
        total_ventes = team_data.get('team_total_ventes', 0)
        total_sellers = team_data.get('total_sellers', 0)
        panier_moyen = total_ca / total_ventes if total_ventes > 0 else 0
        
        sellers_text = ""
        for seller in team_data.get('sellers_details', []):
            name = anonymize_name_for_ai(seller.get('name', 'Vendeur'))
            sellers_text += f"- {name}: CA {seller.get('ca', 0):.0f}€, {seller.get('ventes', 0)} ventes\n"
        
        return f"""## ANALYSE D'ÉQUIPE

📊 **Résumé {period_label}**
- Équipe : {total_sellers} vendeurs
- CA Total : {total_ca:.2f}€
- Ventes : {total_ventes}
- Panier moyen : {panier_moyen:.2f}€

## ACTIONS PAR VENDEUR

{sellers_text}

## RECOMMANDATIONS MANAGÉRIALES

💡 Pour une analyse IA détaillée avec des recommandations personnalisées, veuillez vérifier la configuration du service IA."""

    # ==========================================================================
    # 📋 TEAM BILAN (JSON Output)
    # ==========================================================================
    
    async def generate_team_bilan(
        self,
        manager_id: str,
        periode: str,
        team_data: List[Dict],
        kpi_summary: Dict
    ) -> Dict:
        """
        Generate structured team bilan (JSON format)
        
        Args:
            manager_id: Manager ID
            periode: Period string (e.g., "01/12 - 07/12")
            team_data: List of seller performance data
            kpi_summary: Aggregated KPI data
            
        Returns:
            Dict with synthese, points_forts, points_attention, recommandations, analyses_vendeurs
        """
        if not self.available:
            return self._fallback_team_bilan(periode)
        
        # Build context
        team_context = "Détails par vendeur :\n"
        for seller_data in team_data:
            team_context += f"- {seller_data.get('seller_name', 'Vendeur')} : CA {seller_data.get('ca', 0):.0f}€, {seller_data.get('ventes', 0)} ventes\n"
        
        prompt = f"""Tu es un coach en management retail. Analyse les performances de cette équipe et génère un bilan structuré.

PÉRIODE : {periode}
ÉQUIPE : {len(team_data)} vendeurs

KPIs de l'équipe :
- CA Total : {kpi_summary.get('ca_total', 0):.2f}€
- Nombre de ventes : {kpi_summary.get('ventes', 0)}
- Panier moyen : {kpi_summary.get('panier_moyen', 0):.2f}€

{team_context}

IMPORTANT : Réponds UNIQUEMENT avec un objet JSON valide, sans texte avant ou après. Format exact :
{{
  "synthese": "Une phrase résumant la performance globale de l'équipe",
  "points_forts": ["Point fort 1", "Point fort 2"],
  "points_attention": ["Point d'attention 1", "Point d'attention 2"],
  "recommandations": ["Action d'équipe 1", "Action d'équipe 2"],
  "analyses_vendeurs": [
    {{
      "vendeur": "Prénom du vendeur",
      "performance": "Phrase résumant sa performance (CA, ventes, points forts)",
      "points_forts": ["Son point fort 1", "Son point fort 2"],
      "axes_progression": ["Axe à améliorer 1", "Axe à améliorer 2"],
      "recommandations": ["Action personnalisée 1", "Action personnalisée 2"]
    }}
  ]
}}

Consignes :
- Analyse CHAQUE vendeur individuellement avec ses propres KPIs
- Sois précis avec les chiffres (utilise UNIQUEMENT les données fournies ci-dessus)
- Recommandations concrètes et actionnables pour chaque vendeur
- Ton professionnel mais encourageant"""

        chat = self._create_chat(
            session_id=f"team_bilan_{manager_id}_{periode}",
            system_message=TEAM_BILAN_SYSTEM_PROMPT,
            model="gpt-4o-mini"
        )
        
        response = await self._send_message(chat, prompt)
        
        if response:
            return parse_json_safely(response, self._fallback_team_bilan(periode))
        else:
            return self._fallback_team_bilan(periode)
    
    def _fallback_team_bilan(self, periode: str) -> Dict:
        """Fallback team bilan"""
        return {
            "synthese": f"Performance de l'équipe pour la période {periode}",
            "points_forts": ["Données collectées"],
            "points_attention": ["À analyser"],
            "recommandations": ["Continuer le suivi"],
            "analyses_vendeurs": []
        }

    # ==========================================================================
    # 💬 DEBRIEF VENTE (Succès / Échec)
    # ==========================================================================
    
    async def generate_debrief(
        self,
        debrief_data: Dict,
        current_scores: Dict,
        kpi_context: str = "",
        is_success: bool = True
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
        
        if is_success:
            # 🎯 PROMPT FOR SUCCESSFUL SALE (Legacy Restored)
            prompt = f"""Tu es un coach expert en vente retail.
Analyse la vente décrite pour identifier les facteurs de réussite et renforcer les compétences mobilisées.

### CONTEXTE
Tu viens d'analyser une vente qui s'est CONCLUE AVEC SUCCÈS ! Voici les détails :

🎯 Produit vendu : {debrief_data.get('produit', 'Non spécifié')}
👥 Type de client : {debrief_data.get('type_client', 'Non spécifié')}
💼 Situation : {debrief_data.get('situation_vente', 'Non spécifié')}
💬 Description du déroulé : {debrief_data.get('description_vente', 'Non spécifié')}
✨ Moment clé du succès : {debrief_data.get('moment_perte_client', 'Non spécifié')}
🎉 Facteurs de réussite : {debrief_data.get('raisons_echec', 'Non spécifié')}
💪 Ce qui a le mieux fonctionné : {debrief_data.get('amelioration_pensee', 'Non spécifié')}
{kpi_context}

### SCORES ACTUELS DES COMPÉTENCES (sur 5)
- Accueil : {current_scores.get('accueil', 3.0)}
- Découverte : {current_scores.get('decouverte', 3.0)}
- Argumentation : {current_scores.get('argumentation', 3.0)}
- Closing : {current_scores.get('closing', 3.0)}
- Fidélisation : {current_scores.get('fidelisation', 3.0)}

### OBJECTIF
1. FÉLICITER le vendeur pour cette réussite avec enthousiasme !
2. Identifier 2 points forts qui ont contribué au succès
3. Donner 1 recommandation pour reproduire ou dépasser ce succès
4. Donner 1 exemple concret et actionnable
5. **IMPORTANT** : Réévaluer les 5 compétences en valorisant les points forts (+0.2 à +0.5)

### FORMAT DE SORTIE (JSON uniquement)
{{
  "analyse": "[2–3 phrases de FÉLICITATIONS enthousiastes]",
  "points_travailler": "[Point fort 1]\\n[Point fort 2]",
  "recommandation": "[Une phrase courte et motivante]",
  "exemple_concret": "[Action concrète pour reproduire ce succès]",
  "score_accueil": 3.5,
  "score_decouverte": 4.0,
  "score_argumentation": 3.0,
  "score_closing": 3.5,
  "score_fidelisation": 4.0
}}

### STYLE ATTENDU
- Ton ENTHOUSIASTE et FÉLICITANT
- TUTOIEMENT pour le vendeur
- VOUVOIEMENT pour les exemples de dialogue client
- Maximum 12 lignes"""
        else:
            # 🎯 PROMPT FOR MISSED OPPORTUNITY (Legacy Restored)
            prompt = f"""Tu es un coach expert en vente retail.
Analyse la vente décrite pour identifier les causes probables de l'échec et proposer des leviers d'amélioration.

### CONTEXTE
Tu viens de débriefer une opportunité qui n'a pas abouti. Voici les détails :

🎯 Produit : {debrief_data.get('produit', 'Non spécifié')}
👥 Type de client : {debrief_data.get('type_client', 'Non spécifié')}
💼 Situation : {debrief_data.get('situation_vente', 'Non spécifié')}
💬 Description : {debrief_data.get('description_vente', 'Non spécifié')}
📍 Moment clé du blocage : {debrief_data.get('moment_perte_client', 'Non spécifié')}
❌ Raisons évoquées : {debrief_data.get('raisons_echec', 'Non spécifié')}
🔄 Ce que tu penses pouvoir faire différemment : {debrief_data.get('amelioration_pensee', 'Non spécifié')}
{kpi_context}

### SCORES ACTUELS DES COMPÉTENCES (sur 5)
- Accueil : {current_scores.get('accueil', 3.0)}
- Découverte : {current_scores.get('decouverte', 3.0)}
- Argumentation : {current_scores.get('argumentation', 3.0)}
- Closing : {current_scores.get('closing', 3.0)}
- Fidélisation : {current_scores.get('fidelisation', 3.0)}

### OBJECTIF
1. Fournir une analyse commerciale réaliste et empathique
2. Identifier 2 axes d'amélioration concrets
3. Donner 1 recommandation claire et motivante
4. Ajouter 1 exemple concret de phrase ou comportement à adopter
5. **IMPORTANT** : Réévaluer les 5 compétences (ajuster légèrement -0.2 à +0.2)

### FORMAT DE SORTIE (JSON uniquement)
{{
  "analyse": "[2–3 phrases d'analyse réaliste, orientée performance]",
  "points_travailler": "[Axe 1]\\n[Axe 2]",
  "recommandation": "[Une phrase courte, claire et motivante]",
  "exemple_concret": "[Une phrase illustrant ce que tu aurais pu dire ou faire]",
  "score_accueil": 3.5,
  "score_decouverte": 4.0,
  "score_argumentation": 3.0,
  "score_closing": 3.5,
  "score_fidelisation": 4.0
}}

### STYLE ATTENDU
- Ton professionnel, positif et constructif
- TUTOIEMENT pour le vendeur
- VOUVOIEMENT pour les exemples de dialogue client
- Maximum 12 lignes"""

        chat = self._create_chat(
            session_id=f"debrief_{uuid.uuid4()}",
            system_message=DEBRIEF_SYSTEM_PROMPT,
            model="gpt-4o-mini"
        )
        
        response = await self._send_message(chat, prompt)
        
        if response:
            return parse_json_safely(response, self._fallback_debrief(current_scores, is_success))
        else:
            return self._fallback_debrief(current_scores, is_success)
    
    def _fallback_debrief(self, current_scores: Dict, is_success: bool) -> Dict:
        """Fallback debrief"""
        if is_success:
            return {
                "analyse": "Bravo pour cette vente ! Continue sur cette lancée.",
                "points_travailler": "Argumentation produit\nClosing",
                "recommandation": "Continue à appliquer ces techniques gagnantes.",
                "exemple_concret": "La prochaine fois, propose aussi un produit complémentaire.",
                "score_accueil": current_scores.get('accueil', 3.0),
                "score_decouverte": current_scores.get('decouverte', 3.0),
                "score_argumentation": min(current_scores.get('argumentation', 3.0) + 0.2, 5.0),
                "score_closing": min(current_scores.get('closing', 3.0) + 0.2, 5.0),
                "score_fidelisation": current_scores.get('fidelisation', 3.0)
            }
        else:
            return {
                "analyse": "Cette opportunité est une source d'apprentissage. Analysons ensemble.",
                "points_travailler": "Découverte des besoins\nTraitement des objections",
                "recommandation": "Prends plus de temps pour comprendre les motivations du client.",
                "exemple_concret": "Essaie de demander : 'Qu'est-ce qui vous ferait hésiter ?'",
                "score_accueil": current_scores.get('accueil', 3.0),
                "score_decouverte": max(current_scores.get('decouverte', 3.0) - 0.1, 1.0),
                "score_argumentation": current_scores.get('argumentation', 3.0),
                "score_closing": max(current_scores.get('closing', 3.0) - 0.1, 1.0),
                "score_fidelisation": current_scores.get('fidelisation', 3.0)
            }

    # ==========================================================================
    # 📊 EVALUATION FEEDBACK
    # ==========================================================================
    
    async def generate_feedback(self, evaluation_data: Dict) -> str:
        """
        Generate AI feedback for self-evaluation
        
        Args:
            evaluation_data: Self-evaluation scores and comments
            
        Returns:
            Feedback text
        """
        if not self.available:
            return "Feedback automatique temporairement indisponible. Continuez votre excellent travail!"
        
        prompt = f"""Analyse cette auto-évaluation de vendeur retail:

- Accueil: {evaluation_data.get('accueil', 3)}/5
- Découverte: {evaluation_data.get('decouverte', 3)}/5
- Argumentation: {evaluation_data.get('argumentation', 3)}/5
- Closing: {evaluation_data.get('closing', 3)}/5
- Fidélisation: {evaluation_data.get('fidelisation', 3)}/5

Commentaire du vendeur: {evaluation_data.get('auto_comment', 'Aucun')}

Résume les points forts et les points à améliorer de manière positive et coachante en 3-5 phrases maximum. Termine par une suggestion d'action concrète."""

        chat = self._create_chat(
            session_id=f"eval_{evaluation_data.get('id', uuid.uuid4())}",
            system_message=FEEDBACK_SYSTEM_PROMPT,
            model="gpt-4o-mini"
        )
        
        response = await self._send_message(chat, prompt)
        return response or "Feedback automatique temporairement indisponible. Continuez votre excellent travail!"

    # ==========================================================================
    # 🎯 DIAGNOSTIC & CHALLENGES
    # ==========================================================================
    
    async def generate_diagnostic(
        self,
        responses: List[Dict],
        seller_name: str
    ) -> Dict:
        """Generate DISC diagnostic from seller responses"""
        if not self.available:
            return {
                "style": "Adaptateur",
                "level": 3,
                "strengths": ["Polyvalence", "Adaptabilité"],
                "weaknesses": ["À définir"]
            }
        
        responses_text = "\n".join([
            f"Q: {r['question']}\nR: {r['answer']}"
            for r in responses
        ])
        
        prompt = f"""Analyse les réponses de {seller_name}:

{responses_text}

Détermine son profil DISC et réponds en JSON:
{{"style": "D/I/S/C", "level": 1-5, "strengths": ["..."], "weaknesses": ["..."]}}"""

        chat = self._create_chat(
            session_id=f"diagnostic_{uuid.uuid4()}",
            system_message=DIAGNOSTIC_SYSTEM_PROMPT,
            model="gpt-4o-mini"
        )
        
        response = await self._send_message(chat, prompt)
        
        if response:
            return parse_json_safely(response, {
                "style": "Adaptateur",
                "level": 3,
                "strengths": ["Polyvalence"],
                "weaknesses": ["À définir"]
            })
        
        return {
            "style": "Adaptateur",
            "level": 3,
            "strengths": ["Polyvalence", "Adaptabilité"],
            "weaknesses": ["À définir"]
        }
    
    async def generate_daily_challenge(
        self,
        seller_profile: Dict,
        recent_kpis: List[Dict]
    ) -> Dict:
        """Generate personalized daily challenge"""
        if not self.available:
            return {
                "title": "Augmente ton panier moyen",
                "description": "Propose 2 produits complémentaires à chaque client",
                "competence": "vente_additionnelle"
            }
        
        avg_ca = sum(k.get('ca_journalier', 0) for k in recent_kpis) / len(recent_kpis) if recent_kpis else 0
        
        prompt = f"""Profil: {seller_profile.get('style', 'Unknown')} niveau {seller_profile.get('level', 1)}
Performance récente: CA moyen {avg_ca:.0f}€

Génère un défi quotidien personnalisé en JSON:
{{"title": "...", "description": "...", "competence": "..."}}"""

        chat = self._create_chat(
            session_id=f"challenge_{uuid.uuid4()}",
            system_message=CHALLENGE_SYSTEM_PROMPT,
            model="gpt-4o-mini"
        )
        
        response = await self._send_message(chat, prompt)
        
        if response:
            return parse_json_safely(response, {
                "title": "Augmente ton panier moyen",
                "description": "Propose 2 produits complémentaires à chaque client",
                "competence": "vente_additionnelle"
            })
        
        return {
            "title": "Augmente ton panier moyen",
            "description": "Propose 2 produits complémentaires à chaque client",
            "competence": "vente_additionnelle"
        }

    # ==========================================================================
    # 📈 SELLER BILAN
    # ==========================================================================
    
    async def generate_seller_bilan(
        self,
        seller_data: Dict,
        kpis: List[Dict]
    ) -> str:
        """Generate performance report for seller"""
        if not self.available:
            return f"Bilan pour {seller_data.get('name', 'Vendeur')}: Performance en cours d'analyse."
        
        kpi_summary = {
            "total_ca": sum(k.get('ca_journalier', 0) for k in kpis),
            "total_ventes": sum(k.get('nb_ventes', 0) for k in kpis),
            "days_count": len(kpis)
        }
        
        prompt = f"""Génère un bilan de performance pour {seller_data.get('name', 'ce vendeur')}:

CA total: {kpi_summary['total_ca']:.0f}€
Ventes: {kpi_summary['total_ventes']}
Jours travaillés: {kpi_summary['days_count']}

Fournis un bilan encourageant avec:
1. Résumé de la performance
2. Points forts identifiés
3. Axes d'amélioration
4. Objectif pour la prochaine période"""

        chat = self._create_chat(
            session_id=f"bilan_{uuid.uuid4()}",
            system_message="Tu es un coach retail bienveillant qui génère des bilans motivants.",
            model="gpt-4o-mini"
        )
        
        response = await self._send_message(chat, prompt)
        return response or f"Bilan pour {seller_data.get('name', 'Vendeur')}: Performance en cours d'analyse."


# ==============================================================================
# 🔌 DATA SERVICE (Database Integration)
# ==============================================================================

class AIDataService:
    """
    Service for AI operations with database access
    Handles data retrieval for AI features
    """
    
    def __init__(self, db):
        self.db = db
        self.ai_service = AIService()
    
    async def get_seller_diagnostic(self, seller_id: str) -> Dict:
        """Get diagnostic profile for a seller"""
        diagnostic = await self.db.diagnostics.find_one(
            {"seller_id": seller_id},
            {"_id": 0}
        )
        
        if not diagnostic:
            return {"style": "Adaptateur", "level": 3}
        
        return diagnostic
    
    async def get_recent_kpis(self, seller_id: str, limit: int = 7) -> List[Dict]:
        """Get recent KPI entries for a seller"""
        kpis = await self.db.kpi_entries.find(
            {"seller_id": seller_id},
            {"_id": 0}
        ).sort("date", -1).limit(limit).to_list(limit)
        
        return kpis
    
    async def generate_daily_challenge_with_data(self, seller_id: str) -> Dict:
        """Generate daily challenge by fetching data and using AI service"""
        diagnostic = await self.get_seller_diagnostic(seller_id)
        recent_kpis = await self.get_recent_kpis(seller_id, 7)
        
        return await self.ai_service.generate_daily_challenge(
            seller_profile=diagnostic,
            recent_kpis=recent_kpis
        )
    
    async def generate_seller_bilan_with_data(
        self, 
        seller_id: str,
        seller_data: Dict,
        days: int = 30
    ) -> str:
        """Generate seller bilan with KPI data"""
        kpis = await self.db.kpi_entries.find(
            {"seller_id": seller_id},
            {"_id": 0}
        ).sort("date", -1).limit(days).to_list(days)
        
        return await self.ai_service.generate_seller_bilan(seller_data, kpis)
