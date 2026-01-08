"""
Manager Service
Business logic for manager operations (team management, KPIs, diagnostics)
"""
from typing import Dict, List, Optional
from datetime import datetime, timezone, timedelta
import logging

from repositories.user_repository import UserRepository
from repositories.store_repository import StoreRepository

logger = logging.getLogger(__name__)


class ManagerService:
    """Service for manager operations"""
    
    def __init__(self, db):
        self.db = db
        self.user_repo = UserRepository(db)
        self.store_repo = StoreRepository(db)
    
    async def get_sellers(self, manager_id: str, store_id: str) -> List[Dict]:
        """
        Get all sellers for a store
        
        Note: Uses store_id as primary filter. 
        manager_id is used for logging/audit but not required for filtering
        since a gérant can also query sellers.
        """
        sellers = await self.user_repo.find_many(
            {
                "store_id": store_id,
                "role": "seller",
                "status": {"$ne": "deleted"}
            },
            {"_id": 0, "password": 0}
        )
        return sellers
    
    async def get_invitations(self, manager_id: str) -> List[Dict]:
        """Get pending invitations for manager"""
        invitations = await self.db.invitations.find(
            {"invited_by": manager_id, "status": "pending"},
            {"_id": 0}
        ).to_list(100)
        return invitations
    
    async def get_sync_mode(self, store_id: str) -> Dict:
        """Get sync mode configuration for store"""
        store = await self.store_repo.find_one({"id": store_id}, {"_id": 0})
        
        if not store:
            return {
                "sync_mode": "manual",
                "external_sync_enabled": False,
                "is_enterprise": False,
                "can_edit_kpi": True,
                "can_edit_objectives": True
            }
        
        # Ensure sync_mode is never null - default to "manual"
        sync_mode = store.get("sync_mode") or "manual"
        
        return {
            "sync_mode": sync_mode,
            "external_sync_enabled": sync_mode == "api_sync",
            "is_enterprise": sync_mode in ["api_sync", "scim_sync"],
            "can_edit_kpi": sync_mode == "manual",
            "can_edit_objectives": True  # Objectives can always be edited
        }
    
    async def get_kpi_config(self, store_id: str) -> Dict:
        """Get KPI configuration for store"""
        config = await self.db.kpi_configs.find_one(
            {"store_id": store_id},
            {"_id": 0}
        )
        
        if not config:
            # Return default config
            return {
                "store_id": store_id,
                "enabled_kpis": ["ca_journalier", "nb_ventes", "nb_articles", "panier_moyen"],
                "required_kpis": ["ca_journalier", "nb_ventes"],
                "saisie_enabled": True
            }
        
        return config
    
    async def get_team_bilans_all(self, manager_id: str, store_id: str) -> List[Dict]:
        """Get all team bilans for manager"""
        bilans = await self.db.team_bilans.find(
            {"manager_id": manager_id, "store_id": store_id},
            {"_id": 0}
        ).sort("created_at", -1).to_list(100)
        
        return bilans
    
    async def get_store_kpi_stats(
        self,
        store_id: str,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None
    ) -> Dict:
        """Get aggregated KPI stats for store"""
        from datetime import timedelta
        
        # Default to current month if no dates provided
        if not start_date:
            today = datetime.now(timezone.utc)
            start_date = today.replace(day=1).strftime('%Y-%m-%d')
        
        if not end_date:
            end_date = datetime.now(timezone.utc).strftime('%Y-%m-%d')
        
        # Aggregate seller KPIs
        seller_pipeline = [
            {"$match": {
                "store_id": store_id,
                "date": {"$gte": start_date, "$lte": end_date}
            }},
            {"$group": {
                "_id": None,
                "total_ca": {"$sum": {"$ifNull": ["$seller_ca", {"$ifNull": ["$ca_journalier", 0]}]}},
                "total_ventes": {"$sum": {"$ifNull": ["$nb_ventes", 0]}},
                "total_articles": {"$sum": {"$ifNull": ["$nb_articles", 0]}}
            }}
        ]
        
        seller_stats = await self.db.kpi_entries.aggregate(seller_pipeline).to_list(1)
        
        # Aggregate manager KPIs
        manager_pipeline = [
            {"$match": {
                "store_id": store_id,
                "date": {"$gte": start_date, "$lte": end_date}
            }},
            {"$group": {
                "_id": None,
                "total_ca": {"$sum": {"$ifNull": ["$ca_journalier", 0]}},
                "total_ventes": {"$sum": {"$ifNull": ["$nb_ventes", 0]}},
                "total_articles": {"$sum": {"$ifNull": ["$nb_articles", 0]}}
            }}
        ]
        
        manager_stats = await self.db.manager_kpis.aggregate(manager_pipeline).to_list(1)
        
        seller_ca = seller_stats[0].get("total_ca", 0) if seller_stats else 0
        seller_ventes = seller_stats[0].get("total_ventes", 0) if seller_stats else 0
        seller_articles = seller_stats[0].get("total_articles", 0) if seller_stats else 0
        
        manager_ca = manager_stats[0].get("total_ca", 0) if manager_stats else 0
        manager_ventes = manager_stats[0].get("total_ventes", 0) if manager_stats else 0
        manager_articles = manager_stats[0].get("total_articles", 0) if manager_stats else 0
        
        total_ca = seller_ca + manager_ca
        total_ventes = seller_ventes + manager_ventes
        total_articles = seller_articles + manager_articles
        
        return {
            "store_id": store_id,
            "period": {
                "start": start_date,
                "end": end_date
            },
            "total_ca": total_ca,
            "total_ventes": total_ventes,
            "total_articles": total_articles,
            "panier_moyen": (total_ca / total_ventes) if total_ventes > 0 else 0,
            "uvc": (total_articles / total_ventes) if total_ventes > 0 else 0,
            "seller_stats": {
                "ca": seller_ca,
                "ventes": seller_ventes,
                "articles": seller_articles
            },
            "manager_stats": {
                "ca": manager_ca,
                "ventes": manager_ventes,
                "articles": manager_articles
            }
        }
    
    async def get_active_objectives(self, manager_id: str, store_id: str) -> List[Dict]:
        """Get active objectives for manager's team"""
        from services.seller_service import SellerService
        seller_service = SellerService(self.db)
        
        today = datetime.now(timezone.utc).strftime('%Y-%m-%d')
        objectives = await self.db.objectives.find(
            {
                "store_id": store_id,
                "$or": [
                    {"status": "active", "period_end": {"$gte": today}},
                    {"status": "achieved"}  # Include achieved objectives even if period ended
                ]
            },
            {"_id": 0}
        ).to_list(100)
        
        # Add achievement notification flags
        await seller_service.add_achievement_notification_flag(objectives, manager_id, "objective")
        
        return objectives
    
    async def get_active_challenges(self, manager_id: str, store_id: str) -> List[Dict]:
        """Get active challenges for manager's team"""
        from services.seller_service import SellerService
        seller_service = SellerService(self.db)
        
        challenges = await self.db.challenges.find(
            {
                "store_id": store_id,
                "status": {"$in": ["active", "completed"]},  # Include completed challenges
                "end_date": {"$gte": datetime.now(timezone.utc).strftime('%Y-%m-%d')}
            },
            {"_id": 0}
        ).to_list(100)
        
        # Add achievement notification flags
        await seller_service.add_achievement_notification_flag(challenges, manager_id, "challenge")
        
        return challenges


