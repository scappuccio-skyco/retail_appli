"""Payment Service
Business logic for Stripe payment processing and webhook handling.
Follows Clean Architecture: Controller → Service → Repository
"""
import stripe
import os
import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, Optional
from motor.motor_asyncio import AsyncIOMotorDatabase

logger = logging.getLogger(__name__)


class PaymentService:
    """Service for handling Stripe payments and subscriptions"""
    
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.stripe_api_key = os.environ.get('STRIPE_API_KEY')
        if self.stripe_api_key:
            stripe.api_key = self.stripe_api_key
    
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
        
        # Inject event metadata into data object for handlers (for ordering protection)
        data['_event_id'] = event_id
        data['_event_created'] = event_created
        
        handlers = {
            'invoice.payment_succeeded': self._handle_payment_succeeded,
            'invoice.payment_failed': self._handle_payment_failed,
            'customer.subscription.created': self._handle_subscription_created,
            'customer.subscription.updated': self._handle_subscription_updated,
            'customer.subscription.deleted': self._handle_subscription_deleted,
            'checkout.session.completed': self._handle_checkout_completed,
        }
        
        handler = handlers.get(event_type)
        if handler:
            return await handler(data)
        else:
            logger.info(f"⏭️ Unhandled event type: {event_type}")
            return {"status": "ignored", "event_type": event_type}
    
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
        
        # Find the gérant by stripe_customer_id
        gerant = await self.db.users.find_one(
            {"stripe_customer_id": customer_id},
            {"_id": 0, "id": 1, "email": 1, "workspace_id": 1}
        )
        
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
            # ✅ Utiliser stripe_subscription_id comme clé unique
            await self.db.subscriptions.update_one(
                {"stripe_subscription_id": subscription_id},  # ✅ FILTRE VALIDE
                {"$set": update_data},
                upsert=True
            )
        else:
            # ⚠️ Pas de stripe_subscription_id: update simple (pas d'upsert) par user_id
            # Ce cas ne devrait pas arriver en production normale
            logger.warning(
                f"⚠️ Payment succeeded but no subscription_id for customer {customer_id}. "
                f"Using fallback update by user_id. "
                f"workspace_id: {gerant.get('workspace_id')}, "
                f"gerant_id: {gerant['id']}"
            )
            await self.db.subscriptions.update_one(
                {"user_id": gerant['id']},
                {"$set": update_data}
            )
        
        # Also update workspace status
        if gerant.get('workspace_id'):
            await self.db.workspaces.update_one(
                {"id": gerant['workspace_id']},
                {"$set": {
                    "subscription_status": "active",
                    "stripe_subscription_id": subscription_id
                }}
            )
        
        logger.info(f"✅ Payment succeeded for {gerant['email']} - subscription active until {period_end}")
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
        
        gerant = await self.db.users.find_one(
            {"stripe_customer_id": customer_id},
            {"_id": 0, "id": 1, "email": 1, "workspace_id": 1}
        )
        
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
        await self.db.subscriptions.update_one(
            {"user_id": gerant['id']},
            {"$set": update_data}
        )
        
        # Update workspace status
        if gerant.get('workspace_id'):
            await self.db.workspaces.update_one(
                {"id": gerant['workspace_id']},
                {"$set": {"subscription_status": "past_due"}}
            )
        
        # Log detailed failure info
        logger.warning(
            f"⚠️ Payment FAILED for {gerant['email']} - "
            f"Amount: {amount_due}€, Attempt #{attempt_count}, "
            f"Subscription: {subscription_id}, Status: past_due"
        )
        
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
        
        gerant = await self.db.users.find_one(
            {"stripe_customer_id": customer_id},
            {"_id": 0, "id": 1, "email": 1, "workspace_id": 1}
        )
        
        if not gerant:
            return {"status": "skipped", "reason": "customer_not_found"}
        
        # WEBHOOK ORDERING PROTECTION: Check if this event is older than last processed
        existing_sub = await self.db.subscriptions.find_one(
            {"stripe_subscription_id": subscription_id}
        )
        
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
        
        # Check for existing active subscriptions (for anomaly detection)
        existing_active = await self.db.subscriptions.find(
            {
                "user_id": gerant['id'],
                "status": {"$in": ["active", "trialing"]},
                "stripe_subscription_id": {"$ne": subscription_id}
            }
        ).to_list(length=10)
        
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
            
            duplicate_check = await self.db.subscriptions.find_one(duplicate_query)
            
            if duplicate_check:
                # ✅ TOUTES les conditions sont remplies - c'est un vrai doublon de notre checkout
                old_stripe_id = duplicate_check.get('stripe_subscription_id')
                if old_stripe_id:
                    try:
                        stripe.Subscription.modify(old_stripe_id, cancel_at_period_end=True)
                        await self.db.subscriptions.update_one(
                            {"stripe_subscription_id": old_stripe_id},
                            {"$set": {
                                "cancel_at_period_end": True,
                                "canceled_at": datetime.now(timezone.utc).isoformat(),
                                "updated_at": datetime.now(timezone.utc).isoformat()
                            }}
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
        
        # Upsert by stripe_subscription_id (unique key)
        await self.db.subscriptions.update_one(
            {"stripe_subscription_id": subscription_id},
            {"$set": update_data},
            upsert=True
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
        
        gerant = await self.db.users.find_one(
            {"stripe_customer_id": customer_id},
            {"_id": 0, "id": 1, "workspace_id": 1}
        )
        
        if not gerant:
            return {"status": "skipped", "reason": "customer_not_found"}
        
        quantity = 1
        subscription_item_id = None
        billing_interval = 'month'
        if subscription.get('items', {}).get('data'):
            item = subscription['items']['data'][0]
            quantity = item.get('quantity', 1)
            subscription_item_id = item.get('id')
            
            # Extract billing interval
            if item.get('price') and item['price'].get('recurring'):
                billing_interval = item['price']['recurring'].get('interval', 'month')
        
        # IDEMPOTENCE: Use stripe_subscription_id as unique key
        update_data = {
            "user_id": gerant['id'],
            "workspace_id": gerant.get('workspace_id'),
            "status": status,
            "seats": quantity,
            "billing_interval": billing_interval,
            "stripe_subscription_item_id": subscription_item_id,
            "last_event_created": event_created,  # Store for ordering protection
            "last_event_id": event_id,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        # Set created_at only on first creation
        if not existing_sub:
            update_data["created_at"] = datetime.now(timezone.utc).isoformat()
        
        await self.db.subscriptions.update_one(
            {"stripe_subscription_id": subscription_id},
            {"$set": update_data},
            upsert=True
        )
        
        # Update workspace
        if gerant.get('workspace_id'):
            await self.db.workspaces.update_one(
                {"id": gerant['workspace_id']},
                {"$set": {"subscription_status": status}}
            )
        
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
        customer_id = subscription.get('customer')
        
        gerant = await self.db.users.find_one(
            {"stripe_customer_id": customer_id},
            {"_id": 0, "id": 1, "email": 1, "workspace_id": 1}
        )
        
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
        subscription_id_from_stripe = subscription.get('id')
        if subscription_id_from_stripe:
            # ✅ Utiliser stripe_subscription_id comme clé unique
            await self.db.subscriptions.update_one(
                {"stripe_subscription_id": subscription_id_from_stripe},
                {"$set": {
                    "status": "canceled",
                    "canceled_at": datetime.now(timezone.utc).isoformat(),
                    "access_end_date": access_end_date.isoformat(),
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }}
            )
        else:
            # ⚠️ Pas de stripe_subscription_id: update simple (pas d'upsert) par user_id
            subscription_id_from_stripe = subscription.get('id', 'N/A')
            logger.warning(
                f"⚠️ Subscription deleted but no subscription_id for customer {customer_id}. "
                f"Using fallback update by user_id. "
                f"workspace_id: {gerant.get('workspace_id')}, "
                f"gerant_id: {gerant['id']}, "
                f"stripe_subscription_id: {subscription_id_from_stripe}"
            )
            await self.db.subscriptions.update_one(
                {"user_id": gerant['id']},
                {"$set": {
                    "status": "canceled",
                    "canceled_at": datetime.now(timezone.utc).isoformat(),
                    "access_end_date": access_end_date.isoformat(),
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }}
            )
        
        # Update workspace status
        if gerant.get('workspace_id'):
            await self.db.workspaces.update_one(
                {"id": gerant['workspace_id']},
                {"$set": {
                    "subscription_status": "canceled",
                    "access_end_date": access_end_date.isoformat()
                }}
            )
        
        logger.warning(f"⚠️ Subscription DELETED for {gerant.get('email', gerant['id'])} - access ends at {access_end_date.isoformat()}")
        return {
            "status": "success", 
            "new_status": "canceled",
            "access_end_date": access_end_date.isoformat()
        }
    
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
        
        gerant = await self.db.users.find_one(
            {"stripe_customer_id": customer_id},
            {"_id": 0, "id": 1, "email": 1, "workspace_id": 1}
        )
        
        if not gerant:
            return {"status": "skipped", "reason": "customer_not_found"}
        
        # Check for existing active subscriptions (for anomaly detection)
        existing_active = await self.db.subscriptions.find(
            {
                "user_id": gerant['id'],
                "status": {"$in": ["active", "trialing"]},
                "stripe_subscription_id": {"$ne": subscription_id} if subscription_id else {"$exists": True}
            }
        ).to_list(length=10)
        
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
                stripe_sub = stripe.Subscription.retrieve(subscription_id)
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
        
        # Set created_at only on first creation
        existing = await self.db.subscriptions.find_one(
            {"stripe_subscription_id": subscription_id}
        )
        if not existing:
            update_data["created_at"] = datetime.now(timezone.utc).isoformat()
        
        # Upsert by stripe_subscription_id (unique key)
        await self.db.subscriptions.update_one(
            {"stripe_subscription_id": subscription_id},
            {"$set": update_data},
            upsert=True
        )
        
        # Also update workspace status to ensure immediate access
        if gerant.get('workspace_id'):
            await self.db.workspaces.update_one(
                {"id": gerant['workspace_id']},
                {"$set": {
                    "subscription_status": "active",
                    "stripe_subscription_id": subscription_id
                }}
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
        # Get all active subscriptions
        active_subscriptions = await self.db.subscriptions.find(
            {"user_id": gerant_id, "status": {"$in": ["active", "trialing"]}},
            {"_id": 0}
        ).to_list(length=10)
        
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
        if not is_trial and subscription_item_id and self.stripe_api_key:
            try:
                # CRITICAL: Call Stripe BEFORE updating local DB (atomicity)
                stripe.api_key = self.stripe_api_key
                
                stripe.SubscriptionItem.modify(
                    subscription_item_id,
                    quantity=new_seats,
                    proration_behavior='create_prorations'  # Explicit proration
                )
                
                logger.info(f"✅ Stripe SubscriptionItem updated: {subscription_item_id} → {new_seats} seats")
                
                # Get upcoming invoice to show proration
                try:
                    stripe_sub_id = subscription.get('stripe_subscription_id')
                    if stripe_sub_id:
                        upcoming = stripe.Invoice.upcoming(subscription=stripe_sub_id)
                        proration_amount = upcoming.get('amount_due', 0) / 100  # Convert cents to euros
                except Exception as e:
                    logger.warning(f"Could not fetch proration: {e}")
                    
            except stripe.StripeError as e:
                logger.error(f"❌ Stripe API error: {str(e)}")
                raise Exception(f"Erreur Stripe: {str(e)}")
        
        # Calculate plan based on seats
        if new_seats <= 5:
            price_per_seat = 29
            plan = 'starter'
        elif new_seats <= 15:
            price_per_seat = 25
            plan = 'professional'
        else:
            price_per_seat = 22
            plan = 'enterprise'
        
        new_monthly_cost = new_seats * price_per_seat
        
        # Update local database AFTER Stripe succeeds
        # 🔴 RÈGLE ABSOLUE: Utiliser stripe_subscription_id si disponible
        # Note: Cette fonction est appelée depuis l'endpoint API, pas depuis webhook
        # On doit trouver la subscription active pour cet utilisateur
        active_subscription = await self.db.subscriptions.find_one(
            {"user_id": gerant_id, "status": {"$in": ["active", "trialing"]}},
            {"stripe_subscription_id": 1}
        )
        
        if active_subscription and active_subscription.get('stripe_subscription_id'):
            # ✅ Utiliser stripe_subscription_id comme clé unique
            await self.db.subscriptions.update_one(
                {"stripe_subscription_id": active_subscription['stripe_subscription_id']},
                {"$set": {
                    "seats": new_seats,
                    "plan": plan,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }}
            )
        else:
            # ⚠️ Pas de subscription active trouvée: update simple par user_id
            # Get workspace_id for logging
            gerant_user = await self.db.users.find_one(
                {"id": gerant_id},
                {"workspace_id": 1}
            )
            workspace_id = gerant_user.get('workspace_id') if gerant_user else None
            
            logger.warning(
                f"⚠️ Updating seats but no active subscription found for gerant {gerant_id}. "
                f"Using fallback update by user_id. "
                f"workspace_id: {workspace_id}, "
                f"stripe_subscription_id: N/A (no active subscription)"
            )
            await self.db.subscriptions.update_one(
                {"user_id": gerant_id},
                {"$set": {
                    "seats": new_seats,
                    "plan": plan,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }}
            )
        
        logger.info(f"✅ DB updated: {current_seats} → {new_seats} seats for {gerant_id}")
        
        return {
            "success": True,
            "previous_seats": current_seats,
            "new_seats": new_seats,
            "new_monthly_cost": new_monthly_cost,
            "proration_amount": proration_amount,
            "plan": plan
        }
