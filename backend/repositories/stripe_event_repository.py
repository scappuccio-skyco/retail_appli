"""
Stripe Event Repository
Data access for stripe_events collection (webhook idempotency / audit).
"""
from repositories.base_repository import BaseRepository


class StripeEventRepository(BaseRepository):
    """Repository for stripe_events collection."""

    def __init__(self, db):
        super().__init__(db, "stripe_events")
