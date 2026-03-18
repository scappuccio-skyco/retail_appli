"""
Manager Seller Metadata Repository
Stores per-manager-per-seller metadata (e.g. notes_last_seen_at).
Collection: manager_seller_metadata
"""
from typing import Optional, Dict
from datetime import datetime, timezone
from repositories.base_repository import BaseRepository


class ManagerSellerMetadataRepository(BaseRepository):
    """Repository for manager_seller_metadata collection."""

    def __init__(self, db):
        super().__init__(db, "manager_seller_metadata")

    async def find_by_manager_seller(
        self, manager_id: str, seller_id: str
    ) -> Optional[Dict]:
        return await self.find_one(
            {"manager_id": manager_id, "seller_id": seller_id},
            {"_id": 0},
        )

    async def upsert_notes_last_seen(
        self, manager_id: str, seller_id: str, store_id: str
    ) -> str:
        """Update (or create) notes_last_seen_at timestamp. Returns ISO timestamp."""
        now = datetime.now(timezone.utc).isoformat()
        await self.db[self.collection_name].update_one(
            {"manager_id": manager_id, "seller_id": seller_id},
            {
                "$set": {
                    "notes_last_seen_at": now,
                    "store_id": store_id,
                    "updated_at": now,
                },
                "$setOnInsert": {
                    "manager_id": manager_id,
                    "seller_id": seller_id,
                    "created_at": now,
                },
            },
            upsert=True,
        )
        return now
