"""
Authentication Routes - Login, registration, password reset.
Phase 10 RC6: No direct db access - AuthService only.
"""
from fastapi import APIRouter, Depends

from api.dependencies_rate_limiting import rate_limit
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
from core.exceptions import UnauthorizedError, ValidationError, NotFoundError

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.get("/invitations/verify/{token}")
async def verify_invitation_token(
    token: str,
    auth_service: AuthService = Depends(get_auth_service),
):
    """Verify invitation token (Phase 10: AuthService.verify_invitation_token, no db)."""
    try:
        result = await auth_service.verify_invitation_token(token)
        return result
    except ValueError as e:
        detail = str(e)
        if "déjà été utilisée" in detail or "expiré" in detail:
            raise ValidationError(detail)
        raise NotFoundError(detail)


@router.post("/login", dependencies=[rate_limit("10/minute")])
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
        UnauthorizedError: Invalid credentials
    """
    # Le middleware s'occupe automatiquement de la gestion d'erreurs
    result = await auth_service.login(
        email=credentials.email,
        password=credentials.password
    )
    return result


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
        ValidationError: Email already exists or validation error
    """
    company_name = user_data.company_name or user_data.workspace_name
    if not company_name:
        raise ValidationError("Le nom de l'entreprise est requis")
    result = await auth_service.register_gerant(
        name=user_data.name,
        email=user_data.email,
        password=user_data.password,
        company_name=company_name,
        phone=user_data.phone
    )
    try:
        from email_service import send_gerant_welcome_email
        send_gerant_welcome_email(
            recipient_email=user_data.email,
            recipient_name=user_data.name
        )
    except Exception as email_error:
        import logging
        logging.error(f"Failed to send welcome email to gérant {user_data.email}: {email_error}")
    return result


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
        ValidationError: Invalid invitation or validation error
    """
    return await auth_service.register_with_invitation(
        email=registration_data.email,
        password=registration_data.password,
        name=registration_data.name,
        invitation_token=registration_data.invitation_token
    )


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
        import logging
        logger = logging.getLogger(__name__)
        logger.info("Demande de réinitialisation de mot de passe reçue")
        
        await auth_service.request_password_reset(email=request.email)
        
        logger.info("Processus de réinitialisation terminé")
        return {
            "message": "Si un compte existe avec cet email, vous recevrez un lien de réinitialisation dans quelques instants."
        }
    except Exception:
        import logging
        logger = logging.getLogger(__name__)
        logger.error("Erreur lors de la demande de réinitialisation", exc_info=True)
        # Don't reveal if email exists for security
        return {
            "message": "Si un compte existe avec cet email, vous recevrez un lien de réinitialisation dans quelques instants."
        }


@router.get("/reset-password/{token}")
async def verify_reset_token(
    token: str,
    auth_service: AuthService = Depends(get_auth_service),
):
    """Verify reset password token (Phase 10: AuthService.verify_reset_token, no db)."""
    try:
        return await auth_service.verify_reset_token(token)
    except ValueError as e:
        raise ValidationError(str(e))


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
        ValidationError: Invalid or expired token
    """
    await auth_service.reset_password(
        token=request.token,
        new_password=request.new_password
    )
    return {"message": "Mot de passe réinitialisé avec succès"}


@router.get("/me")
async def get_me(
    current_user: dict = Depends(get_current_user),
    auth_service: AuthService = Depends(get_auth_service),
):
    """Get current user info (Phase 10: AuthService.get_me_enriched, no db)."""
    return await auth_service.get_me_enriched(current_user)
