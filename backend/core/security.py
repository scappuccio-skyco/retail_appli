"""
Security utilities: JWT, password hashing, authentication
"""
import bcrypt
import jwt
from datetime import datetime, timedelta, timezone
from fastapi import Depends, Header
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional, Dict
import logging

from core.config import settings
from core.exceptions import UnauthorizedError, ForbiddenError, NotFoundError, ValidationError

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
        UnauthorizedError: If token is expired or invalid
    """
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise UnauthorizedError("Token expired")
    except jwt.InvalidTokenError:
        raise UnauthorizedError("Invalid token")


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
        raise UnauthorizedError("Missing token")
    if not credentials.credentials:
        logger.warning("Auth rejected: missing bearer token")
        raise UnauthorizedError("Missing token")
    token = credentials.credentials
    return decode_token(token)


async def _get_current_user_from_token(
    credentials: Optional[HTTPAuthorizationCredentials],
) -> dict:
    """
    Single point of JWT decoding and user resolution (Token -> User).
    Used by all role-specific dependencies. Uses cache for user lookups (5 min).
    """
    from core.database import get_db
    from core.cache import get_cache_service, CacheKeys
    from repositories.user_repository import UserRepository
    from repositories.store_repository import WorkspaceRepository

    payload = _get_token_payload(credentials)
    user_id = _extract_user_id(payload)
    if not user_id:
        logger.warning("Auth rejected: missing user_id in token payload")
        raise UnauthorizedError("Invalid token payload")

    cache = await get_cache_service()
    cache_key = CacheKeys.user(user_id)
    user = await cache.get(cache_key)

    if user is None:
        db = await get_db()
        user_repo = UserRepository(db)
        user = await user_repo.find_one({"id": user_id}, {"_id": 0, "password": 0})
        if not user:
            logger.warning("Auth rejected: user not found for id %s", user_id)
            raise UnauthorizedError("User not found")
        await cache.set(cache_key, user, ttl=300)
    else:
        logger.debug("Cache hit for user %s", user_id)

    db = await get_db()
    workspace_repo = WorkspaceRepository(db)
    await _attach_space_context(workspace_repo, user)

    normalized_role = _normalize_role(user.get("role"))
    if normalized_role and normalized_role != user.get("role"):
        user["role"] = normalized_role
    return user


async def _resolve_workspace(workspace_repo, user: dict) -> Optional[dict]:
    """
    Resolve workspace for a user without enforcing access rules.
    Returns minimal workspace info or None.
    Uses WorkspaceRepository (no direct DB access).
    ✅ CACHED: Workspace lookups are cached for 2 minutes.
    """
    from core.cache import get_cache_service, CacheKeys

    if _normalize_role(user.get('role')) == 'super_admin':
        return None

    workspace_id = user.get('workspace_id')
    gerant_id = user.get('gerant_id')
    user_id = user.get('id')
    user_role = _normalize_role(user.get('role'))

    cache = await get_cache_service()
    workspace = None

    if workspace_id:
        cache_key = CacheKeys.workspace(workspace_id)
        workspace = await cache.get(cache_key)
        if workspace is None:
            workspace = await workspace_repo.find_by_id(workspace_id)
            if workspace:
                workspace = {k: workspace[k] for k in ("id", "status", "subscription_status", "trial_end") if k in workspace}
                await cache.set(cache_key, workspace, ttl=120)
    elif gerant_id:
        workspace = await workspace_repo.find_by_gerant(gerant_id)
        if workspace:
            workspace = {k: workspace[k] for k in ("id", "status", "subscription_status", "trial_end") if k in workspace}
            cache_key = CacheKeys.workspace(workspace.get('id'))
            await cache.set(cache_key, workspace, ttl=120)
    elif user_role == 'gerant':
        workspace = await workspace_repo.find_by_gerant(user_id)
        if workspace:
            workspace = {k: workspace[k] for k in ("id", "status", "subscription_status", "trial_end") if k in workspace}
            cache_key = CacheKeys.workspace(workspace.get('id'))
            await cache.set(cache_key, workspace, ttl=120)

    return workspace


async def _attach_space_context(workspace_repo, user: dict) -> dict:
    """
    Attach space info to the user without blocking auth.
    """
    workspace = await _resolve_workspace(workspace_repo, user)
    status = workspace.get('status', 'active') if workspace else 'unknown'
    user['space'] = {
        "id": workspace.get('id') if workspace else None,
        "status": status,
        "subscription_status": workspace.get('subscription_status') if workspace else None,
        "trial_end": workspace.get('trial_end') if workspace else None
    }
    return user


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> dict:
    """
    Dependency to get current authenticated user.
    Delegates to _get_current_user_from_token (single JWT + cache path).

    Usage:
        @router.get("/me")
        async def get_me(current_user: dict = Depends(get_current_user)):
            return current_user
    """
    return await _get_current_user_from_token(credentials)


async def get_current_gerant(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> dict:
    """
    Dependency to get current user and verify they are a gérant.
    Uses _get_current_user_from_token (JWT + cache), then checks role.
    """
    user = await _get_current_user_from_token(credentials)
    if _normalize_role(user.get("role")) != "gerant":
        raise ForbiddenError("Accès réservé aux gérants")
    return user


async def get_current_manager(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> dict:
    """
    Dependency to get current user and verify they are a manager.
    Uses _get_current_user_from_token (JWT + cache), then checks role.
    """
    user = await _get_current_user_from_token(credentials)
    if _normalize_role(user.get("role")) != "manager":
        raise ForbiddenError("Accès réservé aux managers")
    return user


async def get_current_seller(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> dict:
    """
    Dependency to get current user and verify they are a seller.
    Uses _get_current_user_from_token (JWT + cache), then checks role.
    """
    user = await _get_current_user_from_token(credentials)
    if _normalize_role(user.get("role")) != "seller":
        raise ForbiddenError("Accès réservé aux vendeurs")
    return user


async def get_super_admin(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> dict:
    """
    Dependency to get current user and verify they are a super admin.
    Uses _get_current_user_from_token (JWT + cache), then checks role.
    """
    user = await _get_current_user_from_token(credentials)
    if _normalize_role(user.get("role")) != "super_admin":
        raise ForbiddenError("Super admin access required")
    return user


async def get_gerant_or_manager(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> dict:
    """
    Dependency to get current user and verify they are a gérant OR manager.
    Uses _get_current_user_from_token (JWT + cache), then checks role.
    """
    user = await _get_current_user_from_token(credentials)
    if _normalize_role(user.get("role")) not in ("gerant", "manager"):
        raise ForbiddenError("Accès réservé aux gérants et managers")
    return user


# ===== RBAC: ROLE VERIFICATION (Phase 3 - Single Point of Truth) =====


async def verify_manager(
    current_user: dict = Depends(get_current_user)
) -> dict:
    """
    Verify current user is a manager (RBAC).
    Use for endpoints restricted to managers only.
    """
    role = _normalize_role(current_user.get('role'))
    if role != 'manager':
        raise ForbiddenError("Access restricted to managers")
    return current_user


async def verify_manager_or_gerant(
    current_user: dict = Depends(get_current_user)
) -> dict:
    """
    Verify current user is a manager or gérant (RBAC).
    Use for endpoints accessible to both managers and gérants.
    """
    role = _normalize_role(current_user.get('role'))
    if role not in ('manager', 'gerant'):
        raise ForbiddenError("Access restricted to managers and gérants")
    return current_user


async def verify_manager_gerant_or_seller(
    current_user: dict = Depends(get_current_user)
) -> dict:
    """
    Verify current user is a manager, gérant, or seller (RBAC).
    Use for endpoints accessible to managers, gérants, and sellers.
    """
    role = _normalize_role(current_user.get('role'))
    if role not in ('manager', 'gerant', 'seller'):
        raise ForbiddenError("Access restricted to managers, gérants, and sellers")
    return current_user


async def require_active_space(
    current_user: dict = Depends(get_current_user)
) -> dict:
    """
    Dependency to enforce active subscription for business routes.
    Returns current_user if subscription is active or trialing (not expired).
    """
    from core.database import get_db
    from repositories.store_repository import WorkspaceRepository

    space = current_user.get('space') or {}
    space_status = space.get('status')
    if space_status == 'deleted':
        raise ForbiddenError("Espace supprimé")

    subscription_status = space.get('subscription_status') or 'inactive'
    if subscription_status == 'active':
        return current_user

    if subscription_status == 'trialing':
        trial_end = space.get('trial_end')
        if trial_end:
            if isinstance(trial_end, str):
                trial_end_dt = datetime.fromisoformat(trial_end.replace('Z', '+00:00'))
            else:
                trial_end_dt = trial_end

            now = datetime.now(timezone.utc)
            if trial_end_dt.tzinfo is None:
                trial_end_dt = trial_end_dt.replace(tzinfo=timezone.utc)

            if now <= trial_end_dt:
                return current_user

        workspace_id = space.get('id')
        if workspace_id:
            db = await get_db()
            workspace_repo = WorkspaceRepository(db)
            await workspace_repo.update_by_id(
                workspace_id,
                {"subscription_status": "trial_expired", "updated_at": datetime.now(timezone.utc).isoformat()}
            )

        raise ForbiddenError(
            "Période d'essai terminée. Veuillez souscrire à un abonnement pour continuer."
        )

    raise ForbiddenError(
        "Abonnement inactif ou paiement en échec : accès aux fonctionnalités bloqué"
    )


# ===== STORE ACCESS HELPERS =====


def verify_store_access_for_user(store: dict, user: dict) -> None:
    """
    Verify that the user has access to the store (manager or gérant).
    Raises ForbiddenError if not. Use after fetching store (e.g. via StoreService).

    - Manager: access if store.manager_id == user.id OR store.id == user.store_id
    - Gérant: access if store.gerant_id == user.id
    """
    role = _normalize_role(user.get("role"))
    user_id = user.get("id")
    user_store_id = user.get("store_id")

    if role == "manager":
        if store.get("manager_id") != user_id and store.get("id") != user_store_id:
            raise ForbiddenError("Accès refusé à ce magasin")
        return
    if role == "gerant":
        if store.get("gerant_id") != user_id:
            raise ForbiddenError("Accès refusé à ce magasin")
        return


# ===== STORE OWNERSHIP VERIFICATION =====

async def verify_store_ownership(
    current_user: dict,
    target_store_id: str,
    store_repo=None,
) -> None:
    """
    Verify that the current user has access to the target store.
    Uses StoreRepository (no direct DB access).

    Rules:
    - Manager: Must have store_id matching target_store_id
    - Gérant: Must own the store (gerant_id matches)
    - Seller: Must have store_id matching target_store_id

    Args:
        current_user: Authenticated user dict
        target_store_id: Store ID to verify access to
        store_repo: StoreRepository (optional, will create from get_db if not provided)

    Raises:
        ForbiddenError: If user doesn't have access to the store
        NotFoundError: If store doesn't exist
    """
    if store_repo is None:
        from core.database import get_db
        from repositories.store_repository import StoreRepository
        db = await get_db()
        store_repo = StoreRepository(db)

    if not target_store_id:
        raise ValidationError("store_id requis")

    role = _normalize_role(current_user.get('role'))
    user_id = current_user.get('id')
    user_store_id = current_user.get('store_id')

    if role == 'manager':
        if user_store_id != target_store_id:
            raise ForbiddenError("Accès refusé : ce magasin ne vous est pas assigné")
        return

    if role == 'gerant':
        store = await store_repo.find_one(
            {"id": target_store_id, "gerant_id": user_id, "active": True},
            {"_id": 0, "id": 1}
        )
        if not store:
            raise ForbiddenError("Accès refusé : ce magasin ne vous appartient pas ou n'existe pas")
        return

    if role == 'seller':
        if user_store_id != target_store_id:
            raise ForbiddenError("Accès refusé : ce magasin ne vous est pas assigné")
        return

    raise ForbiddenError("Rôle non autorisé")


async def verify_resource_store_access(
    *,
    resource_id: str,
    resource_type: str,
    user_store_id: str,
    manager_service,
) -> dict:
    """
    Verify that a resource (objective, challenge) belongs to the user's store.
    Uses ManagerService only (no direct DB access).

    Args:
        resource_id: ID of the resource to verify
        resource_type: 'objective' or 'challenge'
        user_store_id: Store ID of the authenticated user
        manager_service: ManagerService (required)

    Returns:
        Resource dict if found and accessible
    """
    if resource_type == 'objective':
        resource = await manager_service.get_objective_by_id_and_store(resource_id, user_store_id)
        if not resource:
            exists = await manager_service.get_objective_by_id(resource_id)
            if exists:
                raise ForbiddenError("Objective non trouvé ou accès refusé")
            raise NotFoundError("Objective non trouvé")
        return resource
    if resource_type == 'challenge':
        resource = await manager_service.get_challenge_by_id_and_store(resource_id, user_store_id)
        if not resource:
            exists = await manager_service.get_challenge_by_id(resource_id)
            if exists:
                raise ForbiddenError("Challenge non trouvé ou accès refusé")
            raise NotFoundError("Challenge non trouvé")
        return resource
    raise ValueError(f"Type de ressource non supporté: {resource_type}")


async def verify_seller_store_access(
    *,
    seller_id: str,
    user_store_id: str,
    user_role: str,
    user_id: str,
    manager_service,
) -> dict:
    """
    Verify that a seller belongs to the user's store.
    Uses ManagerService only (no direct DB access).
    """
    if not user_store_id:
        raise ValidationError("store_id requis pour vérifier l'accès au vendeur")
    if not user_role:
        raise ValidationError("role requis pour vérifier l'accès au vendeur")

    proj = {"_id": 0, "password": 0}
    role = _normalize_role(user_role)

    if role == "seller":
        if seller_id != user_id:
            raise ForbiddenError("Un vendeur ne peut accéder qu'à ses propres données")
        seller = await manager_service.get_user_by_id(seller_id, projection=proj)
        if not seller or seller.get("role") != "seller":
            raise NotFoundError("Vendeur non trouvé")
        return seller

    if role == "manager":
        seller = await manager_service.get_seller_by_id_and_store(seller_id, user_store_id)
        if not seller:
            other = await manager_service.get_user_by_id(seller_id, projection={"_id": 0})
            if other and other.get("role") == "seller":
                raise ForbiddenError("Vendeur non trouvé ou n'appartient pas à ce magasin")
            raise NotFoundError("Vendeur non trouvé")
        return seller

    if role == "gerant":
        if not user_id:
            raise ValidationError("user_id requis pour vérifier l'accès gérant")
        seller = await manager_service.get_user_by_id(seller_id, projection=proj)
        if not seller or seller.get("role") != "seller":
            raise NotFoundError("Vendeur non trouvé")
        seller_store_id = seller.get("store_id")
        if not seller_store_id:
            raise ForbiddenError("Vendeur sans magasin assigné")
        store = await manager_service.get_store_by_id(
            seller_store_id, gerant_id=user_id, projection={"_id": 0, "id": 1, "active": 1}
        )
        if not store or not store.get("active"):
            raise ForbiddenError("Ce vendeur n'appartient pas à l'un de vos magasins")
        return seller

    raise ForbiddenError("Rôle non autorisé")


# ===== API KEY & ROLE HELPERS (Phase 3: centralisation) =====

def get_api_key_from_headers(
    x_api_key: Optional[str] = None,
    authorization: Optional[str] = None,
) -> str:
    """
    Extract API key from X-API-Key or Authorization: Bearer header.
    Reusable for integrations and enterprise routes.
    """
    api_key = x_api_key
    if not api_key and authorization:
        if authorization.startswith("Bearer "):
            api_key = authorization[7:]
        else:
            api_key = authorization
    if not api_key:
        raise UnauthorizedError(
            "API key required. Use X-API-Key header or Authorization: Bearer <API_KEY>"
        )
    return api_key


async def require_it_admin(
    current_user: dict = Depends(get_current_user),
) -> dict:
    """Dependency: verify current user is IT Admin (enterprise)."""
    if (current_user or {}).get("role") != "it_admin":
        raise ForbiddenError("Access restricted to IT Admins")
    return current_user


async def verify_evaluation_employee_access(
    current_user: dict,
    employee_id: str,
    *,
    db=None,
    user_repo=None,
    store_repo=None,
    seller_service=None,
    store_service=None,
) -> dict:
    """
    Verify that the current user can generate an evaluation for the given employee_id.
    Returns the employee dict if allowed.
    Phase 0: Prefer seller_service and store_service (Zero Repo in Route); user_repo/store_repo or db is legacy.
    """
    role = (current_user or {}).get("role")
    user_id = (current_user or {}).get("id")

    if role == "seller":
        if user_id != employee_id:
            raise ForbiddenError("Un vendeur ne peut générer que son propre bilan")
        return current_user

    if role in ("manager", "gerant", "gérant"):
        if seller_service is not None and store_service is not None:
            employee = await seller_service.get_user_by_id_and_role(
                employee_id, "seller", {"_id": 0}
            )
            if not employee:
                raise NotFoundError("Vendeur non trouvé")
            if role == "manager":
                if employee.get("store_id") != current_user.get("store_id"):
                    raise ForbiddenError("Ce vendeur n'appartient pas à votre magasin")
            else:
                store = await store_service.get_store_by_id_and_gerant(
                    employee.get("store_id"), user_id
                )
                if not store:
                    raise ForbiddenError("Ce vendeur n'appartient pas à l'un de vos magasins")
            return employee
        from repositories.user_repository import UserRepository
        from repositories.store_repository import StoreRepository
        if user_repo is None or store_repo is None:
            if db is None:
                raise ValueError("verify_evaluation_employee_access: provide (seller_service, store_service), (user_repo, store_repo), or db")
            user_repo = UserRepository(db)
            store_repo = StoreRepository(db)
        employee = await user_repo.find_one(
            {"id": employee_id, "role": "seller"},
            {"_id": 0},
        )
        if not employee:
            raise NotFoundError("Vendeur non trouvé")
        if role == "manager":
            if employee.get("store_id") != current_user.get("store_id"):
                raise ForbiddenError("Ce vendeur n'appartient pas à votre magasin")
        else:
            store = await store_repo.find_one(
                {"id": employee.get("store_id"), "gerant_id": user_id},
                {"_id": 0},
            )
            if not store:
                raise ForbiddenError("Ce vendeur n'appartient pas à l'un de vos magasins")
        return employee

    raise ForbiddenError("Rôle non autorisé")


# ===== API KEY VERIFICATION DEPENDENCIES (Phase 3: DRY) =====

async def verify_integration_api_key(
    x_api_key: Optional[str] = Header(None, alias="X-API-Key"),
    authorization: Optional[str] = Header(None),
    integration_service = None,  # Injected via Depends in routes
) -> Dict:
    """
    Verify API key from header for IntegrationService.
    Supports both X-API-Key header and Authorization: Bearer <API_KEY>.
    To use: Depends(verify_integration_api_key) with integration_service injected.
    """
    api_key = get_api_key_from_headers(x_api_key, authorization)
    try:
        api_key_data = await integration_service.verify_api_key(api_key)
        return api_key_data
    except ValueError as e:
        raise UnauthorizedError(str(e))
    except Exception:
        raise UnauthorizedError("Invalid or inactive API Key")


def make_verify_integration_api_key(integration_service):
    """
    Factory: create a verify_integration_api_key dependency with injected service.
    Usage in routes:
        api_key_data: Dict = Depends(make_verify_integration_api_key(integration_service))
    """
    async def _verify(
        x_api_key: Optional[str] = Header(None, alias="X-API-Key"),
        authorization: Optional[str] = Header(None),
    ) -> Dict:
        return await verify_integration_api_key(x_api_key, authorization, integration_service)
    return _verify


def verify_api_key_with_scope(required_scope: str):
    """
    Factory: create a dependency that verifies API key and checks scope.
    Centralized from integrations.py.
    
    Usage:
        @router.get("/stores")
        async def list_stores(
            api_key_data: Dict = Depends(verify_api_key_with_scope("stores:read")),
            integration_service: IntegrationService = Depends(get_integration_service)
        ):
            ...
    """
    async def _verify_scope(
        x_api_key: Optional[str] = Header(None, alias="X-API-Key"),
        authorization: Optional[str] = Header(None),
        integration_service = None,  # Must be injected via sub-dependency
    ) -> Dict:
        api_key_data = await verify_integration_api_key(x_api_key, authorization, integration_service)
        permissions = api_key_data.get('permissions', [])
        if required_scope not in permissions:
            raise ForbiddenError(f"Insufficient permissions. Requires '{required_scope}'")
        return api_key_data
    return _verify_scope


async def verify_integration_store_access(
    store_id: str,
    api_key_data: Dict,
    integration_service,
    store_service,
) -> Dict:
    """
    Verify that the API key has access to the specified store_id.
    Centralized from integrations.py (Phase 3: DRY).
    Returns the store dict if allowed.
    """
    tenant_id = await integration_service.get_tenant_id_from_api_key(api_key_data)
    if not tenant_id:
        raise ForbiddenError("Invalid API key configuration: missing tenant_id")

    store = await store_service.get_store_by_id(store_id)
    if not store:
        raise NotFoundError("Store not found")

    store_gerant_id = str(store.get("gerant_id") or "")
    tenant_id_str = str(tenant_id)
    if store_gerant_id != tenant_id_str:
        raise NotFoundError("Store not found or not accessible by this tenant")

    store_ids = api_key_data.get("store_ids")
    if store_ids is not None and "*" not in store_ids:
        store_id_str = str(store_id)
        if store_id_str not in [str(sid) for sid in store_ids]:
            raise ForbiddenError("API key does not have access to this store (not in store_ids list)")
    return store


async def verify_enterprise_api_key(
    x_api_key: Optional[str] = Header(None, alias="X-API-Key"),
    authorization: Optional[str] = Header(None),
    enterprise_service = None,  # Injected via Depends in routes
) -> Dict:
    """
    Verify API key from header for EnterpriseService.
    Centralized from enterprise.py (Phase 3: DRY).
    """
    api_key_str = get_api_key_from_headers(x_api_key, authorization)
    api_key = await enterprise_service.verify_api_key(api_key_str)
    if not api_key:
        raise UnauthorizedError("Invalid or expired API key")
    return api_key