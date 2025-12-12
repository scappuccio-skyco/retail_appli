"""
Gérant Service
Business logic for gérant dashboard, subscription, and workspace management
"""
from typing import Dict, Optional, Tuple
from datetime import datetime, timezone, timedelta
import logging
import os
from fastapi import HTTPException

from repositories.user_repository import UserRepository
from repositories.store_repository import StoreRepository

logger = logging.getLogger(__name__)


class GerantService:
    """Service for gérant-specific operations"""
    
    def __init__(self, db):
        self.db = db
        self.user_repo = UserRepository(db)
        self.store_repo = StoreRepository(db)
    
    async def check_gerant_active_access(self, gerant_id: str) -> bool:
        """
        Guard clause: Check if gérant has active subscription for write operations.
        Raises HTTPException 403 if trial expired or no active subscription.
        
        Args:
            gerant_id: Gérant user ID
            
        Returns:
            True if access is granted
            
        Raises:
            HTTPException 403 if access denied
        """
        # Get gérant info
        gerant = await self.user_repo.find_one(
            {"id": gerant_id},
            {"_id": 0}
        )
        
        if not gerant:
            raise HTTPException(status_code=403, detail="Utilisateur non trouvé")
        
        workspace_id = gerant.get('workspace_id')
        
        if not workspace_id:
            raise HTTPException(status_code=403, detail="Aucun espace de travail associé")
        
        workspace = await self.db.workspaces.find_one(
            {"id": workspace_id},
            {"_id": 0}
        )
        
        if not workspace:
            raise HTTPException(status_code=403, detail="Espace de travail non trouvé")
        
        subscription_status = workspace.get('subscription_status', 'inactive')
        
        # Active subscription - full access
        if subscription_status == 'active':
            return True
        
        # In trial period - check if still valid (including the last day)
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
                
                # Allow access if trial_end is today or in the future
                if now <= trial_end_dt:
                    return True
                else:
                    # Trial has expired - update status in DB
                    await self.db.workspaces.update_one(
                        {"id": workspace_id},
                        {"$set": {
                            "subscription_status": "trial_expired",
                            "updated_at": datetime.now(timezone.utc).isoformat()
                        }}
                    )
                    raise HTTPException(
                        status_code=403, 
                        detail="Votre période d'essai est terminée. Veuillez souscrire à un abonnement pour continuer."
                    )
        
        # Trial expired or other inactive status
        raise HTTPException(
            status_code=403, 
            detail="Votre période d'essai est terminée. Veuillez souscrire à un abonnement pour continuer."
        )
    
    async def check_user_write_access(self, user_id: str) -> bool:
        """
        Guard clause for Sellers/Managers: Get parent Gérant and check access.
        
        Args:
            user_id: User ID (seller or manager)
            
        Returns:
            True if access is granted
            
        Raises:
            HTTPException 403 if access denied
        """
        user = await self.user_repo.find_one(
            {"id": user_id},
            {"_id": 0}
        )
        
        if not user:
            raise HTTPException(status_code=403, detail="Utilisateur non trouvé")
        
        # Get parent gérant_id
        gerant_id = user.get('gerant_id')
        
        if not gerant_id:
            # Safety: If no parent chain, deny by default
            raise HTTPException(status_code=403, detail="Accès refusé: chaîne de parenté non trouvée")
        
        # Delegate to gérant check
        return await self.check_gerant_active_access(gerant_id)
    
    async def get_all_stores(self, gerant_id: str) -> list:
        """Get all active stores for a gérant with pending staff counts"""
        stores = await self.store_repo.find_many(
            {"gerant_id": gerant_id, "active": True},
            {"_id": 0}
        )
        
        # Enrich stores with pending invitation counts
        for store in stores:
            store_id = store.get('id')
            
            # Count pending manager invitations for this store
            pending_managers = await self.db.gerant_invitations.count_documents({
                "gerant_id": gerant_id,
                "store_id": store_id,
                "role": "manager",
                "status": "pending"
            })
            
            # Count pending seller invitations for this store
            pending_sellers = await self.db.gerant_invitations.count_documents({
                "gerant_id": gerant_id,
                "store_id": store_id,
                "role": "seller",
                "status": "pending"
            })
            
            store['pending_manager_count'] = pending_managers
            store['pending_seller_count'] = pending_sellers
        
        return stores
    
    async def create_store(self, store_data: Dict, gerant_id: str) -> Dict:
        """Create a new store for a gérant"""
        from uuid import uuid4
        
        # === GUARD CLAUSE: Check subscription access ===
        await self.check_gerant_active_access(gerant_id)
        
        name = store_data.get('name')
        if not name:
            raise ValueError("Le nom du magasin est requis")
        
        # Check for duplicate name
        existing = await self.store_repo.find_one({
            "gerant_id": gerant_id,
            "name": name,
            "active": True
        })
        if existing:
            raise ValueError("Un magasin avec ce nom existe déjà")
        
        store = {
            "id": str(uuid4()),
            "name": name,
            "location": store_data.get('location', ''),
            "address": store_data.get('address', ''),
            "phone": store_data.get('phone', ''),
            "opening_hours": store_data.get('opening_hours', ''),
            "gerant_id": gerant_id,
            "active": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        await self.db.stores.insert_one(store)
        
        # Remove _id for return
        store.pop('_id', None)
        return store
    
    async def delete_store(self, store_id: str, gerant_id: str) -> Dict:
        """Soft delete a store (set active=False)"""
        store = await self.store_repo.find_one({
            "id": store_id,
            "gerant_id": gerant_id
        })
        
        if not store:
            raise ValueError("Magasin non trouvé")
        
        # Soft delete - set active to False
        await self.db.stores.update_one(
            {"id": store_id},
            {"$set": {
                "active": False,
                "deleted_at": datetime.now(timezone.utc).isoformat(),
                "deleted_by": gerant_id
            }}
        )
        
        # Suspend all staff in this store
        await self.db.users.update_many(
            {"store_id": store_id, "status": "active"},
            {"$set": {
                "status": "suspended",
                "suspended_reason": "Store deleted",
                "suspended_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        return {"message": "Magasin supprimé avec succès"}
    
    async def update_store(self, store_id: str, store_data: Dict, gerant_id: str) -> Dict:
        """Update store information"""
        store = await self.store_repo.find_one({
            "id": store_id,
            "gerant_id": gerant_id,
            "active": True
        })
        
        if not store:
            raise ValueError("Magasin non trouvé ou inactif")
        
        update_fields = {}
        for field in ['name', 'location', 'address', 'phone', 'opening_hours']:
            if field in store_data:
                update_fields[field] = store_data[field]
        
        if update_fields:
            update_fields['updated_at'] = datetime.now(timezone.utc).isoformat()
            await self.db.stores.update_one(
                {"id": store_id},
                {"$set": update_fields}
            )
        
        # Return updated store
        updated_store = await self.store_repo.find_one({"id": store_id}, {"_id": 0})
        return updated_store
    
    async def transfer_manager_to_store(self, manager_id: str, transfer_data: Dict, gerant_id: str) -> Dict:
        """Transfer a manager to another store"""
        new_store_id = transfer_data.get('new_store_id')
        if not new_store_id:
            raise ValueError("new_store_id est requis")
        
        # Verify manager belongs to this gérant
        manager = await self.user_repo.find_one({
            "id": manager_id,
            "gerant_id": gerant_id,
            "role": "manager"
        })
        if not manager:
            raise ValueError("Manager non trouvé")
        
        # Verify new store belongs to this gérant and is active
        new_store = await self.store_repo.find_one({
            "id": new_store_id,
            "gerant_id": gerant_id,
            "active": True
        })
        if not new_store:
            raise ValueError("Nouveau magasin non trouvé ou inactif")
        
        # Update manager's store
        await self.db.users.update_one(
            {"id": manager_id},
            {"$set": {
                "store_id": new_store_id,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        return {
            "message": f"Manager transféré vers {new_store.get('name')}",
            "manager_id": manager_id,
            "new_store_id": new_store_id
        }
    
    async def get_all_managers(self, gerant_id: str) -> list:
        """Get all managers (active and suspended, excluding deleted)"""
        managers = await self.user_repo.find_many(
            {
                "gerant_id": gerant_id,
                "role": "manager",
                "status": {"$ne": "deleted"}
            },
            {"_id": 0, "password": 0}
        )
        return managers
    
    async def get_all_sellers(self, gerant_id: str) -> list:
        """Get all sellers (active and suspended, excluding deleted)"""
        sellers = await self.user_repo.find_many(
            {
                "gerant_id": gerant_id,
                "role": "seller",
                "status": {"$ne": "deleted"}
            },
            {"_id": 0, "password": 0}
        )
        return sellers
    
    async def get_store_stats(
        self,
        store_id: str,
        gerant_id: str,
        period_type: str = 'week',
        period_offset: int = 0
    ) -> Dict:
        """
        Get detailed statistics for a specific store
        
        Args:
            store_id: Store ID
            gerant_id: Gérant ID (for ownership verification)
            period_type: 'week', 'month', or 'year'
            period_offset: Number of periods to offset (0=current, -1=previous, etc.)
        """
        from datetime import timedelta
        
        # Verify store ownership
        store = await self.store_repo.find_one(
            {"id": store_id, "gerant_id": gerant_id},
            {"_id": 0}
        )
        
        if not store:
            raise ValueError("Store not found or access denied")
        
        # Count managers and sellers
        managers_count = await self.user_repo.count({
            "store_id": store_id,
            "role": "manager",
            "status": "active"
        })
        
        sellers_count = await self.user_repo.count({
            "store_id": store_id,
            "role": "seller",
            "status": "active"
        })
        
        # Calculate today's KPIs
        today = datetime.now(timezone.utc).strftime('%Y-%m-%d')
        
        # Sellers KPIs today
        sellers_today = await self.db.kpi_entries.aggregate([
            {"$match": {"store_id": store_id, "date": today}},
            {"$group": {
                "_id": None,
                "total_ca": {"$sum": {"$ifNull": ["$seller_ca", {"$ifNull": ["$ca_journalier", 0]}]}},
                "total_ventes": {"$sum": {"$ifNull": ["$nb_ventes", 0]}},
                "total_articles": {"$sum": {"$ifNull": ["$nb_articles", 0]}}
            }}
        ]).to_list(1)
        
        # Managers KPIs today
        managers_today = await self.db.manager_kpis.aggregate([
            {"$match": {"store_id": store_id, "date": today}},
            {"$group": {
                "_id": None,
                "total_ca": {"$sum": {"$ifNull": ["$ca_journalier", 0]}},
                "total_ventes": {"$sum": {"$ifNull": ["$nb_ventes", 0]}},
                "total_articles": {"$sum": {"$ifNull": ["$nb_articles", 0]}}
            }}
        ]).to_list(1)
        
        sellers_ca = sellers_today[0].get("total_ca", 0) if sellers_today else 0
        sellers_ventes = sellers_today[0].get("total_ventes", 0) if sellers_today else 0
        sellers_articles = sellers_today[0].get("total_articles", 0) if sellers_today else 0
        
        managers_ca = managers_today[0].get("total_ca", 0) if managers_today else 0
        managers_ventes = managers_today[0].get("total_ventes", 0) if managers_today else 0
        managers_articles = managers_today[0].get("total_articles", 0) if managers_today else 0
        
        # Calculate period dates
        today_date = datetime.now(timezone.utc)
        
        if period_type == 'week':
            days_since_monday = today_date.weekday()
            current_monday = today_date - timedelta(days=days_since_monday)
            target_monday = current_monday + timedelta(weeks=period_offset)
            target_sunday = target_monday + timedelta(days=6)
            period_start = target_monday.strftime('%Y-%m-%d')
            period_end = target_sunday.strftime('%Y-%m-%d')
            prev_start = (target_monday - timedelta(weeks=1)).strftime('%Y-%m-%d')
            prev_end = (target_monday - timedelta(days=1)).strftime('%Y-%m-%d')
        elif period_type == 'month':
            target_month = today_date.replace(day=1) + timedelta(days=32 * period_offset)
            target_month = target_month.replace(day=1)
            period_start = target_month.strftime('%Y-%m-%d')
            next_month = target_month.replace(day=28) + timedelta(days=4)
            period_end = (next_month.replace(day=1) - timedelta(days=1)).strftime('%Y-%m-%d')
            prev_month = target_month - timedelta(days=1)
            prev_start = prev_month.replace(day=1).strftime('%Y-%m-%d')
            prev_end = (target_month - timedelta(days=1)).strftime('%Y-%m-%d')
        elif period_type == 'year':
            target_year = today_date.year + period_offset
            period_start = f"{target_year}-01-01"
            period_end = f"{target_year}-12-31"
            prev_start = f"{target_year-1}-01-01"
            prev_end = f"{target_year-1}-12-31"
        else:
            raise ValueError("Invalid period_type. Must be 'week', 'month', or 'year'")
        
        # Get period KPIs
        period_sellers = await self.db.kpi_entries.aggregate([
            {"$match": {"store_id": store_id, "date": {"$gte": period_start, "$lte": period_end}}},
            {"$group": {
                "_id": None,
                "total_ca": {"$sum": {"$ifNull": ["$seller_ca", {"$ifNull": ["$ca_journalier", 0]}]}},
                "total_ventes": {"$sum": {"$ifNull": ["$nb_ventes", 0]}}
            }}
        ]).to_list(1)
        
        period_managers = await self.db.manager_kpis.aggregate([
            {"$match": {"store_id": store_id, "date": {"$gte": period_start, "$lte": period_end}}},
            {"$group": {
                "_id": None,
                "total_ca": {"$sum": {"$ifNull": ["$ca_journalier", 0]}},
                "total_ventes": {"$sum": {"$ifNull": ["$nb_ventes", 0]}}
            }}
        ]).to_list(1)
        
        period_ca = (period_sellers[0].get("total_ca", 0) if period_sellers else 0) + \
                    (period_managers[0].get("total_ca", 0) if period_managers else 0)
        period_ventes = (period_sellers[0].get("total_ventes", 0) if period_sellers else 0) + \
                        (period_managers[0].get("total_ventes", 0) if period_managers else 0)
        
        # Get previous period KPIs for evolution
        prev_sellers = await self.db.kpi_entries.aggregate([
            {"$match": {"store_id": store_id, "date": {"$gte": prev_start, "$lte": prev_end}}},
            {"$group": {"_id": None, "total_ca": {"$sum": {"$ifNull": ["$seller_ca", {"$ifNull": ["$ca_journalier", 0]}]}}}}
        ]).to_list(1)
        
        prev_managers = await self.db.manager_kpis.aggregate([
            {"$match": {"store_id": store_id, "date": {"$gte": prev_start, "$lte": prev_end}}},
            {"$group": {"_id": None, "total_ca": {"$sum": {"$ifNull": ["$ca_journalier", 0]}}}}
        ]).to_list(1)
        
        prev_ca = (prev_sellers[0].get("total_ca", 0) if prev_sellers else 0) + \
                  (prev_managers[0].get("total_ca", 0) if prev_managers else 0)
        
        # Calculate evolution
        ca_evolution = ((period_ca - prev_ca) / prev_ca * 100) if prev_ca > 0 else 0
        
        return {
            "store": store,
            "managers_count": managers_count,
            "sellers_count": sellers_count,
            "today": {
                "total_ca": sellers_ca + managers_ca,
                "total_ventes": sellers_ventes + managers_ventes,
                "total_articles": sellers_articles + managers_articles
            },
            "period": {
                "type": period_type,
                "offset": period_offset,
                "start": period_start,
                "end": period_end,
                "ca": period_ca,
                "ventes": period_ventes,
                "ca_evolution": round(ca_evolution, 2)
            },
            "previous_period": {
                "start": prev_start,
                "end": prev_end,
                "ca": prev_ca
            }
        }
    
    async def get_dashboard_stats(self, gerant_id: str) -> Dict:
        """
        Get aggregated dashboard statistics for a gérant
        
        Args:
            gerant_id: Gérant user ID
            
        Returns:
            Dict with store counts, user counts, and monthly KPI aggregations
        """
        # Get all active stores with pending invitation counts
        stores = await self.get_all_stores(gerant_id)
        
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
    
    async def get_store_kpi_history(self, store_id: str, user_id: str, days: int = 30, start_date_str: str = None, end_date_str: str = None) -> list:
        """
        Get historical KPI data for a specific store
        
        Args:
            store_id: Store identifier
            user_id: User ID (gérant owner or assigned manager)
            days: Number of days to retrieve (default: 30) - used if no dates
            start_date_str: Start date in YYYY-MM-DD format (optional)
            end_date_str: End date in YYYY-MM-DD format (optional)
        
        Returns:
            List of daily aggregated KPI data sorted by date
        
        Security: Accessible to gérants (owner) and managers (assigned)
        """
        from datetime import timedelta
        
        # First check if user is a gérant who owns this store
        store = await self.store_repo.find_one(
            {"id": store_id, "gerant_id": user_id, "active": True},
            {"_id": 0}
        )
        
        # If not gérant, check if user is a manager assigned to this store
        if not store:
            user = await self.db.users.find_one({"id": user_id}, {"_id": 0})
            if user and user.get('role') == 'manager' and user.get('store_id') == store_id:
                store = await self.store_repo.find_one(
                    {"id": store_id, "active": True},
                    {"_id": 0}
                )
        
        if not store:
            raise ValueError("Magasin non trouvé ou accès non autorisé")
        
        # Calculate date range
        if start_date_str and end_date_str:
            # Use provided dates
            start_date_query = start_date_str
            end_date_query = end_date_str
        else:
            # Use days parameter
            end_date = datetime.now(timezone.utc)
            start_date = end_date - timedelta(days=days)
            start_date_query = start_date.strftime('%Y-%m-%d')
            end_date_query = end_date.strftime('%Y-%m-%d')
        
        # Get ALL KPI entries for this store directly by store_id
        seller_entries = await self.db.kpi_entries.find({
            "store_id": store_id,
            "date": {"$gte": start_date_query, "$lte": end_date_query}
        }, {"_id": 0}).to_list(10000)
        
        # Get manager KPIs for this store
        manager_kpis = await self.db.manager_kpi.find({
            "store_id": store_id,
            "date": {"$gte": start_date_query, "$lte": end_date_query}
        }, {"_id": 0}).to_list(10000)
        
        # Aggregate data by date
        date_map = {}
        
        # Add manager KPIs
        for kpi in manager_kpis:
            date = kpi['date']
            if date not in date_map:
                date_map[date] = {
                    "date": date,
                    "ca_journalier": 0,
                    "nb_ventes": 0,
                    "nb_clients": 0,
                    "nb_articles": 0,
                    "nb_prospects": 0
                }
            date_map[date]["ca_journalier"] += kpi.get("ca_journalier") or 0
            date_map[date]["nb_ventes"] += kpi.get("nb_ventes") or 0
            date_map[date]["nb_clients"] += kpi.get("nb_clients") or 0
            date_map[date]["nb_articles"] += kpi.get("nb_articles") or 0
            date_map[date]["nb_prospects"] += kpi.get("nb_prospects") or 0
        
        # Add seller entries
        for entry in seller_entries:
            date = entry['date']
            if date not in date_map:
                date_map[date] = {
                    "date": date,
                    "ca_journalier": 0,
                    "nb_ventes": 0,
                    "nb_clients": 0,
                    "nb_articles": 0,
                    "nb_prospects": 0
                }
            # Handle both field names for CA
            ca_value = entry.get("seller_ca") or entry.get("ca_journalier") or 0
            date_map[date]["ca_journalier"] += ca_value
            date_map[date]["nb_ventes"] += entry.get("nb_ventes") or 0
            date_map[date]["nb_clients"] += entry.get("nb_clients") or 0
            date_map[date]["nb_articles"] += entry.get("nb_articles") or 0
            date_map[date]["nb_prospects"] += entry.get("nb_prospects") or 0
        
        # Convert to sorted list
        historical_data = sorted(date_map.values(), key=lambda x: x['date'])
        
        return historical_data

    async def get_store_available_years(self, store_id: str, user_id: str) -> Dict:
        """
        Get available years with KPI data for this store
        
        Returns dict with 'years' list (integers) in descending order (most recent first)
        Used for date filter dropdowns in the frontend
        
        Security: Accessible to gérants (owner) and managers (assigned)
        """
        # First check if user is a gérant who owns this store
        store = await self.store_repo.find_one(
            {"id": store_id, "gerant_id": user_id, "active": True},
            {"_id": 0}
        )
        
        # If not gérant, check if user is a manager assigned to this store
        if not store:
            user = await self.db.users.find_one({"id": user_id}, {"_id": 0})
            if user and user.get('role') == 'manager' and user.get('store_id') == store_id:
                store = await self.store_repo.find_one(
                    {"id": store_id, "active": True},
                    {"_id": 0}
                )
        
        if not store:
            raise ValueError("Magasin non trouvé ou accès non autorisé")
        
        # Get distinct years from kpi_entries
        kpi_years = await self.db.kpi_entries.distinct("date", {"store_id": store_id})
        years_set = set()
        for date_str in kpi_years:
            if date_str and len(date_str) >= 4:
                year = int(date_str[:4])
                years_set.add(year)
        
        # Get distinct years from manager_kpi
        manager_years = await self.db.manager_kpi.distinct("date", {"store_id": store_id})
        for date_str in manager_years:
            if date_str and len(date_str) >= 4:
                year = int(date_str[:4])
                years_set.add(year)
        
        # Sort descending (most recent first)
        years = sorted(list(years_set), reverse=True)
        
        return {"years": years}

    async def transfer_seller_to_store(
        self, 
        seller_id: str, 
        transfer_data: Dict, 
        gerant_id: str
    ) -> Dict:
        """
        Transfer a seller to another store with a new manager
        
        Args:
            seller_id: Seller user ID
            transfer_data: {"new_store_id": "...", "new_manager_id": "..."}
            gerant_id: Current gérant ID for authorization
        
        Returns:
            Dict with success status and message
        """
        from models.sellers import SellerTransfer
        
        # Validate input
        try:
            transfer = SellerTransfer(**transfer_data)
        except Exception as e:
            raise ValueError(f"Invalid transfer data: {str(e)}")
        
        # Verify seller exists and belongs to current gérant
        seller = await self.user_repo.find_one({
            "id": seller_id,
            "gerant_id": gerant_id,
            "role": "seller"
        }, {"_id": 0})
        
        if not seller:
            raise ValueError("Vendeur non trouvé ou accès non autorisé")
        
        # Verify new store exists, is active, and belongs to current gérant
        new_store = await self.store_repo.find_one({
            "id": transfer.new_store_id,
            "gerant_id": gerant_id
        }, {"_id": 0})
        
        if not new_store:
            raise ValueError("Nouveau magasin non trouvé ou accès non autorisé")
        
        if not new_store.get('active', False):
            raise ValueError(
                f"Le magasin '{new_store['name']}' est inactif. Impossible de transférer vers un magasin inactif."
            )
        
        # Verify new manager exists and is in the new store
        new_manager = await self.user_repo.find_one({
            "id": transfer.new_manager_id,
            "store_id": transfer.new_store_id,
            "role": "manager",
            "status": "active"
        }, {"_id": 0})
        
        if not new_manager:
            raise ValueError("Manager non trouvé dans ce magasin ou manager inactif")
        
        # Prepare update fields
        update_fields = {
            "store_id": transfer.new_store_id,
            "manager_id": transfer.new_manager_id,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        unset_fields = {}
        
        # Auto-reactivation if seller was suspended due to inactive store
        if seller.get('status') == 'suspended' and seller.get('suspended_reason', '').startswith('Magasin'):
            update_fields["status"] = "active"
            update_fields["reactivated_at"] = datetime.now(timezone.utc).isoformat()
            unset_fields = {
                "suspended_at": "",
                "suspended_by": "",
                "suspended_reason": ""
            }
        
        # Execute transfer
        update_operation = {"$set": update_fields}
        if unset_fields:
            update_operation["$unset"] = unset_fields
        
        await self.db.users.update_one(
            {"id": seller_id},
            update_operation
        )
        
        # Build response message
        message = f"Vendeur transféré avec succès vers {new_store['name']}"
        if update_fields.get("status") == "active":
            message += " et réactivé automatiquement"
        
        return {
            "success": True,
            "message": message,
            "new_store": new_store['name'],
            "new_manager": new_manager['name'],
            "reactivated": update_fields.get("status") == "active"
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

    
    # ===== STORE DETAIL METHODS (for Store Detail Pages) =====
    
    async def get_store_managers(self, store_id: str, gerant_id: str) -> list:
        """
        Get all managers for a specific store (exclude deleted)
        
        Security: Verifies store ownership
        """
        # Verify store ownership
        store = await self.db.stores.find_one(
            {"id": store_id, "gerant_id": gerant_id, "active": True},
            {"_id": 0}
        )
        if not store:
            raise Exception("Magasin non trouvé ou accès non autorisé")
        
        # Get managers (exclude deleted ones)
        managers = await self.db.users.find(
            {
                "store_id": store_id, 
                "role": "manager",
                "status": {"$ne": "deleted"}
            },
            {"_id": 0, "password": 0}
        ).to_list(100)
        
        return managers
    
    async def get_store_sellers(self, store_id: str, gerant_id: str) -> list:
        """
        Get all sellers for a specific store (exclude deleted)
        
        Security: Verifies store ownership
        """
        # Verify store ownership
        store = await self.db.stores.find_one(
            {"id": store_id, "gerant_id": gerant_id, "active": True},
            {"_id": 0}
        )
        if not store:
            raise Exception("Magasin non trouvé ou accès non autorisé")
        
        # Get sellers (exclude deleted ones)
        sellers = await self.db.users.find(
            {
                "store_id": store_id, 
                "role": "seller",
                "status": {"$ne": "deleted"}
            },
            {"_id": 0, "password": 0}
        ).to_list(1000)
        
        return sellers
    
    async def get_store_kpi_overview(self, store_id: str, user_id: str, date: str = None) -> Dict:
        """
        Get consolidated store KPI overview for a specific date
        
        Returns:
        - Store info
        - Manager aggregated data
        - Seller aggregated data
        - Individual seller entries
        - Calculated KPIs (panier moyen, taux transformation, indice vente)
        
        Security: Verifies store ownership (gérant) or assignment (manager)
        """
        from datetime import datetime, timezone
        
        # First check if user is a gérant who owns this store
        store = await self.db.stores.find_one(
            {"id": store_id, "gerant_id": user_id, "active": True},
            {"_id": 0}
        )
        
        # If not gérant, check if user is a manager assigned to this store
        if not store:
            user = await self.db.users.find_one({"id": user_id}, {"_id": 0})
            if user and user.get('role') == 'manager' and user.get('store_id') == store_id:
                store = await self.db.stores.find_one(
                    {"id": store_id, "active": True},
                    {"_id": 0}
                )
        
        if not store:
            raise Exception("Magasin non trouvé ou accès non autorisé")
        
        # Default to today
        if not date:
            date = datetime.now(timezone.utc).strftime('%Y-%m-%d')
        
        # Get all managers and sellers in this store
        managers = await self.db.users.find({
            "store_id": store_id,
            "role": "manager",
            "status": "active"
        }, {"_id": 0, "id": 1, "name": 1}).to_list(100)
        
        sellers = await self.db.users.find({
            "store_id": store_id,
            "role": "seller",
            "status": "active"
        }, {"_id": 0, "id": 1, "name": 1}).to_list(100)
        
        # Get ALL KPI entries for this store directly by store_id
        seller_entries = await self.db.kpi_entries.find({
            "store_id": store_id,
            "date": date
        }, {"_id": 0}).to_list(100)
        
        # Enrich seller entries with names
        for entry in seller_entries:
            seller = next((s for s in sellers if s['id'] == entry.get('seller_id')), None)
            if seller:
                entry['seller_name'] = seller['name']
            else:
                entry['seller_name'] = entry.get('seller_name', 'Vendeur (historique)')
        
        # Get manager KPIs for this store
        manager_kpis_list = await self.db.manager_kpi.find({
            "store_id": store_id,
            "date": date
        }, {"_id": 0}).to_list(100)
        
        # Aggregate totals from managers
        managers_total = {
            "ca_journalier": sum((kpi.get("ca_journalier") or 0) for kpi in manager_kpis_list),
            "nb_ventes": sum((kpi.get("nb_ventes") or 0) for kpi in manager_kpis_list),
            "nb_clients": sum((kpi.get("nb_clients") or 0) for kpi in manager_kpis_list),
            "nb_articles": sum((kpi.get("nb_articles") or 0) for kpi in manager_kpis_list),
            "nb_prospects": sum((kpi.get("nb_prospects") or 0) for kpi in manager_kpis_list)
        }
        
        # Aggregate totals from sellers
        sellers_total = {
            "ca_journalier": sum((entry.get("seller_ca") or entry.get("ca_journalier") or 0) for entry in seller_entries),
            "nb_ventes": sum((entry.get("nb_ventes") or 0) for entry in seller_entries),
            "nb_clients": sum((entry.get("nb_clients") or 0) for entry in seller_entries),
            "nb_articles": sum((entry.get("nb_articles") or 0) for entry in seller_entries),
            "nb_prospects": sum((entry.get("nb_prospects") or 0) for entry in seller_entries),
            "nb_sellers_reported": len(seller_entries)
        }
        
        # Calculate store totals
        total_ca = managers_total["ca_journalier"] + sellers_total["ca_journalier"]
        total_ventes = managers_total["nb_ventes"] + sellers_total["nb_ventes"]
        total_clients = managers_total["nb_clients"] + sellers_total["nb_clients"]
        total_articles = managers_total["nb_articles"] + sellers_total["nb_articles"]
        total_prospects = managers_total["nb_prospects"] + sellers_total["nb_prospects"]
        
        # Calculate derived KPIs
        calculated_kpis = {
            "panier_moyen": round(total_ca / total_ventes, 2) if total_ventes > 0 else None,
            "taux_transformation": round((total_ventes / total_prospects) * 100, 2) if total_prospects > 0 else None,
            "indice_vente": round(total_articles / total_ventes, 2) if total_ventes > 0 else None
        }
        
        return {
            "date": date,
            "store": store,
            "managers_data": managers_total,
            "sellers_data": sellers_total,
            "seller_entries": seller_entries,
            "total_managers": len(managers),
            "total_sellers": len(sellers),
            "sellers_reported": len(seller_entries),
            "calculated_kpis": calculated_kpis,
            "totals": {
                "ca": total_ca,
                "ventes": total_ventes,
                "clients": total_clients,
                "articles": total_articles,
                "prospects": total_prospects
            },
            "kpi_config": {
                "seller_track_ca": True,
                "seller_track_ventes": True,
                "seller_track_clients": True,
                "seller_track_articles": True,
                "seller_track_prospects": True
            }
        }
    # Duplicate methods removed - moved to earlier in the file
    
    # ===== INVITATION METHODS =====
    
    async def send_invitation(self, invitation_data: Dict, gerant_id: str) -> Dict:
        """
        Send an invitation to a new manager or seller.
        
        Args:
            invitation_data: Contains name, email, role, store_id
            gerant_id: ID of the gérant sending the invitation
        """
        from uuid import uuid4
        import os
        
        # === GUARD CLAUSE: Check subscription access ===
        await self.check_gerant_active_access(gerant_id)
        
        name = invitation_data.get('name')
        email = invitation_data.get('email')
        role = invitation_data.get('role')
        store_id = invitation_data.get('store_id')
        
        if not all([name, email, role, store_id]):
            raise ValueError("Tous les champs sont requis: name, email, role, store_id")
        
        if role not in ['manager', 'seller']:
            raise ValueError("Le rôle doit être 'manager' ou 'seller'")
        
        # Verify store belongs to this gérant
        store = await self.store_repo.find_one(
            {"id": store_id, "gerant_id": gerant_id, "active": True}
        )
        if not store:
            raise ValueError("Magasin non trouvé ou inactif")
        
        # Check if email already exists
        existing_user = await self.user_repo.find_one({"email": email})
        if existing_user:
            raise ValueError("Un utilisateur avec cet email existe déjà")
        
        # Check for pending invitation
        existing_invitation = await self.db.gerant_invitations.find_one({
            "email": email,
            "status": "pending"
        })
        if existing_invitation:
            raise ValueError("Une invitation est déjà en attente pour cet email")
        
        # Create invitation
        invitation_id = str(uuid4())
        token = str(uuid4())
        
        invitation = {
            "id": invitation_id,
            "token": token,
            "email": email,
            "name": name,
            "role": role,
            "store_id": store_id,
            "store_name": store.get('name'),
            "gerant_id": gerant_id,
            "status": "pending",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "expires_at": (datetime.now(timezone.utc).replace(hour=0, minute=0, second=0) + 
                         __import__('datetime').timedelta(days=7)).isoformat()
        }
        
        await self.db.gerant_invitations.insert_one(invitation)
        
        # Send email
        try:
            await self._send_invitation_email(invitation)
        except Exception as e:
            logger.error(f"Failed to send invitation email: {e}")
            # Continue even if email fails - invitation is created
        
        return {
            "message": "Invitation envoyée avec succès",
            "invitation_id": invitation_id
        }
    
    async def _send_invitation_email(self, invitation: Dict):
        """Send invitation email using Brevo"""
        import httpx
        from dotenv import dotenv_values
        
        # Load from .env file directly
        env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env')
        env_vars = dotenv_values(env_path)
        
        brevo_api_key = env_vars.get('BREVO_API_KEY') or os.environ.get('BREVO_API_KEY')
        frontend_url = env_vars.get('FRONTEND_URL') or os.environ.get('FRONTEND_URL', 'http://localhost:3000')
        
        if not brevo_api_key:
            logger.warning("BREVO_API_KEY not set, skipping email")
            return
        
        logger.info(f"Sending invitation email to {invitation['email']}")
        
        role_text = "Manager" if invitation['role'] == 'manager' else "Vendeur"
        invitation_link = f"{frontend_url}/invitation/{invitation['token']}"
        
        email_content = f"""
        <!DOCTYPE html>
        <html>
        <head><meta charset="UTF-8"></head>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0;">
                <h1 style="color: white; margin: 0; text-align: center;">Retail Coach</h1>
            </div>
            <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px;">
                <h2 style="color: #1f2937;">Invitation à rejoindre l'équipe</h2>
                <p style="color: #4b5563;">Bonjour <strong>{invitation['name']}</strong>,</p>
                <p style="color: #4b5563;">Vous avez été invité(e) à rejoindre l'équipe de <strong>{invitation['store_name']}</strong> en tant que <strong>{role_text}</strong>.</p>
                <p style="color: #4b5563;">Cliquez sur le bouton ci-dessous pour créer votre compte et accéder à la plateforme :</p>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="{invitation_link}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold;">Accepter l'invitation</a>
                </div>
                <p style="color: #9ca3af; font-size: 14px;">Ce lien expire dans 7 jours.</p>
                <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
                <p style="color: #9ca3af; font-size: 12px; text-align: center;">
                    Cet email a été envoyé par Retail Coach.<br>
                    Si vous n'attendiez pas cette invitation, vous pouvez ignorer cet email.
                </p>
            </div>
        </body>
        </html>
        """
        
        # Get sender email from environment
        sender_email = env_vars.get('SENDER_EMAIL') or os.environ.get('SENDER_EMAIL', 'hello@retailperformerai.com')
        sender_name = env_vars.get('SENDER_NAME') or os.environ.get('SENDER_NAME', 'Retail Performer AI')
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                payload = {
                    "sender": {"name": sender_name, "email": sender_email},
                    "to": [{"email": invitation['email'], "name": invitation['name']}],
                    "subject": f"🎉 Invitation à rejoindre {invitation['store_name']}",
                    "htmlContent": email_content
                }
                
                logger.info(f"📧 Sending email via Brevo:")
                logger.info(f"   - From: {sender_name} <{sender_email}>")
                logger.info(f"   - To: {invitation['name']} <{invitation['email']}>")
                logger.info(f"   - Subject: Invitation à rejoindre {invitation['store_name']}")
                
                response = await client.post(
                    "https://api.brevo.com/v3/smtp/email",
                    headers={
                        "api-key": brevo_api_key,
                        "Content-Type": "application/json"
                    },
                    json=payload
                )
                
                if response.status_code in [200, 201]:
                    response_data = response.json() if response.text else {}
                    message_id = response_data.get('messageId', 'N/A')
                    logger.info(f"✅ Email sent successfully to {invitation['email']}")
                    logger.info(f"   - Brevo Response: {response.status_code}")
                    logger.info(f"   - Message ID: {message_id}")
                else:
                    logger.error(f"❌ Brevo API error ({response.status_code}): {response.text}")
        except Exception as e:
            logger.error(f"❌ Failed to send email: {str(e)}")
    
    async def get_invitations(self, gerant_id: str) -> list:
        """Get all invitations sent by this gérant"""
        invitations = await self.db.gerant_invitations.find(
            {"gerant_id": gerant_id},
            {"_id": 0}
        ).sort("created_at", -1).to_list(100)
        
        return invitations
    
    async def cancel_invitation(self, invitation_id: str, gerant_id: str) -> Dict:
        """Cancel a pending invitation"""
        invitation = await self.db.gerant_invitations.find_one({
            "id": invitation_id,
            "gerant_id": gerant_id
        })
        
        if not invitation:
            raise ValueError("Invitation non trouvée")
        
        if invitation.get('status') != 'pending':
            raise ValueError("Seules les invitations en attente peuvent être annulées")
        
        await self.db.gerant_invitations.update_one(
            {"id": invitation_id},
            {"$set": {"status": "cancelled", "cancelled_at": datetime.now(timezone.utc).isoformat()}}
        )
        
        return {"message": "Invitation annulée"}

    async def resend_invitation(self, invitation_id: str, gerant_id: str) -> Dict:
        """Resend an invitation email"""
        from uuid import uuid4
        
        invitation = await self.db.gerant_invitations.find_one({
            "id": invitation_id,
            "gerant_id": gerant_id
        })
        
        if not invitation:
            raise ValueError("Invitation non trouvée")
        
        if invitation.get('status') not in ['pending', 'expired']:
            raise ValueError("Seules les invitations en attente ou expirées peuvent être renvoyées")
        
        # Generate new token and update expiration
        new_token = str(uuid4())
        new_expiry = (datetime.now(timezone.utc).replace(hour=0, minute=0, second=0) + timedelta(days=7)).isoformat()
        
        await self.db.gerant_invitations.update_one(
            {"id": invitation_id},
            {"$set": {
                "token": new_token,
                "status": "pending",
                "expires_at": new_expiry,
                "resent_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        # Refresh invitation data with new token
        invitation['token'] = new_token
        
        # Send email
        try:
            await self._send_invitation_email(invitation)
            return {"message": "Invitation renvoyée avec succès"}
        except Exception as e:
            logger.error(f"Failed to resend invitation email: {e}")
            return {"message": "Invitation mise à jour mais email non envoyé"}

    # ===== USER SUSPEND/REACTIVATE/DELETE METHODS =====
    
    async def suspend_user(self, user_id: str, gerant_id: str, role: str) -> Dict:
        """
        Suspend a manager or seller
        
        Args:
            user_id: User ID to suspend
            gerant_id: Gérant ID for authorization
            role: 'manager' or 'seller'
        """
        # === GUARD CLAUSE: Check subscription access ===
        await self.check_gerant_active_access(gerant_id)
        
        user = await self.user_repo.find_one({
            "id": user_id,
            "gerant_id": gerant_id,
            "role": role
        })
        
        if not user:
            raise ValueError(f"{role.capitalize()} non trouvé")
        
        if user.get('status') == 'suspended':
            raise ValueError(f"Ce {role} est déjà suspendu")
        
        if user.get('status') == 'deleted':
            raise ValueError(f"Ce {role} a été supprimé")
        
        await self.db.users.update_one(
            {"id": user_id},
            {"$set": {
                "status": "suspended",
                "suspended_at": datetime.now(timezone.utc).isoformat(),
                "suspended_by": gerant_id,
                "suspended_reason": "Suspendu par le gérant"
            }}
        )
        
        return {"message": f"{role.capitalize()} suspendu avec succès"}
    
    async def reactivate_user(self, user_id: str, gerant_id: str, role: str) -> Dict:
        """
        Reactivate a suspended manager or seller
        
        Args:
            user_id: User ID to reactivate
            gerant_id: Gérant ID for authorization
            role: 'manager' or 'seller'
        """
        # === GUARD CLAUSE: Check subscription access ===
        await self.check_gerant_active_access(gerant_id)
        
        user = await self.user_repo.find_one({
            "id": user_id,
            "gerant_id": gerant_id,
            "role": role
        })
        
        if not user:
            raise ValueError(f"{role.capitalize()} non trouvé")
        
        if user.get('status') != 'suspended':
            raise ValueError(f"Ce {role} n'est pas suspendu")
        
        await self.db.users.update_one(
            {"id": user_id},
            {
                "$set": {
                    "status": "active",
                    "reactivated_at": datetime.now(timezone.utc).isoformat(),
                    "reactivated_by": gerant_id
                },
                "$unset": {
                    "suspended_at": "",
                    "suspended_by": "",
                    "suspended_reason": ""
                }
            }
        )
        
        return {"message": f"{role.capitalize()} réactivé avec succès"}
    
    async def delete_user(self, user_id: str, gerant_id: str, role: str) -> Dict:
        """
        Soft delete a manager or seller (set status to 'deleted')
        
        Args:
            user_id: User ID to delete
            gerant_id: Gérant ID for authorization
            role: 'manager' or 'seller'
        """
        # === GUARD CLAUSE: Check subscription access ===
        await self.check_gerant_active_access(gerant_id)
        
        user = await self.user_repo.find_one({
            "id": user_id,
            "gerant_id": gerant_id,
            "role": role
        })
        
        if not user:
            raise ValueError(f"{role.capitalize()} non trouvé")
        
        if user.get('status') == 'deleted':
            raise ValueError(f"Ce {role} a déjà été supprimé")
        
        await self.db.users.update_one(
            {"id": user_id},
            {"$set": {
                "status": "deleted",
                "deleted_at": datetime.now(timezone.utc).isoformat(),
                "deleted_by": gerant_id
            }}
        )
        
        return {"message": f"{role.capitalize()} supprimé avec succès"}


    # ============================================
    # BULK IMPORT OPERATIONS (Migré depuis EnterpriseService)
    # ============================================
    
    async def bulk_import_stores(
        self,
        gerant_id: str,
        workspace_id: str,
        stores: list,
        mode: str = "create_or_update"
    ) -> Dict:
        """
        Import massif de magasins pour un Gérant.
        
        Adapté depuis EnterpriseService pour utiliser workspace_id au lieu de enterprise_account_id.
        
        Args:
            gerant_id: ID du gérant effectuant l'import
            workspace_id: ID du workspace du gérant
            stores: Liste de dictionnaires magasin [{name, location, address, phone, external_id}, ...]
            mode: "create_only" | "update_only" | "create_or_update"
            
        Returns:
            Dict avec résultats: total_processed, created, updated, failed, errors
        """
        from pymongo import UpdateOne, InsertOne
        from uuid import uuid4
        
        # === GUARD CLAUSE: Check subscription access ===
        await self.check_gerant_active_access(gerant_id)
        
        results = {
            "total_processed": 0,
            "created": 0,
            "updated": 0,
            "failed": 0,
            "errors": []
        }
        
        if not stores:
            return results
        
        # PHASE 1: Pre-load existing stores (1 query for all)
        store_names = [s.get('name') for s in stores if s.get('name')]
        external_ids = [s.get('external_id') for s in stores if s.get('external_id')]
        
        query = {"$or": [], "workspace_id": workspace_id}
        if store_names:
            query["$or"].append({"name": {"$in": store_names}})
        if external_ids:
            query["$or"].append({"external_id": {"$in": external_ids}})
        
        existing_stores_map = {}
        if query["$or"]:
            existing_stores_cursor = self.store_repo.collection.find(
                query,
                {"_id": 0, "id": 1, "name": 1, "external_id": 1, "location": 1}
            )
            for store in await existing_stores_cursor.to_list(length=None):
                if store.get('external_id'):
                    existing_stores_map[store['external_id']] = store
                existing_stores_map[store['name']] = store
        
        # PHASE 2: Build bulk operations list in memory
        bulk_operations = []
        
        for store_data in stores:
            results["total_processed"] += 1
            
            try:
                # Validation
                if not store_data.get('name'):
                    results["failed"] += 1
                    results["errors"].append({
                        "name": store_data.get('name', 'unknown'),
                        "error": "Champ requis manquant: name"
                    })
                    continue
                
                # Find existing store by external_id or name
                lookup_key = store_data.get('external_id') or store_data['name']
                existing_store = existing_stores_map.get(lookup_key)
                
                if existing_store:
                    # Update mode
                    if mode in ["update_only", "create_or_update"]:
                        update_fields = {
                            "name": store_data['name'],
                            "location": store_data.get('location', existing_store.get('location', '')),
                            "active": True,
                            "updated_at": datetime.now(timezone.utc).isoformat()
                        }
                        
                        if store_data.get('address'):
                            update_fields['address'] = store_data['address']
                        if store_data.get('phone'):
                            update_fields['phone'] = store_data['phone']
                        if store_data.get('external_id'):
                            update_fields['external_id'] = store_data['external_id']
                        
                        bulk_operations.append(
                            UpdateOne(
                                {"id": existing_store['id']},
                                {"$set": update_fields}
                            )
                        )
                        results["updated"] += 1
                    else:
                        results["failed"] += 1
                        results["errors"].append({
                            "name": store_data['name'],
                            "error": "Le magasin existe déjà (mode=create_only)"
                        })
                else:
                    # Create mode
                    if mode in ["create_only", "create_or_update"]:
                        store_id = str(uuid4())
                        new_store = {
                            "id": store_id,
                            "name": store_data['name'],
                            "location": store_data.get('location', ''),
                            "workspace_id": workspace_id,
                            "gerant_id": gerant_id,
                            "active": True,
                            "address": store_data.get('address'),
                            "phone": store_data.get('phone'),
                            "external_id": store_data.get('external_id'),
                            "created_at": datetime.now(timezone.utc).isoformat(),
                            "updated_at": datetime.now(timezone.utc).isoformat()
                        }
                        
                        bulk_operations.append(InsertOne(new_store))
                        results["created"] += 1
                    else:
                        results["failed"] += 1
                        results["errors"].append({
                            "name": store_data['name'],
                            "error": "Le magasin n'existe pas (mode=update_only)"
                        })
                        
            except Exception as e:
                results["failed"] += 1
                results["errors"].append({
                    "name": store_data.get('name', 'unknown'),
                    "error": str(e)
                })
                logger.error(f"Erreur import magasin {store_data.get('name')}: {str(e)}")
        
        # PHASE 3: Execute bulk write (ordered=False for performance)
        if bulk_operations:
            try:
                await self.store_repo.collection.bulk_write(
                    bulk_operations,
                    ordered=False  # Continue on error
                )
                logger.info(f"✅ Import massif magasins: {results['created']} créés, {results['updated']} mis à jour")
            except Exception as e:
                logger.error(f"Erreur bulk write: {str(e)}")
                # Some operations may have succeeded
        
        return results