class DiagnosticService:
    """Service for diagnostic operations"""
    
    def __init__(self, db):
        self.db = db
    
    async def get_manager_diagnostic(self, manager_id: str) -> Optional[Dict]:
        """Get manager's DISC diagnostic profile"""
        diagnostic = await self.db.manager_diagnostics.find_one(
            {"manager_id": manager_id},
            {"_id": 0}
        )
        
        return diagnostic


class APIKeyService:
    """Service for API key management operations"""
    
    def __init__(self, db):
        self.db = db
    
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
        
        await self.db.api_keys.insert_one(key_record)
        
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
        keys = await self.db.api_keys.find(
            {"user_id": user_id},
            {"_id": 0, "key": 0}  # Don't return _id or actual key
        ).to_list(100)
        
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
        key = await self.db.api_keys.find_one({"id": key_id, "user_id": user_id})
        if not key:
            raise ValueError("API key not found")
        
        # Deactivate instead of delete (for audit)
        await self.db.api_keys.update_one(
            {"id": key_id},
            {"$set": {"active": False, "deleted_at": datetime.now(timezone.utc).isoformat()}}
        )
        
        return {"message": "API key deactivated successfully"}
    
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
        old_key = await self.db.api_keys.find_one({"id": key_id, "user_id": user_id})
        if not old_key:
            raise ValueError("API key not found")
        
        # Deactivate old key
        await self.db.api_keys.update_one(
            {"id": key_id},
            {"$set": {"active": False, "regenerated_at": datetime.now(timezone.utc).isoformat()}}
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
            except:
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
        
        await self.db.api_keys.insert_one(new_key_record)
        
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
        key = await self.db.api_keys.find_one({"id": key_id}, {"_id": 0})
        
        if not key:
            raise ValueError("API key not found")
        
        # Verify ownership based on role
        if role == 'manager':
            if key.get('user_id') != user_id:
                raise PermissionError("Not authorized to delete this key")
        elif role in ['gerant', 'gérant']:
            if key.get('gerant_id') != user_id:
                raise PermissionError("Not authorized to delete this key")
        
        # Only allow deletion of inactive keys
        if key.get('active'):
            raise ValueError("Cannot permanently delete an active key. Deactivate it first.")
        
        # Permanently delete
        await self.db.api_keys.delete_one({"id": key_id})
        
        return {"success": True, "message": "API key permanently deleted"}

