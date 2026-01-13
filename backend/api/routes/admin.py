"""
Admin-only endpoints for subscription management and support operations.
"""
from fastapi import APIRouter, Depends, HTTPException, Query, Request, Body
from typing import List, Dict, Optional
from datetime import datetime, timezone, timedelta
from pydantic import BaseModel, EmailStr
from api.dependencies import get_db
from motor.motor_asyncio import AsyncIOMotorDatabase
from core.security import get_super_admin
from services.admin_service import AdminService
from repositories.admin_repository import AdminRepository
import logging
import uuid
import bcrypt
import secrets

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/superadmin", tags=["superadmin"])


class WorkspacePlanUpdate(BaseModel):
    plan: str


class BulkStatusUpdate(BaseModel):
    workspace_ids: List[str]
    status: str


@router.get("/stats")
async def get_superadmin_stats(
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_admin: dict = Depends(get_super_admin)
):
    """Statistiques globales de la plateforme"""
    try:
        admin_repo = AdminRepository(db)
        admin_service = AdminService(admin_repo)
        stats = await admin_service.get_platform_stats()
        return stats
    except Exception as e:
        logger.error(f"Error fetching superadmin stats: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/workspaces")
async def get_all_workspaces(
    include_deleted: bool = Query(False, description="Inclure les workspaces supprimés"),
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_admin: dict = Depends(get_super_admin)
):
    """Liste tous les workspaces avec informations détaillées"""
    try:
        admin_repo = AdminRepository(db)
        admin_service = AdminService(admin_repo)
        workspaces = await admin_service.get_workspaces_with_details(include_deleted=include_deleted)
        return workspaces
    except Exception as e:
        logger.error(f"Error fetching workspaces: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/logs")
async def get_audit_logs(
    limit: int = Query(50, ge=1, le=1000, description="Nombre maximum de logs"),
    days: int = Query(7, ge=1, le=365, description="Nombre de jours à remonter"),
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_admin: dict = Depends(get_super_admin)
):
    """Récupère les logs d'audit système"""
    try:
        admin_repo = AdminRepository(db)
        admin_service = AdminService(admin_repo)
        hours = days * 24
        logs_data = await admin_service.get_system_logs(hours=hours, limit=limit)
        return logs_data
    except Exception as e:
        logger.error(f"Error fetching audit logs: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/system-logs")
async def get_system_logs(
    limit: int = Query(100, ge=1, le=1000),
    hours: int = Query(24, ge=1, le=168),
    level: Optional[str] = Query(None, description="Filtrer par niveau (info, warning, error)"),
    type: Optional[str] = Query(None, description="Filtrer par type"),
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_admin: dict = Depends(get_super_admin)
):
    """Récupère les logs système"""
    try:
        admin_repo = AdminRepository(db)
        admin_service = AdminService(admin_repo)
        logs_data = await admin_service.get_system_logs(hours=hours, limit=limit)
        
        # Apply filters if provided
        if level or type:
            filtered_logs = []
            for log in logs_data.get("logs", []):
                if level and log.get("level") != level:
                    continue
                if type and log.get("action") != type:
                    continue
                filtered_logs.append(log)
            logs_data["logs"] = filtered_logs
            logs_data["total"] = len(filtered_logs)
        
        return logs_data
    except Exception as e:
        logger.error(f"Error fetching system logs: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/health")
async def get_health(
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_admin: dict = Depends(get_super_admin)
):
    """Vérifie l'état de santé du système"""
    try:
        # Test database connection
        await db.command("ping")
        db_status = "healthy"
    except Exception as e:
        logger.error(f"Database health check failed: {str(e)}")
        db_status = "unhealthy"
    
    return {
        "status": "healthy" if db_status == "healthy" else "degraded",
        "database": db_status,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "version": "2.0.0"
    }


