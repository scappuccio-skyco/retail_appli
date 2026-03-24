"""
Authentication Service
Handles user login, registration, password reset.
All dependencies injected via __init__ (no self.db).
"""
from typing import Optional, Dict
from datetime import datetime, timezone, timedelta
from uuid import uuid4
import secrets
import logging
import re

from core.security import (
    get_password_hash,
    verify_password,
    create_token
)
from repositories.user_repository import UserRepository
from repositories.store_repository import WorkspaceRepository
from repositories.gerant_invitation_repository import GerantInvitationRepository
from repositories.invitation_repository import InvitationRepository
from repositories.password_reset_repository import PasswordResetRepository
from repositories.subscription_repository import SubscriptionRepository
from core.exceptions import UnauthorizedError, ValidationError, ConflictError

logger = logging.getLogger(__name__)


class AuthService:
    """Service for authentication operations. All repos injected via __init__."""

    def __init__(
        self,
        user_repo: UserRepository,
        workspace_repo: WorkspaceRepository,
        gerant_invitation_repo: GerantInvitationRepository,
        invitation_repo: InvitationRepository,
        password_reset_repo: PasswordResetRepository,
        subscription_repo: Optional[SubscriptionRepository] = None,
    ):
        self.user_repo = user_repo
        self.workspace_repo = workspace_repo
        self.gerant_invitation_repo = gerant_invitation_repo
        self.invitation_repo = invitation_repo
        self.password_reset_repo = password_reset_repo
        self.subscription_repo = subscription_repo

    @staticmethod
    def _normalize_email(email: str) -> str:
        """Normalize email for comparisons/auth.

        Treat email as case-insensitive for login. We keep stored casing as-is,
        but always compare using a normalized (trimmed, lowercased) form.
        """
        return (email or "").strip().lower()

    async def login(self, email: str, password: str) -> Dict:
        """
        Authenticate user and return token
        
        Args:
            email: User email
            password: Plain text password
            
        Returns:
            Dict with token and user info
            
        Raises:
            Exception: If credentials invalid
        """
        # Find user (email is case-insensitive for login)
        email_raw = (email or "").strip()
        user = await self.user_repo.find_one(
            {"email": {"$regex": f"^{re.escape(email_raw)}$", "$options": "i"}},
            {"_id": 0}
        )
        
        if not user:
            raise UnauthorizedError("Identifiants invalides")
        
        # Verify password
        if not verify_password(password, user['password']):
            raise UnauthorizedError("Identifiants invalides")
        
        # Generate token
        token = create_token(user['id'], self._normalize_email(user['email']), user['role'])
        
        # Remove password from response
        user_data = {k: v for k, v in user.items() if k != 'password'}
        
        # === HÉRITAGE DU STATUT D'ABONNEMENT DU GÉRANT PARENT ===
        # Pour les vendeurs et managers, récupérer le statut de l'abonnement du gérant
        parent_subscription_status = None
        is_read_only = False
        
        if user.get('role') in ['seller', 'manager']:
            gerant_id = user.get('gerant_id')
            if gerant_id:
                parent_sub = await self._get_parent_subscription_status(gerant_id)
                parent_subscription_status = parent_sub.get('status')
                is_read_only = parent_sub.get('is_read_only', False)
        
        response = {
            "token": token,
            "user": user_data
        }
        
        # Ajouter le statut parent si applicable
        if parent_subscription_status:
            response["parent_subscription_status"] = parent_subscription_status
            response["is_read_only"] = is_read_only
        
        return response
    
    async def _get_parent_subscription_status(self, gerant_id: str) -> Dict:
        """
        Récupère le statut de l'abonnement du gérant parent.
        
        Returns:
            Dict avec status et is_read_only
        """
        # Récupérer le gérant
        gerant = await self.user_repo.find_one(
            {"id": gerant_id},
            {"_id": 0}
        )
        
        if not gerant:
            return {"status": "unknown", "is_read_only": True}
        
        workspace_id = gerant.get('workspace_id')
        if not workspace_id:
            return {"status": "no_workspace", "is_read_only": True}
        workspace = await self.workspace_repo.find_by_id(workspace_id)
        if not workspace:
            return {"status": "workspace_not_found", "is_read_only": True}
        
        subscription_status = workspace.get('subscription_status', 'inactive')
        
        # Abonnement actif = accès complet
        if subscription_status == 'active':
            return {"status": "active", "is_read_only": False}
        
        # Essai en cours = vérifier la date
        if subscription_status == 'trialing':
            trial_end = workspace.get('trial_end')
            if trial_end:
                if isinstance(trial_end, str):
                    trial_end_dt = datetime.fromisoformat(trial_end.replace('Z', '+00:00'))
                else:
                    trial_end_dt = trial_end
                
                # Gérer les dates naive vs aware
                now = datetime.now(timezone.utc)
                if trial_end_dt.tzinfo is None:
                    # trial_end_dt est naive, on le convertit en UTC
                    trial_end_dt = trial_end_dt.replace(tzinfo=timezone.utc)
                
                if now <= trial_end_dt:
                    return {"status": "trialing", "is_read_only": False}
        
        # Tous les autres cas = lecture seule
        return {"status": subscription_status or "expired", "is_read_only": True}
    
    async def register_gerant(
        self,
        name: str,
        email: str,
        password: str,
        company_name: str,
        phone: Optional[str] = None,
        cgu_accepted_at: Optional[datetime] = None
    ) -> Dict:
        """
        Register a new gérant with workspace
        
        Args:
            name: Gérant name
            email: Gérant email
            password: Plain text password
            company_name: Company/workspace name
            phone: Optional phone number
            
        Returns:
            Dict with token and user info
            
        Raises:
            Exception: If email already exists
        """
        email = self._normalize_email(email)

        # Check if email exists
        if await self.user_repo.email_exists(email):
            raise ConflictError("Cet email est déjà utilisé")
        
        # Create gérant user
        gerant_id = str(uuid4())
        workspace_id = str(uuid4())  # Generate workspace ID first
        now = datetime.now(timezone.utc)
        trial_end = now + timedelta(days=14)  # 14 jours d'essai gratuit
        
        from config.limits import CGU_CURRENT_VERSION
        user = {
            "id": gerant_id,
            "name": name,
            "email": email,
            "password": get_password_hash(password),
            "role": "gerant",  # Important: no accent!
            "phone": phone,
            "workspace_id": workspace_id,  # Link workspace to user
            "created_at": now,
            "status": "active",
            "cgu_accepted_at": cgu_accepted_at or now,
            "cgu_version": CGU_CURRENT_VERSION,
        }
        
        await self.user_repo.insert_one(user)
        
        # Create workspace for gérant with 14-day trial
        workspace = {
            "id": workspace_id,
            "name": company_name,
            "gerant_id": gerant_id,
            "created_at": now,
            "subscription_status": "trialing",  # Période d'essai
            "trial_start": now,
            "trial_end": trial_end,
            "ai_credits_remaining": 100,  # Crédits IA pour l'essai
            "settings": {
                "max_users": 15,  # Limite pendant l'essai
                "features": ["basic", "ai_coaching", "diagnostics"]
            }
        }
        
        await self.workspace_repo.insert_one(workspace)
        
        # Generate token
        token = create_token(gerant_id, email, "gerant")
        
        # Clean response - remove _id and password, convert datetime
        user_clean = {k: (v.isoformat() if isinstance(v, datetime) else v) 
                      for k, v in user.items() if k not in ['password', '_id']}
        workspace_clean = {k: (v.isoformat() if isinstance(v, datetime) else v) 
                          for k, v in workspace.items() if k != '_id'}
        
        return {
            "token": token,
            "user": user_clean,
            "workspace": workspace_clean
        }
    
    async def register_with_invitation(
        self,
        email: str,
        password: str,
        name: str,
        invitation_token: str,
        cgu_accepted_at: Optional[datetime] = None
    ) -> Dict:
        """
        Register user with invitation token
        
        Args:
            email: User email
            password: Plain text password
            name: User name
            invitation_token: Invitation token
            
        Returns:
            Dict with token and user info
            
        Raises:
            Exception: If invitation invalid or expired
        """
        email = self._normalize_email(email)

        # Find invitation in gerant_invitations first
        invitation = await self.gerant_invitation_repo.find_by_token(invitation_token, projection={"_id": 0})
        invitation_collection = "gerant_invitations"
        
        # Fallback to old invitations collection
        if not invitation:
            invitation = await self.invitation_repo.find_by_token(invitation_token, projection={"_id": 0})
            invitation_collection = "invitations"
        
        if not invitation:
            raise ValidationError("Invitation invalide ou expirée")
        if invitation.get("status") != "pending":
            raise ValidationError("Cette invitation a déjà été utilisée")
        if self._normalize_email(invitation.get("email", "")) != email:
            raise ValidationError("L'email ne correspond pas à l'invitation")
        
        # Create user
        user_id = str(uuid4())
        now_inv = datetime.now(timezone.utc)
        from config.limits import CGU_CURRENT_VERSION
        user = {
            "id": user_id,
            "name": name,
            "email": email,
            "password": get_password_hash(password),
            "role": invitation['role'],
            "gerant_id": invitation.get('gerant_id'),
            "store_id": invitation.get('store_id'),
            "manager_id": invitation.get('manager_id'),
            "created_at": now_inv.isoformat(),
            "status": "active",
            "cgu_accepted_at": (cgu_accepted_at or now_inv).isoformat(),
            "cgu_version": CGU_CURRENT_VERSION,
        }
        
        await self.user_repo.insert_one(user)
        
        # Remove MongoDB _id if present (added by insert_one)
        user.pop('_id', None)
        
        if invitation['role'] == 'manager' and user.get('store_id'):
            modified = await self.user_repo.update_many(
                {
                    "role": "seller",
                    "store_id": user.get('store_id'),
                    "$or": [
                        {"manager_id": None},
                        {"manager_id": {"$exists": False}}
                    ],
                    "status": {"$ne": "deleted"}
                },
                {"$set": {"manager_id": user_id, "updated_at": datetime.now(timezone.utc).isoformat()}}
            )
            if modified > 0:
                import logging
                logger = logging.getLogger(__name__)
                logger.info(f"Auto-assigned {modified} orphan seller(s) to new manager {email}")
        
        # Mark invitation as used in the correct collection
        update_data = {"status": "accepted", "used_at": datetime.now(timezone.utc).isoformat()}
        if invitation_collection == "gerant_invitations":
            await self.gerant_invitation_repo.update_by_token(invitation_token, update_data)
        else:
            await self.invitation_repo.update_by_token(invitation_token, update_data)
        
        # Generate token
        token = create_token(user_id, email, invitation['role'])
        
        return {
            "token": token,
            "user": {k: v for k, v in user.items() if k != "password"},
        }

    async def get_invitation_by_token(self, token: str) -> Optional[Dict]:
        """
        Get invitation by token (gerant_invitations then invitations). Used by legacy routes.
        Returns raw invitation dict or None if not found.
        """
        invitation = await self.gerant_invitation_repo.find_by_token(
            token, projection={"_id": 0}
        )
        if not invitation:
            invitation = await self.invitation_repo.find_by_token(
                token, projection={"_id": 0}
            )
        return invitation

    async def verify_invitation_for_display(self, token: str) -> Dict:
        """
        Verify invitation token and return display payload for legacy verify endpoint.
        Raises NotFoundError or ValidationError if invalid.
        """
        invitation = await self.get_invitation_by_token(token)
        if not invitation:
            raise UnauthorizedError("Invitation non trouvée ou expirée")
        if invitation.get("status") == "accepted":
            raise ValidationError("Cette invitation a déjà été utilisée")
        if invitation.get("status") == "expired":
            raise ValidationError("Cette invitation a expiré")
        return {
            "valid": True,
            "email": invitation.get("email"),
            "role": invitation.get("role", "seller"),
            "store_name": invitation.get("store_name"),
            "gerant_name": invitation.get("gerant_name"),
            "manager_name": invitation.get("manager_name"),
            "name": invitation.get("name", ""),
            "gerant_id": invitation.get("gerant_id"),
            "store_id": invitation.get("store_id"),
            "manager_id": invitation.get("manager_id"),
        }

    async def request_password_reset(self, email: str) -> str:
        """
        Generate password reset token and send email
        
        Args:
            email: User email
            
        Returns:
            Reset token
            
        Raises:
            Exception: If user not found
        """
        user = await self.user_repo.find_by_email(email)
        if not user:
            # Don't reveal if email exists for security
            return "token_sent"
        
        # Generate reset token
        reset_token = secrets.token_urlsafe(32)
        
        now_utc = datetime.now(timezone.utc)
        expires_at_utc = now_utc + timedelta(minutes=15)
        await self.password_reset_repo.create_reset(
            email=email,
            token=reset_token,
            created_at=now_utc.isoformat(),
            expires_at=expires_at_utc.isoformat(),
        )
        
        # CRITICAL: Send password reset email
        logger.info(f"🔄 Début de l'envoi de l'email de réinitialisation pour {email}")
        try:
            from email_service import send_password_reset_email
            recipient_name = user.get('name', 'Utilisateur')
            logger.debug(f"   - Nom du destinataire: {recipient_name}")
            logger.debug(f"   - Token généré: {reset_token[:10]}...")
            
            email_sent = send_password_reset_email(email, recipient_name, reset_token)
            if not email_sent:
                logger.error(f"❌ ÉCHEC: L'envoi de l'email de réinitialisation à {email} a retourné False")
                logger.error(f"   - Vérifiez les logs Brevo ci-dessus pour plus de détails")
                logger.error(f"   - Vérifiez que BREVO_API_KEY est configurée dans les variables d'environnement")
            else:
                logger.info(f"✅ SUCCÈS: Email de réinitialisation envoyé avec succès à {email}")
        except Exception as e:
            # Log error but don't fail the request (security: don't reveal if email exists)
            logger.error(f"❌ EXCEPTION lors de l'envoi de l'email de réinitialisation à {email}: {str(e)}", exc_info=True)
        
        return reset_token
    
    async def reset_password(self, token: str, new_password: str) -> bool:
        """
        Reset password with token
        
        Args:
            token: Reset token
            new_password: New password (plain text)
            
        Returns:
            True if successful
            
        Raises:
            Exception: If token invalid or expired
        """
        # Find reset token
        reset = await self.password_reset_repo.find_by_token(token)
        
        if not reset:
            raise Exception("Token invalide ou expiré")
        
        # Check expiration (CRITICAL: Compare datetime objects, not timestamps)
        now_utc = datetime.now(timezone.utc)
        expires_at = datetime.fromisoformat(reset['expires_at'])
        
        if now_utc > expires_at:
            raise Exception("Token expiré")
        
        # Update password
        hashed_password = get_password_hash(new_password)
        await self.user_repo.update_one(
            {"email": reset['email']},
            {"$set": {"password": hashed_password}}
        )
        # Invalidation cache (contexte métier : user modifié)
        from core.cache import invalidate_user_cache
        user = await self.user_repo.find_one({"email": reset['email']}, {"id": 1})
        if user and user.get("id"):
            await invalidate_user_cache(str(user["id"]))
        
        await self.password_reset_repo.delete_by_token(token)
        return True

    async def verify_invitation_token(self, token: str) -> Dict:
        """
        Verify invitation token and return invitation details (Phase 10: no db in auth routes).
        Raises Exception if invalid/expired/already used.
        """
        invitation = await self.gerant_invitation_repo.find_by_token(token, projection={"_id": 0})
        if not invitation:
            invitation = await self.invitation_repo.find_by_token(token, projection={"_id": 0})
        if not invitation:
            raise ValueError("Invitation non trouvée ou expirée")
        if invitation.get("status") == "accepted":
            raise ValueError("Cette invitation a déjà été utilisée")
        if invitation.get("status") == "expired":
            raise ValueError("Cette invitation a expiré")
        return {
            "valid": True,
            "email": invitation.get("email"),
            "role": invitation.get("role", "seller"),
            "store_name": invitation.get("store_name"),
            "gerant_name": invitation.get("gerant_name"),
            "manager_name": invitation.get("manager_name"),
            "name": invitation.get("name", ""),
            "gerant_id": invitation.get("gerant_id"),
            "store_id": invitation.get("store_id"),
            "manager_id": invitation.get("manager_id"),
        }

    async def verify_reset_token(self, token: str) -> Dict:
        """
        Verify reset password token (Phase 10: no db in auth routes).
        Returns dict with valid and email if valid. Uses password_resets collection internally.
        """
        reset_entry = await self.password_reset_repo.find_by_token(token)
        if not reset_entry:
            raise ValueError("Lien invalide ou expiré")
        created_at = reset_entry.get("created_at")
        if created_at:
            if isinstance(created_at, str):
                try:
                    from dateutil import parser
                    created_at = parser.parse(created_at)
                except Exception:
                    created_at = None
            if created_at:
                now = datetime.now(timezone.utc)
                if getattr(created_at, "tzinfo", None) is None:
                    created_at = created_at.replace(tzinfo=timezone.utc)
                age_seconds = (now - created_at).total_seconds()
                if age_seconds > 600:
                    raise ValueError("Ce lien a expiré. Veuillez demander un nouveau lien.")
        if reset_entry.get("used"):
            raise ValueError("Ce lien a déjà été utilisé")
        return {"valid": True, "email": reset_entry.get("email", "")}

    async def delete_own_account(self, current_user: Dict) -> Dict:
        """
        RGPD — Droit à l'effacement : suppression du compte par l'utilisateur lui-même.

        - Soft delete + anonymisation email pour tous les rôles
        - Pour gérant : annulation de l'abonnement Stripe (cancel_at_period_end) + workspace désactivé
        """
        user_id = current_user["id"]
        role = current_user.get("role", "")
        now = datetime.now(timezone.utc)

        anonymized_email = f"deleted+{user_id}@example.invalid"

        await self.user_repo.update_one(
            {"id": user_id},
            {"$set": {
                "status": "deleted",
                "email": anonymized_email,
                "deleted_at": now.isoformat(),
                "deleted_by": user_id,
                "updated_at": now.isoformat(),
            }}
        )

        from core.cache import invalidate_user_cache
        await invalidate_user_cache(user_id)

        # Pour le gérant : annuler l'abonnement Stripe + désactiver le workspace
        if role == "gerant" and self.subscription_repo:
            try:
                subscription = await self.subscription_repo.find_by_user(user_id)
                if subscription:
                    stripe_sub_id = subscription.get("stripe_subscription_id")
                    if stripe_sub_id:
                        import stripe
                        stripe.Subscription.modify(stripe_sub_id, cancel_at_period_end=True)
                    await self.subscription_repo.update_by_user(
                        user_id,
                        {"subscription_status": "canceled", "updated_at": now.isoformat()}
                    )
            except Exception as e:
                logger.warning("Impossible d'annuler l'abonnement Stripe pour %s : %s", user_id, e)

            # Désactiver le workspace
            try:
                workspace_id = current_user.get("workspace_id")
                if workspace_id:
                    await self.workspace_repo.update_one(
                        {"id": workspace_id},
                        {"$set": {"status": "deleted", "deleted_at": now.isoformat()}}
                    )
            except Exception as e:
                logger.warning("Impossible de désactiver le workspace pour %s : %s", user_id, e)

        return {"message": "Votre compte a été supprimé conformément au RGPD."}

    async def get_me_enriched(self, current_user: Dict) -> Dict:
        """Add manager_name to current_user if seller (Phase 10: no db in auth routes)."""
        if current_user.get("role") == "seller" and current_user.get("manager_id"):
            try:
                manager = await self.user_repo.find_one(
                    {"id": current_user["manager_id"]},
                    projection={"_id": 0, "name": 1},
                )
                if manager and manager.get("name"):
                    current_user = {**current_user, "manager_name": manager["name"]}
            except Exception:
                pass
        return current_user
