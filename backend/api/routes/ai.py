"""AI & Diagnostic Routes - Clean Architecture"""
from fastapi import APIRouter, Depends, Request
from typing import Dict, List, Union

from core.exceptions import ValidationError
from services.ai_service import AIService, AIDataService
from api.dependencies import get_ai_service, get_ai_data_service
from api.dependencies_rate_limiting import rate_limit
from core.security import get_current_user, get_current_seller, require_active_space
from models.diagnostics import DiagnosticResponse

router = APIRouter(
    prefix="/ai",
    tags=["AI & Diagnostics"],
    dependencies=[Depends(require_active_space)]
)


@router.post("/diagnostic", dependencies=[rate_limit("5/minute")])
async def generate_diagnostic(
    request: Request,
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
    normalized_responses = []
    for r in responses:
        if isinstance(r, dict):
            if 'question_id' in r:
                normalized_responses.append({
                    'question_id': r['question_id'],
                    'question': r.get('question', f"Question {r['question_id']}"),
                    'answer': str(r['answer'])
                })
            elif 'question' in r:
                normalized_responses.append({
                    'question': r['question'],
                    'answer': str(r['answer'])
                })
            else:
                raise ValidationError(f"Format de réponse invalide: {r}")
        elif isinstance(r, DiagnosticResponse):
            normalized_responses.append({
                'question_id': r.question_id,
                'question': r.question or f"Question {r.question_id}",
                'answer': r.answer
            })
        else:
            raise ValidationError(f"Type de réponse invalide: {type(r)}")
    return await ai_service.generate_diagnostic(
        responses=normalized_responses,
        seller_name=current_user['name']
    )


@router.post("/daily-challenge", dependencies=[rate_limit("5/minute")])
async def generate_daily_challenge(
    request: Request,
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
        raise BusinessLogicError(str(e))


@router.post("/seller-bilan", dependencies=[rate_limit("5/minute")])
async def generate_seller_bilan(
    request: Request,
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
    return await ai_data_service.generate_seller_bilan_with_data(
        seller_id=current_user['id'],
        seller_data=current_user,
        days=30
    )
