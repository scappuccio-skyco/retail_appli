"""Payment Service
Business logic for Stripe payment processing and webhook handling.
Phase 12: repositories only (no direct db in services).
"""
import asyncio
import stripe
import os
import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, Optional

from core.constants import (
    PRICE_PER_SEAT_STARTER, PRICE_PER_SEAT_PROFESSIONAL,
    SEATS_THRESHOLD_PROFESSIONAL,
)
from repositories.user_repository import UserRepository
from repositories.subscription_repository import SubscriptionRepository
from repositories.store_repository import WorkspaceRepository
from repositories.stripe_event_repository import StripeEventRepository
from repositories.payment_transaction_repository import PaymentTransactionRepository
from email_service import (
    send_payment_confirmation_email,
    send_payment_failed_email,
    send_subscription_canceled_email,
    send_trial_ending_email,
)

logger = logging.getLogger(__name__)


class PaymentService:
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
    # WEBHOOK EVENT HANDLERS
    # ==========================================
    
    async def handle_webhook_event(self, event: stripe.Event) -> Dict:
        """
        Main webhook event dispatcher.
        Routes events to specific handlers.
        
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
    
    async def _handle_payment_succeeded(self, invoice: Dict) -> Dict:
        """
        Handle successful payment.
        Updates subscription status and period end date.
        """
        customer_id = invoice.get('customer')
        subscription_id = invoice.get('subscription')
        
        if not customer_id:
            logger.warning("Payment succeeded but no customer_id")
            return {"status": "skipped", "reason": "no_customer"}
        
        gerant = await self.user_repo.find_by_stripe_customer_id(customer_id)
        if not gerant:
            logger.warning(f"Payment succeeded but customer {customer_id} not found in DB")
            return {"status": "skipped", "reason": "customer_not_found"}
        
        # Calculate new period end (1 month from now)
        period_end = datetime.now(timezone.utc) + timedelta(days=30)
        
        # Update subscription in database
        update_data = {
            "status": "active",
            "current_period_end": period_end.isoformat(),
            "last_payment_date": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        # 🔴 RÈGLE ABSOLUE: Utiliser stripe_subscription_id si disponible, jamais user_id pour upsert
        if subscription_id:
            update_data["stripe_subscription_id"] = subscription_id
            await self.subscription_repo.upsert_by_stripe_subscription(subscription_id, update_data)
        else:
            # ⚠️ Pas de stripe_subscription_id: update simple (pas d'upsert) par user_id
            # Ce cas ne devrait pas arriver en production normale
            logger.warning(
                f"⚠️ Payment succeeded but no subscription_id for customer {customer_id}. "
                f"Using fallback update by user_id. "
                f"workspace_id: {gerant.get('workspace_id')}, "
                f"gerant_id: {gerant['id']}"
            )
            await self.subscription_repo.update_by_user(gerant["id"], update_data)
        if gerant.get("workspace_id"):
            await self.workspace_repo.update_by_id(
                gerant["workspace_id"],
                {"subscription_status": "active", "stripe_subscription_id": subscription_id},
            )
        logger.info(f"✅ Payment succeeded for {gerant['email']} - subscription active until {period_end}")

        # Record payment transaction
        try:
            import uuid as _uuid
            transaction = {
                "id": str(_uuid.uuid4()),
                "gerant_id": gerant["id"],
                "stripe_customer_id": customer_id,
                "stripe_subscription_id": subscription_id,
                "stripe_invoice_id": invoice.get("id"),
                "amount_eur": invoice.get("amount_paid", invoice.get("amount_due", 0)) / 100,
                "currency": invoice.get("currency", "eur"),
                "status": "succeeded",
                "billing_reason": invoice.get("billing_reason", "subscription_cycle"),
                "invoice_url": invoice.get("hosted_invoice_url"),
                "period_end": period_end.isoformat(),
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            await self.payment_transaction_repo.insert_one(transaction)
            logger.info(f"💳 Payment transaction recorded for {gerant['email']}")
        except Exception as e:
            logger.error(f"Failed to record payment transaction: {e}")

        # Send payment confirmation email
        try:
            # Fetch plan from subscription record
            plan_key = 'starter'
            if subscription_id:
                sub_record = await self.subscription_repo.find_by_stripe_subscription(subscription_id)
                if sub_record:
                    plan_key = sub_record.get('plan', 'starter')
            amount_eur = invoice.get('amount_paid', invoice.get('amount_due', 0)) / 100
            billing_reason = invoice.get('billing_reason', 'subscription_cycle')
            invoice_url = invoice.get('hosted_invoice_url')
            # Fire-and-forget: email envoyé en background pour ne pas bloquer le webhook
            _email, _name, _eur, _period, _plan, _reason, _url = (
                gerant['email'], gerant.get('name', gerant['email']),
                amount_eur, period_end.isoformat(), plan_key, billing_reason, invoice_url,
            )
            asyncio.create_task(asyncio.to_thread(
                lambda: send_payment_confirmation_email(
                    recipient_email=_email, recipient_name=_name,
                    amount_eur=_eur, period_end_date=_period,
                    plan_key=_plan, billing_reason=_reason, invoice_url=_url,
                )
            ))
        except Exception as e:
            logger.error(f"Failed to send payment confirmation email to {gerant['email']}: {e}")

        return {"status": "success", "user_id": gerant['id'], "period_end": period_end.isoformat()}
    
    async def _handle_payment_failed(self, invoice: Dict) -> Dict:
        """
        Handle failed payment.
        
        Actions:
        - Updates subscription status to 'past_due'
        - Updates workspace status
        - Records payment failure details for debugging
        - (Future: Send notification email to customer)
        
        Note: Stripe will automatically retry payments according to your
        Billing settings. This handler just tracks the state in our DB.
        """
        customer_id = invoice.get('customer')
        subscription_id = invoice.get('subscription')
        
        if not customer_id:
            logger.warning("Payment failed event received without customer_id")
            return {"status": "skipped", "reason": "no_customer"}
        
        gerant = await self.user_repo.find_by_stripe_customer_id(customer_id)
        if not gerant:
            logger.warning(f"Payment failed for unknown customer: {customer_id}")
            return {"status": "skipped", "reason": "customer_not_found"}
        
        # Extract failure details from invoice
        attempt_count = invoice.get('attempt_count', 1)
        amount_due = invoice.get('amount_due', 0) / 100  # Convert cents to euros
        next_payment_attempt = invoice.get('next_payment_attempt')
        
        # Update subscription status to past_due
        update_data = {
            "status": "past_due",
            "last_payment_failed_at": datetime.now(timezone.utc).isoformat(),
            "payment_failure_count": attempt_count,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        if next_payment_attempt:
            update_data["next_payment_retry"] = datetime.fromtimestamp(
                next_payment_attempt, tz=timezone.utc
            ).isoformat()
        
        # 🔴 INTERDIT: Ne jamais upsert par user_id
        # Cette fonction est pour invoice.payment_failed, pas pour subscription webhooks
        # On fait un update simple (pas d'upsert) car on n'a pas de stripe_subscription_id ici
        logger.warning(
            f"⚠️ Payment failed - using fallback update by user_id. "
            f"workspace_id: {gerant.get('workspace_id')}, "
            f"gerant_id: {gerant['id']}, "
            f"subscription_id: {subscription_id or 'N/A'}"
        )
        await self.subscription_repo.update_by_user(gerant["id"], update_data)
        if gerant.get("workspace_id"):
            await self.workspace_repo.update_by_id(gerant["workspace_id"], {"subscription_status": "past_due"})
        
        # Log detailed failure info
        logger.warning(
            f"⚠️ Payment FAILED for {gerant['email']} - "
            f"Amount: {amount_due}€, Attempt #{attempt_count}, "
            f"Subscription: {subscription_id}, Status: past_due"
        )

        # Send payment failed email
        try:
            next_retry_iso = None
            if next_payment_attempt:
                next_retry_iso = datetime.fromtimestamp(next_payment_attempt, tz=timezone.utc).isoformat()
            _email, _name, _eur, _attempts, _retry = (
                gerant['email'], gerant.get('name', gerant['email']),
                amount_due, attempt_count, next_retry_iso,
            )
            asyncio.create_task(asyncio.to_thread(
                lambda: send_payment_failed_email(
                    recipient_email=_email, recipient_name=_name,
                    amount_eur=_eur, attempt_count=_attempts, next_retry_date=_retry,
                )
            ))
        except Exception as e:
            logger.error(f"Failed to send payment failed email to {gerant['email']}: {e}")

        return {
            "status": "success",
            "user_id": gerant['id'],
            "new_status": "past_due",
            "amount_due": amount_due,
            "attempt_count": attempt_count
        }
    
    async def _handle_subscription_created(self, subscription: Dict) -> Dict:
        """
        Handle new subscription creation.
        
        RULES:
        - NEVER cancel other subscriptions automatically without proof of causality
        - Only cancel if metadata/correlation proves it's a duplicate from our checkout
        - Otherwise: sync state, log anomaly, mark has_multiple_active=true
        - Use stripe_subscription_id as unique key for idempotence
        - Protect against out-of-order events with last_event_id
        """
        customer_id = subscription.get('customer')
        subscription_id = subscription.get('id')
        status = subscription.get('status')
        # Use event metadata if available (from webhook), otherwise use subscription.created
        event_created = subscription.get('_event_created') or subscription.get('created')  # Unix timestamp
        event_id = subscription.get('_event_id', '')  # If available from webhook
        
        gerant = await self.user_repo.find_by_stripe_customer_id(customer_id)
        if not gerant:
            return {"status": "skipped", "reason": "customer_not_found"}
        existing_sub = await self.subscription_repo.find_by_stripe_subscription(subscription_id)
        
        if existing_sub:
            last_event_id = existing_sub.get('last_event_id')
            last_event_created = existing_sub.get('last_event_created')
            
            # ✅ ULTRA-SAFE: Check event.id first (true unique key)
            if event_id and last_event_id and event_id == last_event_id:
                logger.info(
                    f"⏭️ IDEMPOTENT: Ignoring duplicate event {event_id} for {subscription_id}"
                )
                return {
                    "status": "skipped",
                    "reason": "duplicate_event_id",
                    "event_id": event_id
                }
            
            # ✅ Check event.created (with fallback to event.id comparison if equal)
            if last_event_created and event_created:
                if event_created < last_event_created:
                    logger.warning(
                        f"⚠️ OUT-OF-ORDER EVENT: Ignoring older subscription.created event "
                        f"for {subscription_id} (event_created={event_created}, last={last_event_created})"
                    )
                    return {
                        "status": "skipped",
                        "reason": "out_of_order_event",
                        "event_created": event_created,
                        "last_event_created": last_event_created
                    }
                elif event_created == last_event_created and event_id and last_event_id:
                    # Same timestamp: use event.id lexicographic comparison
                    if event_id <= last_event_id:
                        logger.warning(
                            f"⚠️ OUT-OF-ORDER EVENT: Ignoring event with same timestamp but older/equal id "
                            f"for {subscription_id} (event_id={event_id}, last={last_event_id})"
                        )
                        return {
                            "status": "skipped",
                            "reason": "out_of_order_event_same_timestamp",
                            "event_id": event_id,
                            "last_event_id": last_event_id
                        }
        
        existing_active = await self.subscription_repo.find_many_with_query(
            {
                "user_id": gerant["id"],
                "status": {"$in": ["active", "trialing"]},
                "stripe_subscription_id": {"$ne": subscription_id},
            },
            limit=10,
        )
        
        has_multiple_active = len(existing_active) > 0
        
        # Extract metadata for correlation (proof of causality)
        # ✅ CRITICAL: Metadata MUST be on subscription (not just session)
        # Stripe propagates subscription_data.metadata to subscription.metadata
        subscription_metadata = subscription.get('metadata', {})
        checkout_session_id = subscription_metadata.get('checkout_session_id')
        correlation_id = subscription_metadata.get('correlation_id')
        source = subscription_metadata.get('source', 'unknown')
        price_id = subscription_metadata.get('price_id')
        workspace_id_from_metadata = subscription_metadata.get('workspace_id')
        
        # ✅ VALIDATION: Verify metadata is present (critical for correlation)
        if not checkout_session_id and source == 'app_checkout':
            logger.warning(
                f"⚠️ WARNING: Subscription {subscription_id} from app_checkout but no checkout_session_id in metadata. "
                f"Metadata present: {list(subscription_metadata.keys())}"
            )
        
        # 🔴 ZÉRO ANNULATION RISQUÉE - RÈGLE ABSOLUE
        # INTERDIT d'annuler une subscription en webhook sans preuve forte.
        # Une annulation automatique est autorisée UNIQUEMENT SI TOUTES ces conditions sont vraies:
        # 1. source="app_checkout"
        # 2. correlation_id OU checkout_session_id présent
        # 3. même workspace_id
        # 4. même price_id / même produit
        canceled_count = 0
        
        # Vérifier TOUTES les conditions requises
        can_cancel = (
            source == 'app_checkout' and
            (correlation_id or checkout_session_id) and
            workspace_id_from_metadata and
            price_id
        )
        
        if has_multiple_active and can_cancel:
            # This subscription came from our checkout - check if it's a duplicate
            # Look for other subscriptions with same correlation_id/checkout_session_id AND same workspace_id AND same price_id
            duplicate_query = {
                "user_id": gerant['id'],
                "stripe_subscription_id": {"$ne": subscription_id},
                "workspace_id": workspace_id_from_metadata,  # ✅ Condition 3: même workspace_id
                "price_id": price_id  # ✅ Condition 4: même price_id
            }
            
            if correlation_id:
                duplicate_query["correlation_id"] = correlation_id
            elif checkout_session_id:
                duplicate_query["checkout_session_id"] = checkout_session_id
            
            duplicate_check = await self.subscription_repo.find_one(duplicate_query)
            if duplicate_check:
                # ✅ TOUTES les conditions sont remplies - c'est un vrai doublon de notre checkout
                old_stripe_id = duplicate_check.get('stripe_subscription_id')
                if old_stripe_id:
                    try:
                        self.stripe.modify_subscription(old_stripe_id, cancel_at_period_end=True)
                        await self.subscription_repo.update_by_stripe_subscription(
                            old_stripe_id,
                            {
                                "cancel_at_period_end": True,
                                "canceled_at": datetime.now(timezone.utc).isoformat(),
                            },
                        )
                        canceled_count = 1
                        logger.warning(
                            f"✅ Canceled duplicate subscription {old_stripe_id} "
                            f"(correlation_id: {correlation_id}, workspace_id: {workspace_id_from_metadata}, price_id: {price_id})"
                        )
                    except Exception as e:
                        logger.error(f"Error canceling duplicate subscription {old_stripe_id}: {e}")
        elif has_multiple_active:
            # ❌ Conditions non remplies - NE PAS ANNULER, logger l'anomalie
            missing_conditions = []
            if source != 'app_checkout':
                missing_conditions.append(f"source={source} (expected 'app_checkout')")
            if not correlation_id and not checkout_session_id:
                missing_conditions.append("missing correlation_id/checkout_session_id")
            if not workspace_id_from_metadata:
                missing_conditions.append("missing workspace_id")
            if not price_id:
                missing_conditions.append("missing price_id")
            
            logger.warning(
                f"⚠️ MULTIPLE ACTIVE SUBSCRIPTIONS detected for {gerant['id']} but CANNOT cancel automatically. "
                f"Missing conditions: {', '.join(missing_conditions)}. "
                f"Subscription {subscription_id} will be marked with has_multiple_active=true"
            )
        
        # Get quantity from subscription items
        quantity = 1
        subscription_item_id = None
        billing_interval = 'month'
        if subscription.get('items', {}).get('data'):
            item = subscription['items']['data'][0]
            quantity = item.get('quantity', 1)
            subscription_item_id = item.get('id')
            
            # Extract billing interval from price
            if item.get('price') and item['price'].get('recurring'):
                billing_interval = item['price']['recurring'].get('interval', 'month')
        
        # IDEMPOTENCE: Use stripe_subscription_id as unique key, store user_id/workspace_id as fields
        # Prefer workspace_id from metadata (more reliable) or fallback to user's workspace_id
        final_workspace_id = workspace_id_from_metadata or gerant.get('workspace_id')
        
        update_data = {
            "user_id": gerant['id'],
            "workspace_id": final_workspace_id,
            "stripe_subscription_item_id": subscription_item_id,
            "status": status,
            "seats": quantity,
            "billing_interval": billing_interval,
            "checkout_session_id": checkout_session_id,
            "correlation_id": correlation_id,
            "source": source,
            "price_id": price_id,
            "has_multiple_active": has_multiple_active,
            "last_event_created": event_created,  # Store for ordering protection
            "last_event_id": event_id,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        # Set created_at only on first creation
        if not existing_sub:
            update_data["created_at"] = datetime.now(timezone.utc).isoformat()
        
        await self.subscription_repo.upsert_by_stripe_subscription(subscription_id, update_data)
        if gerant.get("workspace_id") and status in ("active", "trialing"):
            await self.workspace_repo.update_by_id(
                gerant["workspace_id"],
                {"subscription_status": status, "stripe_subscription_id": subscription_id},
            )
        if has_multiple_active and not checkout_session_id:
            logger.warning(
                f"⚠️ ANOMALY: Multiple active subscriptions for {gerant['email']} "
                f"(new: {subscription_id}, existing: {len(existing_active)}). "
                f"No checkout_session_id correlation - NOT canceling automatically."
            )

        logger.info(f"✅ Subscription synced for {gerant['email']}: {subscription_id} (has_multiple_active={has_multiple_active})")
        
        return {
            "status": "success",
            "subscription_id": subscription_id,
            "has_multiple_active": has_multiple_active,
            "canceled_duplicate_count": canceled_count
        }
    
    async def _handle_subscription_updated(self, subscription: Dict) -> Dict:
        """
        Handle subscription updates (quantity changes, etc.).
        
        IDEMPOTENCE: Use stripe_subscription_id as unique key.
        """
        customer_id = subscription.get('customer')
        subscription_id = subscription.get('id')
        status = subscription.get('status')
        
        gerant = await self.user_repo.find_by_stripe_customer_id(customer_id)
        if not gerant:
            return {"status": "skipped", "reason": "customer_not_found"}
        existing_sub = await self.subscription_repo.find_by_stripe_subscription(subscription_id)
        quantity = 1
        subscription_item_id = None
        billing_interval = "month"
        if subscription.get("items", {}).get("data"):
            item = subscription["items"]["data"][0]
            quantity = item.get("quantity", 1)
            subscription_item_id = item.get("id")
            if item.get("price") and item["price"].get("recurring"):
                billing_interval = item["price"]["recurring"].get("interval", "month")
        event_created = subscription.get("_event_created") or subscription.get("created")
        event_id = subscription.get("_event_id", "")
        update_data = {
            "user_id": gerant["id"],
            "workspace_id": gerant.get("workspace_id"),
            "status": status,
            "seats": quantity,
            "billing_interval": billing_interval,
            "stripe_subscription_item_id": subscription_item_id,
            "last_event_created": event_created,
            "last_event_id": event_id,
        }
        if not existing_sub:
            update_data["created_at"] = datetime.now(timezone.utc).isoformat()
        await self.subscription_repo.upsert_by_stripe_subscription(subscription_id, update_data)
        if gerant.get("workspace_id"):
            await self.workspace_repo.update_by_id(gerant["workspace_id"], {"subscription_status": status})
        logger.info(f"✅ Subscription updated: {subscription_id}, status={status}, seats={quantity}")
        return {"status": "success", "new_status": status, "seats": quantity}
    
    async def _handle_subscription_deleted(self, subscription: Dict) -> Dict:
        """
        Handle subscription cancellation/deletion.
        
        This event fires when:
        - Subscription is canceled immediately
        - Subscription reaches the end of its billing period after cancel_at_period_end
        - Subscription is deleted via API
        
        Actions:
        - Set status to 'canceled'
        - Record cancellation timestamp
        - Set access_end_date to cut off access
        - Update workspace status
        """
        customer_id = subscription.get("customer")
        gerant = await self.user_repo.find_by_stripe_customer_id(customer_id)
        if not gerant:
            return {"status": "skipped", "reason": "customer_not_found"}
        # Extract period end from Stripe subscription (when access should end)
        # If canceled_at exists, use it; otherwise use current_period_end or now
        access_end_date = datetime.now(timezone.utc)
        
        if subscription.get('ended_at'):
            access_end_date = datetime.fromtimestamp(
                subscription['ended_at'], tz=timezone.utc
            )
        elif subscription.get('current_period_end'):
            access_end_date = datetime.fromtimestamp(
                subscription['current_period_end'], tz=timezone.utc
            )
        
        # Update subscription in database
        # 🔴 RÈGLE ABSOLUE: Utiliser stripe_subscription_id si disponible
        subscription_id_from_stripe = subscription.get("id")
        cancel_data = {
            "status": "canceled",
            "canceled_at": datetime.now(timezone.utc).isoformat(),
            "access_end_date": access_end_date.isoformat(),
        }
        if subscription_id_from_stripe:
            await self.subscription_repo.update_by_stripe_subscription(
                subscription_id_from_stripe, cancel_data
            )
        else:
            logger.warning(
                f"⚠️ Subscription deleted but no subscription_id for customer {customer_id}. "
                f"Using fallback update by user_id."
            )
            await self.subscription_repo.update_by_user(gerant["id"], cancel_data)
        if gerant.get("workspace_id"):
            await self.workspace_repo.update_by_id(
                gerant["workspace_id"],
                {"subscription_status": "canceled", "access_end_date": access_end_date.isoformat()},
            )
        logger.warning(f"⚠️ Subscription DELETED for {gerant.get('email', gerant['id'])} - access ends at {access_end_date.isoformat()}")

        # Send cancellation email
        try:
            _email, _name, _end = (
                gerant['email'], gerant.get('name', gerant['email']), access_end_date.isoformat(),
            )
            asyncio.create_task(asyncio.to_thread(
                lambda: send_subscription_canceled_email(
                    recipient_email=_email, recipient_name=_name, access_end_date=_end,
                )
            ))
        except Exception as e:
            logger.error(f"Failed to send subscription canceled email to {gerant.get('email')}: {e}")

        return {
            "status": "success",
            "new_status": "canceled",
            "access_end_date": access_end_date.isoformat()
        }
    
    async def _handle_trial_will_end(self, subscription: Dict) -> Dict:
        """
        Handle upcoming trial expiry (fires ~3 days before trial_end).
        Sends a reminder email to the gérant to subscribe before access is cut off.
        """
        customer_id = subscription.get('customer')
        gerant = await self.user_repo.find_by_stripe_customer_id(customer_id)
        if not gerant:
            return {"status": "skipped", "reason": "customer_not_found"}

        trial_end_ts = subscription.get('trial_end')
        if not trial_end_ts:
            return {"status": "skipped", "reason": "no_trial_end"}

        trial_end_dt = datetime.fromtimestamp(trial_end_ts, tz=timezone.utc)
        days_left = max(0, (trial_end_dt - datetime.now(timezone.utc)).days)

        try:
            _email, _name, _days, _end = (
                gerant['email'], gerant.get('name', gerant['email']),
                days_left, trial_end_dt.isoformat(),
            )
            asyncio.create_task(asyncio.to_thread(
                lambda: send_trial_ending_email(
                    recipient_email=_email, recipient_name=_name,
                    days_left=_days, trial_end_date=_end,
                )
            ))
        except Exception as e:
            logger.error(f"Failed to send trial ending email to {gerant['email']}: {e}")

        logger.info(f"⏳ Trial ending in {days_left}d for {gerant['email']} — reminder sent")
        return {"status": "success", "days_left": days_left}

    async def _handle_checkout_completed(self, session: Dict) -> Dict:
        """
        Handle successful checkout session completion.
        This is typically the first event received after a successful payment.
        It ensures the subscription is immediately activated even before
        the subscription.created event arrives.
        
        RULES:
        - NEVER cancel other subscriptions automatically
        - Only sync state, log anomalies, mark has_multiple_active
        - Use stripe_subscription_id as unique key for idempotence
        - Store checkout_session_id for correlation
        """
        customer_id = session.get('customer')
        subscription_id = session.get('subscription')
        session_id = session.get('id')  # checkout_session_id
        
        if not customer_id:
            return {"status": "skipped", "reason": "no_customer"}
        gerant = await self.user_repo.find_by_stripe_customer_id(customer_id)
        if not gerant:
            return {"status": "skipped", "reason": "customer_not_found"}
        q = {
            "user_id": gerant["id"],
            "status": {"$in": ["active", "trialing"]},
            "stripe_subscription_id": {"$ne": subscription_id} if subscription_id else {"$exists": True},
        }
        existing_active = await self.subscription_repo.find_many_with_query(q, limit=10)
        
        has_multiple_active = len(existing_active) > 0
        
        if has_multiple_active:
            logger.warning(
                f"⚠️ ANOMALY: Multiple active subscriptions detected for {gerant['email']} "
                f"during checkout completion. New: {subscription_id}, Existing: {len(existing_active)}. "
                f"NOT canceling automatically - sync only."
            )
        
        # Extract metadata from checkout session
        metadata = session.get('metadata', {})
        seller_quantity = int(metadata.get('seller_quantity', 1))
        
        # Determine billing interval from checkout session
        billing_interval = 'month'  # Default
        if subscription_id:
            try:
                stripe_sub = self.stripe.retrieve_subscription(subscription_id)
                if stripe_sub.items.data:
                    price = stripe_sub.items.data[0].price
                    if price.recurring:
                        billing_interval = price.recurring.interval
            except Exception as e:
                logger.warning(f"Could not determine billing interval: {e}")
        
        # IDEMPOTENCE: Use stripe_subscription_id as unique key
        if not subscription_id:
            logger.warning(f"⚠️ Checkout completed but no subscription_id in session {session_id}")
            return {"status": "skipped", "reason": "no_subscription_id"}

        # Extract event ordering fields (injected by webhook dispatcher at entry point)
        event_created = session.get('_event_created') or session.get('created')
        event_id = session.get('_event_id', '')

        # Extract metadata from checkout session for correlation
        session_metadata = session.get('metadata', {})
        correlation_id = session_metadata.get('correlation_id')
        workspace_id_from_metadata = session_metadata.get('workspace_id')
        
        # Prefer workspace_id from metadata (more reliable) or fallback to user's workspace_id
        final_workspace_id = workspace_id_from_metadata or gerant.get('workspace_id')
        
        update_data = {
            "user_id": gerant['id'],
            "workspace_id": final_workspace_id,
            "status": "active",
            "billing_interval": billing_interval,
            "checkout_session_id": session_id,
            "correlation_id": correlation_id,
            "source": "app_checkout",
            "has_multiple_active": has_multiple_active,
            "last_event_created": event_created,  # Store for ordering protection
            "last_event_id": event_id,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        if seller_quantity:
            update_data["seats"] = seller_quantity
            # Determine plan based on seats
            if seller_quantity <= 5:
                update_data["plan"] = "starter"
            elif seller_quantity <= 15:
                update_data["plan"] = "professional"
            else:
                update_data["plan"] = "enterprise"
        
        existing = await self.subscription_repo.find_by_stripe_subscription(subscription_id)
        if not existing:
            update_data["created_at"] = datetime.now(timezone.utc).isoformat()
        await self.subscription_repo.upsert_by_stripe_subscription(subscription_id, update_data)
        if gerant.get("workspace_id"):
            await self.workspace_repo.update_by_id(
                gerant["workspace_id"],
                {"subscription_status": "active", "stripe_subscription_id": subscription_id},
            )
        logger.info(f"✅ Checkout completed for {gerant['email']} - subscription synced: {subscription_id} (has_multiple_active={has_multiple_active})")
        
        return {
            "status": "success", 
            "checkout_completed": True,
            "user_id": gerant['id'],
            "seats": seller_quantity,
            "has_multiple_active": has_multiple_active
        }
    
    # ==========================================
    # SEATS MANAGEMENT
    # ==========================================
    
    async def update_subscription_seats(
        self,
        gerant_id: str,
        new_seats: int,
        is_trial: bool = False,
        stripe_subscription_id: str = None  # Optional: explicit targeting if multiple actives
    ) -> Dict:
        """
        Update subscription seats count.
        Calls Stripe API for active subscriptions, then updates local DB.
        
        🔴 SAFETY: If has_multiple_active=true, stripe_subscription_id MUST be provided.
        
        Args:
            gerant_id: ID of the gérant
            new_seats: New number of seats
            is_trial: Whether user is in trial mode (skip Stripe call)
            stripe_subscription_id: Optional explicit subscription ID (required if multiple actives)
            
        Returns:
            Dict with update result
            
        Raises:
            ValueError if multiple actives and no stripe_subscription_id provided
            Exception if Stripe call fails (DB not updated for atomicity)
        """
        active_subscriptions = await self.subscription_repo.find_many_with_query(
            {"user_id": gerant_id, "status": {"$in": ["active", "trialing"]}},
            limit=10,
        )
        if not active_subscriptions:
            raise ValueError("Aucun abonnement trouvé")
        # 🔴 SAFETY CHECK: If multiple actives, require explicit stripe_subscription_id
        if len(active_subscriptions) > 1:
            if not stripe_subscription_id:
                # Format active subscriptions for response
                active_list = [
                    {
                        "stripe_subscription_id": s.get('stripe_subscription_id'),
                        "workspace_id": s.get('workspace_id'),
                        "price_id": s.get('price_id'),
                        "status": s.get('status'),
                        "seats": s.get('seats', 1),
                        "created_at": s.get('created_at')
                    }
                    for s in active_subscriptions
                ]
                
                # Raise custom exception with structured data
                from exceptions.subscription_exceptions import MultipleActiveSubscriptionsError
                raise MultipleActiveSubscriptionsError(
                    message=f"{len(active_subscriptions)} abonnements actifs détectés. Vous devez spécifier 'stripe_subscription_id' pour cibler l'abonnement à modifier.",
                    active_subscriptions=active_list,
                    recommended_action="USE_STRIPE_SUBSCRIPTION_ID"
                )
            
            # Find the specific subscription
            subscription = next(
                (s for s in active_subscriptions if s.get('stripe_subscription_id') == stripe_subscription_id),
                None
            )
            
            if not subscription:
                available_ids = [s.get('stripe_subscription_id') for s in active_subscriptions]
                raise ValueError(
                    f"Abonnement {stripe_subscription_id} non trouvé parmi les abonnements actifs. "
                    f"Abonnements disponibles: {available_ids}"
                )
        else:
            subscription = active_subscriptions[0]
        
        # Verify has_multiple_active flag
        if subscription.get('has_multiple_active') and not stripe_subscription_id:
            # Format active subscriptions for response
            active_list = [
                {
                    "stripe_subscription_id": s.get('stripe_subscription_id'),
                    "workspace_id": s.get('workspace_id'),
                    "price_id": s.get('price_id'),
                    "status": s.get('status')
                }
                for s in active_subscriptions
            ]
            
            from exceptions.subscription_exceptions import MultipleActiveSubscriptionsError
            raise MultipleActiveSubscriptionsError(
                message="L'abonnement est marqué has_multiple_active=true. Vous devez spécifier 'stripe_subscription_id' explicitement.",
                active_subscriptions=active_list,
                recommended_action="USE_STRIPE_SUBSCRIPTION_ID"
            )
        
        subscription_item_id = subscription.get('stripe_subscription_item_id')
        current_seats = subscription.get('seats', 1)
        
        proration_amount = 0
        
        # For active subscriptions with Stripe, update via API first
        if not is_trial and subscription_item_id:
            try:
                # CRITICAL: Call Stripe BEFORE updating local DB (atomicity)
                self.stripe.modify_subscription_item(
                    subscription_item_id,
                    quantity=new_seats,
                    proration_behavior='create_prorations',
                )
                logger.info(f"✅ Stripe SubscriptionItem updated: {subscription_item_id} → {new_seats} seats")

                # Get upcoming invoice to show proration
                try:
                    stripe_sub_id = subscription.get('stripe_subscription_id')
                    if stripe_sub_id:
                        upcoming = self.stripe.upcoming_invoice(stripe_sub_id)
                        proration_amount = upcoming.get('amount_due', 0) / 100
                except Exception as e:
                    logger.warning(f"Could not fetch proration: {e}")

            except stripe.StripeError as e:
                logger.error(f"❌ Stripe API error: {str(e)}")
                raise Exception(f"Erreur Stripe: {str(e)}")
        
        # Calculate plan based on seats
        if new_seats < SEATS_THRESHOLD_PROFESSIONAL:
            price_per_seat = PRICE_PER_SEAT_STARTER
            plan = 'starter'
        else:
            price_per_seat = PRICE_PER_SEAT_PROFESSIONAL
            plan = 'professional'
        
        new_monthly_cost = new_seats * price_per_seat
        
        active_sub = await self.subscription_repo.find_by_user_and_status(
            gerant_id, ["active", "trialing"]
        )
        seats_update = {"seats": new_seats, "plan": plan}
        if active_sub and active_sub.get("stripe_subscription_id"):
            await self.subscription_repo.update_by_stripe_subscription(
                active_sub["stripe_subscription_id"], seats_update
            )
        else:
            gerant_user = await self.user_repo.find_one({"id": gerant_id}, {"workspace_id": 1})
            logger.warning(
                f"⚠️ Updating seats but no active subscription found for gerant {gerant_id}. "
                f"Using fallback update by user_id."
            )
            await self.subscription_repo.update_by_user(gerant_id, seats_update)
        
        logger.info(f"✅ DB updated: {current_seats} → {new_seats} seats for {gerant_id}")
        
        return {
            "success": True,
            "previous_seats": current_seats,
            "new_seats": new_seats,
            "new_monthly_cost": new_monthly_cost,
            "proration_amount": proration_amount,
            "plan": plan
        }
