"""AI & Diagnostic Routes"""
from fastapi import APIRouter, Depends, HTTPException
from typing import Dict, List

from services.ai_service import AIService
from api.dependencies import get_ai_service
from core.security import get_current_user, get_current_seller

router = APIRouter(prefix="/ai", tags=["AI & Diagnostics"])


@router.post("/diagnostic")
async def generate_diagnostic(
    responses: List[Dict],
    current_user: Dict = Depends(get_current_seller),
    ai_service: AIService = Depends(get_ai_service)
):
    """
    Generate DISC diagnostic from seller responses
    
    Args:
        responses: List of question/answer pairs
        current_user: Authenticated seller
        ai_service: AI service instance
        
    Returns:
        Diagnostic result with style, level, strengths, weaknesses
    """
    try:
        result = await ai_service.generate_diagnostic(
            responses=responses,
            seller_name=current_user['name']
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/daily-challenge")
async def generate_daily_challenge(
    current_user: Dict = Depends(get_current_seller),
    ai_service: AIService = Depends(get_ai_service)
):
    """
    Generate personalized daily challenge for seller
    
    Args:
        current_user: Authenticated seller
        ai_service: AI service instance
        
    Returns:
        Daily challenge
    """
    try:
        # Get seller profile from DB
        from core.database import get_db
        db = await get_db()
        
        # Get diagnostic
        diagnostic = await db.diagnostics.find_one(
            {"seller_id": current_user['id']},
            {"_id": 0}
        )
        
        if not diagnostic:
            diagnostic = {"style": "Adaptateur", "level": 3}
        
        # Get recent KPIs
        recent_kpis = await db.kpi_entries.find(
            {"seller_id": current_user['id']},
            {"_id": 0}
        ).sort("date", -1).limit(7).to_list(7)
        
        challenge = await ai_service.generate_daily_challenge(
            seller_profile=diagnostic,
            recent_kpis=recent_kpis
        )
        
        return challenge
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/seller-bilan")
async def generate_seller_bilan(
    current_user: Dict = Depends(get_current_seller),
    ai_service: AIService = Depends(get_ai_service)
):
    """
    Generate performance report for seller
    
    Args:
        current_user: Authenticated seller
        ai_service: AI service instance
        
    Returns:
        Performance bilan
    """
    try:
        # Get recent KPIs
        from core.database import get_db
        db = await get_db()
        
        kpis = await db.kpi_entries.find(
            {"seller_id": current_user['id']},
            {"_id": 0}
        ).sort("date", -1).limit(30).to_list(30)
        
        bilan = await ai_service.generate_seller_bilan(
            seller_data=current_user,
            kpis=kpis
        )
        
        return {"bilan": bilan}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
