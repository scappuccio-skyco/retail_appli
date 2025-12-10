"""
Security utilities: JWT, password hashing, authentication
"""
import bcrypt
import jwt
from datetime import datetime, timedelta, timezone
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional

from core.config import settings

# Security scheme
security = HTTPBearer()

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
    """
    from core.database import get_db
    
    token = credentials.credentials
    payload = decode_token(token)
    
    db = await get_db()
    user = await db.users.find_one({"id": payload['user_id']}, {"_id": 0, "password": 0})
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
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
    
    token = credentials.credentials
    payload = decode_token(token)
    
    db = await get_db()
    user = await db.users.find_one({"id": payload['user_id']}, {"_id": 0, "password": 0})
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user['role'] not in ['gerant', 'gérant']:
        raise HTTPException(status_code=403, detail="Accès réservé aux gérants")
    
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
    
    token = credentials.credentials
    payload = decode_token(token)
    
    db = await get_db()
    user = await db.users.find_one({"id": payload['user_id']}, {"_id": 0, "password": 0})
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user['role'] != 'manager':
        raise HTTPException(status_code=403, detail="Accès réservé aux managers")
    
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
    
    token = credentials.credentials
    payload = decode_token(token)
    
    db = await get_db()
    user = await db.users.find_one({"id": payload['user_id']}, {"_id": 0, "password": 0})
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user['role'] != 'seller':
        raise HTTPException(status_code=403, detail="Accès réservé aux vendeurs")
    
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
    
    token = credentials.credentials
    payload = decode_token(token)
    
    db = await get_db()
    user = await db.users.find_one({"id": payload['user_id']}, {"_id": 0, "password": 0})
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user['role'] != 'super_admin':
        raise HTTPException(status_code=403, detail="Super admin access required")
    
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
    
    token = credentials.credentials
    payload = decode_token(token)
    
    db = await get_db()
    user = await db.users.find_one({"id": payload['user_id']}, {"_id": 0, "password": 0})
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user['role'] not in ['gerant', 'gérant', 'manager']:
        raise HTTPException(status_code=403, detail="Accès réservé aux gérants et managers")
    
    return user
