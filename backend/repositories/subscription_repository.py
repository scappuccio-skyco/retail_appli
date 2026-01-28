"""Subscription Repository"""
from typing import Optional, List, Dict
from repositories.base_repository import BaseRepository


class SubscriptionRepository(BaseRepository):
    """Repository for subscriptions collection"""
    
    def __init__(self, db):
        super().__init__(db, "subscriptions")
    
    async def find_by_user(self, user_id: str, status: Optional[str] = None) -> Optional[Dict]:
        """
        Find subscription for a user
        
        Args:
            user_id: User ID
            status: Optional status filter (e.g., "active", "trialing")
        """
        query = {"user_id": user_id}
        if status:
            if isinstance(status, list):
                query["status"] = {"$in": status}
            else:
                query["status"] = status
        return await self.find_one(query)
    
    async def find_by_user_and_status(self, user_id: str, status_list: List[str]) -> Optional[Dict]:
        """Find subscription for a user with status in list (e.g., ["active", "trialing"])"""
        return await self.find_one({
            "user_id": user_id,
            "status": {"$in": status_list}
        })
    
    async def find_by_stripe_subscription(self, stripe_subscription_id: str) -> Optional[Dict]:
        """Find subscription by Stripe subscription ID"""
        return await self.find_one({"stripe_subscription_id": stripe_subscription_id})
    
    async def find_by_workspace(self, workspace_id: str) -> Optional[Dict]:
        """Find subscription by workspace ID"""
        return await self.find_one({"workspace_id": workspace_id})
    
    async def find_active_subscriptions(self) -> List[Dict]:
        """Find all active subscriptions"""
        return await self.find_many({"status": "active"})
    
    async def update_by_user(self, user_id: str, update_data: Dict) -> bool:
        """Update subscription for a user"""
        return await self.update_one({"user_id": user_id}, {"$set": update_data})
    
    async def update_by_stripe_subscription(self, stripe_subscription_id: str, update_data: Dict) -> bool:
        """Update subscription by Stripe subscription ID"""
        return await self.update_one(
            {"stripe_subscription_id": stripe_subscription_id},
            {"$set": update_data}
        )

    async def upsert_by_stripe_subscription(
        self, stripe_subscription_id: str, update_data: Dict
    ) -> bool:
        """Upsert subscription by Stripe subscription ID (for webhooks)."""
        return await self.update_one(
            {"stripe_subscription_id": stripe_subscription_id},
            {"$set": update_data},
            upsert=True,
        )

    async def find_many_with_query(
        self, query: Dict, projection: Optional[Dict] = None, limit: int = 100, sort=None
    ) -> List[Dict]:
        """Find subscriptions matching query (for duplicate detection)."""
        return await self.find_many(query, projection or {"_id": 0}, limit, 0, sort)
    
    async def update_by_workspace(self, workspace_id: str, update_data: Dict) -> bool:
        """Update subscription by workspace ID"""
        return await self.update_one(
            {"workspace_id": workspace_id},
            {"$set": update_data}
        )
    
    async def find_many_by_user_status(
        self,
        user_id: str,
        status_list: List[str],
        limit: int = 100
    ) -> List[Dict]:
        """Find multiple subscriptions for a user with status in list (for duplicate resolution)"""
        return await self.find_many(
            {"user_id": user_id, "status": {"$in": status_list}},
            limit=limit
        )
