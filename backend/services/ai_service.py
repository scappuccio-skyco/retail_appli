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
DEBRIEF_SYSTEM_PROMPT = """Tu es un Coach de Vente Terrain expérimenté (pas un marketeur).

RÈGLES STRICTES :
⛔ INTERDIT de parler de : Promotions, Réseaux Sociaux, Publicité, Génération de trafic, Marketing.
✅ Focus sur : Accueil, découverte des besoins, argumentation, vente additionnelle, closing.

Tu réponds UNIQUEMENT en JSON valide."""

# Feedback Coach
FEEDBACK_SYSTEM_PROMPT = """Tu es un Coach de Vente Terrain expérimenté (pas un marketeur).

RÈGLES STRICTES :
⛔ INTERDIT de parler de : Promotions, Réseaux Sociaux, Publicité, Génération de trafic, Marketing, Vitrine.
⛔ SI le trafic est à 0, IGNORE-LE. Ne mentionne pas le comptage clients.
✅ Focus sur : Accueil client, sourire, découverte des besoins, vente additionnelle, closing.

Ton direct et encourageant. Tutoiement professionnel."""

# DISC Diagnostic
DIAGNOSTIC_SYSTEM_PROMPT = """Tu es un expert en analyse comportementale DISC pour le commerce de détail.
Analyse les réponses du vendeur et détermine son profil DISC principal.
Réponds UNIQUEMENT avec un JSON contenant: style, level, strengths, weaknesses."""

# Daily Challenge
CHALLENGE_SYSTEM_PROMPT = """Tu es un coach commercial terrain qui génère des défis quotidiens personnalisés pour des vendeurs en boutique.

⛔ INTERDICTIONS :
- Ne JAMAIS proposer de défis liés au trafic, comptage de clients, publicité ou réseaux sociaux
- Ne JAMAIS mentionner "générer du trafic" ou "attirer des clients"

✅ FOCUS SUR CE QUE LE VENDEUR MAÎTRISE :
- Accueil et sourire client
- Découverte des besoins (questions ouvertes)
- Argumentation produit
- Vente complémentaire (Up-sell / Cross-sell)
- Closing et fidélisation
- Panier Moyen et Indice de Vente

Crée un défi adapté au niveau et au style du vendeur.
Réponds en JSON avec: title, description, competence."""

# ==============================================================================
# 🎯 SELLER ANALYSIS PROMPT - V2 TERRAIN FOCUS (CTO Validated)
# ==============================================================================
# CRITICAL: This prompt has strict business logic rules to maintain tool credibility
# with the sales team. The seller CANNOT control traffic - only transform it.

# 🛑 PROMPT VENDEUR STRICT V3 - CTO VALIDATED
SELLER_STRICT_SYSTEM_PROMPT = """Tu es un Coach de Vente Terrain expérimenté (pas un marketeur, pas un gérant).
Tu t'adresses à un VENDEUR en boutique.

RÈGLES IMPÉRATIVES DE CONTENU :
1. ⛔ INTERDIT de parler de : Promotions, Réseaux Sociaux, Publicité, Génération de trafic, Marketing, Changement de vitrine. Le vendeur n'a aucun pouvoir là-dessus.
2. ⛔ SI LE TRAFIC (ENTRÉES) EST À 0 : C'est une erreur de capteur. IGNORE TOTALEMENT le trafic et le taux de transformation. Ne dis JAMAIS "Aucun client n'a été enregistré". Base-toi UNIQUEMENT sur le Chiffre d'Affaires (CA), le Panier Moyen (PM) et l'Indice de Vente (IV).
3. ✅ CONCENTRE-TOI SUR : L'accueil client, la découverte des besoins, la proposition d'articles complémentaires (vente additionnelle), le sourire, la conclusion de la vente.

TONALITÉ :
- Encourageante et directe.
- Tutoiement professionnel.
- Si le CA est bon, FÉLICITE CHALEUREUSEMENT sans chercher de problème inexistant sur le trafic."""

