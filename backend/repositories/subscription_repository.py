"""Subscription Repository"""
from typing import Optional, List, Dict
from repositories.base_repository import BaseRepository


class SubscriptionRepository(BaseRepository):
    """Repository for subscriptions collection"""
    
    def __init__(self, db):
        super().__init__(db, "subscriptions")
    
    async def find_by_user(self, user_id: str) -> Optional[Dict]:
        """Find active subscription for a user"""
        return await self.find_one({"user_id": user_id})
    
    async def find_by_stripe_subscription(self, stripe_subscription_id: str) -> Optional[Dict]:
        """Find subscription by Stripe subscription ID"""
        return await self.find_one({"stripe_subscription_id": stripe_subscription_id})
    
    async def find_active_subscriptions(self) -> List[Dict]:
        """Find all active subscriptions"""
        return await self.find_many({"status": "active"})
