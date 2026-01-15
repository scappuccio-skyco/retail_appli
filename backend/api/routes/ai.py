"""AI & Diagnostic Routes - Clean Architecture"""
from fastapi import APIRouter, Depends, HTTPException
from typing import Dict, List, Union

from services.ai_service import AIService, AIDataService
from api.dependencies import get_ai_service, get_ai_data_service
from core.security import get_current_user, get_current_seller, require_active_space
from models.diagnostics import DiagnosticResponse

router = APIRouter(
    prefix="/ai",
    tags=["AI & Diagnostics"],
    dependencies=[Depends(require_active_space)]
)


@router.post("/diagnostic")
async def generate_diagnostic(
    responses: List[Union[DiagnosticResponse, Dict]],
    current_user: Dict = Depends(get_current_seller),
    ai_service: AIService = Depends(get_ai_service)
):
    """
    Generate DISC diagnostic from seller responses
    
    Args:
        responses: List of question/answer pairs (format: { question_id: int, answer: str, question?: str })
        current_user: Authenticated seller
        ai_service: AI service instance
        
    Returns:
        Diagnostic result with style, level, strengths, weaknesses
    """
    try:
        # Normaliser les réponses au format attendu par le service AI
        normalized_responses = []
        for r in responses:
            if isinstance(r, dict):
                # Ancien format ou nouveau format dict
                if 'question_id' in r:
                    # Nouveau format avec question_id
                    normalized_responses.append({
                        'question_id': r['question_id'],
                        'question': r.get('question', f"Question {r['question_id']}"),
                        'answer': str(r['answer'])
                    })
                elif 'question' in r:
                    # Ancien format avec question text
                    normalized_responses.append({
                        'question': r['question'],
                        'answer': str(r['answer'])
                    })
                else:
                    # Format inconnu, essayer de convertir
                    raise HTTPException(status_code=422, detail=f"Format de réponse invalide: {r}")
            elif isinstance(r, DiagnosticResponse):
                # Nouveau format Pydantic
                normalized_responses.append({
                    'question_id': r.question_id,
                    'question': r.question or f"Question {r.question_id}",
                    'answer': r.answer
                })
            else:
                raise HTTPException(status_code=422, detail=f"Type de réponse invalide: {type(r)}")
        
        result = await ai_service.generate_diagnostic(
            responses=normalized_responses,
            seller_name=current_user['name']
        )
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/daily-challenge")
async def generate_daily_challenge(
    current_user: Dict = Depends(get_current_seller),
    ai_data_service: AIDataService = Depends(get_ai_data_service)
):
    """
    Generate personalized daily challenge for seller
    
    Args:
        current_user: Authenticated seller
        ai_data_service: AI data service instance
        
    Returns:
        Daily challenge
    """
    try:
        challenge = await ai_data_service.generate_daily_challenge_with_data(
            seller_id=current_user['id']
        )
        return challenge
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/seller-bilan")
async def generate_seller_bilan(
    current_user: Dict = Depends(get_current_seller),
    ai_data_service: AIDataService = Depends(get_ai_data_service)
):
    """
    Generate performance report for seller
    
    Args:
        current_user: Authenticated seller
        ai_data_service: AI data service instance
        
    Returns:
        Performance bilan
    """
    try:
        return await ai_data_service.generate_seller_bilan_with_data(
            seller_id=current_user['id'],
            seller_data=current_user,
            days=30
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
