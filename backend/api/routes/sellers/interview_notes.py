"""
Seller Interview Notes Routes
Routes for /interview-notes/* (bloc-notes préparation entretien).
"""
from fastapi import APIRouter, Depends, Query
from typing import Dict, Optional
from datetime import datetime, timezone
import uuid
import logging

from services.seller_service import SellerService
from api.dependencies import get_seller_service
from core.security import get_current_seller
from core.exceptions import NotFoundError, ValidationError

router = APIRouter()
logger = logging.getLogger(__name__)


# ===== INTERVIEW NOTES (Bloc-notes pour préparation entretien) =====

@router.get("/interview-notes")
async def get_interview_notes(
    current_user: Dict = Depends(get_current_seller),
    seller_service: SellerService = Depends(get_seller_service),
):
    """
    Récupère toutes les notes d'entretien du vendeur.
    Retourne les notes triées par date (plus récentes en premier).
    """
    seller_id = current_user['id']
    notes_result = await seller_service.get_interview_notes_paginated(
        seller_id, page=1, size=50
    )
    return {
        "notes": notes_result.items,
        "pagination": {
            "total": notes_result.total,
            "page": notes_result.page,
            "size": notes_result.size,
            "pages": notes_result.pages
        }
    }


@router.get("/interview-notes/{date}")
async def get_interview_note_by_date(
    date: str,
    current_user: Dict = Depends(get_current_seller),
    seller_service: SellerService = Depends(get_seller_service),
):
    """
    Récupère la note d'entretien pour une date spécifique.
    """
    seller_id = current_user['id']
    note = await seller_service.get_interview_note_by_seller_and_date(seller_id, date)
    if not note:
        return {"note": None}
    return {"note": note}


@router.post("/interview-notes")
async def create_interview_note(
    note_data: dict,
    current_user: Dict = Depends(get_current_seller),
    seller_service: SellerService = Depends(get_seller_service),
):
    """
    Crée ou met à jour une note d'entretien pour une date donnée.
    Si une note existe déjà pour cette date, elle est mise à jour.
    """
    seller_id = current_user['id']
    date = note_data.get('date')
    content = note_data.get('content', '').strip()
    if not date:
        raise ValidationError("La date est requise")
    try:
        datetime.strptime(date, "%Y-%m-%d")
    except ValueError:
        raise ValidationError("Format de date invalide. Utilisez YYYY-MM-DD")
    now = datetime.now(timezone.utc)
    existing_note = await seller_service.get_interview_note_by_seller_and_date(
        seller_id, date
    )
    if existing_note:
        await seller_service.update_interview_note_by_date(
            seller_id, date,
            {"content": content, "updated_at": now.isoformat()}
        )
        note_id = existing_note.get('id')
        message = "Note mise à jour avec succès"
    else:
        note = {
            "id": str(uuid.uuid4()),
            "seller_id": seller_id,
            "date": date,
            "content": content,
            "shared_with_manager": False,
            "created_at": now.isoformat(),
            "updated_at": now.isoformat()
        }
        note_id = await seller_service.create_interview_note(note)
        message = "Note créée avec succès"
    return {
        "success": True,
        "message": message,
        "note_id": note_id,
        "date": date
    }


@router.put("/interview-notes/{note_id}")
async def update_interview_note(
    note_id: str,
    note_data: dict,
    current_user: Dict = Depends(get_current_seller),
    seller_service: SellerService = Depends(get_seller_service),
):
    """
    Met à jour une note d'entretien existante.
    """
    seller_id = current_user['id']
    content = note_data.get('content', '').strip()
    note = await seller_service.get_interview_note_by_id_and_seller(note_id, seller_id)
    if not note:
        raise NotFoundError("Note non trouvée")
    await seller_service.update_interview_note_by_id(
        note_id, seller_id,
        {"content": content, "updated_at": datetime.now(timezone.utc).isoformat()}
    )
    return {
        "success": True,
        "message": "Note mise à jour avec succès"
    }


@router.patch("/interview-notes/{note_id}/visibility")
async def toggle_interview_note_visibility(
    note_id: str,
    visibility_data: dict,
    current_user: Dict = Depends(get_current_seller),
    seller_service: SellerService = Depends(get_seller_service),
):
    """
    Toggle la visibilité d'une note d'entretien pour le manager.
    """
    seller_id = current_user['id']
    shared = bool(visibility_data.get('shared_with_manager', False))
    note = await seller_service.get_interview_note_by_id_and_seller(note_id, seller_id)
    if not note:
        raise NotFoundError("Note non trouvée")
    await seller_service.toggle_interview_note_visibility(note_id, seller_id, shared)
    return {
        "success": True,
        "shared_with_manager": shared,
        "message": "Note partagée avec le manager" if shared else "Note masquée au manager"
    }


@router.delete("/interview-notes/{note_id}")
async def delete_interview_note(
    note_id: str,
    current_user: Dict = Depends(get_current_seller),
    seller_service: SellerService = Depends(get_seller_service),
):
    """
    Supprime une note d'entretien.
    """
    seller_id = current_user['id']
    deleted = await seller_service.delete_interview_note_by_id(note_id, seller_id)
    if not deleted:
        raise NotFoundError("Note non trouvée")
    return {
        "success": True,
        "message": "Note supprimée avec succès"
    }


@router.delete("/interview-notes/date/{date}")
async def delete_interview_note_by_date(
    date: str,
    current_user: Dict = Depends(get_current_seller),
    seller_service: SellerService = Depends(get_seller_service),
):
    """
    Supprime une note d'entretien par date.
    """
    seller_id = current_user['id']
    try:
        datetime.strptime(date, "%Y-%m-%d")
    except ValueError:
        raise ValidationError("Format de date invalide. Utilisez YYYY-MM-DD")
    deleted = await seller_service.delete_interview_note_by_date(seller_id, date)
    if not deleted:
        raise NotFoundError("Note non trouvée pour cette date")
    return {
        "success": True,
        "message": "Note supprimée avec succès"
    }
