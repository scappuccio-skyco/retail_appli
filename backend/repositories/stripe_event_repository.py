"""
Stripe Event Repository
Data access for stripe_events collection (webhook idempotency / audit).
"""
from datetime import datetime, timezone
from repositories.base_repository import BaseRepository


class StripeEventRepository(BaseRepository):
    """Repository for stripe_events collection."""

    def __init__(self, db):
        super().__init__(db, "stripe_events")

    async def exists(self, event_id: str) -> bool:
        """Return True if this Stripe event was already processed (idempotency check)."""
        doc = await self.find_one({"event_id": event_id}, {"_id": 1})
        return doc is not None

    async def mark_processed(self, event_id: str, event_type: str, stripe_created: int) -> None:
        """Persist a processed Stripe event to prevent double-processing after restart."""
        await self.insert_one({
            "event_id": event_id,
            "event_type": event_type,
            "stripe_created": stripe_created,
            "processed_at": datetime.now(timezone.utc).isoformat(),
        })
