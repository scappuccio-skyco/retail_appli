"""
User authentication, registration and invitations

All Pydantic models for users domain
"""
from __future__ import annotations  # For forward references
from pydantic import BaseModel, Field, EmailStr, ConfigDict
from typing import Optional, List, Dict
from datetime import datetime, timedelta, timezone
from uuid import uuid4
import uuid


class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    email: EmailStr
    password: str
    role: str  # "gerant" | "manager" | "seller" | "it_admin"
    status: str = "active"  # active, inactive, deleted
    phone: Optional[str] = None
    
    # Hiérarchie Multi-Store
    gerant_id: Optional[str] = None  # null si role = gerant
    store_id: Optional[str] = None   # ID du magasin d'affectation
    manager_id: Optional[str] = None # null si role != seller
    
    # Double rôle pour gérant qui est aussi manager
    is_also_manager: bool = False
    managed_store_id: Optional[str] = None  # ID du magasin qu'il manage directement
    
    # Enterprise/IT Admin fields
    enterprise_account_id: Optional[str] = None  # ID du compte entreprise (pour IT Admin)
    sync_mode: Optional[str] = None  # "manual" (default) | "api_sync" | "scim_sync"
    external_id: Optional[str] = None  # ID dans le système externe (SAP, ERP, etc.)
    stripe_customer_id: Optional[str] = None  # ID du customer Stripe (pour gérant)
    
    # Legacy (à garder pour compatibilité)
    workspace_id: Optional[str] = None  # ID du workspace (entreprise)
    deactivated_at: Optional[datetime] = None  # Date de désactivation
    deleted_at: Optional[datetime] = None  # Date de suppression
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))



class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: Optional[str] = None  # Optionnel, forcé à "gérant" côté backend pour inscription publique
    manager_id: Optional[str] = None
    workspace_name: Optional[str] = None  # Nom de l'entreprise (pour managers)



class UserLogin(BaseModel):
    email: EmailStr
    password: str



class ForgotPasswordRequest(BaseModel):
    email: EmailStr



class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(..., min_length=8)



class Invitation(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    token: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: EmailStr
    manager_id: str
    manager_name: str
    status: str = "pending"  # pending, accepted, expired
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    expires_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc) + timedelta(days=7))



class InvitationCreate(BaseModel):
    email: EmailStr



class RegisterWithInvite(BaseModel):
    name: str
    email: EmailStr
    password: str
    invitation_token: str



class GerantInvitation(BaseModel):
    """Modèle pour invitation envoyée par un Gérant"""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    token: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str  # Nom complet de la personne invitée
    email: EmailStr
    role: str  # "manager" ou "seller"
    gerant_id: str
    gerant_name: str
    store_id: str  # Magasin de destination
    store_name: str
    manager_id: Optional[str] = None  # Seulement pour les vendeurs
    manager_name: Optional[str] = None  # Seulement pour les vendeurs
    status: str = "pending"  # pending, accepted, expired
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    expires_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc) + timedelta(days=7))



class GerantInvitationCreate(BaseModel):
    """Modèle pour créer une invitation Gérant"""
    name: str  # Nom complet de la personne invitée
    email: EmailStr
    role: str  # "manager" ou "seller"
    store_id: str
    manager_id: Optional[str] = None  # Requis si role == "seller" (peut être pending_xxx)
    manager_email: Optional[str] = None  # Email du manager si en attente



class RegisterWithGerantInvite(BaseModel):
    """Modèle pour s'enregistrer avec une invitation Gérant"""
    name: str
    password: str
    invitation_token: str
    phone: Optional[str] = None

# ============================================
# USER MODELS (Modified for Multi-Store)
# ============================================



class CreateAdminRequest(BaseModel):
    secret_token: str
    email: EmailStr
    password: str
    name: str

