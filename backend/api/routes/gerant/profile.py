"""
Gérant profile routes: ping, api-keys, transfers, profile management.
"""
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from datetime import datetime, timezone
from typing import Dict

import stripe

from core.constants import ERR_UTILISATEUR_NON_TROUVE
from core.exceptions import AppException, NotFoundError, ValidationError, ForbiddenError, UnauthorizedError
from core.security import get_current_gerant
from services.gerant_service import GerantService
from services.manager_service import APIKeyService
from api.dependencies import get_gerant_service, get_api_key_service
from middleware.log_sanitizer import neutralize_for_log
from email_service import send_staff_email_update_confirmation, send_staff_email_update_alert
from fastapi import BackgroundTasks
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="", tags=["Gérant"])


@router.get("/ping")
async def gerant_ping():
    """Vérification que le routeur gerant est bien monté (GET /api/gerant/ping)."""
    return {"ok": True, "message": "gerant router loaded"}


# ===== API KEYS (gérant = propriétaire des clés pour intégrations caisse/ERP) =====

@router.get("/api-keys")
async def gerant_list_api_keys(
    current_user: Dict = Depends(get_current_gerant),
    api_key_service: APIKeyService = Depends(get_api_key_service),
):
    """Liste des clés API du gérant (pour intégrations externes)."""
    return await api_key_service.list_api_keys(current_user["id"])


@router.post("/api-keys")
async def gerant_create_api_key(
    key_data: Dict,
    current_user: Dict = Depends(get_current_gerant),
    api_key_service: APIKeyService = Depends(get_api_key_service),
):
    """Créer une clé API pour le gérant (caisse, ERP, etc.)."""
    return await api_key_service.create_api_key(
        user_id=current_user["id"],
        store_id=None,
        gerant_id=current_user["id"],
        name=key_data.get("name", "API Key"),
        permissions=key_data.get("permissions", ["write:kpi", "read:stats", "stores:read", "stores:write", "users:write"]),
        store_ids=key_data.get("store_ids"),
        expires_days=key_data.get("expires_days"),
    )


@router.delete("/api-keys/{key_id}")
async def gerant_deactivate_api_key(
    key_id: str,
    current_user: Dict = Depends(get_current_gerant),
    api_key_service: APIKeyService = Depends(get_api_key_service),
):
    """Désactiver une clé API (gérant propriétaire)."""
    try:
        return await api_key_service.deactivate_api_key(key_id, current_user["id"])
    except ValueError as e:
        raise NotFoundError(str(e))


@router.patch("/api-keys/{key_id}/reactivate")
async def gerant_reactivate_api_key(
    key_id: str,
    current_user: Dict = Depends(get_current_gerant),
    api_key_service: APIKeyService = Depends(get_api_key_service),
):
    """Réactiver une clé API désactivée (gérant propriétaire)."""
    try:
        return await api_key_service.reactivate_api_key(key_id, current_user["id"])
    except ValueError as e:
        raise NotFoundError(str(e))


@router.post("/api-keys/{key_id}/regenerate")
async def gerant_regenerate_api_key(
    key_id: str,
    current_user: Dict = Depends(get_current_gerant),
    api_key_service: APIKeyService = Depends(get_api_key_service),
):
    """Régénérer une clé API (gérant propriétaire)."""
    try:
        return await api_key_service.regenerate_api_key(key_id, current_user["id"])
    except ValueError as e:
        raise NotFoundError(str(e))
    except Exception as e:
        raise ValidationError(str(e))


@router.delete("/api-keys/{key_id}/permanent")
async def gerant_delete_api_key_permanent(
    key_id: str,
    current_user: Dict = Depends(get_current_gerant),
    api_key_service: APIKeyService = Depends(get_api_key_service),
):
    """Supprimer définitivement une clé API désactivée (gérant propriétaire)."""
    try:
        return await api_key_service.delete_api_key_permanent(key_id, current_user["id"], current_user.get("role", "gerant"))
    except ValueError as e:
        raise ValidationError(str(e))
    except PermissionError as e:
        raise ForbiddenError(str(e))


