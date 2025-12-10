"""AI Service - Integration with Emergent LLM and OpenAI"""
import os
import json
from typing import Dict, List, Optional
from emergentintegrations import OpenAI

from core.config import settings

# AI Configuration
EMERGENT_KEY = settings.EMERGENT_LLM_KEY

# Prompt constants
DIAGNOSTIC_SYSTEM_PROMPT = """Tu es un expert en analyse comportementale DISC pour le commerce de détail.
Analyse les réponses du vendeur et détermine son profil DISC principal.
Réponds UNIQUEMENT avec un JSON contenant: style, level, strengths, weaknesses."""

CHALLENGE_SYSTEM_PROMPT = """Tu es un coach commercial qui génère des défis quotidiens personnalisés.
Crée un défi adapté au niveau et au style du vendeur."""

BILAN_SYSTEM_PROMPT = """Tu es un expert en analyse de performance commerciale.
Analyse les KPIs du vendeur et génère un bilan avec recommandations."""


class AIService:
    """Service for AI operations with Emergent LLM"""
    
    def __init__(self):
        self.client = OpenAI(api_key=EMERGENT_KEY)
    
    async def generate_diagnostic(
        self,
        responses: List[Dict],
        seller_name: str
    ) -> Dict:
        """
        Generate DISC diagnostic from seller responses
        
        Args:
            responses: List of question/answer pairs
            seller_name: Seller name for personalization
            
        Returns:
            Dict with style, level, strengths, weaknesses
        """
        try:
            # Format responses for AI
            responses_text = "\n".join([
                f"Q: {r['question']}\nR: {r['answer']}"
                for r in responses
            ])
            
            prompt = f"""Analyse les réponses de {seller_name}:\n\n{responses_text}\n\nDétermine son profil DISC."""
            
            response = self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": DIAGNOSTIC_SYSTEM_PROMPT},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.7
            )
            
            result = json.loads(response.choices[0].message.content)
            return result
            
        except Exception as e:
            # Fallback if AI fails
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
        """
        Generate personalized daily challenge
        
        Args:
            seller_profile: Seller DISC profile
            recent_kpis: Recent KPI performance
            
        Returns:
            Dict with challenge title, description, competence
        """
        try:
            context = f"""Profil: {seller_profile.get('style', 'Unknown')} niveau {seller_profile.get('level', 1)}
Performance récente: CA moyen {sum(k.get('ca_journalier', 0) for k in recent_kpis) / len(recent_kpis) if recent_kpis else 0:.0f}€"""
            
            response = self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": CHALLENGE_SYSTEM_PROMPT},
                    {"role": "user", "content": f"Génère un défi pour: {context}"}
                ],
                temperature=0.8
            )
            
            result = json.loads(response.choices[0].message.content)
            return result
            
        except Exception as e:
            # Fallback
            return {
                "title": "Augmente ton panier moyen",
                "description": "Propose 2 produits complémentaires à chaque client",
                "competence": "vente_additionnelle"
            }
    
    async def generate_seller_bilan(
        self,
        seller_data: Dict,
        kpis: List[Dict]
    ) -> str:
        """
        Generate performance report for seller
        
        Args:
            seller_data: Seller info
            kpis: KPI entries
            
        Returns:
            Formatted bilan text
        """
        try:
            kpi_summary = {
                "total_ca": sum(k.get('ca_journalier', 0) for k in kpis),
                "total_ventes": sum(k.get('nb_ventes', 0) for k in kpis),
                "days_count": len(kpis)
            }
            
            prompt = f"""Génère un bilan pour {seller_data['name']}:
CA total: {kpi_summary['total_ca']}€
Ventes: {kpi_summary['total_ventes']}
Jours travaillés: {kpi_summary['days_count']}"""
            
            response = self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": BILAN_SYSTEM_PROMPT},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.7
            )
            
            return response.choices[0].message.content
            
        except Exception as e:
            return f"Bilan pour {seller_data['name']}: Performance en cours d'analyse."
