"""
Gérant staff routes: managers/sellers list, staff update, invitations, suspend/reactivate/delete.
"""
from fastapi import APIRouter, Depends, BackgroundTasks, Query
from datetime import datetime, timezone
from typing import Dict

from core.constants import ERR_UTILISATEUR_NON_TROUVE
from core.exceptions import AppException, NotFoundError, ValidationError, ForbiddenError
from core.security import get_current_gerant
from services.gerant_service import GerantService
from api.dependencies import get_gerant_service
from middleware.log_sanitizer import neutralize_for_log
from email_service import send_staff_email_update_confirmation, send_staff_email_update_alert
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="", tags=["Gérant"])


@router.get("/managers")
async def get_all_managers(
    page: int = Query(1, ge=1, description="Numéro de page"),
    size: int = Query(100, ge=1, le=200, description="Taille de page (max 200)"),
    current_user: dict = Depends(get_current_gerant),
    gerant_service: GerantService = Depends(get_gerant_service)
):
    """Get managers paginated (active and suspended, excluding deleted)."""
    try:
        return await gerant_service.get_all_managers(current_user['id'], page=page, size=size)
    except ValueError as e:
        raise NotFoundError(str(e))


@router.get("/sellers")
async def get_all_sellers(
    page: int = Query(1, ge=1, description="Numéro de page"),
    size: int = Query(100, ge=1, le=200, description="Taille de page (max 200)"),
    current_user: dict = Depends(get_current_gerant),
    gerant_service: GerantService = Depends(get_gerant_service)
):
    """Get sellers paginated (active and suspended, excluding deleted)."""
    return await gerant_service.get_all_sellers(current_user['id'], page=page, size=size)


@router.put("/staff/{user_id}")
async def update_staff_member(
    user_id: str,
    update_data: Dict,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_gerant),
    gerant_service: GerantService = Depends(get_gerant_service),
):
    """
    Update staff member information (manager or seller).

    Allowed fields: name, email, phone
    Security: Only gérant can update their own staff members

    If email is changed:
    - Sends confirmation email to new address (synchronous)
    - Sends alert email to old address (background task)
    """
    try:
        # Find the user
        user = await gerant_service.get_user_by_id(user_id, include_password=True)

        if not user:
            raise NotFoundError(ERR_UTILISATEUR_NON_TROUVE)

        # Security: Verify the user belongs to the gérant
        user_gerant_id = user.get('gerant_id')
        if not user_gerant_id or user_gerant_id != current_user['id']:
            raise ForbiddenError("Vous n'avez pas l'autorisation de modifier cet utilisateur")

        # Verify role is manager or seller
        user_role = user.get('role')
        if user_role not in ['manager', 'seller']:
            raise ValidationError("Seuls les managers et vendeurs peuvent être modifiés via cet endpoint")

        # Store old email before update (for email notifications)
        old_email = user.get('email', '').lower().strip() if user.get('email') else None
        user_name = user.get('name', 'Utilisateur')
        gerant_name = current_user.get('name', 'Votre gérant')

        # Whitelist allowed fields
        ALLOWED_FIELDS = ['name', 'email', 'phone']
        updates = {}

        for field in ALLOWED_FIELDS:
            if field in update_data and update_data[field] is not None:
                updates[field] = update_data[field]

        if not updates:
            raise ValidationError("Aucun champ valide à mettre à jour")

        # Validate email format if provided
        email_changed = False
        new_email = None

        if 'email' in updates:
            import re
            email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
            if not re.match(email_pattern, updates['email']):
                raise ValidationError("Format d'email invalide")

            # Normalize email to lowercase for consistency and uniqueness check
            email_lower = updates['email'].lower().strip()
            new_email = email_lower

            # Check if email has actually changed
            if old_email and old_email != email_lower:
                email_changed = True

            updates['email'] = email_lower  # Store normalized email

            existing_user = await gerant_service.find_user_by_email(email_lower)
            if existing_user and existing_user.get('id') != user_id:
                raise ValidationError("Cet email est déjà utilisé par un autre utilisateur")

        # Add updated_at timestamp
        updates['updated_at'] = datetime.now(timezone.utc).isoformat()

        # Update user
        await gerant_service.update_user_one(user_id, updates)

        # Fetch updated user
        updated_user = await gerant_service.get_user_by_id(user_id, include_password=False)

        # Send email notifications if email was changed
        if email_changed and new_email and old_email:
            try:
                # Send confirmation email to new address (synchronous - important)
                send_staff_email_update_confirmation(
                    recipient_email=new_email,
                    recipient_name=user_name,
                    new_email=new_email
                )
                logger.info("Email confirmation sent to new address for user %s", neutralize_for_log(user_id))

                # Send alert email to old address (background task - non-blocking)
                background_tasks.add_task(
                    send_staff_email_update_alert,
                    recipient_email=old_email,
                    recipient_name=user_name,
                    new_email=new_email,
                    gerant_name=gerant_name
                )
                logger.info("Email alert scheduled for old address for user %s", neutralize_for_log(user_id))
            except Exception:
                # Log error but don't fail the request; do not log exception message (user-controlled / log injection risk)
                logger.error("Error sending email notifications for user %s", neutralize_for_log(user_id), exc_info=True)

        logger.info("Staff member %s updated by gérant %s", neutralize_for_log(user_id), neutralize_for_log(current_user.get('id')))

        return {
            "success": True,
            "message": "Informations mises à jour avec succès",
            "user": {
                "id": updated_user['id'],
                "name": updated_user.get('name'),
                "email": updated_user.get('email'),
                "phone": updated_user.get('phone'),
                "role": updated_user.get('role'),
                "store_id": updated_user.get('store_id'),
                "status": updated_user.get('status')
            }
        }

    except AppException:
        raise
    except (AppException,):
        raise


