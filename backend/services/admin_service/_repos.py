"""Mini-repositories for collections without a dedicated repository."""
from repositories.base_repository import BaseRepository


# Repositories pour collections sans repository dédié
class PaymentTransactionRepository(BaseRepository):
    """Repository for payment_transactions collection"""
    def __init__(self, db):
        super().__init__(db, "payment_transactions")


class StripeEventRepository(BaseRepository):
    """Repository for stripe_events collection"""
    def __init__(self, db):
        super().__init__(db, "stripe_events")


class AIConversationRepository(BaseRepository):
    """Repository for ai_conversations collection"""
    def __init__(self, db):
        super().__init__(db, "ai_conversations")


class AIMessageRepository(BaseRepository):
    """Repository for ai_messages collection"""
    def __init__(self, db):
        super().__init__(db, "ai_messages")


class AIUsageLogRepository(BaseRepository):
    """Repository for ai_usage_logs collection"""
    def __init__(self, db):
        super().__init__(db, "ai_usage_logs")
