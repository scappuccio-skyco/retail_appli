"""
Admin-only endpoints for subscription management and support operations.
Phase 9 - Vague 3: Routes ne contiennent que définition HTTP + validation, logique dans AdminService.
Phase 3: Pagination obligatoire pour GET /workspaces (items, total, page, size, pages).
"""
from fastapi import APIRouter, Depends, HTTPException, Query, Request, Body
from typing import List, Dict, Optional
from datetime import datetime, timezone
from pydantic import BaseModel, EmailStr
from api.dependencies import get_admin_service
from core.security import get_super_admin
from services.admin_service import AdminService
from models.chat import ChatRequest
from config.limits import MAX_PAGE_SIZE
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/superadmin", tags=["superadmin"])


class WorkspacePlanUpdate(BaseModel):
    plan: str


class BulkStatusUpdate(BaseModel):
    workspace_ids: List[str]
    status: str


@router.get("/stats")
async def get_superadmin_stats(
    admin_service: AdminService = Depends(get_admin_service),
    current_admin: dict = Depends(get_super_admin)
):
    """Statistiques globales de la plateforme"""
    try:
        return await admin_service.get_platform_stats()
    except Exception as e:
        logger.error(f"Error fetching superadmin stats: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/workspaces")
async def get_all_workspaces(
    page: int = Query(1, ge=1, description="Numéro de page"),
    size: int = Query(50, ge=1, le=MAX_PAGE_SIZE, description="Nombre d'éléments par page"),
    include_deleted: bool = Query(False, description="Inclure les workspaces supprimés"),
    admin_service: AdminService = Depends(get_admin_service),
    current_admin: dict = Depends(get_super_admin)
):
    """Liste tous les workspaces avec informations détaillées (paginé: items, total, page, size, pages)."""
    return await admin_service.get_workspaces_with_details_paginated(
        page=page,
        size=size,
        include_deleted=include_deleted,
    )


@router.get("/logs")
async def get_audit_logs(
    limit: int = Query(50, ge=1, le=1000, description="Nombre maximum de logs"),
    days: int = Query(7, ge=1, le=365, description="Nombre de jours à remonter"),
    action: Optional[str] = Query(None, description="Filtrer par type d'action"),
    admin_emails: Optional[str] = Query(None, description="Emails admin séparés par des virgules"),
    admin_service: AdminService = Depends(get_admin_service),
    current_admin: dict = Depends(get_super_admin)
):
    """Récupère les logs d'audit administrateur"""
    try:
        hours = days * 24
        emails_list = None
        if admin_emails:
            emails_list = [email.strip() for email in admin_emails.split(",") if email.strip()]
        return await admin_service.get_admin_audit_logs(
            hours=hours,
            limit=limit,
            action=action,
            admin_emails=emails_list
        )
    except Exception as e:
        logger.error(f"Error fetching audit logs: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/system-logs")
async def get_system_logs(
    limit: int = Query(100, ge=1, le=1000),
    hours: int = Query(24, ge=1, le=168),
    level: Optional[str] = Query(None, description="Filtrer par niveau (info, warning, error)"),
    type: Optional[str] = Query(None, description="Filtrer par type"),
    admin_service: AdminService = Depends(get_admin_service),
    current_admin: dict = Depends(get_super_admin)
):
    """Récupère les logs système"""
    try:
        return await admin_service.get_system_logs(
            hours=hours,
            limit=limit,
            level=level,
            type_filter=type
        )
    except Exception as e:
        logger.error(f"Error fetching system logs: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/health")
async def get_health(
    admin_service: AdminService = Depends(get_admin_service),
    current_admin: dict = Depends(get_super_admin)
):
    """Vérifie l'état de santé du système"""
    return await admin_service.health_check()


@router.post("/subscription/resolve-duplicates")
async def resolve_duplicates(
    request: Request,
    gerant_id: str = Query(..., description="ID du gérant"),
    apply: bool = Query(False, description="Si True, applique les changements. Si False, dry-run uniquement (défaut)"),
    admin_service: AdminService = Depends(get_admin_service),
    current_admin: dict = Depends(get_super_admin)
):
    """
    🔧 Endpoint support-only pour résoudre les abonnements multiples.
    PROTECTION: Super admin uniquement + dry-run par défaut + logs audit.
    """
    try:
        return await admin_service.resolve_subscription_duplicates(
            gerant_id=gerant_id,
            apply=apply,
            current_admin=current_admin,
            request_headers=dict(request.headers)
        )
    except Exception as e:
        logger.error(f"Erreur résolution doublons: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Erreur lors de la résolution: {str(e)}")


