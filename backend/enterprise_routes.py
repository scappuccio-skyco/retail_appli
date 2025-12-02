"""
Routes API pour l'architecture Enterprise / IT Admin
Supporte le provisionnement automatique via API REST
"""

from fastapi import APIRouter, HTTPException, Depends, Header
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from motor.motor_asyncio import AsyncIOMotorClient
import os
from datetime import datetime, timezone, timedelta
import secrets
import bcrypt
import logging
from typing import Optional

from enterprise_models import (
    EnterpriseAccount, EnterpriseAccountCreate, EnterpriseAccountUpdate,
    APIKey, APIKeyCreate, APIKeyResponse,
    SyncLog, BulkUserImport, BulkStoreImport, BulkImportResponse,
    EnterpriseSyncStatus, ITAdminCreate
)
import uuid

logger = logging.getLogger(__name__)

# Ces imports seront faits dynamiquement pour éviter la dépendance circulaire
rate_limiter = None
db = None
get_current_user = None

enterprise_router = APIRouter(prefix="/api/enterprise", tags=["enterprise"])


def init_enterprise_router(database, rate_limiter_instance, auth_dependency):
    """Initialiser le router avec les dépendances de server.py"""
    global db, rate_limiter, get_current_user
    db = database
    rate_limiter = rate_limiter_instance
    get_current_user = auth_dependency


# ============================================
# AUTHENTICATION HELPERS
# ============================================

async def verify_api_key(x_api_key: str = Header(...)) -> dict:
    """
    Vérifie la validité d'une clé API et applique le rate limiting
    Returns: APIKey document
    """
    # Check rate limit first
    if not rate_limiter.is_allowed(x_api_key):
        remaining = rate_limiter.get_remaining(x_api_key)
        raise HTTPException(
            status_code=429,
            detail=f"Rate limit exceeded. Requests remaining: {remaining}. Limit: 100 requests/minute."
        )
    
    # Verify API key exists and is active
    api_key = await db.api_keys.find_one({"key": x_api_key, "is_active": True}, {"_id": 0})
    
    if not api_key:
        raise HTTPException(status_code=401, detail="Invalid or inactive API key")
    
    # Check expiration
    if api_key.get('expires_at'):
        expires_at = api_key['expires_at']
        if isinstance(expires_at, str):
            expires_at = datetime.fromisoformat(expires_at)
        # Ensure timezone aware comparison
        if not expires_at.tzinfo:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if datetime.now(timezone.utc) > expires_at:
            raise HTTPException(status_code=401, detail="API key expired")
    
    # Update last_used_at and request_count
    await db.api_keys.update_one(
        {"id": api_key['id']},
        {
            "$set": {"last_used_at": datetime.now(timezone.utc).isoformat()},
            "$inc": {"request_count": 1}
        }
    )
    
    return api_key


async def verify_it_admin(credentials: HTTPAuthorizationCredentials = Depends(HTTPBearer())) -> dict:
    """Vérifie que l'utilisateur actuel est un IT Admin"""
    from server import get_current_user as _get_current_user
    current_user = await _get_current_user(credentials)
    if current_user.get('role') != 'it_admin':
        raise HTTPException(status_code=403, detail="Access restricted to IT Admins")
    return current_user


async def verify_super_admin(credentials: HTTPAuthorizationCredentials = Depends(HTTPBearer())) -> dict:
    """Vérifie que l'utilisateur actuel est un Super Admin"""
    from server import get_current_user as _get_current_user
    current_user = await _get_current_user(credentials)
    if current_user.get('role') != 'superadmin':
        raise HTTPException(status_code=403, detail="Access restricted to Super Admins")
    return current_user


# ============================================
# ENTERPRISE ACCOUNT MANAGEMENT
# ============================================

