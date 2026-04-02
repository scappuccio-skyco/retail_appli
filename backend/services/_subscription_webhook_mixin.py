"""
PaymentService mixin — Gestion des webhooks d'abonnements et checkout Stripe.
Handlers: customer.subscription.created/updated/deleted/trial_will_end, checkout.session.completed
"""
import asyncio
import logging
from datetime import datetime, timezone
from typing import Dict

from email_service import send_subscription_canceled_email, send_trial_ending_email

logger = logging.getLogger(__name__)


class SubscriptionWebhookMixin:

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
