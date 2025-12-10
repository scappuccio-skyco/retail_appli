"""
Enterprise Service
Business logic for enterprise accounts, API keys, bulk imports, and synchronization
"""
from typing import Dict, List, Optional
from datetime import datetime, timezone, timedelta
import secrets
import bcrypt
import logging
from uuid import uuid4

from repositories.enterprise_repository import (
    EnterpriseAccountRepository,
    APIKeyRepository,
    SyncLogRepository
)
from repositories.user_repository import UserRepository
from repositories.store_repository import StoreRepository
from models.enterprise import SyncLog

logger = logging.getLogger(__name__)


class EnterpriseService:
    """Service for enterprise account operations"""
    
    def __init__(self, db):
        self.db = db
        self.enterprise_repo = EnterpriseAccountRepository(db)
        self.api_key_repo = APIKeyRepository(db)
        self.sync_log_repo = SyncLogRepository(db)
        self.user_repo = UserRepository(db)
        self.store_repo = StoreRepository(db)
    
    # ============================================
    # ENTERPRISE ACCOUNT MANAGEMENT
    # ============================================
    
    async def create_enterprise_account(
        self,
        company_name: str,
        company_email: str,
        sync_mode: str,
        it_admin_name: str,
        it_admin_email: str,
        it_admin_password: str
    ) -> Dict:
        """Create enterprise account with IT Admin"""
        # Check if email exists
        existing_user = await self.user_repo.find_by_email(it_admin_email)
        if existing_user:
            raise ValueError("Email already registered")
        
        # Check if company exists
        existing_company = await self.enterprise_repo.find_by_company_name(company_name)
        if existing_company:
            raise ValueError("Company name already exists")
        
        # Create enterprise account
        enterprise_id = str(uuid4())
        enterprise_account = {
            "id": enterprise_id,
            "company_name": company_name,
            "company_email": company_email,
            "sync_mode": sync_mode,
            "scim_enabled": False,
            "billing_type": "enterprise",
            "seats_purchased": 0,
            "seats_used": 0,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        await self.enterprise_repo.insert_one(enterprise_account)
        
        # Create IT Admin user
        hashed_password = bcrypt.hashpw(it_admin_password.encode('utf-8'), bcrypt.gensalt())
        
        it_admin = {
            "id": str(uuid4()),
            "name": it_admin_name,
            "email": it_admin_email,
            "password": hashed_password.decode('utf-8'),
            "role": "it_admin",
            "status": "active",
            "enterprise_account_id": enterprise_id,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        await self.user_repo.insert_one(it_admin)
        
        logger.info(f"✅ Enterprise account created: {company_name} with IT Admin: {it_admin_email}")
        
        return {
            "success": True,
            "enterprise_account_id": enterprise_id,
            "it_admin_email": it_admin_email
        }
    
    async def get_enterprise_config(self, enterprise_id: str) -> Dict:
        """Get enterprise configuration (masked sensitive data)"""
        enterprise = await self.enterprise_repo.find_one({"id": enterprise_id}, {"_id": 0})
        
        if not enterprise:
            raise ValueError("Enterprise account not found")
        
        # Mask sensitive tokens
        if enterprise.get('scim_bearer_token'):
            enterprise['scim_bearer_token'] = "***" + enterprise['scim_bearer_token'][-4:]
        
        return enterprise
    
    async def update_enterprise_config(self, enterprise_id: str, update_data: Dict) -> bool:
        """Update enterprise configuration"""
        update_fields = {k: v for k, v in update_data.items() if v is not None}
        update_fields['updated_at'] = datetime.now(timezone.utc).isoformat()
        
        result = await self.enterprise_repo.collection.update_one(
            {"id": enterprise_id},
            {"$set": update_fields}
        )
        
        return result.modified_count > 0
    
    # ============================================
    # API KEY MANAGEMENT
    # ============================================
    
    async def generate_api_key(
        self,
        enterprise_id: str,
        created_by: str,
        name: str,
        scopes: List[str],
        expires_in_days: Optional[int] = None
    ) -> Dict:
        """Generate new API key"""
        # Generate secure API key
        api_key_value = f"ent_{secrets.token_urlsafe(32)}"
        
        # Calculate expiration
        expires_at = None
        if expires_in_days:
            expires_at = datetime.now(timezone.utc) + timedelta(days=expires_in_days)
        
        # Create API key record
        api_key = {
            "id": str(uuid4()),
            "key": api_key_value,
            "enterprise_account_id": enterprise_id,
            "name": name,
            "scopes": scopes,
            "is_active": True,
            "request_count": 0,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "created_by": created_by,
            "expires_at": expires_at.isoformat() if expires_at else None
        }
        
        await self.api_key_repo.insert_one(api_key)
        
        logger.info(f"✅ API key generated: {name} for enterprise {enterprise_id}")
        
        return {
            "id": api_key["id"],
            "key": api_key_value,
            "name": name,
            "scopes": scopes,
            "created_at": api_key["created_at"],
            "expires_at": api_key["expires_at"]
        }
    
    async def list_api_keys(self, enterprise_id: str) -> List[Dict]:
        """List all API keys for enterprise (without full key)"""
        api_keys = await self.api_key_repo.find_by_enterprise(enterprise_id, include_key=False)
        
        # Add key preview
        for key in api_keys:
            key['key_preview'] = "ent_***" + key['id'][-8:]
        
        return api_keys
    
    async def revoke_api_key(self, key_id: str, enterprise_id: str) -> bool:
        """Revoke an API key"""
        success = await self.api_key_repo.revoke_key(key_id, enterprise_id)
        
        if success:
            logger.info(f"✅ API key revoked: {key_id}")
        
        return success
    
    async def verify_api_key(self, api_key: str) -> Optional[Dict]:
        """Verify API key and check expiration"""
        key_doc = await self.api_key_repo.find_by_key(api_key)
        
        if not key_doc:
            return None
        
        # Check expiration
        if key_doc.get('expires_at'):
            expires_at_str = key_doc['expires_at']
            expires_at = datetime.fromisoformat(expires_at_str.replace('Z', '+00:00'))
            
            if not expires_at.tzinfo:
                expires_at = expires_at.replace(tzinfo=timezone.utc)
            
            if datetime.now(timezone.utc) > expires_at:
                return None
        
        # Update usage stats
        await self.api_key_repo.update_usage(key_doc['id'])
        
        return key_doc
    
    # ============================================
    # SYNC STATUS & MONITORING
    # ============================================
    
    async def get_sync_status(self, enterprise_id: str) -> Dict:
        """Get synchronization status for enterprise"""
        # Get enterprise account
        enterprise = await self.enterprise_repo.find_one({"id": enterprise_id}, {"_id": 0})
        if not enterprise:
            raise ValueError("Enterprise account not found")
        
        # Count users and stores
        total_users = await self.user_repo.count({"enterprise_account_id": enterprise_id})
        active_users = await self.user_repo.count({
            "enterprise_account_id": enterprise_id,
            "status": "active"
        })
        total_stores = await self.store_repo.count({"enterprise_account_id": enterprise_id})
        
        # Get recent logs
        recent_logs = await self.sync_log_repo.find_recent_by_enterprise(enterprise_id, limit=10)
        
        return {
            "enterprise_account_id": enterprise_id,
            "company_name": enterprise['company_name'],
            "sync_mode": enterprise['sync_mode'],
            "total_users": total_users,
            "total_stores": total_stores,
            "active_users": active_users,
            "last_sync_at": enterprise.get('scim_last_sync'),
            "last_sync_status": enterprise.get('scim_sync_status', 'never'),
            "last_sync_details": enterprise.get('scim_error_message'),
            "scim_enabled": enterprise.get('scim_enabled', False),
            "scim_base_url": enterprise.get('scim_base_url'),
            "recent_logs": recent_logs
        }
    
    async def get_sync_logs(
        self,
        enterprise_id: str,
        limit: int = 50,
        operation: Optional[str] = None,
        status: Optional[str] = None
    ) -> List[Dict]:
        """Get sync logs with optional filters"""
        return await self.sync_log_repo.find_by_filters(
            enterprise_id, operation, status, limit
        )
    
    async def log_sync_operation(
        self,
        enterprise_account_id: str,
        sync_type: str,
        operation: str,
        status: str,
        resource_type: str,
        resource_id: Optional[str] = None,
        details: Optional[dict] = None,
        error_message: Optional[str] = None,
        initiated_by: str = "api"
    ):
        """Log a sync operation"""
        try:
            sync_log = {
                "id": str(uuid4()),
                "enterprise_account_id": enterprise_account_id,
                "sync_type": sync_type,
                "operation": operation,
                "status": status,
                "resource_type": resource_type,
                "resource_id": resource_id,
                "details": details,
                "error_message": error_message,
                "initiated_by": initiated_by,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
            
            await self.sync_log_repo.insert_one(sync_log)
            
        except Exception as e:
            logger.error(f"Error logging sync operation: {str(e)}")
    
    # ============================================
    # BULK IMPORT OPERATIONS
    # ============================================
    
    async def bulk_import_users(
        self,
        enterprise_id: str,
        users: List[Dict],
        mode: str,
        api_key_id: str,
        send_invitations: bool = False
    ) -> Dict:
        """Bulk import users"""
        results = {
            "total_processed": 0,
            "created": 0,
            "updated": 0,
            "failed": 0,
            "errors": []
        }
        
        for user_data in users:
            results["total_processed"] += 1
            
            try:
                # Validation
                if not user_data.get('email') or not user_data.get('name'):
                    results["failed"] += 1
                    results["errors"].append({
                        "email": user_data.get('email', 'unknown'),
                        "error": "Missing required fields: email or name"
                    })
                    continue
                
                # Check if user exists
                existing_user = await self.user_repo.find_by_email(user_data['email'])
                
                if existing_user:
                    # Update mode
                    if mode in ["update_only", "create_or_update"]:
                        update_fields = {
                            "name": user_data['name'],
                            "role": user_data.get('role', existing_user.get('role')),
                            "store_id": user_data.get('store_id', existing_user.get('store_id')),
                            "status": "active",
                            "enterprise_account_id": enterprise_id,
                            "sync_mode": "api_sync",
                            "updated_at": datetime.now(timezone.utc).isoformat()
                        }
                        
                        if user_data.get('manager_id'):
                            update_fields['manager_id'] = user_data['manager_id']
                        if user_data.get('external_id'):
                            update_fields['external_id'] = user_data['external_id']
                        
                        await self.user_repo.collection.update_one(
                            {"id": existing_user['id']},
                            {"$set": update_fields}
                        )
                        
                        results["updated"] += 1
                        
                        await self.log_sync_operation(
                            enterprise_id, "api", "user_updated", "success",
                            "user", existing_user['id'],
                            details={"email": user_data['email']},
                            initiated_by=f"api_key:{api_key_id}"
                        )
                    else:
                        results["failed"] += 1
                        results["errors"].append({
                            "email": user_data['email'],
                            "error": "User already exists (mode=create_only)"
                        })
                else:
                    # Create mode
                    if mode in ["create_only", "create_or_update"]:
                        temp_password = secrets.token_urlsafe(16)
                        hashed_password = bcrypt.hashpw(temp_password.encode('utf-8'), bcrypt.gensalt())
                        
                        new_user = {
                            "id": str(uuid4()),
                            "email": user_data['email'],
                            "name": user_data['name'],
                            "password": hashed_password.decode('utf-8'),
                            "role": user_data.get('role', 'seller'),
                            "status": "active",
                            "enterprise_account_id": enterprise_id,
                            "sync_mode": "api_sync",
                            "store_id": user_data.get('store_id'),
                            "manager_id": user_data.get('manager_id'),
                            "external_id": user_data.get('external_id'),
                            "created_at": datetime.now(timezone.utc).isoformat()
                        }
                        
                        await self.user_repo.insert_one(new_user)
                        results["created"] += 1
                        
                        await self.log_sync_operation(
                            enterprise_id, "api", "user_created", "success",
                            "user", new_user['id'],
                            details={"email": user_data['email']},
                            initiated_by=f"api_key:{api_key_id}"
                        )
                    else:
                        results["failed"] += 1
                        results["errors"].append({
                            "email": user_data['email'],
                            "error": "User does not exist (mode=update_only)"
                        })
                        
            except Exception as e:
                results["failed"] += 1
                results["errors"].append({
                    "email": user_data.get('email', 'unknown'),
                    "error": str(e)
                })
                logger.error(f"Error importing user {user_data.get('email')}: {str(e)}")
        
        # Log global operation
        await self.log_sync_operation(
            enterprise_id, "api", "bulk_user_import",
            "success" if results["failed"] == 0 else "partial",
            "bulk", None,
            details=results,
            initiated_by=f"api_key:{api_key_id}"
        )
        
        # Update sync status
        await self.enterprise_repo.update_sync_status(
            enterprise_id,
            "success" if results["failed"] == 0 else "partial"
        )
        
        return results
    
    async def bulk_import_stores(
        self,
        enterprise_id: str,
        stores: List[Dict],
        mode: str,
        api_key_id: str
    ) -> Dict:
        """Bulk import stores"""
        results = {
            "total_processed": 0,
            "created": 0,
            "updated": 0,
            "failed": 0,
            "errors": []
        }
        
        for store_data in stores:
            results["total_processed"] += 1
            
            try:
                # Validation
                if not store_data.get('name'):
                    results["failed"] += 1
                    results["errors"].append({
                        "name": store_data.get('name', 'unknown'),
                        "error": "Missing required field: name"
                    })
                    continue
                
                # Find by external_id or name
                query = {}
                if store_data.get('external_id'):
                    query['external_id'] = store_data['external_id']
                else:
                    query['name'] = store_data['name']
                    query['enterprise_account_id'] = enterprise_id
                
                existing_store = await self.store_repo.find_one(query, {"_id": 0})
                
                if existing_store:
                    # Update mode
                    if mode in ["update_only", "create_or_update"]:
                        update_fields = {
                            "name": store_data['name'],
                            "location": store_data.get('location', existing_store.get('location')),
                            "active": True,
                            "sync_mode": "api_sync",
                            "updated_at": datetime.now(timezone.utc).isoformat()
                        }
                        
                        if store_data.get('address'):
                            update_fields['address'] = store_data['address']
                        if store_data.get('phone'):
                            update_fields['phone'] = store_data['phone']
                        
                        await self.store_repo.collection.update_one(
                            {"id": existing_store['id']},
                            {"$set": update_fields}
                        )
                        
                        results["updated"] += 1
                        
                        await self.log_sync_operation(
                            enterprise_id, "api", "store_updated", "success",
                            "store", existing_store['id'],
                            details={"name": store_data['name']},
                            initiated_by=f"api_key:{api_key_id}"
                        )
                    else:
                        results["failed"] += 1
                        results["errors"].append({
                            "name": store_data['name'],
                            "error": "Store already exists (mode=create_only)"
                        })
                else:
                    # Create mode
                    if mode in ["create_only", "create_or_update"]:
                        new_store = {
                            "id": str(uuid4()),
                            "name": store_data['name'],
                            "location": store_data.get('location', ''),
                            "enterprise_account_id": enterprise_id,
                            "sync_mode": "api_sync",
                            "active": True,
                            "address": store_data.get('address'),
                            "phone": store_data.get('phone'),
                            "external_id": store_data.get('external_id'),
                            "created_at": datetime.now(timezone.utc).isoformat(),
                            "updated_at": datetime.now(timezone.utc).isoformat()
                        }
                        
                        await self.store_repo.insert_one(new_store)
                        results["created"] += 1
                        
                        await self.log_sync_operation(
                            enterprise_id, "api", "store_created", "success",
                            "store", new_store['id'],
                            details={"name": store_data['name']},
                            initiated_by=f"api_key:{api_key_id}"
                        )
                    else:
                        results["failed"] += 1
                        results["errors"].append({
                            "name": store_data['name'],
                            "error": "Store does not exist (mode=update_only)"
                        })
                        
            except Exception as e:
                results["failed"] += 1
                results["errors"].append({
                    "name": store_data.get('name', 'unknown'),
                    "error": str(e)
                })
                logger.error(f"Error importing store {store_data.get('name')}: {str(e)}")
        
        # Log global operation
        await self.log_sync_operation(
            enterprise_id, "api", "bulk_store_import",
            "success" if results["failed"] == 0 else "partial",
            "bulk", None,
            details=results,
            initiated_by=f"api_key:{api_key_id}"
        )
        
        # Update sync status
        await self.enterprise_repo.update_sync_status(
            enterprise_id,
            "success" if results["failed"] == 0 else "partial"
        )
        
        return results