# ===== TRANSFER ROUTES (en tête pour priorité sur /sellers/{id} et /managers/{id}) =====
# Chemins stricts: POST /managers/{manager_id}/transfer et POST /sellers/{seller_id}/transfer (sans slash final)


class ManagerTransferRequest(BaseModel):
    """Body for POST /managers/{manager_id}/transfer. Frontend sends new_store_id."""
    new_store_id: str


class SellerTransferRequest(BaseModel):
    """Body for POST /sellers/{seller_id}/transfer. Frontend sends new_store_id and new_manager_id."""
    new_store_id: str
    new_manager_id: str


@router.post("/managers/{manager_id}/transfer")
async def transfer_manager_to_store(
    manager_id: str,
    body: ManagerTransferRequest,
    current_user: Dict = Depends(get_current_gerant),
    gerant_service: GerantService = Depends(get_gerant_service)
):
    """
    Transfer a manager to another store.
    Body: { "new_store_id": "store_uuid" } (aligné avec le frontend).
    """
    return await gerant_service.transfer_manager_to_store(
        manager_id, body.model_dump(), current_user['id']
    )


@router.post("/sellers/{seller_id}/transfer")
async def transfer_seller_to_store(
    seller_id: str,
    body: SellerTransferRequest,
    current_user: Dict = Depends(get_current_gerant),
    gerant_service: GerantService = Depends(get_gerant_service)
):
    """
    Transfer a seller to another store with a new manager.
    Body: { "new_store_id": "store_uuid", "new_manager_id": "manager_uuid" } (aligné avec le frontend).
    """
    logger.debug("---> ATTEMPTING TRANSFER FOR SELLER: %s", seller_id)
    return await gerant_service.transfer_seller_to_store(
        seller_id, body.model_dump(), current_user['id']
    )


@router.get("/profile")
async def get_gerant_profile(
    current_user: dict = Depends(get_current_gerant),
    gerant_service: GerantService = Depends(get_gerant_service),
):
    """
    Get gérant profile information (name, email, phone, company_name).
    """
    gerant_id = current_user["id"]
    user = await gerant_service.get_gerant_by_id(gerant_id, include_password=False)
    if not user:
        raise NotFoundError(ERR_UTILISATEUR_NON_TROUVE)
    workspace_id = user.get("workspace_id")
    company_name = None
    if workspace_id:
        workspace = await gerant_service.get_workspace_by_id(workspace_id)
        if workspace:
            company_name = workspace.get("name")
    return {
        "id": user.get("id"),
        "name": user.get("name"),
        "email": user.get("email"),
        "phone": user.get("phone"),
        "company_name": company_name,
        "created_at": user.get("created_at")
    }


