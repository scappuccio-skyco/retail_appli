"""SuperAdmin Routes - Clean Architecture"""
from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Dict

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
    hours: int = Query(24, ge=1, le=168),
    current_user: Dict = Depends(get_super_admin),
    admin_service: AdminService = Depends(get_admin_service)
):
    """Get system logs filtered by time window"""
    try:
        return await admin_service.get_system_logs(hours=hours, limit=limit)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

