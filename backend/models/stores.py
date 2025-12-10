"""
Stores, workspaces and staff management

All Pydantic models for stores domain
"""
from __future__ import annotations  # For forward references
from pydantic import BaseModel, Field, EmailStr, ConfigDict
from typing import Optional, List, Dict
from datetime import datetime, timedelta, timezone
from uuid import uuid4
import uuid


class Store(BaseModel):
    """Modèle pour un magasin/boutique"""
    model_config = ConfigDict(extra="ignore", populate_by_name=True)
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str  # ex: "Skyco Paris Centre"
    location: str  # ex: "75001 Paris"
    gerant_id: Optional[str] = None  # ID du gérant propriétaire (null pour enterprise)
    enterprise_account_id: Optional[str] = None  # ID du compte entreprise (si géré en mode enterprise)
    sync_mode: Optional[str] = None  # "manual" (default) | "api_sync" | "scim_sync"
    external_id: Optional[str] = None  # ID dans le système externe (SAP, ERP, etc.)
    active: bool = True
    address: Optional[str] = None
    phone: Optional[str] = None
    opening_hours: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())



class StoreCreate(BaseModel):
    """Modèle pour créer un nouveau magasin"""
    name: str
    location: str
    address: Optional[str] = None
    phone: Optional[str] = None
    opening_hours: Optional[str] = None



class StoreUpdate(BaseModel):
    """Modèle pour mettre à jour un magasin"""
    name: Optional[str] = None
    location: Optional[str] = None
    active: Optional[bool] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    opening_hours: Optional[str] = None



class Workspace(BaseModel):
    """
    Workspace représente une entreprise/organisation cliente.
    Chaque workspace a un seul customer Stripe et un seul abonnement actif.
    """
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str  # Nom de l'entreprise (unique)
    gerant_id: Optional[str] = None  # ID du gérant propriétaire
    stripe_customer_id: Optional[str] = None  # ID du customer Stripe
    stripe_subscription_id: Optional[str] = None  # ID de l'abonnement Stripe actif
    stripe_subscription_item_id: Optional[str] = None  # ID de l'item pour modifier quantity
    stripe_price_id: str = "price_1SS2XxIVM4C8dIGvpBRcYSNX"  # Price ID du plan (monthly par défaut)
    stripe_quantity: int = 0  # Nombre de sièges dans Stripe
    subscription_status: str = "inactive"  # inactive, trialing, active, past_due, canceled
    trial_start: Optional[datetime] = None
    trial_end: Optional[datetime] = None
    current_period_start: Optional[datetime] = None
    current_period_end: Optional[datetime] = None
    cancel_at_period_end: Optional[bool] = False
    canceled_at: Optional[datetime] = None
    ai_credits_remaining: int = 100  # Crédits IA pour trial
    ai_credits_used_this_month: int = 0
    last_credit_reset: Optional[datetime] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))



class WorkspaceCreate(BaseModel):
    name: str  # Nom de l'entreprise



class ManagerTransfer(BaseModel):
    """Modèle pour transférer un manager vers un autre magasin"""
    new_store_id: str



class SellerTransfer(BaseModel):
    """Modèle pour transférer un vendeur vers un autre magasin"""
    new_store_id: str
    new_manager_id: str  # Nouveau manager dans le nouveau magasin



class ManagerAssignment(BaseModel):
    """Modèle pour assigner un manager à un magasin"""
    manager_email: str


# ============================================
# GERANT INVITATION MODELS
# ============================================

