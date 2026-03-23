"""
Team Analysis Repository - Data access for team_analyses collection
"""
from typing import Optional, Dict, Any
from datetime import datetime, timezone
from repositories.base_repository import BaseRepository


class TeamAnalysisRepository(BaseRepository):
    """Repository for team_analyses collection"""
    
    def __init__(self, db):
        super().__init__(db, "team_analyses")
    
    async def create_analysis(self, analysis_data: Dict[str, Any]) -> str:
        """Create a new team analysis"""
        if "id" not in analysis_data:
            import uuid
            analysis_data["id"] = str(uuid.uuid4())
        if "created_at" not in analysis_data:
            analysis_data["created_at"] = datetime.now(timezone.utc).isoformat()
        
        return await self.insert_one(analysis_data)
    
    async def find_recent_by_period(
        self,
        store_id: str,
        period_start: str,
        period_end: str,
        max_age_hours: int = 6,
    ) -> Optional[Dict[str, Any]]:
        """Return the most recent analysis for store+period if younger than max_age_hours."""
        from datetime import datetime, timezone, timedelta
        cutoff = (datetime.now(timezone.utc) - timedelta(hours=max_age_hours)).isoformat()
        results = await self.find_many(
            {
                "store_id": store_id,
                "period_start": period_start,
                "period_end": period_end,
                "generated_at": {"$gte": cutoff},
            },
            limit=1,
            sort=[("generated_at", -1)],
        )
        return results[0] if results else None

    async def delete_analysis(self, analysis_id: str) -> bool:
        """Delete team analysis by ID"""
        return await self.delete_one({"id": analysis_id})
