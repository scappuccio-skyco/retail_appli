"""
Authentication Routes
Login, registration, password reset
"""
from fastapi import APIRouter, Depends, HTTPException

from models.users import (
    UserLogin,
    UserCreate,
    RegisterWithInvite,
    ForgotPasswordRequest,
    ResetPasswordRequest
)
from services.auth_service import AuthService
from api.dependencies import get_auth_service, get_db
from core.security import get_current_user

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.get("/invitations/verify/{token}")
async def verify_invitation_token(
    token: str,
    db = Depends(get_db)
):
    """
    Verify invitation token and return invitation details
    
    Args:
        token: Invitation token from email link
        
    Returns:
        Invitation details if valid
        
    Raises:
        HTTPException 404: Token not found or expired
    """
    # Check in gerant_invitations collection
    invitation = await db.gerant_invitations.find_one(
        {"token": token},
        {"_id": 0}
    )
    
    if not invitation:
        # Try the old invitations collection
        invitation = await db.invitations.find_one(
            {"token": token},
            {"_id": 0}
        )
    
    if not invitation:
        raise HTTPException(status_code=404, detail="Invitation non trouvée ou expirée")
    
    if invitation.get('status') == 'accepted':
        raise HTTPException(status_code=400, detail="Cette invitation a déjà été utilisée")
    
    if invitation.get('status') == 'expired':
        raise HTTPException(status_code=400, detail="Cette invitation a expiré")
    
    return {
        "valid": True,
        "email": invitation.get('email'),
        "role": invitation.get('role', 'seller'),
        "store_name": invitation.get('store_name'),
        "gerant_name": invitation.get('gerant_name'),
        "manager_name": invitation.get('manager_name'),
        "name": invitation.get('name', '')
    }


@router.post("/login")
async def login(
    credentials: UserLogin,
    auth_service: AuthService = Depends(get_auth_service)
):
    """
    Authenticate user and return JWT token
    
    Args:
        credentials: Email and password
        
    Returns:
        Dict with token and user info
        
    Raises:
        HTTPException 401: Invalid credentials
    """
    try:
        result = await auth_service.login(
            email=credentials.email,
            password=credentials.password
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=401, detail=str(e))


@router.post("/register")
async def register_gerant(
    user_data: UserCreate,
    auth_service: AuthService = Depends(get_auth_service)
):
    """
    Register a new gérant with workspace
    
    Args:
        user_data: Gérant registration data
        
    Returns:
        Dict with token and user info
        
    Raises:
        HTTPException 400: Email already exists or validation error
    """
    try:
        result = await auth_service.register_gerant(
            name=user_data.name,
            email=user_data.email,
            password=user_data.password,
            company_name=user_data.company_name,
            phone=user_data.phone
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/register/invitation")
async def register_with_invitation(
    registration_data: RegisterWithInvite,
    auth_service: AuthService = Depends(get_auth_service)
):
    """
    Register user with invitation token
    
    Args:
        registration_data: Registration data with invitation token
        
    Returns:
        Dict with token and user info
        
    Raises:
        HTTPException 400: Invalid invitation or validation error
    """
    try:
        result = await auth_service.register_with_invitation(
            email=registration_data.email,
            password=registration_data.password,
            name=registration_data.name,
            invitation_token=registration_data.invitation_token
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/forgot-password")
async def forgot_password(
    request: ForgotPasswordRequest,
    auth_service: AuthService = Depends(get_auth_service)
):
    """
    Request password reset token
    
    Args:
        request: Email address
        
    Returns:
        Success message
    """
    try:
        await auth_service.request_password_reset(email=request.email)
        return {
            "message": "Si un compte existe avec cet email, vous recevrez un lien de réinitialisation dans quelques instants."
        }
    except Exception as e:
        # Don't reveal if email exists for security
        return {
            "message": "Si un compte existe avec cet email, vous recevrez un lien de réinitialisation dans quelques instants."
        }


@router.get("/reset-password/{token}")
async def verify_reset_token(
    token: str,
    db = Depends(get_db)
):
    """
    Verify reset password token
    
    Args:
        token: Reset token from email
        
    Returns:
        User email if token is valid
        
    Raises:
        HTTPException 400: Invalid or expired token
    """
    from datetime import datetime, timezone
    
    # Find reset token in database
    reset_entry = await db.password_resets.find_one(
        {"token": token},
        {"_id": 0}
    )
    
    if not reset_entry:
        raise HTTPException(status_code=400, detail="Lien invalide ou expiré")
    
    # Check expiration (10 minutes = 600 seconds)
    created_at = reset_entry.get('created_at')
    if created_at:
        # Handle both datetime object and ISO string
        if isinstance(created_at, str):
            from dateutil import parser
            created_at = parser.parse(created_at)
        
        now = datetime.now(timezone.utc)
        if created_at.tzinfo is None:
            created_at = created_at.replace(tzinfo=timezone.utc)
        
        age_seconds = (now - created_at).total_seconds()
        if age_seconds > 600:  # 10 minutes
            raise HTTPException(status_code=400, detail="Ce lien a expiré. Veuillez demander un nouveau lien.")
    
    # Check if already used
    if reset_entry.get('used'):
        raise HTTPException(status_code=400, detail="Ce lien a déjà été utilisé")
    
    return {
        "valid": True,
        "email": reset_entry.get('email', '')
    }


@router.post("/reset-password")
async def reset_password(
    request: ResetPasswordRequest,
    auth_service: AuthService = Depends(get_auth_service)
):
    """
    Reset password with token
    
    Args:
        request: Reset token and new password
        
    Returns:
        Success message
        
    Raises:
        HTTPException 400: Invalid or expired token
    """
    try:
        await auth_service.reset_password(
            token=request.token,
            new_password=request.new_password
        )
        return {"message": "Mot de passe réinitialisé avec succès"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    """
    Get current authenticated user information
    
    Args:
        current_user: Current authenticated user from JWT token
        
    Returns:
        User information without password
    """
    return current_user