@router.post("/subscription/resolve-duplicates")
async def resolve_duplicates(
    request: Request,
    gerant_id: str = Query(..., description="ID du gérant"),
    apply: bool = Query(False, description="Si True, applique les changements. Si False, dry-run uniquement (défaut)"),
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_admin: dict = Depends(get_super_admin)
):
    """
    🔧 Endpoint support-only pour résoudre les abonnements multiples.
    
    PROTECTION: Super admin uniquement + dry-run par défaut + logs audit.
    
    Opérations proposées:
    1. Détecte les abonnements multiples actifs
    2. Propose un plan de résolution (dry-run par défaut)
    3. Applique le plan si apply=true
    
    Règles de résolution:
    - Garde le plus récent (current_period_end)
    - Annule les autres à la fin de période
    - Vérifie metadata pour corrélation
    
    Returns:
        Plan de résolution (dry-run) ou résultat de l'application
    """
    # 🔒 AUDIT LOG: Log admin action
    # Get IP from multiple sources (x-forwarded-for can be spoofed, but OK for superadmin endpoint)
    # Priority: cf-connecting-ip > x-real-ip > x-forwarded-for > platform headers > client.host
    client_ip = None
    x_forwarded_for = request.headers.get("x-forwarded-for")
    x_real_ip = request.headers.get("x-real-ip")
    cf_connecting_ip = request.headers.get("cf-connecting-ip")
    
    # Priority order (most trusted first)
    if cf_connecting_ip:  # Cloudflare (most trusted)
        client_ip = cf_connecting_ip.split(",")[0].strip()
    elif x_real_ip:  # Nginx/Proxy standard
        client_ip = x_real_ip.split(",")[0].strip()
    elif x_forwarded_for:  # Standard proxy header (first IP)
        client_ip = x_forwarded_for.split(",")[0].strip()
    elif request.headers.get("x-vercel-forwarded-for"):  # Vercel
        client_ip = request.headers.get("x-vercel-forwarded-for").split(",")[0].strip()
    elif request.headers.get("x-railway-client-ip"):  # Railway
        client_ip = request.headers.get("x-railway-client-ip").split(",")[0].strip()
    elif request.client:  # Direct connection (fallback)
        client_ip = request.client.host
    
    if not client_ip:
        client_ip = "unknown"
    
    logger.warning(
        f"🔧 ADMIN ACTION: resolve_duplicates called by {current_admin.get('email')} "
        f"(id: {current_admin.get('id')}) for gerant {gerant_id}, apply={apply}, IP: {client_ip}"
    )
    
    # Log to admin_logs collection
    # ✅ SANITY CHECK: timestamp présent, pas d'info sensible (pas de tokens), pas de contrainte schema ORM
    try:
        await db.admin_logs.insert_one({
            "admin_id": current_admin.get('id'),
            "admin_email": current_admin.get('email'),
            "action": "resolve_subscription_duplicates",
            "gerant_id": gerant_id,
            "apply": apply,
            "ip": client_ip,
            "x_forwarded_for": x_forwarded_for,  # Store original header (can be spoofed, but OK for audit)
            "x_real_ip": x_real_ip,  # Store x-real-ip if available
            "cf_connecting_ip": cf_connecting_ip,  # Store Cloudflare IP if available
            "timestamp": datetime.now(timezone.utc).isoformat(),  # ✅ Timestamp pour audit
            "created_at": datetime.now(timezone.utc).isoformat()  # Alias pour compatibilité
        })
    except Exception as e:
        logger.error(f"Failed to log admin action: {e}")
    
    try:
        # Get all active subscriptions for this gerant
        active_subscriptions = await db.subscriptions.find(
            {"user_id": gerant_id, "status": {"$in": ["active", "trialing"]}},
            {"_id": 0}
        ).to_list(length=20)
        
        if len(active_subscriptions) <= 1:
            return {
                "success": True,
                "message": "Aucun doublon détecté",
                "active_subscriptions_count": len(active_subscriptions),
                "plan": None
            }
        
        # Sort by current_period_end (most recent first)
        sorted_subs = sorted(
            active_subscriptions,
            key=lambda s: (
                s.get('current_period_end', '') or s.get('created_at', ''),
                s.get('status') == 'active'  # Prefer active over trialing
            ),
            reverse=True
        )
        
        # Keep the most recent one
        keep_subscription = sorted_subs[0]
        cancel_subscriptions = sorted_subs[1:]
        
        # Build resolution plan
        plan = {
            "keep": {
                "stripe_subscription_id": keep_subscription.get('stripe_subscription_id'),
                "workspace_id": keep_subscription.get('workspace_id'),
                "price_id": keep_subscription.get('price_id'),
                "status": keep_subscription.get('status'),
                "current_period_end": keep_subscription.get('current_period_end'),
                "reason": "Most recent subscription (by current_period_end)"
            },
            "cancel": [
                {
                    "stripe_subscription_id": sub.get('stripe_subscription_id'),
                    "workspace_id": sub.get('workspace_id'),
                    "price_id": sub.get('price_id'),
                    "status": sub.get('status'),
                    "current_period_end": sub.get('current_period_end'),
                    "action": "cancel_at_period_end"
                }
                for sub in cancel_subscriptions
            ]
        }
        
        if not apply:
            # Dry-run: return plan only
            return {
                "success": True,
                "mode": "dry-run",
                "message": f"Plan de résolution pour {len(active_subscriptions)} abonnements actifs",
                "active_subscriptions_count": len(active_subscriptions),
                "plan": plan,
                "instructions": "Passez apply=true pour appliquer ce plan"
            }
        
        # Apply plan: cancel subscriptions via Stripe
        import stripe
        from core.config import settings
        
        if not settings.STRIPE_API_KEY:
            raise HTTPException(status_code=500, detail="Configuration Stripe manquante")
        
        stripe.api_key = settings.STRIPE_API_KEY
        
        canceled_results = []
        errors = []
        
        for sub_to_cancel in cancel_subscriptions:
            stripe_sub_id = sub_to_cancel.get('stripe_subscription_id')
            if not stripe_sub_id:
                errors.append({
                    "stripe_subscription_id": None,
                    "error": "No stripe_subscription_id found"
                })
                continue
            
            try:
                # Cancel at period end (not immediately)
                stripe.Subscription.modify(stripe_sub_id, cancel_at_period_end=True)
                
                # Update database
                await db.subscriptions.update_one(
                    {"stripe_subscription_id": stripe_sub_id},
                    {"$set": {
                        "cancel_at_period_end": True,
                        "canceled_at": datetime.now(timezone.utc).isoformat(),
                        "updated_at": datetime.now(timezone.utc).isoformat()
                    }}
                )
                
                canceled_results.append({
                    "stripe_subscription_id": stripe_sub_id,
                    "status": "scheduled_for_cancellation"
                })
                
                logger.info(f"✅ Scheduled cancellation for subscription {stripe_sub_id}")
                
            except Exception as e:
                errors.append({
                    "stripe_subscription_id": stripe_sub_id,
                    "error": str(e)
                })
                logger.error(f"❌ Error canceling subscription {stripe_sub_id}: {e}")
        
        return {
            "success": True,
            "mode": "applied",
            "message": f"Plan appliqué: {len(canceled_results)} abonnement(s) programmé(s) pour annulation",
            "active_subscriptions_count": len(active_subscriptions),
            "plan": plan,
            "results": {
                "canceled_count": len(canceled_results),
                "canceled": canceled_results,
                "errors": errors
            }
        }
        
    except Exception as e:
        logger.error(f"Erreur résolution doublons: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Erreur lors de la résolution: {str(e)}")


