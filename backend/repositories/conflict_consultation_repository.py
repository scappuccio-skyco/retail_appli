"""
Conflict Consultation Repository - Data access for conflict_consultations collection
"""
from typing import Optional, Dict, Any, List
from repositories.base_repository import BaseRepository


class ConflictConsultationRepository(BaseRepository):
    """Repository for conflict_consultations collection"""

    def __init__(self, db):
        super().__init__(db, "conflict_consultations")

    async def create_consultation(self, consultation_data: Dict[str, Any]) -> str:
        """Create a new conflict consultation."""
        return await self.insert_one(consultation_data)

    async def find_many_by_filters(
        self,
        filters: Dict[str, Any],
        projection: Optional[Dict] = None,
        limit: int = 100,
        sort: Optional[List[tuple]] = None,
    ) -> List[Dict]:
        """Find consultations matching filters (e.g. seller_id, manager_id)."""
        sort = sort or [("created_at", -1)]
        return await self.find_many(filters, projection or {"_id": 0}, limit, 0, sort)