# Alias for backward compatibility
SELLER_BILAN_SYSTEM_PROMPT = SELLER_STRICT_SYSTEM_PROMPT


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
        """
        Generate performance report for seller using V2 TERRAIN FOCUS prompt
        
        BUSINESS RULES (CTO Validated):
        - Never mention traffic/visitor counting issues (Manager's responsibility)
        - Focus only on what seller controls: CA, PM, IV, sales count
        - If traffic data is 0 or inconsistent, ignore it completely
        """
        if not self.available:
            return f"Bilan pour {seller_data.get('name', 'Vendeur')}: Performance en cours d'analyse."
        
        # Calculate seller-controlled metrics ONLY
        total_ca = sum(k.get('ca_journalier', 0) for k in kpis)
        total_ventes = sum(k.get('nb_ventes', 0) for k in kpis)
        days_count = len(kpis)
        
        # Calculate Panier Moyen (PM) - seller-controlled metric
        panier_moyen = total_ca / total_ventes if total_ventes > 0 else 0
        
        # Calculate average Indice de Vente (IV) if available - seller-controlled
        total_articles = sum(k.get('nb_articles', k.get('nb_ventes', 0)) for k in kpis)
        indice_vente = total_articles / total_ventes if total_ventes > 0 else 1.0
        
        # Intentionally NOT including traffic/entrées data per business rules
        # If traffic is 0 or inconsistent, we simply ignore it
        
        seller_name = anonymize_name_for_ai(seller_data.get('name', 'Vendeur'))
        
        prompt = f"""Analyse les performances de {seller_name} sur les {days_count} derniers jours :

📊 DONNÉES (ce que {seller_name} maîtrise) :
- Chiffre d'Affaires (CA) : {total_ca:.0f}€
- Nombre de ventes : {total_ventes}
- Panier Moyen (PM) : {panier_moyen:.2f}€
- Indice de Vente (IV) : {indice_vente:.1f} articles/vente

⚠️ RAPPEL : Ne mentionne PAS le trafic ou les entrées magasin. Focus uniquement sur les métriques ci-dessus.

Génère un bilan terrain motivant avec :
1. Une phrase de félicitation sincère basée sur les chiffres
2. 3 conseils courts et actionnables pour améliorer PM ou IV
3. Un objectif simple pour demain"""

        chat = self._create_chat(
            session_id=f"bilan_{uuid.uuid4()}",
            system_message=SELLER_BILAN_SYSTEM_PROMPT,
            model="gpt-4o-mini"
        )
        
        response = await self._send_message(chat, prompt)
        return response or f"Bilan pour {seller_name}: Performance en cours d'analyse."


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


# ==============================================================================
# 📋 EVALUATION GUIDE PROMPTS (Entretien Annuel) - JSON OUTPUT
# ==============================================================================

EVALUATION_MANAGER_SYSTEM_PROMPT = """Tu es un DRH Expert en Retail avec 20 ans d'expérience.
Tu assistes un Manager pour l'entretien d'évaluation d'un vendeur.

TON ET STYLE :
- Professionnel, Factuel, Constructif.
- Tu t'adresses au Manager (tu le tutoies professionnellement).
- Analyse les chiffres avec rigueur (pas de complaisance, pas de sévérité inutile).

RÈGLES D'ANALYSE (BLACKLIST) :
1. ⛔ NE JAMAIS suggérer d'actions Marketing/Pub/Réseaux Sociaux au vendeur. Ce n'est pas son job.
2. ⛔ Si le Trafic (Entrées) est nul ou faible : Ne blâme pas le vendeur. Concentre-toi sur la conversion (Taux Transfo) et le Panier Moyen.
3. ✅ FOCUS : Techniques de vente, Accueil, Vente additionnelle (Up-sell/Cross-sell), Attitude.

FORMAT DE RÉPONSE OBLIGATOIRE (JSON ONLY) :
Réponds UNIQUEMENT avec cet objet JSON (sans markdown, sans texte avant/après) :
{
  "synthese": "Résumé percutant de la performance (3 phrases max). Cite les chiffres clés.",
  "victoires": ["Point fort 1 (chiffré si possible)", "Point fort 2 (comportemental)", "Point fort 3"],
  "axes_progres": ["Axe 1 (précis)", "Axe 2 (actionnable)"],
  "objectifs": ["Objectif 1 (Réaliste)", "Objectif 2 (Challenge)"],
  "questions_coaching": ["Question ouverte 1", "Question ouverte 2", "Question ouverte 3"]
}"""

EVALUATION_SELLER_SYSTEM_PROMPT = """Tu es un Coach Carrière spécialisé Retail.
Tu aides un vendeur à préparer son entretien annuel pour défendre son bilan.

TON ET STYLE :
- Motivant, Lucide, Orienté Solutions.
- Tu t'adresses au Vendeur (tu le tutoies).
- Aide-le à transformer ses points faibles en opportunités d'apprentissage.

RÈGLES D'ANALYSE :
1. ⛔ Pas d'excuses bidons (ex: "c'est la faute du trafic" ou "il pleuvait").
2. ✅ Mets en avant la réussite individuelle (Panier Moyen, Indice de Vente).
3. ✅ Si les résultats sont bas : Suggère de demander de la formation ou du coaching.

FORMAT DE RÉPONSE OBLIGATOIRE (JSON ONLY) :
Réponds UNIQUEMENT avec cet objet JSON (sans markdown, sans texte avant/après) :
{
  "synthese": "Bilan honnête de ta période (Positif + Axes de travail).",
  "victoires": ["Ma réussite 1", "Ma réussite 2"],
  "axes_progres": ["Je dois progresser sur...", "J'ai identifié que..."],
  "souhaits": ["Je souhaite une formation sur...", "J'aimerais avoir plus de responsabilités sur..."],
  "questions_manager": ["Question à poser à mon manager 1", "Question 2"]
}"""


