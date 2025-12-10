"""
API integrations and external system models

All Pydantic models for integrations domain
"""
from __future__ import annotations  # For forward references
from pydantic import BaseModel, Field, EmailStr, ConfigDict
from typing import Optional, List, Dict
from datetime import datetime, timedelta, timezone
from uuid import uuid4
import uuid


class APIKeyCreate(BaseModel):
    name: str
    permissions: List[str] = ["write:kpi", "read:stats"]
    expires_days: Optional[int] = None
    store_ids: Optional[List[str]] = None  # None = all stores, [] = no stores, [id1, id2] = specific stores



class APIKeyResponse(BaseModel):
    id: str
    name: str
    key: str  # Only shown once at creation
    permissions: List[str]
    active: bool
    created_at: str
    last_used_at: Optional[str]
    expires_at: Optional[str]
    store_ids: Optional[List[str]] = None



class KPIEntryIntegration(BaseModel):
    seller_id: Optional[str] = None
    manager_id: Optional[str] = None
    ca_journalier: float
    nb_ventes: int
    nb_articles: int
    prospects: Optional[int] = 0
    timestamp: Optional[str] = None



class KPISyncRequest(BaseModel):
    store_id: str
    date: str  # Format: YYYY-MM-DD
    kpi_entries: List[KPIEntryIntegration]
    source: str = "external_api"  # Identifier la source

# ============================================
# API INTEGRATION MODELS - User Management
# ============================================



class APIStoreCreate(BaseModel):
    """Créer un magasin via API"""
    name: str
    location: str
    address: Optional[str] = None
    phone: Optional[str] = None
    opening_hours: Optional[str] = None
    external_id: Optional[str] = None  # ID dans le système externe



class APIManagerCreate(BaseModel):
    """Créer un manager via API"""
    name: str
    email: EmailStr
    phone: Optional[str] = None
    external_id: Optional[str] = None  # ID dans le système externe
    send_invitation: bool = True  # Envoyer un email d'invitation



class APISellerCreate(BaseModel):
    """Créer un vendeur via API"""
    name: str
    email: EmailStr
    manager_id: Optional[str] = None  # ID du manager (optionnel)
    phone: Optional[str] = None
    external_id: Optional[str] = None  # ID dans le système externe
    send_invitation: bool = True  # Envoyer un email d'invitation



class APIUserUpdate(BaseModel):
    """Mettre à jour un utilisateur via API"""
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    status: Optional[str] = None  # "active" | "suspended"
    external_id: Optional[str] = None

# Generate secure API key


class SeedDatabaseRequest(BaseModel):
    secret_token: str

