"""Integration Service - Business logic for API keys and integrations"""
from typing import Dict, List, Optional
from datetime import datetime, timezone
from uuid import uuid4
import secrets
import logging

from repositories.integration_repository import IntegrationRepository
from core.security import get_password_hash, verify_password

logger = logging.getLogger(__name__)


class IntegrationService:
    """Service for integration-related business logic. Phase 0: repositories only, no self.db."""

    def __init__(self, integration_repo: IntegrationRepository, user_repo):
        self.integration_repo = integration_repo
        self.user_repo = user_repo
    
    async def create_api_key(
        self,
        user_id: str,
        name: str,
        permissions: List[str],
        expires_days: int = None,
        store_ids: Optional[List[str]] = None
    ) -> Dict:
        """
        Create a new API key
        
        Args:
            user_id: User ID owning the key
            name: Friendly name for the key
            permissions: List of permissions (e.g., ["write:kpi", "read:kpi"])
            expires_days: Optional expiration in days
            store_ids: Optional list of store IDs to restrict access
        
        Returns:
            Dict with api_key (ONLY SHOWN ONCE), key_id, and message
        """
        # Generate API key
        api_key = f"sk_live_{secrets.token_urlsafe(32)}"
        
        # Hash the key for storage
        hashed_key = get_password_hash(api_key)
        
        # Calculate expiration
        expires_at = None
        if expires_days:
            expires_at = datetime.now(timezone.utc).timestamp() + (expires_days * 86400)
        
        # Calculate tenant_id from user_id (source of truth for multi-tenancy)
        tenant_id = await self._calculate_tenant_id(user_id)
        if not tenant_id:
            raise ValueError("Cannot determine tenant_id for API key owner")
        
        # Build key document
        key_doc = {
            "id": str(uuid4()),
            "key_hash": hashed_key,
            "key_prefix": api_key[:12],
            "name": name,
            "user_id": user_id,
            "tenant_id": tenant_id,  # Explicit tenant_id for multi-tenancy
            "permissions": permissions,
            "store_ids": store_ids,  # None = all stores, [] = no stores, [id1, id2] = specific stores
            "expires_at": expires_at,
            "active": True,
            "created_at": datetime.now(timezone.utc)
        }
        
        await self.integration_repo.create_api_key(key_doc)
        
        return {
            "api_key": api_key,  # Only returned once!
            "key_id": key_doc['id'],
            "message": "Sauvegardez cette clé, elle ne sera plus affichée"
        }
    
    async def _calculate_tenant_id(self, user_id: str) -> Optional[str]:
        """
        Calculate tenant_id from user_id.
        Source of truth: if user is gérant, tenant_id = user_id, else tenant_id = user.gerant_id
        """
        user = await self.user_repo.find_by_id(user_id)
        if not user:
            return None
        
        # Normalize role
        role_norm = (user.get("role") or "").strip().lower()
        
        # Calculate tenant_id
        if role_norm in ["gerant", "gérant"]:
            return str(user.get("id") or user.get("_id"))
        else:
            gerant_id = user.get("gerant_id")
            return str(gerant_id) if gerant_id else None
    
    async def list_api_keys(
        self,
        user_id: str,
        page: int = 1,
        size: int = 50,
    ) -> Dict:
        """List API keys for a user (paginated). Returns items + meta (total, page, size, pages)."""
        from config.limits import MAX_PAGE_SIZE
        size = min(size, MAX_PAGE_SIZE) if size else 50
        items, total = await self.integration_repo.find_api_keys_by_user(
            user_id, page=page, size=size
        )
        pages = (total + size - 1) // size if total > 0 else 0
        return {
            "items": items,
            "total": total,
            "page": page,
            "size": size,
            "pages": pages,
        }
    
    async def verify_api_key(self, api_key: str) -> Dict:
        """
        Verify an API key
        
        Args:
            api_key: The full API key to verify
        
        Returns:
            Key document if valid
        
        Raises:
            ValueError: If key is invalid, inactive, or expired
        """
        if not api_key:
            raise ValueError("API Key is required")
        
        # Validate key format
        if not api_key.startswith("sk_live_"):
            logger.warning(f"Invalid API key format. Expected prefix 'sk_live_', got: {api_key[:12]}...")
            raise ValueError("Invalid API Key format. API keys must start with 'sk_live_'")
        
        # Find key by prefix (first page, enough for verification)
        key_prefix = api_key[:12]
        possible_keys, _ = await self.integration_repo.find_api_keys_by_prefix(
            key_prefix, page=1, size=20
        )
        
        if not possible_keys:
            logger.warning(f"No API keys found with prefix: {key_prefix}...")
            raise ValueError("Invalid or inactive API Key - No matching key found")
        
        # Try to match the key with hash verification
        for key_doc in possible_keys:
            if verify_password(api_key, key_doc['key_hash']):
                # Check if key is active
                if not key_doc.get('active', True):
                    logger.warning(f"API key {key_doc.get('id')} is inactive")
                    raise ValueError("API Key is inactive")
                
                # Check expiration
                if key_doc.get('expires_at'):
                    expires_timestamp = key_doc['expires_at']
                    if isinstance(expires_timestamp, str):
                        # Handle ISO format strings
                        expires_dt = datetime.fromisoformat(expires_timestamp.replace('Z', '+00:00'))
                        expires_timestamp = expires_dt.timestamp()
                    if datetime.now(timezone.utc).timestamp() > expires_timestamp:
                        logger.warning(f"API key {key_doc.get('id')} has expired")
                        raise ValueError("API Key expired")
                
                # MIGRATION: If key doesn't have tenant_id, calculate and update it
                if 'tenant_id' not in key_doc or not key_doc.get('tenant_id'):
                    tenant_id = await self._calculate_tenant_id(key_doc.get('user_id'))
                    if tenant_id:
                        # Update the key with tenant_id
                        await self.integration_repo.api_keys.update_one(
                            {"id": key_doc['id']},
                            {"$set": {"tenant_id": tenant_id}}
                        )
                        key_doc['tenant_id'] = tenant_id
                    else:
                        # Cannot determine tenant, deactivate key
                        logger.warning(f"API key {key_doc['id']} has no tenant_id and cannot be calculated. Deactivating.")
                        await self.integration_repo.api_keys.update_one(
                            {"id": key_doc['id']},
                            {"$set": {"active": False}}
                        )
                        raise ValueError("API Key configuration invalid: missing tenant_id")
                
                # Update last_used_at
                await self.integration_repo.api_keys.update_one(
                    {"id": key_doc['id']},
                    {"$set": {"last_used_at": datetime.now(timezone.utc)}}
                )
                
                return key_doc
        
        # If we get here, the key prefix matched but hash verification failed
        logger.warning(f"API key hash verification failed for prefix: {key_prefix}...")
        raise ValueError("Invalid or inactive API Key - Hash verification failed")
    
    async def get_tenant_id_from_api_key(self, api_key_data: Dict) -> Optional[str]:
        """
        Extracts the tenant_id (gerant_id) from the API key data.
        This is the explicit source of truth for multi-tenancy.
        """
        return api_key_data.get('tenant_id')
    
    async def deactivate_api_key(self, key_id: str, user_id: str) -> bool:
        """Deactivate an API key"""
        return await self.integration_repo.deactivate_api_key(key_id, user_id)
