"""
Gérant Service
Business logic for gérant dashboard, subscription, and workspace management
"""
from typing import Dict, Optional, List
from datetime import datetime, timezone, timedelta
import logging
import os
from core.exceptions import ForbiddenError, BusinessLogicError

from models.pagination import PaginatedResponse
from utils.pagination import paginate
from repositories.user_repository import UserRepository
from repositories.store_repository import StoreRepository, WorkspaceRepository
from repositories.gerant_invitation_repository import GerantInvitationRepository
from repositories.subscription_repository import SubscriptionRepository
from repositories.kpi_repository import KPIRepository, ManagerKPIRepository
from repositories.billing_repository import BillingProfileRepository
from repositories.system_log_repository import SystemLogRepository

logger = logging.getLogger(__name__)


class GerantService:
    """Service for gérant-specific operations. Phase 0: repositories only, no self.db."""

    def __init__(
        self,
        user_repo: UserRepository,
        store_repo: StoreRepository,
        workspace_repo: WorkspaceRepository,
        gerant_invitation_repo: GerantInvitationRepository,
        subscription_repo: SubscriptionRepository,
        kpi_repo: KPIRepository,
        manager_kpi_repo: ManagerKPIRepository,
        billing_profile_repo: Optional[BillingProfileRepository] = None,
        system_log_repo: Optional[SystemLogRepository] = None,
    ):
        self.user_repo = user_repo
        self.store_repo = store_repo
        self.workspace_repo = workspace_repo
        self.gerant_invitation_repo = gerant_invitation_repo
        self.subscription_repo = subscription_repo
        self.kpi_repo = kpi_repo
        self.manager_kpi_repo = manager_kpi_repo
        self.billing_profile_repo = billing_profile_repo
        self.system_log_repo = system_log_repo

    # ===== USER (for routes: no direct user_repo access) =====

    async def get_gerant_by_id(
        self, gerant_id: str, include_password: bool = False
    ) -> Optional[Dict]:
        """Get gérant user by id. Used by routes instead of user_repo.find_by_id."""
        return await self.user_repo.find_by_id(
            user_id=gerant_id, include_password=include_password
        )

    async def find_user_by_email(self, email: str) -> Optional[Dict]:
        """Find user by email. Used by routes for duplicate check."""
        return await self.user_repo.find_by_email(email)

    async def update_gerant_user_one(
        self, gerant_id: str, update_data: Dict
    ) -> bool:
        """Update gérant user. Used by routes instead of user_repo.update_one."""
        return await self.user_repo.update_one(
            {"id": gerant_id}, {"$set": update_data}
        )

    async def update_user_one(self, user_id: str, update_data: Dict) -> bool:
        """Update any user by id (e.g. password for manager/seller). Used by routes."""
        return await self.user_repo.update_one(
            {"id": user_id}, {"$set": update_data}
        )

    async def get_user_by_id(
        self, user_id: str, include_password: bool = False
    ) -> Optional[Dict]:
        """Get any user by id (e.g. manager/seller for password change). Used by routes."""
        return await self.user_repo.find_by_id(
            user_id=user_id, include_password=include_password
        )

    async def insert_user(self, user_doc: Dict) -> None:
        """Insert a user (manager or seller). Used by integrations route."""
        await self.user_repo.insert_one(user_doc)

    async def get_manager_in_store(
        self, store_id: str, manager_id: Optional[str] = None
    ) -> Optional[Dict]:
        """Get manager in store: by manager_id if provided, else first active manager. Used by integrations route."""
        if manager_id:
            return await self.user_repo.find_one(
                {"id": manager_id, "role": "manager", "store_id": store_id},
                {"_id": 0},
            )
        return await self.user_repo.find_one(
            {"role": "manager", "store_id": store_id, "status": "active"},
            {"_id": 0},
        )

    async def count_active_sellers_for_gerant(self, gerant_id: str) -> int:
        """Count active sellers for gérant. Used by routes instead of user_repo.count_active_sellers."""
        return await self.user_repo.count_active_sellers(gerant_id)

    # ===== WORKSPACE (for routes: no direct workspace_repo access) =====

    async def get_workspace_by_id(
        self, workspace_id: str, projection: Optional[Dict] = None
    ) -> Optional[Dict]:
        """Get workspace by id. Used by routes instead of workspace_repo.find_by_id."""
        return await self.workspace_repo.find_by_id(
            workspace_id, projection=projection or {"_id": 0}
        )

    async def update_workspace_one(
        self, workspace_id: str, update_data: Dict
    ) -> bool:
        """Update workspace. Used by routes instead of workspace_repo.update_one."""
        return await self.workspace_repo.update_one(
            {"id": workspace_id}, {"$set": update_data}
        )

    async def log_company_name_change(
        self, old_name: str, new_name: str, workspace_id: str
    ) -> None:
        """Log company name change for audit. Used by routes instead of system_log_repo."""
        if not self.system_log_repo or not old_name or old_name == new_name:
            return
        try:
            await self.system_log_repo.create_log({
                "event": "company_name_updated",
                "workspace_id": workspace_id,
                "old_name": old_name,
                "new_name": new_name,
                "created_at": datetime.now(timezone.utc).isoformat(),
            })
        except Exception as e:
            logger.warning("Failed to log company name change: %s", e)

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

    # ===== BILLING PROFILE (for routes: no direct billing_profile_repo access) =====

    async def get_billing_profile_by_gerant(self, gerant_id: str) -> Optional[Dict]:
        """Get billing profile for gérant. Used by routes instead of billing_profile_repo.find_by_gerant."""
        if not self.billing_profile_repo:
            return None
        return await self.billing_profile_repo.find_by_gerant(gerant_id)

    async def update_billing_profile_by_gerant(
        self, gerant_id: str, update_data: Dict
    ) -> bool:
        """Update billing profile for gérant. Used by routes."""
        if not self.billing_profile_repo:
            return False
        return await self.billing_profile_repo.update_by_gerant(
            gerant_id, update_data
        )

    async def create_billing_profile(self, profile_data: Dict) -> str:
        """Create billing profile. Used by routes."""
        if not self.billing_profile_repo:
            raise ForbiddenError("Service de facturation non configuré")
        return await self.billing_profile_repo.create(profile_data)

    async def check_gerant_active_access(
        self, 
        gerant_id: str, 
        allow_user_management: bool = False
    ) -> bool:
        """
        Guard clause: Check if gérant has active subscription for write operations.
        Raises ForbiddenError if trial expired or no active subscription.
        
        Args:
            gerant_id: Gérant user ID
            allow_user_management: If True, allows suspend/reactivate/delete even if trial_expired.
                                  ⚠️ SECURITY: Only bypasses subscription check, still verifies gérant exists.
        
        Returns:
            True if access is granted
            
        Raises:
            ForbiddenError if access denied
        """
        # Get gérant info
        gerant = await self.user_repo.find_one(
            {"id": gerant_id},
            {"_id": 0}
        )
        
        if not gerant:
            raise ForbiddenError("Utilisateur non trouvé")
        
        # ✅ EXCEPTION: Si allow_user_management=True, on autorise même si trial_expired
        # Mais on vérifie toujours que le gérant existe et n'est pas supprimé
        if allow_user_management:
            if gerant.get('status') == 'deleted':
                raise ForbiddenError("Gérant supprimé")
            # ✅ Autorise l'action même si trial_expired (pour gestion personnel uniquement)
            return True
        
        workspace_id = gerant.get('workspace_id')
        
        if not workspace_id:
            raise ForbiddenError("Aucun espace de travail associé")
        
        workspace = await self.workspace_repo.find_by_id(workspace_id, projection={"_id": 0})
        
        if not workspace:
            raise ForbiddenError("Espace de travail non trouvé")
        
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
                    await self.workspace_repo.update_one(
                        {"id": workspace_id},
                        {
                            "subscription_status": "trial_expired",
                            "updated_at": datetime.now(timezone.utc).isoformat()
                        }
                    )
                    from core.cache import invalidate_workspace_cache
                    await invalidate_workspace_cache(workspace_id)
                    raise ForbiddenError(
                        "Votre période d'essai est terminée. Veuillez souscrire à un abonnement pour continuer."
                    )
        
        # Trial expired or other inactive status
        raise ForbiddenError(
            "Votre période d'essai est terminée. Veuillez souscrire à un abonnement pour continuer."
        )
    
    async def check_user_write_access(self, user_id: str) -> bool:
        """
        Guard clause for Sellers/Managers: Get parent Gérant and check access.
        
        Args:
            user_id: User ID (seller or manager)
            
        Returns:
            True if access is granted
            
        Raises:
            ForbiddenError if access denied
        """
        user = await self.user_repo.find_one(
            {"id": user_id},
            {"_id": 0}
        )
        
        if not user:
            raise ForbiddenError("Utilisateur non trouvé")
        
        # Get parent gérant_id
        gerant_id = user.get('gerant_id')
        
        if not gerant_id:
            # Safety: If no parent chain, deny by default
            raise ForbiddenError("Accès refusé: chaîne de parenté non trouvée")
        
        # Delegate to gérant check
        return await self.check_gerant_active_access(gerant_id)
    
    async def get_all_stores(self, gerant_id: str) -> list:
        """Get all active stores for a gérant with staff counts"""
        stores = await self.store_repo.find_many(
            {"gerant_id": gerant_id, "active": True},
            {"_id": 0}
        )
        
        # PHASE 8: build pending counts per store via iterator (no limit=1000)
        pending_by_store = {}
        async for inv in self.gerant_invitation_repo.find_by_gerant_iter(gerant_id, status="pending"):
            sid = inv.get("store_id")
            if sid not in pending_by_store:
                pending_by_store[sid] = {"pending_managers": 0, "pending_sellers": 0}
            if inv.get("role") == "manager":
                pending_by_store[sid]["pending_managers"] += 1
            elif inv.get("role") == "seller":
                pending_by_store[sid]["pending_sellers"] += 1
        
        # PHASE 4: One aggregation instead of 2*N counts (N+1 optimization)
        store_ids = [s.get("id") for s in stores if s.get("id")]
        staff_by_store = {}
        if store_ids:
            pipeline = [
                {"$match": {
                    "store_id": {"$in": store_ids},
                    "status": {"$in": ["active", "Active"]}
                }},
                {"$group": {
                    "_id": "$store_id",
                    "manager_count": {"$sum": {"$cond": [{"$eq": ["$role", "manager"]}, 1, 0]}},
                    "seller_count": {"$sum": {"$cond": [{"$eq": ["$role", "seller"]}, 1, 0]}}
                }}
            ]
            agg_result = await self.user_repo.aggregate(pipeline, max_results=len(store_ids) + 1)
            staff_by_store = {
                r["_id"]: {"manager_count": r.get("manager_count", 0), "seller_count": r.get("seller_count", 0)}
                for r in agg_result
            }
        
        # Enrich stores with staff counts (from single aggregation + pending)
        for store in stores:
            store_id = store.get('id')
            counts = staff_by_store.get(store_id, {"manager_count": 0, "seller_count": 0})
            store['manager_count'] = counts["manager_count"]
            store['seller_count'] = counts["seller_count"]
            sid_counts = pending_by_store.get(store_id, {"pending_managers": 0, "pending_sellers": 0})
            store['pending_manager_count'] = sid_counts["pending_managers"]
            store['pending_seller_count'] = sid_counts["pending_sellers"]
        
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
        
        await self.store_repo.insert_one(store)
        
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
        await self.store_repo.update_one(
            {"id": store_id, "gerant_id": gerant_id},
            {
                "active": False,
                "deleted_at": datetime.now(timezone.utc).isoformat(),
                "deleted_by": gerant_id
            }
        )
        from core.cache import invalidate_store_cache, invalidate_user_cache
        await invalidate_store_cache(store_id)
        
        # Suspend all staff in this store
        affected_users = await self.user_repo.find_many(
            {"store_id": store_id, "status": "active"},
            {"id": 1},
            limit=2000,
            allow_over_limit=True
        )
        await self.user_repo.update_many(
            {"store_id": store_id, "status": "active"},
            {
                "status": "suspended",
                "suspended_reason": "Store deleted",
                "suspended_at": datetime.now(timezone.utc).isoformat()
            }
        )
        for u in affected_users:
            if u.get("id"):
                await invalidate_user_cache(str(u["id"]))
        
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
        
        # Liste des champs modifiables
        allowed_fields = ['name', 'location', 'address', 'phone', 'email', 'description', 'opening_hours']
        
        update_fields = {}
        for field in allowed_fields:
            if field in store_data:
                update_fields[field] = store_data[field]
        
        if update_fields:
            update_fields['updated_at'] = datetime.now(timezone.utc).isoformat()
            await self.store_repo.update_one(
                {"id": store_id, "gerant_id": gerant_id},
                update_fields
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
        await self.user_repo.update_one(
            {"id": manager_id},
            {
                "store_id": new_store_id,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        )
        from core.cache import invalidate_user_cache
        await invalidate_user_cache(manager_id)
        
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
        
        # 🔒 ANTI-DOUBLON: Get manager_ids that have entries in manager_kpis for today (PHASE 8: via repository)
        managers_with_kpis_today = await self.manager_kpi_repo.distinct(
            "manager_id",
            {"store_id": store_id, "date": today}
        )
        
        # Sellers KPIs today (excluding managers with dedicated entries)
        seller_match_today = {
            "store_id": store_id,
            "date": today
        }
        if managers_with_kpis_today:
            seller_match_today["seller_id"] = {"$nin": managers_with_kpis_today}
        
        sellers_today = await self.kpi_repo.aggregate([
            {"$match": seller_match_today},
            {"$group": {
                "_id": None,
                "total_ca": {"$sum": {"$ifNull": ["$seller_ca", {"$ifNull": ["$ca_journalier", 0]}]}},
                "total_ventes": {"$sum": {"$ifNull": ["$nb_ventes", 0]}},
                "total_articles": {"$sum": {"$ifNull": ["$nb_articles", 0]}}
            }}
        ], max_results=1)
        
        # Managers KPIs today
        managers_today = await self.manager_kpi_repo.aggregate([
            {"$match": {"store_id": store_id, "date": today}},
            {"$group": {
                "_id": None,
                "total_ca": {"$sum": {"$ifNull": ["$ca_journalier", 0]}},
                "total_ventes": {"$sum": {"$ifNull": ["$nb_ventes", 0]}},
                "total_articles": {"$sum": {"$ifNull": ["$nb_articles", 0]}}
            }}
        ], max_results=1)
        
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
        
        # 🔒 ANTI-DOUBLON: Get manager_ids that have entries in manager_kpis for this period
        # This prevents double counting if a manager also has entries in kpi_entries
        managers_with_kpis = await self.manager_kpi_repo.distinct(
            "manager_id",
            {"store_id": store_id, "date": {"$gte": period_start, "$lte": period_end}}
        )
        
        # Build seller match filter - exclude managers who have entries in manager_kpis
        seller_match = {
            "store_id": store_id,
            "date": {"$gte": period_start, "$lte": period_end}
        }
        if managers_with_kpis:
            seller_match["seller_id"] = {"$nin": managers_with_kpis}
        
        # Get period KPIs (sellers only, excluding managers with dedicated entries)
        period_sellers = await self.kpi_repo.aggregate([
            {"$match": seller_match},
            {"$group": {
                "_id": None,
                "total_ca": {"$sum": {"$ifNull": ["$seller_ca", {"$ifNull": ["$ca_journalier", 0]}]}},
                "total_ventes": {"$sum": {"$ifNull": ["$nb_ventes", 0]}}
            }}
        ], max_results=1)
        
        period_managers = await self.manager_kpi_repo.aggregate([
            {"$match": {"store_id": store_id, "date": {"$gte": period_start, "$lte": period_end}}},
            {"$group": {
                "_id": None,
                "total_ca": {"$sum": {"$ifNull": ["$ca_journalier", 0]}},
                "total_ventes": {"$sum": {"$ifNull": ["$nb_ventes", 0]}}
            }}
        ], max_results=1)
        
        period_ca = (period_sellers[0].get("total_ca", 0) if period_sellers else 0) + \
                    (period_managers[0].get("total_ca", 0) if period_managers else 0)
        period_ventes = (period_sellers[0].get("total_ventes", 0) if period_sellers else 0) + \
                        (period_managers[0].get("total_ventes", 0) if period_managers else 0)
        
        # Get previous period KPIs for evolution (same anti-doublon logic)
        prev_managers_with_kpis = await self.manager_kpi_repo.distinct(
            "manager_id",
            {"store_id": store_id, "date": {"$gte": prev_start, "$lte": prev_end}}
        )
        
        prev_seller_match = {
            "store_id": store_id,
            "date": {"$gte": prev_start, "$lte": prev_end}
        }
        if prev_managers_with_kpis:
            prev_seller_match["seller_id"] = {"$nin": prev_managers_with_kpis}
        
        prev_sellers = await self.kpi_repo.aggregate([
            {"$match": prev_seller_match},
            {"$group": {"_id": None, "total_ca": {"$sum": {"$ifNull": ["$seller_ca", {"$ifNull": ["$ca_journalier", 0]}]}}}}
        ], max_results=1)
        
        prev_managers = await self.manager_kpi_repo.aggregate([
            {"$match": {"store_id": store_id, "date": {"$gte": prev_start, "$lte": prev_end}}},
            {"$group": {"_id": None, "total_ca": {"$sum": {"$ifNull": ["$ca_journalier", 0]}}}}
        ], max_results=1)
        
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
        
        # PHASE 4: One aggregation instead of 4 count() calls (N+1 optimization)
        staff_counts_pipeline = [
            {"$match": {
                "gerant_id": gerant_id,
                "role": {"$in": ["manager", "seller"]},
                "status": {"$in": ["active", "suspended"]}
            }},
            {"$group": {
                "_id": {"role": "$role", "status": "$status"},
                "count": {"$sum": 1}
            }}
        ]
        staff_counts_result = await self.user_repo.aggregate(
            staff_counts_pipeline, max_results=4
        )
        counts_map = {
            ("manager", "active"): 0,
            ("manager", "suspended"): 0,
            ("seller", "active"): 0,
            ("seller", "suspended"): 0,
        }
        for row in staff_counts_result:
            key = (row["_id"]["role"], row["_id"]["status"])
            if key in counts_map:
                counts_map[key] = row["count"]
        total_managers = counts_map[("manager", "active")]
        suspended_managers = counts_map[("manager", "suspended")]
        total_sellers = counts_map[("seller", "active")]
        suspended_sellers = counts_map[("seller", "suspended")]
        
        # Calculate monthly KPI aggregations
        now = datetime.now(timezone.utc)
        first_day_of_month = now.replace(day=1).strftime('%Y-%m-%d')
        today = now.strftime('%Y-%m-%d')
        
        # 🔒 ANTI-DOUBLON: Get manager_ids that have entries in manager_kpis for this month
        managers_with_kpis = await self.manager_kpi_repo.distinct(
            "manager_id",
            {"store_id": {"$in": store_ids}, "date": {"$gte": first_day_of_month, "$lte": today}}
        )
        
        # Aggregate CA for all stores for current month (sellers only, excluding managers with dedicated entries)
        seller_match = {
            "store_id": {"$in": store_ids},
            "date": {"$gte": first_day_of_month, "$lte": today}
        }
        if managers_with_kpis:
            seller_match["seller_id"] = {"$nin": managers_with_kpis}
        
        pipeline = [
            {"$match": seller_match},
            {
                "$group": {
                    "_id": None,
                    "total_ca": {"$sum": {"$ifNull": ["$seller_ca", {"$ifNull": ["$ca_journalier", 0]}]}},
                    "total_ventes": {"$sum": {"$ifNull": ["$nb_ventes", 0]}},
                    "total_articles": {"$sum": {"$ifNull": ["$nb_articles", 0]}}
                }
            }
        ]
        
        kpi_stats = await self.kpi_repo.aggregate(pipeline, max_results=1)
        
        # Aggregate manager KPIs separately
        manager_pipeline = [
            {
                "$match": {
                    "store_id": {"$in": store_ids},
                    "date": {"$gte": first_day_of_month, "$lte": today}
                }
            },
            {
                "$group": {
                    "_id": None,
                    "total_ca": {"$sum": {"$ifNull": ["$ca_journalier", 0]}},
                    "total_ventes": {"$sum": {"$ifNull": ["$nb_ventes", 0]}},
                    "total_articles": {"$sum": {"$ifNull": ["$nb_articles", 0]}}
                }
            }
        ]
        
        manager_stats = await self.manager_kpi_repo.aggregate(manager_pipeline, max_results=1)
        
        # Combine seller and manager stats
        seller_ca = kpi_stats[0].get("total_ca", 0) if kpi_stats else 0
        seller_ventes = kpi_stats[0].get("total_ventes", 0) if kpi_stats else 0
        seller_articles = kpi_stats[0].get("total_articles", 0) if kpi_stats else 0
        
        manager_ca = manager_stats[0].get("total_ca", 0) if manager_stats else 0
        manager_ventes = manager_stats[0].get("total_ventes", 0) if manager_stats else 0
        manager_articles = manager_stats[0].get("total_articles", 0) if manager_stats else 0
        
        stats = {
            "total_ca": seller_ca + manager_ca,
            "total_ventes": seller_ventes + manager_ventes,
            "total_articles": seller_articles + manager_articles
        }
        
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
                
                if active_subscription:
                    result = await self._format_stripe_subscription(active_subscription, gerant_id)
                    result["workspace_name"] = workspace_name
                    return result
                
            except Exception as e:
                logger.warning(f"Stripe API error: {e}")
        
        # PRIORITY 3: Check local database subscription
        # 🔍 Use find() instead of find_one() to detect multiple subscriptions
        db_subscriptions = await self.subscription_repo.find_many(
            {"user_id": gerant_id, "status": {"$in": ["active", "trialing"]}},
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
            user = await self.user_repo.find_by_id(user_id, projection={"_id": 0})
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
        
        # ✅ PHASE 6: Use aggregation for date aggregation instead of .to_list(10000)
        # We still need individual entries for priority logic, but we'll use cursor iteration
        # instead of loading everything in memory at once. Phase 0: use injected repos.
        # Get KPI entries for this store (use cursor iteration with reasonable batch size)
        # Note: We need individual entries for priority logic (created_by='manager' > 'seller')
        # So we can't use pure aggregation here, but we'll process in batches
        kpi_query = {"store_id": store_id}
        date_range = {"$gte": start_date_query, "$lte": end_date_query}
        
        # PHASE 8: iterator via repository, no .collection
        all_seller_entries = []
        kpi_query_with_date = {**kpi_query, "date": date_range}
        async for entry in self.kpi_repo.find_iter(kpi_query_with_date, {"_id": 0}):
            all_seller_entries.append(entry)
            if len(all_seller_entries) >= 10000:
                logger.warning(f"Store {store_id} has > 10000 KPI entries in date range - consider data cleanup")
                break
        
        # ⭐ PRIORITÉ DE LA DONNÉE : Si un vendeur ET un manager ont saisi pour la même journée/vendeur,
        # utiliser la version du manager (created_by: 'manager')
        seller_entries_dict = {}
        for entry in all_seller_entries:
            seller_id = entry.get('seller_id')
            date = entry.get('date')
            if not seller_id or not date:
                continue
            
            # Clé unique : seller_id + date
            key = f"{seller_id}_{date}"
            
            # Si aucune entrée pour ce vendeur/date, l'ajouter
            if key not in seller_entries_dict:
                seller_entries_dict[key] = entry
            else:
                # Si une entrée existe déjà, vérifier la priorité
                existing_entry = seller_entries_dict[key]
                existing_created_by = existing_entry.get('created_by')
                new_created_by = entry.get('created_by')
                
                # Priorité : created_by='manager' > created_by='seller' ou None
                if new_created_by == 'manager' and existing_created_by != 'manager':
                    seller_entries_dict[key] = entry  # Remplacer par la version manager
                # Sinon, garder l'existant (déjà manager ou pas de priorité)
        
        # Convertir le dictionnaire en liste (sans doublons)
        seller_entries = list(seller_entries_dict.values())
        
        # Get manager KPIs for this store. PHASE 8: iterator via repository, no .collection
        manager_kpis = []
        manager_query = {
            "store_id": store_id,
            "date": {"$gte": start_date_query, "$lte": end_date_query}
        }
        async for entry in self.manager_kpi_repo.find_iter(manager_query, {"_id": 0}):
            manager_kpis.append(entry)
            if len(manager_kpis) >= 10000:
                logger.warning(f"Store {store_id} has > 10000 manager KPIs in date range - consider data cleanup")
                break
        
        # Aggregate data by date
        date_map = {}
        locked_dates = set()  # Track which dates have locked entries
        
        # ⭐ NOTE : manager_kpis ne contient plus que nb_prospects (globaux) avec la nouvelle logique
        # Les CA/ventes/articles sont maintenant dans kpi_entries avec created_by='manager'
        # Add manager KPIs (uniquement prospects globaux)
        for kpi in manager_kpis:
            date = kpi['date']
            if date not in date_map:
                date_map[date] = {
                    "date": date,
                    "ca_journalier": 0,
                    "nb_ventes": 0,
                    "nb_clients": 0,
                    "nb_articles": 0,
                    "nb_prospects": 0,
                    "locked": False
                }
            # ⭐ Avec la nouvelle logique, manager_kpis ne devrait plus contenir CA/ventes/articles
            # (seulement nb_prospects globaux pour répartition)
            date_map[date]["nb_prospects"] += kpi.get("nb_prospects") or 0
            # Check if locked
            if kpi.get("locked"):
                locked_dates.add(date)
        
        # Add seller entries (déjà filtrées pour priorité manager)
        for entry in seller_entries:
            date = entry['date']
            if date not in date_map:
                date_map[date] = {
                    "date": date,
                    "ca_journalier": 0,
                    "nb_ventes": 0,
                    "nb_clients": 0,
                    "nb_articles": 0,
                    "nb_prospects": 0,
                    "locked": False
                }
            # Handle both field names for CA
            ca_value = entry.get("seller_ca") or entry.get("ca_journalier") or 0
            date_map[date]["ca_journalier"] += ca_value
            date_map[date]["nb_ventes"] += entry.get("nb_ventes") or 0
            date_map[date]["nb_clients"] += entry.get("nb_clients") or 0
            date_map[date]["nb_articles"] += entry.get("nb_articles") or 0
            date_map[date]["nb_prospects"] += entry.get("nb_prospects") or 0
            # Check if locked
            if entry.get("locked"):
                locked_dates.add(date)
        
        # Apply locked status to date_map
        for date in locked_dates:
            if date in date_map:
                date_map[date]["locked"] = True
        
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
            user = await self.user_repo.find_by_id(user_id, projection={"_id": 0})
            if user and user.get('role') == 'manager' and user.get('store_id') == store_id:
                store = await self.store_repo.find_one(
                    {"id": store_id, "active": True},
                    {"_id": 0}
                )
        
        if not store:
            raise ValueError("Magasin non trouvé ou accès non autorisé")
        
        # Get distinct years from kpi_entries
        kpi_years = await self.kpi_repo.distinct("date", {"store_id": store_id})
        years_set = set()
        for date_str in kpi_years:
            if date_str and len(date_str) >= 4:
                year = int(date_str[:4])
                years_set.add(year)
        
        # Get distinct years from manager_kpi
        manager_years = await self.manager_kpi_repo.distinct("date", {"store_id": store_id})
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
        
        # Check if this is a same-store manager change or a full transfer
        is_same_store = seller.get('store_id') == transfer.new_store_id
        
        # Verify new store exists, is active, and belongs to current gérant
        new_store = await self.store_repo.find_one({
            "id": transfer.new_store_id,
            "gerant_id": gerant_id
        }, {"_id": 0})
        
        if not new_store:
            raise ValueError("Magasin non trouvé ou accès non autorisé")
        
        # Only check if store is active if it's a different store
        if not is_same_store and not new_store.get('active', False):
            raise ValueError(
                f"Le magasin '{new_store['name']}' est inactif. Impossible de transférer vers un magasin inactif."
            )
        
        # Verify new manager exists and is in the target store
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
            "manager_id": transfer.new_manager_id,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        # Only update store_id if it's a different store
        if not is_same_store:
            update_fields["store_id"] = transfer.new_store_id
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
        
        await self.user_repo.update_one(
            {"id": seller_id},
            update_operation
        )
        from core.cache import invalidate_user_cache
        await invalidate_user_cache(seller_id)
        
        # ⭐ IMPORTANT: Update all existing KPI entries for this seller with the new store_id
        # This ensures that when the seller returns to their original store, their KPI data is still accessible
        if not is_same_store and transfer.new_store_id:
            # Get seller's gerant_id for updating KPI entries
            seller_gerant_id = seller.get('gerant_id')
            
            # Update all KPI entries for this seller
            kpi_update_result = await self.kpi_repo.update_many(
                {"seller_id": seller_id},
                {
                    "store_id": transfer.new_store_id,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }
            )
            
            logger.info(
                f"Updated {kpi_update_result.modified_count} KPI entries for seller {seller_id} "
                f"from store {seller.get('store_id')} to store {transfer.new_store_id}"
            )
        
        # Build response message
        if is_same_store:
            message = f"Manager changé avec succès : {seller.get('name')} est maintenant sous la responsabilité de {new_manager['name']}"
        else:
            message = f"Vendeur transféré avec succès vers {new_store['name']}"
            if update_fields.get("status") == "active":
                message += " et réactivé automatiquement"
        
        return {
            "success": True,
            "message": message,
            "new_store": new_store['name'] if not is_same_store else seller.get('store_id'),
            "new_manager": new_manager['name'],
            "reactivated": update_fields.get("status") == "active",
            "same_store": is_same_store
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
        store = await self.store_repo.find_by_id(store_id, gerant_id=gerant_id, projection={"_id": 0})
        if not store or not store.get('active'):
            raise Exception("Magasin non trouvé ou accès non autorisé")
        
        # Get managers (exclude deleted ones)
        managers = await self.user_repo.find_by_store(
            store_id,
            role="manager",
            projection={"_id": 0, "password": 0},
            limit=100
        )
        # Filter out deleted
        managers = [m for m in managers if m.get('status') != 'deleted']
        
        return managers
    
    async def get_store_sellers(self, store_id: str, gerant_id: str) -> list:
        """
        Get all sellers for a specific store (exclude deleted)
        
        Security: Verifies store ownership
        """
        # Verify store ownership
        store = await self.store_repo.find_by_id(store_id, gerant_id=gerant_id, projection={"_id": 0})
        if not store or not store.get('active'):
            raise Exception("Magasin non trouvé ou accès non autorisé")
        
        # Get sellers (exclude deleted ones). PHASE 8: iterator via repository, no .collection
        sellers = []
        async for seller in self.user_repo.find_by_store_iter(
            store_id, role="seller", status_exclude="deleted", projection={"_id": 0, "password": 0}
        ):
            sellers.append(seller)
        
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
        store = await self.store_repo.find_by_id(store_id, gerant_id=user_id, projection={"_id": 0})
        
        # If not gérant, check if user is a manager assigned to this store
        if not store or not store.get('active'):
            user = await self.user_repo.find_by_id(user_id, projection={"_id": 0})
            if user and user.get('role') == 'manager' and user.get('store_id') == store_id:
                store = await self.store_repo.find_by_id(store_id, projection={"_id": 0})
        
        if not store or not store.get('active'):
            raise Exception("Magasin non trouvé ou accès non autorisé")
        
        # Default to today
        if not date:
            date = datetime.now(timezone.utc).strftime('%Y-%m-%d')
        
        # Get all managers and sellers in this store
        managers = await self.user_repo.find_by_store(
            store_id,
            role="manager",
            projection={"_id": 0, "id": 1, "name": 1},
            limit=100
        )
        managers = [m for m in managers if m.get('status') == 'active']
        
        sellers = await self.user_repo.find_by_store(
            store_id,
            role="seller",
            projection={"_id": 0, "id": 1, "name": 1},
            limit=100
        )
        sellers = [s for s in sellers if s.get('status') == 'active']
        
        # Get ALL KPI entries for this store directly by store_id
        all_seller_entries = await self.kpi_repo.find_by_store(store_id, date, projection={"_id": 0})
        
        # ⭐ PRIORITÉ DE LA DONNÉE : Si un vendeur ET un manager ont saisi pour la même journée,
        # utiliser la version du manager (created_by: 'manager')
        seller_entries_dict = {}
        for entry in all_seller_entries:
            seller_id = entry.get('seller_id')
            if not seller_id:
                continue
            
            # Si aucune entrée pour ce vendeur, l'ajouter
            if seller_id not in seller_entries_dict:
                seller_entries_dict[seller_id] = entry
            else:
                # Si une entrée existe déjà, vérifier la priorité
                existing_entry = seller_entries_dict[seller_id]
                existing_created_by = existing_entry.get('created_by')
                new_created_by = entry.get('created_by')
                
                # Priorité : created_by='manager' > created_by='seller' ou None
                if new_created_by == 'manager' and existing_created_by != 'manager':
                    seller_entries_dict[seller_id] = entry  # Remplacer par la version manager
                # Sinon, garder l'existant (déjà manager ou pas de priorité)
        
        # Convertir le dictionnaire en liste
        seller_entries = list(seller_entries_dict.values())
        
        # Enrich seller entries with names
        for entry in seller_entries:
            seller = next((s for s in sellers if s['id'] == entry.get('seller_id')), None)
            if seller:
                entry['seller_name'] = seller['name']
            else:
                entry['seller_name'] = entry.get('seller_name', 'Vendeur (historique)')
        
        # Get manager KPIs for this store (uniquement pour prospects globaux)
        # ✅ PHASE 8: Use find_many with limit parameter (no .to_list() on list)
        manager_kpis_list = await self.manager_kpi_repo.find_many({
            "store_id": store_id,
            "date": date
        }, {"_id": 0}, limit=100)
        
        # ⭐ NOUVELLE LOGIQUE : Prospects globaux pour répartition
        global_prospects = sum((kpi.get("nb_prospects") or 0) for kpi in manager_kpis_list)
        
        # ⭐ GESTION DES ABSENTS : Compter uniquement les vendeurs ayant des données saisies (présents)
        sellers_with_data = len(seller_entries)  # Vendeurs ayant travaillé ce jour-là
        active_sellers_count = len(sellers)  # Tous les vendeurs actifs du magasin (pour référence)
        
        # Calculer le prorata de prospects par vendeur
        # ⭐ NOUVELLE LOGIQUE : Permettre le prorata même si les vendeurs n'ont pas encore d'entrées
        # Si le manager saisit des prospects globaux, on peut les répartir sur tous les vendeurs actifs
        # même si leur CA est à 0, pour activer immédiatement le calcul du Taux de Transformation
        prospect_prorata_per_seller = {}
        if global_prospects > 0:
            # Utiliser sellers_with_data si > 0 (vendeurs présents), sinon utiliser active_sellers_count (tous les vendeurs actifs)
            # Cela permet au manager de "pousser" les prospects même si les vendeurs n'ont pas encore saisi de données
            sellers_count_for_prorata = sellers_with_data if sellers_with_data > 0 else active_sellers_count
            
            if sellers_count_for_prorata > 0:
                # Répartition équitable : prospects globaux / nombre de vendeurs (présents ou actifs)
                base_prorata = global_prospects / sellers_count_for_prorata
                
                # ⭐ Si sellers_with_data > 0 : Attribuer le prorata aux vendeurs ayant des données (présents)
                # ⭐ Si sellers_with_data == 0 : Attribuer le prorata à TOUS les vendeurs actifs (pour activation immédiate)
                if sellers_with_data > 0:
                    # Cas normal : vendeurs présents
                    for entry in seller_entries:
                        seller_id = entry.get('seller_id')
                        if seller_id:
                            prospect_prorata_per_seller[seller_id] = base_prorata
                else:
                    # Cas spécial : aucun vendeur n'a encore saisi de données, mais le manager a saisi des prospects globaux
                    # On répartit sur TOUS les vendeurs actifs pour permettre le calcul immédiat du Taux de Transformation
                    for seller in sellers:
                        seller_id = seller.get('id')
                        if seller_id:
                            prospect_prorata_per_seller[seller_id] = base_prorata
        
        # Enrichir les entrées vendeurs avec le prorata de prospects
        for entry in seller_entries:
            seller_id = entry.get('seller_id')
            # Si le vendeur a déjà saisi ses propres prospects, les utiliser
            # Sinon, utiliser le prorata calculé
            if not entry.get('nb_prospects') or entry.get('nb_prospects') == 0:
                entry['prospect_prorata'] = prospect_prorata_per_seller.get(seller_id, 0)
            else:
                entry['prospect_prorata'] = entry.get('nb_prospects', 0)
        
        # Aggregate totals from managers (uniquement CA/ventes si saisis globalement - legacy)
        managers_total = {
            "ca_journalier": sum((kpi.get("ca_journalier") or 0) for kpi in manager_kpis_list),
            "nb_ventes": sum((kpi.get("nb_ventes") or 0) for kpi in manager_kpis_list),
            "nb_clients": sum((kpi.get("nb_clients") or 0) for kpi in manager_kpis_list),
            "nb_articles": sum((kpi.get("nb_articles") or 0) for kpi in manager_kpis_list),
            "nb_prospects": global_prospects  # ⭐ Prospects globaux (pour répartition)
        }
        
        # Aggregate totals from sellers
        sellers_total = {
            "ca_journalier": sum((entry.get("seller_ca") or entry.get("ca_journalier") or 0) for entry in seller_entries),
            "nb_ventes": sum((entry.get("nb_ventes") or 0) for entry in seller_entries),
            "nb_clients": sum((entry.get("nb_clients") or 0) for entry in seller_entries),
            "nb_articles": sum((entry.get("nb_articles") or 0) for entry in seller_entries),
            "nb_prospects": sum((entry.get("nb_prospects") or 0) for entry in seller_entries),  # Prospects individuels saisis
            "nb_sellers_reported": len(seller_entries)
        }
        
        # ⭐ Calculer le total prospects avec prorata pour les vendeurs sans prospects individuels
        total_prospects_with_prorata = sellers_total["nb_prospects"]
        
        # Si des vendeurs ont déjà des entrées, ajouter leur prorata
        for entry in seller_entries:
            seller_id = entry.get('seller_id')
            # Si le vendeur n'a pas saisi de prospects mais a un prorata, l'ajouter
            if (not entry.get('nb_prospects') or entry.get('nb_prospects') == 0) and prospect_prorata_per_seller.get(seller_id, 0) > 0:
                total_prospects_with_prorata += prospect_prorata_per_seller.get(seller_id, 0)
        
        # ⭐ Si aucun vendeur n'a encore d'entrées mais qu'il y a des prospects globaux,
        # le prorata a déjà été calculé pour tous les vendeurs actifs, donc on utilise directement global_prospects
        if sellers_with_data == 0 and global_prospects > 0:
            total_prospects_with_prorata = global_prospects
        
        # Calculate store totals
        # ⚠️ IMPORTANT : Ne plus additionner CA/ventes manager + vendeurs si manager saisit par vendeur
        # Si created_by='manager' existe dans seller_entries, les données sont déjà individuelles
        total_ca = sellers_total["ca_journalier"]  # ⭐ Utiliser uniquement les données vendeurs (déjà individuelles)
        total_ventes = sellers_total["nb_ventes"]  # ⭐ Utiliser uniquement les données vendeurs
        total_clients = sellers_total["nb_clients"]
        total_articles = sellers_total["nb_articles"]
        # ⭐ Utiliser le total avec prorata pour les prospects
        total_prospects = total_prospects_with_prorata if total_prospects_with_prorata > 0 else global_prospects
        
        # Calculate derived KPIs
        calculated_kpis = {
            "panier_moyen": round(total_ca / total_ventes, 2) if total_ventes > 0 else None,
            "taux_transformation": round((total_ventes / total_prospects) * 100, 2) if total_prospects > 0 else None,
            "indice_vente": round(total_articles / total_ventes, 2) if total_ventes > 0 else None
        }
        
        # ⭐ Ajouter les informations de répartition pour le frontend
        calculated_kpis["prospect_repartition"] = {
            "global_prospects": global_prospects,
            "sellers_prospects": sellers_total["nb_prospects"],
            "prospect_prorata_per_seller": prospect_prorata_per_seller,
            "total_with_prorata": total_prospects_with_prorata,
            "active_sellers_count": active_sellers_count,  # Tous les vendeurs actifs du magasin
            "sellers_with_data": sellers_with_data  # ⭐ Vendeurs ayant travaillé ce jour-là (utilisés pour prorata)
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
        existing_invitation = await self.gerant_invitation_repo.find_by_email(
            email, gerant_id=gerant_id, status="pending"
        )
        if existing_invitation:
            raise ValueError("Une invitation est déjà en attente pour cet email")
        
        # For sellers: automatically assign manager_id if there's a manager in the store
        manager_id = None
        manager_name = None
        if role == 'seller':
            # Find active manager in the store
            manager = await self.user_repo.find_one({
                "role": "manager",
                "store_id": store_id,
                "status": "active"
            })
            if manager:
                manager_id = manager.get('id')
                manager_name = manager.get('name')
                logger.info(f"Auto-assigning seller invitation to manager {manager_name} ({manager_id}) for store {store_id}")
            else:
                logger.warning(f"No active manager found for store {store_id} when creating seller invitation")
        
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
            "manager_id": manager_id,  # Auto-assigned for sellers
            "manager_name": manager_name,  # For email display
            "status": "pending",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "expires_at": (datetime.now(timezone.utc).replace(hour=0, minute=0, second=0) + 
                         __import__('datetime').timedelta(days=7)).isoformat()
        }
        
        await self.gerant_invitation_repo.create_invitation(invitation, gerant_id)
        
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
        
        # Get environment variables
        brevo_api_key = os.environ.get('BREVO_API_KEY')
        environment = os.environ.get('ENVIRONMENT', 'development')
        cors_origins = os.environ.get('CORS_ORIGINS', '')
        
        # Determine frontend URL based on environment
        frontend_url = os.environ.get('FRONTEND_URL', '')
        
        # In production, extract URL from CORS_ORIGINS if FRONTEND_URL is not properly set
        if not frontend_url or 'localhost' in frontend_url:
            # Try to get production URL from CORS_ORIGINS
            if cors_origins and cors_origins != '*':
                origins = [o.strip() for o in cors_origins.split(',')]
                # Prefer retailperformerai.com
                for origin in origins:
                    if 'retailperformerai.com' in origin:
                        frontend_url = origin
                        break
                if not frontend_url and origins:
                    frontend_url = origins[0]  # Use first origin as fallback
                logger.info(f"[INVITATION EMAIL] Using URL from CORS_ORIGINS: {frontend_url}")
        
        # Fallback for local development
        if not frontend_url or frontend_url == '*':
            frontend_url = 'http://localhost:3000'
            # Try loading from .env file
            try:
                from dotenv import dotenv_values
                env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env')
                env_vars = dotenv_values(env_path)
                env_frontend = env_vars.get('FRONTEND_URL', '')
                if env_frontend:
                    frontend_url = env_frontend
            except Exception:
                pass
        
        if not brevo_api_key:
            # Try loading from .env file as fallback for local dev
            try:
                from dotenv import dotenv_values
                env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env')
                env_vars = dotenv_values(env_path)
                brevo_api_key = env_vars.get('BREVO_API_KEY')
            except Exception as e:
                logger.warning(f"Could not load .env file: {e}")
        
        if not brevo_api_key:
            logger.warning("BREVO_API_KEY not set, skipping email")
            return
        
        logger.info(f"Sending invitation email to {invitation['email']}")
        logger.info(f"[INVITATION EMAIL] Environment: {environment}")
        logger.info(f"[INVITATION EMAIL] CORS_ORIGINS: {cors_origins}")
        logger.info(f"[INVITATION EMAIL] Final FRONTEND_URL: {frontend_url}")
        
        # Remove trailing slash to avoid double slashes in URL
        frontend_url = frontend_url.rstrip('/')
        
        invitation_link = f"{frontend_url}/invitation/{invitation['token']}"
        
        # Use role-specific templates with features list
        if invitation['role'] == 'manager':
            # Manager invitation template
            store_info = f" pour le magasin <strong>{invitation['store_name']}</strong>" if invitation.get('store_name') else ""
            gerant_name = invitation.get('gerant_name') or "Votre gérant"
            
            email_content = f"""
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background: linear-gradient(135deg, #9333ea 0%, #ec4899 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                    <h1 style="color: white; margin: 0;">👋 Vous êtes invité !</h1>
                </div>
                
                <div style="background-color: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
                    <p style="font-size: 16px;">Bonjour {invitation['name']},</p>
                    
                    <p style="font-size: 16px;">
                        <strong>{gerant_name}</strong> vous invite à rejoindre son équipe{store_info} 
                        sur <strong>Retail Performer AI</strong>.
                    </p>
                    
                    <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #9333ea;">
                        <h3 style="margin-top: 0; color: #9333ea;">🎯 En tant que Manager, vous pourrez :</h3>
                        <ul style="list-style: none; padding: 0;">
                            <li style="padding: 8px 0;">👥 <strong>Consulter les performances</strong> de chaque membre de votre équipe</li>
                            <li style="padding: 8px 0;">📊 <strong>Suivre les KPI</strong> de votre magasin en temps réel</li>
                            <li style="padding: 8px 0;">🎯 <strong>Créer et suivre des objectifs</strong> individuels et collectifs</li>
                            <li style="padding: 8px 0;">🏆 <strong>Lancer des challenges</strong> pour motiver votre équipe</li>
                            <li style="padding: 8px 0;">🤖 <strong>Coaching IA personnalisé</strong> pour booster les performances</li>
                            <li style="padding: 8px 0;">📋 <strong>Générer bilans, briefing et entretiens annuels</strong> en 1 clic avec l'IA</li>
                            <li style="padding: 8px 0;">🤝 <strong>Conseils IA relationnels</strong> adaptés à chaque profil DISC de vos vendeurs</li>
                        </ul>
                    </div>
                    
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="{invitation_link}" 
                           style="background: linear-gradient(135deg, #9333ea 0%, #ec4899 100%); 
                                  color: white; 
                                  padding: 15px 40px; 
                                  text-decoration: none; 
                                  border-radius: 25px; 
                                  font-size: 16px; 
                                  font-weight: bold; 
                                  display: inline-block;
                                  box-shadow: 0 4px 15px rgba(147, 51, 234, 0.4);">
                            ✅ Accepter l'invitation
                        </a>
                    </div>
                    
                    <p style="font-size: 14px; color: #666; margin-top: 30px;">
                        <strong>Note :</strong> Ce lien d'invitation est valable pendant 7 jours.
                    </p>
                    
                    <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
                    
                    <p style="font-size: 12px; color: #999; text-align: center;">
                        Retail Performer AI<br>
                        © 2024 Tous droits réservés
                    </p>
                </div>
            </body>
            </html>
            """
            email_subject = f"👋 {gerant_name} vous invite à rejoindre Retail Performer AI"
        else:
            # Seller invitation template
            store_info = f" du magasin <strong>{invitation['store_name']}</strong>" if invitation.get('store_name') else ""
            manager_name = invitation.get('manager_name') or invitation.get('gerant_name') or "Votre manager"
            
            email_content = f"""
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background: linear-gradient(135deg, #9333ea 0%, #ec4899 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                    <h1 style="color: white; margin: 0;">🌟 Bienvenue dans l'équipe !</h1>
                </div>
                
                <div style="background-color: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
                    <p style="font-size: 16px;">Bonjour {invitation['name']},</p>
                    
                    <p style="font-size: 16px;">
                        <strong>{manager_name}</strong>, votre manager{store_info}, 
                        vous invite à rejoindre <strong>Retail Performer AI</strong> !
                    </p>
                    
                    <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #9333ea;">
                        <h3 style="margin-top: 0; color: #9333ea;">🚀 Votre espace personnel :</h3>
                        <ul style="list-style: none; padding: 0;">
                            <li style="padding: 8px 0;">📊 Suivre vos KPI et performances en temps réel</li>
                            <li style="padding: 8px 0;">🎯 Consulter vos objectifs et challenges</li>
                            <li style="padding: 8px 0;">🤖 Créer vos défis personnels avec votre coach IA</li>
                            <li style="padding: 8px 0;">✅ Analyser vos ventes conclues avec l'IA</li>
                            <li style="padding: 8px 0;">❌ Analyser vos opportunités manquées avec l'IA</li>
                            <li style="padding: 8px 0;">📋 Préparer votre évaluation annuelle</li>
                        </ul>
                    </div>
                    
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="{invitation_link}" 
                           style="background: linear-gradient(135deg, #9333ea 0%, #ec4899 100%); 
                                  color: white; 
                                  padding: 15px 40px; 
                                  text-decoration: none; 
                                  border-radius: 25px; 
                                  font-size: 16px; 
                                  font-weight: bold; 
                                  display: inline-block;
                                  box-shadow: 0 4px 15px rgba(147, 51, 234, 0.4);">
                            🎉 Commencer maintenant
                        </a>
                    </div>
                    
                    <p style="font-size: 14px; color: #666; margin-top: 30px;">
                        <strong>Note :</strong> Ce lien d'invitation est valable pendant 7 jours.
                    </p>
                    
                    <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
                    
                    <p style="font-size: 12px; color: #999; text-align: center;">
                        Retail Performer AI - Votre coach personnel<br>
                        © 2024 Tous droits réservés
                    </p>
                </div>
            </body>
            </html>
            """
            email_subject = f"🌟 {manager_name} vous invite à rejoindre l'équipe !"
        
        # Get sender email from environment
        sender_email = os.environ.get('SENDER_EMAIL', 'hello@retailperformerai.com')
        sender_name = os.environ.get('SENDER_NAME', 'Retail Performer AI')
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                payload = {
                    "sender": {"name": sender_name, "email": sender_email},
                    "to": [{"email": invitation['email'], "name": invitation['name']}],
                    "subject": email_subject,
                    "htmlContent": email_content
                }
                
                logger.info("📧 Sending email via Brevo:")
                logger.info(f"   - From: {sender_name} <{sender_email}>")
                logger.info(f"   - To: {invitation['name']} <{invitation['email']}>")
                logger.info(f"   - Subject: {email_subject}")
                
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
        invitations = await self.gerant_invitation_repo.find_by_gerant(
            gerant_id,
            projection={"_id": 0},
            limit=100,
            sort=[("created_at", -1)]
        )
        
        return invitations
    
    async def cancel_invitation(self, invitation_id: str, gerant_id: str) -> Dict:
        """Cancel a pending invitation"""
        invitation = await self.gerant_invitation_repo.find_by_id(invitation_id, gerant_id=gerant_id)
        
        if not invitation:
            raise ValueError("Invitation non trouvée")
        
        if invitation.get('status') != 'pending':
            raise ValueError("Seules les invitations en attente peuvent être annulées")
        
        await self.gerant_invitation_repo.update_invitation(
            invitation_id,
            {"status": "cancelled", "cancelled_at": datetime.now(timezone.utc).isoformat()},
            gerant_id=gerant_id
        )
        
        return {"message": "Invitation annulée"}

    async def resend_invitation(self, invitation_id: str, gerant_id: str) -> Dict:
        """Resend an invitation email"""
        from uuid import uuid4
        
        invitation = await self.gerant_invitation_repo.find_by_id(invitation_id, gerant_id=gerant_id)
        
        if not invitation:
            raise ValueError("Invitation non trouvée")
        
        if invitation.get('status') not in ['pending', 'expired']:
            raise ValueError("Seules les invitations en attente ou expirées peuvent être renvoyées")
        
        # Generate new token and update expiration
        new_token = str(uuid4())
        new_expiry = (datetime.now(timezone.utc).replace(hour=0, minute=0, second=0) + timedelta(days=7)).isoformat()
        
        await self.gerant_invitation_repo.update_invitation(
            invitation_id,
            {
                "token": new_token,
                "status": "pending",
                "expires_at": new_expiry,
                "resent_at": datetime.now(timezone.utc).isoformat()
            },
            gerant_id=gerant_id
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
        
        ✅ AUTORISÉ même si trial_expired pour permettre l'ajustement d'abonnement.
        Le calcul d'abonnement exclut automatiquement les vendeurs suspendus.
        
        Args:
            user_id: User ID to suspend
            gerant_id: Gérant ID for authorization
            role: 'manager' or 'seller'
        """
        # === GUARD CLAUSE: Check subscription access ===
        # ✅ Exception: allow_user_management=True pour bypasser le blocage trial_expired
        await self.check_gerant_active_access(gerant_id, allow_user_management=True)
        
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
        
        await self.user_repo.update_one(
            {"id": user_id},
            {
                "status": "suspended",
                "suspended_at": datetime.now(timezone.utc).isoformat(),
                "suspended_by": gerant_id,
                "suspended_reason": "Suspendu par le gérant"
            }
        )
        
        return {"message": f"{role.capitalize()} suspendu avec succès"}
    
    async def reactivate_user(self, user_id: str, gerant_id: str, role: str) -> Dict:
        """
        Reactivate a suspended manager or seller
        
        ✅ AUTORISÉ même si trial_expired pour permettre l'ajustement d'abonnement.
        
        Args:
            user_id: User ID to reactivate
            gerant_id: Gérant ID for authorization
            role: 'manager' or 'seller'
        """
        # === GUARD CLAUSE: Check subscription access ===
        # ✅ Exception: allow_user_management=True pour bypasser le blocage trial_expired
        await self.check_gerant_active_access(gerant_id, allow_user_management=True)
        
        user = await self.user_repo.find_one({
            "id": user_id,
            "gerant_id": gerant_id,
            "role": role
        })
        
        if not user:
            raise ValueError(f"{role.capitalize()} non trouvé")
        
        if user.get('status') != 'suspended':
            raise ValueError(f"Ce {role} n'est pas suspendu")
        
        # PHASE 8: update_with_unset via repository, no .collection
        set_data = {
            "status": "active",
            "reactivated_at": datetime.now(timezone.utc).isoformat(),
            "reactivated_by": gerant_id
        }
        unset_data = {"suspended_at": "", "suspended_by": "", "suspended_reason": ""}
        await self.user_repo.update_with_unset({"id": user_id}, set_data, unset_data)
        from core.cache import invalidate_user_cache
        await invalidate_user_cache(user_id)
        
        return {"message": f"{role.capitalize()} réactivé avec succès"}
    
    async def delete_user(self, user_id: str, gerant_id: str, role: str) -> Dict:
        """
        Soft delete a manager or seller (set status to 'deleted')
        
        ✅ AUTORISÉ même si trial_expired pour permettre l'ajustement d'abonnement.
        
        Args:
            user_id: User ID to delete
            gerant_id: Gérant ID for authorization
            role: 'manager' or 'seller'
        """
        # === GUARD CLAUSE: Check subscription access ===
        # ✅ Exception: allow_user_management=True pour bypasser le blocage trial_expired
        await self.check_gerant_active_access(gerant_id, allow_user_management=True)
        
        user = await self.user_repo.find_one({
            "id": user_id,
            "gerant_id": gerant_id,
            "role": role
        })
        
        if not user:
            raise ValueError(f"{role.capitalize()} non trouvé")
        
        if user.get('status') == 'deleted':
            raise ValueError(f"Ce {role} a déjà été supprimé")
        
        await self.user_repo.update_one(
            {"id": user_id},
            {
                "status": "deleted",
                "deleted_at": datetime.now(timezone.utc).isoformat(),
                "deleted_by": gerant_id
            }
        )
        from core.cache import invalidate_user_cache
        await invalidate_user_cache(user_id)
        
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
        MAX_STORES_SYNC = 1000
        if query["$or"]:
            # PHASE 8: find_many via repository, no .collection
            existing_stores_list = await self.store_repo.find_many(
                query,
                {"_id": 0, "id": 1, "name": 1, "external_id": 1, "location": 1},
                limit=MAX_STORES_SYNC
            )
            if len(existing_stores_list) == MAX_STORES_SYNC:
                logger.warning(f"Stores sync query hit limit of {MAX_STORES_SYNC}. Some stores may not be matched correctly.")
            for store in existing_stores_list:
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
        
        # PHASE 3: Execute bulk write via repository (no .collection)
        if bulk_operations:
            try:
                await self.store_repo.bulk_write(bulk_operations)
                logger.info(f"✅ Import massif magasins: {results['created']} créés, {results['updated']} mis à jour")
            except Exception as e:
                logger.error(f"Erreur bulk write: {str(e)}")
                # Some operations may have succeeded
        
        return results

