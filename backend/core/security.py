"""
Security utilities: JWT, password hashing, authentication
"""
import bcrypt
import jwt
from datetime import datetime, timedelta, timezone
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional
import logging

from core.config import settings

# Security scheme
# Use auto_error=False to control 401 vs 403 at dependency level
security = HTTPBearer(auto_error=False)

logger = logging.getLogger(__name__)

# JWT Configuration
JWT_SECRET = settings.JWT_SECRET
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION = 24  # hours


# ===== PASSWORD HASHING =====

def get_password_hash(password: str) -> str:
    """
    Hash a password using bcrypt
    
    Args:
        password: Plain text password
        
    Returns:
        Hashed password string
    """
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')


def verify_password(password: str, hashed: str) -> bool:
    """
    Verify a password against its hash
    
    Args:
        password: Plain text password to verify
        hashed: Hashed password to compare against
        
    Returns:
        True if password matches, False otherwise
    """
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))


# ===== JWT TOKEN MANAGEMENT =====

def create_token(user_id: str, email: str, role: str) -> str:
    """
    Create a JWT token for a user
    
    Args:
        user_id: User's unique identifier
        email: User's email
        role: User's role (super_admin, gerant, manager, seller)
        
    Returns:
        Encoded JWT token string
    """
    payload = {
        'user_id': user_id,
        'email': email,
        'role': role,
        'exp': datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    """
    Decode and validate a JWT token
    
    Args:
        token: JWT token string
        
    Returns:
        Decoded token payload
        
    Raises:
        HTTPException: If token is expired or invalid
    """
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


# ===== AUTHENTICATION DEPENDENCIES =====

def _normalize_role(role: Optional[str]) -> Optional[str]:
    if not role:
        return None
    normalized = role.strip().lower()
    if normalized == 'gérant':
        normalized = 'gerant'
    if normalized in ['admin', 'superadmin', 'super_admin']:
        normalized = 'super_admin'
    return normalized


def _extract_user_id(payload: dict) -> Optional[str]:
    for key in ('user_id', 'sub', 'id'):
        value = payload.get(key)
        if value:
            return value
    return None


def _get_token_payload(credentials: Optional[HTTPAuthorizationCredentials]) -> dict:
    if not credentials or not isinstance(credentials, HTTPAuthorizationCredentials):
        logger.warning("Auth rejected: missing bearer credentials")
        raise HTTPException(status_code=401, detail="Missing token")
    if not credentials.credentials:
        logger.warning("Auth rejected: missing bearer token")
        raise HTTPException(status_code=401, detail="Missing token")
    token = credentials.credentials
    return decode_token(token)


async def _resolve_workspace(db, user: dict) -> Optional[dict]:
    """
    Resolve workspace for a user without enforcing access rules.
    Returns minimal workspace info or None.
    """
    if _normalize_role(user.get('role')) == 'super_admin':
        return None

    workspace_id = user.get('workspace_id')
    gerant_id = user.get('gerant_id')
    user_id = user.get('id')
    user_role = _normalize_role(user.get('role'))

    if workspace_id:
        return await db.workspaces.find_one({"id": workspace_id}, {"_id": 0, "id": 1, "status": 1})
    if gerant_id:
        return await db.workspaces.find_one({"gerant_id": gerant_id}, {"_id": 0, "id": 1, "status": 1})
    if user_role == 'gerant':
        return await db.workspaces.find_one({"gerant_id": user_id}, {"_id": 0, "id": 1, "status": 1})
    return None


async def _attach_space_context(db, user: dict) -> dict:
    """
    Attach space info to the user without blocking auth.
    """
    workspace = await _resolve_workspace(db, user)
    status = workspace.get('status', 'active') if workspace else 'unknown'
    user['space'] = {
        "id": workspace.get('id') if workspace else None,
        "status": status
    }
    return user


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> dict:
    """
    Dependency to get current authenticated user
    Injects user data into route handlers
    
    Usage:
        @router.get("/me")
        async def get_me(current_user: dict = Depends(get_current_user)):
            return current_user
    
    Args:
        credentials: HTTP Bearer token from Authorization header
        
    Returns:
        User dict without password
        
    Raises:
        HTTPException: If token invalid or user not found
        HTTPException 403: If workspace is suspended
    """
    from core.database import get_db
    
    payload = _get_token_payload(credentials)
    user_id = _extract_user_id(payload)
    if not user_id:
        logger.warning("Auth rejected: missing user_id in token payload")
        raise HTTPException(status_code=401, detail="Invalid token payload")
    
    db = await get_db()
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
    
    if not user:
        logger.warning("Auth rejected: user not found for id %s", user_id)
        raise HTTPException(status_code=401, detail="User not found")
    
    await _attach_space_context(db, user)

    normalized_role = _normalize_role(user.get('role'))
    if normalized_role and normalized_role != user.get('role'):
        user['role'] = normalized_role
    return user


async def get_current_gerant(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> dict:
    """
    Dependency to get current user and verify they are a gérant
    
    Usage:
        @router.get("/gerant/dashboard")
        async def dashboard(current_user: dict = Depends(get_current_gerant)):
            # Only gérants can access this
    
    Args:
        credentials: HTTP Bearer token
        
    Returns:
        Gérant user dict
        
    Raises:
        HTTPException: If not a gérant or user not found
    """
    from core.database import get_db
    
    payload = _get_token_payload(credentials)
    user_id = _extract_user_id(payload)
    if not user_id:
        logger.warning("Auth rejected: missing user_id in token payload")
        raise HTTPException(status_code=401, detail="Invalid token payload")
    
    db = await get_db()
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
    
    if not user:
        logger.warning("Auth rejected: user not found for id %s", user_id)
        raise HTTPException(status_code=401, detail="User not found")
    
    normalized_role = _normalize_role(user.get('role'))
    if normalized_role != 'gerant':
        raise HTTPException(status_code=403, detail="Accès réservé aux gérants")
    
    await _attach_space_context(db, user)

    if normalized_role and normalized_role != user.get('role'):
        user['role'] = normalized_role
    return user


async def get_current_manager(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> dict:
    """
    Dependency to get current user and verify they are a manager
    
    Args:
        credentials: HTTP Bearer token
        
    Returns:
        Manager user dict
        
    Raises:
        HTTPException: If not a manager or user not found
    """
    from core.database import get_db
    
    payload = _get_token_payload(credentials)
    user_id = _extract_user_id(payload)
    if not user_id:
        logger.warning("Auth rejected: missing user_id in token payload")
        raise HTTPException(status_code=401, detail="Invalid token payload")
    
    db = await get_db()
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
    
    if not user:
        logger.warning("Auth rejected: user not found for id %s", user_id)
        raise HTTPException(status_code=401, detail="User not found")
    
    normalized_role = _normalize_role(user.get('role'))
    if normalized_role != 'manager':
        raise HTTPException(status_code=403, detail="Accès réservé aux managers")
    
    await _attach_space_context(db, user)

    if normalized_role and normalized_role != user.get('role'):
        user['role'] = normalized_role
    return user


async def get_current_seller(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> dict:
    """
    Dependency to get current user and verify they are a seller
    
    Args:
        credentials: HTTP Bearer token
        
    Returns:
        Seller user dict
        
    Raises:
        HTTPException: If not a seller or user not found
    """
    from core.database import get_db
    
    payload = _get_token_payload(credentials)
    user_id = _extract_user_id(payload)
    if not user_id:
        logger.warning("Auth rejected: missing user_id in token payload")
        raise HTTPException(status_code=401, detail="Invalid token payload")
    
    db = await get_db()
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
    
    if not user:
        logger.warning("Auth rejected: user not found for id %s", user_id)
        raise HTTPException(status_code=401, detail="User not found")
    
    normalized_role = _normalize_role(user.get('role'))
    if normalized_role != 'seller':
        raise HTTPException(status_code=403, detail="Accès réservé aux vendeurs")
    
    await _attach_space_context(db, user)

    if normalized_role and normalized_role != user.get('role'):
        user['role'] = normalized_role
    return user


async def get_super_admin(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> dict:
    """
    Dependency to get current user and verify they are a super admin
    
    Args:
        credentials: HTTP Bearer token
        
    Returns:
        Super admin user dict
        
    Raises:
        HTTPException: If not a super admin or user not found
    """
    from core.database import get_db
    
    payload = _get_token_payload(credentials)
    user_id = _extract_user_id(payload)
    if not user_id:
        logger.warning("Auth rejected: missing user_id in token payload")
        raise HTTPException(status_code=401, detail="Invalid token payload")
    
    db = await get_db()
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
    
    if not user:
        logger.warning("Auth rejected: user not found for id %s", user_id)
        raise HTTPException(status_code=401, detail="User not found")
    
    normalized_role = _normalize_role(user.get('role'))
    if normalized_role != 'super_admin':
        raise HTTPException(status_code=403, detail="Super admin access required")
    
    if normalized_role and normalized_role != user.get('role'):
        user['role'] = normalized_role
    return user


async def get_gerant_or_manager(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> dict:
    """
    Dependency to get current user and verify they are a gérant OR manager
    
    Used for endpoints that should be accessible to both roles
    
    Args:
        credentials: HTTP Bearer token
        
    Returns:
        User dict (gérant or manager)
        
    Raises:
        HTTPException: If not a gérant or manager
    """
    from core.database import get_db
    
    payload = _get_token_payload(credentials)
    user_id = _extract_user_id(payload)
    if not user_id:
        logger.warning("Auth rejected: missing user_id in token payload")
        raise HTTPException(status_code=401, detail="Invalid token payload")
    
    db = await get_db()
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
    
    if not user:
        logger.warning("Auth rejected: user not found for id %s", user_id)
        raise HTTPException(status_code=401, detail="User not found")
    
    normalized_role = _normalize_role(user.get('role'))
    if normalized_role not in ['gerant', 'manager']:
        raise HTTPException(status_code=403, detail="Accès réservé aux gérants et managers")
    
    await _attach_space_context(db, user)

    if normalized_role and normalized_role != user.get('role'):
        user['role'] = normalized_role
    return user


async def require_active_space(
    current_user: dict = Depends(get_current_user)
) -> dict:
    """
    Dependency to enforce active workspace for business routes.
    Returns current_user if workspace is active.
    """
    space = current_user.get('space') or {}
    status = space.get('status', 'unknown')
    if status != 'active':
        raise HTTPException(
            status_code=403,
            detail="Espace suspendu ou expiré : accès aux fonctionnalités bloqué"
        )
    return current_user


# ===== STORE OWNERSHIP VERIFICATION =====

async def verify_store_ownership(
    current_user: dict,
    target_store_id: str,
    db = None
) -> None:
    """
    Verify that the current user has access to the target store.
    
    Rules:
    - Manager: Must have store_id matching target_store_id
    - Gérant: Must own the store (gerant_id matches)
    - Seller: Must have store_id matching target_store_id
    
    Args:
        current_user: Authenticated user dict
        target_store_id: Store ID to verify access to
        db: Database connection (optional, will fetch if not provided)
        
    Raises:
        HTTPException 403: If user doesn't have access to the store
        HTTPException 404: If store doesn't exist
    """
    if not db:
        from core.database import get_db
        db = await get_db()
    
    if not target_store_id:
        raise HTTPException(status_code=400, detail="store_id requis")
    
    role = current_user.get('role')
    user_id = current_user.get('id')
    user_store_id = current_user.get('store_id')
    
    # Manager: Must be assigned to this store
    if role == 'manager':
        if user_store_id != target_store_id:
            raise HTTPException(
                status_code=403,
                detail="Accès refusé : ce magasin ne vous est pas assigné"
            )
        return
    
    # Gérant: Must own the store (verify in database)
    if role in ['gerant', 'gérant']:
        store = await db.stores.find_one(
            {"id": target_store_id, "gerant_id": user_id, "active": True},
            {"_id": 0, "id": 1}
        )
        if not store:
            raise HTTPException(
                status_code=403,
                detail="Accès refusé : ce magasin ne vous appartient pas ou n'existe pas"
            )
        return
    
    # Seller: Must be assigned to this store
    if role == 'seller':
        if user_store_id != target_store_id:
            raise HTTPException(
                status_code=403,
                detail="Accès refusé : ce magasin ne vous est pas assigné"
            )
        return
    
    # Unknown role
    raise HTTPException(status_code=403, detail="Rôle non autorisé")


async def verify_resource_store_access(
    db,
    resource_id: str,
    resource_type: str,
    user_store_id: str,
    user_role: str = None,
    user_id: str = None
) -> dict:
    """
    Verify that a resource (objective, challenge) belongs to the user's store.
    
    This is a critical security function to prevent IDOR attacks.
    
    Args:
        db: Database connection
        resource_id: ID of the resource to verify
        resource_type: Type of resource ('objective', 'challenge')
        user_store_id: Store ID of the authenticated user
        user_role: Optional role for additional checks
        user_id: Optional user ID for gérant ownership verification
        
    Returns:
        Resource dict if found and accessible
        
    Raises:
        HTTPException 403: If resource doesn't belong to user's store
        HTTPException 404: If resource not found
    """
    if resource_type == 'objective':
        collection = db.objectives
    elif resource_type == 'challenge':
        collection = db.challenges
    else:
        raise ValueError(f"Type de ressource non supporté: {resource_type}")
    
    # Build query with store_id filter (CRITICAL: prevents IDOR)
    query = {"id": resource_id, "store_id": user_store_id}
    
    resource = await collection.find_one(query, {"_id": 0})
    
    if not resource:
        # Check if resource exists but in different store (security: don't reveal existence)
        exists_elsewhere = await collection.find_one({"id": resource_id}, {"_id": 0, "store_id": 1})
        if exists_elsewhere:
            raise HTTPException(
                status_code=403,
                detail=f"{resource_type.capitalize()} non trouvé ou accès refusé"
            )
        raise HTTPException(
            status_code=404,
            detail=f"{resource_type.capitalize()} non trouvé"
        )
    
    return resource


async def verify_seller_store_access(
    db,
    seller_id: str,
    user_store_id: str,
    user_role: str = None,
    user_id: str = None
) -> dict:
    """
    Verify that a seller belongs to the user's store.
    
    Prevents managers from accessing sellers from other stores.
    
    Args:
        db: Database connection
        seller_id: ID of the seller to verify
        user_store_id: Store ID of the authenticated user
        user_role: Optional role for additional checks
        user_id: Optional user ID for gérant ownership verification
        
    Returns:
        Seller dict if found and accessible
        
    Raises:
        HTTPException 403: If seller doesn't belong to user's store
        HTTPException 404: If seller not found
    """
    # Build query with store_id filter (CRITICAL: prevents IDOR)
    query = {"id": seller_id, "store_id": user_store_id, "role": "seller"}
    
    seller = await db.users.find_one(query, {"_id": 0, "password": 0})
    
    if not seller:
        # Check if seller exists but in different store (security: don't reveal existence)
        exists_elsewhere = await db.users.find_one(
            {"id": seller_id, "role": "seller"},
            {"_id": 0, "store_id": 1}
        )
        if exists_elsewhere:
            raise HTTPException(
                status_code=403,
                detail="Vendeur non trouvé ou n'appartient pas à ce magasin"
            )
        raise HTTPException(status_code=404, detail="Vendeur non trouvé")
    
    return seller