@router.put("/profile")
async def update_gerant_profile(
    update_data: Dict,
    current_user: dict = Depends(get_current_gerant),
    gerant_service: GerantService = Depends(get_gerant_service),
):
    """
    Update gérant profile information.
    Allowed fields: name, email, phone, company_name
    """
    try:
        gerant_id = current_user["id"]
        user = await gerant_service.get_gerant_by_id(gerant_id, include_password=True)
        if not user:
            raise NotFoundError(ERR_UTILISATEUR_NON_TROUVE)
        ALLOWED_USER_FIELDS = ["name", "email", "phone"]
        user_updates = {}
        company_name_update = None
        for field in ALLOWED_USER_FIELDS:
            if field in update_data and update_data[field] is not None:
                user_updates[field] = update_data[field]
        if "company_name" in update_data and update_data["company_name"] is not None:
            company_name_update = update_data["company_name"].strip()
            if not company_name_update:
                raise ValidationError("Le nom de l'entreprise ne peut pas être vide")
        old_email = user.get("email", "").lower().strip() if user.get("email") else None
        email_changed = False
        if "email" in user_updates:
            import re
            email_pattern = r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"
            if not re.match(email_pattern, user_updates["email"]):
                raise ValidationError("Format d'email invalide")
            email_lower = user_updates["email"].lower().strip()
            if old_email and old_email != email_lower:
                email_changed = True
            user_updates["email"] = email_lower
            existing_user = await gerant_service.find_user_by_email(email_lower)
            if existing_user and existing_user.get("id") != gerant_id:
                raise ValidationError("Cet email est déjà utilisé par un autre utilisateur")
        if user_updates:
            user_updates["updated_at"] = datetime.now(timezone.utc).isoformat()
            await gerant_service.update_gerant_user_one(gerant_id, user_updates)
        old_company_name = None
        if company_name_update:
            workspace_id = user.get("workspace_id")
            if workspace_id:
                old_workspace = await gerant_service.get_workspace_by_id(workspace_id)
                if old_workspace:
                    old_company_name = old_workspace.get("name")
                await gerant_service.update_workspace_one(
                    workspace_id,
                    {"name": company_name_update, "updated_at": datetime.now(timezone.utc).isoformat()}
                )
                if old_company_name and old_company_name != company_name_update:
                    await gerant_service.log_company_name_change(
                        old_company_name, company_name_update, workspace_id
                    )
                    logger.info("Audit log: Company name changed from '%s' to '%s' by gérant %s", old_company_name, company_name_update, gerant_id)
            else:
                logger.warning("Gérant %s has no workspace_id, cannot update company_name", gerant_id)
        updated_user = await gerant_service.get_gerant_by_id(gerant_id, include_password=False)
        workspace_id = updated_user.get("workspace_id") if updated_user else None
        company_name = None
        if workspace_id:
            workspace = await gerant_service.get_workspace_by_id(workspace_id)
            if workspace:
                company_name = workspace.get("name")

        # Update Stripe customer email if email changed and customer exists
        if email_changed and old_email:
            stripe_customer_id = user.get('stripe_customer_id')
            if stripe_customer_id:
                try:
                    stripe.Customer.modify(
                        stripe_customer_id,
                        email=user_updates['email']
                    )
                    logger.info(f"Stripe customer {stripe_customer_id} email updated to {user_updates['email']}")
                except stripe.InvalidRequestError as stripe_error:
                    # Customer might not exist in Stripe, log but don't fail
                    logger.warning(f"Failed to update Stripe customer {stripe_customer_id} email: {str(stripe_error)}")
                except Exception as stripe_error:
                    # Other Stripe errors, log but don't fail the request
                    logger.error(f"Error updating Stripe customer email: {str(stripe_error)}", exc_info=True)

        logger.info("Gérant profile %s updated", gerant_id)

        return {
            "success": True,
            "message": "Profil mis à jour avec succès",
            "profile": {
                "id": updated_user.get('id'),
                "name": updated_user.get('name'),
                "email": updated_user.get('email'),
                "phone": updated_user.get('phone'),
                "company_name": company_name,
                "created_at": updated_user.get('created_at')
            }
        }
    except AppException:
        raise


@router.put("/profile/change-password")
async def change_gerant_password(
    password_data: Dict,
    current_user: dict = Depends(get_current_gerant),
    gerant_service: GerantService = Depends(get_gerant_service),
):
    """
    Change gérant password.

    Requires:
    - old_password: Current password for verification
    - new_password: New password (min 8 characters)

    Returns:
        Success message
    """
    try:
        from core.security import verify_password, get_password_hash

        gerant_id = current_user['id']
        old_password = password_data.get('old_password')
        new_password = password_data.get('new_password')

        if not old_password:
            raise ValidationError("L'ancien mot de passe est requis")

        if not new_password:
            raise ValidationError("Le nouveau mot de passe est requis")

        if len(new_password) < 8:
            raise ValidationError("Le nouveau mot de passe doit contenir au moins 8 caractères")

        user = await gerant_service.get_gerant_by_id(gerant_id, include_password=True)

        if not user:
            raise NotFoundError(ERR_UTILISATEUR_NON_TROUVE)

        # Verify old password
        if not verify_password(old_password, user.get('password', '')):
            raise UnauthorizedError("Ancien mot de passe incorrect")

        # Hash new password
        hashed_password = get_password_hash(new_password)

        # Update password
        await gerant_service.update_gerant_user_one(
            gerant_id,
            {
                "password": hashed_password,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        )

        logger.info("Password changed for gérant %s", gerant_id)

        return {
            "success": True,
            "message": "Mot de passe modifié avec succès"
        }
    except AppException:
        raise
