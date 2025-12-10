"""Diagnostic Repository"""
from typing import Optional, List, Dict
from repositories.base_repository import BaseRepository


class DiagnosticRepository(BaseRepository):
    """Repository for diagnostics collection (seller diagnostics)"""
    
    def __init__(self, db):
        super().__init__(db, "diagnostics")
    
    async def find_by_seller(self, seller_id: str) -> Optional[Dict]:
        """Find latest diagnostic for a seller"""
        results = await self.find_many(
            {"seller_id": seller_id},
            sort=[("created_at", -1)],
            limit=1
        )
        return results[0] if results else None
    
    async def find_all_by_seller(self, seller_id: str) -> List[Dict]:
        """Find all diagnostics for a seller"""
        return await self.find_many(
            {"seller_id": seller_id},
            sort=[("created_at", -1)]
        )
