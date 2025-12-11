"""Integration Routes - API Keys and External Systems - Clean Architecture"""
from fastapi import APIRouter, Depends, HTTPException, Header
from typing import Dict
from datetime import datetime, timezone
from uuid import uuid4

from models.integrations import APIKeyCreate, KPISyncRequest
from services.kpi_service import KPIService
from services.integration_service import IntegrationService
from api.dependencies import get_kpi_service, get_integration_service

router = APIRouter(prefix="/integrations", tags=["Integrations"])


# ===== API KEY MANAGEMENT =====

@router.post("/api-keys")
async def create_api_key(
    key_data: APIKeyCreate,
    current_user: Dict = Depends(get_current_gerant),
    integration_service: IntegrationService = Depends(get_integration_service)
):
    """Create new API key for integrations"""
    try:
        return await integration_service.create_api_key(
            user_id=current_user['id'],
            name=key_data.name,
            permissions=key_data.permissions,
            expires_days=key_data.expires_days
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/api-keys")
async def list_api_keys(
    current_user: Dict = Depends(get_current_gerant),
    integration_service: IntegrationService = Depends(get_integration_service)
):
    """List all API keys for current user"""
    try:
        return await integration_service.list_api_keys(current_user['id'])
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ===== API KEY VERIFICATION =====

async def verify_api_key(
    x_api_key: str = Header(...),
    integration_service: IntegrationService = Depends(get_integration_service)
) -> Dict:
    """Verify API key from header"""
    try:
        return await integration_service.verify_api_key(x_api_key)
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))


# ===== KPI SYNC ENDPOINT =====

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


# Legacy endpoint alias for backward compatibility with N8N
@router.post("/v1/kpi/sync")
async def sync_kpi_data_legacy(
    data: KPISyncRequest,
    api_key: Dict = Depends(verify_api_key),
    kpi_service: KPIService = Depends(get_kpi_service)
):
    """
    Legacy endpoint for N8N compatibility
    Redirects to main sync endpoint
    
    Full path: /api/integrations/v1/kpi/sync
    """
    return await sync_kpi_data(data, api_key, kpi_service)


# Import at the top was missing
from core.security import get_current_gerant