@router.patch("/workspaces/{workspace_id}/status")
async def update_workspace_status(
    workspace_id: str,
    status: str = Query(..., description="Nouveau statut (active, deleted)"),
    admin_service: AdminService = Depends(get_admin_service),
    current_admin: dict = Depends(get_super_admin)
):
    """Activer ou supprimer un workspace"""
    try:
        if status not in ['active', 'deleted']:
            raise HTTPException(status_code=400, detail="Invalid status. Must be: active or deleted")
        return await admin_service.update_workspace_status(
            workspace_id=workspace_id,
            status=status,
            current_admin=current_admin
        )
    except ValueError as e:
        err = str(e)
        if "not found" in err.lower():
            raise HTTPException(status_code=404, detail=err)
        raise HTTPException(status_code=400, detail=err)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating workspace status: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/workspaces/{workspace_id}/plan")
async def update_workspace_plan(
    workspace_id: str,
    plan_data: WorkspacePlanUpdate = Body(...),
    admin_service: AdminService = Depends(get_admin_service),
    current_admin: dict = Depends(get_super_admin)
):
    """Changer le plan d'un workspace"""
    try:
        new_plan = plan_data.plan
        return await admin_service.update_workspace_plan(
            workspace_id=workspace_id,
            new_plan=new_plan,
            current_admin=current_admin
        )
    except ValueError as e:
        err = str(e)
        if "not found" in err.lower():
            raise HTTPException(status_code=404, detail=err)
        raise HTTPException(status_code=400, detail=err)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating workspace plan: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/workspaces/bulk/status")
async def bulk_update_workspace_status(
    bulk_data: BulkStatusUpdate = Body(...),
    admin_service: AdminService = Depends(get_admin_service),
    current_admin: dict = Depends(get_super_admin)
):
    """Mettre à jour le statut de plusieurs workspaces en masse"""
    try:
        if not bulk_data.workspace_ids:
            raise HTTPException(status_code=400, detail="No workspace IDs provided")
        return await admin_service.bulk_update_workspace_status(
            workspace_ids=bulk_data.workspace_ids,
            status=bulk_data.status,
            current_admin=current_admin
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error bulk updating workspace status: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/admins")
async def get_super_admins(
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=100),
    admin_service: AdminService = Depends(get_admin_service),
    current_admin: dict = Depends(get_super_admin)
):
    """Get list of super admins"""
    try:
        return await admin_service.get_admins_paginated(page=page, size=size)
    except Exception as e:
        logger.error(f"Error fetching admins: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/admins")
