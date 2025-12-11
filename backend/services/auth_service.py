"""
Authentication Service
Handles user login, registration, password reset
"""
from typing import Optional, Dict
from datetime import datetime, timezone, timedelta
from uuid import uuid4
import secrets

from core.security import (
    get_password_hash, 
    verify_password, 
    create_token
)
from repositories.user_repository import UserRepository
from repositories.store_repository import WorkspaceRepository


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
            raise Exception("Identifiants invalides")
        
        # Verify password
        if not verify_password(password, user['password']):
            raise Exception("Identifiants invalides")
        
        # Generate token
        token = create_token(user['id'], user['email'], user['role'])
        
        # Remove password from response
        user_data = {k: v for k, v in user.items() if k != 'password'}
        
        return {
            "token": token,
            "user": user_data
        }
    
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
        user = {
            "id": gerant_id,
            "name": name,
            "email": email,
            "password": get_password_hash(password),
            "role": "gerant",  # Important: no accent!
            "phone": phone,
            "created_at": datetime.now(timezone.utc),
            "status": "active"
        }
        
        await self.user_repo.insert_one(user)
        
        # Create workspace for gérant
        workspace = {
            "id": str(uuid4()),
            "name": company_name,
            "gerant_id": gerant_id,
            "created_at": datetime.now(timezone.utc),
            "settings": {
                "max_users": 10,
                "features": ["basic"]
            }
        }
        
        await self.workspace_repo.insert_one(workspace)
        
        # Generate token
        token = create_token(gerant_id, email, "gerant")
        
        return {
            "token": token,
            "user": {k: v for k, v in user.items() if k != 'password'},
            "workspace": workspace
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
            "created_at": datetime.now(timezone.utc),
            "status": "active"
        }
        
        await self.user_repo.insert_one(user)
        
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
        expires_at_utc = now_utc + timedelta(hours=1)
        
        await self.db.password_resets.insert_one({
            "email": email,
            "token": reset_token,
            "created_at": now_utc.isoformat(),
            "expires_at": expires_at_utc.isoformat()  # 1 hour from now
        })
        
        # CRITICAL: Send password reset email
        try:
            from email_service import send_password_reset_email
            recipient_name = user.get('name', 'Utilisateur')
            send_password_reset_email(email, recipient_name, reset_token)
        except Exception as e:
            # Log error but don't fail the request
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Failed to send password reset email to {email}: {e}")
        
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
