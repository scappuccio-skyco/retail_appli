"""
Authentication Service
Handles user login, registration, password reset
"""
from typing import Optional, Dict
from datetime import datetime, timezone, timedelta
from uuid import uuid4
import secrets
import logging

from core.security import (
    get_password_hash, 
    verify_password, 
    create_token
)
from repositories.user_repository import UserRepository
from repositories.store_repository import WorkspaceRepository
from exceptions.custom_exceptions import UnauthorizedError, ValidationError

logger = logging.getLogger(__name__)


class AuthService:
    """Service for authentication operations"""
    
    def __init__(self, db):
        self.user_repo = UserRepository(db)
        self.workspace_repo = WorkspaceRepository(db)
        self.db = db
    
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
        # Find user
        user = await self.user_repo.find_one(
            {"email": email},
            {"_id": 0}
        )
        
        if not user:
            raise UnauthorizedError("Identifiants invalides")
        
        # Verify password
        if not verify_password(password, user['password']):
            raise UnauthorizedError("Identifiants invalides")
        
        # Generate token
        token = create_token(user['id'], user['email'], user['role'])
        
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
        
        workspace = await self.db.workspaces.find_one(
            {"id": workspace_id},
            {"_id": 0}
        )
        
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
        phone: Optional[str] = None
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
        # Check if email exists
        if await self.user_repo.email_exists(email):
            raise Exception("Cet email est déjà utilisé")
        
        # Create gérant user
        gerant_id = str(uuid4())
        workspace_id = str(uuid4())  # Generate workspace ID first
        now = datetime.now(timezone.utc)
        trial_end = now + timedelta(days=14)  # 14 jours d'essai gratuit
        
        user = {
            "id": gerant_id,
            "name": name,
            "email": email,
            "password": get_password_hash(password),
            "role": "gerant",  # Important: no accent!
            "phone": phone,
            "workspace_id": workspace_id,  # Link workspace to user
            "created_at": now,
            "status": "active"
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
        invitation_token: str
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
        # Find invitation in gerant_invitations first
        invitation = await self.db.gerant_invitations.find_one(
            {"token": invitation_token},
            {"_id": 0}
        )
        invitation_collection = "gerant_invitations"
        
        # Fallback to old invitations collection
        if not invitation:
            invitation = await self.db.invitations.find_one(
                {"token": invitation_token},
                {"_id": 0}
            )
            invitation_collection = "invitations"
        
        if not invitation:
            raise Exception("Invitation invalide ou expirée")
        
        if invitation.get('status') != 'pending':
            raise Exception("Cette invitation a déjà été utilisée")
        
        # Verify email matches
        if invitation['email'] != email:
            raise Exception("L'email ne correspond pas à l'invitation")
        
        # Create user
        user_id = str(uuid4())
        user = {
            "id": user_id,
            "name": name,
            "email": email,
            "password": get_password_hash(password),
            "role": invitation['role'],
            "gerant_id": invitation.get('gerant_id'),
            "store_id": invitation.get('store_id'),
            "manager_id": invitation.get('manager_id'),
            "created_at": datetime.now(timezone.utc).isoformat(),
            "status": "active"
        }
        
        await self.user_repo.insert_one(user)
        
        # Remove MongoDB _id if present (added by insert_one)
        user.pop('_id', None)
        
        # If this is a manager, automatically reassign orphan sellers (without manager_id) in the same store
        if invitation['role'] == 'manager' and user.get('store_id'):
            from datetime import datetime, timezone
            orphan_sellers_result = await self.db.users.update_many(
                {
                    "role": "seller",
                    "store_id": user.get('store_id'),
                    "$or": [
                        {"manager_id": None},
                        {"manager_id": {"$exists": False}}
                    ],
                    "status": {"$ne": "deleted"}
                },
                {
                    "$set": {
                        "manager_id": user_id,
                        "updated_at": datetime.now(timezone.utc).isoformat()
                    }
                }
            )
            if orphan_sellers_result.modified_count > 0:
                import logging
                logger = logging.getLogger(__name__)
                logger.info(f"Auto-assigned {orphan_sellers_result.modified_count} orphan seller(s) to new manager {email}")
        
        # Mark invitation as used in the correct collection
        collection = self.db.gerant_invitations if invitation_collection == "gerant_invitations" else self.db.invitations
        await collection.update_one(
            {"token": invitation_token},
            {"$set": {"status": "accepted", "used_at": datetime.now(timezone.utc).isoformat()}}
        )
        
        # Generate token
        token = create_token(user_id, email, invitation['role'])
        
        return {
            "token": token,
            "user": {k: v for k, v in user.items() if k != 'password'}
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
        
        # Save token to database (CRITICAL: All dates in UTC ISO format for consistency)
        now_utc = datetime.now(timezone.utc)
        expires_at_utc = now_utc + timedelta(minutes=15)  # 15 minutes expiration for security
        
        await self.db.password_resets.insert_one({
            "email": email,
            "token": reset_token,
            "created_at": now_utc.isoformat(),
            "expires_at": expires_at_utc.isoformat()  # 15 minutes from now
        })
        
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
        reset = await self.db.password_resets.find_one(
            {"token": token},
            {"_id": 0}
        )
        
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
        
        # Delete used token
        await self.db.password_resets.delete_one({"token": token})
        
        return True
