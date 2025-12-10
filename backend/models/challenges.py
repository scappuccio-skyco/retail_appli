"""
Challenges and gamification

All Pydantic models for challenges domain
"""
from __future__ import annotations  # For forward references
from pydantic import BaseModel, Field, EmailStr, ConfigDict
from typing import Optional, List, Dict
from datetime import datetime, timedelta, timezone
from uuid import uuid4
import uuid


class Challenge(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    manager_id: str
    title: str
    description: Optional[str] = None  # Description du challenge
    type: str  # "individual" or "collective"
    seller_id: Optional[str] = None  # Only for individual challenges
    visible: bool = True  # Visible by sellers
    visible_to_sellers: Optional[List[str]] = None  # Specific seller IDs (empty = all sellers)
    
    # NEW FLEXIBLE CHALLENGE SYSTEM (same as objectives)
    challenge_type: str  # "kpi_standard" | "product_focus" | "custom"
    kpi_name: Optional[str] = None  # For kpi_standard: "ca", "ventes", "articles"
    product_name: Optional[str] = None  # For product_focus: free text
    custom_description: Optional[str] = None  # For custom: free text description
    target_value: float  # Target value
    data_entry_responsible: str  # "manager" | "seller"
    current_value: float = 0.0  # Current progress value
    unit: Optional[str] = None  # Unit for display (€, ventes, articles, etc.)
    
    # Dates
    start_date: str  # Format: YYYY-MM-DD
    end_date: str  # Format: YYYY-MM-DD
    # Status
    status: str = "active"  # "active", "achieved", "failed"
    # Metadata
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    completed_at: Optional[datetime] = None



class ChallengeCreate(BaseModel):
    title: str
    description: Optional[str] = None  # Description du challenge
    type: str  # "individual" or "collective"
    seller_id: Optional[str] = None
    visible: bool = True  # Visible by sellers
    visible_to_sellers: Optional[List[str]] = None  # Specific seller IDs (empty = all sellers)
    
    # NEW FLEXIBLE CHALLENGE SYSTEM
    challenge_type: str  # "kpi_standard" | "product_focus" | "custom"
    kpi_name: Optional[str] = None  # For kpi_standard: "ca", "ventes", "articles"
    product_name: Optional[str] = None  # For product_focus: free text
    custom_description: Optional[str] = None  # For custom: free text description
    target_value: float  # Target value
    data_entry_responsible: str  # "manager" | "seller"
    unit: Optional[str] = None  # Unit for display
    
    start_date: str
    end_date: str



class ChallengeProgressUpdate(BaseModel):
    current_value: float  # New progress value

# ===== AUTH HELPERS =====


class DailyChallenge(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    seller_id: str
    date: str  # Format: YYYY-MM-DD
    competence: str  # accueil, decouverte, argumentation, closing, fidelisation
    title: str  # Ex: "Technique de Closing"
    description: str  # Le défi concret
    pedagogical_tip: str  # Le rappel/exemple
    examples: Optional[List[str]] = None  # 3 exemples concrets pour réussir le défi
    reason: str  # Pourquoi ce défi pour ce vendeur
    completed: bool = False
    challenge_result: Optional[str] = None  # 'success', 'partial', 'failed'
    feedback_comment: Optional[str] = None  # Commentaire optionnel du vendeur
    completed_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))



class DailyChallengeComplete(BaseModel):
    challenge_id: str
    result: str  # 'success', 'partial', 'failed'
    comment: Optional[str] = None

# ===== KPI MODELS =====
# KPI that sellers enter (raw data)
