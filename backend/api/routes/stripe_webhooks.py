"""Stripe Webhook Routes
Secure endpoint for receiving Stripe webhook events.
Follows Clean Architecture: Controller → Service.
RC6: DI for PaymentService, BackgroundTasks for async processing (return 200 immediately).
"""
import stripe
import os
import logging
from fastapi import APIRouter, Request, Depends, BackgroundTasks
from fastapi.responses import JSONResponse

from core.exceptions import ValidationError
from services.payment_service import PaymentService
from api.dependencies import get_payment_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/webhooks", tags=["Webhooks"])


async def _process_webhook_event(payment_service: PaymentService, event: dict) -> None:
    """Process Stripe webhook event in background (RC6)."""
    try:
        result = await payment_service.handle_webhook_event(event)
        logger.info(f"✅ Webhook processed: {event['type']} → {result.get('status')}")
    except Exception as e:
        logger.error(f"❌ Error processing webhook in background: {str(e)}", exc_info=True)


@router.post("/stripe")
async def stripe_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    payment_service: PaymentService = Depends(get_payment_service),
):
    """
    Stripe Webhook Endpoint.
    
    RC6: Returns 200 immediately, processes event in background to avoid Stripe timeout.
    Security: Validates webhook signature using STRIPE_WEBHOOK_SECRET.
    Handles: invoice.payment_*, customer.subscription.*, checkout.session.completed.
    """
    payload = await request.body()
    sig_header = request.headers.get('stripe-signature')
    webhook_secret = os.environ.get('STRIPE_WEBHOOK_SECRET')

    if not webhook_secret:
        logger.error("❌ STRIPE_WEBHOOK_SECRET not configured")
        return JSONResponse(
            status_code=200,
            content={"status": "webhook_secret_not_configured"}
        )

    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, webhook_secret
        )
    except ValueError as e:
        logger.error(f"❌ Invalid webhook payload: {str(e)}")
        raise ValidationError("Invalid payload")
    except stripe.error.SignatureVerificationError as e:
        logger.error(f"❌ Invalid webhook signature: {str(e)}")
        raise ValidationError("Invalid signature")

    logger.info(f"📥 Stripe webhook received: {event['type']}")

    # RC6: Return 200 immediately, process in background
    background_tasks.add_task(_process_webhook_event, payment_service, event)
    return JSONResponse(
        status_code=200,
        content={"received": True, "type": event["type"]}
    )


@router.get("/stripe/health")
async def webhook_health():
    """Health check for webhook endpoint"""
    webhook_secret = os.environ.get('STRIPE_WEBHOOK_SECRET')
    stripe_key = os.environ.get('STRIPE_API_KEY')
    
    return {
        "status": "ok",
        "webhook_secret_configured": bool(webhook_secret),
        "stripe_key_configured": bool(stripe_key)
    }
