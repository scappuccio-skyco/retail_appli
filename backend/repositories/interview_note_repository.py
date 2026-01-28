"""
Interview Note Repository - Data access for interview_notes collection
"""
from typing import Optional, Dict, Any, List
from datetime import datetime, timezone
from repositories.base_repository import BaseRepository


class InterviewNoteRepository(BaseRepository):
    """Repository for interview_notes collection"""
    
    def __init__(self, db):
        super().__init__(db, "interview_notes")
    
    async def find_by_seller_and_evaluation(
        self,
        seller_id: str,
        evaluation_id: str
    ) -> Optional[Dict]:
        """Find interview note for a seller and evaluation"""
        return await self.find_one(
            {"seller_id": seller_id, "evaluation_id": evaluation_id},
            {"_id": 0}
        )
    
    async def find_by_seller_and_date(
        self,
        seller_id: str,
        date: str
    ) -> Optional[Dict]:
        """Find interview note for a seller and date"""
        return await self.find_one(
            {"seller_id": seller_id, "date": date},
            {"_id": 0}
        )
    
    async def find_by_seller(self, seller_id: str) -> List[Dict]:
        """Find all interview notes for a seller"""
        return await self.find_many(
            {"seller_id": seller_id},
            sort=[("created_at", -1)]
        )
    
    async def create_note(self, note_data: Dict[str, Any]) -> str:
        """Create a new interview note"""
        if "id" not in note_data:
            import uuid
            note_data["id"] = str(uuid.uuid4())
        if "created_at" not in note_data:
            note_data["created_at"] = datetime.now(timezone.utc).isoformat()
        
        return await self.insert_one(note_data)
    
    async def update_note(
        self,
        seller_id: str,
        evaluation_id: str,
        update_data: Dict[str, Any]
    ) -> bool:
        """Update interview note"""
        return await self.update_one(
            {"seller_id": seller_id, "evaluation_id": evaluation_id},
            {"$set": update_data}
        )
    
    async def update_note_by_date(
        self,
        seller_id: str,
        date: str,
        update_data: Dict[str, Any]
    ) -> bool:
        """Update interview note by date"""
        return await self.update_one(
            {"seller_id": seller_id, "date": date},
            {"$set": update_data}
        )
    
    async def delete_note(
        self,
        seller_id: str,
        evaluation_id: str
    ) -> bool:
        """Delete interview note"""
        return await self.delete_one(
            {"seller_id": seller_id, "evaluation_id": evaluation_id}
        )
    
    async def delete_note_by_date(
        self,
        seller_id: str,
        date: str
    ) -> bool:
        """Delete interview note by date"""
        return await self.delete_one(
            {"seller_id": seller_id, "date": date}
        )
    
    async def delete_note_by_id(
        self,
        note_id: str,
        seller_id: str
    ) -> bool:
        """Delete interview note by ID (with seller_id for security)"""
        return await self.delete_one(
            {"id": note_id, "seller_id": seller_id}
        )
