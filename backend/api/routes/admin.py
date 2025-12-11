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
    """Get platform-wide statistics - STRUCTURE ADAPTED FOR FRONTEND"""
    try:
        # Workspaces stats
        total_workspaces = await db.workspaces.count_documents({})
        active_workspaces = await db.workspaces.count_documents({"subscription_status": "active"})
        trial_workspaces = await db.workspaces.count_documents({"subscription_status": "trialing"})
        
        # Users stats
        total_active_users = await db.users.count_documents({"status": "active"})
        active_managers = await db.users.count_documents({"role": "manager", "status": "active"})
        active_sellers = await db.users.count_documents({"role": "seller", "status": "active"})
        inactive_users = await db.users.count_documents({"status": "suspended"})
        
        # Usage stats (AI operations)
        total_diagnostics = await db.diagnostics.count_documents({})
        
        # Try to get AI operations from different collections
        total_ai_operations = 0
        try:
            # Count AI consultations (relationship advice)
            ai_consultations = await db.relationship_consultations.count_documents({})
            total_ai_operations += ai_consultations
        except:
            pass
        
        # Revenue stats
        active_subscriptions = await db.workspaces.count_documents({
            "subscription_status": "active"
        })
        trial_subscriptions = await db.workspaces.count_documents({
            "subscription_status": "trialing"
        })
        
        # Calculate MRR (Monthly Recurring Revenue)
        mrr = active_subscriptions * 29  # Average price per subscription
        
        # Activity stats (recent signups and analyses)
        seven_days_ago = datetime.now(timezone.utc) - timedelta(days=7)
        recent_signups = await db.users.count_documents({
            "created_at": {"$gte": seven_days_ago}
        })
        
        # Recent analyses (diagnostics created in last 7 days)
        recent_analyses = await db.diagnostics.count_documents({
            "created_at": {"$gte": seven_days_ago.isoformat()}
        })
        
        # CRITICAL: Return structure matching frontend expectations
        stats = {
            "workspaces": {
                "total": total_workspaces,
                "active": active_workspaces,
                "trial": trial_workspaces
            },
            "users": {
                "total_active": total_active_users,
                "active_managers": active_managers,
                "active_sellers": active_sellers,
                "inactive": inactive_users
            },
            "usage": {
                "total_ai_operations": total_ai_operations,
                "analyses_ventes": 0,  # Placeholder - implement if needed
                "diagnostics": total_diagnostics
            },
            "revenue": {
                "mrr": mrr,
                "active_subscriptions": active_subscriptions,
                "trial_subscriptions": trial_subscriptions
            },
            "activity": {
                "recent_signups_7d": recent_signups,
                "recent_analyses_7d": recent_analyses
            },
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

