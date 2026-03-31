"""Subscription wrapper methods and formatting for GerantService."""
import logging
import os
from typing import Dict, Optional, List
from datetime import datetime, timezone

from core.constants import (
    PRICE_PER_SEAT_STARTER_MONTHLY, PRICE_PER_SEAT_PROFESSIONAL_MONTHLY,
    PRICE_PER_SEAT_STARTER_YEARLY, PRICE_PER_SEAT_PROFESSIONAL_YEARLY,
    SEATS_THRESHOLD_PROFESSIONAL,
)
from models.pagination import PaginatedResponse
from utils.pagination import paginate

logger = logging.getLogger(__name__)


class SubscriptionMixin:

    # ===== SUBSCRIPTION (for routes: no direct subscription_repo access) =====

    async def get_subscription_by_user_and_status(
        self, user_id: str, status_list: List[str]
    ) -> Optional[Dict]:
        """Get subscription for user with status in list. Used by routes."""
        return await self.subscription_repo.find_by_user_and_status(
            user_id, status_list
        )

    async def get_subscription_by_user(self, user_id: str) -> Optional[Dict]:
        """Get subscription for user (any status). Used by routes."""
        return await self.subscription_repo.find_by_user(user_id)

    async def get_active_subscriptions_for_gerant(
        self, gerant_id: str, limit: int = 10
    ) -> List[Dict]:
        """Get active/trialing subscriptions for gérant. Used by routes instead of find_many."""
        return await self.subscription_repo.find_many(
            {"user_id": gerant_id, "status": {"$in": ["active", "trialing"]}},
            projection={"_id": 0},
            limit=limit,
        )

    async def update_subscription_by_user(
        self, user_id: str, update_data: Dict
    ) -> bool:
        """Update subscription by user. Used by routes."""
        return await self.subscription_repo.update_by_user(user_id, update_data)

    async def update_subscription_by_stripe_id(
        self, stripe_subscription_id: str, update_data: Dict
    ) -> bool:
        """Update subscription by Stripe subscription ID. Used by routes."""
        return await self.subscription_repo.update_by_stripe_subscription(
            stripe_subscription_id, update_data
        )

    async def get_subscription_by_stripe_id(
        self, stripe_subscription_id: str
    ) -> Optional[Dict]:
        """Get subscription by Stripe subscription ID. Used by routes."""
        return await self.subscription_repo.find_by_stripe_subscription(
            stripe_subscription_id
        )

    async def get_subscriptions_paginated(
        self, gerant_id: str, page: int = 1, size: int = 50
    ) -> PaginatedResponse:
        """Get paginated subscriptions for gérant. Used by routes instead of paginate(collection=...)."""
        return await paginate(
            collection=self.subscription_repo.collection,
            query={"user_id": gerant_id},
            page=page,
            size=size,
            projection={"_id": 0},
            sort=[("created_at", -1)],
        )

    async def get_active_subscriptions_paginated(
        self, gerant_id: str, page: int = 1, size: int = 20
    ) -> PaginatedResponse:
        """Get paginated active subscriptions for gérant. Used by audit route."""
        return await paginate(
            collection=self.subscription_repo.collection,
            query={"user_id": gerant_id, "status": {"$in": ["active", "trialing"]}},
            page=page,
            size=size,
            projection={"_id": 0},
            sort=[("created_at", -1)],
        )

    # ===== KPI (for routes: no direct kpi_repo access) =====

    async def aggregate_kpi(
        self, pipeline: List[Dict], max_results: int = 365
    ) -> List[Dict]:
        """Run KPI aggregation pipeline. Used by routes instead of kpi_repo.aggregate."""
        return await self.kpi_repo.aggregate(pipeline, max_results=max_results)

    async def get_subscription_status(self, gerant_id: str) -> Dict:
        """
        Get subscription status for a gérant

        Priority order:
        1. Workspace trial status
        2. Stripe subscription
        3. Local database subscription

        Args:
            gerant_id: Gérant user ID

        Returns:
            Dict with subscription details
        """
        # Get gérant info
        gerant = await self.user_repo.find_one(
            {"id": gerant_id},
            {"_id": 0}
        )

        if not gerant:
            raise Exception("Gérant non trouvé")

        # Bypass démo : retourne un statut actif fictif sans vérifier Stripe
        if gerant.get('is_demo'):
            active_sellers_count = await self.user_repo.count({
                "gerant_id": gerant_id,
                "role": "seller",
                "status": "active"
            })
            return {
                "has_subscription": True,
                "status": "active",
                "current_plan": "professional",
                "used_seats": active_sellers_count,
                "remaining_seats": 999,
                "subscription": {"seats": 999, "billing_interval": "month"},
                "message": "Espace démonstration",
                "workspace_name": "Démo",
                "is_demo": True,
            }

        workspace_id = gerant.get('workspace_id')
        workspace_name = None  # Will be set if workspace exists

        # PRIORITY 1: Check workspace (for free trials without Stripe)
        if workspace_id:
            workspace = await self.workspace_repo.find_by_id(workspace_id, projection={"_id": 0})

            if workspace:
                workspace_name = workspace.get('name')
                subscription_status = workspace.get('subscription_status')

                # If in trial period
                if subscription_status == 'trialing':
                    trial_end = workspace.get('trial_end')
                    if trial_end:
                        if isinstance(trial_end, str):
                            trial_end_dt = datetime.fromisoformat(trial_end.replace('Z', '+00:00'))
                        else:
                            trial_end_dt = trial_end

                        # Gérer les dates naive vs aware
                        now = datetime.now(timezone.utc)
                        if trial_end_dt.tzinfo is None:
                            trial_end_dt = trial_end_dt.replace(tzinfo=timezone.utc)

                        days_left = max(0, (trial_end_dt - now).days)

                        # Count active sellers
                        active_sellers_count = await self.user_repo.count({
                            "gerant_id": gerant_id,
                            "role": "seller",
                            "status": "active"
                        })

                        # Determine plan based on seller count
                        current_plan = 'starter'
                        max_sellers = 5
                        if active_sellers_count >= 16:
                            current_plan = 'enterprise'
                            max_sellers = None  # Unlimited
                        elif active_sellers_count >= 6:
                            current_plan = 'professional'
                            max_sellers = 15

                        return {
                            "has_subscription": True,
                            "status": "trialing",
                            "days_left": days_left,
                            "trial_end": trial_end,
                            "current_plan": current_plan,
                            "used_seats": active_sellers_count,
                            "subscription": {
                                "seats": max_sellers or 999,
                                "billing_interval": "month"
                            },
                            "remaining_seats": (max_sellers - active_sellers_count) if max_sellers else 999,
                            "message": f"Essai gratuit - {days_left} jour{'s' if days_left > 1 else ''} restant{'s' if days_left > 1 else ''}",
                            "workspace_name": workspace.get('name')
                        }

                # If trial expired
                if subscription_status == 'trial_expired':
                    active_sellers_count = await self.user_repo.count({
                        "gerant_id": gerant_id,
                        "role": "seller",
                        "status": "active"
                    })
                    return {
                        "has_subscription": False,
                        "status": "trial_expired",
                        "message": "Essai gratuit terminé",
                        "active_sellers_count": active_sellers_count,
                        "workspace_name": workspace.get('name')
                    }

        # PRIORITY 2: Check Stripe subscription (if customer ID exists)
        stripe_customer_id = gerant.get('stripe_customer_id')

        if stripe_customer_id:
            # Check Stripe API
            try:
                import stripe as stripe_lib
                stripe_lib.api_key = os.environ.get('STRIPE_API_KEY')

                # Get active subscriptions
                subscriptions = stripe_lib.Subscription.list(
                    customer=stripe_customer_id,
                    status='active',
                    limit=10
                )

                active_subscription = None
                for sub in subscriptions.data:
                    if not sub.get('cancel_at_period_end', False):
                        active_subscription = sub
                        break

                if not active_subscription:
                    # Check for trialing subscriptions
                    trial_subs = stripe_lib.Subscription.list(
                        customer=stripe_customer_id,
                        status='trialing',
                        limit=1
                    )
                    if trial_subs.data:
                        active_subscription = trial_subs.data[0]

                if not active_subscription:
                    # Check for past_due subscriptions (payment failed, Stripe is retrying)
                    past_due_subs = stripe_lib.Subscription.list(
                        customer=stripe_customer_id,
                        status='past_due',
                        limit=1
                    )
                    if past_due_subs.data:
                        active_subscription = past_due_subs.data[0]

                if active_subscription:
                    result = await self._format_stripe_subscription(active_subscription, gerant_id)
                    result["workspace_name"] = workspace_name
                    return result

            except Exception as e:
                logger.warning(f"Stripe API error: {e}")

        # PRIORITY 3: Check local database subscription
        # 🔍 Use find() instead of find_one() to detect multiple subscriptions
        db_subscriptions = await self.subscription_repo.find_many(
            {"user_id": gerant_id, "status": {"$in": ["active", "trialing", "past_due"]}},
            {"_id": 0},
            limit=10
        )

        if not db_subscriptions:
            active_sellers_count = await self.user_repo.count({
                "gerant_id": gerant_id,
                "role": "seller",
                "status": "active"
            })
            return {
                "has_subscription": False,
                "status": "inactive",
                "message": "Aucun abonnement actif",
                "active_sellers_count": active_sellers_count,
                "workspace_name": workspace_name
            }

        # STRATEGY: Stable selection (active > trialing, then by created_at/current_period_end)
        has_multiple_active = len(db_subscriptions) > 1
        active_subscriptions_count = len(db_subscriptions)

        if has_multiple_active:
            logger.warning(
                f"⚠️ Multiple active subscriptions detected for gerant {gerant_id}: "
                f"{active_subscriptions_count} subscriptions found. "
                f"Stripe IDs: {[s.get('stripe_subscription_id') for s in db_subscriptions]}"
            )

            # STABLE SELECTION STRATEGY (production-safe):
            # 1. Filter by workspace_id (if available) - prefer subscriptions matching current workspace
            # 2. Filter by expected price_id/product (if available) - prefer matching price
            # 3. Prefer 'active' over 'trialing'
            # 4. Then prefer most recent (by current_period_end, then created_at)

            # Get current workspace_id for filtering
            workspace_id = gerant.get('workspace_id')

            # Step 1: Filter by workspace_id if available
            workspace_matches = []
            if workspace_id:
                workspace_matches = [s for s in db_subscriptions if s.get('workspace_id') == workspace_id]

            # Step 2: If we have workspace matches, use them; otherwise use all
            candidates_for_selection = workspace_matches if workspace_matches else db_subscriptions

            # Step 3: Filter by status (active > trialing)
            active_subs = [s for s in candidates_for_selection if s.get('status') == 'active']
            trialing_subs = [s for s in candidates_for_selection if s.get('status') == 'trialing']

            candidates = active_subs if active_subs else trialing_subs

            # Step 4: Select most recent (by current_period_end, then created_at)
            db_subscription = max(
                candidates,
                key=lambda s: (
                    s.get('current_period_end', '') or '',
                    s.get('created_at', '')
                )
            )

            # Log selection rationale
            if workspace_id and workspace_matches:
                logger.info(f"Selected subscription matching workspace_id={workspace_id} from {len(workspace_matches)} matches")
        else:
            db_subscription = db_subscriptions[0]

        result = await self._format_db_subscription(db_subscription, gerant_id)
        result["workspace_name"] = workspace_name
        result["has_multiple_active"] = has_multiple_active
        result["active_subscriptions_count"] = active_subscriptions_count

        if has_multiple_active:
            result["warning"] = f"⚠️ {active_subscriptions_count} abonnements actifs détectés. Affichage du plus récent (active > trialing, puis par date)."

        return result

    async def _format_stripe_subscription(self, subscription, gerant_id: str) -> Dict:
        """Format Stripe subscription data"""
        quantity = 1
        subscription_item_id = None
        price_id = None
        unit_amount = None
        billing_interval = 'month'

        if subscription.get('items') and subscription['items']['data']:
            item_data = subscription['items']['data'][0]
            quantity = item_data.get('quantity', 1)
            subscription_item_id = item_data.get('id')

            if item_data.get('price'):
                price = item_data['price']
                price_id = price.get('id')
                unit_amount = price.get('unit_amount', 0) / 100  # Convert to euros
                billing_interval = price.get('recurring', {}).get('interval', 'month')

        # Count active sellers
        active_sellers_count = await self.user_repo.count({
            "gerant_id": gerant_id,
            "role": "seller",
            "status": "active"
        })

        # Determine plan based on quantity
        current_plan = 'starter'
        if quantity >= 16:
            current_plan = 'enterprise'
        elif quantity >= 6:
            current_plan = 'professional'

        # Calculate trial days remaining
        days_left = None
        trial_end = None
        if subscription.get('status') == 'trialing' and subscription.get('trial_end'):
            trial_end_ts = subscription['trial_end']
            trial_end = datetime.fromtimestamp(trial_end_ts, tz=timezone.utc).isoformat()
            now = datetime.now(timezone.utc)
            trial_end_dt = datetime.fromtimestamp(trial_end_ts, tz=timezone.utc)
            days_left = max(0, (trial_end_dt - now).days)

        return {
            "has_subscription": True,
            "status": subscription.get('status'),
            "plan": current_plan,
            "subscription": {
                "id": subscription.id,
                "seats": quantity,
                "price_per_seat": unit_amount,
                "billing_interval": billing_interval,
                "current_period_start": datetime.fromtimestamp(
                    subscription.get('current_period_start'),
                    tz=timezone.utc
                ).isoformat() if subscription.get('current_period_start') else None,
                "current_period_end": datetime.fromtimestamp(
                    subscription.get('current_period_end'),
                    tz=timezone.utc
                ).isoformat() if subscription.get('current_period_end') else None,
                "cancel_at_period_end": subscription.get('cancel_at_period_end', False),
                "subscription_item_id": subscription_item_id,
                "price_id": price_id
            },
            "trial_end": trial_end,
            "days_left": days_left,
            "active_sellers_count": active_sellers_count,
            "used_seats": active_sellers_count,
            "remaining_seats": max(0, quantity - active_sellers_count)
        }

    async def _format_db_subscription(self, db_subscription: Dict, gerant_id: str) -> Dict:
        """Format database subscription data"""
        active_sellers_count = await self.user_repo.count({
            "gerant_id": gerant_id,
            "role": "seller",
            "status": "active"
        })

        # Determine plan based on seats
        quantity = db_subscription.get('seats', 1)
        current_plan = 'starter'
        if quantity >= 16:
            current_plan = 'enterprise'
        elif quantity >= 6:
            current_plan = 'professional'

        # Calculate trial days remaining
        days_left = None
        trial_end = None
        if db_subscription.get('trial_end'):
            trial_end = db_subscription['trial_end']
            now = datetime.now(timezone.utc)
            if isinstance(trial_end, str):
                trial_end_dt = datetime.fromisoformat(trial_end.replace('Z', '+00:00'))
            else:
                trial_end_dt = trial_end
            # Gérer les dates naive vs aware
            if trial_end_dt.tzinfo is None:
                trial_end_dt = trial_end_dt.replace(tzinfo=timezone.utc)
            days_left = max(0, (trial_end_dt - now).days)

        status = 'trialing' if days_left and days_left > 0 else 'active'

        return {
            "has_subscription": True,
            "status": status,
            "plan": current_plan,
            "subscription": {
                "id": db_subscription.get('stripe_subscription_id'),
                "seats": quantity,
                "price_per_seat": (
                    PRICE_PER_SEAT_PROFESSIONAL_YEARLY if (current_plan == 'professional' and db_subscription.get('billing_interval') == 'year')
                    else PRICE_PER_SEAT_STARTER_YEARLY if db_subscription.get('billing_interval') == 'year'
                    else PRICE_PER_SEAT_PROFESSIONAL_MONTHLY if current_plan == 'professional'
                    else PRICE_PER_SEAT_STARTER_MONTHLY
                ),
                "billing_interval": db_subscription.get('billing_interval', 'month'),
                "current_period_start": db_subscription.get('current_period_start'),
                "current_period_end": db_subscription.get('current_period_end'),
                "cancel_at_period_end": db_subscription.get('cancel_at_period_end', False),
                "subscription_item_id": db_subscription.get('stripe_subscription_item_id'),
                "price_id": None
            },
            "trial_end": trial_end,
            "days_left": days_left,
            "active_sellers_count": active_sellers_count,
            "used_seats": active_sellers_count,
            "remaining_seats": max(0, quantity - active_sellers_count)
        }
