"""
Seller Models
Data models for seller management operations
"""
from pydantic import BaseModel


class SellerTransfer(BaseModel):
    """Model for transferring a seller to another store"""
    new_store_id: str
    new_manager_id: str  # New manager in the new store
