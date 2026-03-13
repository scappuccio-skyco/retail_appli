"""
Relationship & Conflict Advice Service
All dependencies injected via __init__ (no self.db).
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
from utils.kpi_pipeline import build_seller_kpi_pipeline, EMPTY_KPI_METRICS
from repositories.debrief_repository import DebriefRepository
from repositories.relationship_consultation_repository import RelationshipConsultationRepository
from repositories.conflict_consultation_repository import ConflictConsultationRepository
from services.ai_service import AIService

logger = logging.getLogger(__name__)


class RelationshipService:
    """Service for relationship advice generation. All repos and ai_service injected via __init__."""

    def __init__(
        self,
        user_repo: UserRepository,
        manager_diagnostic_results_repo: ManagerDiagnosticResultsRepository,
        diagnostic_repo: DiagnosticRepository,
        kpi_repo: KPIRepository,
        debrief_repo: DebriefRepository,
        relationship_consultation_repo: RelationshipConsultationRepository,
        ai_service: AIService,
        conflict_consultation_repo: Optional[ConflictConsultationRepository] = None,
    ):
        self.user_repo = user_repo
        self.manager_diagnostic_results_repo = manager_diagnostic_results_repo
        self.diagnostic_repo = diagnostic_repo
        self.kpi_repo = kpi_repo
        self.debrief_repo = debrief_repo
        self.relationship_consultation_repo = relationship_consultation_repo
        self.ai_service = ai_service
        self.conflict_consultation_repo = conflict_consultation_repo
    
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
            kpi_pipeline = build_seller_kpi_pipeline(seller_id, thirty_days_ago, today_str)
            kpi_result = await self.kpi_repo.aggregate(kpi_pipeline, max_results=1)
            kpi_metrics = kpi_result[0] if kpi_result else dict(EMPTY_KPI_METRICS)
            recent_debriefs = await self.debrief_repo.find_many(
                {"seller_id": seller_id, "shared_with_manager": True},
                {"_id": 0},
                5,
                0,
                [("created_at", -1)],
            )
            
            # Prepare data summary for AI (agrégats serveur — source de vérité)
            kpi_summary = f"KPIs sur les 30 derniers jours : {kpi_metrics['nb_jours']} jours saisis"
            if kpi_metrics['nb_jours'] > 0:
                kpi_summary += (
                    f"\n- CA total : {kpi_metrics['ca']:.2f}€"
                    f"\n- Ventes : {kpi_metrics['ventes']}"
                    f"\n- Panier moyen : {kpi_metrics['panier_moyen']:.2f}€"
                )
                if kpi_metrics['articles'] > 0:
                    kpi_summary += f"\n- Indice de vente : {kpi_metrics['indice_vente']:.2f} art/vente"
                if kpi_metrics['prospects'] > 0:
                    kpi_summary += f"\n- Taux de transformation : {kpi_metrics['taux_transformation']:.1f}%"
            
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

    # ==========================================================================
    # CONFLICT RESOLUTION — merged from ConflictService
    # ==========================================================================

    async def generate_conflict_advice(
        self,
        seller_id: str,
        contexte: str,
        comportement_observe: str,
        impact: str,
        tentatives_precedentes: str,
        description_libre: str,
        manager_id: Optional[str] = None,
        manager_name: Optional[str] = None,
        store_id: Optional[str] = None,
        is_seller_request: bool = False,
    ) -> Dict:
        """Generate AI-powered conflict resolution advice (seller or manager perspective)."""
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

            if is_seller_request:
                system_message = (
                    "Tu es un coach retail spécialisé en résolution de conflits.\n"
                    "Tu aides un vendeur à gérer un conflit avec son manager ou son équipe.\n"
                    "Fournis une analyse claire et des actions concrètes pour résoudre la situation."
                )
                user_prompt = f"""# Conflit Signalé

**Contexte :** {contexte}
**Comportement observé :** {comportement_observe}
**Impact :** {impact}
**Tentatives précédentes :** {tentatives_precedentes}
**Détails supplémentaires :** {description_libre}

## Mon Profil
**Prénom :** {seller.get('first_name', seller.get('name', 'Vendeur'))}
**Profil de personnalité :** {json.dumps(seller_diagnostic.get('profile', {}), ensure_ascii=False) if seller_diagnostic else 'Non disponible'}

# Ta mission
Fournis une analyse structurée avec :

## Analyse de la situation
- Diagnostic du conflit (2-3 phrases)

## Approche de communication
- Comment aborder la conversation (3 points concrets)

## Actions concrètes
- Liste d'actions à mettre en place (3-5 actions)

## Points de vigilance
- Ce qu'il faut éviter (2-3 points)

IMPORTANT : Sois CONCIS, DIRECT et PRATIQUE."""
            else:
                system_message = (
                    "Tu es un expert en résolution de conflits en équipe retail.\n"
                    "Tu aides un manager à gérer un conflit avec un vendeur.\n"
                    "Fournis une analyse claire et des actions concrètes."
                )
                manager_name_display = manager_name or "Manager"
                user_prompt = f"""# Conflit Signalé

