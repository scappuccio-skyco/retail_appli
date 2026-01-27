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
    
    async def delete_analysis(self, analysis_id: str) -> bool:
        """Delete team analysis by ID"""
        return await self.delete_one({"id": analysis_id})
