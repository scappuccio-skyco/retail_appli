"""
Onboarding Progress Repository - Data access for onboarding_progress collection
"""
from typing import Optional, Dict, Any
from repositories.base_repository import BaseRepository


class OnboardingProgressRepository(BaseRepository):
    """Repository for onboarding_progress collection"""

    def __init__(self, db):
        super().__init__(db, "onboarding_progress")

    async def find_by_user(self, user_id: str, projection: Optional[Dict] = None) -> Optional[Dict]:
        """Find onboarding progress by user_id."""
        return await self.find_one({"user_id": user_id}, projection or {"_id": 0})

    async def upsert_by_user(self, user_id: str, progress_doc: Dict[str, Any]) -> bool:
        """Upsert onboarding progress for a user."""
        return await self.update_one({"user_id": user_id}, {"$set": progress_doc}, upsert=True)
