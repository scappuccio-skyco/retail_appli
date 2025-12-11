"""
Modèles et schémas pour l'architecture Enterprise / IT Admin
Supporte le provisionnement automatique via API REST et SCIM 2.0
"""

from pydantic import BaseModel, Field, EmailStr, ConfigDict
from typing import List, Optional, Dict
from datetime import datetime, timezone
import uuid


# ============================================
# ENTERPRISE ACCOUNT MODELS
# ============================================

class EnterpriseAccount(BaseModel):
    """
    Compte entreprise pour les grandes organisations qui utilisent
    un provisionnement automatique (API REST ou SCIM)
    """
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    company_name: str  # Nom de l'entreprise
    company_email: str  # Email de contact de l'entreprise
    sync_mode: str = "api"  # "api" ou "scim"
    
    # Configuration SCIM (si sync_mode == "scim")
    scim_enabled: bool = False
    scim_base_url: Optional[str] = None  # URL du serveur SCIM (fournie par nous)
    scim_bearer_token: Optional[str] = None  # Token d'authentification SCIM
    scim_last_sync: Optional[datetime] = None
    scim_sync_status: str = "never"  # never, success, failed, in_progress
    scim_error_message: Optional[str] = None
    
    # Facturation entreprise
    billing_type: str = "enterprise"  # Toujours "enterprise"
    stripe_customer_id: Optional[str] = None
    stripe_subscription_id: Optional[str] = None
    seats_purchased: int = 0
    seats_used: int = 0
    
    # Métadonnées
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by_admin_id: Optional[str] = None  # ID du super admin qui a créé le compte


class EnterpriseAccountCreate(BaseModel):
    """Modèle pour créer un compte entreprise"""
    company_name: str
    company_email: EmailStr
    sync_mode: str = "api"  # "api" ou "scim"
    it_admin_name: str
    it_admin_email: EmailStr
    it_admin_password: str


class EnterpriseAccountUpdate(BaseModel):
    """Modèle pour mettre à jour un compte entreprise"""
    company_name: Optional[str] = None
    company_email: Optional[str] = None
    sync_mode: Optional[str] = None


# ============================================
# API KEY MODELS
# ============================================

class APIKey(BaseModel):
    """
    Clé API pour l'authentification des requêtes de provisionnement
    Rate limit: 100 requêtes par minute par clé
    """
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    key: str  # La clé API elle-même (hachée en production)
    enterprise_account_id: str  # ID du compte entreprise
    name: str  # Nom descriptif de la clé (ex: "SAP Production Key")
    
    # Permissions
    scopes: List[str] = ["users:read", "users:write", "stores:read", "stores:write"]
    
    # Status et usage
    is_active: bool = True
    last_used_at: Optional[datetime] = None
    request_count: int = 0
    
    # Métadonnées
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: str  # ID de l'IT admin qui a créé la clé
    expires_at: Optional[datetime] = None  # Expiration optionnelle


class APIKeyCreate(BaseModel):
    """Modèle pour créer une clé API"""
    name: str
    scopes: Optional[List[str]] = ["users:read", "users:write", "stores:read", "stores:write"]
    expires_in_days: Optional[int] = None  # Expiration optionnelle en jours


class APIKeyResponse(BaseModel):
    """Réponse lors de la création d'une clé API"""
    id: str
    key: str  # La clé en clair (affichée une seule fois)
    name: str
    scopes: List[str]
    created_at: datetime
    expires_at: Optional[datetime]
    warning: str = "⚠️ Sauvegardez cette clé maintenant, elle ne sera plus affichée"


# ============================================
# SYNC LOG MODELS
# ============================================

class SyncLog(BaseModel):
    """Log de synchronisation pour tracer les opérations de provisionnement"""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    enterprise_account_id: str
    sync_type: str  # "api" ou "scim"
    operation: str  # "user_created", "user_updated", "user_deleted", "store_created", etc.
    status: str  # "success", "failed", "partial"
    
    # Détails de l'opération
    resource_type: str  # "user", "store", "bulk"
    resource_id: Optional[str] = None
    details: Optional[Dict] = None  # Détails supplémentaires (erreurs, nombres, etc.)
    error_message: Optional[str] = None
    
    # Métadonnées
    initiated_by: str  # "api_key:{key_id}" ou "scim:{provider}"
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# ============================================
# BULK IMPORT MODELS
# ============================================

class BulkUserImport(BaseModel):
    """Modèle pour l'import en masse d'utilisateurs"""
    users: List[Dict]  # Liste de dictionnaires utilisateur
    mode: str = "create_or_update"  # "create_only", "update_only", "create_or_update"
    send_invitations: bool = False  # Envoyer des emails d'invitation


class BulkStoreImport(BaseModel):
    """Modèle pour l'import en masse de magasins"""
    stores: List[Dict]  # Liste de dictionnaires magasin
    mode: str = "create_or_update"


class BulkImportResponse(BaseModel):
    """Réponse d'une opération d'import en masse"""
    success: bool
    total_processed: int
    created: int
    updated: int
    failed: int
    errors: List[Dict] = []
    details: Optional[Dict] = None


# ============================================
# ENTERPRISE SYNC STATUS
# ============================================

class EnterpriseSyncStatus(BaseModel):
    """Statut de synchronisation pour un compte entreprise"""
    enterprise_account_id: str
    company_name: str
    sync_mode: str
    
    # Compteurs
    total_users: int
    total_stores: int
    active_users: int
    
    # Dernière synchronisation
    last_sync_at: Optional[datetime]
    last_sync_status: str  # "success", "failed", "never"
    last_sync_details: Optional[str] = None
    
    # SCIM spécifique
    scim_enabled: bool
    scim_base_url: Optional[str] = None
    
    # Logs récents
    recent_logs: List[Dict] = []


# ============================================
# IT ADMIN USER (extension de User)
# ============================================

class ITAdminCreate(BaseModel):
    """Modèle pour créer un IT Admin"""
    name: str
    email: EmailStr
    password: str
    enterprise_account_id: str


class ITAdminUpdate(BaseModel):
    """Modèle pour mettre à jour un IT Admin"""
    name: Optional[str] = None
    email: Optional[EmailStr] = None
