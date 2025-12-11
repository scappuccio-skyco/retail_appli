"""Integration Service - Business logic for API keys and integrations"""
from typing import Dict, List
from datetime import datetime, timezone
from uuid import uuid4
import secrets

from repositories.integration_repository import IntegrationRepository
from core.security import get_password_hash, verify_password


class IntegrationService:
    """Service for integration-related business logic"""
    
    def __init__(self, integration_repo: IntegrationRepository):
        self.integration_repo = integration_repo
    
    async def create_api_key(
        self,
        user_id: str,
        name: str,
        permissions: List[str],
        expires_days: int = None
    ) -> Dict:
        """
        Create a new API key
        
        Args:
            user_id: User ID owning the key
            name: Friendly name for the key
            permissions: List of permissions (e.g., ["write:kpi", "read:kpi"])
            expires_days: Optional expiration in days
        
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
        
        # Build key document
        key_doc = {
            "id": str(uuid4()),
            "key_hash": hashed_key,
            "key_prefix": api_key[:12],
            "name": name,
            "user_id": user_id,
            "permissions": permissions,
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
    
    async def list_api_keys(self, user_id: str) -> List[Dict]:
        """List all API keys for a user (without hash)"""
        return await self.integration_repo.find_api_keys_by_user(user_id)
    
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
        # Find key by prefix
        key_prefix = api_key[:12]
        possible_keys = await self.integration_repo.find_api_keys_by_prefix(key_prefix)
        
        for key_doc in possible_keys:
            if verify_password(api_key, key_doc['key_hash']):
                # Check expiration
                if key_doc.get('expires_at'):
                    if datetime.now(timezone.utc).timestamp() > key_doc['expires_at']:
                        raise ValueError("API Key expired")
                
                return key_doc
        
        raise ValueError("Invalid or inactive API Key")
    
    async def deactivate_api_key(self, key_id: str, user_id: str) -> bool:
        """Deactivate an API key"""
        return await self.integration_repo.deactivate_api_key(key_id, user_id)