async def add_super_admin(
    email: EmailStr = Query(..., description="Email du nouveau super admin"),
    name: str = Query(..., description="Nom du nouveau super admin"),
    admin_service: AdminService = Depends(get_admin_service),
    current_admin: dict = Depends(get_super_admin)
):
    """Add a new super admin by email"""
    try:
        return await admin_service.add_super_admin(
            email=email,
            name=name,
            current_admin=current_admin
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error adding super admin: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/admins/{admin_id}")
async def remove_super_admin(
    admin_id: str,
    admin_service: AdminService = Depends(get_admin_service),
    current_admin: dict = Depends(get_super_admin)
):
    """Remove a super admin (cannot remove yourself)"""
    try:
        return await admin_service.remove_super_admin(
            admin_id=admin_id,
            current_admin=current_admin
        )
    except ValueError as e:
        err = str(e)
        if "retirer" in err or "vous-même" in err:
            raise HTTPException(status_code=400, detail=err)
        raise HTTPException(status_code=404, detail=err)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error removing super admin: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/subscriptions/overview")
async def get_subscriptions_overview(
    page: int = Query(1, ge=1, description="Page number"),
    size: int = Query(100, ge=1, le=100, description="Items per page (max 100)"),
    admin_service: AdminService = Depends(get_admin_service),
    current_admin: dict = Depends(get_super_admin)
):
    """Vue d'ensemble de tous les abonnements Stripe des gérants. Paginée: max 100 gérants par page."""
    try:
        return await admin_service.get_subscriptions_overview(page=page, size=size)
    except Exception as e:
        logger.error(f"Error fetching subscriptions overview: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/subscriptions/{gerant_id}/details")
async def get_subscription_details(
    gerant_id: str,
    admin_service: AdminService = Depends(get_admin_service),
    current_admin: dict = Depends(get_super_admin)
):
    """Détails complets d'un abonnement spécifique."""
    try:
        return await admin_service.get_subscription_details(gerant_id=gerant_id)
    except ValueError as e:
        if "non trouvé" in str(e).lower():
            raise HTTPException(status_code=404, detail=str(e))
        raise HTTPException(status_code=400, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching subscription details: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/gerants/trials")
async def get_gerants_trials(
    page: int = Query(1, ge=1, description="Page number"),
    size: int = Query(100, ge=1, le=100, description="Items per page (max 100)"),
    admin_service: AdminService = Depends(get_admin_service),
    current_admin: dict = Depends(get_super_admin)
):
    """Récupérer tous les gérants avec leurs informations d'essai (paginated, max 100 par page)"""
    try:
        return await admin_service.get_gerants_trials(page=page, size=size)
    except Exception as e:
        logger.error(f"Error fetching gerants trials: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/gerants/{gerant_id}/trial")
async def update_gerant_trial(
    gerant_id: str,
    trial_data: Dict = Body(...),
    admin_service: AdminService = Depends(get_admin_service),
    current_admin: dict = Depends(get_super_admin)
):
    """Modifier la période d'essai d'un gérant"""
    try:
        trial_end_str = trial_data.get('trial_end')
        if not trial_end_str:
            raise HTTPException(status_code=400, detail="Date de fin d'essai requise")
        return await admin_service.update_gerant_trial(
            gerant_id=gerant_id,
            trial_end_str=trial_end_str,
            current_admin=current_admin
        )
    except ValueError as e:
        err = str(e)
        if "non trouvé" in err.lower():
            raise HTTPException(status_code=404, detail=err)
        raise HTTPException(status_code=400, detail=err)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating gerant trial: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/ai-assistant/conversations")
async def get_ai_conversations(
    limit: int = Query(20, ge=1, le=100),
    page: int = Query(1, ge=1),
    admin_service: AdminService = Depends(get_admin_service),
    current_admin: dict = Depends(get_super_admin)
):
    """Get AI assistant conversation history (last 7 days) - Paginated, max 100"""
    try:
        return await admin_service.get_ai_conversations(
            admin_email=current_admin['email'],
            limit=limit,
            page=page
        )
    except Exception as e:
        logger.error(f"Error fetching AI conversations: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/ai-assistant/conversation/{conversation_id}")
async def get_conversation_messages(
    conversation_id: str,
    page: int = Query(1, ge=1),
    size: int = Query(100, ge=1, le=100),
    admin_service: AdminService = Depends(get_admin_service),
    current_admin: dict = Depends(get_super_admin)
):
    """Get messages for a specific conversation"""
    try:
        return await admin_service.get_conversation_messages(
            conversation_id=conversation_id,
            admin_email=current_admin['email'],
            page=page,
            size=size
        )
    except ValueError as e:
        if "non trouvée" in str(e).lower():
            raise HTTPException(status_code=404, detail=str(e))
        raise HTTPException(status_code=400, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching conversation messages: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/invitations")
async def get_all_invitations(
    status: Optional[str] = Query(None, description="Filtrer par statut"),
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=100),
    admin_service: AdminService = Depends(get_admin_service),
    current_admin: dict = Depends(get_super_admin)
):
    """Récupérer toutes les invitations (tous gérants) - Paginées"""
    try:
        return await admin_service.get_all_invitations(
            status=status,
            page=page,
            size=size
        )
    except Exception as e:
        logger.error(f"Error fetching invitations: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/ai-assistant/chat")
async def chat_with_ai_assistant(
    request: ChatRequest,
    admin_service: AdminService = Depends(get_admin_service),
    current_admin: dict = Depends(get_super_admin)
):
    """Chat with AI assistant for troubleshooting and support"""
    try:
        return await admin_service.chat_with_ai_assistant(
            message=request.message,
            conversation_id=request.conversation_id,
            current_admin=current_admin
        )
    except Exception as e:
        logger.error(f"Error in AI assistant chat: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Erreur AI: {str(e)}")
