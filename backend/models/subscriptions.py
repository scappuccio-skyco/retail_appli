"""
Stripe subscriptions, payments and AI usage tracking

All Pydantic models for subscriptions domain
"""
from __future__ import annotations  # For forward references
from pydantic import BaseModel, Field, EmailStr, ConfigDict
from typing import Optional, List, Dict
from datetime import datetime, timedelta, timezone
from uuid import uuid4
import uuid


class Subscription(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    plan: str  # starter, professional, or enterprise
    status: str  # trialing, active, past_due, canceled, incomplete
    trial_start: Optional[datetime] = None
    trial_end: Optional[datetime] = None
    current_period_start: Optional[datetime] = None
    current_period_end: Optional[datetime] = None
    stripe_customer_id: Optional[str] = None
    stripe_subscription_id: Optional[str] = None
    stripe_subscription_item_id: Optional[str] = None  # Pour modifier la quantité de sièges
    cancel_at_period_end: Optional[bool] = False  # Si l'abonnement est programmé pour annulation
    canceled_at: Optional[datetime] = None  # Date de demande d'annulation
    seats: int = 1  # Nombre de sièges achetés
    used_seats: int = 0  # Nombre de vendeurs actifs (calculé dynamiquement)
    ai_credits_remaining: int = 0  # Crédits IA restants
    ai_credits_used_this_month: int = 0  # Crédits utilisés ce mois
    last_credit_reset: Optional[datetime] = None  # Dernière recharge mensuelle
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))



class SubscriptionHistory(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    subscription_id: str
    action: str  # "created", "upgraded", "downgraded", "seats_added", "seats_removed", "canceled", "reactivated"
    previous_plan: Optional[str] = None
    new_plan: Optional[str] = None
    previous_seats: Optional[int] = None
    new_seats: Optional[int] = None
    amount_charged: Optional[float] = None  # Montant facturé (peut être négatif si crédit)
    stripe_invoice_id: Optional[str] = None
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    metadata: Optional[dict] = None



class AIUsageLog(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    action_type: str  # Type d'action IA (diagnostic_seller, team_bilan, etc.)
    credits_consumed: int
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    metadata: Optional[dict] = None  # Infos supplémentaires (seller_id, etc.)



class PaymentTransaction(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    session_id: str
    amount: float
    currency: str
    plan: str
    payment_status: str  # pending, paid, failed, expired
    stripe_payment_intent_id: Optional[str] = None
    metadata: Optional[dict] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))



class CheckoutRequest(BaseModel):
    plan: str  # starter or professional
    origin_url: str
    quantity: Optional[int] = None  # Number of sellers (optional, defaults to current count)
    billing_period: Optional[str] = 'monthly'  # monthly or annual



class GerantCheckoutRequest(BaseModel):
    """Modèle pour la demande de checkout gérant"""
    origin_url: str
    quantity: Optional[int] = None  # Nombre de vendeurs (optionnel, par défaut = nombre actuel)
    billing_period: Optional[str] = 'monthly'  # monthly ou annual



class UpdateSeatsRequest(BaseModel):
    seats: int = Field(..., ge=1, le=15, description="Nombre de sièges (1-15)")


