"""
KPI entries and configurations for sellers and managers

All Pydantic models for kpis domain
"""
from __future__ import annotations  # For forward references
from pydantic import BaseModel, Field, EmailStr, ConfigDict
from typing import Optional, List, Dict
from datetime import datetime, timedelta, timezone
from uuid import uuid4
import uuid


class KPIEntry(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    seller_id: str
    date: str  # Format: YYYY-MM-DD
    # Raw data entered by seller
    ca_journalier: float = 0
    nb_ventes: int = 0
    nb_clients: int = 0  # Number of clients served
    nb_articles: int = 0  # Number of articles sold
    nb_prospects: int = 0  # Number of prospects (foot traffic)
    # Calculated KPIs
    panier_moyen: float = 0
    taux_transformation: Optional[float] = None  # Can be calculated if prospects are tracked
    indice_vente: float = 0  # Articles / ventes (UPT)
    comment: Optional[str] = None
    source: str = "manual"  # "manual" (saisie utilisateur) ou "api" (logiciel de caisse)
    locked: bool = False  # True si provient de l'API (non modifiable)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))



class KPIEntryCreate(BaseModel):
    date: str
    ca_journalier: float = 0
    nb_ventes: int = 0
    nb_clients: int = 0
    nb_articles: int = 0
    nb_prospects: int = 0
    comment: Optional[str] = None



class KPIConfiguration(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    manager_id: str
    # Legacy fields (kept for backward compatibility)
    track_ca: bool = True
    track_ventes: bool = True
    track_articles: bool = True
    # New fields for mutual exclusivity between seller and manager tracking
    seller_track_ca: Optional[bool] = True
    manager_track_ca: Optional[bool] = False
    seller_track_ventes: Optional[bool] = True
    manager_track_ventes: Optional[bool] = False
    seller_track_clients: Optional[bool] = True
    manager_track_clients: Optional[bool] = False
    seller_track_articles: Optional[bool] = True
    manager_track_articles: Optional[bool] = False
    seller_track_prospects: Optional[bool] = True
    manager_track_prospects: Optional[bool] = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))



class KPIConfigUpdate(BaseModel):
    track_ca: Optional[bool] = None
    track_ventes: Optional[bool] = None
    track_clients: Optional[bool] = None
    track_articles: Optional[bool] = None
    track_prospects: Optional[bool] = None
    # New fields for mutual exclusivity
    seller_track_ca: Optional[bool] = None
    manager_track_ca: Optional[bool] = None
    seller_track_ventes: Optional[bool] = None
    manager_track_ventes: Optional[bool] = None
    seller_track_clients: Optional[bool] = None
    manager_track_clients: Optional[bool] = None
    seller_track_articles: Optional[bool] = None
    manager_track_articles: Optional[bool] = None
    seller_track_prospects: Optional[bool] = None
    manager_track_prospects: Optional[bool] = None


# ===== MANAGER OBJECTIVES MODELS (NEW FLEXIBLE SYSTEM) =====


class ManagerKPI(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    manager_id: str
    date: str  # Format: YYYY-MM-DD
    ca_journalier: Optional[float] = None
    nb_ventes: Optional[int] = None
    nb_clients: Optional[int] = None
    nb_articles: Optional[int] = None
    nb_prospects: Optional[int] = None
    source: str = "manual"  # "manual" (saisie utilisateur) ou "api" (logiciel de caisse)
    locked: bool = False  # True si provient de l'API (non modifiable)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))



class ManagerKPICreate(BaseModel):
    date: str
    ca_journalier: Optional[float] = None
    nb_ventes: Optional[int] = None
    nb_clients: Optional[int] = None
    nb_articles: Optional[int] = None
    nb_prospects: Optional[int] = None

# ===== DAILY CHALLENGE MODELS =====


class StoreKPI(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    manager_id: str
    date: str  # Format: YYYY-MM-DD
    nb_prospects: int  # Nombre de prospects entrés dans le magasin
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))



class StoreKPICreate(BaseModel):
    date: str
    nb_prospects: int

# ===== MANAGER KPI MODELS =====
