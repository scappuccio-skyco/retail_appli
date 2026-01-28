"""
AI Usage Log Repository
Data access for ai_usage_logs collection (SuperAdmin / usage).
"""
from repositories.base_repository import BaseRepository


class AIUsageLogRepository(BaseRepository):
    """Repository for ai_usage_logs collection."""

    def __init__(self, db):
        super().__init__(db, "ai_usage_logs")
