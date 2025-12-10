"""SuperAdmin Routes"""
from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Dict, List, Optional
from datetime import datetime, timezone, timedelta
from core.security import get_super_admin
from core.database import get_db
from motor.motor_asyncio import AsyncIOMotorDatabase

router = APIRouter(prefix="/superadmin", tags=["Super Admin"])


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
        # Count documents
        total_workspaces = await db.workspaces.count_documents({})
        total_stores = await db.stores.count_documents({})
        total_users = await db.users.count_documents({})
        total_gerants = await db.users.count_documents({"role": "gerant"})
        total_managers = await db.users.count_documents({"role": "manager"})
        total_sellers = await db.users.count_documents({"role": "seller"})
        active_users = await db.users.count_documents({"status": "active"})
        total_kpi_entries = await db.kpi_entries.count_documents({})
        
        # Calculate MRR (Monthly Recurring Revenue)
        # Simplified calculation based on active subscriptions
        active_subscriptions = await db.subscriptions.count_documents({
            "status": {"$in": ["active", "trialing"]}
        })
        mrr = active_subscriptions * 29  # Average price per subscription
        
        stats = {
            "total_workspaces": total_workspaces,
            "total_stores": total_stores,
            "total_users": total_users,
            "active_users": active_users,
            "total_gerants": total_gerants,
            "total_managers": total_managers,
            "total_sellers": total_sellers,
            "total_kpi_entries": total_kpi_entries,
            "active_subscriptions": active_subscriptions,
            "mrr": mrr,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        return stats
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/logs")
async def get_system_logs(
    limit: int = Query(50, ge=1, le=1000),
    days: int = Query(7, ge=1, le=90),
    current_user: Dict = Depends(get_super_admin),
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """
    Get system logs for monitoring
    
    Args:
        limit: Maximum number of logs to return (1-1000)
        days: Number of days to look back (1-90)
    """
    try:
        # Calculate date threshold
        date_threshold = datetime.now(timezone.utc) - timedelta(days=days)
        
        # Query sync logs (from Enterprise sync operations)
        sync_logs = await db.sync_logs.find(
            {"timestamp": {"$gte": date_threshold.isoformat()}},
            {"_id": 0}
        ).sort("timestamp", -1).limit(limit).to_list(limit)
        
        # You can also add other log sources here
        # For now, return sync logs as system logs
        
        return {
            "logs": sync_logs,
            "total": len(sync_logs),
            "days": days,
            "limit": limit
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/health")
async def health_check(
    current_user: Dict = Depends(get_super_admin)
):
    """
    Health check endpoint for SuperAdmin dashboard
    
    Returns system status
    """
    return {
        "status": "ok",
        "service": "retail-performer-api",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "version": "2.0.0"
    }
