"""
Sales and Evaluations Routes
🏺 LEGACY RESTORED - Endpoints for sales tracking and self-evaluations
"""
from fastapi import APIRouter, Depends, HTTPException
from typing import Dict, List, Optional
from datetime import datetime, timezone
from uuid import uuid4
from pydantic import BaseModel

from core.security import get_current_user, require_active_space
from api.dependencies import get_db

router = APIRouter(
    tags=["Sales & Evaluations"],
    dependencies=[Depends(require_active_space)]
)


# ===== PYDANTIC MODELS =====

class SaleCreate(BaseModel):
    amount: float
    product: str
    notes: Optional[str] = ""


class EvaluationCreate(BaseModel):
    sale_id: str
    accueil: int
    decouverte: int
    argumentation: int
    closing: int
    fidelisation: int
    auto_comment: Optional[str] = ""


# ===== SALES ROUTES =====

@router.post("/sales")
async def create_sale(
    sale_data: SaleCreate,
    current_user: Dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Create a new sale record (seller only)."""
    if current_user['role'] != 'seller':
        raise HTTPException(status_code=403, detail="Only sellers can create sales")
    
    sale = {
        "id": str(uuid4()),
        "seller_id": current_user['id'],
        "amount": sale_data.amount,
        "product": sale_data.product,
        "notes": sale_data.notes,
        "date": datetime.now(timezone.utc).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.sales.insert_one(sale)
    if '_id' in sale:
        del sale['_id']
    
    return sale


@router.get("/sales")
async def get_sales(
    current_user: Dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Get sales for current user (seller sees own, manager sees team)."""
    try:
        if current_user['role'] == 'seller':
            sales = await db.sales.find(
                {"seller_id": current_user['id']},
                {"_id": 0}
            ).sort("date", -1).to_list(1000)
        else:
            # Manager sees all sellers in their store
            store_id = current_user.get('store_id')
            if store_id:
                sellers = await db.users.find(
                    {"store_id": store_id, "role": "seller"},
                    {"_id": 0, "id": 1}
                ).to_list(1000)
                seller_ids = [s['id'] for s in sellers]
                sales = await db.sales.find(
                    {"seller_id": {"$in": seller_ids}},
                    {"_id": 0}
                ).sort("date", -1).to_list(1000)
            else:
                sales = []
        
        return sales
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ===== EVALUATIONS ROUTES =====

@router.post("/evaluations")
async def create_evaluation(
    eval_data: EvaluationCreate,
    current_user: Dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Create a self-evaluation for a sale (seller only)."""
    if current_user['role'] != 'seller':
        raise HTTPException(status_code=403, detail="Only sellers can create evaluations")
    
    # Verify sale exists and belongs to seller
    sale = await db.sales.find_one(
        {"id": eval_data.sale_id, "seller_id": current_user['id']},
        {"_id": 0}
    )
    
    if not sale:
        raise HTTPException(status_code=404, detail="Sale not found")
    
    # Calculate radar scores
    radar_scores = {
        "accueil": eval_data.accueil,
        "decouverte": eval_data.decouverte,
        "argumentation": eval_data.argumentation,
        "closing": eval_data.closing,
        "fidelisation": eval_data.fidelisation
    }
    
    # Calculate average score
    avg_score = sum(radar_scores.values()) / len(radar_scores)
    
    evaluation = {
        "id": str(uuid4()),
        "seller_id": current_user['id'],
        "sale_id": eval_data.sale_id,
        "accueil": eval_data.accueil,
        "decouverte": eval_data.decouverte,
        "argumentation": eval_data.argumentation,
        "closing": eval_data.closing,
        "fidelisation": eval_data.fidelisation,
        "radar_scores": radar_scores,
        "average_score": round(avg_score, 2),
        "auto_comment": eval_data.auto_comment,
        "ai_feedback": None,  # Can be generated later
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.evaluations.insert_one(evaluation)
    if '_id' in evaluation:
        del evaluation['_id']
    
    return evaluation


@router.get("/evaluations")
async def get_evaluations(
    current_user: Dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Get evaluations for current user."""
    try:
        if current_user['role'] == 'seller':
            evals = await db.evaluations.find(
                {"seller_id": current_user['id']},
                {"_id": 0}
            ).sort("created_at", -1).to_list(1000)
        else:
            # Manager sees all sellers in their store
            store_id = current_user.get('store_id')
            if store_id:
                sellers = await db.users.find(
                    {"store_id": store_id, "role": "seller"},
                    {"_id": 0, "id": 1}
                ).to_list(1000)
                seller_ids = [s['id'] for s in sellers]
                evals = await db.evaluations.find(
                    {"seller_id": {"$in": seller_ids}},
                    {"_id": 0}
                ).sort("created_at", -1).to_list(1000)
            else:
                evals = []
        
        return evals
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
