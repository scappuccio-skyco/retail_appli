--- backend/services/integration_service.py
+++ backend/services/integration_service.py
@@ -1,8 +1,10 @@
 """Integration Service - Business logic for API keys and integrations"""
-from typing import Dict, List
+from typing import Dict, List, Optional
 from datetime import datetime, timezone
 from uuid import uuid4
 import secrets
+import logging
 
 from repositories.integration_repository import IntegrationRepository
 from core.security import get_password_hash, verify_password
@@ -11,7 +13,8 @@ from core.security import get_password_hash, verify_password
 class IntegrationService:
     """Service for integration-related business logic"""
     
-    def __init__(self, integration_repo: IntegrationRepository):
+    def __init__(self, integration_repo: IntegrationRepository, db=None):
         self.integration_repo = integration_repo
+        self.db = db or integration_repo.db  # Access to database for user lookups
     
     async def create_api_key(
         self,
@@ -19,7 +22,8 @@ class IntegrationService:
         user_id: str,
         name: str,
         permissions: List[str],
-        expires_days: int = None
+        expires_days: int = None,
+        store_ids: Optional[List[str]] = None
     ) -> Dict:
         """
         Create a new API key
@@ -29,6 +33,7 @@ class IntegrationService:
             name: Friendly name for the key
             permissions: List of permissions (e.g., ["write:kpi", "read:kpi"])
             expires_days: Optional expiration in days
+            store_ids: Optional list of store IDs to restrict access
         
         Returns:
             Dict with api_key (ONLY SHOWN ONCE), key_id, and message
@@ -40,6 +45,18 @@ class IntegrationService:
         if expires_days:
             expires_at = datetime.now(timezone.utc).timestamp() + (expires_days * 86400)
         
+        # Calculate tenant_id from user_id (source of truth for multi-tenancy)
+        tenant_id = await self._calculate_tenant_id(user_id)
+        if not tenant_id:
+            raise ValueError("Cannot determine tenant_id for API key owner")
+        
         # Build key document
         key_doc = {
             "id": str(uuid4()),
@@ -47,6 +64,8 @@ class IntegrationService:
             "key_prefix": api_key[:12],
             "name": name,
             "user_id": user_id,
+            "tenant_id": tenant_id,  # Explicit tenant_id for multi-tenancy
             "permissions": permissions,
+            "store_ids": store_ids,  # None = all stores, [] = no stores, [id1, id2] = specific stores
             "expires_at": expires_at,
             "active": True,
             "created_at": datetime.now(timezone.utc)
@@ -60,6 +79,7 @@ class IntegrationService:
             "message": "Sauvegardez cette clé, elle ne sera plus affichée"
         }
     
+    async def _calculate_tenant_id(self, user_id: str) -> Optional[str]:
+        """
+        Calculate tenant_id from user_id.
+        Source of truth: if user is gérant, tenant_id = user_id, else tenant_id = user.gerant_id
+        """
+        from repositories.user_repository import UserRepository
+        user_repo = UserRepository(self.db)
+        
+        user = await user_repo.find_by_id(user_id)
+        if not user:
+            return None
+        
+        # Normalize role
+        role_norm = (user.get("role") or "").strip().lower()
+        
+        # Calculate tenant_id
+        if role_norm in ["gerant", "gérant"]:
+            return str(user.get("id") or user.get("_id"))
+        else:
+            gerant_id = user.get("gerant_id")
+            return str(gerant_id) if gerant_id else None
+    
     async def list_api_keys(self, user_id: str) -> List[Dict]:
         """List all API keys for a user (without hash)"""
         return await self.integration_repo.find_api_keys_by_user(user_id)
@@ -75,6 +95,7 @@ class IntegrationService:
         Raises:
             ValueError: If key is invalid, inactive, or expired
         """
+        logger = logging.getLogger(__name__)
         # Find key by prefix
         key_prefix = api_key[:12]
         possible_keys = await self.integration_repo.find_api_keys_by_prefix(key_prefix)
@@ -82,6 +103,19 @@ class IntegrationService:
         for key_doc in possible_keys:
             if verify_password(api_key, key_doc['key_hash']):
                 # Check expiration
                 if key_doc.get('expires_at'):
                     if datetime.now(timezone.utc).timestamp() > key_doc['expires_at']:
                         raise ValueError("API Key expired")
                 
+                # MIGRATION: If key doesn't have tenant_id, calculate and update it
+                if 'tenant_id' not in key_doc or not key_doc.get('tenant_id'):
+                    tenant_id = await self._calculate_tenant_id(key_doc.get('user_id'))
+                    if tenant_id:
+                        # Update the key with tenant_id
+                        await self.integration_repo.api_keys.update_one(
+                            {"id": key_doc['id']},
+                            {"$set": {"tenant_id": tenant_id}}
+                        )
+                        key_doc['tenant_id'] = tenant_id
+                    else:
+                        # Cannot determine tenant, deactivate key
+                        logger.warning(f"API key {key_doc['id']} has no tenant_id and cannot be calculated. Deactivating.")
+                        await self.integration_repo.api_keys.update_one(
+                            {"id": key_doc['id']},
+                            {"$set": {"active": False}}
+                        )
+                        raise ValueError("API Key configuration invalid: missing tenant_id")
+                
                 return key_doc
         
         raise ValueError("Invalid or inactive API Key")
     
+    async def get_tenant_id_from_api_key(self, api_key_data: Dict) -> Optional[str]:
+        """
+        Extracts the tenant_id (gerant_id) from the API key data.
+        This is the explicit source of truth for multi-tenancy.
+        """
+        return api_key_data.get('tenant_id')
+    
     async def deactivate_api_key(self, key_id: str, user_id: str) -> bool:
         """Deactivate an API key"""
         return await self.integration_repo.deactivate_api_key(key_id, user_id)
+
+
+# NOTE: Also update backend/api/dependencies.py:
+# In get_integration_service(), change:
+#     return IntegrationService(integration_repo)
+# to:
+#     return IntegrationService(integration_repo, db)
