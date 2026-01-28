"""
Relationship & Conflict Advice Service
Phase 12: repositories only (no direct db in services).
"""
from typing import Dict, List, Optional
from datetime import datetime, timezone, timedelta
from uuid import uuid4
import json
import logging

from repositories.user_repository import UserRepository
from repositories.manager_diagnostic_results_repository import ManagerDiagnosticResultsRepository
from repositories.diagnostic_repository import DiagnosticRepository
from repositories.kpi_repository import KPIRepository
from repositories.debrief_repository import DebriefRepository
from repositories.relationship_consultation_repository import RelationshipConsultationRepository

logger = logging.getLogger(__name__)


class RelationshipService:
    """Service for relationship advice generation (repositories only)."""

    def __init__(self, db, ai_service=None):
        self.user_repo = UserRepository(db)
        self.manager_diagnostic_results_repo = ManagerDiagnosticResultsRepository(db)
        self.diagnostic_repo = DiagnosticRepository(db)
        self.kpi_repo = KPIRepository(db)
        self.debrief_repo = DebriefRepository(db)
        self.relationship_consultation_repo = RelationshipConsultationRepository(db)
        if ai_service is None:
            from services.ai_service import AIService
            self.ai_service = AIService(db)
        else:
            self.ai_service = ai_service
    
    async def generate_recommendation(
        self,
        seller_id: str,
        advice_type: str,  # "relationnel" or "conflit"
        situation_type: str,
        description: str,
        manager_id: Optional[str] = None,
        manager_name: Optional[str] = None,
        store_id: Optional[str] = None,
        is_seller_request: bool = False
    ) -> Dict:
        """
        Generate AI-powered relationship/conflict advice.
        
        Args:
            seller_id: ID of the seller (required)
            advice_type: "relationnel" or "conflit"
            situation_type: Type of situation (e.g., "augmentation", "demotivation")
            description: Description of the situation
            manager_id: Manager ID (for manager requests)
            manager_name: Manager name (for manager requests)
            store_id: Store ID
            is_seller_request: True if request comes from seller (self-advice)
        
        Returns:
            Dict with recommendation and consultation data
        """
        try:
            seller_query = {"id": seller_id}
            if store_id:
                seller_query["store_id"] = store_id
            seller = await self.user_repo.find_one(seller_query, {"_id": 0, "password": 0})
            if not seller:
                raise ValueError("Vendeur non trouvé")
            if is_seller_request:
                manager_id = seller.get("manager_id")
                if not manager_id:
                    raise ValueError("Vendeur sans manager associé")
            manager_diagnostic = None
            if manager_id:
                manager_diagnostic = await self.manager_diagnostic_results_repo.find_by_manager(manager_id)
            seller_diagnostic = await self.diagnostic_repo.find_by_seller(seller_id)
            if seller_diagnostic is None:
                seller_diagnostic = {}
            thirty_days_ago = (datetime.now(timezone.utc) - timedelta(days=30)).strftime("%Y-%m-%d")
            today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
            kpi_entries = await self.kpi_repo.find_by_date_range(seller_id, thirty_days_ago, today_str)
            if len(kpi_entries) > 100:
                kpi_entries = kpi_entries[:100]
            recent_debriefs = await self.debrief_repo.find_many(
                {"seller_id": seller_id, "shared_with_manager": True},
                {"_id": 0},
                5,
                0,
                [("created_at", -1)],
            )
            
            # Prepare data summary for AI
            kpi_summary = f"KPIs sur les 30 derniers jours : {len(kpi_entries)} entrées"
            if kpi_entries:
                total_ca = sum(entry.get('ca_journalier', 0) or entry.get('ca', 0) for entry in kpi_entries)
                total_ventes = sum(entry.get('nb_ventes', 0) or entry.get('ventes', 0) for entry in kpi_entries)
                kpi_summary += f"\n- CA total : {total_ca:.2f}€\n- Ventes totales : {total_ventes}"
            
            debrief_summary = f"{len(recent_debriefs)} debriefs récents"
            if recent_debriefs:
                debrief_summary += ":\n" + "\n".join([
                    f"- {d.get('date', 'Date inconnue')}: {d.get('summary', d.get('analyse', 'Pas de résumé'))[:100]}"
                    for d in recent_debriefs
                ])
            
            # Build AI prompt
            advice_type_fr = "relationnelle" if advice_type == "relationnel" else "de conflit"
            
            # Adapt prompt for seller vs manager
            if is_seller_request:
                system_message = f"""Tu es un coach retail spécialisé en gestion {advice_type_fr}.
Tu aides un vendeur à gérer une situation {advice_type_fr} avec son manager ou son équipe.
Fournis des conseils pratiques et actionnables pour améliorer la situation."""
                
                user_prompt = f"""# Situation {advice_type_fr.upper()}

**Type de situation :** {situation_type}
**Description :** {description}

## Mon Profil
**Prénom :** {seller.get('first_name', seller.get('name', 'Vendeur'))}
**Profil de personnalité :** {json.dumps(seller_diagnostic.get('profile', {}), ensure_ascii=False) if seller_diagnostic else 'Non disponible'}

## Mes Performances
{kpi_summary}

## Mes Debriefs récents
{debrief_summary}

# Ta mission
Fournis une recommandation CONCISE et ACTIONNABLE (maximum 400 mots) structurée avec :

## Analyse de la situation (2-3 phrases max)
- Diagnostic rapide en tenant compte de mon profil de personnalité

## Conseils pratiques (3 actions concrètes max)
- Actions spécifiques que je peux mettre en place immédiatement
- Adaptées à mon profil de personnalité

## Phrases clés (2-3 phrases max)
- Formulations précises pour communiquer avec mon manager/équipe

## Points de vigilance (2 points max)
- Ce qu'il faut éviter compte tenu de mon profil

IMPORTANT : Sois CONCIS, DIRECT et PRATIQUE. Évite les longues explications théoriques."""
            else:
                system_message = f"""Tu es un expert en management d'équipe retail et en gestion {advice_type_fr}.
Tu dois fournir des conseils personnalisés basés sur les profils de personnalité et les performances."""
                
                manager_name_display = manager_name or "Manager"
                user_prompt = f"""# Situation {advice_type_fr.upper()}

**Type de situation :** {situation_type}
**Description :** {description}

## Contexte Manager
**Prénom :** {manager_name_display}
**Profil de personnalité :** {json.dumps(manager_diagnostic.get('profile', {}), ensure_ascii=False) if manager_diagnostic else 'Non disponible'}

## Contexte Vendeur
**Prénom :** {seller.get('first_name', seller.get('name', 'Vendeur'))}
**Statut :** {seller.get('status', 'actif')}
**Profil de personnalité :** {json.dumps(seller_diagnostic.get('profile', {}), ensure_ascii=False) if seller_diagnostic else 'Non disponible'}

## Performances
{kpi_summary}

## Debriefs récents
{debrief_summary}

# Ta mission
Fournis une recommandation CONCISE et ACTIONNABLE (maximum 400 mots) structurée avec :

## Analyse de la situation (2-3 phrases max)
- Diagnostic rapide en tenant compte des profils de personnalité

## Conseils pratiques (3 actions concrètes max)
- Actions spécifiques et immédiatement applicables
- Adaptées aux profils de personnalité

## Phrases clés (2-3 phrases max)
- Formulations précises adaptées au profil du vendeur

## Points de vigilance (2 points max)
- Ce qu'il faut éviter compte tenu des profils

IMPORTANT : Sois CONCIS, DIRECT et PRATIQUE. Évite les longues explications théoriques."""
            
            # Check AI service availability
            if not self.ai_service.available:
                logger.warning(
                    "Relationship advice failed: AI service unavailable",
                    extra={"store_id": store_id, "seller_id": seller_id, "advice_type": advice_type}
                )
                raise ValueError("Service IA non disponible")
            
            # Generate AI response
            try:
                ai_response = await self.ai_service._send_message(
                    system_message=system_message,
                    user_prompt=user_prompt,
                    model="gpt-4o"
                )
            except Exception as ai_error:
                logger.exception(
                    "Relationship advice failed: AI call error",
                    extra={
                        "store_id": store_id,
                        "seller_id": seller_id,
                        "advice_type": advice_type,
                        "situation_type": situation_type,
                        "error": str(ai_error)
                    }
                )
                raise ValueError(f"Erreur lors de la génération du conseil: {str(ai_error)}")
            
            if not ai_response:
                logger.warning(
                    "Relationship advice failed: Empty AI response",
                    extra={"store_id": store_id, "seller_id": seller_id}
                )
                raise ValueError("Erreur lors de la génération du conseil: réponse vide")
            
            return {
                "recommendation": ai_response,
                "seller_name": f"{seller.get('first_name', '')} {seller.get('last_name', '')}".strip() or seller.get('name', 'Vendeur')
            }
            
        except ValueError:
            raise
        except Exception as e:
            logger.exception(
                "Relationship advice generation failed",
                extra={
                    "seller_id": seller_id,
                    "advice_type": advice_type,
                    "error": str(e)
                }
            )
            raise ValueError(f"Erreur lors de la génération du conseil: {str(e)}")
    
    async def save_consultation(
        self,
        consultation_data: Dict
    ) -> str:
        """
        Save a consultation to history.
        
        Args:
            consultation_data: Dict with consultation fields
        
        Returns:
            consultation_id
        """
        try:
            consultation_id = str(uuid4())
            consultation = {
                "id": consultation_id,
                **consultation_data,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            
            await self.relationship_consultation_repo.create_consultation(consultation)
            return consultation_id
            
        except Exception as e:
            logger.error(f"Error saving consultation: {e}", exc_info=True)
            raise ValueError(f"Erreur lors de la sauvegarde: {str(e)}")
    
    async def list_consultations(
        self,
        manager_id: Optional[str] = None,
        seller_id: Optional[str] = None,
        store_id: Optional[str] = None,
        advice_type: Optional[str] = None,
        limit: int = 100
    ) -> List[Dict]:
        """
        List consultations with filters.
        
        Args:
            manager_id: Filter by manager ID
            seller_id: Filter by seller ID
            store_id: Filter by store ID
            advice_type: Filter by advice type ("relationnel" or "conflit")
            limit: Maximum number of results
        
        Returns:
            List of consultations
        """
        try:
            query = {}
            if manager_id:
                query["manager_id"] = manager_id
            if seller_id:
                query["seller_id"] = seller_id
            if store_id:
                query["store_id"] = store_id
            if advice_type:
                query["advice_type"] = advice_type
            
            consultations = await self.relationship_consultation_repo.find_many_by_filters(
                query, limit=limit
            )
            return consultations
            
        except Exception as e:
            logger.error(f"Error listing consultations: {e}", exc_info=True)
            raise ValueError(f"Erreur lors de la récupération: {str(e)}")

