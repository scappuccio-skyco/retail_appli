"""
Seller Routes
API endpoints for seller-specific features (tasks, objectives, challenges)
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Dict, List, Optional
from datetime import datetime, timezone, timedelta

from services.seller_service import SellerService
from api.dependencies import get_seller_service, get_db
from core.security import get_current_seller, get_current_user

router = APIRouter(prefix="/seller", tags=["Seller"])


# ===== SUBSCRIPTION ACCESS CHECK =====

@router.get("/subscription-status")
async def get_seller_subscription_status(
    current_user: Dict = Depends(get_current_seller),
    db = Depends(get_db)
):
    """
    Check if the seller's gérant has an active subscription.
    Returns isReadOnly: true if trial expired.
    """
    try:
        gerant_id = current_user.get('gerant_id')
        
        if not gerant_id:
            return {"isReadOnly": True, "status": "no_gerant", "message": "Aucun gérant associé"}
        
        # Get gérant info
        gerant = await db.users.find_one({"id": gerant_id}, {"_id": 0})
        
        if not gerant:
            return {"isReadOnly": True, "status": "gerant_not_found", "message": "Gérant non trouvé"}
        
        workspace_id = gerant.get('workspace_id')
        
        if not workspace_id:
            return {"isReadOnly": True, "status": "no_workspace", "message": "Aucun espace de travail"}
        
        workspace = await db.workspaces.find_one({"id": workspace_id}, {"_id": 0})
        
        if not workspace:
            return {"isReadOnly": True, "status": "workspace_not_found", "message": "Espace de travail non trouvé"}
        
        subscription_status = workspace.get('subscription_status', 'inactive')
        
        # Active subscription
        if subscription_status == 'active':
            return {"isReadOnly": False, "status": "active", "message": "Abonnement actif"}
        
        # In trial period
        if subscription_status == 'trialing':
            trial_end = workspace.get('trial_end')
            if trial_end:
                if isinstance(trial_end, str):
                    trial_end_dt = datetime.fromisoformat(trial_end.replace('Z', '+00:00'))
                else:
                    trial_end_dt = trial_end
                
                # Gérer les dates naive vs aware
                now = datetime.now(timezone.utc)
                if trial_end_dt.tzinfo is None:
                    trial_end_dt = trial_end_dt.replace(tzinfo=timezone.utc)
                
                if now < trial_end_dt:
                    days_left = (trial_end_dt - now).days
                    return {"isReadOnly": False, "status": "trialing", "message": f"Essai gratuit - {days_left} jours restants", "daysLeft": days_left}
        
        # Trial expired or inactive
        return {"isReadOnly": True, "status": "trial_expired", "message": "Période d'essai terminée. Contactez votre administrateur."}
        
    except Exception as e:
        return {"isReadOnly": True, "status": "error", "message": str(e)}


# ===== KPI ENABLED CHECK =====

@router.get("/kpi-enabled")
async def check_kpi_enabled(
    store_id: str = Query(None),
    current_user: Dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """
    Check if KPI input is enabled for seller
    Used to determine if sellers can input their own KPIs or if manager does it
    """
    # Allow sellers, managers, and gérants to check KPI status
    if current_user['role'] not in ['seller', 'manager', 'gerant', 'gérant']:
        raise HTTPException(status_code=403, detail="Access denied")
    
    SELLER_INPUT_KPIS = ['ca_journalier', 'nb_ventes', 'nb_clients', 'nb_articles', 'nb_prospects']
    
    # Determine manager_id or store_id to check
    manager_id = None
    effective_store_id = store_id
    
    if current_user['role'] == 'seller':
        manager_id = current_user.get('manager_id')
        if not manager_id:
            return {"enabled": False, "seller_input_kpis": SELLER_INPUT_KPIS}
    elif store_id and current_user['role'] in ['gerant', 'gérant']:
        effective_store_id = store_id
    elif current_user.get('store_id'):
        effective_store_id = current_user['store_id']
    elif current_user['role'] == 'manager':
        manager_id = current_user['id']
    
    # Find config by store_id or manager_id
    config = None
    if effective_store_id:
        config = await db.kpi_configs.find_one({"store_id": effective_store_id}, {"_id": 0})
    if not config and manager_id:
        config = await db.kpi_configs.find_one({"manager_id": manager_id}, {"_id": 0})
    
    if not config:
        return {"enabled": False, "seller_input_kpis": SELLER_INPUT_KPIS}
    
    return {
        "enabled": config.get('enabled', True),
        "seller_input_kpis": SELLER_INPUT_KPIS
    }


# ===== TASKS =====

@router.get("/tasks")
async def get_seller_tasks(
    current_user: Dict = Depends(get_current_seller),
    seller_service: SellerService = Depends(get_seller_service)
) -> List[Dict]:
    """
    Get all pending tasks for current seller
    - Diagnostic completion status
    - Pending manager requests
    """
    try:
        tasks = await seller_service.get_seller_tasks(current_user['id'])
        return tasks
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch tasks: {str(e)}")


# ===== OBJECTIVES =====

@router.get("/objectives/active")
async def get_active_seller_objectives(
    current_user: Dict = Depends(get_current_seller),
    seller_service: SellerService = Depends(get_seller_service)
) -> List[Dict]:
    """
    Get active team objectives for display in seller dashboard
    Returns only objectives that are:
    - Within the current period (period_end >= today)
    - Visible to this seller (individual or collective with visibility rules)
    """
    try:
        # Get seller's manager
        user = await seller_service.db.users.find_one({"id": current_user['id']}, {"_id": 0})
        
        if not user or not user.get('manager_id'):
            return []
        
        # Fetch objectives
        objectives = await seller_service.get_seller_objectives_active(
            current_user['id'], 
            user['manager_id']
        )
        return objectives
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch objectives: {str(e)}")


@router.get("/objectives/all")
async def get_all_seller_objectives(
    current_user: Dict = Depends(get_current_seller),
    seller_service: SellerService = Depends(get_seller_service)
) -> Dict:
    """
    Get all team objectives (active and inactive) for seller
    Returns objectives separated into:
    - active: objectives with period_end > today
    - inactive: objectives with period_end <= today
    """
    try:
        # Get seller's manager
        user = await seller_service.db.users.find_one({"id": current_user['id']}, {"_id": 0})
        
        if not user or not user.get('manager_id'):
            return {"active": [], "inactive": []}
        
        # Fetch all objectives
        result = await seller_service.get_seller_objectives_all(
            current_user['id'], 
            user['manager_id']
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch objectives: {str(e)}")


@router.get("/objectives/history")
async def get_seller_objectives_history(
    current_user: Dict = Depends(get_current_seller),
    seller_service: SellerService = Depends(get_seller_service)
) -> List[Dict]:
    """
    Get completed objectives (past period_end date) for seller
    Returns objectives that have ended (period_end < today)
    """
    try:
        # Get seller's manager
        user = await seller_service.db.users.find_one({"id": current_user['id']}, {"_id": 0})
        
        if not user or not user.get('manager_id'):
            return []
        
        # Fetch history
        objectives = await seller_service.get_seller_objectives_history(
            current_user['id'], 
            user['manager_id']
        )
        return objectives
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch objectives history: {str(e)}")


# ===== CHALLENGES =====

@router.get("/challenges")
async def get_seller_challenges(
    current_user: Dict = Depends(get_current_seller),
    seller_service: SellerService = Depends(get_seller_service)
) -> List[Dict]:
    """
    Get all challenges (collective + individual) for seller
    Returns all challenges from seller's manager
    """
    try:
        # Get seller's manager
        user = await seller_service.db.users.find_one({"id": current_user['id']}, {"_id": 0})
        
        if not user or not user.get('manager_id'):
            return []
        
        # Fetch challenges
        challenges = await seller_service.get_seller_challenges(
            current_user['id'], 
            user['manager_id']
        )
        return challenges
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch challenges: {str(e)}")


@router.get("/challenges/active")
async def get_active_seller_challenges(
    current_user: Dict = Depends(get_current_seller),
    seller_service: SellerService = Depends(get_seller_service)
) -> List[Dict]:
    """
    Get only active challenges (collective + personal) for display in seller dashboard
    Returns challenges that are:
    - Active status
    - Not yet ended (end_date >= today)
    - Visible to this seller
    """
    try:
        # Get seller's manager
        user = await seller_service.db.users.find_one({"id": current_user['id']}, {"_id": 0})
        
        if not user or not user.get('manager_id'):
            return []
        
        # Fetch active challenges
        challenges = await seller_service.get_seller_challenges_active(
            current_user['id'], 
            user['manager_id']
        )
        return challenges
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch active challenges: {str(e)}")


@router.get("/challenges/history")
async def get_seller_challenges_history(
    current_user: Dict = Depends(get_current_seller),
    seller_service: SellerService = Depends(get_seller_service)
) -> List[Dict]:
    """
    Get completed challenges (past end_date) for seller
    Returns challenges that have ended (end_date < today)
    """
    try:
        # Get seller's manager
        user = await seller_service.db.users.find_one({"id": current_user['id']}, {"_id": 0})
        
        if not user or not user.get('manager_id'):
            return []
        
        # Fetch history
        challenges = await seller_service.get_seller_challenges_history(
            current_user['id'], 
            user['manager_id']
        )
        return challenges
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch challenges history: {str(e)}")



# ===== CALENDAR DATA =====

@router.get("/dates-with-data")
async def get_seller_dates_with_data(
    year: int = Query(None),
    month: int = Query(None),
    current_user: Dict = Depends(get_current_seller),
    db = Depends(get_db)
):
    """
    Get list of dates that have KPI data for the seller
    Used for calendar highlighting
    
    Returns:
        - dates: list of dates with any KPI data
        - lockedDates: list of dates with locked/validated KPI entries (from API/POS)
    """
    seller_id = current_user['id']
    
    # Build date filter
    query = {"seller_id": seller_id}
    if year and month:
        start_date = f"{year}-{month:02d}-01"
        if month == 12:
            end_date = f"{year + 1}-01-01"
        else:
            end_date = f"{year}-{month + 1:02d}-01"
        query["date"] = {"$gte": start_date, "$lt": end_date}
    
    # Get distinct dates with data
    dates = await db.kpi_entries.distinct("date", query)
    
    all_dates = sorted(set(dates))
    
    # Get locked dates (from API/POS imports - cannot be edited manually)
    locked_query = {**query, "locked": True}
    locked_dates = await db.kpi_entries.distinct("date", locked_query)
    
    return {
        "dates": all_dates,
        "lockedDates": sorted(locked_dates)
    }



# ===== KPI CONFIG FOR SELLER =====
# 🏺 LEGACY RESTORED

@router.get("/kpi-config")
async def get_seller_kpi_config(
    current_user: Dict = Depends(get_current_seller),
    db = Depends(get_db)
):
    """
    Get KPI configuration that applies to this seller.
    Returns which KPIs the seller should track (based on manager's config).
    """
    try:
        # Get seller's store_id
        user = await db.users.find_one({"id": current_user['id']}, {"_id": 0})
        
        if not user or not user.get('store_id'):
            # No store, return default config (all enabled)
            return {
                "track_ca": True,
                "track_ventes": True,
                "track_clients": True,
                "track_articles": True,
                "track_prospects": True
            }
        
        # Find the manager of this store
        manager = await db.users.find_one({
            "store_id": user['store_id'],
            "role": "manager"
        }, {"_id": 0, "id": 1})
        
        if not manager:
            # No manager found, return default
            return {
                "track_ca": True,
                "track_ventes": True,
                "track_clients": True,
                "track_articles": True,
                "track_prospects": True
            }
        
        # Get manager's KPI config
        config = await db.kpi_configs.find_one({"manager_id": manager['id']}, {"_id": 0})
        
        if not config:
            # No config found, return default
            return {
                "track_ca": True,
                "track_ventes": True,
                "track_clients": True,
                "track_articles": True,
                "track_prospects": True
            }
        
        return {
            "track_ca": config.get('seller_track_ca', config.get('track_ca', True)),
            "track_ventes": config.get('seller_track_ventes', config.get('track_ventes', True)),
            "track_clients": config.get('seller_track_clients', config.get('track_clients', True)),
            "track_articles": config.get('seller_track_articles', config.get('track_articles', True)),
            "track_prospects": config.get('seller_track_prospects', config.get('track_prospects', True))
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching KPI config: {str(e)}")


# ===== KPI ENTRIES FOR SELLER =====

@router.get("/kpi-entries")
async def get_my_kpi_entries(
    days: int = Query(None, description="Number of days to fetch"),
    current_user: Dict = Depends(get_current_seller),
    db = Depends(get_db)
):
    """
    Get seller's KPI entries.
    Returns KPI data for the seller.
    """
    try:
        seller_id = current_user['id']
        
        if days:
            entries = await db.kpi_entries.find(
                {"seller_id": seller_id},
                {"_id": 0}
            ).sort("date", -1).limit(days).to_list(days)
        else:
            entries = await db.kpi_entries.find(
                {"seller_id": seller_id},
                {"_id": 0}
            ).sort("date", -1).limit(365).to_list(365)
        
        return entries
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching KPI entries: {str(e)}")


# ===== DAILY CHALLENGE FOR SELLER =====

@router.get("/daily-challenge")
async def get_daily_challenge(
    force_competence: str = Query(None, description="Force a specific competence"),
    current_user: Dict = Depends(get_current_seller),
    db = Depends(get_db)
):
    """
    Get or generate daily challenge for seller.
    Returns an uncompleted challenge for today, or generates a new one.
    """
    from uuid import uuid4
    
    try:
        seller_id = current_user['id']
        today = datetime.now(timezone.utc).strftime('%Y-%m-%d')
        
        # Check if there's an uncompleted challenge for today
        existing = await db.daily_challenges.find_one({
            "seller_id": seller_id,
            "date": today,
            "completed": False
        }, {"_id": 0})
        
        if existing:
            return existing
        
        # Generate new challenge
        # Get seller's diagnostic for personalization
        diagnostic = await db.diagnostics.find_one({
            "seller_id": seller_id
        }, {"_id": 0})
        
        # Get recent challenges to avoid repetition
        recent = await db.daily_challenges.find(
            {"seller_id": seller_id},
            {"_id": 0}
        ).sort("date", -1).limit(5).to_list(5)
        
        recent_competences = [ch.get('competence') for ch in recent if ch.get('competence')]
        
        # Select competence
        if force_competence and force_competence in ['accueil', 'decouverte', 'argumentation', 'closing', 'fidelisation']:
            selected_competence = force_competence
        elif not diagnostic:
            competences = ['accueil', 'decouverte', 'argumentation', 'closing', 'fidelisation']
            selected_competence = competences[datetime.now().day % len(competences)]
        else:
            # Find weakest competence not recently used
            scores = {
                'accueil': diagnostic.get('score_accueil', 3),
                'decouverte': diagnostic.get('score_decouverte', 3),
                'argumentation': diagnostic.get('score_argumentation', 3),
                'closing': diagnostic.get('score_closing', 3),
                'fidelisation': diagnostic.get('score_fidelisation', 3)
            }
            sorted_comps = sorted(scores.items(), key=lambda x: x[1])
            
            selected_competence = None
            for comp, score in sorted_comps:
                if comp not in recent_competences[:2]:
                    selected_competence = comp
                    break
            
            if not selected_competence:
                selected_competence = sorted_comps[0][0]
        
        # Challenge templates by competence
        templates = {
            'accueil': {
                'title': 'Accueil Excellence',
                'description': 'Accueillez chaque client avec un sourire et une phrase personnalisée dans les 10 premières secondes.'
            },
            'decouverte': {
                'title': 'Questions Magiques',
                'description': 'Posez au moins 3 questions ouvertes à chaque client pour comprendre ses besoins.'
            },
            'argumentation': {
                'title': 'Argumentaire Pro',
                'description': 'Utilisez la technique CAB (Caractéristique-Avantage-Bénéfice) pour chaque produit présenté.'
            },
            'closing': {
                'title': 'Closing Master',
                'description': 'Proposez la conclusion de la vente avec une question fermée positive.'
            },
            'fidelisation': {
                'title': 'Client Fidèle',
                'description': 'Remerciez chaque client et proposez un contact ou suivi personnalisé.'
            }
        }
        
        template = templates.get(selected_competence, templates['accueil'])
        
        challenge = {
            "id": str(uuid4()),
            "seller_id": seller_id,
            "date": today,
            "competence": selected_competence,
            "title": template['title'],
            "description": template['description'],
            "completed": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.daily_challenges.insert_one(challenge)
        if '_id' in challenge:
            del challenge['_id']
        
        return challenge
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching daily challenge: {str(e)}")


@router.post("/daily-challenge/complete")
async def complete_daily_challenge(
    data: dict,
    current_user: Dict = Depends(get_current_seller),
    db = Depends(get_db)
):
    """Mark a daily challenge as completed."""
    try:
        challenge_id = data.get('challenge_id')
        result = data.get('result', 'success')  # success, partial, failed
        feedback = data.get('feedback', '')
        
        update_result = await db.daily_challenges.update_one(
            {"id": challenge_id, "seller_id": current_user['id']},
            {"$set": {
                "completed": True,
                "challenge_result": result,
                "feedback_comment": feedback,
                "completed_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        if update_result.modified_count == 0:
            raise HTTPException(status_code=404, detail="Challenge not found")
        
        return {"success": True, "message": "Challenge complété !"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ===== DIAGNOSTIC FOR SELLER =====

@router.get("/diagnostic/me")
async def get_my_diagnostic(
    current_user: Dict = Depends(get_current_seller),
    db = Depends(get_db)
):
    """Get seller's own DISC diagnostic profile."""
    try:
        diagnostic = await db.diagnostics.find_one(
            {"seller_id": current_user['id']},
            {"_id": 0}
        )
        
        if not diagnostic:
            raise HTTPException(status_code=404, detail="Diagnostic non trouvé")
        
        return diagnostic
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ===== KPI ENTRY (Create/Update) =====

@router.post("/kpi-entry")
async def save_kpi_entry(
    kpi_data: dict,
    current_user: Dict = Depends(get_current_seller),
    db = Depends(get_db)
):
    """
    Create or update a KPI entry for the seller.
    This is the main endpoint used by sellers to record their daily KPIs.
    """
    from uuid import uuid4
    
    try:
        seller_id = current_user['id']
        date = kpi_data.get('date', datetime.now(timezone.utc).strftime('%Y-%m-%d'))
        
        # Get seller info for store_id and manager_id
        seller = await db.users.find_one({"id": seller_id}, {"_id": 0})
        if not seller:
            raise HTTPException(status_code=404, detail="Seller not found")
        
        # Check if entry exists for this date
        existing = await db.kpi_entries.find_one({
            "seller_id": seller_id,
            "date": date
        })
        
        entry_data = {
            "seller_id": seller_id,
            "seller_name": seller.get('name', current_user.get('name', 'Vendeur')),
            "manager_id": seller.get('manager_id'),
            "store_id": seller.get('store_id'),
            "date": date,
            "seller_ca": kpi_data.get('seller_ca') or kpi_data.get('ca_journalier') or 0,
            "ca_journalier": kpi_data.get('ca_journalier') or kpi_data.get('seller_ca') or 0,
            "nb_ventes": kpi_data.get('nb_ventes') or 0,
            "nb_clients": kpi_data.get('nb_clients') or 0,
            "nb_articles": kpi_data.get('nb_articles') or 0,
            "nb_prospects": kpi_data.get('nb_prospects') or 0,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        if existing:
            # Update existing entry
            await db.kpi_entries.update_one(
                {"_id": existing['_id']},
                {"$set": entry_data}
            )
            entry_data['id'] = existing.get('id', str(existing['_id']))
        else:
            # Create new entry
            entry_data['id'] = str(uuid4())
            entry_data['created_at'] = datetime.now(timezone.utc).isoformat()
            await db.kpi_entries.insert_one(entry_data)
        
        if '_id' in entry_data:
            del entry_data['_id']
        
        return entry_data
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error saving KPI entry: {str(e)}")


# ===== DAILY CHALLENGE STATS =====

@router.get("/daily-challenge/stats")
async def get_daily_challenge_stats(
    current_user: Dict = Depends(get_current_seller),
    db = Depends(get_db)
):
    """Get statistics for seller's daily challenges."""
    try:
        seller_id = current_user['id']
        
        # Get all challenges for this seller
        challenges = await db.daily_challenges.find(
            {"seller_id": seller_id},
            {"_id": 0}
        ).to_list(1000)
        
        # Calculate stats
        total = len(challenges)
        completed = len([c for c in challenges if c.get('completed')])
        
        # Stats by competence
        by_competence = {}
        for c in challenges:
            comp = c.get('competence', 'unknown')
            if comp not in by_competence:
                by_competence[comp] = {'total': 0, 'completed': 0}
            by_competence[comp]['total'] += 1
            if c.get('completed'):
                by_competence[comp]['completed'] += 1
        
        # Current streak
        streak = 0
        sorted_challenges = sorted(
            [c for c in challenges if c.get('completed')],
            key=lambda x: x.get('date', ''),
            reverse=True
        )
        
        if sorted_challenges:
            today = datetime.now(timezone.utc).date()
            for i, ch in enumerate(sorted_challenges):
                ch_date = datetime.strptime(ch.get('date', '2000-01-01'), '%Y-%m-%d').date()
                expected_date = today - timedelta(days=i)
                if ch_date == expected_date or ch_date == expected_date - timedelta(days=1):
                    streak += 1
                else:
                    break
        
        return {
            "total_challenges": total,
            "completed_challenges": completed,
            "completion_rate": round(completed / total * 100, 1) if total > 0 else 0,
            "current_streak": streak,
            "by_competence": by_competence
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/daily-challenge/history")
async def get_daily_challenge_history(
    current_user: Dict = Depends(get_current_seller),
    db = Depends(get_db)
):
    """Get all past daily challenges for the seller."""
    try:
        challenges = await db.daily_challenges.find(
            {"seller_id": current_user['id']},
            {"_id": 0}
        ).sort("date", -1).to_list(100)
        
        return challenges
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ===== BILAN INDIVIDUEL =====

@router.get("/bilan-individuel/all")
async def get_all_bilans_individuels(
    current_user: Dict = Depends(get_current_seller),
    db = Depends(get_db)
):
    """Get all individual performance reports (bilans) for seller."""
    try:
        bilans = await db.seller_bilans.find(
            {"seller_id": current_user['id']},
            {"_id": 0}
        ).sort("created_at", -1).to_list(100)
        
        return {
            "status": "success",
            "bilans": bilans
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/bilan-individuel")
async def generate_bilan_individuel(
    start_date: Optional[str] = Query(None, description="Start date YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="End date YYYY-MM-DD"),
    current_user: Dict = Depends(get_current_seller),
    db = Depends(get_db)
):
    """Generate an individual performance report for a period."""
    from uuid import uuid4
    from services.ai_service import AIService
    import json
    
    try:
        seller_id = current_user['id']
        
        # Get KPIs for the period
        query = {"seller_id": seller_id}
        if start_date and end_date:
            query["date"] = {"$gte": start_date, "$lte": end_date}
        
        kpis = await db.kpi_entries.find(query, {"_id": 0}).to_list(1000)
        
        # Calculate summary
        total_ca = sum(k.get('ca_journalier') or k.get('seller_ca') or 0 for k in kpis)
        total_ventes = sum(k.get('nb_ventes') or 0 for k in kpis)
        total_clients = sum(k.get('nb_clients') or 0 for k in kpis)
        
        panier_moyen = total_ca / total_ventes if total_ventes > 0 else 0
        
        # Try to generate AI bilan with structured format
        ai_service = AIService()
        seller_data = await db.users.find_one({"id": seller_id}, {"_id": 0, "password": 0})
        seller_name = seller_data.get('name', 'Vendeur') if seller_data else 'Vendeur'
        
        # Default values
        synthese = ""
        points_forts = []
        points_attention = []
        recommandations = []
        
        if ai_service.available and len(kpis) > 0:
            try:
                # 🛑 STRICT SELLER PROMPT V3 - No marketing, no traffic, no promotions
                prompt = f"""Génère un bilan de performance pour {seller_name}.

📊 DONNÉES VENDEUR (ignore tout ce qui n'est pas listé) :
- CA total: {total_ca:.0f}€
- Nombre de ventes: {total_ventes}
- Panier moyen: {panier_moyen:.2f}€
- Jours travaillés: {len(kpis)}

⚠️ RAPPEL STRICT : Ne parle PAS de trafic, promotions, réseaux sociaux ou marketing.
Si le CA est bon, félicite simplement. Focus sur accueil, vente additionnelle, closing.

Génère un bilan structuré au format JSON:
{{
  "synthese": "Une phrase de félicitation sincère basée sur le CA et le panier moyen",
  "points_forts": ["Point fort lié à la VENTE", "Point fort lié au SERVICE CLIENT"],
  "points_attention": ["Axe d'amélioration terrain (accueil, closing, vente additionnelle)"],
  "recommandations": ["Action concrète en boutique 1", "Action concrète en boutique 2"]
}}"""

                # Import the strict prompt
                from services.ai_service import SELLER_STRICT_SYSTEM_PROMPT
                
                chat = ai_service._create_chat(
                    session_id=f"bilan_{seller_id}_{start_date}",
                    system_message=SELLER_STRICT_SYSTEM_PROMPT + "\nRéponds uniquement en JSON valide.",
                    model="gpt-4o-mini"
                )
                
                response = await ai_service._send_message(chat, prompt)
                
                if response:
                    # Parse JSON
                    clean = response.strip()
                    if "```json" in clean:
                        clean = clean.split("```json")[1].split("```")[0]
                    elif "```" in clean:
                        clean = clean.split("```")[1].split("```")[0]
                    
                    try:
                        parsed = json.loads(clean.strip())
                        synthese = parsed.get('synthese', '')
                        points_forts = parsed.get('points_forts', [])
                        points_attention = parsed.get('points_attention', [])
                        recommandations = parsed.get('recommandations', [])
                    except:
                        # Fallback: use raw response as synthese
                        synthese = response[:500] if response else ""
                        
            except Exception as e:
                print(f"AI bilan error: {e}")
        
        # If no AI, generate basic bilan
        if not synthese:
            if len(kpis) > 0:
                synthese = f"Cette semaine, tu as réalisé {total_ventes} ventes pour un CA de {total_ca:.0f}€. Continue comme ça !"
                points_forts = ["Assiduité dans la saisie des KPIs"]
                points_attention = ["Continue à développer tes compétences"]
                recommandations = ["Fixe-toi un objectif quotidien", "Analyse tes meilleures ventes"]
            else:
                synthese = "Aucune donnée KPI pour cette période. Commence à saisir tes performances !"
                points_attention = ["Pense à saisir tes KPIs quotidiennement"]
                recommandations = ["Saisis tes ventes chaque jour pour obtenir un bilan personnalisé"]
        
        # Build periode string for frontend compatibility
        periode = f"{start_date} - {end_date}" if start_date and end_date else "Période actuelle"
        
        bilan = {
            "id": str(uuid4()),
            "seller_id": seller_id,
            "periode": periode,
            "period_start": start_date,
            "period_end": end_date,
            "kpi_resume": {
                "ca": total_ca,
                "ventes": total_ventes,
                "clients": total_clients,
                "panier_moyen": round(panier_moyen, 2),
                "jours": len(kpis)
            },
            "synthese": synthese,
            "points_forts": points_forts,
            "points_attention": points_attention,
            "recommandations": recommandations,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.seller_bilans.insert_one(bilan)
        if '_id' in bilan:
            del bilan['_id']
        
        return bilan
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ===== DIAGNOSTIC/ME ENDPOINT (ROOT LEVEL) =====
# This is needed because frontend calls /api/diagnostic/me
# But the diagnostics router has prefix /manager-diagnostic

from fastapi import APIRouter as DiagRouter

# Create a separate router for /diagnostic endpoints
diagnostic_router = APIRouter(prefix="/diagnostic", tags=["Seller Diagnostic"])

@diagnostic_router.get("/me")
async def get_diagnostic_me(
    current_user: Dict = Depends(get_current_seller),
    db = Depends(get_db)
):
    """Get seller's own DISC diagnostic profile (at /api/diagnostic/me)."""
    try:
        diagnostic = await db.diagnostics.find_one(
            {"seller_id": current_user['id']},
            {"_id": 0}
        )
        
        if not diagnostic:
            # Return empty response instead of 404 to avoid console errors
            return {
                "status": "not_started",
                "has_diagnostic": False,
                "message": "Diagnostic DISC non encore complété"
            }
        
        # Return with status 'completed' for frontend compatibility
        return {
            "status": "completed",
            "has_diagnostic": True,
            "diagnostic": diagnostic  # Include the full diagnostic data
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@diagnostic_router.get("/me/live-scores")
async def get_diagnostic_live_scores(
    current_user: Dict = Depends(get_current_seller),
    db = Depends(get_db)
):
    """Get seller's live competence scores (updated after debriefs)."""
    try:
        diagnostic = await db.diagnostics.find_one(
            {"seller_id": current_user['id']},
            {"_id": 0}
        )
        
        if not diagnostic:
            # Return default scores instead of 404
            return {
                "has_diagnostic": False,
                "seller_id": current_user['id'],
                "scores": {
                    "accueil": 3.0,
                    "decouverte": 3.0,
                    "argumentation": 3.0,
                    "closing": 3.0,
                    "fidelisation": 3.0
                },
                "message": "Scores par défaut (diagnostic non complété)"
            }
        
        # Return live scores
        return {
            "has_diagnostic": True,
            "seller_id": current_user['id'],
            "scores": {
                "accueil": diagnostic.get('score_accueil', 3.0),
                "decouverte": diagnostic.get('score_decouverte', 3.0),
                "argumentation": diagnostic.get('score_argumentation', 3.0),
                "closing": diagnostic.get('score_closing', 3.0),
                "fidelisation": diagnostic.get('score_fidelisation', 3.0)
            },
            "updated_at": diagnostic.get('updated_at', diagnostic.get('created_at'))
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ===== STORE INFO FOR SELLER =====

@router.get("/store-info")
async def get_seller_store_info(
    current_user: Dict = Depends(get_current_seller),
    db = Depends(get_db)
):
    """Get basic store info for the seller's store."""
    try:
        seller = await db.users.find_one(
            {"id": current_user['id']},
            {"_id": 0, "store_id": 1}
        )
        
        if not seller or not seller.get('store_id'):
            return {"name": "Magasin", "id": None}
        
        store = await db.stores.find_one(
            {"id": seller['store_id']},
            {"_id": 0, "id": 1, "name": 1, "location": 1}
        )
        
        if not store:
            return {"name": "Magasin", "id": seller['store_id']}
        
        return store
        
    except Exception as e:
        return {"name": "Magasin", "id": None}


# ===== CREATE DIAGNOSTIC =====
# 🏺 LEGACY RESTORED - Full diagnostic creation with AI analysis

from pydantic import BaseModel, Field
from uuid import uuid4

class DiagnosticCreate(BaseModel):
    responses: dict


def calculate_competence_scores_from_questionnaire(responses: dict) -> dict:
    """
    Calculate competence scores from questionnaire responses
    Questions 1-15 are mapped to 5 competences (3 questions each)
    """
    competence_mapping = {
        'accueil': [1, 2, 3],
        'decouverte': [4, 5, 6],
        'argumentation': [7, 8, 9],
        'closing': [10, 11, 12],
        'fidelisation': [13, 14, 15]
    }
    
    question_scores = {
        1: [5, 3, 4],
        2: [5, 4, 3, 2],
        3: [3, 5, 4],
        4: [5, 4, 3],
        5: [5, 4, 4, 3],
        6: [5, 3, 4],
        7: [3, 5, 4],
        8: [3, 5, 4, 3],
        9: [4, 3, 5],
        10: [5, 4, 5, 3],
        11: [4, 3, 5],
        12: [5, 4, 5, 3],
        13: [4, 4, 5, 5],
        14: [4, 5, 3],
        15: [5, 3, 5, 4]
    }
    
    scores = {
        'accueil': [],
        'decouverte': [],
        'argumentation': [],
        'closing': [],
        'fidelisation': []
    }
    
    for competence, question_ids in competence_mapping.items():
        for q_id in question_ids:
            q_key = str(q_id)
            if q_key in responses:
                response_value = responses[q_key]
                if isinstance(response_value, int):
                    option_idx = response_value
                    if q_id in question_scores and option_idx < len(question_scores[q_id]):
                        scores[competence].append(question_scores[q_id][option_idx])
                    else:
                        scores[competence].append(3.0)
                else:
                    scores[competence].append(3.0)
    
    final_scores = {}
    for competence, score_list in scores.items():
        if score_list:
            final_scores[f'score_{competence}'] = round(sum(score_list) / len(score_list), 1)
        else:
            final_scores[f'score_{competence}'] = 3.0
    
    return final_scores


def calculate_disc_profile(disc_responses: dict) -> dict:
    """Calculate DISC profile from questions 16-23"""
    d_score = 0
    i_score = 0
    s_score = 0
    c_score = 0
    
    disc_mapping = {
        '16': {'D': [0], 'I': [1], 'S': [2], 'C': [3]},
        '17': {'D': [0], 'I': [1], 'S': [2], 'C': [3]},
        '18': {'D': [0], 'I': [1], 'S': [2], 'C': [3]},
        '19': {'D': [0], 'I': [1], 'S': [2], 'C': [3]},
        '20': {'D': [0], 'I': [1], 'S': [2], 'C': [3]},
        '21': {'D': [0], 'I': [1], 'S': [2], 'C': [3]},
        '22': {'D': [0], 'I': [1], 'S': [2], 'C': [3]},
        '23': {'D': [0], 'I': [1], 'S': [2], 'C': [3]},
    }
    
    for q_key, response in disc_responses.items():
        if q_key in disc_mapping:
            mapping = disc_mapping[q_key]
            if isinstance(response, int):
                if response in mapping.get('D', []):
                    d_score += 1
                elif response in mapping.get('I', []):
                    i_score += 1
                elif response in mapping.get('S', []):
                    s_score += 1
                elif response in mapping.get('C', []):
                    c_score += 1
    
    total = d_score + i_score + s_score + c_score
    if total == 0:
        total = 1
    
    percentages = {
        'D': round(d_score / total * 100),
        'I': round(i_score / total * 100),
        'S': round(s_score / total * 100),
        'C': round(c_score / total * 100)
    }
    
    dominant = max(percentages, key=percentages.get)
    
    return {
        'dominant': dominant,
        'percentages': percentages
    }


@diagnostic_router.post("")
async def create_diagnostic(
    diagnostic_data: DiagnosticCreate,
    current_user: Dict = Depends(get_current_seller),
    db = Depends(get_db)
):
    """
    Create or update seller's DISC diagnostic profile.
    Uses AI to analyze responses and generate profile summary.
    """
    from services.ai_service import AIService
    import json
    
    try:
        seller_id = current_user['id']
        responses = diagnostic_data.responses
        
        # Delete existing diagnostic if any (allow update)
        await db.diagnostics.delete_many({"seller_id": seller_id})
        
        # Calculate competence scores from questionnaire
        competence_scores = calculate_competence_scores_from_questionnaire(responses)
        
        # Calculate DISC profile from questions 16-23
        disc_responses = {k: v for k, v in responses.items() if k.isdigit() and int(k) >= 16}
        disc_profile = calculate_disc_profile(disc_responses)
        
        # AI Analysis for style, level, motivation
        ai_service = AIService()
        ai_analysis = {
            "style": "Convivial",
            "level": "Challenger",
            "motivation": "Relation",
            "summary": "Profil en cours d'analyse."
        }
        
        if ai_service.available:
            try:
                # Format responses for AI
                responses_text = "\n".join([f"Question {k}: {v}" for k, v in responses.items()])
                
                prompt = f"""Voici les réponses d'un vendeur à un test comportemental :

{responses_text}

Analyse ses réponses pour identifier :
- son style de vente dominant (Convivial, Explorateur, Dynamique, Discret ou Stratège)
- son niveau global (Explorateur, Challenger, Ambassadeur, Maître du Jeu)
- ses leviers de motivation (Relation, Reconnaissance, Performance, Découverte)

Rédige un retour structuré avec une phrase d'intro, deux points forts, un axe d'amélioration et une phrase motivante.

Réponds au format JSON:
{{"style": "...", "level": "...", "motivation": "...", "summary": "..."}}"""

                chat = ai_service._create_chat(
                    session_id=f"diagnostic_{seller_id}",
                    system_message="Tu es un expert en analyse comportementale de vendeurs retail.",
                    model="gpt-4o-mini"
                )
                
                response = await ai_service._send_message(chat, prompt)
                
                if response:
                    # Parse JSON
                    clean = response.strip()
                    if "```json" in clean:
                        clean = clean.split("```json")[1].split("```")[0]
                    elif "```" in clean:
                        clean = clean.split("```")[1].split("```")[0]
                    
                    try:
                        ai_analysis = json.loads(clean.strip())
                    except:
                        pass
                        
            except Exception as e:
                print(f"AI diagnostic error: {e}")
        
        # Create diagnostic document
        diagnostic = {
            "id": str(uuid4()),
            "seller_id": seller_id,
            "responses": responses,
            "ai_profile_summary": ai_analysis.get('summary', ''),
            "style": ai_analysis.get('style', 'Convivial'),
            "level": ai_analysis.get('level', 'Challenger'),
            "motivation": ai_analysis.get('motivation', 'Relation'),
            "score_accueil": competence_scores.get('score_accueil', 3.0),
            "score_decouverte": competence_scores.get('score_decouverte', 3.0),
            "score_argumentation": competence_scores.get('score_argumentation', 3.0),
            "score_closing": competence_scores.get('score_closing', 3.0),
            "score_fidelisation": competence_scores.get('score_fidelisation', 3.0),
            "disc_dominant": disc_profile['dominant'],
            "disc_percentages": disc_profile['percentages'],
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.diagnostics.insert_one(diagnostic)
        if '_id' in diagnostic:
            del diagnostic['_id']
        
        return diagnostic
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creating diagnostic: {str(e)}")


@diagnostic_router.delete("/me")
async def delete_my_diagnostic(
    current_user: Dict = Depends(get_current_seller),
    db = Depends(get_db)
):
    """Delete seller's diagnostic to allow re-taking the questionnaire."""
    try:
        result = await db.diagnostics.delete_many({"seller_id": current_user['id']})
        return {"success": True, "deleted_count": result.deleted_count}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ===== DAILY CHALLENGE REFRESH =====

@router.post("/daily-challenge/refresh")
async def refresh_daily_challenge(
    data: dict = None,
    current_user: Dict = Depends(get_current_seller),
    db = Depends(get_db)
):
    """
    Refresh/regenerate the daily challenge for the seller.
    Deletes the current uncompleted challenge and generates a new one.
    Optionally forces a specific competence.
    """
    from uuid import uuid4
    
    try:
        seller_id = current_user['id']
        today = datetime.now(timezone.utc).strftime('%Y-%m-%d')
        
        # Get force_competence from data if provided
        force_competence = None
        if data:
            force_competence = data.get('force_competence') or data.get('competence')
        
        # Delete current uncompleted challenge for today
        await db.daily_challenges.delete_many({
            "seller_id": seller_id,
            "date": today,
            "completed": False
        })
        
        # Get seller's diagnostic for personalization
        diagnostic = await db.diagnostics.find_one({
            "seller_id": seller_id
        }, {"_id": 0})
        
        # Get recent challenges to avoid repetition
        recent = await db.daily_challenges.find(
            {"seller_id": seller_id},
            {"_id": 0}
        ).sort("date", -1).limit(5).to_list(5)
        
        recent_competences = [ch.get('competence') for ch in recent if ch.get('competence')]
        
        # Select competence
        if force_competence and force_competence in ['accueil', 'decouverte', 'argumentation', 'closing', 'fidelisation']:
            selected_competence = force_competence
        elif not diagnostic:
            competences = ['accueil', 'decouverte', 'argumentation', 'closing', 'fidelisation']
            # Random but avoid last used
            import random
            available = [c for c in competences if c not in recent_competences[:2]]
            selected_competence = random.choice(available) if available else random.choice(competences)
        else:
            # Find weakest competence not recently used
            scores = {
                'accueil': diagnostic.get('score_accueil', 3),
                'decouverte': diagnostic.get('score_decouverte', 3),
                'argumentation': diagnostic.get('score_argumentation', 3),
                'closing': diagnostic.get('score_closing', 3),
                'fidelisation': diagnostic.get('score_fidelisation', 3)
            }
            sorted_comps = sorted(scores.items(), key=lambda x: x[1])
            
            selected_competence = None
            for comp, score in sorted_comps:
                if comp not in recent_competences[:2]:
                    selected_competence = comp
                    break
            
            if not selected_competence:
                selected_competence = sorted_comps[0][0]
        
        # Challenge templates by competence
        templates = {
            'accueil': [
                {'title': 'Accueil Excellence', 'description': 'Accueillez chaque client avec un sourire et une phrase personnalisée dans les 10 premières secondes.'},
                {'title': 'Premier Contact', 'description': 'Établissez un contact visuel et saluez chaque client qui entre en boutique.'},
                {'title': 'Ambiance Positive', 'description': 'Créez une ambiance chaleureuse dès l\'entrée du client avec une attitude ouverte.'}
            ],
            'decouverte': [
                {'title': 'Questions Magiques', 'description': 'Posez au moins 3 questions ouvertes à chaque client pour comprendre ses besoins.'},
                {'title': 'Écoute Active', 'description': 'Reformulez les besoins du client pour montrer que vous avez bien compris.'},
                {'title': 'Détective Client', 'description': 'Identifiez le besoin caché derrière la demande initiale du client.'}
            ],
            'argumentation': [
                {'title': 'Argumentaire Pro', 'description': 'Utilisez la technique CAB (Caractéristique-Avantage-Bénéfice) pour chaque produit présenté.'},
                {'title': 'Storytelling', 'description': 'Racontez une histoire ou un cas client pour illustrer les avantages du produit.'},
                {'title': 'Démonstration', 'description': 'Faites toucher/essayer le produit à chaque client pour créer l\'expérience.'}
            ],
            'closing': [
                {'title': 'Closing Master', 'description': 'Proposez la conclusion de la vente avec une question fermée positive.'},
                {'title': 'Alternative Gagnante', 'description': 'Proposez deux options au client plutôt qu\'une seule.'},
                {'title': 'Urgence Douce', 'description': 'Créez un sentiment d\'opportunité avec une offre limitée dans le temps.'}
            ],
            'fidelisation': [
                {'title': 'Client Fidèle', 'description': 'Remerciez chaque client et proposez un contact ou suivi personnalisé.'},
                {'title': 'Carte VIP', 'description': 'Proposez l\'inscription au programme de fidélité à chaque client.'},
                {'title': 'Prochain RDV', 'description': 'Suggérez une prochaine visite avec un événement ou nouveauté à venir.'}
            ]
        }
        
        import random
        template_list = templates.get(selected_competence, templates['accueil'])
        template = random.choice(template_list)
        
        challenge = {
            "id": str(uuid4()),
            "seller_id": seller_id,
            "date": today,
            "competence": selected_competence,
            "title": template['title'],
            "description": template['description'],
            "completed": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.daily_challenges.insert_one(challenge)
        if '_id' in challenge:
            del challenge['_id']
        
        return challenge
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error refreshing challenge: {str(e)}")
