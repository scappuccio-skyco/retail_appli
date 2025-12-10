"""
Manager objectives and progress tracking

All Pydantic models for objectives domain
"""
from __future__ import annotations  # For forward references
from pydantic import BaseModel, Field, EmailStr, ConfigDict
from typing import Optional, List, Dict
from datetime import datetime, timedelta, timezone
from uuid import uuid4
import uuid


class ManagerObjectives(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    manager_id: str
    title: str  # Nom de l'objectif
    description: Optional[str] = None  # Description de l'objectif
    type: str = "collective"  # "individual" or "collective"
    seller_id: Optional[str] = None  # Only for individual objectives
    visible: bool = True  # Visible by sellers
    visible_to_sellers: Optional[List[str]] = None  # Specific seller IDs (empty = all sellers)
    
    # NEW FLEXIBLE OBJECTIVE SYSTEM
    objective_type: str  # "kpi_standard" | "product_focus" | "custom"
    kpi_name: Optional[str] = None  # For kpi_standard: "ca", "ventes", "articles"
    product_name: Optional[str] = None  # For product_focus: free text
    custom_description: Optional[str] = None  # For custom: free text description
    target_value: float  # Target value
    data_entry_responsible: str  # "manager" | "seller"
    current_value: float = 0.0  # Current progress value
    unit: Optional[str] = None  # Unit for display (€, ventes, articles, etc.)
    
    period_start: str  # Format: YYYY-MM-DD
    period_end: str  # Format: YYYY-MM-DD
    status: str = "active"  # "active", "achieved", "failed"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))



class ManagerObjectivesCreate(BaseModel):
    title: str  # Nom de l'objectif
    description: Optional[str] = None  # Description de l'objectif
    type: str = "collective"  # "individual" or "collective"
    seller_id: Optional[str] = None  # Only for individual objectives
    visible: bool = True  # Visible by sellers
    visible_to_sellers: Optional[List[str]] = None  # Specific seller IDs (empty = all sellers)
    
    # NEW FLEXIBLE OBJECTIVE SYSTEM
    objective_type: str  # "kpi_standard" | "product_focus" | "custom"
    kpi_name: Optional[str] = None  # For kpi_standard: "ca", "ventes", "articles"
    product_name: Optional[str] = None  # For product_focus: free text
    custom_description: Optional[str] = None  # For custom: free text description
    target_value: float  # Target value
    data_entry_responsible: str  # "manager" | "seller"
    unit: Optional[str] = None  # Unit for display
    
    period_start: str
    period_end: str



class ObjectiveProgressUpdate(BaseModel):
    current_value: float  # New progress value

# ===== CHALLENGE MODELS (NEW FLEXIBLE SYSTEM) =====
