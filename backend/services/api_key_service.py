"""
APIKeyService — gestionnaire des clés API (manager + gérant).
"""
from __future__ import annotations
from datetime import datetime, timezone
from typing import Dict, List, Optional

from repositories.enterprise_repository import APIKeyRepository


class APIKeyService:
    """Service for API key management operations. Phase 0: repository only, no self.db."""

    def __init__(self, api_key_repo: APIKeyRepository):
        self.api_key_repo = api_key_repo

    async def create_api_key(
        self,
        user_id: str,
        store_id: Optional[str],
        gerant_id: Optional[str],
        name: str,
        permissions: List[str],
        store_ids: Optional[List[str]] = None,
        expires_days: Optional[int] = None
    ) -> Dict:
        """
        Create a new API key

        Args:
            user_id: User ID owning the key
            store_id: Store ID (for manager)
            gerant_id: Gérant ID (if applicable)
            name: Friendly name for the key
            permissions: List of permissions
            store_ids: Optional list of specific store IDs
            expires_days: Optional expiration in days

        Returns:
            Dict with key details (including the key itself, shown only once)
        """
        from uuid import uuid4
        import secrets
        from core.security import get_password_hash

        # Generate secure API key
        random_part = secrets.token_urlsafe(32)
        api_key = f"sk_live_{random_part}"

        # Hash the key for storage (same system as IntegrationService)
        hashed_key = get_password_hash(api_key)

        # Calculate expiration
        expires_at = None
        if expires_days:
            expires_at = datetime.now(timezone.utc).timestamp() + (expires_days * 86400)

        # Create record (using same format as IntegrationService for compatibility)
        key_id = str(uuid4())
        key_record = {
            "id": key_id,
            "user_id": user_id,
            "store_id": store_id,
            "gerant_id": gerant_id,
            "key_hash": hashed_key,  # Store hashed key instead of plain text
            "key_prefix": api_key[:12],  # Store prefix for lookup
            "name": name,
            "permissions": permissions,
            "store_ids": store_ids,
            "active": True,
            "created_at": datetime.now(timezone.utc),
            "last_used_at": None,
            "expires_at": expires_at
        }

        await self.api_key_repo.create_key(key_record, user_id)

        # Convert created_at to ISO string for JSON serialization
        created_at_iso = key_record["created_at"].isoformat() if isinstance(key_record["created_at"], datetime) else key_record["created_at"]

        # Convert expires_at timestamp to ISO string if it exists
        expires_at_iso = None
        if expires_at:
            if isinstance(expires_at, (int, float)):
                expires_at_iso = datetime.fromtimestamp(expires_at, tz=timezone.utc).isoformat()
            elif isinstance(expires_at, datetime):
                expires_at_iso = expires_at.isoformat()
            else:
                expires_at_iso = expires_at

        return {
            "id": key_id,
            "name": name,
            "key": api_key,  # Only shown at creation (for frontend compatibility)
            "api_key": api_key,  # Also return as api_key for consistency
            "permissions": permissions,
            "active": True,
            "created_at": created_at_iso,
            "last_used_at": None,
            "expires_at": expires_at_iso,
            "store_ids": store_ids
        }

    async def list_api_keys(self, user_id: str) -> Dict:
        """
        List all API keys for a user (without the actual key value)

        Args:
            user_id: User ID

        Returns:
            Dict with api_keys list
        """
        keys = await self.api_key_repo.find_by_user(
            user_id,
            projection={"_id": 0, "key": 0}  # Don't return _id or actual key
        )

        return {"api_keys": keys}

    async def deactivate_api_key(self, key_id: str, user_id: str) -> Dict:
        """
        Deactivate an API key (soft delete)

        Args:
            key_id: API key ID
            user_id: User ID for ownership verification

        Returns:
            Success message

        Raises:
            ValueError: If key not found
        """
        # Verify ownership
        key = await self.api_key_repo.find_by_id(key_id, user_id=user_id)
        if not key:
            raise ValueError("API key not found")

        # Deactivate instead of delete (for audit)
        await self.api_key_repo.update_key(
            key_id,
            {"active": False, "deleted_at": datetime.now(timezone.utc).isoformat()},
            user_id=user_id
        )

        return {"message": "API key deactivated successfully"}

    async def reactivate_api_key(self, key_id: str, user_id: str) -> Dict:
        """
        Reactivate a previously deactivated API key.

        Args:
            key_id: API key ID
            user_id: User ID for ownership verification

        Returns:
            Success message

        Raises:
            ValueError: If key not found
        """
        key = await self.api_key_repo.find_by_id(key_id, user_id=user_id)
        if not key:
            raise ValueError("API key not found")

        await self.api_key_repo.update_key(
            key_id,
            {"active": True, "deleted_at": None, "deactivated_at": None},
            user_id=user_id
        )

        return {"message": "API key reactivated successfully"}

    async def regenerate_api_key(self, key_id: str, user_id: str) -> Dict:
        """
        Regenerate an API key (creates new key, deactivates old)

        Args:
            key_id: API key ID
            user_id: User ID for ownership verification

        Returns:
            New key details

        Raises:
            ValueError: If key not found
        """
        from uuid import uuid4
        import secrets

        # Find old key
        old_key = await self.api_key_repo.find_by_id(key_id, user_id=user_id)
        if not old_key:
            raise ValueError("API key not found")

        # Deactivate old key
        await self.api_key_repo.update_key(
            key_id,
            {"active": False, "regenerated_at": datetime.now(timezone.utc).isoformat()},
            user_id=user_id
        )

        # Generate new key
        from core.security import get_password_hash

        random_part = secrets.token_urlsafe(32)
        new_api_key = f"sk_live_{random_part}"

        # Hash the key for storage (same system as IntegrationService)
        hashed_key = get_password_hash(new_api_key)

        new_key_id = str(uuid4())

        # Handle expiration format (could be timestamp or ISO string)
        expires_at = old_key.get('expires_at')
        if expires_at and isinstance(expires_at, str):
            # Convert ISO string to timestamp if needed
            try:
                expires_dt = datetime.fromisoformat(expires_at.replace('Z', '+00:00'))
                expires_at = expires_dt.timestamp()
            except Exception:
                pass

        new_key_record = {
            "id": new_key_id,
            "user_id": user_id,
            "store_id": old_key.get('store_id'),
            "gerant_id": old_key.get('gerant_id'),
            "key_hash": hashed_key,  # Store hashed key instead of plain text
            "key_prefix": new_api_key[:12],  # Store prefix for lookup
            "name": old_key['name'],
            "permissions": old_key['permissions'],
            "store_ids": old_key.get('store_ids'),
            "active": True,
            "created_at": datetime.now(timezone.utc),
            "last_used_at": None,
            "expires_at": expires_at,
            "previous_key_id": key_id
        }

        await self.api_key_repo.create_key(new_key_record, user_id)

        return {
            "id": new_key_id,
            "key": new_api_key,  # Only shown at regeneration (for frontend compatibility)
            "api_key": new_api_key,  # Also return as api_key for consistency
            "name": new_key_record["name"],
            "permissions": new_key_record["permissions"],
            "active": True,
            "created_at": new_key_record["created_at"],
            "last_used_at": None,
            "expires_at": new_key_record.get("expires_at"),
            "store_ids": new_key_record.get("store_ids")
        }

    async def delete_api_key_permanent(
        self,
        key_id: str,
        user_id: str,
        role: str
    ) -> Dict:
        """
        Permanently delete an inactive API key

        Args:
            key_id: API key ID
            user_id: User ID for ownership verification
            role: User role (manager, gerant)

        Returns:
            Success message

        Raises:
            ValueError: If key not found or not authorized
        """
        # Find the key
        key = await self.api_key_repo.find_by_id(key_id, projection={"_id": 0})

        if not key:
            raise ValueError("API key not found")

        # Verify ownership based on role
        if role == 'manager':
            if key.get('user_id') != user_id:
                raise PermissionError("Not authorized to delete this key")
        elif role in ['gerant']:
            if key.get('gerant_id') != user_id:
                raise PermissionError("Not authorized to delete this key")

        # Only allow deletion of inactive keys
        if key.get('active'):
            raise ValueError("Cannot permanently delete an active key. Deactivate it first.")

        # Permanently delete
        await self.api_key_repo.delete_key(key_id, user_id=user_id if role == 'manager' else None)

        return {"success": True, "message": "API key permanently deleted"}
