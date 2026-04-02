"""
StripeClient — thin adapter over the Stripe Python SDK.

All stripe.api_key assignments and direct SDK calls go through this class.
Benefits:
- API key set once at construction (not scattered across route functions)
- Single mock point in tests
- Consistent error surface
"""
import stripe
import logging
from typing import Optional

logger = logging.getLogger(__name__)


class StripeClient:
    """
    Thin wrapper around the Stripe Python SDK.
    Sets stripe.api_key once at construction; exposes one method per SDK operation.
    """

    def __init__(self, api_key: str):
        stripe.api_key = api_key

    # ─── Webhook ──────────────────────────────────────────────────────────────

    def construct_event(self, payload: bytes, sig_header: str, webhook_secret: str) -> stripe.Event:
        """Validate signature and deserialize a webhook payload."""
        return stripe.Webhook.construct_event(payload, sig_header, webhook_secret)

    # ─── Customer ─────────────────────────────────────────────────────────────

    def retrieve_customer(self, customer_id: str) -> stripe.Customer:
        return stripe.Customer.retrieve(customer_id)

    def create_customer(self, email: str, name: str, metadata: Optional[dict] = None) -> stripe.Customer:
        return stripe.Customer.create(email=email, name=name, metadata=metadata or {})

    # ─── Subscription ─────────────────────────────────────────────────────────

    def retrieve_subscription(self, subscription_id: str) -> stripe.Subscription:
        return stripe.Subscription.retrieve(subscription_id)

    def modify_subscription(self, subscription_id: str, **kwargs) -> stripe.Subscription:
        return stripe.Subscription.modify(subscription_id, **kwargs)

    def delete_subscription(self, subscription_id: str) -> stripe.Subscription:
        return stripe.Subscription.delete(subscription_id)

    # ─── SubscriptionItem ─────────────────────────────────────────────────────

    def modify_subscription_item(
        self,
        item_id: str,
        quantity: int,
        proration_behavior: str = 'create_prorations',
    ) -> stripe.SubscriptionItem:
        return stripe.SubscriptionItem.modify(
            item_id,
            quantity=quantity,
            proration_behavior=proration_behavior,
        )

    # ─── Billing Portal ───────────────────────────────────────────────────────

    def create_billing_portal_session(
        self, customer_id: str, return_url: str
    ) -> stripe.billing_portal.Session:
        return stripe.billing_portal.Session.create(
            customer=customer_id,
            return_url=return_url,
        )

    # ─── Checkout ─────────────────────────────────────────────────────────────

    def create_checkout_session(self, **kwargs) -> stripe.checkout.Session:
        return stripe.checkout.Session.create(**kwargs)

    # ─── Invoice ──────────────────────────────────────────────────────────────

    def upcoming_invoice(self, subscription_id: str) -> dict:
        return stripe.Invoice.upcoming(subscription=subscription_id)

    def create_invoice_preview(
        self,
        customer_id: str,
        subscription_id: str,
        subscription_details: dict,
    ) -> stripe.Invoice:
        return stripe.Invoice.create_preview(
            customer=customer_id,
            subscription=subscription_id,
            subscription_details=subscription_details,
        )
