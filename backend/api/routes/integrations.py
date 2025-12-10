"""Integration Routes - API Keys and External Systems"""
from fastapi import APIRouter, Depends, HTTPException, Header
from typing import Dict, Optional
from datetime import datetime, timezone
from uuid import uuid4
import secrets

from models.integrations import APIKeyCreate, KPISyncRequest
from services.kpi_service import KPIService
from api.dependencies import get_kpi_service
from core.security import get_current_gerant, get_password_hash
from core.database import get_db
from motor.motor_asyncio import AsyncIOMotorDatabase

router = APIRouter(prefix="/integrations", tags=["Integrations"])


# ===== API KEY MANAGEMENT =====

@router.post("/api-keys")
async def create_api_key(
    key_data: APIKeyCreate,
    current_user: Dict = Depends(get_current_gerant),
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """Create new API key for integrations"""
    try:
        # Generate API key
        api_key = f"sk_live_{secrets.token_urlsafe(32)}"
        
        # Hash the key for storage
        hashed_key = get_password_hash(api_key)
        
        # Calculate expiration
        expires_at = None
        if key_data.expires_in_days:
            expires_at = datetime.now(timezone.utc).timestamp() + (key_data.expires_in_days * 86400)
        
        # Store key
        key_doc = {
            "id": str(uuid4()),
            "key_hash": hashed_key,
            "key_prefix": api_key[:12],
            "name": key_data.name,
            "user_id": current_user['id'],
            "permissions": key_data.permissions,
            "expires_at": expires_at,
            "active": True,
            "created_at": datetime.now(timezone.utc)
        }
        
        await db.api_keys.insert_one(key_doc)
        
        return {
            "api_key": api_key,  # Only returned once!
            "key_id": key_doc['id'],
            "message": "Sauvegardez cette clé, elle ne sera plus affichée"
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/api-keys")
async def list_api_keys(
    current_user: Dict = Depends(get_current_gerant),
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """List all API keys for current user"""
    try:
        keys = await db.api_keys.find(
            {"user_id": current_user['id']},
            {"_id": 0, "key_hash": 0}
        ).to_list(100)
        
        return keys
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ===== KPI SYNC ENDPOINT =====

async def verify_api_key(x_api_key: str = Header(...), db: AsyncIOMotorDatabase = Depends(get_db)):
    """Verify API key from header"""
    from core.security import verify_password
    
    # Find key by prefix
    key_prefix = x_api_key[:12]
    possible_keys = await db.api_keys.find(
        {"key_prefix": key_prefix, "active": True},
        {"_id": 0}
    ).to_list(10)
    
    for key_doc in possible_keys:
        if verify_password(x_api_key, key_doc['key_hash']):
            # Check expiration
            if key_doc.get('expires_at'):
                if datetime.now(timezone.utc).timestamp() > key_doc['expires_at']:
                    raise HTTPException(status_code=401, detail="API Key expired")
            
            return key_doc
    
    raise HTTPException(status_code=401, detail="Invalid or inactive API Key")


@router.post("/kpi/sync")
async def sync_kpi_data(
    data: KPISyncRequest,
    api_key: Dict = Depends(verify_api_key),
    kpi_service: KPIService = Depends(get_kpi_service)
):
    """
    Sync KPI data from external systems (POS, ERP, etc.)
    
    IMPORTANT: Full path is /api/integrations/kpi/sync
    Legacy path /api/v1/integrations/kpi/sync supported via alias below
    """
    try:
        # Limit to 100 items per request
        if len(data.kpi_entries) > 100:
            raise HTTPException(
                status_code=400,
                detail=f"Maximum 100 KPI entries per request. Received {len(data.kpi_entries)}."
            )
        
        # Verify permissions
        if "write:kpi" not in api_key.get('permissions', []):
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        
        # Process entries via bulk operations
        from pymongo import InsertOne, UpdateOne
        seller_operations = []
        entries_created = 0
        entries_updated = 0
        
        for entry in data.kpi_entries:
            if entry.seller_id:
                # Check if exists
                existing = await kpi_service.kpi_repo.find_by_seller_and_date(
                    entry.seller_id,
                    data.date
                )
                
                kpi_data = {
                    "ca_journalier": entry.ca_journalier,
                    "nb_ventes": entry.nb_ventes,
                    "nb_articles": entry.nb_articles,
                    "nb_prospects": entry.prospects or 0,
                    "source": "api",
                    "locked": True,
                    "updated_at": datetime.now(timezone.utc)
                }
                
                if existing:
                    seller_operations.append(UpdateOne(
                        {"seller_id": entry.seller_id, "date": data.date},
                        {"$set": kpi_data}
                    ))
                    entries_updated += 1
                else:
                    kpi_data.update({
                        "id": str(uuid4()),
                        "seller_id": entry.seller_id,
                        "date": data.date,
                        "created_at": datetime.now(timezone.utc)
                    })
                    seller_operations.append(InsertOne(kpi_data))
                    entries_created += 1
        
        # Execute bulk operations
        if seller_operations:
            await kpi_service.kpi_repo.bulk_write(seller_operations)
        
        return {
            "status": "success",
            "entries_created": entries_created,
            "entries_updated": entries_updated,
            "total": entries_created + entries_updated
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail="Database write operation failed")
