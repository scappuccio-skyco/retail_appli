"""
AI Conversation Repository
Data access for ai_conversations collection (SuperAdmin / usage).
"""
from repositories.base_repository import BaseRepository


class AIConversationRepository(BaseRepository):
    """Repository for ai_conversations collection."""

    def __init__(self, db):
        super().__init__(db, "ai_conversations")
