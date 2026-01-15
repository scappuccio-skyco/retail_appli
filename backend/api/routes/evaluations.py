"""
Evaluation Guide Routes (Entretien Annuel)
🎯 Génère des guides d'entretien IA adaptés au rôle (Manager vs Vendeur)
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Dict, Optional
from datetime import datetime, timezone, timedelta
from pydantic import BaseModel

from core.security import get_current_user, require_active_space
from api.dependencies import get_db
from services.ai_service import EvaluationGuideService

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

async def get_employee_stats(db, employee_id: str, start_date: str, end_date: str) -> Dict:
    """
    Récupère les statistiques agrégées d'un vendeur sur une période.
    """
    try:
        start = datetime.strptime(start_date, "%Y-%m-%d")
        end = datetime.strptime(end_date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="Format de date invalide. Utilisez YYYY-MM-DD")
    
    # Récupérer les KPIs du vendeur sur la période
    kpis = await db.kpi_entries.find({
        "seller_id": employee_id,
        "date": {
            "$gte": start.strftime("%Y-%m-%d"),
            "$lte": end.strftime("%Y-%m-%d")
        }
    }, {"_id": 0}).to_list(1000)
    
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


async def verify_access(db, current_user: Dict, employee_id: str) -> Dict:
    """
    Vérifie que l'utilisateur a le droit de générer l'évaluation.
    Retourne les infos de l'employé si autorisé.
    """
    role = current_user.get('role')
    user_id = current_user.get('id')
    
    # Cas 1: Vendeur génère son propre bilan
    if role == 'seller':
        if user_id != employee_id:
            raise HTTPException(
                status_code=403, 
                detail="Un vendeur ne peut générer que son propre bilan"
            )
        return current_user
    
    # Cas 2: Manager/Gérant génère pour un de ses vendeurs
    if role in ['manager', 'gerant']:
        # Récupérer l'employé
        employee = await db.users.find_one(
            {"id": employee_id, "role": "seller"},
            {"_id": 0}
        )
        
        if not employee:
            raise HTTPException(status_code=404, detail="Vendeur non trouvé")
        
        # Vérifier que le vendeur appartient au même magasin (pour manager)
        if role == 'manager':
            if employee.get('store_id') != current_user.get('store_id'):
                raise HTTPException(
                    status_code=403,
                    detail="Ce vendeur n'appartient pas à votre magasin"
                )
        
        # Pour gérant: vérifier que le magasin lui appartient
        if role == 'gerant':
            store = await db.stores.find_one(
                {"id": employee.get('store_id'), "gerant_id": user_id},
                {"_id": 0}
            )
            if not store:
                raise HTTPException(
                    status_code=403,
                    detail="Ce vendeur n'appartient pas à l'un de vos magasins"
                )
        
        return employee
    
    raise HTTPException(status_code=403, detail="Rôle non autorisé")


async def get_disc_profile(db, user_id: str) -> Optional[Dict]:
    """
    🎨 Récupère le profil DISC d'un utilisateur depuis la base de données.
    
    Args:
        db: Database connection
        user_id: ID de l'utilisateur
        
    Returns:
        Dict avec style, level, strengths, axes_de_developpement ou None
    """
    try:
        # Chercher dans la collection 'diagnostics' ou dans le profil utilisateur
        diagnostic = await db.diagnostics.find_one(
            {"seller_id": user_id},
            {"_id": 0, "style": 1, "level": 1, "strengths": 1, "weaknesses": 1, "axes_de_developpement": 1}
        )
        
        if diagnostic:
            # Migration: convertir weaknesses en axes_de_developpement si nécessaire
            if 'weaknesses' in diagnostic and 'axes_de_developpement' not in diagnostic:
                diagnostic['axes_de_developpement'] = diagnostic.pop('weaknesses')
            return diagnostic
        
        # Fallback: chercher dans le profil utilisateur
        user = await db.users.find_one(
            {"id": user_id},
            {"_id": 0, "disc_profile": 1}
        )
        
        if user and user.get('disc_profile'):
            return user['disc_profile']
        
        return None
        
    except Exception as e:
        # Log l'erreur mais ne bloque pas la génération
        print(f"⚠️ Erreur récupération profil DISC pour {user_id}: {e}")
        return None


# ===== ROUTES =====

@router.post("/generate", response_model=EvaluationGuideResponse)
async def generate_evaluation_guide(
    request: EvaluationGenerateRequest,
    current_user: Dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """
    🎯 Génère un guide d'entretien IA personnalisé.
    
    - **Manager/Gérant** : Reçoit une grille d'évaluation et questions clés
    - **Vendeur** : Reçoit une fiche d'auto-bilan et arguments
    
    Le guide est basé sur les données réelles de performance du vendeur.
    """
    # 1. Vérifier les droits d'accès
    employee = await verify_access(db, current_user, request.employee_id)
    employee_name = employee.get('name', 'Vendeur')
    
    # 2. Récupérer les statistiques sur la période
    stats = await get_employee_stats(
        db, 
        request.employee_id, 
        request.start_date, 
        request.end_date
    )
    
    if stats.get('no_data'):
        raise HTTPException(
            status_code=404,
            detail=f"Aucune donnée KPI trouvée pour {employee_name} sur cette période"
        )
    
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
    
    # 5. 🎨 Récupérer le profil DISC de l'employé pour personnalisation
    disc_profile = await get_disc_profile(db, request.employee_id)
    
    # 6. Générer le guide IA avec le profil DISC
    evaluation_service = EvaluationGuideService()
    guide_content = await evaluation_service.generate_evaluation_guide(
        role=role_perspective,
        stats=stats,
        employee_name=employee_name,
        period=period,
        comments=request.comments,
        disc_profile=disc_profile
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
    db = Depends(get_db)
):
    """
    📊 Récupère les statistiques d'un vendeur sur une période donnée.
    Utile pour prévisualiser les données avant de générer le guide.
    """
    # Vérifier les droits d'accès
    employee = await verify_access(db, current_user, employee_id)
    
    # Récupérer les stats
    stats = await get_employee_stats(db, employee_id, start_date, end_date)
    
    return {
        "employee_id": employee_id,
        "employee_name": employee.get('name', 'Vendeur'),
        "period": f"{start_date} - {end_date}",
        "stats": stats
    }
