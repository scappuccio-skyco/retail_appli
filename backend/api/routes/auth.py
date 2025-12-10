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
from api.dependencies import get_auth_service
from core.security import get_current_user

router = APIRouter(prefix="/auth", tags=["Authentication"])


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
            new_password=request.password
        )
        return {"message": "Mot de passe réinitialisé avec succès"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
