"""
Evaluation Guide Routes (Entretien Annuel)
🎯 Génère des guides d'entretien IA adaptés au rôle (Manager vs Vendeur)
"""
import logging
from fastapi import APIRouter, Depends, Query
from typing import Dict, Optional
from datetime import datetime, timezone, timedelta
from pydantic import BaseModel

from core.exceptions import ValidationError, NotFoundError
from core.security import get_current_user, require_active_space, verify_evaluation_employee_access

logger = logging.getLogger(__name__)
from api.dependencies import get_seller_service, get_store_service
from services.ai_service import EvaluationGuideService
from services.seller_service import SellerService
from services.store_service import StoreService

router = APIRouter(
    prefix="/evaluations",
    tags=["Evaluation Guides"],
    dependencies=[Depends(require_active_space)]
)


# ===== PYDANTIC MODELS =====

class EvaluationGenerateRequest(BaseModel):
    """Requête pour générer un guide d'entretien"""
    employee_id: str
    start_date: str  # Format: YYYY-MM-DD
    end_date: str    # Format: YYYY-MM-DD
    comments: Optional[str] = None  # Commentaires/contexte du manager ou vendeur


class EvaluationGuideResponse(BaseModel):
    """Réponse avec le guide généré en JSON structuré"""
    employee_id: str
    employee_name: str
    period: str
    role_perspective: str  # "manager" ou "seller"
    guide_content: Dict    # JSON structuré avec synthese, victoires, axes_progres, objectifs
    stats_summary: Dict
    generated_at: str


# ===== HELPER FUNCTIONS =====

async def get_employee_stats(seller_service: SellerService, employee_id: str, start_date: str, end_date: str) -> Dict:
    """
    Récupère les statistiques agrégées d'un vendeur sur une période.
    Phase 0: Zero Repo in Route - seller_service.get_kpis_by_date_range.
    """
    try:
        start = datetime.strptime(start_date, "%Y-%m-%d")
        end = datetime.strptime(end_date, "%Y-%m-%d")
    except ValueError:
        raise ValidationError("Format de date invalide. Utilisez YYYY-MM-DD")
    
    kpis = await seller_service.get_kpis_by_date_range(
        employee_id,
        start.strftime("%Y-%m-%d"),
        end.strftime("%Y-%m-%d"),
    )
    
    if not kpis:
        return {
            "total_ca": 0,
            "avg_ca": 0,
            "total_ventes": 0,
            "avg_panier": 0,
            "avg_articles": 0,
            "avg_taux_transfo": 0,
            "days_worked": 0,
            "best_day_ca": 0,
            "worst_day_ca": 0,
            "no_data": True
        }
    
    # Calcul des agrégations - Support pour les deux formats de champs
    total_ca = sum(k.get('ca_journalier', 0) or k.get('ca', 0) or 0 for k in kpis)
    total_ventes = sum(k.get('nb_ventes', 0) or k.get('ventes', 0) or 0 for k in kpis)
    total_clients = sum(k.get('nb_visiteurs', 0) or k.get('clients', 0) or 0 for k in kpis)
    total_articles = sum(k.get('nb_articles_vendus', 0) or k.get('articles', 0) or 0 for k in kpis)
    days_worked = len([k for k in kpis if (k.get('ca_journalier') or k.get('ca') or 0) > 0])
    
    # Calcul des moyennes
    avg_ca = total_ca / days_worked if days_worked > 0 else 0
    avg_panier = total_ca / total_ventes if total_ventes > 0 else 0
    avg_articles = total_articles / total_ventes if total_ventes > 0 else 0
    avg_taux_transfo = (total_ventes / total_clients * 100) if total_clients > 0 else 0
    
    # Meilleur et pire jour
    cas = [k.get('ca_journalier', 0) or k.get('ca', 0) or 0 for k in kpis]
    cas_non_zero = [c for c in cas if c > 0]
    best_day_ca = max(cas_non_zero) if cas_non_zero else 0
    worst_day_ca = min(cas_non_zero) if cas_non_zero else 0
    
    return {
        "total_ca": round(total_ca, 2),
        "avg_ca": round(avg_ca, 2),
        "total_ventes": total_ventes,
        "avg_panier": round(avg_panier, 2),
        "avg_articles": round(avg_articles, 2),
        "avg_taux_transfo": round(avg_taux_transfo, 1),
        "days_worked": days_worked,
        "best_day_ca": round(best_day_ca, 2),
        "worst_day_ca": round(worst_day_ca, 2),
        "period_days": (end - start).days + 1,
        "no_data": False
    }


