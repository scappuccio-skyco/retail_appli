"""
Support Routes
Generic support contact for all user roles (gérant, manager, seller)
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
import httpx
import logging

from core.security import get_current_user
from core.config import settings
from api.dependencies import get_db
from repositories.store_repository import WorkspaceRepository, StoreRepository

router = APIRouter(prefix="/support", tags=["Support"])
logger = logging.getLogger(__name__)


class SupportMessageRequest(BaseModel):
    subject: str
    message: str
    category: str = "general"


class SupportMessageResponse(BaseModel):
    success: bool
    message: str


@router.post("/contact", response_model=SupportMessageResponse)
async def send_support_message(
    request: SupportMessageRequest,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """
    Send a support message from any authenticated user to the support team.
    Works for gérant, manager, and seller roles.
    The message is sent via Brevo to hello@retailperformerai.com
    """
    try:
        # Validate input
        if not request.subject.strip():
            raise HTTPException(status_code=400, detail="Le sujet est requis")
        if not request.message.strip():
            raise HTTPException(status_code=400, detail="Le message est requis")
        if len(request.message) > 5000:
            raise HTTPException(status_code=400, detail="Le message est trop long (max 5000 caractères)")
        
        # Get user info
        user_email = current_user.get('email', 'inconnu')
        user_name = current_user.get('name', 'Utilisateur')
        user_id = current_user.get('id', 'N/A')
        user_role = current_user.get('role', 'N/A')
        store_id = current_user.get('store_id')
        
        # Get store/workspace info based on role
        context_info = "N/A"
        workspace_repo = WorkspaceRepository(db)
        store_repo = StoreRepository(db)
        if user_role == 'gerant' or user_role == 'gérant':
            workspace = await workspace_repo.find_by_id(current_user.get('workspace_id'))
            context_info = workspace.get('name', 'N/A') if workspace else 'N/A'
        elif store_id:
            store = await store_repo.find_by_id(store_id, None, {"_id": 0, "name": 1})
            context_info = store.get('name', 'N/A') if store else 'N/A'
        
        # Role labels
        role_labels = {
            "gerant": "👔 Gérant",
            "gérant": "👔 Gérant",
            "manager": "👥 Manager",
            "seller": "🛍️ Vendeur"
        }
        role_label = role_labels.get(user_role, user_role)
        
        # Category labels
        category_labels = {
            "general": "Question générale",
            "bug": "🐛 Bug / Problème technique",
            "feature": "💡 Suggestion / Nouvelle fonctionnalité",
            "billing": "💳 Facturation / Abonnement"
        }
        category_label = category_labels.get(request.category, "Question générale")
        
        # Build email content
        html_content = f"""
        <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background: linear-gradient(135deg, #10b981, #059669); padding: 20px; border-radius: 10px 10px 0 0;">
                    <h1 style="color: white; margin: 0;">📬 Nouveau message support</h1>
                </div>
                
                <div style="background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb;">
                    <h2 style="color: #1f2937; border-bottom: 2px solid #10b981; padding-bottom: 10px;">
                        {category_label}
                    </h2>
                    
                    <table style="width: 100%; margin-bottom: 20px;">
                        <tr>
                            <td style="padding: 8px 0; color: #6b7280; width: 120px;">👤 Expéditeur:</td>
                            <td style="padding: 8px 0; font-weight: bold;">{user_name}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0; color: #6b7280;">📧 Email:</td>
                            <td style="padding: 8px 0;"><a href="mailto:{user_email}">{user_email}</a></td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0; color: #6b7280;">🎭 Rôle:</td>
                            <td style="padding: 8px 0;">{role_label}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0; color: #6b7280;">🏢 Contexte:</td>
                            <td style="padding: 8px 0;">{context_info}</td>
                        </tr>
                    </table>
                    
                    <div style="background: white; padding: 15px; border-radius: 8px; border-left: 4px solid #10b981;">
                        <h3 style="color: #374151; margin-top: 0;">📝 Sujet: {request.subject}</h3>
                        <div style="white-space: pre-wrap; color: #4b5563;">{request.message}</div>
                    </div>
                </div>
                
                <div style="background: #1f2937; color: #9ca3af; padding: 15px; border-radius: 0 0 10px 10px; font-size: 12px;">
                    <p style="margin: 0;">ID Utilisateur: {user_id}</p>
                    <p style="margin: 5px 0 0 0;">Envoyé depuis Retail Performer AI - Espace {role_label}</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        # Get Brevo API key
        brevo_api_key = settings.BREVO_API_KEY
        if not brevo_api_key:
            logger.error("BREVO_API_KEY not configured")
            raise HTTPException(status_code=500, detail="Service email non configuré")
        
        # Send email via Brevo
        payload = {
            "sender": {
                "name": f"Support - {user_name}",
                "email": "noreply@retailperformerai.com"
            },
            "to": [
                {"email": "hello@retailperformerai.com", "name": "Support Retail Performer"}
            ],
            "replyTo": {
                "email": user_email,
                "name": user_name
            },
            "subject": f"[{role_label}] [{category_label}] {request.subject}",
            "htmlContent": html_content
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.brevo.com/v3/smtp/email",
                headers={
                    "api-key": brevo_api_key,
                    "Content-Type": "application/json"
                },
                json=payload
            )
            
            if response.status_code in [200, 201]:
                logger.info(f"✅ Support message sent from {user_email} ({role_label}): {request.subject}")
                return SupportMessageResponse(
                    success=True,
                    message="Votre message a été envoyé avec succès. Nous vous répondrons dans les plus brefs délais."
                )
            else:
                logger.error(f"❌ Brevo API error ({response.status_code}): {response.text}")
                raise HTTPException(status_code=500, detail="Erreur lors de l'envoi du message")
                
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error sending support message: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
