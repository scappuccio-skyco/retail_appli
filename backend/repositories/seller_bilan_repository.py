"""
Seller Bilan Repository - Data access for seller_bilans collection
"""
from typing import Optional, List, Dict, Any
from repositories.base_repository import BaseRepository


class SellerBilanRepository(BaseRepository):
    """Repository for seller_bilans collection"""
    
    def __init__(self, db):
        super().__init__(db, "seller_bilans")
    
    async def find_by_seller(
        self,
        seller_id: str,
        limit: int = 100,
        skip: int = 0
    ) -> List[Dict]:
        """Find all bilans for a seller"""
        return await self.find_many(
            {"seller_id": seller_id},
            sort=[("created_at", -1)],
            limit=limit,
            skip=skip
        )
    
    async def create_bilan(self, bilan_data: Dict[str, Any]) -> str:
        """Create a new seller bilan"""
        if "id" not in bilan_data:
            import uuid
            bilan_data["id"] = str(uuid.uuid4())
        if "created_at" not in bilan_data:
            from datetime import datetime, timezone
            bilan_data["created_at"] = datetime.now(timezone.utc).isoformat()
        
        return await self.insert_one(bilan_data)