@enterprise_router.post("/register", response_model=dict)
async def register_enterprise_account(data: EnterpriseAccountCreate):
    """
    Inscription self-service d'un compte entreprise.
    Crée automatiquement le compte entreprise et le premier IT Admin.
    """
    try:
        # Vérifier si l'email existe déjà
        existing_user = await db.users.find_one({"email": data.it_admin_email})
        if existing_user:
            raise HTTPException(status_code=400, detail="Email already registered")
        
        # Vérifier si le nom d'entreprise existe déjà
        existing_company = await db.enterprise_accounts.find_one({"company_name": data.company_name})
        if existing_company:
            raise HTTPException(status_code=400, detail="Company name already exists")
        
        # Créer le compte entreprise
        enterprise_account = EnterpriseAccount(
            company_name=data.company_name,
            company_email=data.company_email,
            sync_mode=data.sync_mode
        )
        await db.enterprise_accounts.insert_one(enterprise_account.model_dump())
        
        # Créer le premier IT Admin
        hashed_password = bcrypt.hashpw(data.it_admin_password.encode('utf-8'), bcrypt.gensalt())
        
        it_admin = {
            "id": str(uuid.uuid4()),
            "name": data.it_admin_name,
            "email": data.it_admin_email,
            "password": hashed_password.decode('utf-8'),
            "role": "it_admin",
            "status": "active",
            "enterprise_account_id": enterprise_account.id,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.users.insert_one(it_admin)
        
        logger.info(f"✅ Enterprise account created: {data.company_name} with IT Admin: {data.it_admin_email}")
        
        return {
            "success": True,
            "message": "Enterprise account created successfully",
            "enterprise_account_id": enterprise_account.id,
            "it_admin_email": data.it_admin_email
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating enterprise account: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to create enterprise account: {str(e)}")


@enterprise_router.get("/config")
async def get_enterprise_config(current_user: dict = Depends(verify_it_admin)):
    """Récupérer la configuration du compte entreprise"""
    try:
        enterprise_account = await db.enterprise_accounts.find_one(
            {"id": current_user.get('enterprise_account_id')},
            {"_id": 0}
        )
        
        if not enterprise_account:
            raise HTTPException(status_code=404, detail="Enterprise account not found")
        
        # Masquer les tokens sensibles
        if enterprise_account.get('scim_bearer_token'):
            enterprise_account['scim_bearer_token'] = "***" + enterprise_account['scim_bearer_token'][-4:]
        
        return enterprise_account
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching enterprise config: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@enterprise_router.put("/config")
async def update_enterprise_config(
    update_data: EnterpriseAccountUpdate,
    current_user: dict = Depends(verify_it_admin)
):
    """Mettre à jour la configuration du compte entreprise"""
    try:
        update_fields = {k: v for k, v in update_data.model_dump().items() if v is not None}
        update_fields['updated_at'] = datetime.now(timezone.utc).isoformat()
        
        result = await db.enterprise_accounts.update_one(
            {"id": current_user.get('enterprise_account_id')},
            {"$set": update_fields}
        )
        
        if result.modified_count == 0:
            raise HTTPException(status_code=404, detail="Enterprise account not found")
        
        return {"success": True, "message": "Enterprise configuration updated successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating enterprise config: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================
# API KEY MANAGEMENT
# ============================================

@enterprise_router.post("/api-keys/generate", response_model=APIKeyResponse)
async def generate_api_key(
    key_data: APIKeyCreate,
    current_user: dict = Depends(verify_it_admin)
):
    """Générer une nouvelle clé API pour le provisionnement"""
    try:
        # Générer une clé API sécurisée
        api_key_value = f"ent_{secrets.token_urlsafe(32)}"
        
        # Calculer l'expiration si spécifiée
        expires_at = None
        if key_data.expires_in_days:
            expires_at = datetime.now(timezone.utc) + timedelta(days=key_data.expires_in_days)
        
        # Créer l'enregistrement de clé API
        api_key = APIKey(
            key=api_key_value,
            enterprise_account_id=current_user.get('enterprise_account_id'),
            name=key_data.name,
            scopes=key_data.scopes,
            created_by=current_user['id'],
            expires_at=expires_at
        )
        
        await db.api_keys.insert_one(api_key.model_dump())
        
        logger.info(f"✅ API key generated: {key_data.name} by {current_user['email']}")
        
        return APIKeyResponse(
            id=api_key.id,
            key=api_key_value,
            name=api_key.name,
            scopes=api_key.scopes,
            created_at=api_key.created_at,
            expires_at=expires_at
        )
        
    except Exception as e:
        logger.error(f"Error generating API key: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@enterprise_router.get("/api-keys")
async def list_api_keys(current_user: dict = Depends(verify_it_admin)):
    """Lister toutes les clés API du compte entreprise"""
    try:
        api_keys = await db.api_keys.find(
            {"enterprise_account_id": current_user.get('enterprise_account_id')},
            {"_id": 0, "key": 0}  # Ne pas retourner la clé complète
        ).to_list(100)
        
        # Ajouter un masque pour la clé
        for key in api_keys:
            key['key_preview'] = "ent_***" + key['id'][-8:]
        
        return {"api_keys": api_keys}
        
    except Exception as e:
        logger.error(f"Error listing API keys: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@enterprise_router.delete("/api-keys/{key_id}")
async def revoke_api_key(key_id: str, current_user: dict = Depends(verify_it_admin)):
    """Révoquer (désactiver) une clé API"""
    try:
        result = await db.api_keys.update_one(
            {
                "id": key_id,
                "enterprise_account_id": current_user.get('enterprise_account_id')
            },
            {"$set": {"is_active": False, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
        
        if result.modified_count == 0:
            raise HTTPException(status_code=404, detail="API key not found")
        
        logger.info(f"✅ API key revoked: {key_id} by {current_user['email']}")
        
        return {"success": True, "message": "API key revoked successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error revoking API key: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================
# SYNC STATUS & MONITORING
# ============================================

@enterprise_router.get("/sync-status", response_model=EnterpriseSyncStatus)
async def get_sync_status(current_user: dict = Depends(verify_it_admin)):
    """Récupérer le statut de synchronisation du compte entreprise"""
    try:
        enterprise_id = current_user.get('enterprise_account_id')
        
        # Récupérer le compte entreprise
        enterprise = await db.enterprise_accounts.find_one({"id": enterprise_id}, {"_id": 0})
        if not enterprise:
            raise HTTPException(status_code=404, detail="Enterprise account not found")
        
        # Compter les utilisateurs et magasins
        total_users = await db.users.count_documents({"enterprise_account_id": enterprise_id})
        active_users = await db.users.count_documents({
            "enterprise_account_id": enterprise_id,
            "status": "active"
        })
        total_stores = await db.stores.count_documents({"enterprise_account_id": enterprise_id})
        
        # Récupérer les logs récents
        recent_logs = await db.sync_logs.find(
            {"enterprise_account_id": enterprise_id},
            {"_id": 0}
        ).sort("timestamp", -1).limit(10).to_list(10)
        
        return EnterpriseSyncStatus(
            enterprise_account_id=enterprise_id,
            company_name=enterprise['company_name'],
            sync_mode=enterprise['sync_mode'],
            total_users=total_users,
            total_stores=total_stores,
            active_users=active_users,
            last_sync_at=enterprise.get('scim_last_sync'),
            last_sync_status=enterprise.get('scim_sync_status', 'never'),
            last_sync_details=enterprise.get('scim_error_message'),
            scim_enabled=enterprise.get('scim_enabled', False),
            scim_base_url=enterprise.get('scim_base_url'),
            recent_logs=recent_logs
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching sync status: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@enterprise_router.get("/sync-logs")
async def get_sync_logs(
    limit: int = 50,
    operation: Optional[str] = None,
    status: Optional[str] = None,
    current_user: dict = Depends(verify_it_admin)
):
    """Récupérer les logs de synchronisation"""
    try:
        query = {"enterprise_account_id": current_user.get('enterprise_account_id')}
        
        if operation:
            query['operation'] = operation
        if status:
            query['status'] = status
        
        logs = await db.sync_logs.find(query, {"_id": 0})\
            .sort("timestamp", -1)\
            .limit(limit)\
            .to_list(limit)
        
        return {"logs": logs, "total": len(logs)}
        
    except Exception as e:
        logger.error(f"Error fetching sync logs: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================
# HELPER FUNCTIONS
# ============================================

async def log_sync_operation(
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
    """Helper pour logger une opération de synchronisation"""
    try:
        sync_log = SyncLog(
            enterprise_account_id=enterprise_account_id,
            sync_type=sync_type,
            operation=operation,
            status=status,
            resource_type=resource_type,
            resource_id=resource_id,
            details=details,
            error_message=error_message,
            initiated_by=initiated_by
        )
        
        await db.sync_logs.insert_one(sync_log.model_dump())
        
    except Exception as e:
        logger.error(f"Error logging sync operation: {str(e)}")
        # Ne pas lever d'exception pour ne pas bloquer l'opération principale


# ============================================
# BULK IMPORT ENDPOINTS (API REST)
# ============================================

@enterprise_router.post("/users/bulk-import", response_model=BulkImportResponse)
async def bulk_import_users(
    import_data: BulkUserImport,
    api_key: dict = Depends(verify_api_key)
):
    """
    Import en masse d'utilisateurs via API REST.
    Format attendu pour chaque utilisateur :
    {
        "email": "user@example.com",
        "name": "John Doe",
        "role": "manager" | "seller",
        "store_id": "store-uuid",
        "manager_id": "manager-uuid" (requis si role=seller),
        "external_id": "SAP-12345" (optionnel, ID dans le système source)
    }
    """
    try:
        enterprise_id = api_key['enterprise_account_id']
        results = {
            "total_processed": 0,
            "created": 0,
            "updated": 0,
            "failed": 0,
            "errors": []
        }
        
        for user_data in import_data.users:
            results["total_processed"] += 1
            
            try:
                # Validation des champs requis
                if not user_data.get('email') or not user_data.get('name'):
                    results["failed"] += 1
                    results["errors"].append({
                        "email": user_data.get('email', 'unknown'),
                        "error": "Missing required fields: email or name"
                    })
                    continue
                
                # Vérifier si l'utilisateur existe déjà
                existing_user = await db.users.find_one({"email": user_data['email']}, {"_id": 0})
                
                if existing_user:
                    # Mode update
                    if import_data.mode in ["update_only", "create_or_update"]:
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
                        
                        await db.users.update_one(
                            {"id": existing_user['id']},
                            {"$set": update_fields}
                        )
                        
                        results["updated"] += 1
                        
                        # Log l'opération
                        await log_sync_operation(
                            enterprise_id, "api", "user_updated", "success",
                            "user", existing_user['id'],
                            details={"email": user_data['email']},
                            initiated_by=f"api_key:{api_key['id']}"
                        )
                    else:
                        results["failed"] += 1
                        results["errors"].append({
                            "email": user_data['email'],
                            "error": "User already exists (mode=create_only)"
                        })
                else:
                    # Mode create
                    if import_data.mode in ["create_only", "create_or_update"]:
                        # Générer un mot de passe temporaire
                        temp_password = secrets.token_urlsafe(16)
                        hashed_password = bcrypt.hashpw(temp_password.encode('utf-8'), bcrypt.gensalt())
                        
                        new_user = {
                            "id": str(uuid.uuid4()),
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
                        
                        await db.users.insert_one(new_user)
                        results["created"] += 1
                        
                        # Log l'opération
                        await log_sync_operation(
                            enterprise_id, "api", "user_created", "success",
                            "user", new_user['id'],
                            details={"email": user_data['email']},
                            initiated_by=f"api_key:{api_key['id']}"
                        )
                        
                        # TODO: Envoyer invitation si send_invitations=True
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
        
        # Log l'opération globale
        await log_sync_operation(
            enterprise_id, "api", "bulk_user_import",
            "success" if results["failed"] == 0 else "partial",
            "bulk", None,
            details=results,
            initiated_by=f"api_key:{api_key['id']}"
        )
        
        # Mettre à jour le statut de sync dans enterprise_accounts
        await db.enterprise_accounts.update_one(
            {"id": enterprise_id},
            {
                "$set": {
                    "scim_last_sync": datetime.now(timezone.utc).isoformat(),
                    "scim_sync_status": "success" if results["failed"] == 0 else "partial"
                }
            }
        )
        
        return BulkImportResponse(
            success=results["failed"] == 0,
            total_processed=results["total_processed"],
            created=results["created"],
            updated=results["updated"],
            failed=results["failed"],
            errors=results["errors"]
        )
        
    except Exception as e:
        logger.error(f"Error in bulk user import: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@enterprise_router.post("/stores/bulk-import", response_model=BulkImportResponse)
async def bulk_import_stores(
    import_data: BulkStoreImport,
    api_key: dict = Depends(verify_api_key)
):
    """
    Import en masse de magasins via API REST.
    Format attendu pour chaque magasin :
    {
        "name": "Store Name",
        "location": "Paris 75001",
        "external_id": "SAP-STORE-123" (optionnel),
        "address": "123 rue Example" (optionnel),
        "phone": "+33123456789" (optionnel)
    }
    """
    try:
        enterprise_id = api_key['enterprise_account_id']
        results = {
            "total_processed": 0,
            "created": 0,
            "updated": 0,
            "failed": 0,
            "errors": []
        }
        
        for store_data in import_data.stores:
            results["total_processed"] += 1
            
            try:
                # Validation des champs requis
                if not store_data.get('name'):
                    results["failed"] += 1
                    results["errors"].append({
                        "name": store_data.get('name', 'unknown'),
                        "error": "Missing required field: name"
                    })
                    continue
                
                # Chercher par external_id si fourni, sinon par nom
                query = {}
                if store_data.get('external_id'):
                    query['external_id'] = store_data['external_id']
                else:
                    query['name'] = store_data['name']
                    query['enterprise_account_id'] = enterprise_id
                
                existing_store = await db.stores.find_one(query, {"_id": 0})
                
                if existing_store:
                    # Mode update
                    if import_data.mode in ["update_only", "create_or_update"]:
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
                        
                        await db.stores.update_one(
                            {"id": existing_store['id']},
                            {"$set": update_fields}
                        )
                        
                        results["updated"] += 1
                        
                        await log_sync_operation(
                            enterprise_id, "api", "store_updated", "success",
                            "store", existing_store['id'],
                            details={"name": store_data['name']},
                            initiated_by=f"api_key:{api_key['id']}"
                        )
                    else:
                        results["failed"] += 1
                        results["errors"].append({
                            "name": store_data['name'],
                            "error": "Store already exists (mode=create_only)"
                        })
                else:
                    # Mode create
                    if import_data.mode in ["create_only", "create_or_update"]:
                        new_store = {
                            "id": str(uuid.uuid4()),
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
                        
                        await db.stores.insert_one(new_store)
                        results["created"] += 1
                        
                        await log_sync_operation(
                            enterprise_id, "api", "store_created", "success",
                            "store", new_store['id'],
                            details={"name": store_data['name']},
                            initiated_by=f"api_key:{api_key['id']}"
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
        
        await log_sync_operation(
            enterprise_id, "api", "bulk_store_import",
            "success" if results["failed"] == 0 else "partial",
            "bulk", None,
            details=results,
            initiated_by=f"api_key:{api_key['id']}"
        )
        
        return BulkImportResponse(
            success=results["failed"] == 0,
            total_processed=results["total_processed"],
            created=results["created"],
            updated=results["updated"],
            failed=results["failed"],
            errors=results["errors"]
        )
        
    except Exception as e:
        logger.error(f"Error in bulk store import: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