@router.patch("/workspaces/{workspace_id}/status")
async def update_workspace_status(
    workspace_id: str,
    status: str = Query(..., description="Nouveau statut (active, suspended, deleted)"),
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_admin: dict = Depends(get_super_admin)
):
    """Activer/désactiver un workspace"""
    try:
        if status not in ['active', 'suspended', 'deleted']:
            raise HTTPException(status_code=400, detail="Invalid status. Must be: active, suspended, or deleted")
        
        # Get current workspace status before update
        workspace = await db.workspaces.find_one({"id": workspace_id}, {"_id": 0, "name": 1, "status": 1})
        if not workspace:
            raise HTTPException(status_code=404, detail="Workspace not found")
        
        old_status = workspace.get('status', 'active')
        
        # Update workspace
        result = await db.workspaces.update_one(
            {"id": workspace_id},
            {"$set": {"status": status, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
        
        if result.modified_count == 0:
            raise HTTPException(status_code=404, detail="Workspace not found or status unchanged")
        
        # Log admin action
        try:
            await db.admin_logs.insert_one({
                "admin_id": current_admin.get('id'),
                "admin_email": current_admin.get('email'),
                "action": "workspace_status_change",
                "workspace_id": workspace_id,
                "details": {
                    "workspace_name": workspace.get('name', 'Unknown'),
                    "old_status": old_status,
                    "new_status": status
                },
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "created_at": datetime.now(timezone.utc).isoformat()
            })
        except Exception as e:
            logger.error(f"Failed to log admin action: {e}")
        
        return {"success": True, "message": f"Workspace status updated to {status}"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating workspace status: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/workspaces/{workspace_id}/plan")
async def update_workspace_plan(
    workspace_id: str,
    plan_data: WorkspacePlanUpdate = Body(...),
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_admin: dict = Depends(get_super_admin)
):
    """Changer le plan d'un workspace"""
    try:
        new_plan = plan_data.plan
        valid_plans = ['trial', 'starter', 'professional', 'enterprise']
        
        if new_plan not in valid_plans:
            raise HTTPException(status_code=400, detail=f"Invalid plan. Must be one of: {valid_plans}")
        
        # Get current workspace plan before update
        workspace = await db.workspaces.find_one({"id": workspace_id}, {"_id": 0, "name": 1, "plan_type": 1, "subscription_plan": 1})
        if not workspace:
            raise HTTPException(status_code=404, detail="Workspace not found")
        
        old_plan = workspace.get('plan_type') or workspace.get('subscription_plan', 'trial')
        
        # Update workspace
        await db.workspaces.update_one(
            {"id": workspace_id},
            {"$set": {
                "plan_type": new_plan,
                "subscription_plan": new_plan,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        # Update subscription if exists
        await db.subscriptions.update_one(
            {"workspace_id": workspace_id},
            {"$set": {
                "plan_type": new_plan,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }},
            upsert=False  # Don't create if doesn't exist
        )
        
        # Log admin action
        try:
            await db.admin_logs.insert_one({
                "admin_id": current_admin.get('id'),
                "admin_email": current_admin.get('email'),
                "action": "workspace_plan_change",
                "workspace_id": workspace_id,
                "details": {
                    "workspace_name": workspace.get('name', 'Unknown'),
                    "old_plan": old_plan,
                    "new_plan": new_plan
                },
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "created_at": datetime.now(timezone.utc).isoformat()
            })
        except Exception as e:
            logger.error(f"Failed to log admin action: {e}")
        
        return {"success": True, "message": f"Plan changed to {new_plan}"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating workspace plan: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/workspaces/bulk/status")
async def bulk_update_workspace_status(
    bulk_data: BulkStatusUpdate = Body(...),
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_admin: dict = Depends(get_super_admin)
):
    """Mettre à jour le statut de plusieurs workspaces en masse"""
    try:
        status = bulk_data.status
        workspace_ids = bulk_data.workspace_ids
        
        if status not in ['active', 'suspended', 'deleted']:
            raise HTTPException(status_code=400, detail="Invalid status. Must be: active, suspended, or deleted")
        
        if not workspace_ids or len(workspace_ids) == 0:
            raise HTTPException(status_code=400, detail="No workspace IDs provided")
        
        # Update all workspaces
        result = await db.workspaces.update_many(
            {"id": {"$in": workspace_ids}},
            {"$set": {"status": status, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
        
        # Log admin action
        try:
            await db.admin_logs.insert_one({
                "admin_id": current_admin.get('id'),
                "admin_email": current_admin.get('email'),
                "action": "bulk_workspace_status_change",
                "details": {
                    "workspace_ids": workspace_ids,
                    "new_status": status,
                    "updated_count": result.modified_count
                },
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "created_at": datetime.now(timezone.utc).isoformat()
            })
        except Exception as e:
            logger.error(f"Failed to log admin action: {e}")
        
        return {
            "success": True,
            "message": f"Updated {result.modified_count} workspace(s) to status {status}",
            "updated_count": result.modified_count
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error bulk updating workspace status: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/admins")
async def get_super_admins(
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_admin: dict = Depends(get_super_admin)
):
    """Get list of super admins"""
    try:
        admins = await db.users.find(
            {"role": "super_admin"},
            {"_id": 0, "password": 0}
        ).to_list(100)
        
        return {"admins": admins}
    except Exception as e:
        logger.error(f"Error fetching admins: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/admins")
async def add_super_admin(
    email: EmailStr = Query(..., description="Email du nouveau super admin"),
    name: str = Query(..., description="Nom du nouveau super admin"),
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_admin: dict = Depends(get_super_admin)
):
    """Add a new super admin by email"""
    try:
        # Check if user already exists
        existing = await db.users.find_one({"email": email})
        if existing:
            if existing.get('role') == 'super_admin':
                raise HTTPException(status_code=400, detail="Cet email est déjà super admin")
            else:
                raise HTTPException(status_code=400, detail="Cet email existe déjà avec un autre rôle")
        
        # Generate temporary password
        temp_password = secrets.token_urlsafe(16)
        hashed_password = bcrypt.hashpw(temp_password.encode('utf-8'), bcrypt.gensalt())
        
        # Create new super admin
        new_admin = {
            "id": str(uuid.uuid4()),
            "email": email,
            "password": hashed_password.decode('utf-8'),
            "name": name,
            "role": "super_admin",
            "status": "active",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "created_by": current_admin['email']
        }
        
        await db.users.insert_one(new_admin)
        
        # Log admin action
        try:
            await db.admin_logs.insert_one({
                "admin_id": current_admin.get('id'),
                "admin_email": current_admin.get('email'),
                "action": "add_super_admin",
                "details": {
                    "new_admin_email": email,
                    "new_admin_name": name,
                    "temp_password_generated": True
                },
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "created_at": datetime.now(timezone.utc).isoformat()
            })
        except Exception as e:
            logger.error(f"Failed to log admin action: {e}")
        
        return {
            "success": True,
            "email": email,
            "temporary_password": temp_password,
            "message": "Super admin ajouté. Envoyez-lui le mot de passe temporaire."
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error adding super admin: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/admins/{admin_id}")
async def remove_super_admin(
    admin_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_admin: dict = Depends(get_super_admin)
):
    """Remove a super admin (cannot remove yourself)"""
    try:
        # Cannot remove yourself
        if admin_id == current_admin['id']:
            raise HTTPException(status_code=400, detail="Vous ne pouvez pas vous retirer vous-même")
        
        # Find admin to remove
        admin_to_remove = await db.users.find_one({"id": admin_id, "role": "super_admin"})
        if not admin_to_remove:
            raise HTTPException(status_code=404, detail="Super admin non trouvé")
        
        # Remove admin
        await db.users.delete_one({"id": admin_id})
        
        # Log admin action
        try:
            await db.admin_logs.insert_one({
                "admin_id": current_admin.get('id'),
                "admin_email": current_admin.get('email'),
                "action": "remove_super_admin",
                "details": {
                    "removed_admin_email": admin_to_remove.get('email'),
                    "removed_admin_name": admin_to_remove.get('name'),
                    "removed_admin_id": admin_id
                },
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "created_at": datetime.now(timezone.utc).isoformat()
            })
        except Exception as e:
            logger.error(f"Failed to log admin action: {e}")
        
        return {"success": True, "message": "Super admin supprimé"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error removing super admin: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/subscriptions/overview")
async def get_subscriptions_overview(
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_admin: dict = Depends(get_super_admin)
):
    """
    Vue d'ensemble de tous les abonnements Stripe des gérants.
    Affiche statuts, paiements, prorations, etc.
    """
    try:
        # Récupérer tous les gérants
        gerants = await db.users.find(
            {"role": "gerant"},
            {"_id": 0, "id": 1, "name": 1, "email": 1, "stripe_customer_id": 1, "created_at": 1}
        ).to_list(None)
        
        subscriptions_data = []
        
        for gerant in gerants:
            # Récupérer l'abonnement
            subscription = await db.subscriptions.find_one(
                {"user_id": gerant['id']},
                {"_id": 0}
            )
            
            # Compter les vendeurs actifs
            active_sellers_count = await db.users.count_documents({
                "gerant_id": gerant['id'],
                "role": "seller",
                "status": "active"
            })
            
            # Récupérer la dernière transaction
            last_transaction = await db.payment_transactions.find_one(
                {"user_id": gerant['id']},
                {"_id": 0},
                sort=[("created_at", -1)]
            )
            
            # Récupérer l'utilisation des crédits IA
            team_members = await db.users.find(
                {"gerant_id": gerant['id']},
                {"_id": 0, "id": 1}
            ).to_list(None)
            
            team_ids = [member['id'] for member in team_members]
            
            ai_credits_total = 0
            if team_ids:
                pipeline = [
                    {"$match": {"user_id": {"$in": team_ids}}},
                    {"$group": {"_id": None, "total": {"$sum": "$credits_consumed"}}}
                ]
                result = await db.ai_usage_logs.aggregate(pipeline).to_list(None)
                if result:
                    ai_credits_total = result[0]['total']
            
            subscriptions_data.append({
                "gerant": {
                    "id": gerant['id'],
                    "name": gerant['name'],
                    "email": gerant['email'],
                    "created_at": gerant.get('created_at')
                },
                "subscription": subscription,
                "active_sellers_count": active_sellers_count,
                "last_transaction": last_transaction,
                "ai_credits_used": ai_credits_total
            })
        
        # Statistiques globales
        total_gerants = len(gerants)
        active_subscriptions = sum(1 for s in subscriptions_data if s['subscription'] and s['subscription'].get('status') in ['active', 'trialing'])
        trialing_subscriptions = sum(1 for s in subscriptions_data if s['subscription'] and s['subscription'].get('status') == 'trialing')
        total_mrr = sum(
            s['subscription'].get('seats', 0) * s['subscription'].get('price_per_seat', 0)
            for s in subscriptions_data
            if s['subscription'] and s['subscription'].get('status') == 'active'
        )
        
        return {
            "summary": {
                "total_gerants": total_gerants,
                "active_subscriptions": active_subscriptions,
                "trialing_subscriptions": trialing_subscriptions,
                "total_mrr": round(total_mrr, 2)
            },
            "subscriptions": subscriptions_data
        }
        
    except Exception as e:
        logger.error(f"Error fetching subscriptions overview: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/gerants/trials")
async def get_gerants_trials(
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_admin: dict = Depends(get_super_admin)
):
    """Récupérer tous les gérants avec leurs informations d'essai"""
    try:
        # Récupérer tous les gérants
        gerants = await db.users.find(
            {"role": "gerant"},
            {"_id": 0, "password": 0}
        ).to_list(length=None)
        
        result = []
        for gerant in gerants:
            # Compter les vendeurs actifs
            active_sellers_count = await db.users.count_documents({
                "gerant_id": gerant['id'],
                "role": "seller",
                "status": "active"
            })
            
            # Vérifier s'il a un abonnement actif
            subscription = await db.subscriptions.find_one(
                {"user_id": gerant['id']},
                {"_id": 0}
            )
            
            has_subscription = False
            trial_end = None
            
            if subscription:
                has_subscription = subscription.get('status') in ['active', 'trialing']
                trial_end = subscription.get('trial_end')
            
            result.append({
                "id": gerant['id'],
                "name": gerant.get('name', 'N/A'),
                "email": gerant['email'],
                "trial_end": trial_end,
                "active_sellers_count": active_sellers_count,
                "has_subscription": has_subscription,
                "subscription_status": subscription.get('status') if subscription else None
            })
        
        # Trier par date d'expiration (les plus proches d'abord)
        result.sort(key=lambda x: (
            x['trial_end'] is None,  # Ceux sans essai en dernier
            x['trial_end'] if x['trial_end'] else ''
        ))
        
        return result
        
    except Exception as e:
        logger.error(f"Error fetching gerants trials: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/ai-assistant/conversations")
async def get_ai_conversations(
    limit: int = Query(20, ge=1, le=100),
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_admin: dict = Depends(get_super_admin)
):
    """Get AI assistant conversation history (last 7 days)"""
    try:
        # Get conversations from last 7 days
        since = datetime.now(timezone.utc) - timedelta(days=7)
        
        conversations = await db.ai_conversations.find(
            {
                "admin_email": current_admin['email'],
                "created_at": {"$gte": since.isoformat()}
            },
            {"_id": 0}
        ).sort("updated_at", -1).limit(limit).to_list(limit)
        
        return {
            "conversations": conversations,
            "total": len(conversations)
        }
    except Exception as e:
        logger.error(f"Error fetching AI conversations: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/invitations")
async def get_all_invitations(
    status: Optional[str] = Query(None, description="Filtrer par statut"),
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_admin: dict = Depends(get_super_admin)
):
    """Récupérer toutes les invitations (tous gérants)"""
    try:
        query = {}
        if status:
            query["status"] = status
        
        invitations = await db.gerant_invitations.find(query, {"_id": 0}).to_list(1000)
        
        # Enrichir avec les infos du gérant
        for invite in invitations:
            gerant = await db.users.find_one(
                {"id": invite.get("gerant_id")}, 
                {"_id": 0, "name": 1, "email": 1}
            )
            if gerant:
                invite["gerant_name"] = gerant.get("name", "N/A")
                invite["gerant_email"] = gerant.get("email", "N/A")
        
        return invitations
    except Exception as e:
        logger.error(f"Error fetching invitations: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
