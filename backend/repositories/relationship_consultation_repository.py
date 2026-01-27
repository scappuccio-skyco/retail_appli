"""
Relationship Consultation Repository - Data access for relationship_consultations collection
"""
from typing import Optional, Dict, Any
from repositories.base_repository import BaseRepository


class RelationshipConsultationRepository(BaseRepository):
    """Repository for relationship_consultations collection"""
    
    def __init__(self, db):
        super().__init__(db, "relationship_consultations")
    
    async def delete_consultation(self, consultation_id: str) -> bool:
        """Delete relationship consultation by ID"""
        return await self.delete_one({"id": consultation_id})