**Contexte :** {contexte}
**Comportement observé :** {comportement_observe}
**Impact :** {impact}
**Tentatives précédentes :** {tentatives_precedentes}
**Détails supplémentaires :** {description_libre}

## Contexte Manager
**Prénom :** {manager_name_display}
**Profil de personnalité :** {json.dumps(manager_diagnostic.get('profile', {}), ensure_ascii=False) if manager_diagnostic else 'Non disponible'}

## Contexte Vendeur
**Prénom :** {seller.get('first_name', seller.get('name', 'Vendeur'))}
**Statut :** {seller.get('status', 'actif')}
**Profil de personnalité :** {json.dumps(seller_diagnostic.get('profile', {}), ensure_ascii=False) if seller_diagnostic else 'Non disponible'}

# Ta mission
Fournis une analyse structurée avec :

## Analyse de la situation
- Diagnostic du conflit (2-3 phrases)

## Approche de communication
- Comment aborder la conversation (3 points concrets)

## Actions concrètes
- Liste d'actions à mettre en place (3-5 actions)

## Points de vigilance
- Ce qu'il faut éviter (2-3 points)

IMPORTANT : Sois CONCIS, DIRECT et PRATIQUE."""

            if not self.ai_service.available:
                raise ValueError("Service IA non disponible")

            try:
                ai_response = await self.ai_service._send_message(
                    system_message=system_message,
                    user_prompt=user_prompt,
                    model="gpt-4o",
                )
            except Exception as ai_error:
                logger.exception("Conflict advice AI call error", extra={"seller_id": seller_id})
                raise ValueError(f"Erreur lors de la génération: {str(ai_error)}")

            if not ai_response:
                raise ValueError("Erreur lors de la génération: réponse vide")

            analysis = self._extract_section(ai_response, "Analyse de la situation")
            communication = self._extract_section(ai_response, "Approche de communication")
            actions = self._extract_list_items(ai_response, "Actions concrètes")
            vigilance = self._extract_list_items(ai_response, "Points de vigilance")

            return {
                "ai_analyse_situation": analysis or ai_response[:500],
                "ai_approche_communication": communication or "",
                "ai_actions_concretes": actions or [],
                "ai_points_vigilance": vigilance or [],
                "seller_name": (
                    f"{seller.get('first_name', '')} {seller.get('last_name', '')}".strip()
                    or seller.get("name", "Vendeur")
                ),
            }

        except ValueError:
            raise
        except Exception as e:
            logger.exception("Conflict advice generation failed", extra={"seller_id": seller_id})
            raise ValueError(f"Erreur lors de la génération: {str(e)}")

    async def save_conflict(self, conflict_data: Dict) -> str:
        """Save a conflict consultation to history."""
        if not self.conflict_consultation_repo:
            raise ValueError("ConflictConsultationRepository non configuré")
        try:
            conflict_id = str(uuid4())
            conflict = {"id": conflict_id, **conflict_data, "created_at": datetime.now(timezone.utc).isoformat()}
            await self.conflict_consultation_repo.create_consultation(conflict)
            return conflict_id
        except Exception as e:
            logger.error(f"Error saving conflict: {e}", exc_info=True)
            raise ValueError(f"Erreur lors de la sauvegarde: {str(e)}")

    async def list_conflicts(
        self,
        manager_id: Optional[str] = None,
        seller_id: Optional[str] = None,
        store_id: Optional[str] = None,
        limit: int = 100,
    ) -> List[Dict]:
        """List conflict consultations with filters."""
        if not self.conflict_consultation_repo:
            return []
        try:
            query: Dict = {}
            if manager_id:
                query["manager_id"] = manager_id
            if seller_id:
                query["seller_id"] = seller_id
            if store_id:
                query["store_id"] = store_id
            return await self.conflict_consultation_repo.find_many_by_filters(query, limit=limit)
        except Exception as e:
            logger.error(f"Error listing conflicts: {e}", exc_info=True)
            raise ValueError(f"Erreur lors de la récupération: {str(e)}")

    # ------------------------------------------------------------------
    # Internal helpers (shared by conflict methods)
    # ------------------------------------------------------------------

    def _extract_section(self, text: str, section_name: str) -> Optional[str]:
        """Extract a named markdown section from AI response text."""
        try:
            lines = text.split("\n")
            in_section = False
            section_lines: List[str] = []
            for line in lines:
                if section_name.lower() in line.lower() and ("#" in line):
                    in_section = True
                    continue
                if in_section:
                    if line.strip().startswith("#"):
                        break
                    if line.strip():
                        section_lines.append(line.strip())
            return "\n".join(section_lines) if section_lines else None
        except Exception:
            return None

    def _extract_list_items(self, text: str, section_name: str) -> List[str]:
        """Extract bullet-list items from a named markdown section."""
        try:
            section = self._extract_section(text, section_name)
            if not section:
                return []
            items = []
            for line in section.split("\n"):
                line = line.strip()
                if line.startswith("-") or line.startswith("*"):
                    item = line[1:].strip()
                    if item:
                        items.append(item)
            return items
        except Exception:
            return []

