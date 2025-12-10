"""SuperAdmin Routes"""
from fastapi import APIRouter, Depends, HTTPException
from typing import Dict, List
from core.security import get_super_admin
from core.database import get_db
from motor.motor_asyncio import AsyncIOMotorDatabase

router = APIRouter(prefix="/admin", tags=["Super Admin"])


@router.get("/workspaces")
async def get_all_workspaces(
    current_user: Dict = Depends(get_super_admin),
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """Get all workspaces with hierarchy (stores, managers, sellers)"""
    try:
        workspaces = await db.workspaces.find({}, {"_id": 0}).to_list(1000)
        
        for workspace in workspaces:
            # Get gérant info
            if workspace.get('gerant_id'):
                gerant = await db.users.find_one(
                    {"id": workspace['gerant_id']},
                    {"_id": 0, "password": 0}
                )
                workspace['gerant'] = gerant
            
            # Get stores for this workspace
            stores = await db.stores.find(
                {"gerant_id": workspace.get('gerant_id')},
                {"_id": 0}
            ).to_list(100)
            
            workspace['stores'] = stores
            workspace['stores_count'] = len(stores)
            
            # Get users count
            managers_count = await db.users.count_documents({
                "gerant_id": workspace.get('gerant_id'),
                "role": "manager"
            })
            sellers_count = await db.users.count_documents({
                "gerant_id": workspace.get('gerant_id'),
                "role": "seller"
            })
            
            workspace['managers_count'] = managers_count
            workspace['sellers_count'] = sellers_count
        
        return workspaces
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/stats")
async def get_platform_stats(
    current_user: Dict = Depends(get_super_admin),
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """Get platform-wide statistics"""
    try:
        stats = {
            "total_workspaces": await db.workspaces.count_documents({}),
            "total_stores": await db.stores.count_documents({}),
            "total_users": await db.users.count_documents({}),
            "total_gerants": await db.users.count_documents({"role": "gerant"}),
            "total_managers": await db.users.count_documents({"role": "manager"}),
            "total_sellers": await db.users.count_documents({"role": "seller"}),
            "total_kpi_entries": await db.kpi_entries.count_documents({}),
        }
        return stats
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
