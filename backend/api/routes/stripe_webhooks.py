"""Stripe Webhook Routes
Secure endpoint for receiving Stripe webhook events.
Follows Clean Architecture: Controller → Service
"""
import stripe
import os
import logging
from fastapi import APIRouter, Request, HTTPException, Depends
from fastapi.responses import JSONResponse

from services.payment_service import PaymentService
from api.dependencies import get_db

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/webhooks", tags=["Webhooks"])


@router.post("/stripe")
async def stripe_webhook(request: Request, db=Depends(get_db)):
    """
    Stripe Webhook Endpoint
    
    Security:
    - Validates webhook signature using STRIPE_WEBHOOK_SECRET
    - Returns 400 if signature is invalid
    - Returns 200 quickly to avoid Stripe timeout
    
    Handles events:
    - invoice.payment_succeeded
    - invoice.payment_failed
    - customer.subscription.created
    - customer.subscription.updated
    - customer.subscription.deleted
    - checkout.session.completed
    """
    # Get raw body and signature header
    payload = await request.body()
    sig_header = request.headers.get('stripe-signature')
    
    # Get webhook secret from environment
    webhook_secret = os.environ.get('STRIPE_WEBHOOK_SECRET')
    
    if not webhook_secret:
        logger.error("❌ STRIPE_WEBHOOK_SECRET not configured")
        # Still return 200 to avoid Stripe retries in dev mode
        return JSONResponse(
            status_code=200,
            content={"status": "webhook_secret_not_configured"}
        )
    
    # Validate signature
    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, webhook_secret
        )
    except ValueError as e:
        # Invalid payload
        logger.error(f"❌ Invalid webhook payload: {str(e)}")
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.error.SignatureVerificationError as e:
        # Invalid signature
        logger.error(f"❌ Invalid webhook signature: {str(e)}")
        raise HTTPException(status_code=400, detail="Invalid signature")
    
    # Log the event type
    logger.info(f"📥 Stripe webhook received: {event['type']}")
    
    # IMPORTANT: Return 200 quickly, then process
    # For production, use background task (Celery, etc.)
    # For now, process synchronously but fast
    
    try:
        # Initialize payment service
        payment_service = PaymentService(db)
        
        # Process the event
        result = await payment_service.handle_webhook_event(event)
        
        logger.info(f"✅ Webhook processed: {event['type']} → {result.get('status')}")
        
        return JSONResponse(
            status_code=200,
            content={"received": True, "type": event['type'], "result": result}
        )
        
    except Exception as e:
        # Log error but still return 200 to prevent Stripe retries
        # In production, you'd want to queue for retry
        logger.error(f"❌ Error processing webhook: {str(e)}")
        return JSONResponse(
            status_code=200,
            content={"received": True, "type": event['type'], "error": str(e)}
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
