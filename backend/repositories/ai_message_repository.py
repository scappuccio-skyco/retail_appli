"""
AI Message Repository
Data access for ai_messages collection (SuperAdmin / usage).
"""
from repositories.base_repository import BaseRepository


class AIMessageRepository(BaseRepository):
    """Repository for ai_messages collection."""

    def __init__(self, db):
        super().__init__(db, "ai_messages")
