"""
Gérant miscellaneous routes: dashboard/stats, invoices, support/contact, maintenance/*.
"""
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from typing import Dict, Optional
import stripe
import logging

from core.exceptions import AppException, ValidationError
from core.security import get_current_gerant
from core.config import settings
from services.gerant_service import GerantService
from api.dependencies import get_gerant_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="", tags=["Gérant"])


@router.get("/dashboard/stats")
async def get_dashboard_stats(
    current_user: dict = Depends(get_current_gerant),
    gerant_service: GerantService = Depends(get_gerant_service)
):
    """
    Get global statistics for gérant dashboard (all stores aggregated)

    Returns:
        Dict with total stores, managers, sellers, and monthly KPI aggregations
    """
    stats = await gerant_service.get_dashboard_stats(current_user['id'])
    return stats


@router.get("/invoices")
async def get_invoices(
    current_user: dict = Depends(get_current_gerant),
    limit: int = Query(24, ge=1, le=100),
    starting_after: Optional[str] = None,
):
    """
    Fetch the gérant's Stripe invoices (most recent first).
    Returns a paginated list with download links and status.
    """
    if not settings.STRIPE_API_KEY:
        raise ValidationError("Stripe n'est pas configuré")

    stripe_customer_id = current_user.get('stripe_customer_id')
    if not stripe_customer_id:
        return {"invoices": [], "has_more": False}

    stripe.api_key = settings.STRIPE_API_KEY
    try:
        params = {
            "customer": stripe_customer_id,
            "limit": limit,
            "expand": ["data.subscription"],
        }
        if starting_after:
            params["starting_after"] = starting_after

        result = stripe.Invoice.list(**params)

        invoices = []
        for inv in result.data:
            # Determine plan display name from subscription metadata
            plan_key = None
            sub = inv.get("subscription")
            if sub and hasattr(sub, "metadata"):
                plan_key = sub.metadata.get("plan")
            if not plan_key and sub and hasattr(sub, "items") and sub.items.data:
                qty = sub.items.data[0].get("quantity", 1)
                plan_key = "enterprise" if qty >= 16 else ("professional" if qty >= 6 else "starter")
            plan_names = {"starter": "Small Team", "professional": "Medium Team", "enterprise": "Large Team"}
            plan_label = plan_names.get(plan_key, "") if plan_key else ""

            invoices.append({
                "id": inv.id,
                "number": inv.number,
                "status": inv.status,                          # draft, open, paid, void, uncollectible
                "amount_paid": inv.amount_paid / 100,
                "amount_due": inv.amount_due / 100,
                "currency": inv.currency.upper(),
                "created": inv.created,                        # Unix timestamp
                "period_start": inv.period_start,
                "period_end": inv.period_end,
                "pdf_url": inv.invoice_pdf,
                "hosted_url": inv.hosted_invoice_url,
                "billing_reason": inv.billing_reason,          # subscription_create / subscription_cycle
                "plan": plan_label,
            })

        return {"invoices": invoices, "has_more": result.has_more}

    except stripe.error.InvalidRequestError as e:
        raise ValidationError(f"Impossible de récupérer les factures : {str(e)}")


# === SUPPORT CONTACT ===

class SupportMessageRequest(BaseModel):
    subject: str
    message: str
    category: str = "general"  # general, bug, feature, billing

class SupportMessageResponse(BaseModel):
    success: bool
    message: str