async def get_disc_profile(seller_service: SellerService, user_id: str) -> Optional[Dict]:
    """
    Récupère le profil DISC pour le guide d'entretien. Phase 0: Zero Repo - seller_service.get_disc_profile_for_evaluation.
    """
    try:
        return await seller_service.get_disc_profile_for_evaluation(user_id)
    except Exception as e:
        logger.warning("Erreur récupération profil DISC pour user_id=%s: %s", user_id, e, exc_info=True)
        return None


# ===== ROUTES =====

@router.post("/generate", response_model=EvaluationGuideResponse)
async def generate_evaluation_guide(
    request: EvaluationGenerateRequest,
    current_user: Dict = Depends(get_current_user),
    seller_service: SellerService = Depends(get_seller_service),
    store_service: StoreService = Depends(get_store_service),
):
    """
    🎯 Génère un guide d'entretien IA personnalisé. Phase 0 Vague 2: services only (no db).
    """
    employee = await verify_evaluation_employee_access(
        current_user, request.employee_id,
        seller_service=seller_service, store_service=store_service,
    )
    employee_name = employee.get('name', 'Vendeur')
    
    stats = await get_employee_stats(
        seller_service,
        request.employee_id,
        request.start_date,
        request.end_date,
    )
    
    if stats.get('no_data'):
        raise NotFoundError(f"Aucune donnée KPI trouvée pour {employee_name} sur cette période")
    
    # 3. Déterminer le rôle pour la perspective du guide
    caller_role = current_user.get('role')
    role_perspective = 'manager' if caller_role in ['manager', 'gerant'] else 'seller'
    
    # 4. Formater la période
    try:
        start = datetime.strptime(request.start_date, "%Y-%m-%d")
        end = datetime.strptime(request.end_date, "%Y-%m-%d")
        period = f"{start.strftime('%d/%m/%Y')} - {end.strftime('%d/%m/%Y')}"
    except ValueError:
        period = f"{request.start_date} - {request.end_date}"
    
    disc_profile = await get_disc_profile(seller_service, request.employee_id)
    
    interview_notes = []
    if role_perspective == "seller":
        notes = await seller_service.get_interview_notes_by_seller(request.employee_id)
        notes_in_period = [
            note for note in notes
            if request.start_date <= note.get("date", "") <= request.end_date
        ]
        interview_notes = notes_in_period[:50]
    
    # 7. Générer le guide IA avec le profil DISC et les notes
    evaluation_service = EvaluationGuideService()
    guide_content = await evaluation_service.generate_evaluation_guide(
        role=role_perspective,
        stats=stats,
        employee_name=employee_name,
        period=period,
        comments=request.comments,
        disc_profile=disc_profile,
        interview_notes=interview_notes  # ✅ Ajout des notes
    )
    
    return EvaluationGuideResponse(
        employee_id=request.employee_id,
        employee_name=employee_name,
        period=period,
        role_perspective=role_perspective,
        guide_content=guide_content,
        stats_summary=stats,
        generated_at=datetime.now(timezone.utc).isoformat()
    )


@router.get("/stats/{employee_id}")
async def get_evaluation_stats(
    employee_id: str,
    start_date: str = Query(..., description="Date de début (YYYY-MM-DD)"),
    end_date: str = Query(..., description="Date de fin (YYYY-MM-DD)"),
    current_user: Dict = Depends(get_current_user),
    seller_service: SellerService = Depends(get_seller_service),
    store_service: StoreService = Depends(get_store_service),
):
    """
    📊 Récupère les statistiques d'un vendeur sur une période. Phase 0 Vague 2: services only (no db).
    """
    employee = await verify_evaluation_employee_access(
        current_user, employee_id,
        seller_service=seller_service, store_service=store_service,
    )
    stats = await get_employee_stats(seller_service, employee_id, start_date, end_date)
    
    return {
        "employee_id": employee_id,
        "employee_name": employee.get('name', 'Vendeur'),
        "period": f"{start_date} - {end_date}",
        "stats": stats
    }
