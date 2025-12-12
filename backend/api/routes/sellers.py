"""
Seller Routes
API endpoints for seller-specific features (tasks, objectives, challenges)
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Dict, List
from datetime import datetime, timezone

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
        
        return bilans
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/bilan-individuel")
async def generate_bilan_individuel(
    data: dict,
    current_user: Dict = Depends(get_current_seller),
    db = Depends(get_db)
):
    """Generate an individual performance report for a period."""
    from uuid import uuid4
    from services.ai_service import AIService
    
    try:
        seller_id = current_user['id']
        start_date = data.get('start_date')
        end_date = data.get('end_date')
        
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
        
        # Try to generate AI bilan
        ai_service = AIService()
        seller_data = await db.users.find_one({"id": seller_id}, {"_id": 0, "password": 0})
        
        ai_commentary = None
        if ai_service.available:
            try:
                ai_commentary = await ai_service.generate_seller_bilan(
                    seller_data=seller_data or {"name": "Vendeur"},
                    kpis=kpis
                )
            except Exception:
                pass
        
        bilan = {
            "id": str(uuid4()),
            "seller_id": seller_id,
            "period_start": start_date,
            "period_end": end_date,
            "summary": {
                "total_ca": total_ca,
                "total_ventes": total_ventes,
                "total_clients": total_clients,
                "panier_moyen": round(panier_moyen, 2),
                "days_count": len(kpis)
            },
            "ai_commentary": ai_commentary,
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
            raise HTTPException(status_code=404, detail="Diagnostic non trouvé")
        
        return diagnostic
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ===== DIAGNOSTIC LIVE SCORES =====

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
            raise HTTPException(status_code=404, detail="Diagnostic non trouvé")
        
        # Return live scores
        return {
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
