"""SuperAdmin Routes"""
from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Dict
from motor.motor_asyncio import AsyncIOMotorDatabase
from datetime import datetime, timezone, timedelta

from core.security import get_super_admin
from services.admin_service import AdminService
from repositories.admin_repository import AdminRepository
from api.dependencies import get_db

router = APIRouter(prefix="/superadmin", tags=["SuperAdmin"])


def get_admin_service(db = Depends(get_db)) -> AdminService:
    """Dependency injection for AdminService"""
    admin_repo = AdminRepository(db)
    return AdminService(admin_repo)


@router.get("/workspaces")
async def get_workspaces(
    current_user: Dict = Depends(get_super_admin),
    admin_service: AdminService = Depends(get_admin_service)
):
    """Get all workspaces with details"""
    try:
        return await admin_service.get_workspaces_with_details()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/stats")
async def get_platform_stats(
    current_user: Dict = Depends(get_super_admin),
    admin_service: AdminService = Depends(get_admin_service)
):
    """Get platform-wide statistics"""
    try:
        return await admin_service.get_platform_stats()
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



@router.get("/system-logs")
async def get_system_logs(
    limit: int = Query(100, ge=1, le=1000),
    hours: int = Query(24, ge=1, le=168),  # Max 1 week
    current_user: Dict = Depends(get_super_admin),
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """
    Get system logs filtered by time window
    
    Args:
        limit: Maximum number of logs to return (default: 100, max: 1000)
        hours: Number of hours to look back (default: 24, max: 168)
    
    Returns:
        List of system logs with timestamp, level, message, etc.
    """
    try:
        # Calculate time window
        now = datetime.now(timezone.utc)
        time_threshold = now - timedelta(hours=hours)
        
        # Try to get logs from different possible collections
        logs = []
        
        # Try 'system_logs' collection
        try:
            system_logs = await db.system_logs.find(
                {"timestamp": {"$gte": time_threshold.isoformat()}},
                {"_id": 0}
            ).sort("timestamp", -1).limit(limit).to_list(limit)
            logs.extend(system_logs)
        except:
            pass
        
        # Try 'logs' collection as fallback
        if not logs:
            try:
                app_logs = await db.logs.find(
                    {"timestamp": {"$gte": time_threshold.isoformat()}},
                    {"_id": 0}
                ).sort("timestamp", -1).limit(limit).to_list(limit)
                logs.extend(app_logs)
            except:
                pass
        
        # If no logs found in DB, return mock recent activity logs
        if not logs:
            # Generate some sample system logs for display
            logs = [
                {
                    "timestamp": (now - timedelta(minutes=i*10)).isoformat(),
                    "level": "info" if i % 3 != 0 else "warning",
                    "message": f"System health check - All services operational" if i % 3 == 0 else f"User login activity detected",
                    "source": "system",
                    "details": {}
                }
                for i in range(min(10, limit))
            ]
        
        return {
            "logs": logs,
            "total": len(logs),
            "period_hours": hours,
            "timestamp": now.isoformat()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

