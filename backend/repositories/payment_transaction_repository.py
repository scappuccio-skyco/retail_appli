"""
Payment Transaction Repository
Data access for payment_transactions collection (SuperAdmin / billing).
"""
from repositories.base_repository import BaseRepository


class PaymentTransactionRepository(BaseRepository):
    """Repository for payment_transactions collection."""

    def __init__(self, db):
        super().__init__(db, "payment_transactions")
