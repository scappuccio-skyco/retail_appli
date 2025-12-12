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
        
        logger.info(f"📥 Processing Stripe webhook: {event_type}")
        
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
        
        if subscription_id:
            update_data["stripe_subscription_id"] = subscription_id
        
        await self.db.subscriptions.update_one(
            {"user_id": gerant['id']},
            {"$set": update_data},
            upsert=True
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
        """Handle new subscription creation"""
        customer_id = subscription.get('customer')
        subscription_id = subscription.get('id')
        status = subscription.get('status')
        
        gerant = await self.db.users.find_one(
            {"stripe_customer_id": customer_id},
            {"_id": 0, "id": 1, "email": 1}
        )
        
        if not gerant:
            return {"status": "skipped", "reason": "customer_not_found"}
        
        # Get quantity from subscription items
        quantity = 1
        subscription_item_id = None
        if subscription.get('items', {}).get('data'):
            item = subscription['items']['data'][0]
            quantity = item.get('quantity', 1)
            subscription_item_id = item.get('id')
        
        await self.db.subscriptions.update_one(
            {"user_id": gerant['id']},
            {"$set": {
                "stripe_subscription_id": subscription_id,
                "stripe_subscription_item_id": subscription_item_id,
                "status": status,
                "seats": quantity,
                "created_at": datetime.now(timezone.utc).isoformat()
            }},
            upsert=True
        )
        
        logger.info(f"✅ Subscription created for {gerant['email']}: {subscription_id}")
        return {"status": "success", "subscription_id": subscription_id}
    
    async def _handle_subscription_updated(self, subscription: Dict) -> Dict:
        """Handle subscription updates (quantity changes, etc.)"""
        customer_id = subscription.get('customer')
        status = subscription.get('status')
        
        gerant = await self.db.users.find_one(
            {"stripe_customer_id": customer_id},
            {"_id": 0, "id": 1, "workspace_id": 1}
        )
        
        if not gerant:
            return {"status": "skipped", "reason": "customer_not_found"}
        
        quantity = 1
        if subscription.get('items', {}).get('data'):
            quantity = subscription['items']['data'][0].get('quantity', 1)
        
        # Update subscription
        await self.db.subscriptions.update_one(
            {"user_id": gerant['id']},
            {"$set": {
                "status": status,
                "seats": quantity,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        # Update workspace
        if gerant.get('workspace_id'):
            await self.db.workspaces.update_one(
                {"id": gerant['workspace_id']},
                {"$set": {"subscription_status": status}}
            )
        
        logger.info(f"✅ Subscription updated: status={status}, seats={quantity}")
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
        await self.db.subscriptions.update_one(
            {"user_id": gerant['id']},
            {"$set": {
                "status": "canceled",
                "canceled_at": datetime.now(timezone.utc).isoformat(),
                "access_end_date": access_end_date.isoformat(),
                "stripe_subscription_id": None,  # Clear Stripe reference
                "stripe_subscription_item_id": None,
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
        """
        customer_id = session.get('customer')
        subscription_id = session.get('subscription')
        
        if not customer_id:
            return {"status": "skipped", "reason": "no_customer"}
        
        gerant = await self.db.users.find_one(
            {"stripe_customer_id": customer_id},
            {"_id": 0, "id": 1, "email": 1, "workspace_id": 1}
        )
        
        if not gerant:
            return {"status": "skipped", "reason": "customer_not_found"}
        
        # Extract metadata from checkout session
        metadata = session.get('metadata', {})
        seller_quantity = int(metadata.get('seller_quantity', 1))
        
        # Immediately update subscription status to active
        update_data = {
            "status": "active",
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        if subscription_id:
            update_data["stripe_subscription_id"] = subscription_id
        
        if seller_quantity:
            update_data["seats"] = seller_quantity
            # Determine plan based on seats
            if seller_quantity <= 5:
                update_data["plan"] = "starter"
            elif seller_quantity <= 15:
                update_data["plan"] = "professional"
            else:
                update_data["plan"] = "enterprise"
        
        # Update subscription
        await self.db.subscriptions.update_one(
            {"user_id": gerant['id']},
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
        
        logger.info(f"✅ Checkout completed for {gerant['email']} - subscription activated with {seller_quantity} seats")
        return {
            "status": "success", 
            "checkout_completed": True,
            "user_id": gerant['id'],
            "seats": seller_quantity
        }
    
    # ==========================================
    # SEATS MANAGEMENT
    # ==========================================
    
    async def update_subscription_seats(
        self,
        gerant_id: str,
        new_seats: int,
        is_trial: bool = False
    ) -> Dict:
        """
        Update subscription seats count.
        Calls Stripe API for active subscriptions, then updates local DB.
        
        Args:
            gerant_id: ID of the gérant
            new_seats: New number of seats
            is_trial: Whether user is in trial mode (skip Stripe call)
            
        Returns:
            Dict with update result
            
        Raises:
            Exception if Stripe call fails (DB not updated for atomicity)
        """
        # Get current subscription
        subscription = await self.db.subscriptions.find_one(
            {"user_id": gerant_id, "status": {"$in": ["active", "trialing"]}},
            {"_id": 0}
        )
        
        if not subscription:
            raise ValueError("Aucun abonnement trouvé")
        
        subscription_item_id = subscription.get('stripe_subscription_item_id')
        current_seats = subscription.get('seats', 1)
        
        proration_amount = 0
        
        # For active subscriptions with Stripe, update via API first
        if not is_trial and subscription_item_id and self.stripe_api_key:
            try:
                # CRITICAL: Call Stripe BEFORE updating local DB (atomicity)
                stripe.api_key = self.stripe_api_key
                
                result = stripe.SubscriptionItem.modify(
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