# ===== INVITATION ROUTES =====

@router.post("/invitations")
async def send_invitation(
    invitation_data: Dict,
    current_user: Dict = Depends(get_current_gerant),
    gerant_service: GerantService = Depends(get_gerant_service)
):
    """
    Send an invitation to a new manager or seller.

    Args:
        invitation_data: {
            "name": "John Doe",
            "email": "john@example.com",
            "role": "manager" | "seller",
            "store_id": "store_uuid"
        }
    """
    try:
        result = await gerant_service.send_invitation(
            invitation_data, current_user['id']
        )
        return result
    except ValueError as e:
        raise ValidationError(str(e))


@router.get("/invitations")
async def get_invitations(
    current_user: Dict = Depends(get_current_gerant),
    gerant_service: GerantService = Depends(get_gerant_service)
):
    """Get all invitations sent by this gérant"""
    try:
        return await gerant_service.get_invitations(current_user['id'])
    except ValueError as e:
        raise NotFoundError(str(e))
    except Exception as e:
        raise AppException(detail=str(e), status_code=500)


@router.delete("/invitations/{invitation_id}")
async def cancel_invitation(
    invitation_id: str,
    current_user: Dict = Depends(get_current_gerant),
    gerant_service: GerantService = Depends(get_gerant_service)
):
    """Cancel a pending invitation"""
    try:
        return await gerant_service.cancel_invitation(invitation_id, current_user['id'])
    except ValueError as e:
        raise NotFoundError(str(e))


@router.post("/invitations/{invitation_id}/resend")
async def resend_invitation(
    invitation_id: str,
    current_user: Dict = Depends(get_current_gerant),
    gerant_service: GerantService = Depends(get_gerant_service)
):
    """Resend an invitation email"""
    try:
        return await gerant_service.resend_invitation(invitation_id, current_user['id'])
    except ValueError as e:
        raise ValidationError(str(e))


# ===== MANAGER SUSPEND/REACTIVATE/DELETE ROUTES =====

@router.patch("/managers/{manager_id}/suspend")
async def suspend_manager(
    manager_id: str,
    current_user: Dict = Depends(get_current_gerant),
    gerant_service: GerantService = Depends(get_gerant_service)
):
    """Suspend a manager"""
    try:
        return await gerant_service.suspend_user(manager_id, current_user['id'], 'manager')
    except ValueError as e:
        raise NotFoundError(str(e))


@router.patch("/managers/{manager_id}/reactivate")
async def reactivate_manager(
    manager_id: str,
    current_user: Dict = Depends(get_current_gerant),
    gerant_service: GerantService = Depends(get_gerant_service)
):
    """Reactivate a suspended manager"""
    try:
        return await gerant_service.reactivate_user(manager_id, current_user['id'], 'manager')
    except ValueError as e:
        raise NotFoundError(str(e))


@router.delete("/managers/{manager_id}")
async def delete_manager(
    manager_id: str,
    current_user: Dict = Depends(get_current_gerant),
    gerant_service: GerantService = Depends(get_gerant_service)
):
    """Soft delete a manager (set status to 'deleted')"""
    try:
        return await gerant_service.delete_user(manager_id, current_user['id'], 'manager')
    except ValueError as e:
        raise NotFoundError(str(e))


# ===== SELLER SUSPEND/REACTIVATE/DELETE ROUTES =====

@router.patch("/sellers/{seller_id}/suspend")
async def suspend_seller(
    seller_id: str,
    current_user: Dict = Depends(get_current_gerant),
    gerant_service: GerantService = Depends(get_gerant_service)
):
    """Suspend a seller"""
    try:
        return await gerant_service.suspend_user(seller_id, current_user['id'], 'seller')
    except ValueError as e:
        raise NotFoundError(str(e))


@router.patch("/sellers/{seller_id}/reactivate")
async def reactivate_seller(
    seller_id: str,
    current_user: Dict = Depends(get_current_gerant),
    gerant_service: GerantService = Depends(get_gerant_service)
):
    """Reactivate a suspended seller"""
    try:
        return await gerant_service.reactivate_user(seller_id, current_user['id'], 'seller')
    except ValueError as e:
        raise NotFoundError(str(e))


@router.delete("/sellers/{seller_id}")
async def delete_seller(
    seller_id: str,
    current_user: Dict = Depends(get_current_gerant),
    gerant_service: GerantService = Depends(get_gerant_service)
):
    """Soft delete a seller (set status to 'deleted')"""
    try:
        return await gerant_service.delete_user(seller_id, current_user['id'], 'seller')
    except ValueError as e:
        raise NotFoundError(str(e))


@router.get("/sellers/{seller_id}/passport")
async def get_seller_passport(
    seller_id: str,
    current_user: Dict = Depends(get_current_gerant),
    gerant_service: GerantService = Depends(get_gerant_service),
):
    """
    Passeport vendeur cross-magasin : historique de transferts et métriques KPI par magasin.
    Les KPI historiques ne sont pas réattribués au magasin actuel — chaque donnée reste liée au magasin où elle a été produite.
    """
    try:
        return await gerant_service.get_seller_passport(seller_id, current_user["id"])
    except ValueError as e:
        raise NotFoundError(str(e))
