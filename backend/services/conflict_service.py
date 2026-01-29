"""
Conflict Resolution Service
All dependencies injected via __init__ (no self.db).
"""
from typing import Dict, List, Optional
from datetime import datetime, timezone
from uuid import uuid4
import json
import logging

from repositories.user_repository import UserRepository
from repositories.manager_diagnostic_results_repository import ManagerDiagnosticResultsRepository
from repositories.diagnostic_repository import DiagnosticRepository
from repositories.conflict_consultation_repository import ConflictConsultationRepository
from services.ai_service import AIService

logger = logging.getLogger(__name__)


class ConflictService:
    """Service for conflict resolution advice. All repos and ai_service injected via __init__."""

    def __init__(
        self,
        user_repo: UserRepository,
        manager_diagnostic_results_repo: ManagerDiagnosticResultsRepository,
        diagnostic_repo: DiagnosticRepository,
        conflict_consultation_repo: ConflictConsultationRepository,
        ai_service: AIService,
    ):
        self.user_repo = user_repo
        self.manager_diagnostic_results_repo = manager_diagnostic_results_repo
        self.diagnostic_repo = diagnostic_repo
        self.conflict_consultation_repo = conflict_consultation_repo
        self.ai_service = ai_service
    
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
        is_seller_request: bool = False
    ) -> Dict:
        """
        Generate AI-powered conflict resolution advice.
        
        Args:
            seller_id: ID of the seller
            contexte: General context of the situation
            comportement_observe: Specific behavior observed
            impact: Impact on team/performance/clients
            tentatives_precedentes: What has already been tried
            description_libre: Additional details
            manager_id: Manager ID (for manager requests)
            manager_name: Manager name (for manager requests)
            store_id: Store ID
            is_seller_request: True if request comes from seller
        
        Returns:
            Dict with AI analysis and recommendations
        """
        try:
            # Get seller info
            seller_query = {"id": seller_id}
            if store_id:
                seller_query["store_id"] = store_id
            
            seller = await self.user_repo.find_one(
                seller_query,
                {"_id": 0, "password": 0}
            )
            if not seller:
                raise ValueError("Vendeur non trouvé")
            
            # For seller requests, get their manager
            if is_seller_request:
                manager_id = seller.get('manager_id')
                if not manager_id:
                    raise ValueError("Vendeur sans manager associé")
            
            # Get profiles
            manager_diagnostic = None
            if manager_id:
                manager_diagnostic = await self.manager_diagnostic_results_repo.find_by_manager(manager_id)
            
            seller_diagnostic = await self.diagnostic_repo.find_by_seller(seller_id)
            
            # Build AI prompt
            if is_seller_request:
                system_message = """Tu es un coach retail spécialisé en résolution de conflits.
Tu aides un vendeur à gérer un conflit avec son manager ou son équipe.
Fournis une analyse claire et des actions concrètes pour résoudre la situation."""
                
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
                system_message = """Tu es un expert en résolution de conflits en équipe retail.
Tu aides un manager à gérer un conflit avec un vendeur.
Fournis une analyse claire et des actions concrètes."""
                
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
            
            # Check AI service availability
            if not self.ai_service.available:
                logger.warning(
                    "Conflict resolution failed: AI service unavailable",
                    extra={"store_id": store_id, "seller_id": seller_id}
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
                    "Conflict resolution failed: AI call error",
                    extra={
                        "store_id": store_id,
                        "seller_id": seller_id,
                        "error": str(ai_error)
                    }
                )
                raise ValueError(f"Erreur lors de la génération: {str(ai_error)}")
            
            if not ai_response:
                logger.warning(
                    "Conflict resolution failed: Empty AI response",
                    extra={"store_id": store_id, "seller_id": seller_id}
                )
                raise ValueError("Erreur lors de la génération: réponse vide")
            
            # Parse AI response into structured format
            # Try to extract sections from markdown format
            analysis = self._extract_section(ai_response, "Analyse de la situation")
            communication = self._extract_section(ai_response, "Approche de communication")
            actions = self._extract_list_items(ai_response, "Actions concrètes")
            vigilance = self._extract_list_items(ai_response, "Points de vigilance")
            
            return {
                "ai_analyse_situation": analysis or ai_response[:500],  # Fallback to first 500 chars
                "ai_approche_communication": communication or "",
                "ai_actions_concretes": actions or [],
                "ai_points_vigilance": vigilance or [],
                "seller_name": f"{seller.get('first_name', '')} {seller.get('last_name', '')}".strip() or seller.get('name', 'Vendeur')
            }
            
        except ValueError:
            raise
        except Exception as e:
            logger.exception(
                "Conflict resolution generation failed",
                extra={
                    "seller_id": seller_id,
                    "error": str(e)
                }
            )
            raise ValueError(f"Erreur lors de la génération: {str(e)}")
    
    def _extract_section(self, text: str, section_name: str) -> Optional[str]:
        """Extract a section from markdown text"""
        try:
            lines = text.split('\n')
            in_section = False
            section_lines = []
            
            for line in lines:
                if section_name.lower() in line.lower() and ('##' in line or '#' in line):
                    in_section = True
                    continue
                elif in_section:
                    if line.strip().startswith('##') or line.strip().startswith('#'):
                        break
                    if line.strip():
                        section_lines.append(line.strip())
            
            return '\n'.join(section_lines) if section_lines else None
        except:
            return None
    
    def _extract_list_items(self, text: str, section_name: str) -> List[str]:
        """Extract list items from a section"""
        try:
            section = self._extract_section(text, section_name)
            if not section:
                return []
            
            items = []
            for line in section.split('\n'):
                line = line.strip()
                if line.startswith('-') or line.startswith('*'):
                    item = line[1:].strip()
                    if item:
                        items.append(item)
            
            return items if items else []
        except:
            return []
    
    async def save_conflict(
        self,
        conflict_data: Dict
    ) -> str:
        """
        Save a conflict resolution to history.
        
        Args:
            conflict_data: Dict with conflict fields
        
        Returns:
            conflict_id
        """
        try:
            conflict_id = str(uuid4())
            conflict = {
                "id": conflict_id,
                **conflict_data,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
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
        limit: int = 100
    ) -> List[Dict]:
        """
        List conflict consultations with filters.
        
        Args:
            manager_id: Filter by manager ID
            seller_id: Filter by seller ID
            store_id: Filter by store ID
            limit: Maximum number of results
        
        Returns:
            List of conflicts
        """
        try:
            query = {}
            if manager_id:
                query["manager_id"] = manager_id
            if seller_id:
                query["seller_id"] = seller_id
            if store_id:
                query["store_id"] = store_id
            
            conflicts = await self.conflict_consultation_repo.find_many_by_filters(query, limit=limit)
            return conflicts
            
        except Exception as e:
            logger.error(f"Error listing conflicts: {e}", exc_info=True)
            raise ValueError(f"Erreur lors de la récupération: {str(e)}")

