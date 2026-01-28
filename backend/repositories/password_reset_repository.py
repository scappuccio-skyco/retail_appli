"""
Password Reset Repository - Data access for password_resets collection
"""
from typing import Optional, Dict, Any
from repositories.base_repository import BaseRepository


class PasswordResetRepository(BaseRepository):
    """Repository for password_resets collection (tokens for reset flow)"""

    def __init__(self, db):
        super().__init__(db, "password_resets")

    async def create_reset(self, email: str, token: str, expires_at: str, created_at: str) -> str:
        """Create a password reset entry. Returns token (id not stored)."""
        doc = {
            "email": email,
            "token": token,
            "created_at": created_at,
            "expires_at": expires_at,
        }
        await self.insert_one(doc)
        return token

    async def find_by_token(self, token: str, projection: Optional[Dict] = None) -> Optional[Dict]:
        """Find reset entry by token."""
        return await self.find_one({"token": token}, projection or {"_id": 0})

    async def delete_by_token(self, token: str) -> bool:
        """Delete reset entry by token (after use)."""
        return await self.delete_one({"token": token})
