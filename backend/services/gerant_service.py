"""
Gérant Service
Business logic for gérant dashboard, subscription, and workspace management
"""
from typing import Dict, Optional
from datetime import datetime, timezone
import logging
import os

from repositories.user_repository import UserRepository
from repositories.store_repository import StoreRepository

logger = logging.getLogger(__name__)


class GerantService:
    """Service for gérant-specific operations"""
    
    def __init__(self, db):
        self.db = db
        self.user_repo = UserRepository(db)
        self.store_repo = StoreRepository(db)
    
    async def get_dashboard_stats(self, gerant_id: str) -> Dict:
        """
        Get aggregated dashboard statistics for a gérant
        
        Args:
            gerant_id: Gérant user ID
            
        Returns:
            Dict with store counts, user counts, and monthly KPI aggregations
        """
        # Get all active stores
        stores = await self.store_repo.find_many(
            {"gerant_id": gerant_id, "active": True},
            {"_id": 0}
        )
        
        store_ids = [store['id'] for store in stores]
        
        # Count active managers
        total_managers = await self.user_repo.count({
            "gerant_id": gerant_id,
            "role": "manager",
            "status": "active"
        })
        
        # Count suspended managers
        suspended_managers = await self.user_repo.count({
            "gerant_id": gerant_id,
            "role": "manager",
            "status": "suspended"
        })
        
        # Count active sellers
        total_sellers = await self.user_repo.count({
            "gerant_id": gerant_id,
            "role": "seller",
            "status": "active"
        })
        
        # Count suspended sellers
        suspended_sellers = await self.user_repo.count({
            "gerant_id": gerant_id,
            "role": "seller",
            "status": "suspended"
        })
        
        # Calculate monthly KPI aggregations
        now = datetime.now(timezone.utc)
        first_day_of_month = now.replace(day=1).strftime('%Y-%m-%d')
        today = now.strftime('%Y-%m-%d')
        
        # Aggregate CA for all stores for current month
        pipeline = [
            {
                "$match": {
                    "store_id": {"$in": store_ids},
                    "date": {"$gte": first_day_of_month, "$lte": today}
                }
            },
            {
                "$group": {
                    "_id": None,
                    "total_ca": {"$sum": {"$ifNull": ["$seller_ca", {"$ifNull": ["$ca_journalier", 0]}]}},
                    "total_ventes": {"$sum": {"$ifNull": ["$nb_ventes", 0]}},
                    "total_articles": {"$sum": {"$ifNull": ["$nb_articles", 0]}}
                }
            }
        ]
        
        kpi_stats = await self.db.kpi_entries.aggregate(pipeline).to_list(length=1)
        
        if kpi_stats:
            stats = kpi_stats[0]
        else:
            stats = {"total_ca": 0, "total_ventes": 0, "total_articles": 0}
        
        return {
            "total_stores": len(stores),
            "total_managers": total_managers,
            "suspended_managers": suspended_managers,
            "total_sellers": total_sellers,
            "suspended_sellers": suspended_sellers,
            "month_ca": stats.get("total_ca", 0),
            "month_ventes": stats.get("total_ventes", 0),
            "month_articles": stats.get("total_articles", 0),
            "stores": stores
        }
    
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
        
        workspace_id = gerant.get('workspace_id')
        
        # PRIORITY 1: Check workspace (for free trials without Stripe)
        if workspace_id:
            workspace = await self.db.workspaces.find_one(
                {"id": workspace_id},
                {"_id": 0}
            )
            
            if workspace:
                subscription_status = workspace.get('subscription_status')
                
                # If in trial period
                if subscription_status == 'trialing':
                    trial_end = workspace.get('trial_end')
                    if trial_end:
                        if isinstance(trial_end, str):
                            trial_end_dt = datetime.fromisoformat(trial_end.replace('Z', '+00:00'))
                        else:
                            trial_end_dt = trial_end
                        
                        now = datetime.now(timezone.utc)
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
                            "message": f"Essai gratuit - {days_left} jour{'s' if days_left > 1 else ''} restant{'s' if days_left > 1 else ''}"
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
                        "active_sellers_count": active_sellers_count
                    }
        
        # PRIORITY 2: Check Stripe subscription
        stripe_customer_id = gerant.get('stripe_customer_id')
        
        if not stripe_customer_id:
            # No Stripe AND no trialing workspace = new account without trial
            active_sellers_count = await self.user_repo.count({
                "gerant_id": gerant_id,
                "role": "seller",
                "status": "active"
            })
            return {
                "has_subscription": False,
                "status": "no_subscription",
                "message": "Aucun abonnement trouvé",
                "active_sellers_count": active_sellers_count
            }
        
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
            
            if active_subscription:
                return await self._format_stripe_subscription(active_subscription, gerant_id)
            
        except Exception as e:
            logger.warning(f"Stripe API error: {e}")
        
        # PRIORITY 3: Check local database subscription
        db_subscription = await self.db.subscriptions.find_one(
            {"user_id": gerant_id, "status": {"$in": ["active", "trialing"]}},
            {"_id": 0}
        )
        
        if not db_subscription:
            active_sellers_count = await self.user_repo.count({
                "gerant_id": gerant_id,
                "role": "seller",
                "status": "active"
            })
            return {
                "has_subscription": False,
                "status": "inactive",
                "message": "Aucun abonnement actif",
                "active_sellers_count": active_sellers_count
            }
        
        return await self._format_db_subscription(db_subscription, gerant_id)
    
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
            trial_end_dt = datetime.fromisoformat(trial_end.replace('Z', '+00:00'))
            days_left = max(0, (trial_end_dt - now).days)
        
        status = 'trialing' if days_left and days_left > 0 else 'active'
        
        return {
            "has_subscription": True,
            "status": status,
            "plan": current_plan,
            "subscription": {
                "id": db_subscription.get('stripe_subscription_id'),
                "seats": quantity,
                "price_per_seat": 25 if current_plan == 'professional' else 29,
                "billing_interval": "month",
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
