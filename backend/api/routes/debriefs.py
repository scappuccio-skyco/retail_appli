"""
Debriefs Routes
🏺 LEGACY RESTORED - Endpoints for sales debriefs (success/failure analysis)
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Dict, List, Optional
from datetime import datetime, timezone
from uuid import uuid4
from pydantic import BaseModel

from core.security import get_current_user
from api.dependencies import get_db

router = APIRouter(tags=["Debriefs"])


# ===== PYDANTIC MODELS =====

class DebriefCreate(BaseModel):
    vente_conclue: bool = True
    produit: Optional[str] = ""
    type_client: Optional[str] = ""
    situation_vente: Optional[str] = ""
    description_vente: Optional[str] = ""
    moment_perte_client: Optional[str] = ""
    raisons_echec: Optional[str] = ""
    amelioration_pensee: Optional[str] = ""


# ===== DEBRIEFS ROUTES =====

@router.post("/debriefs")
async def create_debrief(
    debrief_data: DebriefCreate,
    current_user: Dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """
    Create a new debrief (post-sale analysis).
    Uses AI to generate coaching feedback.
    """
    from services.ai_service import AIService
    
    if current_user['role'] != 'seller':
        raise HTTPException(status_code=403, detail="Only sellers can create debriefs")
    
    try:
        seller_id = current_user['id']
        
        # Get current competence scores from diagnostic
        diagnostic = await db.diagnostics.find_one(
            {"seller_id": seller_id},
            {"_id": 0}
        )
        
        current_scores = {
            'accueil': diagnostic.get('score_accueil', 3.0) if diagnostic else 3.0,
            'decouverte': diagnostic.get('score_decouverte', 3.0) if diagnostic else 3.0,
            'argumentation': diagnostic.get('score_argumentation', 3.0) if diagnostic else 3.0,
            'closing': diagnostic.get('score_closing', 3.0) if diagnostic else 3.0,
            'fidelisation': diagnostic.get('score_fidelisation', 3.0) if diagnostic else 3.0
        }
        
        # Get KPI context
        today = datetime.now(timezone.utc).strftime('%Y-%m-%d')
        today_kpi = await db.kpi_entries.find_one(
            {"seller_id": seller_id, "date": today},
            {"_id": 0}
        )
        
        kpi_context = ""
        if today_kpi:
            kpi_context = f"\n\nKPIs du jour: CA {today_kpi.get('ca_journalier', 0):.0f}€, {today_kpi.get('nb_ventes', 0)} ventes"
        
        # Generate AI feedback
        ai_service = AIService()
        
        ai_feedback = None
        new_scores = current_scores.copy()
        
        # Initialize AI fields at root level (legacy format for frontend compatibility)
        ai_analyse = ""
        ai_points_travailler = ""
        ai_recommandation = ""
        ai_exemple_concret = ""
        
        if ai_service.available:
            try:
                feedback_result = await ai_service.generate_debrief(
                    debrief_data=debrief_data.dict(),
                    current_scores=current_scores,
                    kpi_context=kpi_context,
                    is_success=debrief_data.vente_conclue
                )
                
                if feedback_result:
                    # Store AI fields at root level (legacy format)
                    ai_analyse = feedback_result.get('analyse', '')
                    ai_points_travailler = feedback_result.get('points_travailler', '')
                    ai_recommandation = feedback_result.get('recommandation', '')
                    ai_exemple_concret = feedback_result.get('exemple_concret', '')
                    
                    new_scores = {
                        'accueil': feedback_result.get('score_accueil', current_scores['accueil']),
                        'decouverte': feedback_result.get('score_decouverte', current_scores['decouverte']),
                        'argumentation': feedback_result.get('score_argumentation', current_scores['argumentation']),
                        'closing': feedback_result.get('score_closing', current_scores['closing']),
                        'fidelisation': feedback_result.get('score_fidelisation', current_scores['fidelisation'])
                    }
            except Exception as e:
                print(f"AI debrief error: {e}")
        
        debrief = {
            "id": str(uuid4()),
            "seller_id": seller_id,
            "vente_conclue": debrief_data.vente_conclue,
            "produit": debrief_data.produit,
            "type_client": debrief_data.type_client,
            "situation_vente": debrief_data.situation_vente,
            "description_vente": debrief_data.description_vente,
            "moment_perte_client": debrief_data.moment_perte_client,
            "raisons_echec": debrief_data.raisons_echec,
            "amelioration_pensee": debrief_data.amelioration_pensee,
            # AI fields at root level (legacy format for frontend)
            "ai_analyse": ai_analyse,
            "ai_points_travailler": ai_points_travailler,
            "ai_recommandation": ai_recommandation,
            "ai_exemple_concret": ai_exemple_concret,
            # Score tracking
            "score_accueil": new_scores.get('accueil', current_scores['accueil']),
            "score_decouverte": new_scores.get('decouverte', current_scores['decouverte']),
            "score_argumentation": new_scores.get('argumentation', current_scores['argumentation']),
            "score_closing": new_scores.get('closing', current_scores['closing']),
            "score_fidelisation": new_scores.get('fidelisation', current_scores['fidelisation']),
            "shared_with_manager": False,
            "date": today,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.debriefs.insert_one(debrief)
        
        # Update diagnostic scores if changed
        if new_scores != current_scores:
            await db.diagnostics.update_one(
                {"seller_id": seller_id},
                {"$set": {
                    "score_accueil": new_scores['accueil'],
                    "score_decouverte": new_scores['decouverte'],
                    "score_argumentation": new_scores['argumentation'],
                    "score_closing": new_scores['closing'],
                    "score_fidelisation": new_scores['fidelisation'],
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }},
                upsert=True
            )
        
        if '_id' in debrief:
            del debrief['_id']
        
        return debrief
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/debriefs")
async def get_debriefs(
    current_user: Dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Get debriefs for current user (seller sees own, manager sees shared)."""
    try:
        if current_user['role'] == 'seller':
            debriefs = await db.debriefs.find(
                {"seller_id": current_user['id']},
                {"_id": 0}
            ).sort("created_at", -1).to_list(100)
        else:
            # Manager sees shared debriefs from their team
            store_id = current_user.get('store_id')
            if store_id:
                sellers = await db.users.find(
                    {"store_id": store_id, "role": "seller"},
                    {"_id": 0, "id": 1}
                ).to_list(1000)
                seller_ids = [s['id'] for s in sellers]
                debriefs = await db.debriefs.find(
                    {"seller_id": {"$in": seller_ids}, "shared_with_manager": True},
                    {"_id": 0}
                ).sort("created_at", -1).to_list(100)
            else:
                debriefs = []
        
        return debriefs
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/debriefs/{debrief_id}/visibility")
async def toggle_debrief_visibility(
    debrief_id: str,
    data: dict,
    current_user: Dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Toggle whether a debrief is shared with the manager."""
    try:
        shared = data.get('shared_with_manager', False)
        
        result = await db.debriefs.update_one(
            {"id": debrief_id, "seller_id": current_user['id']},
            {"$set": {"shared_with_manager": shared}}
        )
        
        if result.modified_count == 0:
            raise HTTPException(status_code=404, detail="Debrief not found")
        
        return {"success": True, "shared_with_manager": shared}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/debriefs/{debrief_id}")
async def delete_debrief(
    debrief_id: str,
    current_user: Dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Delete a debrief."""
    try:
        result = await db.debriefs.delete_one(
            {"id": debrief_id, "seller_id": current_user['id']}
        )
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Debrief not found")
        
        return {"success": True}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
