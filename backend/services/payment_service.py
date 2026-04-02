"""Payment Service
Business logic for Stripe payment processing and webhook handling.
Phase 12: repositories only (no direct db in services).

Split en mixins :
- _invoice_webhook_mixin.py   : invoice.payment_succeeded / invoice.payment_failed
- _subscription_webhook_mixin.py : customer.subscription.* + checkout.session.completed
- _seats_mixin.py             : update_subscription_seats
"""
import os
import logging
import stripe
from typing import Dict

from repositories.user_repository import UserRepository
from repositories.subscription_repository import SubscriptionRepository
from repositories.store_repository import WorkspaceRepository
from repositories.stripe_event_repository import StripeEventRepository
from repositories.payment_transaction_repository import PaymentTransactionRepository

from services._invoice_webhook_mixin import InvoiceWebhookMixin
from services._subscription_webhook_mixin import SubscriptionWebhookMixin
from services._seats_mixin import SeatsMixin

logger = logging.getLogger(__name__)


class PaymentService(InvoiceWebhookMixin, SubscriptionWebhookMixin, SeatsMixin):
    """Service for handling Stripe payments and subscriptions (repositories only)."""

    def __init__(self, db, stripe_client=None):
        self.user_repo = UserRepository(db)
        self.subscription_repo = SubscriptionRepository(db)
        self.workspace_repo = WorkspaceRepository(db)
        self.stripe_event_repo = StripeEventRepository(db)
        self.payment_transaction_repo = PaymentTransactionRepository(db)
        if stripe_client is not None:
            self.stripe = stripe_client
        else:
            from services.stripe_client import StripeClient
            self.stripe = StripeClient(api_key=os.environ.get("STRIPE_API_KEY") or "")

    # ==========================================
    # WEBHOOK EVENT DISPATCHER
    # ==========================================

    async def handle_webhook_event(self, event: stripe.Event) -> Dict:
        """
        Main webhook event dispatcher.
        Routes events to specific handlers (defined in mixins).

        Args:
            event: Validated Stripe event object

        Returns:
            Dict with processing result
        """
        event_type = event['type']
        data = event['data']['object']
        event_id = event.get('id')
        event_created = event.get('created')  # Unix timestamp

        logger.info(f"📥 Processing Stripe webhook: {event_type} (id={event_id}, created={event_created})")

        # Idempotence : vérifier si l'événement a déjà été traité (survit aux redémarrages)
        if event_id and await self.stripe_event_repo.exists(event_id):
            logger.info(f"⏭️ Duplicate webhook ignored: {event_type} (id={event_id})")
            return {"status": "already_processed", "event_id": event_id}

        # Inject event metadata into data object for handlers (for ordering protection)
        data['_event_id'] = event_id
        data['_event_created'] = event_created

        handlers = {
            'invoice.payment_succeeded': self._handle_payment_succeeded,
            'invoice.payment_failed': self._handle_payment_failed,
            'customer.subscription.created': self._handle_subscription_created,
            'customer.subscription.updated': self._handle_subscription_updated,
            'customer.subscription.deleted': self._handle_subscription_deleted,
            'customer.subscription.trial_will_end': self._handle_trial_will_end,
            'checkout.session.completed': self._handle_checkout_completed,
        }

        handler = handlers.get(event_type)
        if handler:
            result = await handler(data)
        else:
            logger.info(f"⏭️ Unhandled event type: {event_type}")
            result = {"status": "ignored", "event_type": event_type}

        # Persister l'événement traité pour l'idempotence future
        if event_id:
            try:
                await self.stripe_event_repo.mark_processed(event_id, event_type, event_created or 0)
            except Exception as e:
                logger.warning(f"Could not persist Stripe event {event_id}: {e}")

        return result
