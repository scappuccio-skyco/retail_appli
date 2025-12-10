"""
Onboarding Service
Business logic for user onboarding progress tracking
"""
from typing import Dict, List
from datetime import datetime, timezone
import logging

logger = logging.getLogger(__name__)


class OnboardingService:
    """Service for onboarding progress operations"""
    
    def __init__(self, db):
        self.db = db
    
    async def get_progress(self, user_id: str) -> Dict:
        """
        Get onboarding progress for a user
        
        Args:
            user_id: User ID
            
        Returns:
            Progress document or default if not found
        """
        progress = await self.db.onboarding_progress.find_one(
            {"user_id": user_id},
            {"_id": 0}
        )
        
        if not progress:
            # Return default progress
            return {
                "user_id": user_id,
                "current_step": 0,
                "completed_steps": [],
                "is_completed": False,
                "last_updated": datetime.now(timezone.utc).isoformat()
            }
        
        return progress
    
    async def save_progress(
        self,
        user_id: str,
        current_step: int = 0,
        completed_steps: List[int] = None,
        is_completed: bool = False
    ) -> Dict:
        """
        Save or update onboarding progress
        
        Args:
            user_id: User ID
            current_step: Current step index
            completed_steps: List of completed step indices
            is_completed: Whether onboarding is fully completed
            
        Returns:
            Updated progress document
        """
        if completed_steps is None:
            completed_steps = []
        
        progress_doc = {
            "user_id": user_id,
            "current_step": current_step,
            "completed_steps": completed_steps,
            "is_completed": is_completed,
            "last_updated": datetime.now(timezone.utc).isoformat()
        }
        
        # Upsert the progress
        await self.db.onboarding_progress.update_one(
            {"user_id": user_id},
            {"$set": progress_doc},
            upsert=True
        )
        
        return progress_doc
    
    async def mark_complete(self, user_id: str) -> Dict:
        """
        Mark onboarding as completed
        
        Args:
            user_id: User ID
            
        Returns:
            Updated progress document
        """
        progress_doc = {
            "user_id": user_id,
            "current_step": 0,
            "completed_steps": [],
            "is_completed": True,
            "completed_at": datetime.now(timezone.utc).isoformat(),
            "last_updated": datetime.now(timezone.utc).isoformat()
        }
        
        await self.db.onboarding_progress.update_one(
            {"user_id": user_id},
            {"$set": progress_doc},
            upsert=True
        )
        
        return progress_doc
