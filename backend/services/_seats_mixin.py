"""
PaymentService mixin — Gestion des seats (places) d'abonnement.
"""
import logging
import stripe
from typing import Dict

from core.constants import (
    PRICE_PER_SEAT_STARTER, PRICE_PER_SEAT_PROFESSIONAL,
    SEATS_THRESHOLD_PROFESSIONAL,
)

logger = logging.getLogger(__name__)


class SeatsMixin:

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
