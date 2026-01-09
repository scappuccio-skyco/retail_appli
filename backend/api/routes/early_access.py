"""
Early Access / Programme Pilote Routes
Gestion des candidatures au programme Early Adopter
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr
from typing import Optional
import logging

# Import email_service (located in backend root)
import sys
import os
backend_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if backend_root not in sys.path:
    sys.path.insert(0, backend_root)
from email_service import send_early_access_qualification_email

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/early-access", tags=["Early Access"])


class EarlyAccessQualifyRequest(BaseModel):
    """Modèle pour la candidature Early Access"""
    full_name: str
    email: EmailStr
    enseigne: str
    nombre_vendeurs: int
    defi_principal: str


@router.post("/qualify")
async def qualify_early_access(request: EarlyAccessQualifyRequest):
    """
    Enregistre une candidature au programme Early Adopter et envoie un email
    
    Args:
        request: Données de la candidature
        
    Returns:
        Confirmation de l'envoi
    """
    try:
        # Envoyer l'email de notification
        email_sent = send_early_access_qualification_email(
            full_name=request.full_name,
            email=request.email,
            enseigne=request.enseigne,
            nombre_vendeurs=request.nombre_vendeurs,
            defi_principal=request.defi_principal
        )
        
        if not email_sent:
            logger.warning(f"Failed to send early access email for {request.email}")
            # On continue quand même, l'email peut être envoyé plus tard
        
        return {
            "success": True,
            "message": "Votre candidature a été enregistrée avec succès",
            "email_sent": email_sent
        }
        
    except Exception as e:
        logger.error(f"Error processing early access qualification: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="Erreur lors de l'enregistrement de votre candidature. Veuillez réessayer."
        )