@router.post("/support/contact", response_model=SupportMessageResponse)
async def send_support_message(
    request: SupportMessageRequest,
    current_user: dict = Depends(get_current_gerant),
    gerant_service: GerantService = Depends(get_gerant_service),
):
    """
    Send a support message from the gérant to the support team.
    The message is sent via Brevo to hello@retailperformerai.com
    """
    import httpx

    try:
        # Validate input
        if not request.subject.strip():
            raise ValidationError("Le sujet est requis")
        if not request.message.strip():
            raise ValidationError("Le message est requis")
        if len(request.message) > 5000:
            raise ValidationError("Le message est trop long (max 5000 caractères)")

        # Get user info
        user_email = current_user.get('email', 'inconnu')
        user_name = current_user.get('name', 'Gérant')
        user_id = current_user.get('id', 'N/A')

        workspace_id = current_user.get('workspace_id')
        workspace = await gerant_service.get_workspace_by_id(workspace_id) if workspace_id else None
        workspace_name = workspace.get('name', 'N/A') if workspace else 'N/A'

        subscription = await gerant_service.get_subscription_by_user(user_id)
        sub_info = f"{subscription.get('plan', 'N/A')} - {subscription.get('status', 'N/A')} ({subscription.get('seats', 0)} sièges)" if subscription else "Aucun"

        # Category labels
        category_labels = {
            "general": "Question générale",
            "bug": "Bug / Problème technique",
            "feature": "Suggestion / Nouvelle fonctionnalité",
            "billing": "Facturation / Abonnement"
        }
        category_label = category_labels.get(request.category, "Question générale")

        # Build email content
        html_content = f"""
        <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background: linear-gradient(135deg, #f97316, #ea580c); padding: 20px; border-radius: 10px 10px 0 0;">
                    <h1 style="color: white; margin: 0;">Nouveau message support</h1>
                </div>

                <div style="background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb;">
                    <h2 style="color: #1f2937; border-bottom: 2px solid #f97316; padding-bottom: 10px;">
                        {category_label}
                    </h2>

                    <table style="width: 100%; margin-bottom: 20px;">
                        <tr>
                            <td style="padding: 8px 0; color: #6b7280; width: 120px;">Expediteur:</td>
                            <td style="padding: 8px 0; font-weight: bold;">{user_name}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0; color: #6b7280;">Email:</td>
                            <td style="padding: 8px 0;"><a href="mailto:{user_email}">{user_email}</a></td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0; color: #6b7280;">Enseigne:</td>
                            <td style="padding: 8px 0;">{workspace_name}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0; color: #6b7280;">Abonnement:</td>
                            <td style="padding: 8px 0;">{sub_info}</td>
                        </tr>
                    </table>

                    <div style="background: white; padding: 15px; border-radius: 8px; border-left: 4px solid #f97316;">
                        <h3 style="color: #374151; margin-top: 0;">Sujet: {request.subject}</h3>
                        <div style="white-space: pre-wrap; color: #4b5563;">{request.message}</div>
                    </div>
                </div>

                <div style="background: #1f2937; color: #9ca3af; padding: 15px; border-radius: 0 0 10px 10px; font-size: 12px;">
                    <p style="margin: 0;">ID Utilisateur: {user_id}</p>
                    <p style="margin: 5px 0 0 0;">Envoyé depuis Retail Performer AI - Dashboard Gérant</p>
                </div>
            </div>
        </body>
        </html>
        """

        # Get Brevo API key
        brevo_api_key = settings.BREVO_API_KEY
        if not brevo_api_key:
            logger.error("BREVO_API_KEY not configured")
            raise ValidationError("Service email non configuré")

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
            "subject": f"[{category_label}] {request.subject}",
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
                logger.info("Support message sent successfully (user_id from token)")
                return SupportMessageResponse(
                    success=True,
                    message="Votre message a été envoyé avec succès. Nous vous répondrons dans les plus brefs délais."
                )
            else:
                logger.error("Brevo API error (status %s)", response.status_code)
                raise ValidationError("Erreur lors de l'envoi du message")

    except AppException:
        raise


# ===== MAINTENANCE (GERANT) =====

@router.post("/maintenance/anonymize-inactive-emails")
async def anonymize_inactive_emails(
    current_user: Dict = Depends(get_current_gerant),
    gerant_service: GerantService = Depends(get_gerant_service),
):
    """Anonymize emails for inactive/deleted users and non-pending invitations of this gérant.

    Purpose: free up emails for reuse while keeping historical records.
    """
    return await gerant_service.anonymize_inactive_emails(current_user["id"])


@router.get("/maintenance/email-owner")
async def get_email_owner(
    email: str,
    current_user: Dict = Depends(get_current_gerant),
    gerant_service: GerantService = Depends(get_gerant_service),
):
    """Return which user currently owns an email (within this gérant scope)."""
    return await gerant_service.find_user_by_email_scoped(current_user["id"], email)


@router.post("/maintenance/free-email")
async def free_email(
    email: str,
    current_user: Dict = Depends(get_current_gerant),
    gerant_service: GerantService = Depends(get_gerant_service),
):
    """Soft-delete + anonymize the user that owns `email` (within gérant scope)."""
    return await gerant_service.free_email(current_user["id"], email)
