"""SuperAdmin Routes - Clean Architecture"""
from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Dict
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
async def get_logs(
    limit: int = Query(50, ge=1, le=1000),
    days: int = Query(7, ge=1, le=90),
    current_user: Dict = Depends(get_super_admin),
    admin_service: AdminService = Depends(get_admin_service)
):
    """
    Get system logs for monitoring (alias for /system-logs with days param)
    
    Args:
        limit: Maximum number of logs to return (1-1000)
        days: Number of days to look back (1-90)
    """
    try:
        hours = days * 24
        return await admin_service.get_system_logs(hours=hours, limit=limit)
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


# ===== SUPER ADMIN MANAGEMENT =====

@router.get("/admins")
async def get_super_admins(
    current_user: Dict = Depends(get_super_admin),
    db = Depends(get_db)
):
    """Get all super admins"""
    admins = await db.users.find(
        {"role": "super_admin"},
        {"_id": 0, "password_hash": 0}
    ).to_list(100)
    
    return {"admins": admins}


@router.post("/admins")
async def add_super_admin(
    email: str = Query(...),
    name: str = Query(...),
    current_user: Dict = Depends(get_super_admin),
    db = Depends(get_db)
):
    """Add a new super admin"""
    from uuid import uuid4
    from core.security import get_password_hash
    import secrets
    
    # Check if email already exists
    existing = await db.users.find_one({"email": email})
    if existing:
        if existing.get('role') == 'super_admin':
            raise HTTPException(status_code=400, detail="Cet email est déjà super admin")
        raise HTTPException(status_code=400, detail="Cet email existe déjà dans le système")
    
    # Generate temp password
    temp_password = secrets.token_urlsafe(12)
    
    # Create super admin
    new_admin = {
        "id": str(uuid4()),
        "email": email,
        "name": name,
        "role": "super_admin",
        "status": "active",
        "password_hash": get_password_hash(temp_password),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": current_user['id']
    }
    
    await db.users.insert_one(new_admin)
    
    # Log action
    await db.audit_logs.insert_one({
        "id": str(uuid4()),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "action": "add_super_admin",
        "admin_email": current_user['email'],
        "admin_name": current_user.get('name', 'Admin'),
        "details": {"new_admin_email": email, "new_admin_name": name}
    })
    
    return {
        "message": "Super admin ajouté avec succès",
        "temporary_password": temp_password,
        "admin_id": new_admin['id']
    }


@router.delete("/admins/{admin_id}")
async def remove_super_admin(
    admin_id: str,
    current_user: Dict = Depends(get_super_admin),
    db = Depends(get_db)
):
    """Remove a super admin (cannot remove yourself)"""
    from uuid import uuid4
    
    if admin_id == current_user['id']:
        raise HTTPException(status_code=400, detail="Vous ne pouvez pas vous supprimer vous-même")
    
    # Find admin to remove
    admin_to_remove = await db.users.find_one({"id": admin_id, "role": "super_admin"})
    if not admin_to_remove:
        raise HTTPException(status_code=404, detail="Super admin non trouvé")
    
    # Remove admin
    await db.users.delete_one({"id": admin_id})
    
    # Log action
    await db.audit_logs.insert_one({
        "id": str(uuid4()),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "action": "remove_super_admin",
        "admin_email": current_user['email'],
        "admin_name": current_user.get('name', 'Admin'),
        "details": {"removed_admin_email": admin_to_remove['email']}
    })
    
    return {"message": "Super admin supprimé avec succès"}


