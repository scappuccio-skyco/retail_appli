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


def _format_evaluation_period(start_date: str, end_date: str) -> str:
    """Formate une période pour l'affichage (dd/mm/yyyy - dd/mm/yyyy ou brut)."""
    try:
        start = datetime.strptime(start_date, "%Y-%m-%d")
        end = datetime.strptime(end_date, "%Y-%m-%d")
        return f"{start.strftime('%d/%m/%Y')} - {end.strftime('%d/%m/%Y')}"
    except ValueError:
        return f"{start_date} - {end_date}"


# Structure de stats vides (évite duplication dans get_employee_stats)
_EMPTY_EMPLOYEE_STATS = {
    "total_ca": 0,
    "avg_ca": 0,
    "total_ventes": 0,
    "avg_panier": 0,
    "avg_articles": 0,
    "avg_taux_transfo": 0,
    "days_worked": 0,
    "best_day_ca": 0,
    "worst_day_ca": 0,
    "no_data": True,
}


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
        return dict(_EMPTY_EMPLOYEE_STATS)
    
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
    period = _format_evaluation_period(request.start_date, request.end_date)
    
    disc_profile = await get_disc_profile(seller_service, request.employee_id)

    interview_notes = []
    if role_perspective == "seller":
        # Seller sees all their own notes
        notes = await seller_service.get_interview_notes_by_seller(request.employee_id)
    else:
        # Manager only sees notes the seller explicitly shared
        notes = await seller_service.get_shared_interview_notes_by_seller(request.employee_id)
    notes_in_period = [
        note for note in notes
        if request.start_date <= note.get("date", "") <= request.end_date
    ]
    interview_notes = notes_in_period[:50]

    # Fetch debriefs in period → debrief summary + competence evolution
    debrief_summary: Optional[str] = None
    competence_evolution: Optional[str] = None
    try:
        all_debriefs = await seller_service.get_debriefs_by_seller(
            request.employee_id,
            projection={"_id": 0, "date": 1, "vente_conclue": 1,
                        "ai_recommandation": 1,
                        "score_accueil": 1, "score_decouverte": 1,
                        "score_argumentation": 1, "score_closing": 1,
                        "score_fidelisation": 1},
            limit=200,
            sort=[("date", 1)],  # oldest first for evolution
        )
        period_debriefs = [
            d for d in all_debriefs
            if request.start_date <= (d.get("date") or "") <= request.end_date
        ]
        if period_debriefs:
            nb_total = len(period_debriefs)
            nb_success = sum(1 for d in period_debriefs if d.get("vente_conclue"))
            nb_miss = nb_total - nb_success
            # Collect up to 4 non-empty AI recommendations
            reco_seen: set = set()
            recos = []
            for d in reversed(period_debriefs):  # most recent first
                r = (d.get("ai_recommandation") or "").strip()
                if r and r not in reco_seen:
                    reco_seen.add(r)
                    recos.append(f'"{r}"')
                if len(recos) >= 4:
                    break
            reco_line = f"Recommandations récurrentes : {', '.join(recos)}" if recos else ""
            debrief_summary = (
                f"{nb_total} debriefs sur la période : "
                f"{nb_success} ventes conclues, {nb_miss} opportunités manquées.\n"
                + (reco_line or "")
            )

            # Competence evolution: first debrief scores vs last debrief scores
            _SCORE_KEYS = [
                ("score_accueil", "Accueil"),
                ("score_decouverte", "Découverte"),
                ("score_argumentation", "Argumentation"),
                ("score_closing", "Closing"),
                ("score_fidelisation", "Fidélisation"),
            ]
            first = period_debriefs[0]
            last = period_debriefs[-1]
            evo_lines = []
            for key, label in _SCORE_KEYS:
                s_first = first.get(key)
                s_last = last.get(key)
                if s_first is not None and s_last is not None:
                    delta = round(s_last - s_first, 1)
                    arrow = "↗" if delta > 0.05 else ("↘" if delta < -0.05 else "→")
                    evo_lines.append(
                        f"- {label} : {s_first:.1f} → {s_last:.1f} "
                        f"({'+'  if delta >= 0 else ''}{delta}) {arrow}"
                    )
            if evo_lines:
                competence_evolution = (
                    f"Évolution des compétences ({nb_total} debriefs) :\n"
                    + "\n".join(evo_lines)
                )
    except Exception as _e:
        logger.warning("Could not fetch debrief history for evaluation guide: %s", _e)

    # 7. Générer le guide IA avec le profil DISC, les notes et l'historique debriefs
    evaluation_service = EvaluationGuideService()
    guide_content = await evaluation_service.generate_evaluation_guide(
        role=role_perspective,
        stats=stats,
        employee_name=employee_name,
        period=period,
        comments=request.comments,
        disc_profile=disc_profile,
        interview_notes=interview_notes,
        debrief_summary=debrief_summary,
        competence_evolution=competence_evolution,
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
        "period": _format_evaluation_period(start_date, end_date),
        "stats": stats
    }
