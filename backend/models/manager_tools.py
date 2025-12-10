"""
Manager tools: requests, conflicts and AI advice

All Pydantic models for manager_tools domain
"""
from __future__ import annotations  # For forward references
from pydantic import BaseModel, Field, EmailStr, ConfigDict
from typing import Optional, List, Dict
from datetime import datetime, timedelta, timezone
from uuid import uuid4
import uuid


class ManagerRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    manager_id: str
    seller_id: str
    title: str
    message: str
    status: str = "pending"  # pending, completed
    seller_response: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    completed_at: Optional[datetime] = None



class ManagerRequestCreate(BaseModel):
    seller_id: str
    title: str
    message: str



class ManagerRequestResponse(BaseModel):
    request_id: str
    response: str

# ===== CONFLICT RESOLUTION MODELS =====


class ConflictResolution(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    manager_id: str
    seller_id: str
    # Questions structurées
    contexte: str  # Contexte général de la situation
    comportement_observe: str  # Comportement spécifique observé
    impact: str  # Impact sur l'équipe/performance/clients
    tentatives_precedentes: str  # Ce qui a déjà été tenté
    description_libre: str  # Détails supplémentaires
    # AI Analysis
    ai_analyse_situation: str  # Analyse de la situation
    ai_approche_communication: str  # Comment aborder la conversation
    ai_actions_concretes: list[str]  # Liste d'actions à mettre en place
    ai_points_vigilance: list[str]  # Points d'attention
    statut: str = "ouvert"  # ouvert, en_cours, resolu
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))



class ConflictResolutionCreate(BaseModel):
    seller_id: str
    contexte: str
    comportement_observe: str
    impact: str
    tentatives_precedentes: str
    description_libre: str

# ===== STORE KPI MODELS =====


class RelationshipAdviceRequest(BaseModel):
    seller_id: str
    advice_type: str  # "relationnel" or "conflit"
    situation_type: str  # "augmentation", "conflit_equipe", "demotivation", etc.
    description: str
    
