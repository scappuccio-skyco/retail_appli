"""
Sales tracking, evaluations and debriefs

All Pydantic models for sales domain
"""
from __future__ import annotations  # For forward references
from pydantic import BaseModel, Field, EmailStr, ConfigDict
from typing import Optional, List, Dict
from datetime import datetime, timedelta, timezone
from uuid import uuid4
import uuid

# Littéraux réutilisés (Sonar: éviter duplication)
FIELD_DESC_NOTE_CONTENT = "Contenu de la note"


class Sale(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    seller_id: str
    store_name: str
    date: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    total_amount: float
    comments: Optional[str] = None



class SaleCreate(BaseModel):
    store_name: str
    total_amount: float
    comments: Optional[str] = None



class Evaluation(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    sale_id: str
    seller_id: str
    accueil: int  # 1-10
    decouverte: int  # 1-10
    argumentation: int  # 1-10
    closing: int  # 1-10
    fidelisation: int  # 1-10
    auto_comment: Optional[str] = None
    ai_feedback: Optional[str] = None
    radar_scores: dict = {}
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))



class EvaluationCreate(BaseModel):
    sale_id: str
    accueil: int
    decouverte: int
    argumentation: int
    closing: int
    fidelisation: int
    auto_comment: Optional[str] = None

# ===== DEBRIEF MODELS =====


class Debrief(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    seller_id: str
    # Type de vente
    vente_conclue: bool = False  # True = vente conclue, False = opportunité manquée
    visible_to_manager: bool = False  # Visibilité pour le manager
    # Section 1 - Contexte rapide
    produit: str
    type_client: str
    situation_vente: str
    # Section 2 - Ce qui s'est passé
    description_vente: str
    moment_perte_client: str  # Sera "moment_cle_succes" pour vente conclue
    raisons_echec: str  # Sera "facteurs_reussite" pour vente conclue
    amelioration_pensee: str  # Sera "ce_qui_a_fonctionne" pour vente conclue
    # AI Analysis
    ai_analyse: Optional[str] = None
    ai_points_travailler: Optional[str] = None
    ai_recommandation: Optional[str] = None
    ai_exemple_concret: Optional[str] = None
    # Scores de compétences sur 10 (une décimale) après ce débrief
    score_accueil: float = 0
    score_decouverte: float = 0
    score_argumentation: float = 0
    score_closing: float = 0
    score_fidelisation: float = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))



class DebriefCreate(BaseModel):
    vente_conclue: bool = False
    visible_to_manager: bool = False
    produit: str
    type_client: str
    situation_vente: str
    description_vente: str
    moment_perte_client: str
    raisons_echec: str
    amelioration_pensee: str

# ===== INTERVIEW NOTES MODELS =====


class InterviewNote(BaseModel):
    """
    Note d'entretien pour un vendeur.
    Permet au vendeur de prendre des notes quotidiennes pour préparer son entretien annuel.
    """
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    seller_id: str
    date: str = Field(..., description="Date de la note au format YYYY-MM-DD")
    content: str = Field(..., description=FIELD_DESC_NOTE_CONTENT)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class InterviewNoteCreate(BaseModel):
    """Modèle pour créer une note d'entretien"""
    date: str = Field(..., description="Date de la note au format YYYY-MM-DD")
    content: str = Field(..., description=FIELD_DESC_NOTE_CONTENT)


class InterviewNoteUpdate(BaseModel):
    """Modèle pour mettre à jour une note d'entretien"""
    content: str = Field(..., description=FIELD_DESC_NOTE_CONTENT)

