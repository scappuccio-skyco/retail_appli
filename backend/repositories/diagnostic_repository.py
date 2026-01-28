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
    
    async def create_diagnostic(self, diagnostic_data: Dict) -> str:
        """Create a new diagnostic"""
        if "id" not in diagnostic_data:
            import uuid
            diagnostic_data["id"] = str(uuid.uuid4())
        if "created_at" not in diagnostic_data:
            from datetime import datetime, timezone
            diagnostic_data["created_at"] = datetime.now(timezone.utc).isoformat()
        
        return await self.insert_one(diagnostic_data)
    
    async def delete_by_seller(self, seller_id: str) -> int:
        """Delete all diagnostics for a seller"""
        return await self.delete_many({"seller_id": seller_id})

    async def update_scores_by_seller(
        self,
        seller_id: str,
        scores: dict,
    ) -> bool:
        """
        Update or upsert diagnostic competence scores for a seller (RC6: used by debriefs route).
        scores: dict with keys score_accueil, score_decouverte, score_argumentation, score_closing, score_fidelisation.
        """
        from datetime import datetime, timezone
        update = {
            "$set": {
                "score_accueil": scores.get("accueil", 3.0),
                "score_decouverte": scores.get("decouverte", 3.0),
                "score_argumentation": scores.get("argumentation", 3.0),
                "score_closing": scores.get("closing", 3.0),
                "score_fidelisation": scores.get("fidelisation", 3.0),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }
        }
        return await self.update_one({"seller_id": seller_id}, update, upsert=True)