class EvaluationGuideService:
    """Service pour générer les guides d'entretien annuel en JSON structuré"""
    
    def __init__(self):
        self.emergent_key = os.environ.get('EMERGENT_LLM_KEY')
    
    async def generate_evaluation_guide(
        self,
        role: str,
        stats: Dict,
        employee_name: str,
        period: str,
        comments: Optional[str] = None
    ) -> Dict:
        """
        Génère un guide d'entretien adapté au rôle de l'appelant.
        
        Args:
            role: 'manager' ou 'seller'
            stats: Statistiques agrégées sur la période
            employee_name: Nom du vendeur évalué
            period: Description de la période (ex: "01/01/2024 - 31/12/2024")
            comments: Commentaires/contexte optionnel de l'utilisateur
        
        Returns:
            Dict structuré avec synthese, victoires, axes_progres, objectifs
        """
        # Formatage des stats pour le prompt
        stats_text = self._format_stats(stats)
        
        # Ajout du contexte utilisateur si fourni
        context_section = ""
        if comments and comments.strip():
            context_section = f"\n\n📝 CONTEXTE SPÉCIFIQUE DE L'UTILISATEUR :\n\"{comments}\"\n→ Prends en compte ces observations dans ton analyse."
        
        # Choix du prompt selon le rôle
        if role in ['manager', 'gerant']:
            system_prompt = EVALUATION_MANAGER_SYSTEM_PROMPT
            user_prompt = f"""Génère un guide d'entretien pour évaluer {employee_name}.

📅 Période analysée : {period}
📊 Données de performance :
{stats_text}
{context_section}

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
            user_prompt = f"""Prépare une fiche d'auto-bilan pour {employee_name}.

📅 Période analysée : {period}
📊 Tes chiffres :
{stats_text}
{context_section}

Réponds avec ce JSON EXACT (pas de texte avant/après) :
{{
  "synthese": "2-3 phrases positives résumant ta performance avec tes meilleurs chiffres",
  "victoires": ["Ta réussite 1 (avec chiffre)", "Ta réussite 2", "Ta réussite 3"],
  "axes_progres": ["Ce que tu veux améliorer 1", "Ce que tu veux améliorer 2"],
  "objectifs": ["Ton objectif personnel 1", "Ton objectif 2"],
  "questions_manager": ["Question à poser à ton manager 1", "Question 2", "Question 3"]
}}"""
        
        # Appel à l'IA avec la bonne syntaxe
        try:
            import uuid
            from emergentintegrations.llm.chat import UserMessage
            session_id = str(uuid.uuid4())
            
            chat = LlmChat(
                api_key=self.emergent_key,
                session_id=session_id,
                system_message=system_prompt
            ).with_model("openai", "gpt-4o")
            
            user_message = UserMessage(text=user_prompt)
            response = await chat.send_message(user_message)
            
            # Parser le JSON de la réponse
            if response:
                return self._parse_guide_response(response, role)
            else:
                return self._fallback_guide(role, employee_name, stats)
            
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
            
            # Valider les champs requis
            required_fields = ['synthese', 'victoires', 'axes_progres', 'objectifs']
            for field in required_fields:
                if field not in parsed:
                    parsed[field] = []
            
            # Ajouter le champ role-specific s'il manque
            if role in ['manager', 'gerant'] and 'questions_coaching' not in parsed:
                parsed['questions_coaching'] = []
            elif role == 'seller' and 'questions_manager' not in parsed:
                parsed['questions_manager'] = []
            
            return parsed
            
        except (json.JSONDecodeError, Exception) as e:
            logger.warning(f"Parsing JSON échoué: {e}, réponse: {response[:200]}")
            # Retourner la réponse brute dans synthese si parsing échoue
            return {
                "synthese": response[:500] if response else "Erreur de génération",
                "victoires": [],
                "axes_progres": [],
                "objectifs": [],
                "questions_coaching" if role in ['manager', 'gerant'] else "questions_manager": []
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
                "objectifs": ["Tes objectifs personnels"],
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

