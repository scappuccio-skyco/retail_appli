"""
DISC diagnostics and team analysis

All Pydantic models for diagnostics domain
"""
from __future__ import annotations  # For forward references
from pydantic import BaseModel, Field, EmailStr, ConfigDict
from typing import Optional, List, Dict
from datetime import datetime, timedelta, timezone
from uuid import uuid4
import uuid


class DiagnosticResult(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    seller_id: str
    responses: dict
    ai_profile_summary: str
    style: str  # Convivial, Explorateur, Dynamique, Discret, Stratège
    level: str  # Débutant, Intermédiaire, Expert terrain
    motivation: str  # Relation, Reconnaissance, Performance, Découverte
    # Scores de compétences /5
    score_accueil: float = 0
    score_decouverte: float = 0
    score_argumentation: float = 0
    score_closing: float = 0
    score_fidelisation: float = 0
    # DISC Profile fields
    disc_dominant: str = None  # Dominant, Influent, Stable, Consciencieux
    disc_percentages: dict = None  # {'D': 30, 'I': 40, 'S': 20, 'C': 10}
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))



class DiagnosticResponse(BaseModel):
    """Modèle pour une réponse individuelle au diagnostic"""
    question_id: int = Field(..., description="ID numérique de la question")
    answer: str = Field(..., description="Réponse du vendeur (string)")
    question: Optional[str] = Field(None, description="Texte de la question (optionnel, pour debug)")

class DiagnosticCreate(BaseModel):
    """Modèle pour la création d'un diagnostic - accepte soit l'ancien format (dict) soit le nouveau (List[DiagnosticResponse])"""
    responses: dict  # Gardé pour compatibilité rétroactive



class ManagerDiagnosticResult(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    manager_id: str
    responses: dict
    profil_nom: str  # Le Pilote, Le Coach, Le Dynamiseur, Le Stratège, L'Inspire
    profil_description: str
    force_1: str
    force_2: str
    axe_progression: str
    recommandation: str
    exemple_concret: str
    # DISC Profile fields
    disc_dominant: str = None  # Dominant, Influent, Stable, Consciencieux
    disc_percentages: dict = None  # {'D': 30, 'I': 40, 'S': 20, 'C': 10}
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))



class ManagerDiagnosticCreate(BaseModel):
    responses: dict



class TeamBilan(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    manager_id: str
    periode: str  # "Semaine du X au Y"
    synthese: str  # Synthèse globale
    points_forts: list[str]  # Liste des points forts
    points_attention: list[str]  # Liste des points d'attention
    recommandations: list[str]  # Recommandations
    analyses_vendeurs: list[dict] = []  # Analyse détaillée par vendeur
    kpi_resume: dict  # Résumé des KPIs (CA, ventes, etc.)
    competences_moyenne: dict  # Moyenne des compétences de l'équipe
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))



class SellerBilan(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    seller_id: str
    periode: str  # "Semaine du X au Y"
    synthese: str  # Synthèse globale de la semaine du vendeur
    points_forts: list[str]  # Liste des points forts personnels
    points_attention: list[str]  # Liste des points d'attention personnels
    recommandations: list[str]  # Recommandations personnalisées
    kpi_resume: dict  # Résumé des KPIs personnels (CA, ventes, etc.)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

