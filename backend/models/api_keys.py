"""
API Keys Models
Data models for API key management (for integrations)
"""
from pydantic import BaseModel
from typing import List, Optional


class APIKeyCreate(BaseModel):
    """Create a new API key"""
    name: str
    permissions: List[str] = ["write:kpi", "read:stats"]
    expires_days: Optional[int] = None
    store_ids: Optional[List[str]] = None  # None = all stores, [] = no stores, [id1, id2] = specific stores


class APIKeyResponse(BaseModel):
    """API key response (key shown only once at creation)"""
    id: str
    name: str
    key: str  # Only shown once at creation
    permissions: List[str]
    active: bool
    created_at: str
    last_used_at: Optional[str]
    expires_at: Optional[str]
    store_ids: Optional[List[str]] = None
