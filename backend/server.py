from fastapi import FastAPI, APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional, Dict
import uuid
from datetime import datetime, timezone, timedelta, date
import bcrypt
import jwt
import secrets
from emergentintegrations.llm.chat import LlmChat, UserMessage
from emergentintegrations.payments.stripe.checkout import StripeCheckout, CheckoutSessionResponse, CheckoutStatusResponse, CheckoutSessionRequest
import asyncio
import json
from fastapi import Request
from collections import defaultdict
import time
from email_service import send_seller_invitation_email, send_manager_invitation_email, send_gerant_invitation_email

# Import enterprise routes
from enterprise_routes import enterprise_router, init_enterprise_router

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Configuration
JWT_SECRET = os.environ.get('JWT_SECRET', 'your-secret-key')

# ============================================================================
# CONFIDENTIALITÉ : Anonymisation pour IA
# ============================================================================

def anonymize_name_for_ai(full_name: str) -> str:
    """
    Anonymise le nom complet en gardant uniquement le prénom.
    Exemples:
    - "Marie Dupont" -> "Marie"
    - "Jean-Pierre Martin" -> "Jean-Pierre"
    - "Sophie" -> "Sophie"
    """
    if not full_name:
        return "Vendeur"
    
    # Garder uniquement le prénom (premier mot/groupe avant espace)
    first_name = full_name.strip().split()[0] if full_name.strip() else "Vendeur"
    return first_name

# ============================================================================
# HELPER FUNCTIONS FOR DATA FIELD CONSISTENCY
# ============================================================================

def get_ca_value(entry: dict, is_manager: bool = False) -> float:
    """
    Get CA value with consistent field naming.
    - Sellers use 'seller_ca'
    - Managers use 'ca_journalier'
    This ensures data consistency across the application.
    """
    if is_manager:
        return entry.get("ca_journalier", 0) or 0
    else:
        # For sellers, try seller_ca first (new standard), fallback to ca_journalier (legacy)
        return entry.get("seller_ca", 0) or entry.get("ca_journalier", 0) or 0

JWT_ALGORITHM = 'HS256'
JWT_EXPIRATION = 24  # hours

# Stripe Configuration
STRIPE_API_KEY = os.environ.get('STRIPE_API_KEY')
# Single Stripe Price ID with graduated pricing
STRIPE_PRICE_ID_MONTHLY = "price_1SS2XxIVM4C8dIGvpBRcYSNX"  # Tarif mensuel dégressif : 29€ (1-5) / 25€ (6-15)
STRIPE_PRICE_ID_ANNUAL = "price_1SSyK4IVM4C8dIGveBYOSf1m"  # Tarif annuel avec réduction de 20%

STRIPE_PLANS = {
    "starter": {
        "name": "Small Team",
        "price_per_seller": 29.0,  # 29€ par vendeur/mois (1-5 vendeurs)
        "currency": "eur",
        "min_sellers": 1,
        "max_sellers": 5,
        "ai_credits_monthly": None  # Calculé dynamiquement selon nombre de sièges
    },
    "professional": {
        "name": "Medium Team",
        "price_per_seller": 25.0,  # 25€ par vendeur/mois (6-15 vendeurs, dégressif)
        "currency": "eur",
        "min_sellers": 6,
        "max_sellers": 15,
        "ai_credits_monthly": None  # Calculé dynamiquement selon nombre de sièges
    },
    "enterprise": {
        "name": "Large Team",
        "price": None,  # Sur devis
        "currency": "eur",
        "min_sellers": 16,
        "max_sellers": 100,  # Illimité en pratique
        "ai_credits_monthly": None  # Calculé dynamiquement selon nombre de sièges
    }
}
TRIAL_DAYS = 14
MAX_SELLERS_TRIAL = 15  # Limite pendant la période d'essai
TRIAL_AI_CREDITS = 100  # Crédits IA pour l'essai gratuit

# ============================================================================
# RATE LIMITING CONFIGURATION
# ============================================================================

class RateLimiter:
    """
    Simple in-memory rate limiter for API keys
    Limits: 100 requests per minute per API key
    """
    def __init__(self, requests_per_minute: int = 100):
        self.requests_per_minute = requests_per_minute
        self.requests: Dict[str, List[float]] = defaultdict(list)
        self.cleanup_interval = 300  # Cleanup every 5 minutes
        self.last_cleanup = time.time()
    
    def is_allowed(self, api_key: str) -> bool:
        """Check if request is allowed for this API key"""
        now = time.time()
        
        # Periodic cleanup of old entries
        if now - self.last_cleanup > self.cleanup_interval:
            self._cleanup_old_entries(now)
        
        # Get requests for this key in the last minute
        minute_ago = now - 60
        recent_requests = [ts for ts in self.requests[api_key] if ts > minute_ago]
        
        # Check if limit exceeded
        if len(recent_requests) >= self.requests_per_minute:
            return False
        
        # Add current request
        recent_requests.append(now)
        self.requests[api_key] = recent_requests
        
        return True
    
    def _cleanup_old_entries(self, now: float):
        """Remove entries older than 1 minute"""
        minute_ago = now - 60
        keys_to_remove = []
        
        for api_key, timestamps in self.requests.items():
            recent = [ts for ts in timestamps if ts > minute_ago]
            if recent:
                self.requests[api_key] = recent
            else:
                keys_to_remove.append(api_key)
        
        for key in keys_to_remove:
            del self.requests[key]
        
        self.last_cleanup = now
    
    def get_remaining(self, api_key: str) -> int:
        """Get remaining requests for this API key"""
        now = time.time()
        minute_ago = now - 60
        recent_requests = [ts for ts in self.requests.get(api_key, []) if ts > minute_ago]
        return max(0, self.requests_per_minute - len(recent_requests))

# Initialize rate limiter
rate_limiter = RateLimiter(requests_per_minute=100)

# AI Credits Formula: 150 (manager base) + (30 × number of seats)
MANAGER_BASE_CREDITS = 150  # Base credits for manager analyses
CREDITS_PER_SEAT = 30  # Credits per seller seat


def calculate_monthly_ai_credits(seats: int) -> int:
    """
    Calculate monthly AI credits based on number of seats
    Formula: 150 (manager base) + (30 × seats)
    
    Examples:
    - 1 seat  → 150 + 30 = 180 credits
    - 5 seats → 150 + 150 = 300 credits
    - 10 seats → 150 + 300 = 450 credits
    - 15 seats → 150 + 450 = 600 credits
    """
    return MANAGER_BASE_CREDITS + (seats * CREDITS_PER_SEAT)

# AI Credit Costs (en crédits par appel)
AI_COSTS = {
    "diagnostic_seller": 2,
    "diagnostic_manager": 3,
    "team_bilan": 6,
    "individual_bilan": 2,
    "debrief": 1,
    "daily_challenge": 1,
    "kpi_analysis": 2,
    "evaluation_feedback": 1
}

# Credit pack for additional purchase
CREDIT_PACK_SIZE = 5000
CREDIT_PACK_PRICE = 25.0  # 25€ pour 5000 crédits

# Security
security = HTTPBearer()

app = FastAPI()

# Configure CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

api_router = APIRouter(prefix="/api")

# ===== HELPER FUNCTIONS =====
def extract_subscription_period(stripe_subscription):
    """
    Extract period_start and period_end from a Stripe subscription object.
    Stripe subscriptions don't have current_period_start/end as direct fields,
    we need to use billing_cycle_anchor and calculate based on interval.
    
    Args:
        stripe_subscription: Stripe subscription object from API
        
    Returns:
        tuple: (period_start datetime, period_end datetime) or (None, None)
    """
    from dateutil.relativedelta import relativedelta
    
    if not stripe_subscription or not stripe_subscription.get('billing_cycle_anchor'):
        return None, None
    
    try:
        period_start = datetime.fromtimestamp(
            stripe_subscription['billing_cycle_anchor'], 
            tz=timezone.utc
        )
        
        # Get interval from the plan/price
        if stripe_subscription.get('plan'):
            interval = stripe_subscription['plan'].get('interval', 'month')
            interval_count = stripe_subscription['plan'].get('interval_count', 1)
            
            if interval == 'year':
                period_end = period_start + relativedelta(years=interval_count)
            elif interval == 'month':
                period_end = period_start + relativedelta(months=interval_count)
            elif interval == 'day':
                period_end = period_start + relativedelta(days=interval_count)
            elif interval == 'week':
                period_end = period_start + relativedelta(weeks=interval_count)
            else:
                # Default to 1 month if interval is unknown
                period_end = period_start + relativedelta(months=1)
            
            return period_start, period_end
        
        return period_start, None
    except Exception as e:
        logging.error(f"Error extracting subscription period: {str(e)}")
        return None, None

# ===== MODELS =====
# ============================================
# STORE MODELS (Multi-Store Architecture)
# ============================================

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

class Workspace(BaseModel):
    """
    Workspace représente une entreprise/organisation cliente.
    Chaque workspace a un seul customer Stripe et un seul abonnement actif.
    """
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str  # Nom de l'entreprise (unique)
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
    accueil: int  # 1-5
    decouverte: int  # 1-5
    argumentation: int  # 1-5
    closing: int  # 1-5
    fidelisation: int  # 1-5
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
    # Scores de compétences /5 après ce débrief
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

class DiagnosticCreate(BaseModel):
    responses: dict

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
SELLER_INPUT_KPIS = {
    "ca_journalier": {
        "name": "Chiffre d'affaires",
        "unit": "€",
        "type": "number",
        "icon": "💰",
        "description": "Total des ventes de la journée"
    },
    "nb_ventes": {
        "name": "Nombre de ventes",
        "unit": "ventes",
        "type": "number",
        "icon": "🛍️",
        "description": "Nombre de transactions réalisées"
    }
}

# KPI calculated automatically from seller input
CALCULATED_KPIS = {
    "panier_moyen": {
        "name": "Panier moyen",
        "unit": "€",
        "formula": "ca_journalier / nb_ventes",
        "icon": "🛒"
    },
    "taux_transformation": {
        "name": "Taux de transformation",
        "unit": "%",
        "formula": "(nb_ventes / nb_prospects) * 100",
        "icon": "📈",
        "note": "Calculé au niveau magasin uniquement (manager)"
    },
    "indice_vente": {
        "name": "Indice de vente (UPT)",
        "unit": "articles/vente",
        "formula": "nb_articles / nb_ventes",
        "icon": "📊"
    }
}

def calculate_kpis(raw_data: dict) -> dict:
    """Calculate derived KPIs from raw seller input"""
    calculated = {}
    
    ca = raw_data.get('ca_journalier', 0)
    nb_ventes = raw_data.get('nb_ventes', 0)
    nb_clients = raw_data.get('nb_clients', 0)
    nb_articles = raw_data.get('nb_articles', 0)
    nb_prospects = raw_data.get('nb_prospects', 0)
    
    # Panier moyen = CA / nombre de ventes
    if nb_ventes > 0:
        calculated['panier_moyen'] = round(ca / nb_ventes, 2)
    else:
        calculated['panier_moyen'] = 0
    
    # Taux de transformation = (ventes / prospects) * 100
    if nb_prospects > 0:
        calculated['taux_transformation'] = round((nb_ventes / nb_prospects) * 100, 2)
    else:
        calculated['taux_transformation'] = None
    
    # Indice de vente (UPT - Units Per Transaction) = Articles / Ventes
    if nb_ventes > 0:
        calculated['indice_vente'] = round(nb_articles / nb_ventes, 2)
    else:
        calculated['indice_vente'] = 0
    
    return calculated

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
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class KPIEntryCreate(BaseModel):
    date: str
    ca_journalier: float = 0
    nb_ventes: int = 0
    nb_clients: int = 0
    nb_articles: int = 0
    nb_prospects: int = 0
    comment: Optional[str] = None

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
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_token(user_id: str, email: str, role: str) -> str:
    payload = {
        'user_id': user_id,
        'email': email,
        'role': role,
        'exp': datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    payload = decode_token(token)
    user = await db.users.find_one({"id": payload['user_id']}, {"_id": 0, "password": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

# ===== STRIPE AUTO-UPGRADE UTILITY =====
async def auto_update_stripe_subscription_quantity(gerant_id: str, reason: str = "seller_count_change"):
    """
    Vérifie et met à jour automatiquement la quantité de l'abonnement Stripe
    d'un gérant lorsque le nombre de vendeurs actifs change.
    
    Args:
        gerant_id: ID du gérant
        reason: Raison du changement (pour les logs)
    
    Returns:
        dict avec success, message, et détails de mise à jour
    """
    try:
        import stripe as stripe_lib
        stripe_lib.api_key = STRIPE_API_KEY
        
        # Compter les vendeurs actifs
        active_sellers_count = await db.users.count_documents({
            "gerant_id": gerant_id,
            "role": "seller",
            "status": "active"
        })
        
        # Récupérer les infos du gérant
        gerant = await db.users.find_one({"id": gerant_id}, {"_id": 0})
        if not gerant or not gerant.get('stripe_customer_id'):
            logger.info(f"Gérant {gerant_id} n'a pas de customer Stripe - skip auto-update")
            return {"success": False, "reason": "no_stripe_customer"}
        
        # Récupérer les abonnements actifs
        subscriptions = stripe_lib.Subscription.list(
            customer=gerant['stripe_customer_id'],
            status='active',
            limit=10
        )
        
        # Trouver un abonnement non annulé
        subscription = None
        for sub in subscriptions.data:
            if not sub.get('cancel_at_period_end', False):
                subscription = sub
                break
        
        # Si pas trouvé, vérifier les abonnements en trial
        if not subscription:
            trial_subs = stripe_lib.Subscription.list(
                customer=gerant['stripe_customer_id'],
                status='trialing',
                limit=10
            )
            for sub in trial_subs.data:
                if not sub.get('cancel_at_period_end', False):
                    subscription = sub
                    break
        
        if not subscription:
            logger.info(f"Aucun abonnement actif/trialing trouvé pour gérant {gerant_id}")
            return {"success": False, "reason": "no_active_subscription"}
        
        # Vérifier si l'abonnement a des items
        if not subscription.get('items') or not subscription['items'].data:
            logger.warning(f"Abonnement {subscription.id} n'a pas d'items")
            return {"success": False, "reason": "no_subscription_items"}
        
        subscription_item = subscription['items'].data[0]
        current_quantity = subscription_item['quantity']
        
        # Si la quantité est déjà correcte, pas besoin de mise à jour
        if current_quantity == active_sellers_count:
            logger.info(f"Quantité déjà correcte ({current_quantity}) pour gérant {gerant_id}")
            return {"success": True, "already_correct": True, "quantity": current_quantity}
        
        # Déterminer le nouveau prix par siège selon le palier
        if active_sellers_count <= 5:
            new_price_per_seat = 29
            tier = "starter"
        elif active_sellers_count <= 15:
            new_price_per_seat = 25
            tier = "professional"
        else:
            # Plus de 15 vendeurs nécessite un devis personnalisé
            logger.warning(f"Gérant {gerant_id} a {active_sellers_count} vendeurs (>15) - mise à jour manuelle requise")
            return {"success": False, "reason": "requires_custom_quote", "seller_count": active_sellers_count}
        
        # Mettre à jour la quantité de l'abonnement
        updated_subscription = stripe_lib.Subscription.modify(
            subscription.id,
            items=[{
                'id': subscription_item.id,
                'quantity': active_sellers_count
            }],
            proration_behavior='create_prorations',  # Proratiser les changements
            metadata={
                'auto_updated': 'true',
                'reason': reason,
                'previous_quantity': str(current_quantity),
                'new_quantity': str(active_sellers_count),
                'tier': tier,
                'updated_at': datetime.now(timezone.utc).isoformat()
            }
        )
        
        logger.info(
            f"✅ Abonnement Stripe auto-mis à jour pour gérant {gerant_id}: "
            f"{current_quantity} → {active_sellers_count} vendeurs "
            f"(Tier: {tier}, Prix: {new_price_per_seat}€/vendeur) "
            f"Raison: {reason}"
        )
        
        return {
            "success": True,
            "updated": True,
            "previous_quantity": current_quantity,
            "new_quantity": active_sellers_count,
            "tier": tier,
            "price_per_seat": new_price_per_seat,
            "subscription_id": subscription.id,
            "reason": reason
        }
        
    except Exception as e:
        logger.error(f"Erreur lors de la mise à jour auto Stripe pour gérant {gerant_id}: {str(e)}")
        return {"success": False, "error": str(e)}

# ===== AI FEEDBACK GENERATION =====
async def generate_ai_feedback(evaluation_data: dict) -> str:
    """Generate AI feedback using emergentintegrations"""
    try:
        api_key = os.environ.get('EMERGENT_LLM_KEY')
        chat = LlmChat(
            api_key=api_key,
            session_id=f"eval_{evaluation_data['id']}",
            system_message="Tu es un coach retail expert qui donne des conseils positifs et constructifs."
        ).with_model("openai", "gpt-4o-mini")
        
        prompt = f"""
Analyse cette auto-évaluation de vendeur retail:

- Accueil: {evaluation_data['accueil']}/5
- Découverte: {evaluation_data['decouverte']}/5
- Argumentation: {evaluation_data['argumentation']}/5
- Closing: {evaluation_data['closing']}/5
- Fidélisation: {evaluation_data['fidelisation']}/5

Commentaire du vendeur: {evaluation_data.get('auto_comment', 'Aucun')}

Résume les points forts et les points à améliorer de manière positive et coachante en 3-5 phrases maximum. Termine par une suggestion d'action concrète.
"""
        
        user_message = UserMessage(text=prompt)
        response = await chat.send_message(user_message)
        return response
    except Exception as e:
        logging.error(f"AI feedback generation error: {str(e)}")
        return "Feedback automatique temporairement indisponible. Continuez votre excellent travail!"

# ===== AUTH ROUTES =====
# ================== WORKSPACE ENDPOINTS ==================

@api_router.post("/workspaces/check-availability")
async def check_workspace_availability(data: dict):
    """
    Vérifie si un nom d'entreprise est disponible
    """
    workspace_name = data.get('name', '').strip()
    
    if not workspace_name:
        raise HTTPException(status_code=400, detail="Le nom de l'entreprise est requis")
    
    if len(workspace_name) < 3:
        raise HTTPException(status_code=400, detail="Le nom doit contenir au moins 3 caractères")
    
    # Vérifier si le nom existe déjà (insensible à la casse)
    existing = await db.workspaces.find_one({
        "name": {"$regex": f"^{workspace_name}$", "$options": "i"}
    }, {"_id": 0})
    
    if existing:
        return {
            "available": False,
            "message": "Ce nom d'entreprise est déjà utilisé"
        }
    
    return {
        "available": True,
        "message": "Ce nom est disponible"
    }

@api_router.get("/workspaces/me")
async def get_my_workspace(current_user: dict = Depends(get_current_user)):
    """
    Récupère le workspace de l'utilisateur actuel
    """
    if not current_user.get('workspace_id'):
        raise HTTPException(status_code=404, detail="Aucun workspace associé")
    
    workspace = await db.workspaces.find_one({"id": current_user['workspace_id']}, {"_id": 0})
    
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace introuvable")
    
    return workspace

# ================== AUTH ENDPOINTS ==================

@api_router.post("/auth/register")
async def register(user_data: UserCreate):
    # Check if user exists
    existing = await db.users.find_one({"email": user_data.email}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Force role to 'gérant' for public registration
    # Managers and sellers are invited by gérant
    user_data.role = "gérant"
    
    # Vérifier que le nom d'entreprise est fourni
    if not user_data.workspace_name:
        raise HTTPException(status_code=400, detail="Le nom de l'entreprise est requis")
    
    # Vérifier que le nom d'entreprise n'existe pas déjà
    if user_data.workspace_name:
        existing_workspace = await db.workspaces.find_one({
            "name": {"$regex": f"^{user_data.workspace_name}$", "$options": "i"}
        }, {"_id": 0})
        if existing_workspace:
            raise HTTPException(status_code=400, detail="Ce nom d'entreprise est déjà utilisé")
    
    workspace_id = None
    
    # Créer le workspace pour le gérant
    if user_data.role == "gérant":
        trial_start = datetime.now(timezone.utc)
        trial_end = trial_start + timedelta(days=TRIAL_DAYS)
        
        workspace = Workspace(
            name=user_data.workspace_name,
            subscription_status="trialing",
            trial_start=trial_start,
            trial_end=trial_end,
            ai_credits_remaining=TRIAL_AI_CREDITS,
            ai_credits_used_this_month=0,
            last_credit_reset=trial_start
        )
        
        workspace_doc = workspace.model_dump()
        workspace_doc['trial_start'] = workspace_doc['trial_start'].isoformat()
        workspace_doc['trial_end'] = workspace_doc['trial_end'].isoformat()
        workspace_doc['created_at'] = workspace_doc['created_at'].isoformat()
        workspace_doc['updated_at'] = workspace_doc['updated_at'].isoformat()
        if workspace_doc.get('current_period_start'):
            workspace_doc['current_period_start'] = workspace_doc['current_period_start'].isoformat()
        if workspace_doc.get('current_period_end'):
            workspace_doc['current_period_end'] = workspace_doc['current_period_end'].isoformat()
        if workspace_doc.get('last_credit_reset'):
            workspace_doc['last_credit_reset'] = workspace_doc['last_credit_reset'].isoformat()
        if workspace_doc.get('canceled_at'):
            workspace_doc['canceled_at'] = workspace_doc['canceled_at'].isoformat()
        
        await db.workspaces.insert_one(workspace_doc)
        workspace_id = workspace.id
        
        logger.info(f"Workspace created: {workspace.name} (ID: {workspace_id})")
    
    # Hash password
    hashed_pw = hash_password(user_data.password)
    
    # Create user with workspace_id
    user_dict = user_data.model_dump()
    user_dict.pop('password')
    user_dict.pop('workspace_name', None)  # Remove workspace_name from user dict
    user_dict['workspace_id'] = workspace_id  # Add workspace_id
    user_obj = User(**user_dict)
    
    doc = user_obj.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    doc['password'] = hashed_pw
    
    await db.users.insert_one(doc)
    
    logger.info(f"User created: {user_obj.email} (Role: {user_obj.role}, Workspace: {workspace_id})")
    
    # Create trial subscription for the new user
    if user_obj.role == "manager":
        trial_start = datetime.now(timezone.utc)
        trial_end = trial_start + timedelta(days=TRIAL_DAYS)
        
        trial_subscription = {
            "id": str(uuid.uuid4()),
            "user_id": user_obj.id,
            "workspace_id": workspace_id,
            "stripe_subscription_id": f"trial_{user_obj.id}",
            "stripe_customer_id": f"trial_cus_{user_obj.id}",
            "plan_id": "trial",
            "status": "trialing",
            "billing_interval": "monthly",
            "current_period_start": trial_start.isoformat(),
            "current_period_end": trial_end.isoformat(),
            "trial_start": trial_start.isoformat(),
            "trial_end": trial_end.isoformat(),
            "quantity": 1,
            "ai_credits_remaining": TRIAL_AI_CREDITS,
            "ai_credits_used_this_month": 0,
            "ai_credits_reset_date": trial_start.isoformat(),
            "created_at": trial_start.isoformat(),
            "updated_at": trial_start.isoformat()
        }
        
        await db.subscriptions.insert_one(trial_subscription)
        logger.info(f"Trial subscription created for {user_obj.email} with {TRIAL_AI_CREDITS} AI credits")
    
    # Create token
    token = create_token(user_obj.id, user_obj.email, user_obj.role)
    
    return {
        "user": user_obj.model_dump(),
        "token": token,
        "workspace_id": workspace_id
    }

@api_router.post("/auth/login")
async def login(credentials: UserLogin):
    user = await db.users.find_one({"email": credentials.email}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Identifiants invalides")
    
    if not verify_password(credentials.password, user['password']):
        raise HTTPException(status_code=401, detail="Identifiants invalides")
    
    token = create_token(user['id'], user['email'], user['role'])
    user.pop('password')
    
    return {
        "user": user,
        "token": token
    }

@api_router.get("/auth/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    return current_user

@api_router.post("/auth/register-with-invite")
async def register_with_invite(invite_data: RegisterWithInvite):
    # Verify invitation exists and is valid
    invitation = await db.invitations.find_one({"token": invite_data.invitation_token}, {"_id": 0})
    if not invitation:
        raise HTTPException(status_code=404, detail="Invitation not found")
    
    if invitation['status'] != 'pending':
        raise HTTPException(status_code=400, detail="Invitation already used")
    
    # Check expiration
    expires_at = datetime.fromisoformat(invitation['expires_at']) if isinstance(invitation['expires_at'], str) else invitation['expires_at']
    if expires_at < datetime.now(timezone.utc):
        await db.invitations.update_one({"token": invite_data.invitation_token}, {"$set": {"status": "expired"}})
        raise HTTPException(status_code=400, detail="Invitation expired")
    
    # Check if invitation email matches
    if invitation['email'] != invite_data.email:
        raise HTTPException(status_code=400, detail="Email does not match invitation")
    
    # Check if user already exists
    existing = await db.users.find_one({"email": invite_data.email}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create user with manager_id from invitation
    hashed_pw = hash_password(invite_data.password)
    user_obj = User(
        name=invite_data.name,
        email=invite_data.email,
        role="seller",
        manager_id=invitation['manager_id']
    )
    
    doc = user_obj.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    doc['password'] = hashed_pw
    
    await db.users.insert_one(doc)
    
    # Mark invitation as accepted
    await db.invitations.update_one({"token": invite_data.invitation_token}, {"$set": {"status": "accepted"}})
    
    # Create token
    token = create_token(user_obj.id, user_obj.email, user_obj.role)
    
    return {
        "user": user_obj.model_dump(),
        "token": token
    }


# ===== PASSWORD RESET ROUTES =====
class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(..., min_length=8)

@api_router.post("/auth/forgot-password")
async def forgot_password(request: ForgotPasswordRequest):
    """Demander la réinitialisation du mot de passe"""
    # Chercher l'utilisateur
    user = await db.users.find_one({"email": request.email}, {"_id": 0})
    
    # Toujours retourner success pour éviter l'énumération d'emails
    # Mais n'envoyer l'email que si l'utilisateur existe
    if user:
        # Générer un token de réinitialisation
        reset_token = secrets.token_urlsafe(32)
        expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)  # 10 minutes
        
        # Stocker le token dans une collection dédiée
        await db.password_resets.insert_one({
            "user_id": user['id'],
            "email": user['email'],
            "token": reset_token,
            "expires_at": expires_at,
            "used": False,
            "created_at": datetime.now(timezone.utc)
        })
        
        # Envoyer l'email
        from email_service import send_password_reset_email
        email_sent = send_password_reset_email(user['email'], user['name'], reset_token)
        
        if not email_sent:
            logging.error(f"Failed to send password reset email to {user['email']}")
            # Ne pas lever d'erreur pour éviter l'énumération d'emails
    
    return {
        "message": "Si un compte existe avec cet email, vous recevrez un lien de réinitialisation dans quelques instants."
    }

@api_router.get("/auth/reset-password/{token}")
async def verify_reset_token(token: str):
    """Vérifier la validité d'un token de réinitialisation"""
    reset_request = await db.password_resets.find_one(
        {"token": token, "used": False},
        {"_id": 0}
    )
    
    if not reset_request:
        raise HTTPException(status_code=404, detail="Token invalide ou déjà utilisé")
    
    # Vérifier l'expiration
    expires_at = reset_request['expires_at']
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    
    # MongoDB returns naive datetimes, make them timezone-aware
    if not hasattr(expires_at, 'tzinfo') or expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Le lien de réinitialisation a expiré")
    
    return {
        "valid": True,
        "email": reset_request['email']
    }

@api_router.post("/auth/reset-password")
async def reset_password(request: ResetPasswordRequest):
    """Réinitialiser le mot de passe avec un token valide"""
    # Vérifier le token
    reset_request = await db.password_resets.find_one(
        {"token": request.token, "used": False},
        {"_id": 0}
    )
    
    if not reset_request:
        raise HTTPException(status_code=404, detail="Token invalide ou déjà utilisé")
    
    # Vérifier l'expiration
    expires_at = reset_request['expires_at']
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    
    # Ensure both datetimes are timezone-aware for comparison
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Le lien de réinitialisation a expiré")
    
    # Mettre à jour le mot de passe
    hashed_password = hash_password(request.new_password)
    await db.users.update_one(
        {"id": reset_request['user_id']},
        {"$set": {"password": hashed_password}}
    )
    
    # Marquer le token comme utilisé
    await db.password_resets.update_one(
        {"token": request.token},
        {"$set": {"used": True, "used_at": datetime.now(timezone.utc)}}
    )
    
    return {
        "message": "Mot de passe réinitialisé avec succès"
    }


# ===== INVITATION ROUTES =====
# DISABLED: Only gerant can invite managers and sellers
# Managers can no longer invite sellers directly
# @api_router.post("/manager/invite", response_model=Invitation)
# async def create_invitation(invite_data: InvitationCreate, current_user: dict = Depends(get_current_user)):
#     if current_user['role'] != 'manager':
#         raise HTTPException(status_code=403, detail="Only managers can send invitations")
#     
#     # Check subscription access
#     access_info = await check_subscription_access(current_user['id'])
#     if not access_info['has_access']:
#         raise HTTPException(
#             status_code=403, 
#             detail=f"Abonnement requis pour inviter des vendeurs. {access_info.get('message', '')}"
#         )
#     
#     # Check seller limit
#     seller_check = await check_can_add_seller(current_user['id'])
#     if not seller_check['can_add']:
#         raise HTTPException(
#             status_code=400, 
#             detail=f"Limite atteinte : vous avez {seller_check['current']} vendeur(s) sur un maximum de {seller_check['max']} pour votre plan"
#         )
#     
#     # Check if user with this email already exists
#     existing_user = await db.users.find_one({"email": invite_data.email}, {"_id": 0})
#     if existing_user:
#         raise HTTPException(status_code=400, detail="User with this email already exists")
#     
#     # Check if there's already a pending invitation
#     existing_invite = await db.invitations.find_one({
#         "email": invite_data.email,
#         "manager_id": current_user['id'],
#         "status": "pending"
#     }, {"_id": 0})
#     
#     if existing_invite:
#         raise HTTPException(status_code=400, detail="Invitation already sent to this email")
#     
#     # Create invitation
#     invitation = Invitation(
#         email=invite_data.email,
#         manager_id=current_user['id'],
#         manager_name=current_user['name']
#     )
#     
#     doc = invitation.model_dump()
#     doc['created_at'] = doc['created_at'].isoformat()
#     doc['expires_at'] = doc['expires_at'].isoformat()
#     
#     await db.invitations.insert_one(doc)
#     
#     # Send invitation email
#     try:
#         # Get store name if available
#         store_name = None
#         if current_user.get('store_id'):
#             store = await db.stores.find_one({"id": current_user['store_id']}, {"_id": 0})
#             if store:
#                 store_name = store.get('name')
#         
#         send_seller_invitation_email(
#             recipient_email=invite_data.email,
#             recipient_name=invite_data.email.split('@')[0],  # Use email prefix as name
#             invitation_token=invitation.token,
#             manager_name=current_user['name'],
#             store_name=store_name
#         )
#         logger.info(f"Invitation email sent to {invite_data.email}")
#     except Exception as e:
#         logger.error(f"Failed to send invitation email: {e}")
#         # Continue even if email fails
#     
#     return invitation

@api_router.get("/manager/invitations")
async def get_invitations(
    store_id: str = None,
    current_user: dict = Depends(get_current_user)
):
    # Allow managers and gérants
    if current_user['role'] not in ['manager', 'gerant', 'gérant']:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Determine filter based on role and store_id
    if store_id and current_user['role'] in ['gerant', 'gérant']:
        # Gérant accessing specific store - filter by store_id
        invitations = await db.invitations.find({"store_id": store_id}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    elif current_user['role'] == 'manager':
        # Manager accessing their own invitations
        invitations = await db.invitations.find({"manager_id": current_user['id']}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    else:
        invitations = []
    
    for inv in invitations:
        if isinstance(inv.get('created_at'), str):
            inv['created_at'] = datetime.fromisoformat(inv['created_at'])
        if isinstance(inv.get('expires_at'), str):
            inv['expires_at'] = datetime.fromisoformat(inv['expires_at'])
    
    return invitations

@api_router.get("/invitations/verify/{token}")
async def verify_invitation(token: str):
    invitation = await db.invitations.find_one({"token": token}, {"_id": 0})

@api_router.patch("/users/{user_id}/link-manager")
async def link_seller_to_manager(user_id: str, manager_id: str, current_user: dict = Depends(get_current_user)):
    """Link an existing seller to a manager - admin/temporary endpoint"""
    # For now, allow any user to link (temporary for testing)
    result = await db.users.update_one(
        {"id": user_id, "role": "seller"},
        {"$set": {"manager_id": manager_id}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Seller not found")
    
    return {"message": "Seller linked to manager successfully", "user_id": user_id, "manager_id": manager_id}

    if not invitation:
        raise HTTPException(status_code=404, detail="Invitation not found")
    
    if invitation['status'] != 'pending':
        raise HTTPException(status_code=400, detail="Invitation already used or expired")
    
    # Check expiration
    expires_at = datetime.fromisoformat(invitation['expires_at']) if isinstance(invitation['expires_at'], str) else invitation['expires_at']
    if expires_at < datetime.now(timezone.utc):
        await db.invitations.update_one({"token": token}, {"$set": {"status": "expired"}})
        raise HTTPException(status_code=400, detail="Invitation expired")
    
    return {
        "email": invitation['email'],
        "manager_name": invitation['manager_name'],
        "expires_at": invitation['expires_at']
    }

# ===== SALES ROUTES =====
@api_router.post("/sales", response_model=Sale)
async def create_sale(sale_data: SaleCreate, current_user: dict = Depends(get_current_user)):
    if current_user['role'] != 'seller':
        raise HTTPException(status_code=403, detail="Only sellers can create sales")
    
    sale_dict = sale_data.model_dump()
    sale_dict['seller_id'] = current_user['id']
    sale_obj = Sale(**sale_dict)
    
    doc = sale_obj.model_dump()
    doc['date'] = doc['date'].isoformat()
    
    await db.sales.insert_one(doc)
    return sale_obj

@api_router.get("/sales", response_model=List[Sale])
async def get_sales(current_user: dict = Depends(get_current_user)):
    if current_user['role'] == 'seller':
        sales = await db.sales.find({"seller_id": current_user['id']}, {"_id": 0}).to_list(1000)
    else:
        # Manager sees all their sellers' sales
        sellers = await db.users.find({"manager_id": current_user['id']}, {"_id": 0}).to_list(1000)
        seller_ids = [s['id'] for s in sellers]
        sales = await db.sales.find({"seller_id": {"$in": seller_ids}}, {"_id": 0}).to_list(1000)
    
    for sale in sales:
        if isinstance(sale.get('date'), str):
            sale['date'] = datetime.fromisoformat(sale['date'])
    
    return sales

# ===== EVALUATION ROUTES =====
@api_router.post("/evaluations", response_model=Evaluation)
async def create_evaluation(eval_data: EvaluationCreate, current_user: dict = Depends(get_current_user)):
    if current_user['role'] != 'seller':
        raise HTTPException(status_code=403, detail="Only sellers can create evaluations")
    
    # Verify sale exists and belongs to seller
    sale = await db.sales.find_one({"id": eval_data.sale_id, "seller_id": current_user['id']}, {"_id": 0})
    if not sale:
        raise HTTPException(status_code=404, detail="Sale not found")
    
    eval_dict = eval_data.model_dump()
    eval_dict['seller_id'] = current_user['id']
    
    # Calculate radar scores
    radar_scores = {
        "accueil": eval_dict['accueil'],
        "decouverte": eval_dict['decouverte'],
        "argumentation": eval_dict['argumentation'],
        "closing": eval_dict['closing'],
        "fidelisation": eval_dict['fidelisation']
    }
    eval_dict['radar_scores'] = radar_scores
    
    eval_obj = Evaluation(**eval_dict)
    
    # Generate AI feedback
    ai_feedback = await generate_ai_feedback(eval_obj.model_dump())
    eval_obj.ai_feedback = ai_feedback
    
    doc = eval_obj.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.evaluations.insert_one(doc)
    return eval_obj

@api_router.get("/evaluations", response_model=List[Evaluation])
async def get_evaluations(current_user: dict = Depends(get_current_user)):
    if current_user['role'] == 'seller':
        evals = await db.evaluations.find({"seller_id": current_user['id']}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    else:
        # Manager sees all their sellers' evaluations
        sellers = await db.users.find({"manager_id": current_user['id']}, {"_id": 0}).to_list(1000)
        seller_ids = [s['id'] for s in sellers]
        evals = await db.evaluations.find({"seller_id": {"$in": seller_ids}}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    
    for evaluation in evals:
        if isinstance(evaluation.get('created_at'), str):
            evaluation['created_at'] = datetime.fromisoformat(evaluation['created_at'])
    
    return evals


# ===== DEBRIEF ROUTES =====

async def generate_ai_debrief_analysis(debrief_data: dict, seller_name: str, current_scores: dict, recent_kpis: dict = None) -> dict:
    """Generate AI coaching feedback for a debrief"""
    
    vente_conclue = debrief_data.get('vente_conclue', False)
    
    # Préparer le contexte KPI
    kpi_context = ""
    if recent_kpis:
        kpi_context = f"""
### 📊 PERFORMANCES RÉCENTES (dernière saisie KPI)
- Ventes : {recent_kpis.get('nb_ventes', 'N/A')}
- Chiffre d'affaires : {recent_kpis.get('chiffre_affaires', 'N/A')}€
- Panier moyen : {recent_kpis.get('panier_moyen', 'N/A')}€
- Articles vendus : {recent_kpis.get('nb_articles', 'N/A')}
- Indice de vente : {recent_kpis.get('indice_vente', 'N/A')}
"""
    
    if vente_conclue:
        # Prompt pour vente CONCLUE (succès)
        prompt = f"""Tu es un coach expert en vente retail.
Analyse la vente décrite pour identifier les facteurs de réussite et renforcer les compétences mobilisées.

### CONTEXTE
Tu viens d'analyser une vente qui s'est CONCLUE AVEC SUCCÈS ! Voici les détails :

🎯 Produit vendu : {debrief_data.get('produit')}
👥 Type de client : {debrief_data.get('type_client')}
💼 Situation : {debrief_data.get('situation_vente')}
💬 Description du déroulé : {debrief_data.get('description_vente')}
✨ Moment clé du succès : {debrief_data.get('moment_perte_client')}
🎉 Facteurs de réussite : {debrief_data.get('raisons_echec')}
💪 Ce qui a le mieux fonctionné : {debrief_data.get('amelioration_pensee')}
{kpi_context}
### SCORES ACTUELS DES COMPÉTENCES (sur 5)
- Accueil : {current_scores.get('accueil', 3.0)}
- Découverte : {current_scores.get('decouverte', 3.0)}
- Argumentation : {current_scores.get('argumentation', 3.0)}
- Closing : {current_scores.get('closing', 3.0)}
- Fidélisation : {current_scores.get('fidelisation', 3.0)}

### OBJECTIF
1. FÉLICITER le vendeur pour cette réussite avec enthousiasme !
2. Identifier 2 points forts qui ont contribué au succès (écoute, argumentation, closing, posture, etc.).
3. Donner 1 recommandation pour reproduire ou dépasser ce succès.
4. Donner 1 exemple concret et actionnable pour REPRODUIRE ce succès dans les prochaines ventes (ex: "La prochaine fois, commence aussi par une démonstration pour créer l'enthousiasme").
5. **IMPORTANT** : Réévaluer les 5 compétences en valorisant les points forts mobilisés.
   - Augmente les scores des compétences clés qui ont conduit au succès (+0.2 à +0.5)
   - Les scores doivent rester entre 1.0 et 5.0

### FORMAT DE SORTIE (JSON uniquement)
Réponds UNIQUEMENT avec un objet JSON valide comme ceci :
{{
  "analyse": "[2–3 phrases de FÉLICITATIONS enthousiastes et d'analyse des points forts, en tutoyant (Bravo ! Tu as réussi à...)]",
  "points_travailler": "[Point fort 1]\\n[Point fort 2]",
  "recommandation": "[Une phrase courte et motivante pour reproduire ce succès]",
  "exemple_concret": "[Action concrète pour REPRODUIRE ce succès la prochaine fois, commençant par 'La prochaine fois...' ou 'Pour refaire pareil...'. Si tu inclus une phrase à dire au client, utilise VOUS/VOTRE/VOS]",
  "score_accueil": 3.5,
  "score_decouverte": 4.0,
  "score_argumentation": 3.0,
  "score_closing": 3.5,
  "score_fidelisation": 4.0
}}

### STYLE ATTENDU
- Ton ENTHOUSIASTE, FÉLICITANT et encourageant
- TUTOIEMENT OBLIGATOIRE pour s'adresser au vendeur : "tu", "ta", "tes", "ton"
- **IMPORTANT** : Dans les exemples de dialogue avec le CLIENT, utilise TOUJOURS le VOUVOIEMENT ("vous", "votre", "vos")
- Vocabulaire positif : bravo, excellent, parfait, réussi, maîtrisé
- L'exemple doit mettre en valeur ce qui a fonctionné
- Maximum 12 lignes au total
"""
    else:
        # Prompt pour OPPORTUNITÉ MANQUÉE (échec)
        prompt = f"""Tu es un coach expert en vente retail.
Analyse la vente décrite pour identifier les causes probables de l'échec et proposer des leviers d'amélioration concrets.

### CONTEXTE
Tu viens de débriefer une opportunité qui n'a pas abouti. Voici les détails :

🎯 Produit : {debrief_data.get('produit')}
👥 Type de client : {debrief_data.get('type_client')}
💼 Situation : {debrief_data.get('situation_vente')}
💬 Description : {debrief_data.get('description_vente')}
📍 Moment clé du blocage : {debrief_data.get('moment_perte_client')}
❌ Raisons évoquées : {debrief_data.get('raisons_echec')}
🔄 Ce que tu penses pouvoir faire différemment : {debrief_data.get('amelioration_pensee')}
{kpi_context}
### SCORES ACTUELS DES COMPÉTENCES (sur 5)
- Accueil : {current_scores.get('accueil', 3.0)}
- Découverte : {current_scores.get('decouverte', 3.0)}
- Argumentation : {current_scores.get('argumentation', 3.0)}
- Closing : {current_scores.get('closing', 3.0)}
- Fidélisation : {current_scores.get('fidelisation', 3.0)}

### OBJECTIF
1. Fournir une analyse commerciale réaliste et empathique EN UTILISANT LE TUTOIEMENT ("tu").
2. Identifier 2 axes d'amélioration concrets (écoute, argumentation, closing, posture, etc.).
3. Donner 1 recommandation claire et motivante.
4. Ajouter 1 exemple concret de phrase ou de comportement à adopter.
5. **IMPORTANT** : Réévaluer les 5 compétences en fonction de ce débrief. 
   - Si une compétence était défaillante dans cette vente, ajuste son score légèrement à la baisse (-0.2 à -0.5)
   - Si une compétence était un point fort, maintiens ou augmente légèrement (+0.2)
   - Les scores doivent rester entre 1.0 et 5.0

### FORMAT DE SORTIE (JSON uniquement)
Réponds UNIQUEMENT avec un objet JSON valide comme ceci :
{{
  "analyse": "[2–3 phrases d'analyse réaliste, orientée performance, en tutoyant (tu as bien identifié...)]",
  "points_travailler": "[Axe 1 en tutoyant]\\n[Axe 2 en tutoyant]",
  "recommandation": "[Une phrase courte, claire et motivante en tutoyant — action directe à tester dès la prochaine vente]",
  "exemple_concret": "[Une phrase illustrant ce que tu aurais pu dire ou faire dans cette situation. Si tu proposes une phrase à dire au client, utilise VOUS/VOTRE/VOS]",
  "score_accueil": 3.5,
  "score_decouverte": 4.0,
  "score_argumentation": 3.0,
  "score_closing": 3.5,
  "score_fidelisation": 4.0
}}

### STYLE ATTENDU
- Ton professionnel, positif, utile et centré sur la performance commerciale
- TUTOIEMENT OBLIGATOIRE pour s'adresser au vendeur : utilise "tu", "ta", "tes", "ton"
- **IMPORTANT** : Dans les exemples de dialogue avec le CLIENT, utilise TOUJOURS le VOUVOIEMENT ("vous", "votre", "vos")
- Évite toute approche psychologique ou moralisante
- Utilise un vocabulaire de vendeur retail : client, besoin, argument, reformulation, closing, objection
- L'exemple doit être simple, réaliste et crédible
- Maximum 12 lignes au total
"""

    try:
        api_key = os.environ.get('EMERGENT_LLM_KEY')
        chat = LlmChat(
            api_key=api_key,
            session_id=f"debrief_{uuid.uuid4()}",
            system_message="Tu es un coach en vente retail professionnel. Tu réponds UNIQUEMENT en JSON valide."
        ).with_model("openai", "gpt-4o-mini")
        
        user_message = UserMessage(text=prompt)
        ai_response = await chat.send_message(user_message)
        
        # Parse JSON response
        import json
        # Remove markdown code blocks if present
        response_text = ai_response.strip()
        if response_text.startswith("```json"):
            response_text = response_text.replace("```json", "").replace("```", "").strip()
        elif response_text.startswith("```"):
            response_text = response_text.replace("```", "").strip()
            
        analysis = json.loads(response_text)
        
        return {
            "analyse": analysis.get("analyse", ""),
            "points_travailler": analysis.get("points_travailler", ""),
            "recommandation": analysis.get("recommandation", ""),
            "exemple_concret": analysis.get("exemple_concret", ""),
            "score_accueil": analysis.get("score_accueil", current_scores.get('accueil', 3.0)),
            "score_decouverte": analysis.get("score_decouverte", current_scores.get('decouverte', 3.0)),
            "score_argumentation": analysis.get("score_argumentation", current_scores.get('argumentation', 3.0)),
            "score_closing": analysis.get("score_closing", current_scores.get('closing', 3.0)),
            "score_fidelisation": analysis.get("score_fidelisation", current_scores.get('fidelisation', 3.0))
        }
    except Exception as e:
        print(f"Error generating AI debrief: {e}")
        # Fallback response
        return {
            "analyse": "Cette analyse montre une bonne capacité de recul. L'identification du moment clé du blocage est un excellent point de départ pour progresser.",
            "points_travailler": "• Renforcer la reformulation des besoins client pour mieux valider sa compréhension\n• Préparer des réponses aux objections courantes pour gagner en fluidité",
            "recommandation": "Dès la prochaine vente, pose une question de validation après la découverte du besoin.",
            "exemple_concret": "Tu aurais pu dire : 'Si je comprends bien, vous cherchez un produit qui combine [besoin 1] et [besoin 2], c'est bien ça ?'",
            "score_accueil": current_scores.get('accueil', 3.0),
            "score_decouverte": current_scores.get('decouverte', 3.0),
            "score_argumentation": current_scores.get('argumentation', 3.0),
            "score_closing": current_scores.get('closing', 3.0),
            "score_fidelisation": current_scores.get('fidelisation', 3.0)
        }

@api_router.post("/debriefs", response_model=Debrief)
async def create_debrief(debrief_data: DebriefCreate, current_user: dict = Depends(get_current_user)):
    if current_user['role'] != 'seller':
        raise HTTPException(status_code=403, detail="Only sellers can create debriefs")
    
    # Get current competence scores (from diagnostic or last debrief)
    current_scores = {'accueil': 3.0, 'decouverte': 3.0, 'argumentation': 3.0, 'closing': 3.0, 'fidelisation': 3.0}
    
    # Try to get from last debrief first
    last_debrief = await db.debriefs.find_one(
        {"seller_id": current_user['id']}, 
        {"_id": 0},
        sort=[("created_at", -1)]
    )
    
    if last_debrief:
        current_scores = {
            'accueil': last_debrief.get('score_accueil', 3.0),
            'decouverte': last_debrief.get('score_decouverte', 3.0),
            'argumentation': last_debrief.get('score_argumentation', 3.0),
            'closing': last_debrief.get('score_closing', 3.0),
            'fidelisation': last_debrief.get('score_fidelisation', 3.0)
        }
    else:
        # If no debrief, get from diagnostic
        diagnostic = await db.diagnostics.find_one({"seller_id": current_user['id']}, {"_id": 0})
        if diagnostic:
            current_scores = {
                'accueil': diagnostic.get('score_accueil', 3.0),
                'decouverte': diagnostic.get('score_decouverte', 3.0),
                'argumentation': diagnostic.get('score_argumentation', 3.0),
                'closing': diagnostic.get('score_closing', 3.0),
                'fidelisation': diagnostic.get('score_fidelisation', 3.0)
            }
    
    # Get recent KPIs for context
    recent_kpis = await db.kpi_entries.find_one(
        {"seller_id": current_user['id']},
        {"_id": 0},
        sort=[("date", -1)]
    )
    
    # Generate AI analysis with current scores and KPIs
    analysis = await generate_ai_debrief_analysis(
        debrief_data.model_dump(), 
        current_user['name'], 
        current_scores,
        recent_kpis
    )
    
    # Create debrief object
    debrief = Debrief(
        seller_id=current_user['id'],
        vente_conclue=debrief_data.vente_conclue,
        visible_to_manager=debrief_data.visible_to_manager,
        produit=debrief_data.produit,
        type_client=debrief_data.type_client,
        situation_vente=debrief_data.situation_vente,
        description_vente=debrief_data.description_vente,
        moment_perte_client=debrief_data.moment_perte_client,
        raisons_echec=debrief_data.raisons_echec,
        amelioration_pensee=debrief_data.amelioration_pensee,
        ai_analyse=analysis['analyse'],
        ai_points_travailler=analysis['points_travailler'],
        ai_recommandation=analysis['recommandation'],
        ai_exemple_concret=analysis['exemple_concret'],
        score_accueil=analysis['score_accueil'],
        score_decouverte=analysis['score_decouverte'],
        score_argumentation=analysis['score_argumentation'],
        score_closing=analysis['score_closing'],
        score_fidelisation=analysis['score_fidelisation']
    )
    
    # Save to database
    doc = debrief.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.debriefs.insert_one(doc)
    
    return debrief

@api_router.get("/debriefs")
async def get_debriefs(current_user: dict = Depends(get_current_user)):
    if current_user['role'] == 'seller':
        debriefs = await db.debriefs.find({"seller_id": current_user['id']}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    else:
        # Manager sees all their sellers' debriefs
        sellers = await db.users.find({"manager_id": current_user['id']}, {"_id": 0}).to_list(1000)
        seller_ids = [s['id'] for s in sellers]
        debriefs = await db.debriefs.find({"seller_id": {"$in": seller_ids}}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    
    for debrief in debriefs:
        if isinstance(debrief.get('created_at'), str):
            debrief['created_at'] = datetime.fromisoformat(debrief['created_at'])
    
    return debriefs

@api_router.patch("/debriefs/{debrief_id}/visibility")
async def update_debrief_visibility(
    debrief_id: str,
    visibility_data: dict,
    current_user: dict = Depends(get_current_user)
):
    """Update debrief visibility to manager"""
    if current_user['role'] != 'seller':
        raise HTTPException(status_code=403, detail="Only sellers can modify debrief visibility")
    
    # Verify debrief belongs to current user
    debrief = await db.debriefs.find_one({"id": debrief_id}, {"_id": 0})
    if not debrief or debrief.get('seller_id') != current_user['id']:
        raise HTTPException(status_code=404, detail="Debrief not found")
    
    visible_to_manager = visibility_data.get('visible_to_manager', False)
    
    # Update visibility
    await db.debriefs.update_one(
        {"id": debrief_id},
        {"$set": {"visible_to_manager": visible_to_manager}}
    )
    
    return {"success": True, "visible_to_manager": visible_to_manager}

@api_router.delete("/debriefs/{debrief_id}")
async def delete_debrief(
    debrief_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a debrief"""
    if current_user['role'] != 'seller':
        raise HTTPException(status_code=403, detail="Only sellers can delete their debriefs")
    
    # Verify debrief belongs to current user
    debrief = await db.debriefs.find_one({"id": debrief_id}, {"_id": 0})
    if not debrief or debrief.get('seller_id') != current_user['id']:
        raise HTTPException(status_code=404, detail="Debrief not found")
    
    # Delete debrief
    await db.debriefs.delete_one({"id": debrief_id})
    
    return {"success": True, "message": "Debrief deleted"}


@api_router.get("/competences/history")
async def get_competences_history(current_user: dict = Depends(get_current_user)):
    """Get competence scores history (diagnostic + all debriefs)"""
    if current_user['role'] != 'seller':
        raise HTTPException(status_code=403, detail="Only sellers can access their competences")
    
    history = []
    
    # Get diagnostic (initial scores)
    diagnostic = await db.diagnostics.find_one({"seller_id": current_user['id']}, {"_id": 0})
    if diagnostic:
        history.append({
            "type": "diagnostic",
            "date": diagnostic.get('created_at'),
            "score_accueil": diagnostic.get('score_accueil', 3.0),
            "score_decouverte": diagnostic.get('score_decouverte', 3.0),
            "score_argumentation": diagnostic.get('score_argumentation', 3.0),
            "score_closing": diagnostic.get('score_closing', 3.0),
            "score_fidelisation": diagnostic.get('score_fidelisation', 3.0)
        })
    
    # Get all debriefs (evolution)
    debriefs = await db.debriefs.find({"seller_id": current_user['id']}, {"_id": 0}).sort("created_at", 1).to_list(1000)
    for debrief in debriefs:
        history.append({
            "type": "debrief",
            "date": debrief.get('created_at'),
            "score_accueil": debrief.get('score_accueil', 3.0),
            "score_decouverte": debrief.get('score_decouverte', 3.0),
            "score_argumentation": debrief.get('score_argumentation', 3.0),
            "score_closing": debrief.get('score_closing', 3.0),
            "score_fidelisation": debrief.get('score_fidelisation', 3.0)
        })
    
    # Convert dates if needed
    for item in history:
        if isinstance(item.get('date'), str):
            item['date'] = datetime.fromisoformat(item['date'])
    
    return history

# ===== MANAGER ROUTES =====
@api_router.get("/manager/sellers")
async def get_sellers(
    store_id: str = None,
    current_user: dict = Depends(get_current_user)
):
    # Allow managers and gérants (gérants can access with store_id parameter)
    if current_user['role'] not in ['manager', 'gerant', 'gérant']:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Determine which store_id to use
    effective_store_id = None
    if store_id and current_user['role'] in ['gerant', 'gérant']:
        # Gérant accessing specific store - use provided store_id
        effective_store_id = store_id
    elif current_user.get('store_id'):
        # Manager accessing their own store
        effective_store_id = current_user['store_id']
    
    # Priority: effective_store_id > workspace_id > manager_id
    if effective_store_id:
        # Use store_id for filtering (most reliable for multi-store architecture)
        filter_query = {
            "store_id": effective_store_id,
            "role": "seller",
            "status": {"$nin": ["deleted", "inactive"]}
        }
    elif current_user.get('workspace_id'):
        # Fallback to workspace_id if no store_id
        filter_query = {
            "workspace_id": current_user['workspace_id'], 
            "role": "seller",
            "status": {"$nin": ["deleted", "inactive"]}
        }
    else:
        # Final fallback to manager_id for old data
        filter_query = {
            "manager_id": current_user['id'],
            "role": "seller",
            "status": {"$nin": ["deleted", "inactive"]}
        }
    
    sellers = await db.users.find(filter_query, {"_id": 0, "password": 0}).to_list(1000)
    
    # Add stats for each seller
    result = []
    for seller in sellers:
        # Get diagnostic
        diagnostic = await db.diagnostics.find_one({"seller_id": seller['id']}, {"_id": 0})
        
        # Get debriefs
        debriefs = await db.debriefs.find({"seller_id": seller['id']}, {"_id": 0}).to_list(1000)
        
        avg_score = 0
        last_feedback_date = None
        total_evaluations = 0
        
        # Calculate average score from diagnostic and debriefs
        scores = []
        if diagnostic:
            diag_score = (
                diagnostic.get('score_accueil', 0) + 
                diagnostic.get('score_decouverte', 0) + 
                diagnostic.get('score_argumentation', 0) + 
                diagnostic.get('score_closing', 0) + 
                diagnostic.get('score_fidelisation', 0)
            ) / 5
            scores.append(diag_score)
            last_feedback_date = diagnostic.get('created_at')
            total_evaluations += 1
        
        for debrief in debriefs:
            debrief_score = (
                debrief.get('score_accueil', 0) + 
                debrief.get('score_decouverte', 0) + 
                debrief.get('score_argumentation', 0) + 
                debrief.get('score_closing', 0) + 
                debrief.get('score_fidelisation', 0)
            ) / 5
            scores.append(debrief_score)
            
            # Update last feedback date if this debrief is more recent
            if debrief.get('created_at'):
                if not last_feedback_date or debrief['created_at'] > last_feedback_date:
                    last_feedback_date = debrief['created_at']
        
        total_evaluations += len(debriefs)
        
        if scores:
            avg_score = sum(scores) / len(scores)
        
        result.append({
            **seller,
            "avg_score": round(avg_score, 2),
            "last_feedback_date": last_feedback_date,
            "total_evaluations": total_evaluations
        })
    
    return result



@api_router.get("/manager/sellers/archived")
async def get_archived_sellers(current_user: dict = Depends(get_current_user)):
    """Récupérer les vendeurs inactifs ou supprimés (archivés)"""
    if current_user['role'] != 'manager':
        raise HTTPException(status_code=403, detail="Only managers can access this")
    
    # Filter by workspace_id for archived sellers
    filter_query = {
        "workspace_id": current_user.get('workspace_id'),
        "role": "seller",
        "status": {"$in": ["inactive", "deleted"]}
    }
    
    if not current_user.get('workspace_id'):
        # Fallback to manager_id for old data
        filter_query = {
            "manager_id": current_user['id'],
            "status": {"$in": ["inactive", "deleted"]}
        }
    
    archived_sellers = await db.users.find(filter_query, {"_id": 0, "password": 0}).to_list(1000)
    
    return archived_sellers

@api_router.put("/manager/seller/{seller_id}/deactivate")
async def deactivate_seller(seller_id: str, current_user: dict = Depends(get_current_user)):
    """Désactiver/Mettre en sommeil un vendeur - libère un siège"""
    if current_user['role'] != 'manager':
        raise HTTPException(status_code=403, detail="Only managers can access this")
    
    # Vérifier que le vendeur appartient au manager
    seller = await db.users.find_one({
        "id": seller_id,
        "$or": [
            {"manager_id": current_user['id']},
            {"workspace_id": current_user.get('workspace_id')}
        ],
        "role": "seller"
    })
    
    if not seller:
        raise HTTPException(status_code=404, detail="Seller not found")
    
    if seller.get('status') == 'inactive':
        raise HTTPException(status_code=400, detail="Seller is already inactive")
    
    if seller.get('status') == 'deleted':
        raise HTTPException(status_code=400, detail="Cannot deactivate a deleted seller")
    
    # Désactiver le vendeur
    await db.users.update_one(
        {"id": seller_id},
        {"$set": {
            "status": "inactive",
            "deactivated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    logger.info(f"Seller {seller_id} deactivated by manager {current_user['id']}")
    
    return {
        "success": True,
        "message": f"Vendeur {seller['name']} désactivé avec succès",
        "seller_id": seller_id,
        "status": "inactive"
    }

@api_router.put("/manager/seller/{seller_id}/reactivate")
async def reactivate_seller(seller_id: str, current_user: dict = Depends(get_current_user)):
    """Réactiver un vendeur en sommeil - consomme un siège"""
    if current_user['role'] != 'manager':
        raise HTTPException(status_code=403, detail="Only managers can access this")
    
    # Vérifier que le vendeur appartient au manager
    seller = await db.users.find_one({
        "id": seller_id,
        "$or": [
            {"manager_id": current_user['id']},
            {"workspace_id": current_user.get('workspace_id')}
        ],
        "role": "seller"
    })
    
    if not seller:
        raise HTTPException(status_code=404, detail="Seller not found")
    
    if seller.get('status') == 'active':
        raise HTTPException(status_code=400, detail="Seller is already active")
    
    if seller.get('status') == 'deleted':
        raise HTTPException(status_code=400, detail="Cannot reactivate a deleted seller")
    
    # Vérifier si le manager a des sièges disponibles
    # Compter les vendeurs actifs dans le workspace
    workspace_id = current_user.get('workspace_id')
    active_sellers_count = await db.users.count_documents({
        "workspace_id": workspace_id,
        "role": "seller",
        "status": "active"
    })
    
    # Récupérer le workspace pour voir les sièges disponibles
    workspace = await get_user_workspace(current_user['id'])
    if workspace:
        # Sync with Stripe to get accurate seats count
        seats = workspace.get('seats')
        
        # If seats not set in workspace, try to get from Stripe
        if not seats and workspace.get('stripe_subscription_id'):
            try:
                import stripe as stripe_lib
                stripe_lib.api_key = STRIPE_API_KEY
                stripe_sub = stripe_lib.Subscription.retrieve(workspace['stripe_subscription_id'])
                if stripe_sub and stripe_sub.get('items') and stripe_sub['items']['data']:
                    seats = stripe_sub['items']['data'][0].get('quantity', 1)
                    # Update workspace with seats
                    await db.workspaces.update_one(
                        {"id": workspace_id},
                        {"$set": {"seats": seats, "updated_at": datetime.now(timezone.utc).isoformat()}}
                    )
            except Exception as e:
                logger.error(f"Error fetching seats from Stripe: {e}")
                seats = 1
        
        if not seats:
            seats = 1  # Default fallback
            
        if active_sellers_count >= seats:
            raise HTTPException(
                status_code=400, 
                detail=f"Tous vos sièges sont utilisés ({active_sellers_count}/{seats}). Augmentez votre nombre de sièges pour réactiver ce vendeur."
            )
    
    # Réactiver le vendeur
    await db.users.update_one(
        {"id": seller_id},
        {"$set": {
            "status": "active",
            "deactivated_at": None
        }}
    )
    
    logger.info(f"Seller {seller_id} reactivated by manager {current_user['id']}")
    
    return {
        "success": True,
        "message": f"Vendeur {seller['name']} réactivé avec succès",
        "seller_id": seller_id,
        "status": "active"
    }

@api_router.delete("/manager/seller/{seller_id}")
async def delete_seller(seller_id: str, current_user: dict = Depends(get_current_user)):
    """Supprimer définitivement un vendeur - libère un siège (soft delete)"""
    if current_user['role'] != 'manager':
        raise HTTPException(status_code=403, detail="Only managers can access this")
    
    # Vérifier que le vendeur appartient au manager
    seller = await db.users.find_one({
        "id": seller_id,
        "$or": [
            {"manager_id": current_user['id']},
            {"workspace_id": current_user.get('workspace_id')}
        ],
        "role": "seller"
    })
    
    if not seller:
        raise HTTPException(status_code=404, detail="Seller not found")
    
    if seller.get('status') == 'deleted':
        raise HTTPException(status_code=400, detail="Seller is already deleted")
    
    # Soft delete : marquer comme supprimé (ne pas vraiment supprimer pour garder l'historique)
    await db.users.update_one(
        {"id": seller_id},
        {"$set": {
            "status": "deleted",
            "deleted_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    logger.info(f"Seller {seller_id} deleted by manager {current_user['id']}")
    
    return {
        "success": True,
        "message": f"Vendeur {seller['name']} supprimé avec succès",
        "seller_id": seller_id,
        "status": "deleted"
    }

@api_router.get("/manager/seller/{seller_id}/stats")
async def get_seller_stats(seller_id: str, current_user: dict = Depends(get_current_user)):
    if current_user['role'] != 'manager':
        raise HTTPException(status_code=403, detail="Only managers can access this")
    
    # Verify seller belongs to manager's store
    seller = await db.users.find_one({
        "id": seller_id,
        "store_id": current_user.get('store_id'),
        "role": "seller"
    }, {"_id": 0, "password": 0})
    if not seller:
        raise HTTPException(status_code=404, detail="Seller not found in your store")
    
    # Get diagnostic and debriefs instead of evaluations
    diagnostic = await db.diagnostics.find_one({"seller_id": seller_id}, {"_id": 0})
    debriefs = await db.debriefs.find({"seller_id": seller_id}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    
    # Combine into evaluations list for backwards compatibility
    evals = []
    
    if diagnostic:
        evals.append({
            "id": diagnostic.get('id'),
            "created_at": diagnostic.get('created_at'),
            "accueil": diagnostic.get('score_accueil', 3.0),
            "decouverte": diagnostic.get('score_decouverte', 3.0),
            "argumentation": diagnostic.get('score_argumentation', 3.0),
            "closing": diagnostic.get('score_closing', 3.0),
            "fidelisation": diagnostic.get('score_fidelisation', 3.0),
            "type": "diagnostic"
        })
    
    for debrief in debriefs:
        evals.append({
            "id": debrief.get('id'),
            "created_at": debrief.get('created_at'),
            "accueil": debrief.get('score_accueil', 3.0),
            "decouverte": debrief.get('score_decouverte', 3.0),
            "argumentation": debrief.get('score_argumentation', 3.0),
            "closing": debrief.get('score_closing', 3.0),
            "fidelisation": debrief.get('score_fidelisation', 3.0),
            "type": "debrief"
        })
    
    for evaluation in evals:
        if isinstance(evaluation.get('created_at'), str):
            evaluation['created_at'] = datetime.fromisoformat(evaluation['created_at'])
    
    # Calculate competence scores based ONLY on questionnaire and debriefs
    # NO KPI adjustment - competences are behavioral, not commercial
    avg_radar = {"accueil": 0, "decouverte": 0, "argumentation": 0, "closing": 0, "fidelisation": 0}
    
    if diagnostic or debriefs:
        # Collect all behavioral evaluations (diagnostic + debriefs)
        all_scores = {
            'accueil': [],
            'decouverte': [],
            'argumentation': [],
            'closing': [],
            'fidelisation': []
        }
        
        # Add diagnostic scores (if exists)
        if diagnostic:
            all_scores['accueil'].append(diagnostic.get('score_accueil', 0))
            all_scores['decouverte'].append(diagnostic.get('score_decouverte', 0))
            all_scores['argumentation'].append(diagnostic.get('score_argumentation', 0))
            all_scores['closing'].append(diagnostic.get('score_closing', 0))
            all_scores['fidelisation'].append(diagnostic.get('score_fidelisation', 0))
        
        # Add debrief scores (most recent ones have more weight)
        for debrief in debriefs[:5]:  # Consider only last 5 debriefs
            all_scores['accueil'].append(debrief.get('score_accueil', 0))
            all_scores['decouverte'].append(debrief.get('score_decouverte', 0))
            all_scores['argumentation'].append(debrief.get('score_argumentation', 0))
            all_scores['closing'].append(debrief.get('score_closing', 0))
            all_scores['fidelisation'].append(debrief.get('score_fidelisation', 0))
        
        # Calculate average for each competence
        for competence in ['accueil', 'decouverte', 'argumentation', 'closing', 'fidelisation']:
            scores = [s for s in all_scores[competence] if s > 0]  # Filter out zeros
            if scores:
                avg_radar[competence] = round(sum(scores) / len(scores), 1)
            else:
                avg_radar[competence] = 0
    
    return {
        "seller": seller,
        "evaluations": evals,
        "avg_radar_scores": avg_radar,
        "diagnostic": {"level": diagnostic.get('level')} if diagnostic else None
    }

@api_router.get("/manager/seller/{seller_id}/diagnostic")
async def get_seller_diagnostic(seller_id: str, current_user: dict = Depends(get_current_user)):
    """Get diagnostic info for a seller (for manager use - minimal data)"""
    if current_user['role'] != 'manager':
        raise HTTPException(status_code=403, detail="Only managers can access this")
    
    # Verify seller belongs to manager's store
    seller = await db.users.find_one({
        "id": seller_id,
        "store_id": current_user.get('store_id'),
        "role": "seller"
    }, {"_id": 0})
    if not seller:
        raise HTTPException(status_code=404, detail="Seller not found in your store")
    
    # Get diagnostic (include level and style for team table display)
    diagnostic = await db.diagnostics.find_one({"seller_id": seller_id}, {"_id": 0, "seller_id": 1, "level": 1, "style": 1, "created_at": 1})
    
    if not diagnostic:
        return None
    
    return diagnostic


# ===== DIAGNOSTIC ROUTES =====
async def analyze_diagnostic_with_ai(responses: dict) -> dict:
    """Analyze diagnostic responses with AI"""
    try:
        api_key = os.environ.get('EMERGENT_LLM_KEY')
        chat = LlmChat(
            api_key=api_key,
            session_id=f"diagnostic_{uuid.uuid4()}",
            system_message="Tu es un expert en analyse comportementale de vendeurs retail."
        ).with_model("openai", "gpt-4o-mini")
        
        # Format responses for prompt
        responses_text = ""
        for q_num, answer in responses.items():
            responses_text += f"\nQuestion {q_num}: {answer}\n"
        
        prompt = f"""Voici les réponses d'un vendeur à un test comportemental de 15 questions :

{responses_text}

Analyse ses réponses pour identifier :
- son style de vente dominant (Convivial, Explorateur, Dynamique, Discret ou Stratège)
- son niveau global selon cette échelle gamifiée (utilise ces niveaux UNIQUEMENT) :
  * **Explorateur** (🟢 Niveau 1) : Découvre le terrain, teste, apprend les bases. Curieux et volontaire.
  * **Challenger** (🟡 Niveau 2) : A pris ses repères, cherche à performer, teste de nouvelles approches.
  * **Ambassadeur** (🟠 Niveau 3) : Inspire confiance, maîtrise les étapes de la vente, partage ses pratiques.
  * **Maître du Jeu** (🔴 Niveau 4) : Expert de la relation client, capable d'adapter son style et d'entraîner les autres.
- ses leviers de motivation (Relation, Reconnaissance, Performance, Découverte)

Rédige un retour structuré :
- Une phrase d'introduction qui décrit son style.
- Deux points forts concrets observés dans ses réponses.
- Un axe d'amélioration principal avec un conseil précis.
- Une phrase motivante adaptée à son profil.

Utilise un ton bienveillant, professionnel et simple. Évite le jargon.

Réponds au format JSON avec cette structure exacte :
{{
  "style": "Convivial|Explorateur|Dynamique|Discret|Stratège",
  "level": "Nouveau Talent|Challenger|Ambassadeur|Maître du Jeu",
  "motivation": "Relation|Reconnaissance|Performance|Découverte",
  "summary": "Ton analyse complète en texte"
}}"""
        
        user_message = UserMessage(text=prompt)
        response = await chat.send_message(user_message)
        
        # Parse JSON response
        import json
        # Remove markdown code blocks if present
        clean_response = response.strip()
        if clean_response.startswith("```json"):
            clean_response = clean_response[7:]
        if clean_response.startswith("```"):
            clean_response = clean_response[3:]
        if clean_response.endswith("```"):
            clean_response = clean_response[:-3]
        clean_response = clean_response.strip()
        
        result = json.loads(clean_response)
        return result
    except Exception as e:
        logging.error(f"AI diagnostic analysis error: {str(e)}")
        # Fallback analysis
        return {
            "style": "Convivial",
            "level": "Challenger",
            "motivation": "Relation",
            "summary": "Profil en cours d'analyse. Votre diagnostic a été enregistré avec succès."
        }

def calculate_competence_scores_from_questionnaire(responses: dict) -> dict:
    """
    Calculate competence scores from questionnaire responses
    Questions 1-15 are mapped to 5 competences (3 questions each)
    """
    # Mapping: Question ID -> Competence
    # Q1-3: Accueil, Q4-6: Découverte, Q7-9: Argumentation, Q10-12: Closing, Q13-15: Fidélisation
    competence_mapping = {
        'accueil': [1, 2, 3],
        'decouverte': [4, 5, 6],
        'argumentation': [7, 8, 9],
        'closing': [10, 11, 12],
        'fidelisation': [13, 14, 15]
    }
    
    # Scoring system: Each question has different point values based on quality of answer
    # For choice questions: option index 0=high score, 1=medium, 2=low (generally)
    # We'll use a scoring matrix based on question content
    
    question_scores = {
        # Accueil (Q1-3)
        1: [5, 3, 4],  # Q1: "signe/mot" (5), "finis puis vois" (3), "regard/sourire" (4)
        2: [5, 4, 3, 2],  # Q2: sourire/attitude (5), disponibilité (4), professionnalisme (3), connaissance (2)
        3: [3, 5, 4],  # Q3: "montre idées" (3), "pose questions" (5), "évite doublons" (4)
        
        # Découverte (Q4-6)
        4: [5, 4, 3],  # Q4: "écoute attentivement" (5), "recentre" (4), "partage" (3)
        5: [5, 4, 4, 3],  # Q5: questions ouvertes (5), écoute (4), observe (4), complémentaires (3)
        6: [5, 3, 4],  # Q6: "demande ce qu'il compare" (5), "propose offres" (3), "respecte" (4)
        
        # Argumentation (Q7-9)
        7: [3, 5, 4],  # Q7: "caractéristiques" (3), "répond besoins" (5), "avis clients" (4)
        8: [3, 5, 4, 3],  # Q8: "reste arguments" (3), "écoute objections" (5), "change produit" (4), "concessions" (3)
        9: [4, 3, 5],  # Q9: "justifie prix" (4), "propose moins cher" (3), "comprend budget" (5)
        
        # Closing (Q10-12)
        10: [5, 4, 5, 3],  # Q10: livraison/paiement (5), manipule produit (4), arrête questions (5), demande promos (3)
        11: [4, 3, 5],  # Q11: "relance" (4), "laisse temps" (3), "dernier argument" (5)
        12: [5, 4, 5, 3],  # Q12: choix entre deux (5), urgence (4), résume avantages (5), facilités (3)
        
        # Fidélisation (Q13-15)
        13: [4, 4, 5, 5],  # Q13: programme fidélité (4), coordonnées (4), conseils (5), nouveautés (5)
        14: [4, 5, 3],  # Q14: "solution rapide" (4), "écoute d'abord" (5), "compensation" (3)
        15: [5, 3, 5, 4]   # Q15: qualité service (5), prix (3), relation perso (5), qualité produit (4)
    }
    
    scores = {
        'accueil': [],
        'decouverte': [],
        'argumentation': [],
        'closing': [],
        'fidelisation': []
    }
    
    # Calculate scores for each competence
    for competence, question_ids in competence_mapping.items():
        for q_id in question_ids:
            q_key = str(q_id)
            if q_key in responses:
                response_value = responses[q_key]
                
                # If response is an integer (option index), use it directly
                if isinstance(response_value, int):
                    option_idx = response_value
                    if q_id in question_scores and option_idx < len(question_scores[q_id]):
                        scores[competence].append(question_scores[q_id][option_idx])
                    else:
                        scores[competence].append(3.0)  # Default middle score
                else:
                    # If response is text (shouldn't happen now but fallback)
                    scores[competence].append(3.0)
    
    # Calculate averages
    final_scores = {}
    for competence, score_list in scores.items():
        if score_list:
            final_scores[f'score_{competence}'] = round(sum(score_list) / len(score_list), 1)
        else:
            final_scores[f'score_{competence}'] = 3.0
    
    return final_scores

async def calculate_competence_adjustment_from_kpis(seller_id: str, initial_scores: dict, days_since_diagnostic: int) -> dict:
    """
    Calculate competence score adjustments based on KPI performance
    Returns adjusted scores that blend questionnaire + KPI performance
    """
    # Get KPI entries from last 30 days
    thirty_days_ago = (datetime.now(timezone.utc) - timedelta(days=30)).date()
    kpi_entries = await db.kpi_entries.find({
        "seller_id": seller_id,
        "date": {"$gte": thirty_days_ago.strftime('%Y-%m-%d')}
    }, {"_id": 0}).to_list(1000)
    
    if not kpi_entries or len(kpi_entries) < 5:
        # Not enough data, return initial scores
        return initial_scores
    
    # Calculate KPI averages
    total_ca = sum(e.get('ca_journalier', 0) for e in kpi_entries)
    total_ventes = sum(e.get('nb_ventes', 0) for e in kpi_entries)
    total_articles = sum(e.get('nb_articles', 0) for e in kpi_entries)
    
    days_count = len(kpi_entries)
    
    # Calculate metrics
    panier_moyen = total_ca / total_ventes if total_ventes > 0 else 0
    indice_vente = total_articles / total_ventes if total_ventes > 0 else 0
    ventes_per_day = total_ventes / days_count if days_count > 0 else 0
    ca_per_day = total_ca / days_count if days_count > 0 else 0
    
    # KPI → Competence scoring (normalize to 1-5 scale)
    # Seuils ajustés pour refléter la réalité retail
    kpi_scores = {}
    
    # Accueil: Based on number of sales per day (proxy for client interaction)
    # Excellent: >15 ventes/day, Très bon: 12-15, Bon: 8-12, Moyen: 5-8, Faible: <5
    if ventes_per_day >= 15:
        kpi_scores['score_accueil'] = 5.0
    elif ventes_per_day >= 12:
        kpi_scores['score_accueil'] = 4.5
    elif ventes_per_day >= 8:
        kpi_scores['score_accueil'] = 4.0
    elif ventes_per_day >= 5:
        kpi_scores['score_accueil'] = 3.5
    elif ventes_per_day >= 3:
        kpi_scores['score_accueil'] = 3.0
    else:
        kpi_scores['score_accueil'] = 2.5
    
    # Découverte: Use indirect indicator (articles per transaction)
    # Good discovery = more articles per sale
    # Excellent: ≥2.5, Très bon: 2-2.5, Bon: 1.8-2, Moyen: 1.5-1.8, Faible: <1.5
    articles_per_vente = total_articles / total_ventes if total_ventes > 0 else 0
    if articles_per_vente >= 2.5:
        kpi_scores['score_decouverte'] = 5.0
    elif articles_per_vente >= 2.0:
        kpi_scores['score_decouverte'] = 4.5
    elif articles_per_vente >= 1.8:
        kpi_scores['score_decouverte'] = 4.0
    elif articles_per_vente >= 1.5:
        kpi_scores['score_decouverte'] = 3.5
    elif articles_per_vente >= 1.2:
        kpi_scores['score_decouverte'] = 3.0
    else:
        kpi_scores['score_decouverte'] = 2.5
    
    # Argumentation: Based on panier moyen and indice de vente
    # Higher basket = better argumentation
    # Excellent: ≥120€, Très bon: 100-120€, Bon: 80-100€, Moyen: 60-80€, Faible: <60€
    if panier_moyen >= 120:
        arg_score_1 = 5.0
    elif panier_moyen >= 100:
        arg_score_1 = 4.5
    elif panier_moyen >= 80:
        arg_score_1 = 4.0
    elif panier_moyen >= 60:
        arg_score_1 = 3.5
    elif panier_moyen >= 40:
        arg_score_1 = 3.0
    else:
        arg_score_1 = 2.5
    
    # Indice de vente (articles/vente)
    # Excellent: ≥2.5, Très bon: 2-2.5, Bon: 1.8-2, Moyen: 1.5-1.8, Faible: <1.5
    if indice_vente >= 2.5:
        arg_score_2 = 5.0
    elif indice_vente >= 2.0:
        arg_score_2 = 4.5
    elif indice_vente >= 1.8:
        arg_score_2 = 4.0
    elif indice_vente >= 1.5:
        arg_score_2 = 3.5
    elif indice_vente >= 1.2:
        arg_score_2 = 3.0
    else:
        arg_score_2 = 2.5
    
    kpi_scores['score_argumentation'] = round((arg_score_1 + arg_score_2) / 2, 1)
    
    # Closing: Based on sales consistency (ventes per day)
    # Higher sales per day indicates better closing ability
    # Excellent: >15 ventes/j, Très bon: 12-15, Bon: 8-12, Moyen: 5-8, Faible: <5
    if ventes_per_day >= 15:
        kpi_scores['score_closing'] = 5.0
    elif ventes_per_day >= 12:
        kpi_scores['score_closing'] = 4.5
    elif ventes_per_day >= 8:
        kpi_scores['score_closing'] = 4.0
    elif ventes_per_day >= 5:
        kpi_scores['score_closing'] = 3.5
    elif ventes_per_day >= 3:
        kpi_scores['score_closing'] = 3.0
    else:
        kpi_scores['score_closing'] = 2.5
    
    # Fidélisation: Based on CA consistency and regularity
    # If CA per day is stable and good = good fidelization
    # Excellent: ≥1500€, Très bon: 1200-1500€, Bon: 900-1200€, Moyen: 600-900€, Faible: <600€
    if ca_per_day >= 1500:
        kpi_scores['score_fidelisation'] = 5.0
    elif ca_per_day >= 1200:
        kpi_scores['score_fidelisation'] = 4.5
    elif ca_per_day >= 900:
        kpi_scores['score_fidelisation'] = 4.0
    elif ca_per_day >= 600:
        kpi_scores['score_fidelisation'] = 3.5
    elif ca_per_day >= 400:
        kpi_scores['score_fidelisation'] = 3.0
    else:
        kpi_scores['score_fidelisation'] = 2.5
    
    # Blending formula based on time since diagnostic
    # Week 1-2 (0-14 days): 100% questionnaire
    # Week 3-4 (15-28 days): 70% questionnaire + 30% KPIs
    # Month 2+ (29+ days): 30% questionnaire + 70% KPIs
    
    if days_since_diagnostic <= 14:
        weight_questionnaire = 1.0
        weight_kpis = 0.0
    elif days_since_diagnostic <= 28:
        weight_questionnaire = 0.7
        weight_kpis = 0.3
    else:
        weight_questionnaire = 0.3
        weight_kpis = 0.7
    
    # Blend scores
    blended_scores = {}
    for key in ['score_accueil', 'score_decouverte', 'score_argumentation', 'score_closing', 'score_fidelisation']:
        initial = initial_scores.get(key, 3.0)
        kpi = kpi_scores.get(key, 3.0)
        blended_scores[key] = round(initial * weight_questionnaire + kpi * weight_kpis, 1)
    
    return blended_scores

@api_router.post("/diagnostic", response_model=DiagnosticResult)
async def create_diagnostic(diagnostic_data: DiagnosticCreate, current_user: dict = Depends(get_current_user)):
    if current_user['role'] != 'seller':
        raise HTTPException(status_code=403, detail="Only sellers can create diagnostics")
    
    # Get manager_id for credit check
    manager_id = current_user.get('manager_id')
    if not manager_id:
        raise HTTPException(status_code=400, detail="Manager not found")
    
    # Check and consume AI credits
    credit_check = await check_and_consume_ai_credits(
        manager_id, 
        "diagnostic_seller",
        {"seller_id": current_user['id'], "seller_name": current_user.get('name')}
    )
    
    if not credit_check['success']:
        raise HTTPException(status_code=402, detail=credit_check['message'])
    
    # Check if diagnostic already exists - if yes, delete it to allow update
    existing = await db.diagnostics.find_one({"seller_id": current_user['id']}, {"_id": 0})
    if existing:
        await db.diagnostics.delete_one({"seller_id": current_user['id']})
    
    # Analyze with AI (only for style, level, motivation - NOT scores anymore)
    ai_analysis = await analyze_diagnostic_with_ai(diagnostic_data.responses)
    
    # Calculate competence scores from questionnaire responses (NEW ALGORITHMIC METHOD)
    competence_scores = calculate_competence_scores_from_questionnaire(diagnostic_data.responses)
    
    # Calculate DISC profile from questions 16-23
    disc_responses = {}
    for q_id in range(16, 24):  # Questions 16 to 23
        q_key = str(q_id)
        if q_key in diagnostic_data.responses:
            disc_responses[q_key] = diagnostic_data.responses[q_key]
    
    disc_profile = calculate_disc_profile(disc_responses)
    
    # Create diagnostic result
    diagnostic_obj = DiagnosticResult(
        seller_id=current_user['id'],
        responses=diagnostic_data.responses,
        ai_profile_summary=ai_analysis['summary'],
        style=ai_analysis['style'],
        level=ai_analysis['level'],
        motivation=ai_analysis['motivation'],
        score_accueil=competence_scores.get('score_accueil', 3.0),
        score_decouverte=competence_scores.get('score_decouverte', 3.0),
        score_argumentation=competence_scores.get('score_argumentation', 3.0),
        score_closing=competence_scores.get('score_closing', 3.0),
        score_fidelisation=competence_scores.get('score_fidelisation', 3.0),
        disc_dominant=disc_profile['dominant'],
        disc_percentages=disc_profile['percentages']
    )
    
    doc = diagnostic_obj.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.diagnostics.insert_one(doc)
    
    return diagnostic_obj

@api_router.get("/diagnostic/me")
async def get_my_diagnostic(current_user: dict = Depends(get_current_user)):
    if current_user['role'] != 'seller':
        raise HTTPException(status_code=403, detail="Only sellers can access diagnostics")
    
    diagnostic = await db.diagnostics.find_one({"seller_id": current_user['id']}, {"_id": 0})
    if not diagnostic:
        raise HTTPException(status_code=404, detail="No diagnostic found")
    
    # Convert datetime string back to datetime object if needed
    if isinstance(diagnostic.get('created_at'), str):
        diagnostic['created_at'] = datetime.fromisoformat(diagnostic['created_at'])
    
    return diagnostic

@api_router.get("/diagnostic/me/live-scores")
async def get_my_live_competence_scores(current_user: dict = Depends(get_current_user)):
    """
    Get live competence scores that blend questionnaire + KPI performance
    Scores evolve over time based on actual performance
    """
    if current_user['role'] != 'seller':
        raise HTTPException(status_code=403, detail="Only sellers can access diagnostics")
    
    # Get diagnostic
    diagnostic = await db.diagnostics.find_one({"seller_id": current_user['id']}, {"_id": 0})
    if not diagnostic:
        raise HTTPException(status_code=404, detail="No diagnostic found. Please complete the diagnostic first.")
    
    # Calculate days since diagnostic
    created_at = diagnostic.get('created_at')
    if isinstance(created_at, str):
        created_at = datetime.fromisoformat(created_at)
    
    days_since = (datetime.now(timezone.utc) - created_at).days
    
    # Get initial scores from diagnostic
    initial_scores = {
        'score_accueil': diagnostic.get('score_accueil', 3.0),
        'score_decouverte': diagnostic.get('score_decouverte', 3.0),
        'score_argumentation': diagnostic.get('score_argumentation', 3.0),
        'score_closing': diagnostic.get('score_closing', 3.0),
        'score_fidelisation': diagnostic.get('score_fidelisation', 3.0)
    }
    
    # Calculate adjusted scores with KPIs
    adjusted_scores = await calculate_competence_adjustment_from_kpis(
        seller_id=current_user['id'],
        initial_scores=initial_scores,
        days_since_diagnostic=days_since
    )
    
    return {
        "status": "success",
        "diagnostic_age_days": days_since,
        "blending_info": {
            "questionnaire_weight": 1.0 if days_since <= 14 else (0.7 if days_since <= 28 else 0.3),
            "kpi_weight": 0.0 if days_since <= 14 else (0.3 if days_since <= 28 else 0.7)
        },
        "initial_scores": initial_scores,
        "live_scores": adjusted_scores,
        "evolution": {
            key: round(adjusted_scores[key] - initial_scores[key], 1)
            for key in initial_scores.keys()
        }
    }

@api_router.get("/diagnostic/{seller_id}")

# ===== MANAGER DIAGNOSTIC =====
def calculate_disc_profile(disc_responses: dict) -> dict:
    """
    Calculate DISC profile from responses to DISC questions
    Manager: questions 11-34 (24 questions)
    Seller: questions 16-39 (24 questions)
    Each question has 4 options corresponding to D, I, S, C (Option 0=D, 1=I, 2=S, 3=C)
    """
    disc_scores = {'D': 0, 'I': 0, 'S': 0, 'C': 0}
    
    # Map option index to DISC type
    # Option 0 = D, Option 1 = I, Option 2 = S, Option 3 = C
    option_to_disc = {0: 'D', 1: 'I', 2: 'S', 3: 'C'}
    
    for question_id, answer in disc_responses.items():
        # Find which option was selected (0-3)
        if isinstance(answer, str):
            # If answer is the text of the option, we need to map it
            # For simplicity, we'll use the response structure
            # Assuming answers are passed as option indices or we parse them
            continue
        elif isinstance(answer, int):
            # Direct option index
            disc_type = option_to_disc.get(answer)
            if disc_type:
                disc_scores[disc_type] += 1
    
    # Calculate percentages
    total = sum(disc_scores.values())
    if total == 0:
        return {
            'dominant': 'I',  # Default
            'scores': {'D': 25, 'I': 25, 'S': 25, 'C': 25},
            'percentages': {'D': 25, 'I': 25, 'S': 25, 'C': 25}
        }
    
    percentages = {k: round((v / total) * 100) for k, v in disc_scores.items()}
    
    # Determine dominant profile
    dominant = max(disc_scores.items(), key=lambda x: x[1])[0]
    
    # Map letter to full name
    disc_names = {
        'D': 'Dominant',
        'I': 'Influent',
        'S': 'Stable',
        'C': 'Consciencieux'
    }
    
    return {
        'dominant': disc_names[dominant],
        'dominant_letter': dominant,
        'scores': disc_scores,
        'percentages': percentages
    }

async def analyze_manager_diagnostic_with_ai(responses: dict) -> dict:
    """Analyze manager diagnostic responses with AI"""
    try:
        api_key = os.environ.get('EMERGENT_LLM_KEY')
        chat = LlmChat(
            api_key=api_key,
            session_id=f"manager_diagnostic_{uuid.uuid4()}",
            system_message="Tu es un coach IA expert en management retail et en accompagnement d'équipes commerciales."
        ).with_model("openai", "gpt-4o-mini")
        
        # Format responses for prompt
        responses_text = ""
        for q_num, answer in responses.items():
            responses_text += f"\nQuestion {q_num}: {answer}\n"
        
        prompt = f"""Analyse les réponses de ce questionnaire pour déterminer le profil de management dominant.

Voici les réponses :
{responses_text}

Classe ce manager parmi les 5 profils suivants :
1️⃣ Le Pilote — orienté résultats, aime les chiffres, la clarté et les plans d'action.
2️⃣ Le Coach — bienveillant, à l'écoute, accompagne individuellement.
3️⃣ Le Dynamiseur — motivant, charismatique, met de l'énergie dans l'équipe.
4️⃣ Le Stratège — structuré, process, rigoureux et méthodique.
5️⃣ L'Inspire — empathique, donne du sens et fédère autour d'une vision.

Réponds UNIQUEMENT au format JSON suivant (sans markdown, sans ```json) :
{{
  "profil_nom": "Le Pilote/Le Coach/Le Dynamiseur/Le Stratège/L'Inspire",
  "profil_description": "2 phrases synthétiques pour décrire ce style",
  "force_1": "Premier point fort concret",
  "force_2": "Deuxième point fort concret",
  "axe_progression": "1 domaine clé à renforcer",
  "recommandation": "1 conseil personnalisé pour développer son management",
  "exemple_concret": "Une phrase ou un comportement à adopter lors d'un brief, coaching ou feedback"
}}

Ton style doit être positif, professionnel et orienté action. Pas de jargon RH. Mise en pratique et impact terrain. Tout en tutoiement."""

        user_message = UserMessage(text=prompt)
        response = await chat.send_message(user_message)
        
        # Clean and parse response
        content = response.strip()
        if content.startswith('```'):
            content = content.split('```')[1]
            if content.startswith('json'):
                content = content[4:]
        content = content.strip()
        
        result = json.loads(content)
        return result
        
    except Exception as e:
        logger.error(f"Error in AI analysis: {str(e)}")
        # Fallback default response
        return {
            "profil_nom": "Le Coach",
            "profil_description": "Tu es un manager proche de ton équipe, à l'écoute et orienté développement. Tu valorises la progression individuelle avant tout.",
            "force_1": "Crée un climat de confiance fort",
            "force_2": "Encourage la montée en compétence",
            "axe_progression": "Gagner en fermeté sur le suivi des objectifs pour équilibrer empathie et performance.",
            "recommandation": "Lors de ton prochain brief, termine toujours par un objectif chiffré clair.",
            "exemple_concret": "\"Super énergie ce matin ! Notre but du jour : 15 ventes à 200 € de panier moyen — on y va ensemble 💪\""
        }

@api_router.post("/manager-diagnostic", response_model=ManagerDiagnosticResult)
async def create_manager_diagnostic(diagnostic_data: ManagerDiagnosticCreate, current_user: dict = Depends(get_current_user)):
    if current_user['role'] != 'manager':
        raise HTTPException(status_code=403, detail="Only managers can create management diagnostics")
    
    # Check and consume AI credits
    credit_check = await check_and_consume_ai_credits(
        current_user['id'], 
        "diagnostic_manager",
        {"manager_name": current_user.get('name')}
    )
    
    if not credit_check['success']:
        raise HTTPException(status_code=402, detail=credit_check['message'])
    
    # Check if diagnostic already exists - if yes, delete it to allow update
    existing = await db.manager_diagnostics.find_one({"manager_id": current_user['id']}, {"_id": 0})
    if existing:
        await db.manager_diagnostics.delete_one({"manager_id": current_user['id']})
    
    # Analyze with AI
    ai_analysis = await analyze_manager_diagnostic_with_ai(diagnostic_data.responses)
    
    # Calculate DISC profile from questions 11-34
    disc_responses = {}
    for q_id in range(11, 35):  # Questions 11 to 34
        q_key = str(q_id)
        if q_key in diagnostic_data.responses:
            disc_responses[q_key] = diagnostic_data.responses[q_key]
    
    disc_profile = calculate_disc_profile(disc_responses)
    
    # Create diagnostic result
    diagnostic_obj = ManagerDiagnosticResult(
        manager_id=current_user['id'],
        responses=diagnostic_data.responses,
        profil_nom=ai_analysis['profil_nom'],
        profil_description=ai_analysis['profil_description'],
        force_1=ai_analysis['force_1'],
        force_2=ai_analysis['force_2'],
        axe_progression=ai_analysis['axe_progression'],
        recommandation=ai_analysis['recommandation'],
        exemple_concret=ai_analysis['exemple_concret'],
        disc_dominant=disc_profile['dominant'],
        disc_percentages=disc_profile['percentages']
    )
    
    doc = diagnostic_obj.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.manager_diagnostics.insert_one(doc)
    
    return diagnostic_obj

@api_router.get("/manager-diagnostic/me")
async def get_my_manager_diagnostic(
    store_id: str = None,
    current_user: dict = Depends(get_current_user)
):
    if current_user['role'] not in ['manager', 'gerant', 'gérant']:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Determine effective store_id
    effective_store_id = None
    if store_id and current_user['role'] in ['gerant', 'gérant']:
        effective_store_id = store_id
    elif current_user.get('store_id'):
        effective_store_id = current_user['store_id']
    
    # Find diagnostic by store_id or manager_id
    diagnostic = None
    if effective_store_id:
        diagnostic = await db.manager_diagnostics.find_one({"store_id": effective_store_id}, {"_id": 0})
    if not diagnostic and current_user.get('id'):
        diagnostic = await db.manager_diagnostics.find_one({"manager_id": current_user['id']}, {"_id": 0})
    
    if not diagnostic:
        return {"status": "not_completed", "diagnostic": None}
    
    if isinstance(diagnostic.get('created_at'), str):
        diagnostic['created_at'] = datetime.fromisoformat(diagnostic['created_at'])
    
    return {"status": "completed", "diagnostic": diagnostic}

@api_router.get("/diagnostic/seller/{seller_id}")
async def get_seller_diagnostic(seller_id: str, current_user: dict = Depends(get_current_user)):
    if current_user['role'] != 'manager':
        raise HTTPException(status_code=403, detail="Only managers can access seller diagnostics")
    
    # Verify seller belongs to manager's store
    seller = await db.users.find_one({
        "id": seller_id,
        "store_id": current_user.get('store_id'),
        "role": "seller"
    }, {"_id": 0})
    if not seller:
        raise HTTPException(status_code=404, detail="Seller not found in your store")
    
    diagnostic = await db.diagnostics.find_one({"seller_id": seller_id}, {"_id": 0})
    
    if not diagnostic:
        return None
    
    return diagnostic


@api_router.delete("/diagnostic/me")
async def delete_my_diagnostic(current_user: dict = Depends(get_current_user)):
    """Delete seller's own diagnostic - allows retaking the test"""
    if current_user['role'] != 'seller':
        raise HTTPException(status_code=403, detail="Only sellers can delete their own diagnostic")
    
    result = await db.diagnostics.delete_one({"seller_id": current_user['id']})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="No diagnostic found")
    
    return {"message": "Diagnostic deleted successfully", "deleted_count": result.deleted_count}

    if isinstance(diagnostic.get('created_at'), str):
        diagnostic['created_at'] = datetime.fromisoformat(diagnostic['created_at'])
    
    return diagnostic

# ===== MANAGER REQUEST ROUTES =====
@api_router.post("/manager/requests", response_model=ManagerRequest)
async def create_manager_request(request_data: ManagerRequestCreate, current_user: dict = Depends(get_current_user)):
    if current_user['role'] != 'manager':
        raise HTTPException(status_code=403, detail="Only managers can create requests")
    
    # Verify seller belongs to manager
    seller = await db.users.find_one({"id": request_data.seller_id, "manager_id": current_user['id']}, {"_id": 0})
    if not seller:
        raise HTTPException(status_code=404, detail="Seller not found in your team")
    
    request_obj = ManagerRequest(
        manager_id=current_user['id'],
        seller_id=request_data.seller_id,
        title=request_data.title,
        message=request_data.message
    )
    
    doc = request_obj.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    if doc.get('completed_at'):
        doc['completed_at'] = doc['completed_at'].isoformat()
    
    await db.manager_requests.insert_one(doc)
    
    return request_obj

@api_router.get("/seller/tasks")
async def get_seller_tasks(current_user: dict = Depends(get_current_user)):
    if current_user['role'] != 'seller':
        raise HTTPException(status_code=403, detail="Only sellers can access tasks")
    
    tasks = []
    
    # Check diagnostic
    diagnostic = await db.diagnostics.find_one({"seller_id": current_user['id']}, {"_id": 0})
    if not diagnostic:
        tasks.append({
            "id": "diagnostic",
            "type": "diagnostic",
            "title": "Complète ton diagnostic vendeur",
            "description": "Découvre ton profil unique en 10 minutes",
            "priority": "high",
            "icon": "📋"
        })
    
    # Check pending manager requests
    requests_list = await db.manager_requests.find({
        "seller_id": current_user['id'],
        "status": "pending"
    }, {"_id": 0}).to_list(100)
    
    for req in requests_list:
        if isinstance(req.get('created_at'), str):
            req['created_at'] = datetime.fromisoformat(req['created_at'])
        tasks.append({
            "id": req['id'],
            "type": "manager_request",
            "title": req['title'],
            "description": req['message'],
            "priority": "medium",
            "icon": "💬",
            "data": req
        })
    
    return tasks

@api_router.post("/seller/respond-request")
async def respond_to_request(response_data: ManagerRequestResponse, current_user: dict = Depends(get_current_user)):
    if current_user['role'] != 'seller':
        raise HTTPException(status_code=403, detail="Only sellers can respond")
    
    # Get request
    request = await db.manager_requests.find_one({
        "id": response_data.request_id,
        "seller_id": current_user['id']
    }, {"_id": 0})
    
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")
    
    # Update request
    await db.manager_requests.update_one(
        {"id": response_data.request_id},
        {
            "$set": {
                "seller_response": response_data.response,
                "status": "completed",
                "completed_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    return {"status": "success", "message": "Response sent"}

@api_router.get("/manager/requests/seller/{seller_id}")
async def get_seller_requests(seller_id: str, current_user: dict = Depends(get_current_user)):
    if current_user['role'] != 'manager':
        raise HTTPException(status_code=403, detail="Only managers can view requests")
    
    # Verify seller belongs to this manager's store
    seller = await db.users.find_one({
        "id": seller_id,
        "store_id": current_user.get('store_id'),
        "role": "seller"
    }, {"_id": 0})
    if not seller:
        raise HTTPException(status_code=404, detail="Seller not in your store")
    
    requests = await db.manager_requests.find({
        "seller_id": seller_id,
        "manager_id": current_user['id']
    }, {"_id": 0}).sort("created_at", -1).to_list(100)
    
    for req in requests:
        if isinstance(req.get('created_at'), str):
            req['created_at'] = datetime.fromisoformat(req['created_at'])
        if isinstance(req.get('completed_at'), str):
            req['completed_at'] = datetime.fromisoformat(req['completed_at'])
    
    return requests



# ===== KPI ROUTES =====

# Get KPI definitions (available to all)
@api_router.get("/kpi/definitions")
async def get_kpi_definitions():
    return {
        "seller_input": SELLER_INPUT_KPIS,
        "calculated": CALCULATED_KPIS
    }

# Manager: Get/Update KPI Configuration (now just enable/disable)
# KPI Entries endpoints moved below after model definitions

# Seller: Check if KPIs are enabled
@api_router.get("/seller/kpi-enabled")
async def check_kpi_enabled(
    store_id: str = None,
    current_user: dict = Depends(get_current_user)
):
    # Allow sellers, managers, and gérants to check KPI status
    if current_user['role'] not in ['seller', 'manager', 'gerant', 'gérant']:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Determine manager_id or store_id to check
    manager_id = None
    effective_store_id = None
    
    if current_user['role'] == 'seller':
        manager_id = current_user.get('manager_id')
        if not manager_id:
            return {"enabled": False, "seller_input_kpis": SELLER_INPUT_KPIS}
    elif store_id and current_user['role'] in ['gerant', 'gérant']:
        effective_store_id = store_id
    elif current_user.get('store_id'):
        effective_store_id = current_user['store_id']
    elif current_user['role'] == 'manager':
        manager_id = current_user['id']
    
    # Find config by store_id or manager_id
    config = None
    if effective_store_id:
        config = await db.kpi_configs.find_one({"store_id": effective_store_id}, {"_id": 0})
    if not config and manager_id:
        config = await db.kpi_configs.find_one({"manager_id": manager_id}, {"_id": 0})
    
    if not config:
        return {"enabled": False, "seller_input_kpis": SELLER_INPUT_KPIS}
    
    return {
        "enabled": config.get('enabled', True),
        "seller_input_kpis": SELLER_INPUT_KPIS
    }

# Seller: Submit KPI entry
@api_router.post("/seller/kpi-entry")
async def create_kpi_entry(entry_data: KPIEntryCreate, current_user: dict = Depends(get_current_user)):
    if current_user['role'] != 'seller':
        raise HTTPException(status_code=403, detail="Only sellers can submit KPI entries")
    
    # Calculate derived KPIs
    raw_data = {
        "ca_journalier": entry_data.ca_journalier,
        "nb_ventes": entry_data.nb_ventes,
        "nb_clients": entry_data.nb_clients,
        "nb_articles": entry_data.nb_articles,
        "nb_prospects": entry_data.nb_prospects
    }
    calculated = calculate_kpis(raw_data)
    
    # Check if entry for this date already exists
    existing = await db.kpi_entries.find_one({
        "seller_id": current_user['id'],
        "date": entry_data.date
    }, {"_id": 0})
    
    if existing:
        # Update existing entry
        await db.kpi_entries.update_one(
            {"seller_id": current_user['id'], "date": entry_data.date},
            {"$set": {
                "ca_journalier": entry_data.ca_journalier,
                "nb_ventes": entry_data.nb_ventes,
                "nb_clients": entry_data.nb_clients,
                "nb_articles": entry_data.nb_articles,
                "nb_prospects": entry_data.nb_prospects,
                "panier_moyen": calculated['panier_moyen'],
                "taux_transformation": calculated['taux_transformation'],
                "indice_vente": calculated['indice_vente'],
                "comment": entry_data.comment,
                "created_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        existing.update({
            "ca_journalier": entry_data.ca_journalier,
            "nb_ventes": entry_data.nb_ventes,
            "nb_clients": entry_data.nb_clients,
            "nb_articles": entry_data.nb_articles,
            "nb_prospects": entry_data.nb_prospects,
            "panier_moyen": calculated['panier_moyen'],
            "taux_transformation": calculated['taux_transformation'],
            "indice_vente": calculated['indice_vente'],
            "comment": entry_data.comment
        })
        return existing
    
    # Create new entry
    entry = KPIEntry(
        seller_id=current_user['id'],
        date=entry_data.date,
        ca_journalier=entry_data.ca_journalier,
        nb_ventes=entry_data.nb_ventes,
        nb_clients=entry_data.nb_clients,
        nb_articles=entry_data.nb_articles,
        nb_prospects=entry_data.nb_prospects,
        panier_moyen=calculated['panier_moyen'],
        taux_transformation=calculated['taux_transformation'],
        indice_vente=calculated['indice_vente'],
        comment=entry_data.comment
    )
    
    doc = entry.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.kpi_entries.insert_one(doc)
    
    return entry

# Seller: Get my KPI entries
@api_router.get("/seller/kpi-entries")
async def get_my_kpi_entries(days: int = None, current_user: dict = Depends(get_current_user)):
    """
    Get seller KPI entries with aggregated data from both seller and manager.
    For each date, combines data entered by the seller with data entered by the manager.
    """
    if current_user['role'] != 'seller':
        raise HTTPException(status_code=403, detail="Only sellers can access their KPI entries")
    
    # Get seller info to find their manager
    seller = await db.users.find_one({"id": current_user['id']}, {"_id": 0})
    if not seller:
        raise HTTPException(status_code=404, detail="Seller not found")
    
    store_id = seller.get('store_id')
    if not store_id:
        raise HTTPException(status_code=400, detail="Seller not assigned to a store")
    
    # Get manager of this store
    manager = await db.users.find_one({"store_id": store_id, "role": "manager"}, {"_id": 0})
    
    # Fetch seller's KPI entries
    if days:
        seller_entries = await db.kpi_entries.find(
            {"seller_id": current_user['id']},
            {"_id": 0}
        ).sort("date", -1).limit(days).to_list(days)
    else:
        cursor = db.kpi_entries.find(
            {"seller_id": current_user['id']},
            {"_id": 0}
        ).sort("date", -1)
        seller_entries = await cursor.to_list(length=None)
    
    # Fetch manager's KPI entries if manager exists
    manager_entries_dict = {}
    if manager:
        manager_id = manager.get('id')
        if days:
            manager_entries = await db.manager_kpis.find(
                {"manager_id": manager_id},
                {"_id": 0}
            ).sort("date", -1).limit(days).to_list(days)
        else:
            cursor = db.manager_kpis.find(
                {"manager_id": manager_id},
                {"_id": 0}
            ).sort("date", -1)
            manager_entries = await cursor.to_list(length=None)
        
        # Create a dictionary with date as key for quick lookup
        manager_entries_dict = {entry['date']: entry for entry in manager_entries}
    
    # Aggregate data: merge seller and manager entries by date
    aggregated_entries = []
    processed_dates = set()
    
    # First, process all seller entries and merge with manager data
    for seller_entry in seller_entries:
        date = seller_entry['date']
        processed_dates.add(date)
        
        # Start with seller's data
        merged_entry = seller_entry.copy()
        
        # Merge with manager's data for the same date if it exists
        if date in manager_entries_dict:
            manager_entry = manager_entries_dict[date]
            
            # Sum up the numeric KPI fields (use 'or 0' to handle None values)
            merged_entry['ca_journalier'] = (
                (seller_entry.get('ca_journalier') or 0) + (manager_entry.get('ca_journalier') or 0)
            )
            merged_entry['nb_ventes'] = (
                (seller_entry.get('nb_ventes') or 0) + (manager_entry.get('nb_ventes') or 0)
            )
            merged_entry['nb_clients'] = (
                (seller_entry.get('nb_clients') or 0) + (manager_entry.get('nb_clients') or 0)
            )
            merged_entry['nb_articles'] = (
                (seller_entry.get('nb_articles') or 0) + (manager_entry.get('nb_articles') or 0)
            )
            merged_entry['nb_prospects'] = (
                (seller_entry.get('nb_prospects') or 0) + (manager_entry.get('nb_prospects') or 0)
            )
            
            # Recalculate derived KPIs based on aggregated data
            if merged_entry['nb_ventes'] > 0:
                merged_entry['panier_moyen'] = round(
                    merged_entry['ca_journalier'] / merged_entry['nb_ventes'], 2
                )
                merged_entry['indice_vente'] = round(
                    merged_entry['nb_articles'] / merged_entry['nb_ventes'], 2
                )
            else:
                merged_entry['panier_moyen'] = 0
                merged_entry['indice_vente'] = 0
            
            if merged_entry['nb_prospects'] > 0:
                merged_entry['taux_transformation'] = round(
                    (merged_entry['nb_clients'] / merged_entry['nb_prospects']) * 100, 2
                )
            else:
                merged_entry['taux_transformation'] = None
        
        aggregated_entries.append(merged_entry)
    
    # Also add manager entries for dates where seller has no entry
    for date, manager_entry in manager_entries_dict.items():
        if date not in processed_dates:
            # Create an entry based on manager's data (use 'or 0' to handle None values)
            merged_entry = {
                'id': manager_entry.get('id'),
                'seller_id': current_user['id'],
                'date': date,
                'ca_journalier': manager_entry.get('ca_journalier') or 0,
                'nb_ventes': manager_entry.get('nb_ventes') or 0,
                'nb_clients': manager_entry.get('nb_clients') or 0,
                'nb_articles': manager_entry.get('nb_articles') or 0,
                'nb_prospects': manager_entry.get('nb_prospects') or 0,
                'comment': None,
                'created_at': manager_entry.get('created_at')
            }
            
            # Calculate derived KPIs
            if merged_entry['nb_ventes'] > 0:
                merged_entry['panier_moyen'] = round(
                    merged_entry['ca_journalier'] / merged_entry['nb_ventes'], 2
                )
                merged_entry['indice_vente'] = round(
                    merged_entry['nb_articles'] / merged_entry['nb_ventes'], 2
                )
            else:
                merged_entry['panier_moyen'] = 0
                merged_entry['indice_vente'] = 0
            
            if merged_entry['nb_prospects'] > 0:
                merged_entry['taux_transformation'] = round(
                    (merged_entry['nb_clients'] / merged_entry['nb_prospects']) * 100, 2
                )
            else:
                merged_entry['taux_transformation'] = None
            
            aggregated_entries.append(merged_entry)
    
    # Sort by date (most recent first)
    aggregated_entries.sort(key=lambda x: x['date'], reverse=True)
    
    return aggregated_entries

# Manager: Get KPI entries for a seller
@api_router.get("/manager/kpi-entries/{seller_id}")
async def get_seller_kpi_entries(
    seller_id: str, 
    days: int = 30, 
    start_date: str = None, 
    end_date: str = None, 
    current_user: dict = Depends(get_current_user)
):
    if current_user['role'] != 'manager':
        raise HTTPException(status_code=403, detail="Only managers can access seller KPI entries")
    
    # Verify seller belongs to this manager's store
    seller = await db.users.find_one({"id": seller_id, "role": "seller"}, {"_id": 0})
    if not seller:
        raise HTTPException(status_code=404, detail="Seller not found")
    
    # Check if seller is in the same store as the manager
    if seller.get('store_id') != current_user.get('store_id'):
        raise HTTPException(status_code=403, detail="Seller not in your store")
    
    # Build date query based on parameters
    if start_date and end_date:
        # Use custom date range
        date_query = {
            "seller_id": seller_id,
            "date": {"$gte": start_date, "$lte": end_date}
        }
    else:
        # Use days parameter
        from datetime import timedelta
        date_threshold = (datetime.now(timezone.utc) - timedelta(days=days)).strftime('%Y-%m-%d')
        date_query = {
            "seller_id": seller_id,
            "date": {"$gte": date_threshold}
        }
    
    entries = await db.kpi_entries.find(
        date_query,
        {"_id": 0}
    ).sort("date", -1).to_list(1000)
    
    return entries

# Manager: Get all sellers KPI summary
@api_router.get("/manager/kpi-summary")
async def get_team_kpi_summary(current_user: dict = Depends(get_current_user)):
    if current_user['role'] != 'manager':
        raise HTTPException(status_code=403, detail="Only managers can access team KPI summary")
    
    # Get all sellers in this manager's store
    sellers = await db.users.find({
        "store_id": current_user.get('store_id'),
        "role": "seller",
        "status": {"$nin": ["deleted", "inactive"]}
    }, {"_id": 0}).to_list(1000)
    
    summary = []
    for seller in sellers:
        # Get latest KPI entry
        latest_entry = await db.kpi_entries.find_one(
            {"seller_id": seller['id']},
            {"_id": 0},
            sort=[("date", -1)]
        )
        
        # Get all entries for the last 7 days for averages
        from datetime import datetime, timedelta
        seven_days_ago = (datetime.now() - timedelta(days=7)).strftime('%Y-%m-%d')
        recent_entries = await db.kpi_entries.find(
            {"seller_id": seller['id'], "date": {"$gte": seven_days_ago}},
            {"_id": 0}
        ).to_list(7)
        
        # Calculate averages
        if recent_entries:
            avg_ca = sum(e.get('ca_journalier', 0) for e in recent_entries) / len(recent_entries)
            avg_ventes = sum(e.get('nb_ventes', 0) for e in recent_entries) / len(recent_entries)
            avg_panier = sum(e.get('panier_moyen', 0) for e in recent_entries) / len(recent_entries)
            avg_taux = sum(e.get('taux_transformation', 0) for e in recent_entries) / len(recent_entries)
        else:
            avg_ca = avg_ventes = avg_panier = avg_taux = 0
        
        summary.append({
            "seller_id": seller['id'],
            "seller_name": seller['name'],
            "latest_entry": latest_entry,
            "seven_day_averages": {
                "ca_journalier": round(avg_ca, 2),
                "nb_ventes": round(avg_ventes, 1),
                "panier_moyen": round(avg_panier, 2),
                "taux_transformation": round(avg_taux, 2)
            }
        })
    
    return summary

# Manager: Get seller debriefs
@api_router.get("/manager/debriefs/{seller_id}")
async def get_seller_debriefs(seller_id: str, current_user: dict = Depends(get_current_user)):
    if current_user['role'] != 'manager':
        raise HTTPException(status_code=403, detail="Only managers can access seller debriefs")
    
    # Verify seller belongs to this manager's store
    seller = await db.users.find_one({
        "id": seller_id,
        "store_id": current_user.get('store_id'),
        "role": "seller"
    }, {"_id": 0})
    if not seller:
        raise HTTPException(status_code=404, detail="Seller not in your store")
    
    # Get all debriefs for this seller that are visible to manager
    debriefs = await db.debriefs.find(
        {"seller_id": seller_id, "visible_to_manager": True},
        {"_id": 0}
    ).sort("created_at", -1).to_list(1000)
    
    return debriefs

# Manager: Get seller competences history
@api_router.get("/manager/competences-history/{seller_id}")
async def get_seller_competences_history(seller_id: str, current_user: dict = Depends(get_current_user)):
    if current_user['role'] != 'manager':
        raise HTTPException(status_code=403, detail="Only managers can access seller competences")
    
    # Verify seller belongs to this manager's store
    seller = await db.users.find_one({
        "id": seller_id,
        "store_id": current_user.get('store_id'),
        "role": "seller"
    }, {"_id": 0})
    if not seller:
        raise HTTPException(status_code=404, detail="Seller not in your store")
    
    history = []
    
    # Get diagnostic (initial scores)
    diagnostic = await db.diagnostics.find_one({"seller_id": seller_id}, {"_id": 0})
    if diagnostic:
        history.append({
            "type": "diagnostic",
            "date": diagnostic.get('created_at'),
            "score_accueil": diagnostic.get('score_accueil', 3.0),
            "score_decouverte": diagnostic.get('score_decouverte', 3.0),
            "score_argumentation": diagnostic.get('score_argumentation', 3.0),
            "score_closing": diagnostic.get('score_closing', 3.0),
            "score_fidelisation": diagnostic.get('score_fidelisation', 3.0)
        })
    
    # Get all debriefs (evolution)
    debriefs = await db.debriefs.find({"seller_id": seller_id}, {"_id": 0}).sort("created_at", 1).to_list(1000)
    for debrief in debriefs:
        history.append({
            "type": "debrief",
            "date": debrief.get('created_at'),
            "score_accueil": debrief.get('score_accueil', 3.0),
            "score_decouverte": debrief.get('score_decouverte', 3.0),
            "score_argumentation": debrief.get('score_argumentation', 3.0),
            "score_closing": debrief.get('score_closing', 3.0),
            "score_fidelisation": debrief.get('score_fidelisation', 3.0)
        })
    
    return history

# ===== TEAM BILAN IA =====
@api_router.post("/manager/team-bilans/generate-all")
async def generate_all_team_bilans(current_user: dict = Depends(get_current_user)):
    """Generate team bilans for all weeks of the year where there is KPI data"""
    if current_user['role'] != 'manager':
        raise HTTPException(status_code=403, detail="Only managers can generate team bilans")
    
    # Get all sellers in this manager's store
    sellers = await db.users.find({
        "store_id": current_user.get('store_id'),
        "role": "seller",
        "status": {"$nin": ["deleted", "inactive"]}
    }, {"_id": 0}).to_list(1000)
    
    if not sellers:
        raise HTTPException(status_code=404, detail="No sellers in your store")
    
    # Get date range of all KPI data
    seller_ids = [s['id'] for s in sellers]
    print(f"DEBUG: Seller IDs: {seller_ids[:3]}...")  # Show first 3
    oldest_kpi = await db.kpi_entries.find_one(
        {"seller_id": {"$in": seller_ids}},
        {"_id": 0, "date": 1},
        sort=[("date", 1)]
    )
    
    print(f"DEBUG: Oldest KPI: {oldest_kpi}")
    
    if not oldest_kpi:
        raise HTTPException(status_code=404, detail="No KPI data found")
    
    # Parse oldest date
    if isinstance(oldest_kpi['date'], str):
        oldest_date = datetime.strptime(oldest_kpi['date'], '%Y-%m-%d').date()
    else:
        oldest_date = oldest_kpi['date']
    
    # Get the Monday of the week containing oldest_date
    oldest_monday = oldest_date - timedelta(days=oldest_date.weekday())
    
    # Get current date
    today = datetime.now(timezone.utc).date()
    current_monday = today - timedelta(days=today.weekday())
    
    # Generate bilans for all weeks from oldest to current
    generated_bilans = []
    week_start = oldest_monday
    
    print(f"DEBUG: Week range from {oldest_monday} to {current_monday}")
    
    while week_start <= current_monday:
        week_end = week_start + timedelta(days=6)
        
        # Check if this week has any KPI data
        has_data = await db.kpi_entries.find_one({
            "seller_id": {"$in": seller_ids},
            "date": {
                "$gte": week_start.strftime('%Y-%m-%d'),
                "$lte": week_end.strftime('%Y-%m-%d')
            }
        })
        
        if has_data:
            print(f"DEBUG: Generating bilan for week {week_start.strftime('%d/%m')} - {week_end.strftime('%d/%m')}")
            # Generate bilan for this week
            try:
                bilan = await generate_team_bilan_for_period(
                    manager_id=current_user['id'],
                    start_date=week_start,
                    end_date=week_end,
                    sellers=sellers
                )
                generated_bilans.append(bilan)
            except Exception as e:
                print(f"Error generating bilan for week {week_start}: {e}")
        else:
            print(f"DEBUG: No data for week {week_start.strftime('%d/%m')} - {week_end.strftime('%d/%m')}")
        
        # Move to next week
        week_start += timedelta(days=7)
    
    return {
        "status": "success",
        "generated_count": len(generated_bilans),
        "bilans": generated_bilans
    }

async def generate_team_bilan_for_period(manager_id: str, start_date: date, end_date: date, sellers: list):
    """Helper function to generate a team bilan for a specific period"""
    periode = f"Semaine du {start_date.strftime('%d/%m/%y')} au {end_date.strftime('%d/%m/%y')}"
    
    # Collect data for all sellers
    team_data = []
    total_ca = 0
    total_ventes = 0
    total_articles = 0
    competences_sum = {"accueil": 0, "decouverte": 0, "argumentation": 0, "closing": 0, "fidelisation": 0}
    competences_count = 0
    
    for seller in sellers:
        seller_id = seller['id']
        
        # Get KPIs for this period
        kpi_entries = await db.kpi_entries.find({
            "seller_id": seller_id,
            "date": {
                "$gte": start_date.strftime('%Y-%m-%d'),
                "$lte": end_date.strftime('%Y-%m-%d')
            }
        }, {"_id": 0}).to_list(1000)
        
        seller_ca = sum(e.get('ca_journalier', 0) for e in kpi_entries)
        seller_ventes = sum(e.get('nb_ventes', 0) for e in kpi_entries)
        seller_articles = sum(e.get('nb_articles', 0) for e in kpi_entries)
        
        total_ca += seller_ca
        total_ventes += seller_ventes
        total_articles += seller_articles
        
        # Get diagnostic for competences
        diagnostic = await db.diagnostics.find_one({"seller_id": seller_id}, {"_id": 0})
        if diagnostic and diagnostic.get('competences'):
            for comp in competences_sum:
                competences_sum[comp] += diagnostic['competences'].get(comp, 0)
            competences_count += 1
        
        team_data.append({
            "seller_name": seller['name'],
            "seller_email": seller['email'],
            "ca": seller_ca,
            "ventes": seller_ventes
        })
    
    # Calculate averages and all KPIs
    panier_moyen_equipe = total_ca / total_ventes if total_ventes > 0 else 0
    taux_transfo_equipe = 0  # No longer tracking clients
    indice_vente_equipe = (total_articles / total_ventes) if total_ventes > 0 else 0
    
    competences_moyenne = {}
    if competences_count > 0:
        for comp in competences_sum:
            competences_moyenne[comp] = round(competences_sum[comp] / competences_count, 2)
    
    # Build context and call AI
    manager = await db.users.find_one({"id": manager_id}, {"_id": 0})
    manager_diagnostic = await db.manager_diagnostics.find_one({"manager_id": manager_id}, {"_id": 0})
    
    manager_context = f"""Profil Manager :
- Style de management : {manager_diagnostic.get('profil_nom', 'Non défini') if manager_diagnostic else 'Non défini'}
- Nombre de vendeurs : {len(sellers)}
"""
    
    kpi_context = f"""KPIs de l'équipe pour la période {periode} :
- CA Total : {total_ca:.2f}€
- Nombre de ventes : {total_ventes}
- Nombre d'articles : {total_articles}
- Panier moyen : {panier_moyen_equipe:.2f}€
- Indice de vente : {indice_vente_equipe:.2f}
"""
    
    team_context = "Détails par vendeur :\n"
    for seller_data in team_data:
        team_context += f"- {seller_data['seller_name']} : CA {seller_data['ca']:.0f}€, {seller_data['ventes']} ventes, {seller_data['clients']} clients\n"
    
    prompt = f"""Tu es un coach en management retail. Analyse les performances de cette équipe et génère un bilan structuré.

{manager_context}

{kpi_context}

{team_context}

IMPORTANT : Réponds UNIQUEMENT avec un objet JSON valide, sans texte avant ou après. Format exact :
{{
  "synthese": "Une phrase résumant la performance globale de l'équipe",
  "points_forts": ["Point fort 1", "Point fort 2"],
  "points_attention": ["Point d'attention 1", "Point d'attention 2"],
  "recommandations": ["Action d'équipe 1", "Action d'équipe 2"],
  "analyses_vendeurs": [
    {{
      "vendeur": "Prénom du vendeur",
      "performance": "Phrase résumant sa performance (CA, ventes, points forts)",
      "points_forts": ["Son point fort 1", "Son point fort 2"],
      "axes_progression": ["Axe à améliorer 1", "Axe à améliorer 2"],
      "recommandations": ["Action personnalisée 1", "Action personnalisée 2"]
    }}
  ]
}}

Consignes :
- Analyse CHAQUE vendeur individuellement avec ses propres KPIs
- Sois précis avec les chiffres (utilise UNIQUEMENT les données fournies ci-dessus)
- Recommandations concrètes et actionnables pour chaque vendeur
- Ton professionnel mais encourageant
"""
    
    try:
        llm_chat = LlmChat(
            api_key=os.environ.get('EMERGENT_LLM_KEY'),
            session_id=f"team_bilan_{manager_id}_{periode}",
            system_message="Tu es un coach en management retail. Tu réponds TOUJOURS en JSON valide uniquement."
        )
        user_message = UserMessage(text=prompt)
        response = await llm_chat.send_message(user_message)
        
        print(f"DEBUG: AI raw response: {response[:200]}...")  # First 200 chars
        
        # Clean response (remove markdown, extra text, etc.)
        response_clean = response.strip()
        if "```json" in response_clean:
            response_clean = response_clean.split("```json")[1].split("```")[0].strip()
        elif "```" in response_clean:
            response_clean = response_clean.split("```")[1].split("```")[0].strip()
        
        # Find JSON object in response
        start_idx = response_clean.find('{')
        end_idx = response_clean.rfind('}') + 1
        if start_idx >= 0 and end_idx > start_idx:
            response_clean = response_clean[start_idx:end_idx]
        
        ai_result = json.loads(response_clean)
    except Exception as e:
        print(f"AI generation failed: {e}")
        ai_result = {
            "synthese": f"Performance de l'équipe pour la période {periode}",
            "points_forts": ["Données collectées"],
            "points_attention": ["À analyser"],
            "recommandations": ["Continuer le suivi"],
            "analyses_vendeurs": []
        }
    
    # Check if bilan already exists for this period
    existing = await db.team_bilans.find_one({
        "manager_id": manager_id,
        "periode": periode
    })
    
    bilan_data = {
        "id": existing['id'] if existing else str(uuid.uuid4()),
        "manager_id": manager_id,
        "periode": periode,
        "synthese": ai_result.get('synthese', ''),
        "points_forts": ai_result.get('points_forts', []),
        "points_attention": ai_result.get('points_attention', []),
        "recommandations": ai_result.get('recommandations', []),
        "analyses_vendeurs": ai_result.get('analyses_vendeurs', []),
        "kpi_resume": {
            "ca_total": round(total_ca, 2),
            "ventes": total_ventes,
            "articles": total_articles,
            "panier_moyen": round(panier_moyen_equipe, 2),
            "indice_vente": round(indice_vente_equipe, 2)
        },
        "competences_moyenne": competences_moyenne,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Upsert the bilan
    await db.team_bilans.update_one(
        {"manager_id": manager_id, "periode": periode},
        {"$set": bilan_data},
        upsert=True
    )
    
    return TeamBilan(**bilan_data)

@api_router.post("/manager/team-bilan")
async def generate_team_bilan(
    start_date: str = None,  # Format YYYY-MM-DD
    end_date: str = None,    # Format YYYY-MM-DD
    current_user: dict = Depends(get_current_user)
):
    """Generate team bilan for a specific period or current week"""
    if current_user['role'] != 'manager':
        raise HTTPException(status_code=403, detail="Only managers can generate team bilan")
    
    # Get all sellers in this manager's store
    sellers = await db.users.find({
        "store_id": current_user.get('store_id'),
        "role": "seller",
        "status": {"$nin": ["deleted", "inactive"]}
    }, {"_id": 0}).to_list(1000)
    
    if not sellers:
        raise HTTPException(status_code=404, detail="No sellers in your store")
    
    # Determine period
    if start_date and end_date:
        start = datetime.strptime(start_date, '%Y-%m-%d').date()
        end = datetime.strptime(end_date, '%Y-%m-%d').date()
    else:
        # Default: current week (Monday to Sunday)
        today = datetime.now(timezone.utc).date()
        start = today - timedelta(days=today.weekday())
        end = start + timedelta(days=6)
    
    # Generate bilan using the helper function
    bilan = await generate_team_bilan_for_period(
        manager_id=current_user['id'],
        start_date=start,
        end_date=end,
        sellers=sellers
    )
    
    return bilan

@api_router.get("/manager/team-bilan/latest")
async def get_latest_team_bilan(current_user: dict = Depends(get_current_user)):
    if current_user['role'] != 'manager':
        raise HTTPException(status_code=403, detail="Only managers can access team bilan")
    
    bilan = await db.team_bilans.find_one(
        {"manager_id": current_user['id']},
        {"_id": 0},
        sort=[("created_at", -1)]
    )
    
    if not bilan:
        return {"status": "no_bilan", "bilan": None}
    
    if isinstance(bilan.get('created_at'), str):
        bilan['created_at'] = datetime.fromisoformat(bilan['created_at'])
    
    return {"status": "success", "bilan": bilan}

@api_router.get("/manager/team-bilans/all")
async def get_all_team_bilans(current_user: dict = Depends(get_current_user)):
    """Get all team bilans for the manager, sorted by date (most recent first)"""
    if current_user['role'] != 'manager':
        raise HTTPException(status_code=403, detail="Only managers can access team bilans")
    
    bilans = await db.team_bilans.find(
        {"manager_id": current_user['id']},
        {"_id": 0}
    ).sort("created_at", -1).to_list(length=None)
    
    # Convert datetime strings to datetime objects
    for bilan in bilans:
        if isinstance(bilan.get('created_at'), str):
            bilan['created_at'] = datetime.fromisoformat(bilan['created_at'])
    
    return {"status": "success", "bilans": bilans}

# ===== SELLER INDIVIDUAL BILAN ROUTES =====

async def generate_seller_bilan_for_period(seller_id: str, start_date: date, end_date: date, seller: dict):
    """Helper function to generate an individual bilan for a seller for a specific period"""
    periode = f"Semaine du {start_date.strftime('%d/%m/%y')} au {end_date.strftime('%d/%m/%y')}"
    
    # Get manager's KPI configuration
    seller_user = await db.users.find_one({"id": seller_id}, {"_id": 0})
    if not seller_user or not seller_user.get('manager_id'):
        # Fallback: all KPIs enabled
        kpi_config = {
            "track_ca": True,
            "track_ventes": True,
            "track_articles": True
        }
    else:
        # Get KPI configuration from kpi_configs collection
        manager_kpi_config = await db.kpi_configs.find_one({"manager_id": seller_user['manager_id']}, {"_id": 0})
        if manager_kpi_config:
            kpi_config = {
                "track_ca": manager_kpi_config.get('track_ca', True),
                "track_ventes": manager_kpi_config.get('track_ventes', True),
                "track_articles": manager_kpi_config.get('track_articles', True)
            }
        else:
            # Fallback: all KPIs enabled
            kpi_config = {
                "track_ca": True,
                "track_ventes": True,
                "track_articles": True
            }
    
    # Get KPIs for this period
    kpi_entries = await db.kpi_entries.find({
        "seller_id": seller_id,
        "date": {
            "$gte": start_date.strftime('%Y-%m-%d'),
            "$lte": end_date.strftime('%Y-%m-%d')
        }
    }, {"_id": 0}).to_list(1000)
    
    # Calculate totals
    total_ca = sum(e.get('ca_journalier', 0) for e in kpi_entries)
    total_ventes = sum(e.get('nb_ventes', 0) for e in kpi_entries)
    total_articles = sum(e.get('nb_articles', 0) for e in kpi_entries)
    
    # Calculate derived KPIs ONLY if base metrics are tracked
    panier_moyen = (total_ca / total_ventes) if (kpi_config.get('track_ca') and kpi_config.get('track_ventes') and total_ventes > 0) else None
    taux_transfo = None  # Removed - no longer tracking clients
    indice_vente = ((total_articles / total_ventes) if total_ventes > 0 else None) if (kpi_config.get('track_articles') and kpi_config.get('track_ventes')) else None
    
    # Get seller diagnostic
    diagnostic = await db.diagnostics.find_one({"seller_id": seller_id}, {"_id": 0})
    
    # Build context for AI
    seller_context = f"""Vendeur : {seller.get('name', 'Vendeur')}
Profil de vente :
- Style : {diagnostic.get('style', 'Non défini') if diagnostic else 'Non défini'}
- Niveau : {diagnostic.get('level', 'Non défini') if diagnostic else 'Non défini'}
- Motivation : {diagnostic.get('motivation', 'Non définie') if diagnostic else 'Non définie'}
"""
    
    if diagnostic and diagnostic.get('disc_dominant'):
        seller_context += f"- Profil DISC : {diagnostic['disc_dominant']}\n"
    
    # Build KPI context with ONLY tracked metrics
    kpi_lines = []
    kpi_lines.append(f"KPIs pour la période {periode} :")
    
    if kpi_config.get('track_ca'):
        kpi_lines.append(f"- CA Total : {total_ca:.2f}€")
    if kpi_config.get('track_ventes'):
        kpi_lines.append(f"- Nombre de ventes : {total_ventes}")
    if kpi_config.get('track_articles'):
        kpi_lines.append(f"- Nombre d'articles : {total_articles}")
    if panier_moyen is not None:
        kpi_lines.append(f"- Panier moyen : {panier_moyen:.2f}€")
    if taux_transfo is not None:
        kpi_lines.append(f"- Taux de transformation : {taux_transfo:.2f}%")
    if indice_vente is not None:
        kpi_lines.append(f"- Indice de vente : {indice_vente:.2f}")
    
    kpi_context = "\n".join(kpi_lines)
    
    # Count days with KPI entries in the period
    jours_actifs = len(kpi_entries)
    
    # ===== TEAM COMPARISON DATA (Option A - Constructive) =====
    team_context = ""
    if seller_user and seller_user.get('manager_id'):
        # Get all sellers from the same team (same manager)
        team_sellers = await db.users.find({
            "manager_id": seller_user['manager_id'],
            "role": "seller"
        }, {"_id": 0, "id": 1}).to_list(100)
        
        team_seller_ids = [s['id'] for s in team_sellers]
        
        # Get KPIs for all team members for the same period
        team_kpi_entries = await db.kpi_entries.find({
            "seller_id": {"$in": team_seller_ids},
            "date": {
                "$gte": start_date.strftime('%Y-%m-%d'),
                "$lte": end_date.strftime('%Y-%m-%d')
            }
        }, {"_id": 0}).to_list(10000)
        
        if len(team_kpi_entries) > 0 and len(team_seller_ids) > 1:
            # Group KPIs by seller
            seller_totals = {}
            for entry in team_kpi_entries:
                sid = entry['seller_id']
                if sid not in seller_totals:
                    seller_totals[sid] = {'ca': 0, 'ventes': 0, 'articles': 0}
                seller_totals[sid]['ca'] += entry.get('ca_journalier', 0)
                seller_totals[sid]['ventes'] += entry.get('nb_ventes', 0)
                seller_totals[sid]['articles'] += entry.get('nb_articles', 0)
            
            # Filter out sellers with no real data (all zeros or very low values)
            # Only include sellers who have actually entered meaningful data
            active_sellers_data = []
            for sid, totals in seller_totals.items():
                # Consider a seller as "active with data" if they have any significant values
                # CA > 0 OR ventes > 0 OR articles > 0
                if totals['ca'] > 0 or totals['ventes'] > 0 or totals['articles'] > 0:
                    active_sellers_data.append(totals)
            
            # Calculate team averages ONLY from sellers with real data
            active_sellers = len(active_sellers_data)
            if active_sellers > 1:  # Only compare if there are other sellers with data
                team_ca_avg = sum(s['ca'] for s in active_sellers_data) / active_sellers
                team_ventes_avg = sum(s['ventes'] for s in active_sellers_data) / active_sellers
                team_articles_avg = sum(s['articles'] for s in active_sellers_data) / active_sellers
                
                # Calculate team derived KPIs
                team_panier_moyen_avg = team_ca_avg / team_ventes_avg if team_ventes_avg > 0 else None
                team_indice_vente_avg = team_articles_avg / team_ventes_avg if team_ventes_avg > 0 else None
                
                # Build team comparison context
                team_lines = [f"\nDonnées de référence de l'équipe ({active_sellers} vendeurs avec données saisies sur cette période) :"]
                
                if kpi_config.get('track_ca') and team_ca_avg > 0:
                    ecart_ca = ((total_ca - team_ca_avg) / team_ca_avg * 100) if team_ca_avg > 0 else 0
                    team_lines.append(f"- CA moyen de l'équipe : {team_ca_avg:.2f}€ (ton écart : {ecart_ca:+.1f}%)")
                
                if kpi_config.get('track_ventes') and team_ventes_avg > 0:
                    ecart_ventes = ((total_ventes - team_ventes_avg) / team_ventes_avg * 100) if team_ventes_avg > 0 else 0
                    team_lines.append(f"- Ventes moyennes de l'équipe : {team_ventes_avg:.1f} (ton écart : {ecart_ventes:+.1f}%)")
                
                if kpi_config.get('track_articles') and team_articles_avg > 0:
                    ecart_articles = ((total_articles - team_articles_avg) / team_articles_avg * 100) if team_articles_avg > 0 else 0
                    team_lines.append(f"- Articles moyens de l'équipe : {team_articles_avg:.1f} (ton écart : {ecart_articles:+.1f}%)")
                
                if panier_moyen is not None and team_panier_moyen_avg is not None and team_panier_moyen_avg > 0:
                    ecart_pm = ((panier_moyen - team_panier_moyen_avg) / team_panier_moyen_avg * 100)
                    team_lines.append(f"- Panier moyen de l'équipe : {team_panier_moyen_avg:.2f}€ (ton écart : {ecart_pm:+.1f}%)")
                
                if indice_vente is not None and team_indice_vente_avg is not None and team_indice_vente_avg > 0:
                    ecart_iv = ((indice_vente - team_indice_vente_avg) / team_indice_vente_avg * 100)
                    team_lines.append(f"- Indice de vente moyen de l'équipe : {team_indice_vente_avg:.2f} (ton écart : {ecart_iv:+.1f}%)")
                
                team_context = "\n".join(team_lines)
    
    # Check if we have enough data
    if jours_actifs == 0:
        # No KPI data for this period
        return SellerBilan(
            id=str(uuid.uuid4()),
            seller_id=seller_id,
            periode=periode,
            synthese=f"Aucun KPI enregistré pour la semaine du {start_date.strftime('%d/%m')} au {end_date.strftime('%d/%m')}. Pense à entrer tes KPIs quotidiennement pour suivre ta progression !",
            points_forts=[""],
            points_attention=["Entre tes KPIs chaque jour pour avoir un bilan précis"],
            recommandations=["Commence par saisir tes KPIs (CA, Ventes, Clients, Articles) via le bouton '+ Nouveau KPI'"],
            kpi_resume={
                "ca_total": 0,
                "ventes": 0,
                "clients": 0,
                "articles": 0,
                "panier_moyen": 0,
                "taux_transformation": 0,
                "indice_vente": 0
            },
            created_at=datetime.now(timezone.utc)
        )
    
    prompt = f"""Tu es un coach en vente retail. Analyse les performances INDIVIDUELLES de ce vendeur pour la semaine et génère un bilan personnalisé avec une approche CONSTRUCTIVE et POSITIVE.

{seller_context}

{kpi_context}

Jours actifs : {jours_actifs} jours avec des KPIs saisis
{team_context}

IMPORTANT : Réponds UNIQUEMENT avec un objet JSON valide, sans texte avant ou après. Format exact :
{{
  "synthese": "Une phrase résumant la performance individuelle du vendeur cette semaine",
  "points_forts": ["Point fort personnel 1", "Point fort personnel 2"],
  "points_attention": ["Point d'attention personnel 1", "Point d'attention personnel 2"],
  "recommandations": ["Action personnalisée 1", "Action personnalisée 2", "Action personnalisée 3"]
}}

Consignes CRITIQUES :
- Analyse INDIVIDUELLE avec contexte d'équipe ANONYME et CONSTRUCTIF
- Si des données d'équipe sont fournies, utilise-les comme RÉFÉRENCES POSITIVES et MOTIVANTES
- Ne mentionne JAMAIS d'autres vendeurs nommément ou de classements explicites
- Approche : "L'équipe réalise X en moyenne" plutôt que "Tu es Xème"
- Si le vendeur est au-dessus de la moyenne : VALORISE et ENCOURAGE à maintenir
- Si le vendeur est en-dessous de la moyenne : MOTIVE vers un objectif atteignable sans démotiver
- Formule toujours de manière POSITIVE : "Tu peux progresser vers X" plutôt que "Tu es en retard"
- Sois précis avec les chiffres du vendeur (utilise UNIQUEMENT ses données)
- NE PARLE QUE DES INDICATEURS FOURNIS CI-DESSUS dans la liste des KPIs
- Si un indicateur n'est PAS listé ci-dessus (ex: clients, articles), c'est parce qu'il N'EST PAS SUIVI par le manager - NE LE MENTIONNE PAS DU TOUT
- Ne demande JAMAIS au vendeur de saisir un indicateur qui n'est pas dans la liste des KPIs
- Les "points d'attention" doivent porter UNIQUEMENT sur les performances réelles sur les indicateurs suivis, PAS sur des données manquantes
- Recommandations concrètes et personnalisées pour ce vendeur spécifiquement
- Mentionne son profil (style, niveau, DISC) dans l'analyse si pertinent
- Ton professionnel mais encourageant et motivant
- Utilise le tutoiement ("tu", "ton", "ta")
"""
    
    try:
        llm_chat = LlmChat(
            api_key=os.environ.get('EMERGENT_LLM_KEY'),
            session_id=f"seller_bilan_{seller_id}_{periode}",
            system_message="Tu es un coach en vente retail. Tu réponds TOUJOURS en JSON valide uniquement. Tu tutoies le vendeur."
        )
        user_message = UserMessage(text=prompt)
        response = await llm_chat.send_message(user_message)
        
        print(f"DEBUG Seller Bilan: AI raw response: {response[:200]}...")
        
        # Clean response (remove markdown, extra text, etc.)
        response_clean = response.strip()
        if "```json" in response_clean:
            response_clean = response_clean.split("```json")[1].split("```")[0].strip()
        elif "```" in response_clean:
            response_clean = response_clean.split("```")[1].split("```")[0].strip()
        
        # Find JSON object in response
        start_idx = response_clean.find('{')
        end_idx = response_clean.rfind('}') + 1
        if start_idx >= 0 and end_idx > start_idx:
            response_clean = response_clean[start_idx:end_idx]
        
        ai_result = json.loads(response_clean)
    except Exception as e:
        print(f"AI generation failed for seller bilan: {e}")
        ai_result = {
            "synthese": f"Bilan de ta semaine du {start_date.strftime('%d/%m')} au {end_date.strftime('%d/%m')}",
            "points_forts": ["Performance enregistrée"],
            "points_attention": ["À analyser"],
            "recommandations": ["Continue ton suivi régulier"]
        }
    
    # Check if bilan already exists for this period
    existing = await db.seller_bilans.find_one({
        "seller_id": seller_id,
        "periode": periode
    })
    
    # Build KPI resume with only available metrics
    kpi_resume = {}
    if kpi_config.get('track_ca'):
        kpi_resume["ca_total"] = round(total_ca, 2)
    if kpi_config.get('track_ventes'):
        kpi_resume["ventes"] = total_ventes
    if kpi_config.get('track_articles'):
        kpi_resume["articles"] = total_articles
    if panier_moyen is not None:
        kpi_resume["panier_moyen"] = round(panier_moyen, 2)
    if taux_transfo is not None:
        kpi_resume["taux_transformation"] = round(taux_transfo, 2)
    if indice_vente is not None:
        kpi_resume["indice_vente"] = round(indice_vente, 2)
    
    bilan_data = {
        "id": existing['id'] if existing else str(uuid.uuid4()),
        "seller_id": seller_id,
        "periode": periode,
        "synthese": ai_result.get('synthese', ''),
        "points_forts": ai_result.get('points_forts', []),
        "points_attention": ai_result.get('points_attention', []),
        "recommandations": ai_result.get('recommandations', []),
        "kpi_resume": kpi_resume,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Upsert the bilan
    await db.seller_bilans.update_one(
        {"seller_id": seller_id, "periode": periode},
        {"$set": bilan_data},
        upsert=True
    )
    
    return SellerBilan(**bilan_data)

@api_router.post("/seller/bilan-individuel")
async def generate_seller_bilan(
    start_date: str = None,  # Format YYYY-MM-DD
    end_date: str = None,    # Format YYYY-MM-DD
    current_user: dict = Depends(get_current_user)
):
    """Generate individual bilan for the current seller for a specific period or current week"""
    if current_user['role'] != 'seller':
        raise HTTPException(status_code=403, detail="Only sellers can generate individual bilan")
    
    # Get seller info
    seller = await db.users.find_one({"id": current_user['id']}, {"_id": 0})
    
    if not seller:
        raise HTTPException(status_code=404, detail="Seller not found")
    
    # Determine period
    if start_date and end_date:
        start = datetime.strptime(start_date, '%Y-%m-%d').date()
        end = datetime.strptime(end_date, '%Y-%m-%d').date()
    else:
        # Default: current week (Monday to Sunday)
        today = datetime.now(timezone.utc).date()
        start = today - timedelta(days=today.weekday())
        end = start + timedelta(days=6)
    
    # Generate bilan using the helper function
    bilan = await generate_seller_bilan_for_period(
        seller_id=current_user['id'],
        start_date=start,
        end_date=end,
        seller=seller
    )
    
    return bilan

@api_router.get("/seller/bilan-individuel/all")
async def get_all_seller_bilans(current_user: dict = Depends(get_current_user)):
    """Get all individual bilans for the current seller, sorted by date (most recent first)"""
    if current_user['role'] != 'seller':
        raise HTTPException(status_code=403, detail="Only sellers can access individual bilans")
    
    bilans = await db.seller_bilans.find(
        {"seller_id": current_user['id']},
        {"_id": 0}
    ).sort("created_at", -1).to_list(length=None)
    
    # Convert datetime strings to datetime objects
    for bilan in bilans:
        if isinstance(bilan.get('created_at'), str):
            bilan['created_at'] = datetime.fromisoformat(bilan['created_at'])
    
    return {"status": "success", "bilans": bilans}

# ===== CONFLICT RESOLUTION ROUTES =====

async def generate_conflict_resolution_analysis(
    conflict_data: dict,
    seller: dict,
    manager_profile: dict,
    seller_diagnostic: dict,
    debriefs: list,
    competences: dict,
    kpis: list
) -> dict:
    """Generate AI-powered personalized conflict resolution recommendations"""
    
    # Build context about manager
    manager_context = f"""Profil Manager :
- Type : {manager_profile.get('profil_nom', 'Non défini')}
- Description : {manager_profile.get('profil_description', 'N/A')}
- Forces : {manager_profile.get('force_1', '')}, {manager_profile.get('force_2', '')}
- Axe de progression : {manager_profile.get('axe_progression', 'N/A')}
"""

    # Build context about seller
    seller_context = f"""Profil Vendeur ({seller.get('name', 'Vendeur')}) :
- Style : {seller_diagnostic.get('style', 'Non défini')}
- Niveau : {seller_diagnostic.get('level', 'Non défini')}
- Motivation : {seller_diagnostic.get('motivation', 'Non définie')}
- Profil IA : {seller_diagnostic.get('ai_profile_summary', 'N/A')}
"""

    # Build competences context
    comp_context = f"""Compétences actuelles (sur 5) :
- Accueil : {competences.get('score_accueil', 'N/A')}
- Découverte : {competences.get('score_decouverte', 'N/A')}
- Argumentation : {competences.get('score_argumentation', 'N/A')}
- Closing : {competences.get('score_closing', 'N/A')}
- Fidélisation : {competences.get('score_fidelisation', 'N/A')}
"""

    # Build recent performance context
    recent_debriefs_count = len(debriefs) if debriefs else 0
    recent_kpi_summary = ""
    if kpis and len(kpis) > 0:
        total_ca = sum([k.get('ca_journalier', 0) for k in kpis])
        total_ventes = sum([k.get('nb_ventes', 0) for k in kpis])
        avg_panier = total_ca / total_ventes if total_ventes > 0 else 0
        recent_kpi_summary = f"""Performance récente (7 derniers jours) :
- CA total : {total_ca:.2f}€
- Nombre de ventes : {total_ventes}
- Panier moyen : {avg_panier:.2f}€
"""
    else:
        recent_kpi_summary = "Aucune donnée KPI récente disponible"

    prompt = f"""Tu es un coach professionnel spécialisé en management retail et en gestion de conflits.

Tu t'adresses directement au manager qui te consulte. Ton rôle est de fournir une analyse personnalisée et des recommandations concrètes en tenant compte de son profil et de celui de son vendeur.

### VOTRE PROFIL DE MANAGER
{manager_context}

### PROFIL DE VOTRE VENDEUR ({seller.get('name', 'votre vendeur')})
{seller_context}

{comp_context}

{recent_kpi_summary}

Nombre de débriefs récents du vendeur : {recent_debriefs_count}

### LA SITUATION QUE VOUS DÉCRIVEZ

**Contexte :** {conflict_data.get('contexte')}

**Comportement observé :** {conflict_data.get('comportement_observe')}

**Impact :** {conflict_data.get('impact')}

**Tentatives précédentes :** {conflict_data.get('tentatives_precedentes')}

**Détails supplémentaires :** {conflict_data.get('description_libre')}

### OBJECTIF
Fournis une analyse et des recommandations PERSONNALISÉES qui tiennent compte :
1. Du style de management du manager (utilise "vous" et "votre/vos" pour vous adresser directement à lui)
2. Du profil du vendeur
3. Des compétences et performances actuelles du vendeur
4. De la situation conflictuelle spécifique

### FORMAT DE SORTIE (JSON uniquement)
Réponds UNIQUEMENT avec un objet JSON valide :
{{
  "analyse_situation": "[3-4 phrases d'analyse de la situation. IMPORTANT: Vouvoie le manager directement en utilisant 'vous', 'votre', 'vos'. Ex: 'La situation actuelle entre votre vendeur et vous...', 'Vous faites face à...', 'Votre style de management...'. Identifie les causes probables du conflit. Ton professionnel et empathique.]",
  "approche_communication": "[4-5 phrases décrivant comment VOUS (le manager) devriez aborder la conversation. IMPORTANT: Utilise 'vous', 'votre', 'vos' en permanence. Ex: 'Vous devriez entamer la conversation...', 'Votre approche doit être...', 'Vous pourriez dire...' Adapte le style au profil du manager ET du vendeur. Inclus des phrases d'accroche concrètes.]",
  "actions_concretes": [
    "[Action 1 - Commence par un verbe à l'infinitif ou utilise 'vous'. Ex: 'Organisez une réunion...' ou 'Vous devez organiser...']",
    "[Action 2 - spécifique et adaptée au contexte]",
    "[Action 3 - spécifique et adaptée au contexte]"
  ],
  "points_vigilance": [
    "[Point de vigilance 1 - en lien avec VOTRE style et VOS forces. Ex: 'Veillez à ne pas...', 'Faites attention à...']",
    "[Point de vigilance 2 - en lien avec les profils]"
  ]
}}

### STYLE ATTENDU
- VOUVOIEMENT OBLIGATOIRE : utilise "vous", "votre", "vos" pour vous adresser directement au manager
- Professionnel, empathique et constructif
- Personnalisé (mentionne explicitement les profils manager/vendeur)
- Orienté solution et action
- Langage managérial retail clair et accessible
- Évite les acronymes sans explication (ex: si tu utilises un acronyme, explique-le entre parenthèses)
- Maximum 15 lignes au total
"""

    try:
        api_key = os.environ.get('EMERGENT_LLM_KEY')
        chat = LlmChat(
            api_key=api_key,
            session_id=f"conflict_{uuid.uuid4()}",
            system_message="Tu es un expert en management retail et en gestion de conflits. Tu réponds UNIQUEMENT en JSON valide."
        ).with_model("openai", "gpt-4o-mini")
        
        user_message = UserMessage(text=prompt)
        ai_response = await chat.send_message(user_message)
        
        # Parse JSON response
        response_text = ai_response.strip()
        if response_text.startswith("```json"):
            response_text = response_text.replace("```json", "").replace("```", "").strip()
        elif response_text.startswith("```"):
            response_text = response_text.replace("```", "").strip()
            
        analysis = json.loads(response_text)
        
        return {
            "ai_analyse_situation": analysis.get("analyse_situation", ""),
            "ai_approche_communication": analysis.get("approche_communication", ""),
            "ai_actions_concretes": analysis.get("actions_concretes", []),
            "ai_points_vigilance": analysis.get("points_vigilance", [])
        }
        
    except Exception as e:
        logger.error(f"Error generating conflict resolution analysis: {str(e)}")
        return {
            "ai_analyse_situation": "Erreur lors de la génération de l'analyse. Veuillez réessayer.",
            "ai_approche_communication": "",
            "ai_actions_concretes": [],
            "ai_points_vigilance": []
        }

@api_router.post("/manager/conflict-resolution", response_model=ConflictResolution)
async def create_conflict_resolution(
    conflict: ConflictResolutionCreate,
    current_user: dict = Depends(get_current_user)
):
    if current_user['role'] != 'manager':
        raise HTTPException(status_code=403, detail="Only managers can create conflict resolutions")
    
    try:
        # Fetch seller info
        seller = await db.users.find_one({"id": conflict.seller_id, "manager_id": current_user['id']}, {"_id": 0})
        if not seller:
            raise HTTPException(status_code=404, detail="Seller not found or not under your management")
        
        # Fetch manager profile
        manager_profile = await db.manager_diagnostics.find_one({"manager_id": current_user['id']}, {"_id": 0})
        if not manager_profile:
            manager_profile = {}
        
        # Fetch seller diagnostic
        seller_diagnostic = await db.diagnostics.find_one({"seller_id": conflict.seller_id}, {"_id": 0})
        if not seller_diagnostic:
            seller_diagnostic = {}
        
        # Fetch seller debriefs (last 10)
        debriefs = await db.debriefs.find({"seller_id": conflict.seller_id}, {"_id": 0}).sort("created_at", -1).limit(10).to_list(10)
        
        # Fetch seller competences history (last entry)
        competences_history = await db.debriefs.find({"seller_id": conflict.seller_id}, {"_id": 0}).sort("created_at", -1).limit(1).to_list(1)
        current_competences = competences_history[0] if competences_history else {}
        
        # Fetch recent KPIs (last 7 days)
        seven_days_ago = datetime.now(timezone.utc) - timedelta(days=7)
        kpis = await db.kpi_entries.find({
            "seller_id": conflict.seller_id,
            "date": {"$gte": seven_days_ago.isoformat()}
        }, {"_id": 0}).to_list(100)
        
        # Generate AI analysis
        ai_analysis = await generate_conflict_resolution_analysis(
            conflict_data=conflict.dict(),
            seller=seller,
            manager_profile=manager_profile,
            seller_diagnostic=seller_diagnostic,
            debriefs=debriefs,
            competences=current_competences,
            kpis=kpis
        )
        
        # Create conflict resolution object
        conflict_obj = ConflictResolution(
            manager_id=current_user['id'],
            seller_id=conflict.seller_id,
            contexte=conflict.contexte,
            comportement_observe=conflict.comportement_observe,
            impact=conflict.impact,
            tentatives_precedentes=conflict.tentatives_precedentes,
            description_libre=conflict.description_libre,
            **ai_analysis
        )
        
        # Save to database
        doc = conflict_obj.model_dump()
        doc['created_at'] = doc['created_at'].isoformat()
        await db.conflict_resolutions.insert_one(doc)
        
        return conflict_obj
        
    except HTTPException as he:
        raise he
    except Exception as e:
        logger.error(f"Error creating conflict resolution: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error creating conflict resolution: {str(e)}")

@api_router.get("/manager/conflict-history/{seller_id}")
async def get_conflict_history(
    seller_id: str,
    current_user: dict = Depends(get_current_user)
):
    if current_user['role'] != 'manager':
        raise HTTPException(status_code=403, detail="Only managers can access conflict history")
    
    # Verify seller is under this manager
    seller = await db.users.find_one({"id": seller_id, "manager_id": current_user['id']}, {"_id": 0})
    if not seller:
        raise HTTPException(status_code=404, detail="Seller not found or not under your management")
    
    # Get all conflict resolutions for this seller
    conflicts = await db.conflict_resolutions.find(
        {"seller_id": seller_id, "manager_id": current_user['id']},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    # Convert datetime strings to datetime objects
    for conflict in conflicts:
        if isinstance(conflict.get('created_at'), str):
            conflict['created_at'] = datetime.fromisoformat(conflict['created_at'])
    
    return conflicts

@api_router.delete("/manager/seller/{seller_id}/diagnostic")
async def reset_seller_diagnostic(
    seller_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Reset seller diagnostic so they can retake the test"""
    if current_user['role'] != 'manager':
        raise HTTPException(status_code=403, detail="Only managers can reset diagnostics")
    
    # Verify seller belongs to manager
    seller = await db.users.find_one({"id": seller_id, "manager_id": current_user['id']})
    if not seller:
        raise HTTPException(status_code=404, detail="Seller not found")
    
    # Delete diagnostic
    result = await db.diagnostics.delete_one({"seller_id": seller_id})
    
    return {"status": "success", "message": "Diagnostic reset successfully"}

@api_router.delete("/manager/diagnostic")
async def reset_manager_diagnostic(
    current_user: dict = Depends(get_current_user)
):
    """Reset manager diagnostic so they can retake the test"""
    if current_user['role'] != 'manager':
        raise HTTPException(status_code=403, detail="Only managers can reset their diagnostic")
    
    # Delete manager diagnostic
    result = await db.manager_diagnostics.delete_one({"manager_id": current_user['id']})
    
    return {"status": "success", "message": "Manager diagnostic reset successfully"}

# ===== KPI CONFIGURATION ENDPOINTS =====
@api_router.get("/manager/kpi-config")
async def get_kpi_config(
    store_id: str = None,
    current_user: dict = Depends(get_current_user)
):
    if current_user['role'] not in ['manager', 'gerant', 'gérant']:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Determine effective store_id
    effective_store_id = None
    if store_id and current_user['role'] in ['gerant', 'gérant']:
        effective_store_id = store_id
    elif current_user.get('store_id'):
        effective_store_id = current_user['store_id']
    
    # Try to find by store_id first, then by manager_id
    config = None
    if effective_store_id:
        config = await db.kpi_configs.find_one({"store_id": effective_store_id}, {"_id": 0})
    if not config and current_user.get('id'):
        config = await db.kpi_configs.find_one({"manager_id": current_user['id']}, {"_id": 0})
    
    if not config:
        # Create default config
        default_config = KPIConfiguration(
            manager_id=current_user['id'],
            track_ca=True,
            track_ventes=True,
            track_articles=True
        )
        doc = default_config.model_dump()
        doc['created_at'] = doc['created_at'].isoformat()
        doc['updated_at'] = doc['updated_at'].isoformat()
        await db.kpi_configs.insert_one(doc)
        return default_config
    
    return config

@api_router.put("/manager/kpi-config")
async def update_kpi_config(config_update: KPIConfigUpdate, current_user: dict = Depends(get_current_user)):
    if current_user['role'] != 'manager':
        raise HTTPException(status_code=403, detail="Only managers can update KPI config")
    
    update_data = {k: v for k, v in config_update.model_dump().items() if v is not None}
    
    # Enforce mutual exclusivity: a KPI cannot be tracked by both seller AND manager
    # If both are set to true for the same KPI, prioritize seller
    kpi_pairs = [
        ('seller_track_ca', 'manager_track_ca'),
        ('seller_track_ventes', 'manager_track_ventes'),
        ('seller_track_clients', 'manager_track_clients'),
        ('seller_track_articles', 'manager_track_articles'),
        ('seller_track_prospects', 'manager_track_prospects')
    ]
    
    for seller_field, manager_field in kpi_pairs:
        if update_data.get(seller_field) is True and update_data.get(manager_field) is True:
            # Both cannot be true simultaneously - prioritize seller
            update_data[manager_field] = False
    
    update_data['updated_at'] = datetime.now(timezone.utc).isoformat()
    
    result = await db.kpi_configs.update_one(
        {"manager_id": current_user['id']},
        {"$set": update_data},
        upsert=True
    )
    
    config = await db.kpi_configs.find_one({"manager_id": current_user['id']}, {"_id": 0})
    return config

@api_router.options("/manager/kpi-config")
async def options_kpi_config():
    """Handle OPTIONS preflight requests for KPI configuration endpoint"""
    from fastapi import Response
    response = Response()
    response.headers["Access-Control-Allow-Methods"] = "GET, PUT, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    response.headers["Access-Control-Max-Age"] = "86400"
    return response


@api_router.get("/manager/sync-mode")
async def get_manager_sync_mode(current_user: dict = Depends(get_current_user)):
    """
    Vérifier si le manager/seller est en mode synchronisation automatique.
    Utilisé par le frontend pour afficher les champs en lecture seule.
    """
    if current_user['role'] not in ['manager', 'seller', 'gerant']:
        return {"sync_mode": "manual", "is_enterprise": False}
    
    # Récupérer les infos utilisateur
    user = await db.users.find_one({"id": current_user['id']}, {"_id": 0})
    
    if not user:
        return {"sync_mode": "manual", "is_enterprise": False}
    
    # Si le user a un enterprise_account_id, récupérer les infos de l'entreprise
    if user.get('enterprise_account_id'):
        enterprise = await db.enterprise_accounts.find_one(
            {"id": user['enterprise_account_id']},
            {"_id": 0}
        )
        return {
            "sync_mode": user.get('sync_mode', 'manual'),
            "is_enterprise": True,
            "company_name": enterprise.get('company_name') if enterprise else None,
            "can_edit_kpi": False,  # Les KPI ne peuvent pas être modifiés en mode entreprise
            "can_edit_objectives": True  # Les objectifs/challenges peuvent être modifiés
        }
    
    # Mode PME classique
    return {
        "sync_mode": user.get('sync_mode', 'manual'),
        "is_enterprise": False,
        "can_edit_kpi": True,
        "can_edit_objectives": True
    }


# ===== STORE KPI ENDPOINTS =====
@api_router.post("/manager/store-kpi")
async def create_or_update_store_kpi(
    store_kpi_data: StoreKPICreate,
    current_user: dict = Depends(get_current_user)
):
    """Create or update store KPI (prospects) for a specific date"""
    if current_user['role'] != 'manager':
        raise HTTPException(status_code=403, detail="Only managers can manage store KPIs")
    
    # Check if KPI exists for this date
    existing = await db.store_kpis.find_one({
        "manager_id": current_user['id'],
        "date": store_kpi_data.date
    }, {"_id": 0})
    
    if existing:
        # Update existing
        await db.store_kpis.update_one(
            {"manager_id": current_user['id'], "date": store_kpi_data.date},
            {
                "$set": {
                    "nb_prospects": store_kpi_data.nb_prospects,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }
            }
        )
        kpi = await db.store_kpis.find_one({
            "manager_id": current_user['id'],
            "date": store_kpi_data.date
        }, {"_id": 0})
    else:
        # Create new
        new_kpi = StoreKPI(
            manager_id=current_user['id'],
            date=store_kpi_data.date,
            nb_prospects=store_kpi_data.nb_prospects
        )
        await db.store_kpis.insert_one(new_kpi.dict())
        kpi = new_kpi.dict()
    
    return kpi

@api_router.get("/manager/store-kpi")
async def get_store_kpis(
    start_date: str = None,
    end_date: str = None,
    current_user: dict = Depends(get_current_user)
):
    """Get store KPIs for a date range"""
    if current_user['role'] != 'manager':
        raise HTTPException(status_code=403, detail="Only managers can access store KPIs")
    
    query = {"manager_id": current_user['id']}
    
    if start_date and end_date:
        query["date"] = {"$gte": start_date, "$lte": end_date}
    
    kpis = await db.store_kpis.find(query, {"_id": 0}).sort("date", -1).to_list(1000)
    return kpis

@api_router.get("/manager/store-kpi/stats")
async def get_store_kpi_stats(
    store_id: str = None,
    current_user: dict = Depends(get_current_user)
):
    """Get store KPI stats with transformation rate"""
    if current_user['role'] not in ['manager', 'gerant', 'gérant']:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Determine effective store_id
    effective_store_id = None
    if store_id and current_user['role'] in ['gerant', 'gérant']:
        effective_store_id = store_id
    elif current_user.get('store_id'):
        effective_store_id = current_user['store_id']
    
    today = datetime.now().strftime('%Y-%m-%d')
    
    # Get week dates
    today_date = datetime.now()
    week_start = (today_date - timedelta(days=today_date.weekday())).strftime('%Y-%m-%d')
    week_end = today_date.strftime('%Y-%m-%d')
    
    # Get month dates
    month_start = today_date.replace(day=1).strftime('%Y-%m-%d')
    month_end = today_date.strftime('%Y-%m-%d')
    
    # Build query based on available identifiers
    query_base = {}
    if effective_store_id:
        query_base["store_id"] = effective_store_id
    elif current_user.get('id'):
        query_base["manager_id"] = current_user['id']
    
    # Get store KPIs
    today_kpi = await db.store_kpis.find_one({
        **query_base,
        "date": today
    }, {"_id": 0})
    
    week_kpis = await db.store_kpis.find({
        **query_base,
        "date": {"$gte": week_start, "$lte": week_end}
    }, {"_id": 0}).to_list(1000)
    
    month_kpis = await db.store_kpis.find({
        **query_base,
        "date": {"$gte": month_start, "$lte": month_end}
    }, {"_id": 0}).to_list(1000)
    
    # Get sellers for this store/manager
    seller_query = {}
    if effective_store_id:
        seller_query["store_id"] = effective_store_id
    elif current_user.get('id'):
        seller_query["manager_id"] = current_user['id']
    seller_query["role"] = "seller"
    seller_query["status"] = {"$nin": ["deleted", "inactive"]}
    
    sellers = await db.users.find(seller_query
        "manager_id": current_user['id'],
        "role": "seller"
    }, {"_id": 0, "id": 1}).to_list(1000)
    seller_ids = [s['id'] for s in sellers]
    
    # Get team sales (ventes)
    today_sales = await db.kpi_entries.find({
        "seller_id": {"$in": seller_ids},
        "date": today
    }, {"_id": 0}).to_list(1000)
    
    week_sales = await db.kpi_entries.find({
        "seller_id": {"$in": seller_ids},
        "date": {"$gte": week_start, "$lte": week_end}
    }, {"_id": 0}).to_list(1000)
    
    month_sales = await db.kpi_entries.find({
        "seller_id": {"$in": seller_ids},
        "date": {"$gte": month_start, "$lte": month_end}
    }, {"_id": 0}).to_list(1000)
    
    # Calculate stats
    today_prospects = today_kpi['nb_prospects'] if today_kpi else 0
    today_ventes = sum(s.get('nb_ventes', 0) for s in today_sales)
    today_rate = round((today_ventes / today_prospects * 100), 2) if today_prospects > 0 else 0
    
    week_prospects = sum(k['nb_prospects'] for k in week_kpis)
    week_ventes = sum(s.get('nb_ventes', 0) for s in week_sales)
    week_rate = round((week_ventes / week_prospects * 100), 2) if week_prospects > 0 else 0
    
    month_prospects = sum(k['nb_prospects'] for k in month_kpis)
    month_ventes = sum(s.get('nb_ventes', 0) for s in month_sales)
    month_rate = round((month_ventes / month_prospects * 100), 2) if month_prospects > 0 else 0
    
    return {
        "today": {
            "prospects": today_prospects,
            "ventes": today_ventes,
            "taux_transformation": today_rate
        },
        "week": {
            "prospects": week_prospects,
            "ventes": week_ventes,
            "taux_transformation": week_rate
        },
        "month": {
            "prospects": month_prospects,
            "ventes": month_ventes,
            "taux_transformation": month_rate
        }
    }

# ===== MANAGER KPI ENDPOINTS =====
@api_router.post("/manager/manager-kpi")
async def create_or_update_manager_kpi(
    manager_kpi_data: ManagerKPICreate,
    current_user: dict = Depends(get_current_user)
):
    """Create or update manager KPI data for a specific date"""
    if current_user['role'] != 'manager':
        raise HTTPException(status_code=403, detail="Only managers can manage their KPIs")
    
    # Check if KPI exists for this date
    existing = await db.manager_kpis.find_one({
        "manager_id": current_user['id'],
        "date": manager_kpi_data.date
    }, {"_id": 0})
    
    if existing:
        # Update existing
        update_data = {
            "store_id": current_user.get('store_id'),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        if manager_kpi_data.ca_journalier is not None:
            update_data["ca_journalier"] = manager_kpi_data.ca_journalier
        if manager_kpi_data.nb_ventes is not None:
            update_data["nb_ventes"] = manager_kpi_data.nb_ventes
        if manager_kpi_data.nb_clients is not None:
            update_data["nb_clients"] = manager_kpi_data.nb_clients
        if manager_kpi_data.nb_articles is not None:
            update_data["nb_articles"] = manager_kpi_data.nb_articles
        if manager_kpi_data.nb_prospects is not None:
            update_data["nb_prospects"] = manager_kpi_data.nb_prospects
        
        await db.manager_kpis.update_one(
            {"manager_id": current_user['id'], "date": manager_kpi_data.date},
            {"$set": update_data}
        )
        kpi = await db.manager_kpis.find_one({
            "manager_id": current_user['id'],
            "date": manager_kpi_data.date
        }, {"_id": 0})
    else:
        # Create new
        new_kpi = ManagerKPI(
            manager_id=current_user['id'],
            store_id=current_user.get('store_id'),
            date=manager_kpi_data.date,
            ca_journalier=manager_kpi_data.ca_journalier,
            nb_ventes=manager_kpi_data.nb_ventes,
            nb_clients=manager_kpi_data.nb_clients,
            nb_articles=manager_kpi_data.nb_articles,
            nb_prospects=manager_kpi_data.nb_prospects
        )
        await db.manager_kpis.insert_one(new_kpi.dict())
        kpi = new_kpi.dict()
    
    return kpi

@api_router.get("/manager/manager-kpi")
async def get_manager_kpis(
    start_date: str = None,
    end_date: str = None,
    current_user: dict = Depends(get_current_user)
):
    """Get manager KPIs for a date range"""
    if current_user['role'] != 'manager':
        raise HTTPException(status_code=403, detail="Only managers can access their KPIs")
    
    query = {"manager_id": current_user['id']}
    
    if start_date and end_date:
        query["date"] = {"$gte": start_date, "$lte": end_date}
    
    kpis = await db.manager_kpis.find(query, {"_id": 0}).sort("date", -1).to_list(1000)
    return kpis

@api_router.post("/manager/analyze-team")
async def analyze_team(
    request_data: dict,
    current_user: dict = Depends(get_current_user)
):
    """Analyze team performance using AI"""
    if current_user['role'] != 'manager':
        raise HTTPException(status_code=403, detail="Only managers can access this endpoint")
    
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        from dotenv import load_dotenv
        load_dotenv()
        
        team_data = request_data.get("team_data", {})
        period_filter = request_data.get("period_filter", "30")
        start_date = request_data.get("start_date")
        end_date = request_data.get("end_date")
        
        # Calculer la période d'analyse
        from datetime import timedelta
        today = datetime.now(timezone.utc)
        
        if period_filter == 'custom' and start_date and end_date:
            period_start = start_date
            period_end = end_date
            period_label = f"du {start_date} au {end_date}"
        elif period_filter == 'all':
            period_start = (today - timedelta(days=365)).strftime('%Y-%m-%d')
            period_end = today.strftime('%Y-%m-%d')
            period_label = "sur l'année"
        elif period_filter == '90':
            period_start = (today - timedelta(days=90)).strftime('%Y-%m-%d')
            period_end = today.strftime('%Y-%m-%d')
            period_label = "sur 3 mois"
        elif period_filter == '7':
            period_start = (today - timedelta(days=7)).strftime('%Y-%m-%d')
            period_end = today.strftime('%Y-%m-%d')
            period_label = "sur 7 jours"
        else:  # default '30'
            period_start = (today - timedelta(days=30)).strftime('%Y-%m-%d')
            period_end = today.strftime('%Y-%m-%d')
            period_label = "sur 30 jours"
        
        # Build context with team data (avec anonymisation des noms de famille)
        sellers_summary = []
        for seller in team_data.get('sellers_details', []):
            # Anonymiser le nom : garder uniquement le prénom
            anonymous_name = anonymize_name_for_ai(seller['name'])
            sellers_summary.append(
                f"- {anonymous_name}: CA {seller['ca']:.0f}€, {seller['ventes']} ventes, "
                f"PM {seller['panier_moyen']:.2f}€, Compétences {seller['avg_competence']:.1f}/10 "
                f"(Fort: {seller['best_skill']}, Faible: {seller['worst_skill']})"
            )
        
        context = f"""
Tu es un expert en management retail et coaching d'équipe. Analyse cette équipe de boutique physique et fournis des recommandations managériales pour MOTIVER et DÉVELOPPER l'équipe.

CONTEXTE : Boutique physique avec flux naturel de clients. Focus sur performance commerciale ET dynamique d'équipe.

PÉRIODE D'ANALYSE : {period_label}

ÉQUIPE :
- Taille : {team_data.get('total_sellers', 0)} vendeurs
- CA Total : {team_data.get('team_total_ca', 0):.0f} €
- Ventes Totales : {team_data.get('team_total_ventes', 0)}

VENDEURS :
{chr(10).join(sellers_summary)}

CONSIGNES :
- NE MENTIONNE PAS la complétion KPI (saisie des données) - c'est un sujet administratif, pas commercial
- Concentre-toi sur les PERFORMANCES COMMERCIALES et la DYNAMIQUE D'ÉQUIPE
- **IMPORTANT : Mentionne SYSTÉMATIQUEMENT les données chiffrées (CA, nombre de ventes, panier moyen) pour chaque vendeur dans ton analyse**
- Fournis des recommandations MOTIVANTES et CONSTRUCTIVES basées sur les chiffres
- Identifie les leviers de motivation individuels et collectifs
- Sois concis et actionnable (3 sections, 2-4 points par section)

Fournis l'analyse en 3 parties :

## ANALYSE D'ÉQUIPE
- Commence par rappeler les chiffres clés de l'équipe sur la période (CA total, nombre de ventes, panier moyen)
- Forces collectives et dynamique positive (avec données chiffrées à l'appui)
- Points d'amélioration ou déséquilibres à corriger (écarts de performance chiffrés)
- Opportunités de développement

## ACTIONS PAR VENDEUR
- Pour CHAQUE vendeur, mentionne ses résultats chiffrés (CA, ventes, PM) puis donne des recommandations personnalisées
- Format : "**[Nom]** (CA: XXX€, XX ventes, PM: XXX€) : [analyse et recommandations]"
- Focus sur développement des compétences et motivation
- Actions concrètes et bienveillantes

## RECOMMANDATIONS MANAGÉRIALES
- Actions pour renforcer la cohésion d'équipe
- Techniques de motivation adaptées à chaque profil
- Rituels ou animations pour dynamiser les ventes

Format : Markdown simple et structuré.
"""
        
        api_key = os.environ.get('EMERGENT_LLM_KEY')
        chat = LlmChat(
            api_key=api_key,
            session_id=f"team-analysis-{current_user['id']}",
            system_message="Tu es un expert en management d'équipe retail avec 15 ans d'expérience."
        ).with_model("openai", "gpt-4o")
        
        user_message = UserMessage(text=context)
        response = await chat.send_message(user_message)
        
        # Sauvegarder l'analyse dans la base de données
        analysis_id = str(uuid.uuid4())
        analysis_record = {
            "analysis_id": analysis_id,
            "manager_id": current_user['id'],
            "analysis": response,
            "team_data": team_data,
            "period_start": period_start,
            "period_end": period_end,
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.team_analyses.insert_one(analysis_record)
        
        return {
            "analysis_id": analysis_id,
            "analysis": response,
            "period_start": period_start,
            "period_end": period_end,
            "generated_at": datetime.now(timezone.utc).isoformat()
        }
        
    except Exception as e:
        print(f"Error in team AI analysis: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Erreur lors de l'analyse IA: {str(e)}")

@api_router.get("/manager/team-analyses-history")
async def get_team_analyses_history(
    current_user: dict = Depends(get_current_user)
):
    """Get history of team analyses"""
    if current_user['role'] != 'manager':
        raise HTTPException(status_code=403, detail="Only managers can access this endpoint")
    
    try:
        analyses = await db.team_analyses.find(
            {"manager_id": current_user['id']},
            {"_id": 0}
        ).sort("created_at", -1).to_list(100)
        
        return {"analyses": analyses}
        
    except Exception as e:
        print(f"Error fetching team analyses history: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Erreur: {str(e)}")

@api_router.delete("/manager/team-analysis/{analysis_id}")
async def delete_team_analysis(
    analysis_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a team analysis"""
    if current_user['role'] != 'manager':
        raise HTTPException(status_code=403, detail="Only managers can access this endpoint")
    
    try:
        result = await db.team_analyses.delete_one({
            "analysis_id": analysis_id,
            "manager_id": current_user['id']
        })
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Analysis not found")
        
        return {"status": "success", "message": "Analysis deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error deleting team analysis: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Erreur: {str(e)}")

@api_router.post("/manager/analyze-store-kpis")
async def analyze_store_kpis(
    request_data: dict,
    current_user: dict = Depends(get_current_user)
):
    """Analyze store KPIs using AI (accessible by managers and gérants)"""
    if current_user['role'] not in ['manager', 'gerant', 'gérant']:
        raise HTTPException(status_code=403, detail="Accès réservé aux managers et gérants")
    
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        from dotenv import load_dotenv
        load_dotenv()
        
        # Get KPI data from request
        kpi_data = request_data.get("kpi_data", {})
        date = kpi_data.get("date", "")
        
        # Prepare context for AI analysis - only include available data
        kpis = kpi_data.get('calculated_kpis', {})
        totals = kpi_data.get('totals', {})
        
        # Build context with only available data
        available_kpis = []
        if kpis.get('panier_moyen'):
            available_kpis.append(f"Panier Moyen : {kpis['panier_moyen']} €")
        if kpis.get('taux_transformation'):
            available_kpis.append(f"Taux de Transformation : {kpis['taux_transformation']} %")
        if kpis.get('indice_vente'):
            available_kpis.append(f"Indice de Vente (UPT) : {kpis['indice_vente']}")
        
        available_totals = []
        if totals.get('ca', 0) > 0:
            available_totals.append(f"CA Total : {totals['ca']} €")
        if totals.get('ventes', 0) > 0:
            available_totals.append(f"Ventes : {totals['ventes']}")
        if totals.get('clients', 0) > 0:
            available_totals.append(f"Clients : {totals['clients']}")
        if totals.get('articles', 0) > 0:
            available_totals.append(f"Articles : {totals['articles']}")
        if totals.get('prospects', 0) > 0:
            available_totals.append(f"Prospects : {totals['prospects']}")
        
        # Déterminer si c'est une période ou une date
        period_text = f"la période : {date}" if any(keyword in date.lower() for keyword in ['mois', 'semaine', 'dernier']) else f"le {date}"
        
        context = f"""
Tu es un expert en analyse de performance retail pour BOUTIQUES PHYSIQUES. Analyse UNIQUEMENT les données disponibles ci-dessous pour {period_text}. Ne mentionne PAS les données manquantes.

CONTEXTE IMPORTANT : Il s'agit d'une boutique avec flux naturel de clients. Les "prospects" représentent les visiteurs entrés en boutique, PAS de prospection active à faire. Le travail consiste à transformer les visiteurs en acheteurs.

Période analysée : {date}
Points de données : {kpi_data.get('sellers_reported', 0)} entrées

KPIs Disponibles :
{chr(10).join(['- ' + kpi for kpi in available_kpis]) if available_kpis else '(Aucun KPI calculé)'}

Totaux :
{chr(10).join(['- ' + total for total in available_totals]) if available_totals else '(Aucune donnée)'}

CONSIGNES STRICTES :
- Analyse UNIQUEMENT les données présentes
- Ne mentionne JAMAIS les données manquantes ou absentes
- Sois concis et direct (2-3 points max par section)
- Fournis des insights actionnables pour BOUTIQUE PHYSIQUE
- Si c'est une période longue, identifie les tendances
- NE RECOMMANDE PAS de prospection active (c'est une boutique, pas de la vente externe)
- Focus sur : accueil, découverte besoins, argumentation, closing, fidélisation

Fournis une analyse en 2 parties courtes :

## ANALYSE
- Observation clé sur les performances globales
- Point d'attention ou tendance notable
- Comparaison ou contexte si pertinent

## RECOMMANDATIONS
- Actions concrètes et prioritaires pour améliorer la vente en boutique (2-3 max)
- Focus sur l'amélioration des KPIs faibles (taux de transformation, panier moyen, indice de vente)

Format : Markdown simple et concis.
"""
        
        # Initialize AI chat
        api_key = os.environ.get('EMERGENT_LLM_KEY')
        chat = LlmChat(
            api_key=api_key,
            session_id=f"kpi-analysis-{current_user['id']}-{date}",
            system_message="Tu es un expert en analyse de performance retail avec 15 ans d'expérience."
        ).with_model("openai", "gpt-4o")
        
        # Send message and get analysis
        user_message = UserMessage(text=context)
        response = await chat.send_message(user_message)
        
        return {
            "analysis": response,
            "date": date,
            "generated_at": datetime.now(timezone.utc).isoformat()
        }
        
    except Exception as e:
        print(f"Error in AI analysis: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Erreur lors de l'analyse IA: {str(e)}")

def format_kpi_data(data):
    """Format manager KPI data for AI context"""
    if not data or len(data) == 0:
        return "Aucune donnée saisie"
    
    lines = []
    if data.get('ca_journalier'):
        lines.append(f"- CA : {data['ca_journalier']} €")
    if data.get('nb_ventes'):
        lines.append(f"- Ventes : {data['nb_ventes']}")
    if data.get('nb_clients'):
        lines.append(f"- Clients : {data['nb_clients']}")
    if data.get('nb_articles'):
        lines.append(f"- Articles : {data['nb_articles']}")
    if data.get('nb_prospects'):
        lines.append(f"- Prospects : {data['nb_prospects']}")
    
    return "\n".join(lines) if lines else "Aucune donnée"

def format_seller_data(data):
    """Format seller aggregated data for AI context"""
    if not data or data.get('nb_sellers_reported', 0) == 0:
        return "Aucun vendeur n'a saisi ses données"
    
    lines = [
        f"- CA : {data.get('ca_journalier', 0)} €",
        f"- Ventes : {data.get('nb_ventes', 0)}",
        f"- Clients : {data.get('nb_clients', 0)}",
        f"- Articles : {data.get('nb_articles', 0)}",
        f"- Prospects : {data.get('nb_prospects', 0)}",
        f"- Vendeurs ayant saisi : {data.get('nb_sellers_reported', 0)}"
    ]
    
    return "\n".join(lines)

@api_router.get("/manager/store-kpi-overview")
async def get_store_kpi_overview(
    date: str = None,
    current_user: dict = Depends(get_current_user)
):
    """Get consolidated store KPI overview combining manager and sellers data"""
    if current_user['role'] != 'manager':
        raise HTTPException(status_code=403, detail="Only managers can access store overview")
    
    if not date:
        date = datetime.now(timezone.utc).strftime('%Y-%m-%d')
    
    # Get manager KPIs for the date (filter by manager_id AND current store_id for accuracy after transfers)
    manager_kpi = await db.manager_kpis.find_one({
        "manager_id": current_user['id'],
        "store_id": current_user.get('store_id'),
        "date": date
    }, {"_id": 0})
    
    # Get all active sellers in this manager's store
    sellers = await db.users.find({
        "store_id": current_user.get('store_id'),
        "role": "seller",
        "status": "active"  # Filtre uniquement les vendeurs actifs
    }, {"_id": 0, "id": 1, "name": 1}).to_list(100)
    
    seller_ids = [s['id'] for s in sellers]
    
    # Get all seller KPI entries for the date
    seller_entries = await db.kpi_entries.find({
        "seller_id": {"$in": seller_ids},
        "date": date
    }, {"_id": 0}).to_list(100)
    
    # Enrich entries with seller names
    for entry in seller_entries:
        seller = next((s for s in sellers if s['id'] == entry['seller_id']), None)
        if seller:
            entry['seller_name'] = seller['name']
    
    # Aggregate seller data
    sellers_total = {
        "ca_journalier": 0,
        "nb_ventes": 0,
        "nb_clients": 0,
        "nb_articles": 0,
        "nb_prospects": 0,
        "nb_sellers_reported": len(seller_entries)
    }
    
    for entry in seller_entries:
        sellers_total["ca_journalier"] += entry.get("seller_ca") or entry.get("ca_journalier") or 0
        sellers_total["nb_ventes"] += entry.get("nb_ventes") or 0
        sellers_total["nb_clients"] += entry.get("nb_clients") or 0
        sellers_total["nb_articles"] += entry.get("nb_articles") or 0
        sellers_total["nb_prospects"] += entry.get("nb_prospects") or 0
    
    # Get store prospects (separate collection) - filter by current store_id
    store_kpi = await db.store_kpis.find_one({
        "manager_id": current_user['id'],
        "store_id": current_user.get('store_id'),
        "date": date
    }, {"_id": 0})
    
    # Calculate store-level KPIs
    manager_ca = manager_kpi.get("ca_journalier") if manager_kpi else None
    manager_ventes = manager_kpi.get("nb_ventes") if manager_kpi else None
    manager_clients = manager_kpi.get("nb_clients") if manager_kpi else None
    manager_articles = manager_kpi.get("nb_articles") if manager_kpi else None
    manager_prospects = manager_kpi.get("nb_prospects") if manager_kpi else None
    
    total_ca = (manager_ca or 0) + sellers_total["ca_journalier"]
    total_ventes = (manager_ventes or 0) + sellers_total["nb_ventes"]
    total_clients = (manager_clients or 0) + sellers_total["nb_clients"]
    total_articles = (manager_articles or 0) + sellers_total["nb_articles"]
    total_prospects = (manager_prospects or 0) + sellers_total["nb_prospects"]
    
    # Calculate derived KPIs
    calculated_kpis = {
        "panier_moyen": round(total_ca / total_ventes, 2) if total_ventes > 0 else None,
        "taux_transformation": round((total_ventes / total_prospects) * 100, 2) if total_prospects > 0 else None,
        "indice_vente": round(total_articles / total_ventes, 2) if total_ventes > 0 else None
    }
    
    # Get KPI configuration to know what sellers can track
    kpi_config = await db.kpi_configs.find_one({"manager_id": current_user['id']}, {"_id": 0})
    
    return {
        "date": date,
        "manager_data": manager_kpi or {},
        "sellers_data": sellers_total,
        "store_prospects": store_kpi.get("nb_prospects", 0) if store_kpi else 0,
        "seller_entries": seller_entries,
        "total_sellers": len(sellers),
        "sellers_reported": len(seller_entries),
        "calculated_kpis": calculated_kpis,
        "totals": {
            "ca": total_ca,
            "ventes": total_ventes,
            "clients": total_clients,
            "articles": total_articles,
            "prospects": total_prospects
        },
        "kpi_config": {
            "seller_track_ca": kpi_config.get("seller_track_ca", True) if kpi_config else True,
            "seller_track_ventes": kpi_config.get("seller_track_ventes", True) if kpi_config else True,
            "seller_track_clients": kpi_config.get("seller_track_clients", True) if kpi_config else True,
            "seller_track_articles": kpi_config.get("seller_track_articles", True) if kpi_config else True,
            "seller_track_prospects": kpi_config.get("seller_track_prospects", True) if kpi_config else True
        }
    }

# ===== DAILY CHALLENGE ENDPOINTS =====
@api_router.get("/seller/daily-challenge")
async def get_daily_challenge(current_user: dict = Depends(get_current_user), force_competence: str = None):
    """Get or generate daily challenge for seller"""
    if current_user['role'] != 'seller':
        raise HTTPException(status_code=403, detail="Only sellers can access daily challenges")
    
    today = datetime.now().strftime('%Y-%m-%d')
    
    # Check if there's an UNCOMPLETED challenge for today
    existing_uncompleted = await db.daily_challenges.find_one({
        "seller_id": current_user['id'],
        "date": today,
        "completed": False
    }, {"_id": 0})
    
    if existing_uncompleted:
        return existing_uncompleted
    
    # If all challenges today are completed, we can generate a new one
    # This allows multiple challenges per day if user completes them
    
    # Generate new challenge with AI
    try:
        # Get seller's diagnostic to personalize
        diagnostic = await db.diagnostics.find_one({
            "seller_id": current_user['id']
        }, {"_id": 0})
        
        # Get last 5 challenges to analyze performance and avoid repetition
        recent_challenges = await db.daily_challenges.find(
            {"seller_id": current_user['id']},
            {"_id": 0}
        ).sort("date", -1).limit(5).to_list(5)
        
        # Analyze performance trend for difficulty adaptation (Option A)
        last_3_results = [ch.get('challenge_result') for ch in recent_challenges[:3] if ch.get('completed')]
        difficulty_level = "normal"
        
        if len(last_3_results) >= 3:
            if all(r == 'success' for r in last_3_results):
                difficulty_level = "plus_difficile"  # 3 successes → increase difficulty
            elif last_3_results[:2] == ['failed', 'failed']:
                difficulty_level = "plus_facile"  # 2 failures → decrease difficulty
            elif 'partial' in last_3_results:
                difficulty_level = "normal"  # Keep current level
        
        # Collect feedback comments for AI context
        feedback_context = []
        for ch in recent_challenges:
            if ch.get('completed') and ch.get('feedback_comment'):
                feedback_context.append({
                    'competence': ch.get('competence'),
                    'result': ch.get('challenge_result'),
                    'comment': ch.get('feedback_comment')
                })
        
        # Use force_competence if provided, otherwise use smart selection
        if force_competence and force_competence in ['accueil', 'decouverte', 'argumentation', 'closing', 'fidelisation']:
            selected_competence = force_competence
        elif not diagnostic:
            # Default challenge if no diagnostic
            competences = ['accueil', 'decouverte', 'argumentation', 'closing', 'fidelisation']
            selected_competence = competences[datetime.now().day % len(competences)]
        else:
            # Find weakest competences (Option B: Rotation)
            scores = {
                'accueil': diagnostic.get('score_accueil', 3),
                'decouverte': diagnostic.get('score_decouverte', 3),
                'argumentation': diagnostic.get('score_argumentation', 3),
                'closing': diagnostic.get('score_closing', 3),
                'fidelisation': diagnostic.get('score_fidelisation', 3)
            }
            
            # Get recently worked competences to avoid repetition
            recent_competences = [ch.get('competence') for ch in recent_challenges[:3]]
            
            # Sort competences by score (weakest first)
            sorted_competences = sorted(scores.items(), key=lambda x: x[1])
            
            # Smart rotation: alternate between weakest and other weak competences
            selected_competence = None
            for comp, score in sorted_competences:
                if comp not in recent_competences[:2]:  # Not in last 2 challenges
                    selected_competence = comp
                    break
            
            # Fallback to weakest if all were recently used
            if not selected_competence:
                selected_competence = sorted_competences[0][0]
        
        # Generate AI challenge using LlmChat
        api_key = os.environ.get('EMERGENT_LLM_KEY')
        if not api_key:
            raise ValueError("Missing EMERGENT_LLM_KEY")
        
        competence_names = {
            'accueil': 'Accueil',
            'decouverte': 'Découverte',
            'argumentation': 'Argumentation',
            'closing': 'Closing',
            'fidelisation': 'Fidélisation'
        }
        
        # Build context from feedback comments
        feedback_text = ""
        if feedback_context:
            feedback_text = "\n\nRetours sur challenges précédents :"
            for fb in feedback_context[:3]:  # Last 3 feedbacks
                result_emoji = "✅" if fb['result'] == 'success' else "⚠️" if fb['result'] == 'partial' else "❌"
                feedback_text += f"\n- {result_emoji} {competence_names[fb['competence']]} : {fb['comment']}"
        
        # Difficulty adaptation instructions
        difficulty_instruction = ""
        if difficulty_level == "plus_difficile":
            difficulty_instruction = "\n⚠️ IMPORTANT : Le vendeur a réussi ses 3 derniers challenges. Augmente légèrement la difficulté (plus ambitieux, plus de répétitions, situations plus complexes)."
        elif difficulty_level == "plus_facile":
            difficulty_instruction = "\n⚠️ IMPORTANT : Le vendeur a échoué ses 2 derniers challenges. Simplifie le challenge (objectif plus accessible, moins de pression, conseils plus détaillés)."
        
        prompt = f"""Tu es un coach retail expert. Génère un défi quotidien personnalisé pour un vendeur.

Compétence à travailler : {competence_names[selected_competence]}

Profil du vendeur :
- Style : {diagnostic.get('style', 'Non défini') if diagnostic else 'Non défini'}
- Niveau : {diagnostic.get('level', 'Intermédiaire') if diagnostic else 'Intermédiaire'}
- Profil DISC : {diagnostic.get('disc_dominant', 'Non défini') if diagnostic else 'Non défini'}{difficulty_instruction}{feedback_text}

Format de réponse (JSON strict) :
{{
  "title": "Nom court du défi (max 35 caractères)",
  "description": "Description concrète du défi à réaliser aujourd'hui (2 phrases maximum, vouvoiement professionnel)",
  "pedagogical_tip": "Rappel ou technique concrète (1 phrase courte)",
  "examples": [
    "Premier exemple concret avec dialogue ou situation réelle (1-2 phrases, vouvoiement)",
    "Deuxième exemple différent et complémentaire (1-2 phrases, vouvoiement)",
    "Troisième exemple pour varier les approches (1-2 phrases, vouvoiement)"
  ],
  "reason": "Pourquoi ce défi pour ce vendeur (1 phrase courte, lien avec son profil)"
}}

Le défi doit être :
- Concret et réalisable en une journée
- Mesurable (nombre de fois à faire)
- Motivant et positif
- Adapté au profil du vendeur et à ses retours précédents

Les 3 exemples doivent être :
- Des cas pratiques variés avec dialogues ou situations réelles PROFESSIONNELLES
- Utilisables directement par le vendeur (TOUJOURS vouvoyer le client)
- Couvrir différentes approches ou contextes
- IMPORTANT : Utiliser un ton professionnel, pas de familiarité (éviter "Salut", "Hey", etc.), vouvoyer systématiquement le client"""

        chat = LlmChat(
            api_key=api_key,
            session_id=f"challenge_{current_user['id']}_{today}",
            system_message="Tu es un coach retail expert qui crée des challenges personnalisés. Tu réponds UNIQUEMENT en JSON valide."
        ).with_model("openai", "gpt-4o-mini")
        
        response = await chat.send_message(UserMessage(text=prompt))
        
        # Parse JSON response
        import json
        content = response.strip() if isinstance(response, str) else str(response)
        # Remove markdown code blocks if present
        if content.startswith('```'):
            content = content.split('```')[1]
            if content.startswith('json'):
                content = content[4:]
        challenge_data = json.loads(content.strip())
        
        # Create challenge
        new_challenge = DailyChallenge(
            seller_id=current_user['id'],
            date=today,
            competence=selected_competence,
            title=challenge_data['title'],
            description=challenge_data['description'],
            pedagogical_tip=challenge_data['pedagogical_tip'],
            examples=challenge_data.get('examples', []),
            reason=challenge_data['reason']
        )
        
        await db.daily_challenges.insert_one(new_challenge.dict())
        
        return new_challenge.dict()
        
    except Exception as e:
        logging.error(f"Error generating daily challenge: {str(e)}")
        # Fallback challenge
        fallback = DailyChallenge(
            seller_id=current_user['id'],
            date=today,
            competence='accueil',
            title="Sourire et Contact Visuel",
            description="Aujourd'hui, établis un contact visuel et souris sincèrement à chaque client que tu accueilles. Compte combien de fois tu le fais !",
            pedagogical_tip="Un sourire authentique crée instantanément une connexion positive. Pense à sourire avec les yeux aussi !",
            examples=[
                "Client qui entre : Regarde-le dans les yeux, souris et dis 'Bonjour ! Bienvenue chez nous'.",
                "Client hésitant : Approche-toi avec un sourire et demande 'Vous cherchez quelque chose en particulier ?'.",
                "Client pressé : Souris rapidement et dis 'Bonjour ! Je suis là si vous avez besoin'."
            ],
            reason="L'accueil est la première impression que tu donnes. Un excellent accueil augmente significativement tes chances de vente."
        )
        await db.daily_challenges.insert_one(fallback.dict())
        return fallback.dict()

@api_router.post("/seller/daily-challenge/complete")
async def complete_daily_challenge(
    data: DailyChallengeComplete,
    current_user: dict = Depends(get_current_user)
):
    """Mark daily challenge as completed with feedback"""
    if current_user['role'] != 'seller':
        raise HTTPException(status_code=403, detail="Only sellers can complete challenges")
    
    # Validate result
    if data.result not in ['success', 'partial', 'failed']:
        raise HTTPException(status_code=400, detail="Invalid result value")
    
    # Update challenge
    result = await db.daily_challenges.update_one(
        {
            "id": data.challenge_id,
            "seller_id": current_user['id']
        },
        {
            "$set": {
                "completed": True,
                "challenge_result": data.result,
                "feedback_comment": data.comment,
                "completed_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Challenge not found")
    
    # Get updated challenge
    challenge = await db.daily_challenges.find_one({
        "id": data.challenge_id
    }, {"_id": 0})
    
    return challenge

@api_router.post("/seller/daily-challenge/refresh")
async def refresh_daily_challenge(
    refresh_data: dict,
    current_user: dict = Depends(get_current_user)
):
    """Generate a new challenge for today with optional competence selection"""
    if current_user['role'] != 'seller':
        raise HTTPException(status_code=403, detail="Only sellers can refresh challenges")
    
    today = datetime.now().strftime('%Y-%m-%d')
    
    # Always delete ALL uncompleted challenges for today
    delete_result = await db.daily_challenges.delete_many({
        "seller_id": current_user['id'],
        "date": today,
        "completed": False
    })
    
    print(f"Refresh: Deleted {delete_result.deleted_count} uncompleted challenges for {current_user['id']}")
    
    # Get selected competence from request (optional)
    selected_competence = refresh_data.get('competence', None)
    
    # Generate new one with optional competence
    return await get_daily_challenge(current_user, force_competence=selected_competence)

@api_router.get("/seller/daily-challenge/stats")
async def get_daily_challenge_stats(current_user: dict = Depends(get_current_user)):
    """Get challenge statistics for seller"""
    if current_user['role'] != 'seller':
        raise HTTPException(status_code=403, detail="Only sellers can access challenge stats")
    
    try:
        # Count completed challenges
        completed_count = await db.daily_challenges.count_documents({
            "seller_id": current_user['id'],
            "completed": True
        })
        
        # Count successful challenges
        success_count = await db.daily_challenges.count_documents({
            "seller_id": current_user['id'],
            "challenge_result": "success"
        })
        
        # Count partial challenges (difficult)
        partial_count = await db.daily_challenges.count_documents({
            "seller_id": current_user['id'],
            "challenge_result": "partial"
        })
        
        # Count failed challenges
        failed_count = await db.daily_challenges.count_documents({
            "seller_id": current_user['id'],
            "challenge_result": "failed"
        })
        
        # Get current streak (consecutive days with completed challenges)
        all_challenges = await db.daily_challenges.find(
            {"seller_id": current_user['id'], "completed": True},
            {"_id": 0, "date": 1}
        ).sort("date", -1).to_list(None)
        
        current_streak = 0
        if all_challenges:
            from datetime import datetime, timedelta
            dates = [datetime.strptime(ch['date'], '%Y-%m-%d') for ch in all_challenges]
            current_streak = 1
            for i in range(len(dates) - 1):
                if (dates[i] - dates[i+1]).days == 1:
                    current_streak += 1
                else:
                    break
        
        return {
            "completed_count": completed_count,
            "success_count": success_count,
            "partial_count": partial_count,
            "failed_count": failed_count,
            "current_streak": current_streak
        }
    except Exception as e:
        logging.error(f"Error getting challenge stats: {str(e)}")
        return {"completed_count": 0, "success_count": 0, "partial_count": 0, "failed_count": 0, "current_streak": 0}

@api_router.get("/seller/daily-challenge/history")
async def get_daily_challenge_history(current_user: dict = Depends(get_current_user)):
    """Get all past daily challenges for the seller"""
    if current_user['role'] != 'seller':
        raise HTTPException(status_code=403, detail="Only sellers can access challenge history")
    
    # Get all challenges for this seller, sorted by date (most recent first)
    challenges = await db.daily_challenges.find(
        {"seller_id": current_user['id']},
        {"_id": 0}
    ).sort("date", -1).to_list(100)
    
    return challenges

# ===== ONBOARDING PROGRESS ENDPOINTS =====
@api_router.get("/onboarding/progress")
async def get_onboarding_progress(current_user: dict = Depends(get_current_user)):
    """Get the onboarding progress for the current user"""
    try:
        # Get onboarding progress from DB
        progress = await db.onboarding_progress.find_one(
            {"user_id": current_user['id']},
            {"_id": 0}
        )
        
        if not progress:
            # Return default progress if not found
            return {
                "user_id": current_user['id'],
                "current_step": 0,
                "completed_steps": [],
                "is_completed": False,
                "last_updated": datetime.now(timezone.utc).isoformat()
            }
        
        return progress
    except Exception as e:
        logging.error(f"Error getting onboarding progress: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/onboarding/progress")
async def save_onboarding_progress(
    progress_data: dict,
    current_user: dict = Depends(get_current_user)
):
    """Save or update the onboarding progress for the current user"""
    try:
        progress_doc = {
            "user_id": current_user['id'],
            "current_step": progress_data.get('current_step', 0),
            "completed_steps": progress_data.get('completed_steps', []),
            "is_completed": progress_data.get('is_completed', False),
            "last_updated": datetime.now(timezone.utc).isoformat()
        }
        
        # Upsert the progress
        await db.onboarding_progress.update_one(
            {"user_id": current_user['id']},
            {"$set": progress_doc},
            upsert=True
        )
        
        return progress_doc
    except Exception as e:
        logging.error(f"Error saving onboarding progress: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/onboarding/complete")
async def mark_onboarding_complete(current_user: dict = Depends(get_current_user)):
    """Mark the onboarding as completed for the current user"""
    try:
        progress_doc = {
            "user_id": current_user['id'],
            "current_step": 0,
            "completed_steps": [],
            "is_completed": True,
            "completed_at": datetime.now(timezone.utc).isoformat(),
            "last_updated": datetime.now(timezone.utc).isoformat()
        }
        
        await db.onboarding_progress.update_one(
            {"user_id": current_user['id']},
            {"$set": progress_doc},
            upsert=True
        )
        
        return {"success": True, "message": "Onboarding marked as complete"}
    except Exception as e:
        logging.error(f"Error marking onboarding complete: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# ===== MANAGER OBJECTIVES ENDPOINTS =====
@api_router.get("/manager/objectives")
async def get_manager_objectives(current_user: dict = Depends(get_current_user)):
    if current_user['role'] != 'manager':
        raise HTTPException(status_code=403, detail="Only managers can access objectives")
    
    objectives = await db.manager_objectives.find(
        {"manager_id": current_user['id']},
        {"_id": 0}
    ).sort("created_at", -1).to_list(10)
    
    # Calculate progress and enrich with updated_by info for each objective
    for objective in objectives:
        await calculate_objective_progress(objective, current_user['id'])
    
    return objectives

@api_router.post("/manager/objectives")
async def create_manager_objectives(objectives_data: ManagerObjectivesCreate, current_user: dict = Depends(get_current_user)):
    if current_user['role'] != 'manager':
        raise HTTPException(status_code=403, detail="Only managers can create objectives")
    
    # Validate objective_type
    if objectives_data.objective_type not in ["kpi_standard", "product_focus", "custom"]:
        raise HTTPException(status_code=400, detail="Invalid objective_type")
    
    # Validate required fields based on objective_type
    if objectives_data.objective_type == "kpi_standard" and not objectives_data.kpi_name:
        raise HTTPException(status_code=400, detail="kpi_name is required for kpi_standard objectives")
    elif objectives_data.objective_type == "product_focus" and not objectives_data.product_name:
        raise HTTPException(status_code=400, detail="product_name is required for product_focus objectives")
    elif objectives_data.objective_type == "custom" and not objectives_data.custom_description:
        raise HTTPException(status_code=400, detail="custom_description is required for custom objectives")
    
    # Validate data_entry_responsible
    if objectives_data.data_entry_responsible not in ["manager", "seller"]:
        raise HTTPException(status_code=400, detail="data_entry_responsible must be 'manager' or 'seller'")
    
    # Get the data and force status to active
    objectives_dict = objectives_data.model_dump()
    objectives_dict['status'] = 'active'  # Force status to active on creation
    
    objectives = ManagerObjectives(
        manager_id=current_user['id'],
        **objectives_dict
    )
    
    doc = objectives.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    doc['updated_at'] = doc['updated_at'].isoformat()
    
    await db.manager_objectives.insert_one(doc)
    
    return objectives

@api_router.put("/manager/objectives/{objective_id}")
async def update_manager_objectives(
    objective_id: str,
    objectives_data: ManagerObjectivesCreate,
    current_user: dict = Depends(get_current_user)
):
    if current_user['role'] != 'manager':
        raise HTTPException(status_code=403, detail="Only managers can update objectives")
    
    # Check if objectives exist and belong to this manager
    existing_objectives = await db.manager_objectives.find_one(
        {"id": objective_id, "manager_id": current_user['id']},
        {"_id": 0}
    )
    
    if not existing_objectives:
        raise HTTPException(status_code=404, detail="Objectives not found")
    
    # Validate objective_type
    if objectives_data.objective_type not in ["kpi_standard", "product_focus", "custom"]:
        raise HTTPException(status_code=400, detail="Invalid objective_type")
    
    # Validate required fields based on objective_type
    if objectives_data.objective_type == "kpi_standard" and not objectives_data.kpi_name:
        raise HTTPException(status_code=400, detail="kpi_name is required for kpi_standard objectives")
    elif objectives_data.objective_type == "product_focus" and not objectives_data.product_name:
        raise HTTPException(status_code=400, detail="product_name is required for product_focus objectives")
    elif objectives_data.objective_type == "custom" and not objectives_data.custom_description:
        raise HTTPException(status_code=400, detail="custom_description is required for custom objectives")
    
    # Validate data_entry_responsible
    if objectives_data.data_entry_responsible not in ["manager", "seller"]:
        raise HTTPException(status_code=400, detail="data_entry_responsible must be 'manager' or 'seller'")
    
    # Update objectives
    update_data = objectives_data.model_dump()
    update_data['manager_id'] = current_user['id']
    update_data['updated_at'] = datetime.now(timezone.utc).isoformat()
    # Preserve current_value and status from existing objective
    update_data['current_value'] = existing_objectives.get('current_value', 0.0)
    update_data['status'] = existing_objectives.get('status', 'active')
    
    await db.manager_objectives.update_one(
        {"id": objective_id},
        {"$set": update_data}
    )
    
    # Get updated objectives
    updated_objectives = await db.manager_objectives.find_one({"id": objective_id}, {"_id": 0})
    
    return updated_objectives

@api_router.delete("/manager/objectives/{objective_id}")
async def delete_manager_objectives(objective_id: str, current_user: dict = Depends(get_current_user)):
    if current_user['role'] != 'manager':
        raise HTTPException(status_code=403, detail="Only managers can delete objectives")
    
    # Check if objectives exist and belong to this manager
    existing_objectives = await db.manager_objectives.find_one(
        {"id": objective_id, "manager_id": current_user['id']},
        {"_id": 0}
    )
    
    if not existing_objectives:
        raise HTTPException(status_code=404, detail="Objectives not found")
    
    # Delete objectives
    await db.manager_objectives.delete_one({"id": objective_id})
    
    return {"message": "Objectives deleted successfully", "id": objective_id}

@api_router.post("/manager/objectives/{objective_id}/progress")
async def update_objective_progress(
    objective_id: str,
    progress_data: ObjectiveProgressUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update progress for an objective - can be called by manager or seller based on data_entry_responsible"""
    
    # Get the objective
    objective = await db.manager_objectives.find_one(
        {"id": objective_id},
        {"_id": 0}
    )
    
    if not objective:
        raise HTTPException(status_code=404, detail="Objective not found")
    
    # Check authorization based on data_entry_responsible
    if objective['data_entry_responsible'] == 'manager':
        # Only the manager who created the objective can update
        if current_user['role'] != 'manager' or current_user['id'] != objective['manager_id']:
            raise HTTPException(status_code=403, detail="Only the manager can update this objective's progress")
    elif objective['data_entry_responsible'] == 'seller':
        # Check if seller is authorized
        if current_user['role'] == 'seller':
            # For individual objectives, only the assigned seller can update
            if objective['type'] == 'individual' and objective.get('seller_id') != current_user['id']:
                raise HTTPException(status_code=403, detail="You are not authorized to update this objective")
            # For collective objectives, check if seller is in visible_to_sellers or if it's visible to all
            elif objective['type'] == 'collective':
                visible_to_sellers = objective.get('visible_to_sellers', [])
                if visible_to_sellers and current_user['id'] not in visible_to_sellers:
                    raise HTTPException(status_code=403, detail="You are not authorized to update this objective")
        elif current_user['role'] != 'manager' or current_user['id'] != objective['manager_id']:
            raise HTTPException(status_code=403, detail="Only authorized sellers or the manager can update this objective's progress")
    
    # Create progress entry for history
    progress_entry = {
        'value': progress_data.current_value,
        'date': datetime.now(timezone.utc).isoformat(),
        'updated_by': current_user['id'],
        'updated_by_name': current_user.get('name', 'Unknown')
    }
    
    # Update the progress
    update_data = {
        'current_value': progress_data.current_value,
        'updated_at': datetime.now(timezone.utc).isoformat()
    }
    
    # Check if objective is achieved or failed
    if progress_data.current_value >= objective['target_value']:
        update_data['status'] = 'achieved'
    elif datetime.now(timezone.utc).date() > datetime.fromisoformat(objective['period_end']).date():
        update_data['status'] = 'failed'
    else:
        update_data['status'] = 'active'
    
    # Update objective and add to progress history
    await db.manager_objectives.update_one(
        {"id": objective_id},
        {
            "$set": update_data,
            "$push": {"progress_history": progress_entry}
        }
    )
    
    # Get updated objective
    updated_objective = await db.manager_objectives.find_one({"id": objective_id}, {"_id": 0})
    
    return updated_objective


@api_router.get("/manager/objectives/active")
async def get_active_manager_objectives(
    store_id: str = None,
    current_user: dict = Depends(get_current_user)
):
    """Get only active objectives for display in manager dashboard"""
    if current_user['role'] not in ['manager', 'gerant', 'gérant']:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Determine effective store_id
    effective_store_id = None
    if store_id and current_user['role'] in ['gerant', 'gérant']:
        effective_store_id = store_id
    elif current_user.get('store_id'):
        effective_store_id = current_user['store_id']
    
    today = datetime.now(timezone.utc).date().isoformat()
    
    # Build query based on available identifiers
    query = {"period_end": {"$gt": today}}
    if effective_store_id:
        query["store_id"] = effective_store_id
    elif current_user.get('id'):
        query["manager_id"] = current_user['id']
    
    objectives = await db.manager_objectives.find(query, {"_id": 0}).sort("period_start", 1).to_list(10)
    
    # Calculate progress for each objective
    for objective in objectives:
        await calculate_objective_progress(objective, current_user['id'])
    
    return objectives

# ===== CHALLENGE ENDPOINTS =====
@api_router.get("/manager/challenges")
async def get_manager_challenges(current_user: dict = Depends(get_current_user)):
    if current_user['role'] != 'manager':
        raise HTTPException(status_code=403, detail="Only managers can access challenges")
    
    challenges = await db.challenges.find(
        {"manager_id": current_user['id']},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    # Calculate progress for each challenge
    for challenge in challenges:
        await calculate_challenge_progress(challenge)
    
    return challenges

@api_router.get("/seller/challenges")
async def get_seller_challenges(current_user: dict = Depends(get_current_user)):
    if current_user['role'] != 'seller':
        raise HTTPException(status_code=403, detail="Only sellers can access their challenges")
    
    # Get manager
    user = await db.users.find_one({"id": current_user['id']}, {"_id": 0})
    if not user or not user.get('manager_id'):
        return []
    
    manager_id = user['manager_id']
    
    # Get collective challenges + individual challenges assigned to this seller
    challenges = await db.challenges.find(
        {
            "manager_id": manager_id,
            "$or": [
                {"type": "collective"},
                {"type": "individual", "seller_id": current_user['id']}
            ]
        },
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    # Calculate progress for each challenge
    for challenge in challenges:
        await calculate_challenge_progress(challenge)
    
    return challenges

@api_router.get("/manager/challenges/active")
async def get_active_manager_challenges(
    store_id: str = None,
    current_user: dict = Depends(get_current_user)
):
    """Get only active collective challenges for display in manager dashboard"""
    if current_user['role'] not in ['manager', 'gerant', 'gérant']:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Determine effective store_id
    effective_store_id = None
    if store_id and current_user['role'] in ['gerant', 'gérant']:
        effective_store_id = store_id
    elif current_user.get('store_id'):
        effective_store_id = current_user['store_id']
    
    today = datetime.now(timezone.utc).date().isoformat()
    
    query = {
        "type": "collective",
        "status": "active",
        "end_date": {"$gt": today}
    }
    if effective_store_id:
        query["store_id"] = effective_store_id
    elif current_user.get('id'):
        query["manager_id"] = current_user['id']
    
    challenges = await db.challenges.find(query, {"_id": 0}).sort("start_date", 1).to_list(10)
    
    # Calculate progress for each challenge
    for challenge in challenges:
        await calculate_challenge_progress(challenge)
    
    return challenges

@api_router.get("/seller/challenges/active")
async def get_active_seller_challenges(current_user: dict = Depends(get_current_user)):
    """Get only active challenges (collective + personal) for display in seller dashboard"""
    if current_user['role'] != 'seller':
        raise HTTPException(status_code=403, detail="Only sellers can access their challenges")
    
    # Get manager
    user = await db.users.find_one({"id": current_user['id']}, {"_id": 0})
    if not user or not user.get('manager_id'):
        return []
    
    manager_id = user['manager_id']
    seller_id = current_user['id']
    today = datetime.now(timezone.utc).date().isoformat()
    
    # Get active challenges from the seller's manager
    challenges = await db.challenges.find(
        {
            "manager_id": manager_id,
            "status": "active",
            "end_date": {"$gte": today},  # Include challenges ending today
            "visible": True  # Only visible challenges
        },
        {"_id": 0}
    ).sort("start_date", 1).to_list(10)  # Sort by start_date to show upcoming first
    
    # Filter challenges based on visibility rules
    filtered_challenges = []
    for challenge in challenges:
        # Check if challenge is for this seller
        chall_type = challenge.get('type', 'collective')
        
        # Individual challenges: only show if it's for this seller
        if chall_type == 'individual':
            if challenge.get('seller_id') == seller_id:
                filtered_challenges.append(challenge)
        # Collective challenges: check visible_to_sellers list
        else:
            visible_to = challenge.get('visible_to_sellers', [])
            # If no specific sellers listed, show to all
            # If specific sellers listed, only show if this seller is in the list
            if not visible_to or len(visible_to) == 0 or seller_id in visible_to:
                filtered_challenges.append(challenge)
    
    # Calculate progress for each challenge
    for challenge in filtered_challenges:
        await calculate_challenge_progress(challenge)
    
    return filtered_challenges

@api_router.get("/seller/objectives/all")
async def get_all_seller_objectives(current_user: dict = Depends(get_current_user)):
    """Get all team objectives (active and inactive) for seller"""
    if current_user['role'] != 'seller':
        raise HTTPException(status_code=403, detail="Only sellers can access objectives")
    
    # Get manager
    user = await db.users.find_one({"id": current_user['id']}, {"_id": 0})
    if not user or not user.get('manager_id'):
        return {"active": [], "inactive": []}
    
    manager_id = user['manager_id']
    seller_id = current_user['id']
    today = datetime.now(timezone.utc).date().isoformat()
    
    # Get ALL objectives from the seller's manager
    all_objectives = await db.manager_objectives.find(
        {
            "manager_id": manager_id,
            "visible": True  # Only visible objectives
        },
        {"_id": 0}
    ).sort("period_start", -1).to_list(100)  # Sort by most recent first
    
    # Filter objectives based on visibility rules and separate active/inactive
    active_objectives = []
    inactive_objectives = []
    
    for objective in all_objectives:
        # Check if objective is for this seller
        obj_type = objective.get('type', 'collective')
        should_include = False
        
        # Individual objectives: only show if it's for this seller
        if obj_type == 'individual':
            if objective.get('seller_id') == seller_id:
                should_include = True
        # Collective objectives: check visible_to_sellers list
        else:
            visible_to = objective.get('visible_to_sellers', [])
            if not visible_to or len(visible_to) == 0 or seller_id in visible_to:
                should_include = True
        
        if should_include:
            # Calculate progress
            await calculate_objective_progress(objective, manager_id)
            
            # Separate active vs inactive
            if objective.get('period_end', '') > today:
                active_objectives.append(objective)
            else:
                inactive_objectives.append(objective)
    
    return {
        "active": active_objectives,
        "inactive": inactive_objectives
    }

@api_router.get("/seller/objectives/active")
async def get_active_seller_objectives(current_user: dict = Depends(get_current_user)):
    """Get active team objectives for display in seller dashboard"""
    if current_user['role'] != 'seller':
        raise HTTPException(status_code=403, detail="Only sellers can access objectives")
    
    # Get manager
    user = await db.users.find_one({"id": current_user['id']}, {"_id": 0})
    if not user or not user.get('manager_id'):
        return []
    
    manager_id = user['manager_id']
    seller_id = current_user['id']
    today = datetime.now(timezone.utc).date().isoformat()
    
    # Get active objectives from the seller's manager
    objectives = await db.manager_objectives.find(
        {
            "manager_id": manager_id,
            "period_end": {"$gte": today},  # Include objectives ending today
            "visible": True  # Only visible objectives
        },
        {"_id": 0}
    ).sort("period_start", 1).to_list(10)
    
    # Filter objectives based on visibility rules
    filtered_objectives = []
    for objective in objectives:
        # Check if objective is for this seller
        obj_type = objective.get('type', 'collective')
        
        # Individual objectives: only show if it's for this seller
        if obj_type == 'individual':
            if objective.get('seller_id') == seller_id:
                filtered_objectives.append(objective)
        # Collective objectives: check visible_to_sellers list
        else:
            visible_to = objective.get('visible_to_sellers', [])
            # If no specific sellers listed, show to all
            # If specific sellers listed, only show if this seller is in the list
            if not visible_to or len(visible_to) == 0 or seller_id in visible_to:
                filtered_objectives.append(objective)
    
    # NEW SYSTEM: No need to calculate progress, it's stored in current_value
    # Ensure status field exists (for old objectives created before migration)
    for objective in filtered_objectives:
        if 'status' not in objective or objective['status'] is None:
            # Calculate status based on current_value and target_value
            current_val = objective.get('current_value', 0)
            target_val = objective.get('target_value', 1)
            today_date = datetime.now(timezone.utc).date()
            period_end_date = datetime.fromisoformat(objective['period_end']).date()
            
            if current_val >= target_val:
                objective['status'] = 'achieved'
            elif today_date > period_end_date:
                objective['status'] = 'failed'
            else:
                objective['status'] = 'active'
    
    return filtered_objectives


@api_router.get("/seller/objectives/history")
async def get_seller_objectives_history(current_user: dict = Depends(get_current_user)):
    """Get completed objectives (past period_end date) for seller"""
    if current_user['role'] != 'seller':
        raise HTTPException(status_code=403, detail="Only sellers can access objectives")
    
    # Get manager
    user = await db.users.find_one({"id": current_user['id']}, {"_id": 0})
    if not user or not user.get('manager_id'):
        return []
    
    manager_id = user['manager_id']
    seller_id = current_user['id']
    today = datetime.now(timezone.utc).date().isoformat()
    
    # Get completed objectives (period_end < today)
    objectives = await db.manager_objectives.find(
        {
            "manager_id": manager_id,
            "period_end": {"$lt": today},  # Only objectives that have ended
            "visible": True
        },
        {"_id": 0}
    ).sort("period_end", -1).to_list(100)  # Most recent first
    
    # Filter objectives based on visibility rules
    filtered_objectives = []
    for objective in objectives:
        obj_type = objective.get('type', 'collective')
        
        # Individual objectives: only show if it's for this seller
        if obj_type == 'individual':
            if objective.get('seller_id') == seller_id:
                filtered_objectives.append(objective)
        # Collective objectives: check visible_to_sellers list
        else:
            visible_to = objective.get('visible_to_sellers', [])
            if not visible_to or len(visible_to) == 0 or seller_id in visible_to:
                filtered_objectives.append(objective)
    
    # Calculate achievement status for each objective
    for objective in filtered_objectives:
        current_val = objective.get('current_value', 0)
        target_val = objective.get('target_value', 1)
        
        if current_val >= target_val:
            objective['achieved'] = True
        else:
            objective['achieved'] = False
    
    return filtered_objectives

@api_router.get("/seller/challenges/history")
async def get_seller_challenges_history(current_user: dict = Depends(get_current_user)):
    """Get completed challenges (past end_date) for seller"""
    if current_user['role'] != 'seller':
        raise HTTPException(status_code=403, detail="Only sellers can access challenges")
    
    # Get manager
    user = await db.users.find_one({"id": current_user['id']}, {"_id": 0})
    if not user or not user.get('manager_id'):
        return []
    
    manager_id = user['manager_id']
    seller_id = current_user['id']
    today = datetime.now(timezone.utc).date().isoformat()
    
    # Get completed challenges (end_date < today)
    challenges = await db.challenges.find(
        {
            "manager_id": manager_id,
            "end_date": {"$lt": today},  # Only challenges that have ended
            "visible": True
        },
        {"_id": 0}
    ).sort("end_date", -1).to_list(100)  # Most recent first
    
    # Filter challenges based on visibility rules
    filtered_challenges = []
    for challenge in challenges:
        chall_type = challenge.get('type', 'collective')
        
        # Individual challenges: only show if it's for this seller
        if chall_type == 'individual':
            if challenge.get('seller_id') == seller_id:
                filtered_challenges.append(challenge)
        # Collective challenges: check visible_to_sellers list
        else:
            visible_to = challenge.get('visible_to_sellers', [])
            if not visible_to or len(visible_to) == 0 or seller_id in visible_to:
                filtered_challenges.append(challenge)
    
    # Calculate achievement status for each challenge
    for challenge in filtered_challenges:
        # For kpi_standard challenges
        if challenge.get('challenge_type') == 'kpi_standard':
            current_val = challenge.get('current_value', 0)
            target_val = challenge.get('target_value', 1)
            challenge['achieved'] = current_val >= target_val
        else:
            # For multi-target challenges, check each target
            achieved_count = 0
            total_targets = 0
            
            if challenge.get('ca_target'):
                total_targets += 1
                if challenge.get('progress_ca', 0) >= challenge['ca_target']:
                    achieved_count += 1
            
            if challenge.get('ventes_target'):
                total_targets += 1
                if challenge.get('progress_ventes', 0) >= challenge['ventes_target']:
                    achieved_count += 1
            
            if challenge.get('clients_target'):
                total_targets += 1
                if challenge.get('progress_clients', 0) >= challenge['clients_target']:
                    achieved_count += 1
            
            # Challenge is achieved if all targets are met
            challenge['achieved'] = (achieved_count == total_targets) if total_targets > 0 else False
    
    return filtered_challenges

# Endpoint for seller to get their manager's KPI config
@api_router.get("/seller/kpi-config")
async def get_seller_kpi_config(current_user: dict = Depends(get_current_user)):
    if current_user['role'] != 'seller':
        raise HTTPException(status_code=403, detail="Only sellers can access this endpoint")
    
    # Get seller's store_id to find the current manager
    user = await db.users.find_one({"id": current_user['id']}, {"_id": 0})
    if not user or not user.get('store_id'):
        # No store, return default config (all enabled for seller)
        return {
            "track_ca": True,
            "track_ventes": True,
            "track_clients": True,
            "track_articles": True,
            "track_prospects": True
        }
    
    # Find the manager of this store
    manager = await db.users.find_one({
        "store_id": user['store_id'],
        "role": "manager"
    }, {"_id": 0, "id": 1})
    
    if not manager:
        # No manager found for this store, return default
        return {
            "track_ca": True,
            "track_ventes": True,
            "track_clients": True,
            "track_articles": True,
            "track_prospects": True
        }
    
    manager_id = manager['id']
    
    # Get manager's KPI config
    config = await db.kpi_configs.find_one({"manager_id": manager_id}, {"_id": 0})
    
    if not config:
        # No config found, return default (all enabled for seller)
        return {
            "track_ca": True,
            "track_ventes": True,
            "track_clients": True,
            "track_articles": True,
            "track_prospects": True
        }
    
    return {
        "track_ca": config.get('seller_track_ca', config.get('track_ca', False)),
        "track_ventes": config.get('seller_track_ventes', config.get('track_ventes', False)),
        "track_clients": config.get('seller_track_clients', config.get('track_clients', False)),
        "track_articles": config.get('seller_track_articles', config.get('track_articles', False)),
        "track_prospects": config.get('seller_track_prospects', config.get('track_prospects', False))
    }

    manager_id = user['manager_id']
    
    # Get challenges: collective OR individual for this seller
    challenges = await db.challenges.find({
        "manager_id": manager_id,
        "$or": [
            {"type": "collective"},
            {"type": "individual", "seller_id": current_user['id']}
        ],
        "status": "active"
    }, {"_id": 0}).to_list(100)
    
    # Calculate progress
    for challenge in challenges:
        await calculate_challenge_progress(challenge, current_user['id'])
    
    return challenges

@api_router.post("/manager/challenges")
async def create_challenge(challenge_data: ChallengeCreate, current_user: dict = Depends(get_current_user)):
    if current_user['role'] != 'manager':
        raise HTTPException(status_code=403, detail="Only managers can create challenges")
    
    # Validate challenge_type
    if challenge_data.challenge_type not in ["kpi_standard", "product_focus", "custom"]:
        raise HTTPException(status_code=400, detail="Invalid challenge_type")
    
    # Validate required fields based on challenge_type
    if challenge_data.challenge_type == "kpi_standard" and not challenge_data.kpi_name:
        raise HTTPException(status_code=400, detail="kpi_name is required for kpi_standard challenges")
    elif challenge_data.challenge_type == "product_focus" and not challenge_data.product_name:
        raise HTTPException(status_code=400, detail="product_name is required for product_focus challenges")
    elif challenge_data.challenge_type == "custom" and not challenge_data.custom_description:
        raise HTTPException(status_code=400, detail="custom_description is required for custom challenges")
    
    # Validate data_entry_responsible
    if challenge_data.data_entry_responsible not in ["manager", "seller"]:
        raise HTTPException(status_code=400, detail="data_entry_responsible must be 'manager' or 'seller'")
    
    # Verify seller exists if individual challenge
    if challenge_data.type == "individual":
        if not challenge_data.seller_id:
            raise HTTPException(status_code=400, detail="seller_id required for individual challenges")
        
        seller = await db.users.find_one({"id": challenge_data.seller_id, "manager_id": current_user['id']}, {"_id": 0})
        if not seller:
            raise HTTPException(status_code=404, detail="Seller not found in your team")
    
    # Get the data and force status to active
    challenge_dict = challenge_data.model_dump()
    challenge_dict['status'] = 'active'  # Force status to active on creation
    
    challenge = Challenge(
        manager_id=current_user['id'],
        **challenge_dict
    )
    
    doc = challenge.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    doc['updated_at'] = doc['updated_at'].isoformat()
    if doc.get('completed_at'):
        doc['completed_at'] = doc['completed_at'].isoformat()
    
    await db.challenges.insert_one(doc)
    
    return challenge

@api_router.put("/manager/challenges/{challenge_id}")
async def update_challenge(
    challenge_id: str,
    challenge_data: ChallengeCreate,
    current_user: dict = Depends(get_current_user)
):
    if current_user['role'] != 'manager':
        raise HTTPException(status_code=403, detail="Only managers can update challenges")
    
    # Check if challenge exists and belongs to this manager
    existing_challenge = await db.challenges.find_one(
        {"id": challenge_id, "manager_id": current_user['id']},
        {"_id": 0}
    )
    
    if not existing_challenge:
        raise HTTPException(status_code=404, detail="Challenge not found")
    
    # Validate challenge_type
    if challenge_data.challenge_type not in ["kpi_standard", "product_focus", "custom"]:
        raise HTTPException(status_code=400, detail="Invalid challenge_type")
    
    # Validate required fields based on challenge_type
    if challenge_data.challenge_type == "kpi_standard" and not challenge_data.kpi_name:
        raise HTTPException(status_code=400, detail="kpi_name is required for kpi_standard challenges")
    elif challenge_data.challenge_type == "product_focus" and not challenge_data.product_name:
        raise HTTPException(status_code=400, detail="product_name is required for product_focus challenges")
    elif challenge_data.challenge_type == "custom" and not challenge_data.custom_description:
        raise HTTPException(status_code=400, detail="custom_description is required for custom challenges")
    
    # Validate data_entry_responsible
    if challenge_data.data_entry_responsible not in ["manager", "seller"]:
        raise HTTPException(status_code=400, detail="data_entry_responsible must be 'manager' or 'seller'")
    
    # Verify seller exists if individual challenge
    if challenge_data.type == "individual":
        if not challenge_data.seller_id:
            raise HTTPException(status_code=400, detail="seller_id required for individual challenges")
        
        seller = await db.users.find_one(
            {"id": challenge_data.seller_id, "manager_id": current_user['id']},
            {"_id": 0}
        )
        if not seller:
            raise HTTPException(status_code=404, detail="Seller not found in your team")
    
    # Update challenge
    update_data = challenge_data.model_dump()
    update_data['manager_id'] = current_user['id']
    update_data['updated_at'] = datetime.now(timezone.utc).isoformat()
    # Preserve current_value and status from existing challenge
    update_data['current_value'] = existing_challenge.get('current_value', 0.0)
    update_data['status'] = existing_challenge.get('status', 'active')
    
    await db.challenges.update_one(
        {"id": challenge_id},
        {"$set": update_data}
    )
    
    # Get updated challenge
    updated_challenge = await db.challenges.find_one({"id": challenge_id}, {"_id": 0})
    
    return updated_challenge

@api_router.delete("/manager/challenges/{challenge_id}")
async def delete_challenge(challenge_id: str, current_user: dict = Depends(get_current_user)):
    if current_user['role'] != 'manager':
        raise HTTPException(status_code=403, detail="Only managers can delete challenges")
    
    # Check if challenge exists and belongs to this manager
    existing_challenge = await db.challenges.find_one(
        {"id": challenge_id, "manager_id": current_user['id']},
        {"_id": 0}
    )
    
    if not existing_challenge:
        raise HTTPException(status_code=404, detail="Challenge not found")
    
    # Delete challenge
    await db.challenges.delete_one({"id": challenge_id})
    
    return {"message": "Challenge deleted successfully", "id": challenge_id}

@api_router.post("/manager/challenges/{challenge_id}/progress")
async def update_challenge_progress(
    challenge_id: str,
    progress_data: ChallengeProgressUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update progress for a challenge - can be called by manager or seller based on data_entry_responsible"""
    
    # Get the challenge
    challenge = await db.challenges.find_one(
        {"id": challenge_id},
        {"_id": 0}
    )
    
    if not challenge:
        raise HTTPException(status_code=404, detail="Challenge not found")
    
    # Check authorization based on data_entry_responsible
    if challenge['data_entry_responsible'] == 'manager':
        # Only the manager who created the challenge can update
        if current_user['role'] != 'manager' or current_user['id'] != challenge['manager_id']:
            raise HTTPException(status_code=403, detail="Only the manager can update this challenge's progress")
    elif challenge['data_entry_responsible'] == 'seller':
        # Check if seller is authorized
        if current_user['role'] == 'seller':
            # For individual challenges, only the assigned seller can update
            if challenge['type'] == 'individual' and challenge.get('seller_id') != current_user['id']:
                raise HTTPException(status_code=403, detail="You are not authorized to update this challenge")
            # For collective challenges, check if seller is in visible_to_sellers or if it's visible to all
            elif challenge['type'] == 'collective':
                visible_to_sellers = challenge.get('visible_to_sellers', [])
                if visible_to_sellers and current_user['id'] not in visible_to_sellers:
                    raise HTTPException(status_code=403, detail="You are not authorized to update this challenge")
        elif current_user['role'] != 'manager' or current_user['id'] != challenge['manager_id']:
            raise HTTPException(status_code=403, detail="Only authorized sellers or the manager can update this challenge's progress")
    
    # Create progress entry for history
    progress_entry = {
        'value': progress_data.current_value,
        'date': datetime.now(timezone.utc).isoformat(),
        'updated_by': current_user['id'],
        'updated_by_name': current_user.get('name', 'Unknown')
    }
    
    # Update the progress
    update_data = {
        'current_value': progress_data.current_value,
        'updated_at': datetime.now(timezone.utc).isoformat()
    }
    
    # Check if challenge is achieved or failed
    if progress_data.current_value >= challenge['target_value']:
        update_data['status'] = 'achieved'
        update_data['completed_at'] = datetime.now(timezone.utc).isoformat()
    elif datetime.now(timezone.utc).date() > datetime.fromisoformat(challenge['end_date']).date():
        update_data['status'] = 'failed'
    else:
        update_data['status'] = 'active'
    
    # Update challenge and add to progress history
    await db.challenges.update_one(
        {"id": challenge_id},
        {
            "$set": update_data,
            "$push": {"progress_history": progress_entry}
        }
    )
    
    # Get updated challenge
    updated_challenge = await db.challenges.find_one({"id": challenge_id}, {"_id": 0})
    
    return updated_challenge

async def calculate_objective_progress(objective: dict, manager_id: str):
    """Calculate progress for an objective (team-wide)"""
    start_date = objective['period_start']
    end_date = objective['period_end']
    
    # Get all sellers for this manager
    sellers = await db.users.find({"manager_id": manager_id, "role": "seller"}, {"_id": 0, "id": 1}).to_list(1000)
    seller_ids = [s['id'] for s in sellers]
    
    # Get KPI entries for all sellers in date range
    entries = await db.kpi_entries.find({
        "seller_id": {"$in": seller_ids},
        "date": {"$gte": start_date, "$lte": end_date}
    }, {"_id": 0}).to_list(10000)
    
    # Calculate totals from seller entries
    total_ca = sum(e.get('ca_journalier', 0) for e in entries)
    total_ventes = sum(e.get('nb_ventes', 0) for e in entries)
    total_articles = sum(e.get('nb_articles', 0) for e in entries)
    
    # Si certains KPI ne sont pas renseignés par les vendeurs, chercher dans les KPI du manager (manager_kpis)
    # On vérifie chaque KPI individuellement
    manager_entries = await db.manager_kpis.find({
        "manager_id": manager_id,
        "date": {"$gte": start_date, "$lte": end_date}
    }, {"_id": 0}).to_list(10000)
    
    if manager_entries:
        # Si CA n'est pas renseigné par les vendeurs, utiliser celui du manager
        if total_ca == 0:
            total_ca = sum(e.get('ca_journalier', 0) for e in manager_entries if e.get('ca_journalier'))
        
        # Si Ventes n'est pas renseigné par les vendeurs, utiliser celui du manager
        if total_ventes == 0:
            total_ventes = sum(e.get('nb_ventes', 0) for e in manager_entries if e.get('nb_ventes'))
        
        # Si Articles n'est pas renseigné par les vendeurs, utiliser celui du manager
        if total_articles == 0:
            total_articles = sum(e.get('nb_articles', 0) for e in manager_entries if e.get('nb_articles'))
    
    # Calculate averages
    panier_moyen = total_ca / total_ventes if total_ventes > 0 else 0
    indice_vente = total_ca / total_articles if total_articles > 0 else 0
    
    # Update progress
    objective['progress_ca'] = total_ca
    objective['progress_ventes'] = total_ventes
    objective['progress_articles'] = total_articles
    objective['progress_panier_moyen'] = panier_moyen
    objective['progress_indice_vente'] = indice_vente
    
    # Determine status based on objective_type
    today = datetime.now(timezone.utc).date().isoformat()
    
    # For kpi_standard objectives, compare the relevant KPI with target_value
    if objective.get('objective_type') == 'kpi_standard' and objective.get('kpi_name'):
        kpi_name = objective['kpi_name']
        target = objective.get('target_value', 0)
        
        # Map KPI names to their calculated values
        current_kpi_value = 0
        if kpi_name == 'ca':
            current_kpi_value = total_ca
        elif kpi_name == 'ventes':
            current_kpi_value = total_ventes
        elif kpi_name == 'articles':
            current_kpi_value = total_articles
        elif kpi_name == 'panier_moyen':
            current_kpi_value = panier_moyen
        elif kpi_name == 'indice_vente':
            current_kpi_value = indice_vente
        
        objective_met = current_kpi_value >= target
        
        if today > end_date:
            # Period is over
            objective['status'] = 'achieved' if objective_met else 'failed'
        else:
            # Period is ongoing
            objective['status'] = 'achieved' if objective_met else 'active'
    
    else:
        # For other objective types (legacy logic with ca_target, etc.)
        if today > end_date:
            # Period is over - check if objective is met
            objective_met = True
            if objective.get('ca_target') and total_ca < objective['ca_target']:
                objective_met = False
            if objective.get('panier_moyen_target') and panier_moyen < objective['panier_moyen_target']:
                objective_met = False
            if objective.get('indice_vente_target') and indice_vente < objective['indice_vente_target']:
                objective_met = False
            
            objective['status'] = 'achieved' if objective_met else 'failed'
        else:
            # Period is ongoing - check if already achieved
            objective_met = True
            if objective.get('ca_target') and total_ca < objective['ca_target']:
                objective_met = False
            if objective.get('panier_moyen_target') and panier_moyen < objective['panier_moyen_target']:
                objective_met = False
            if objective.get('indice_vente_target') and indice_vente < objective['indice_vente_target']:
                objective_met = False
            
            objective['status'] = 'achieved' if objective_met else 'in_progress'
    
    # Extract last update info from progress_history if available
    if objective.get('progress_history') and len(objective['progress_history']) > 0:
        last_update = objective['progress_history'][-1]
        objective['updated_by'] = last_update.get('updated_by')
        objective['updated_by_name'] = last_update.get('updated_by_name')
        objective['updated_at'] = last_update.get('date', objective.get('updated_at'))
    
    # Sauvegarder les valeurs de progression en base de données
    await db.manager_objectives.update_one(
        {"id": objective['id']},
        {"$set": {
            "progress_ca": total_ca,
            "progress_ventes": total_ventes,
            "progress_articles": total_articles,
            "progress_panier_moyen": panier_moyen,
            "progress_indice_vente": indice_vente,
            "status": objective.get('status', 'in_progress')
        }}
    )

async def calculate_challenge_progress(challenge: dict, seller_id: str = None):
    """Calculate progress for a challenge"""
    start_date = challenge['start_date']
    end_date = challenge['end_date']
    manager_id = challenge['manager_id']
    
    if challenge['type'] == 'collective':
        # Get all sellers for this manager
        sellers = await db.users.find({"manager_id": manager_id, "role": "seller"}, {"_id": 0, "id": 1}).to_list(1000)
        seller_ids = [s['id'] for s in sellers]
        
        # Get KPI entries for all sellers in date range
        entries = await db.kpi_entries.find({
            "seller_id": {"$in": seller_ids},
            "date": {"$gte": start_date, "$lte": end_date}
        }, {"_id": 0}).to_list(10000)
    else:
        # Individual challenge
        target_seller_id = seller_id or challenge.get('seller_id')
        entries = await db.kpi_entries.find({
            "seller_id": target_seller_id,
            "date": {"$gte": start_date, "$lte": end_date}
        }, {"_id": 0}).to_list(10000)
    
    # Calculate totals from seller entries
    total_ca = sum(e.get('ca_journalier', 0) for e in entries)
    total_ventes = sum(e.get('nb_ventes', 0) for e in entries)
    total_articles = sum(e.get('nb_articles', 0) for e in entries)
    
    # Si certains KPI ne sont pas renseignés par les vendeurs, chercher dans les KPI du manager (manager_kpis)
    # On vérifie chaque KPI individuellement
    manager_entries = await db.manager_kpis.find({
        "manager_id": manager_id,
        "date": {"$gte": start_date, "$lte": end_date}
    }, {"_id": 0}).to_list(10000)
    
    if manager_entries:
        # Si CA n'est pas renseigné par les vendeurs, utiliser celui du manager
        if total_ca == 0:
            total_ca = sum(e.get('ca_journalier', 0) for e in manager_entries if e.get('ca_journalier'))
        
        # Si Ventes n'est pas renseigné par les vendeurs, utiliser celui du manager
        if total_ventes == 0:
            total_ventes = sum(e.get('nb_ventes', 0) for e in manager_entries if e.get('nb_ventes'))
        
        # Si Articles n'est pas renseigné par les vendeurs, utiliser celui du manager
        if total_articles == 0:
            total_articles = sum(e.get('nb_articles', 0) for e in manager_entries if e.get('nb_articles'))
    
    # Calculate averages
    panier_moyen = total_ca / total_ventes if total_ventes > 0 else 0
    indice_vente = total_ca / total_articles if total_articles > 0 else 0
    
    # Update progress
    challenge['progress_ca'] = total_ca
    challenge['progress_ventes'] = total_ventes
    challenge['progress_articles'] = total_articles
    challenge['progress_panier_moyen'] = panier_moyen
    challenge['progress_indice_vente'] = indice_vente
    
    # Check if challenge is completed
    if datetime.now().strftime('%Y-%m-%d') > end_date:
        if challenge['status'] == 'active':
            # Check if all targets are met
            completed = True
            if challenge.get('ca_target') and total_ca < challenge['ca_target']:
                completed = False
            if challenge.get('ventes_target') and total_ventes < challenge['ventes_target']:
                completed = False
            if challenge.get('panier_moyen_target') and panier_moyen < challenge['panier_moyen_target']:
                completed = False
            if challenge.get('indice_vente_target') and indice_vente < challenge['indice_vente_target']:
                completed = False
            
            new_status = 'completed' if completed else 'failed'
            await db.challenges.update_one(
                {"id": challenge['id']},
                {"$set": {
                    "status": new_status,
                    "completed_at": datetime.now(timezone.utc).isoformat(),
                    "progress_ca": total_ca,
                    "progress_ventes": total_ventes,
                    "progress_articles": total_articles,
                    "progress_panier_moyen": panier_moyen,
                    "progress_indice_vente": indice_vente
                }}
            )
            challenge['status'] = new_status
    else:
        # Challenge en cours : sauvegarder seulement les valeurs de progression
        await db.challenges.update_one(
            {"id": challenge['id']},
            {"$set": {
                "progress_ca": total_ca,
                "progress_ventes": total_ventes,
                "progress_articles": total_articles,
                "progress_panier_moyen": panier_moyen,
                "progress_indice_vente": indice_vente
            }}
        )
    
    # Extract last update info from progress_history if available (for challenges)
    if challenge.get('progress_history') and len(challenge['progress_history']) > 0:
        last_update = challenge['progress_history'][-1]
        challenge['updated_by'] = last_update.get('updated_by')
        challenge['updated_by_name'] = last_update.get('updated_by_name')
        challenge['updated_at'] = last_update.get('date', challenge.get('updated_at'))



# ===== STRIPE SUBSCRIPTION HELPERS =====
async def get_user_workspace(user_id: str) -> Optional[dict]:
    """Get user's workspace"""
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    
    if not user or not user.get('workspace_id'):
        return None
    
    workspace = await db.workspaces.find_one({"id": user['workspace_id']}, {"_id": 0})
    return workspace

async def check_workspace_access(workspace_id: str) -> dict:
    """Check if workspace has active subscription access"""
    workspace = await db.workspaces.find_one({"id": workspace_id}, {"_id": 0})
    
    if not workspace:
        return {"has_access": False, "status": "no_workspace", "message": "Aucun workspace trouvé"}
    
    # Check if trial is still active
    if workspace['subscription_status'] == 'trialing':
        trial_end = datetime.fromisoformat(workspace['trial_end']) if isinstance(workspace['trial_end'], str) else workspace['trial_end']
        now = datetime.now(timezone.utc)
        
        if now < trial_end:
            days_left = (trial_end - now).days
            return {
                "has_access": True, 
                "status": "trialing", 
                "days_left": days_left,
                "trial_end": workspace['trial_end'],
                "ai_credits_remaining": workspace.get('ai_credits_remaining', 100)
            }
        else:
            # Trial expired, update status
            await db.workspaces.update_one(
                {"id": workspace_id},
                {"$set": {"subscription_status": "trial_expired", "updated_at": datetime.now(timezone.utc).isoformat()}}
            )
            return {"has_access": False, "status": "trial_expired", "message": "Votre essai gratuit est terminé"}
    
    # Check if active subscription
    if workspace['subscription_status'] == 'active':
        period_end = workspace.get('current_period_end')
        days_left = 30  # Default
        
        if period_end:
            period_end_dt = datetime.fromisoformat(period_end) if isinstance(period_end, str) else period_end
            now = datetime.now(timezone.utc)
            days_left = (period_end_dt - now).days
        
        return {
            "has_access": True,
            "status": "active",
            "days_left": days_left,
            "period_end": period_end,
            "ai_credits_remaining": workspace.get('ai_credits_remaining', 0),
            "cancel_at_period_end": workspace.get('cancel_at_period_end', False)
        }
    
    return {"has_access": False, "status": workspace['subscription_status'], "message": "Abonnement inactif"}

async def get_user_subscription(user_id: str) -> Optional[dict]:
    """Get user's active subscription"""
    sub = await db.subscriptions.find_one({"user_id": user_id}, {"_id": 0})
    
    if not sub:
        return None
    
    # If stripe_subscription_id exists but no subscription_item_id, fetch from Stripe
    if sub.get('stripe_subscription_id') and not sub.get('stripe_subscription_item_id'):
        try:
            import stripe as stripe_lib
            stripe_lib.api_key = STRIPE_API_KEY
            
            stripe_sub = stripe_lib.Subscription.retrieve(sub['stripe_subscription_id'])
            if stripe_sub and stripe_sub.get('items') and stripe_sub['items']['data']:
                quantity = stripe_sub['items']['data'][0].get('quantity', 1)
                subscription_item_id = stripe_sub['items']['data'][0]['id']
                
                # Update the database with correct values
                await db.subscriptions.update_one(
                    {"user_id": user_id},
                    {"$set": {
                        "seats": quantity,
                        "stripe_subscription_item_id": subscription_item_id,
                        "updated_at": datetime.now(timezone.utc).isoformat()
                    }}
                )
                
                sub['seats'] = quantity
                sub['stripe_subscription_item_id'] = subscription_item_id
                logger.info(f"✅ Migration: Updated subscription seats from Stripe: user={user_id}, seats={quantity}")
        except Exception as e:
            logger.error(f"❌ Error fetching seats from Stripe: {str(e)}")
            # Fallback to 1 if can't fetch from Stripe
            if 'seats' not in sub or sub['seats'] == 0:
                sub['seats'] = 1
    
    # Ensure seats has a default value
    if 'seats' not in sub or sub['seats'] == 0:
        sub['seats'] = 1
    
    # Calculate used_seats (current sellers)
    # For gerant: count all sellers under this gerant
    # For manager: count sellers under this manager (legacy support)
    # Uniquement les vendeurs actifs consomment des sièges
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "role": 1, "id": 1})
    if user and user.get('role') in ['gerant', 'gérant']:
        seller_count = await db.users.count_documents({"gerant_id": user_id, "role": "seller", "status": "active"})
    else:
        seller_count = await db.users.count_documents({"manager_id": user_id, "role": "seller", "status": "active"})
    sub['used_seats'] = seller_count
    
    return sub

async def check_subscription_access(user_id: str) -> dict:
    """Check if user has access based on subscription status"""
    sub = await get_user_subscription(user_id)
    
    if not sub:
        return {"has_access": False, "status": "no_subscription", "message": "Aucun abonnement trouvé"}
    
    # Check if trial is still active
    if sub['status'] == 'trialing':
        trial_end = datetime.fromisoformat(sub['trial_end'])
        now = datetime.now(timezone.utc)
        
        if now < trial_end:
            days_left = (trial_end - now).days
            return {
                "has_access": True, 
                "status": "trialing", 
                "days_left": days_left,
                "trial_end": sub['trial_end'],
                "plan": sub['plan']
            }
        else:
            # Trial expired, update status
            await db.subscriptions.update_one(
                {"user_id": user_id},
                {"$set": {"status": "trial_expired", "updated_at": datetime.now(timezone.utc).isoformat()}}
            )
            return {"has_access": False, "status": "trial_expired", "message": "Votre essai gratuit est terminé"}
    
    # Check if active subscription
    if sub['status'] == 'active':
        period_end = datetime.fromisoformat(sub['current_period_end']) if sub.get('current_period_end') else None
        if period_end and datetime.now(timezone.utc) < period_end:
            return {
                "has_access": True, 
                "status": "active", 
                "period_end": sub['current_period_end'],
                "plan": sub.get('plan', 'professional')
            }
    
    return {"has_access": False, "status": sub['status'], "message": "Abonnement inactif"}

async def check_can_add_seller(user_id: str) -> dict:
    """Check if manager/gerant can add more sellers based on subscription seats"""
    # Get user role to determine how to count sellers
    # Uniquement les vendeurs actifs consomment des sièges
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "role": 1})
    if user and user.get('role') in ['gerant', 'gérant']:
        seller_count = await db.users.count_documents({"gerant_id": user_id, "role": "seller", "status": "active"})
    else:
        seller_count = await db.users.count_documents({"manager_id": user_id, "role": "seller", "status": "active"})
    
    sub = await get_user_subscription(user_id)
    
    if not sub:
        return {"can_add": False, "reason": "Aucun abonnement", "current": seller_count, "max": 0}
    
    # During trial, use trial limit
    if sub['status'] == 'trialing':
        max_sellers = MAX_SELLERS_TRIAL
        can_add = seller_count < max_sellers
        return {"can_add": can_add, "reason": "trial", "current": seller_count, "max": max_sellers}
    
    # After trial, use seats purchased (synced from Stripe)
    if sub['status'] == 'active':
        seats = sub.get('seats', 1)
        can_add = seller_count < seats
        return {"can_add": can_add, "reason": f"seats", "current": seller_count, "max": seats}
    
    return {"can_add": False, "reason": "subscription_inactive", "current": seller_count, "max": 0}

# ===== AI CREDITS MANAGEMENT =====

async def check_and_reset_monthly_credits(user_id: str):
    """Check if monthly credits need to be reset and do it if necessary"""
    sub = await db.subscriptions.find_one({"user_id": user_id})
    
    if not sub or sub['status'] not in ['trialing', 'active']:
        return
    
    now = datetime.now(timezone.utc)
    last_reset = datetime.fromisoformat(sub.get('last_credit_reset', sub['created_at']))
    
    # Check if a month has passed
    days_since_reset = (now - last_reset).days
    
    if days_since_reset >= 30:  # Reset every 30 days
        # Get monthly credits for plan
        plan = sub.get('plan', 'starter')
        if sub['status'] == 'trialing':
            # During trial, no monthly reset
            return
        
        # Calculate credits dynamically based on number of seats
        seats = sub.get('seats', 1)
        monthly_credits = calculate_monthly_ai_credits(seats)
        
        # Reset credits
        await db.subscriptions.update_one(
            {"user_id": user_id},
            {"$set": {
                "ai_credits_remaining": monthly_credits,
                "ai_credits_used_this_month": 0,
                "last_credit_reset": now.isoformat(),
                "updated_at": now.isoformat()
            }}
        )

async def check_and_consume_ai_credits(user_id: str, action_type: str, metadata: Optional[dict] = None) -> dict:
    """
    Check if user has enough AI credits and consume them
    Returns: {"success": bool, "message": str, "credits_remaining": int}
    """
    # Check for monthly reset first
    await check_and_reset_monthly_credits(user_id)
    
    # Get credit cost for this action
    credits_needed = AI_COSTS.get(action_type, 1)
    
    # Get subscription
    sub = await db.subscriptions.find_one({"user_id": user_id})
    
    if not sub:
        return {"success": False, "message": "Aucun abonnement trouvé", "credits_remaining": 0}
    
    credits_remaining = sub.get('ai_credits_remaining', 0)
    
    # Check if enough credits
    if credits_remaining < credits_needed:
        return {
            "success": False, 
            "message": f"Crédits IA insuffisants. Il vous reste {credits_remaining} crédits, {credits_needed} nécessaires.",
            "credits_remaining": credits_remaining
        }
    
    # Consume credits
    new_remaining = credits_remaining - credits_needed
    new_used = sub.get('ai_credits_used_this_month', 0) + credits_needed
    
    await db.subscriptions.update_one(
        {"user_id": user_id},
        {"$set": {
            "ai_credits_remaining": new_remaining,
            "ai_credits_used_this_month": new_used,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Log usage
    usage_log = AIUsageLog(
        user_id=user_id,
        action_type=action_type,
        credits_consumed=credits_needed,
        metadata=metadata
    )
    
    log_doc = usage_log.model_dump()
    log_doc['timestamp'] = log_doc['timestamp'].isoformat()
    await db.ai_usage_logs.insert_one(log_doc)
    
    return {
        "success": True,
        "message": f"{credits_needed} crédits consommés",
        "credits_remaining": new_remaining
    }

async def add_ai_credits(user_id: str, credits_to_add: int, reason: str = "purchase"):
    """Add AI credits to a user's subscription"""
    sub = await db.subscriptions.find_one({"user_id": user_id})
    
    if not sub:
        return False
    
    new_remaining = sub.get('ai_credits_remaining', 0) + credits_to_add
    
    await db.subscriptions.update_one(
        {"user_id": user_id},
        {"$set": {
            "ai_credits_remaining": new_remaining,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Log credit addition
    await db.ai_usage_logs.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "action_type": f"credit_addition_{reason}",
        "credits_consumed": -credits_to_add,  # Negative for addition
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "metadata": {"reason": reason, "amount": credits_to_add}
    })
    
    return True

# ===== STRIPE PAYMENT ENDPOINTS =====

@api_router.get("/subscription/status")
async def get_subscription_status(current_user: dict = Depends(get_current_user)):
    """Get current user's subscription status - using Workspace architecture"""
    if current_user['role'] not in ['manager', 'gerant', 'gérant']:
        raise HTTPException(status_code=403, detail="Only managers and gérants have subscriptions")
    
    # Get workspace
    workspace = await get_user_workspace(current_user['id'])
    
    if not workspace:
        raise HTTPException(status_code=404, detail="No workspace found")
    
    # Sync with Stripe if customer exists
    if workspace.get('stripe_customer_id'):
        try:
            import stripe as stripe_lib
            stripe_lib.api_key = STRIPE_API_KEY
            
            # Get ALL active subscriptions for this customer
            all_active_subs = stripe_lib.Subscription.list(
                customer=workspace['stripe_customer_id'],
                status='active',
                limit=10
            )
            
            # Filter to get only subscriptions without cancel_at_period_end
            truly_active_subs = [sub for sub in all_active_subs.data if not sub.get('cancel_at_period_end', False)]
            
            if not truly_active_subs:
                # No truly active subscription, use the stored one (may be canceled)
                if workspace.get('stripe_subscription_id'):
                    stripe_sub = stripe_lib.Subscription.retrieve(workspace['stripe_subscription_id'])
                else:
                    stripe_sub = None
            else:
                # Get the subscription ID and RETRIEVE full details (list() returns simplified objects)
                active_sub_id = truly_active_subs[0].id
                stripe_sub = stripe_lib.Subscription.retrieve(active_sub_id)
                
                # Update workspace with the correct subscription ID if it changed
                if stripe_sub.id != workspace.get('stripe_subscription_id'):
                    await db.workspaces.update_one(
                        {"id": workspace['id']},
                        {"$set": {
                            "stripe_subscription_id": stripe_sub.id,
                            "updated_at": datetime.now(timezone.utc).isoformat()
                        }}
                    )
                    logger.info(f"Updated workspace subscription ID from {workspace.get('stripe_subscription_id')} to {stripe_sub.id}")
            
            # Extraire les vraies données
            quantity = 1
            subscription_item_id = None
            billing_interval = 'month'  # Default
            billing_interval_count = 1
            
            if stripe_sub.get('items') and stripe_sub['items']['data']:
                quantity = stripe_sub['items']['data'][0].get('quantity', 1)
                subscription_item_id = stripe_sub['items']['data'][0]['id']
                
                # Extract billing interval from price
                item = stripe_sub['items']['data'][0]
                if item.get('price') and item['price'].get('recurring'):
                    billing_interval = item['price']['recurring'].get('interval', 'month')
                    billing_interval_count = item['price']['recurring'].get('interval_count', 1)
            
            # Get period fields from Stripe subscription using helper function
            period_start, period_end = extract_subscription_period(stripe_sub)
            
            status = stripe_sub.get('status', 'unknown')
            cancel_at_period_end = stripe_sub.get('cancel_at_period_end', False)
            
            # Mettre à jour le workspace avec les vraies données Stripe
            update_data = {
                "stripe_quantity": quantity,
                "stripe_subscription_item_id": subscription_item_id,
                "subscription_status": status,
                "cancel_at_period_end": cancel_at_period_end,
                "billing_interval": billing_interval,
                "billing_interval_count": billing_interval_count,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
            
            # Add period fields only if they exist
            if period_start:
                update_data["current_period_start"] = period_start.isoformat()
            if period_end:
                update_data["current_period_end"] = period_end.isoformat()
            
            await db.workspaces.update_one(
                {"id": workspace['id']},
                {"$set": update_data}
            )
            
            # Recharger le workspace avec les données mises à jour
            workspace = await db.workspaces.find_one({"id": workspace['id']}, {"_id": 0})
            
            logger.info(f"Synced workspace {workspace['id']} with Stripe: quantity={quantity}, status={status}")
        except Exception as e:
            logger.error(f"Error syncing with Stripe: {str(e)}")
            # Continue with cached data if sync fails
    
    # Check access
    access_info = await check_workspace_access(workspace['id'])
    
    # Count sellers - for gerant: count by gerant_id, for manager: count by workspace_id
    # Seulement les actifs consomment des sièges
    if current_user['role'] in ['gerant', 'gérant']:
        seller_count = await db.users.count_documents({
            "gerant_id": current_user['id'], 
            "role": "seller",
            "status": "active"  # Uniquement les actifs
        })
    else:
        seller_count = await db.users.count_documents({
            "workspace_id": workspace['id'], 
            "role": "seller",
            "status": "active"  # Uniquement les actifs
        })
    
    # Determine plan based on quantity (for frontend compatibility)
    quantity = workspace.get('stripe_quantity', 0)
    if quantity <= 5:
        plan = "starter"
    elif quantity <= 15:
        plan = "professional"
    else:
        plan = "enterprise"
    
    # Build subscription info for frontend compatibility
    subscription_info = {
        "id": workspace['id'],
        "workspace_id": workspace['id'],
        "workspace_name": workspace.get('name', 'Mon Espace'),
        "status": workspace.get('subscription_status', 'trial'),  # Default to 'trial' if not set
        "plan": plan,  # Determined based on quantity
        "stripe_customer_id": workspace.get('stripe_customer_id'),
        "stripe_subscription_id": workspace.get('stripe_subscription_id'),
        "stripe_subscription_item_id": workspace.get('stripe_subscription_item_id'),
        "seats": quantity if quantity > 0 else 1,  # Minimum 1 seat
        "used_seats": seller_count,
        "available_seats": max(0, (quantity if quantity > 0 else 1) - seller_count),
        "current_period_start": workspace.get('current_period_start'),
        "current_period_end": workspace.get('current_period_end'),
        "billing_interval": workspace.get('billing_interval', 'month'),
        "billing_interval_count": workspace.get('billing_interval_count', 1),
        "trial_start": workspace.get('trial_start'),
        "trial_end": workspace.get('trial_end'),
        "cancel_at_period_end": workspace.get('cancel_at_period_end', False),
        "canceled_at": workspace.get('canceled_at'),
        "ai_credits_remaining": workspace.get('ai_credits_remaining', 0),
        "ai_credits_used_this_month": workspace.get('ai_credits_used_this_month', 0)
    }
    
    return {
        **access_info,
        "subscription": subscription_info,
        "plan": plan,  # For top-level compatibility
        "workspace": workspace
    }

@api_router.post("/subscription/cancel")
async def cancel_subscription(current_user: dict = Depends(get_current_user)):
    """Cancel subscription at period end - keeps active until end of billing period"""
    if current_user['role'] != 'manager':
        raise HTTPException(status_code=403, detail="Only managers can cancel subscriptions")
    
    # Get workspace
    workspace = await get_user_workspace(current_user['id'])
    
    if not workspace:
        raise HTTPException(status_code=404, detail="No workspace found")
    
    if workspace['subscription_status'] != 'active':
        raise HTTPException(status_code=400, detail="Only active subscriptions can be canceled")
    
    # Get Stripe subscription ID
    stripe_subscription_id = workspace.get('stripe_subscription_id')
    
    if not stripe_subscription_id:
        raise HTTPException(status_code=400, detail="No Stripe subscription ID found")
    
    try:
        import stripe as stripe_lib
        stripe_lib.api_key = STRIPE_API_KEY
        
        # Cancel subscription at period end (not immediately)
        stripe_lib.Subscription.modify(
            stripe_subscription_id,
            cancel_at_period_end=True
        )
        
        # Update workspace to reflect the cancellation
        await db.workspaces.update_one(
            {"id": workspace['id']},
            {"$set": {
                "cancel_at_period_end": True,
                "canceled_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        logger.info(f"Subscription scheduled for cancellation: workspace={workspace['id']}, ends={workspace.get('current_period_end')}")
        
        period_end_str = datetime.fromisoformat(workspace['current_period_end']).strftime('%d/%m/%Y') if workspace.get('current_period_end') else "fin de période"
        
        return {
            "success": True,
            "message": f"Abonnement annulé. Vous conservez l'accès jusqu'au {period_end_str}",
            "cancel_at_period_end": True,
            "period_end": workspace.get('current_period_end')
        }
        
    except Exception as e:
        logger.error(f"Error canceling subscription: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to cancel subscription: {str(e)}")

@api_router.post("/subscription/reactivate")
async def reactivate_subscription(current_user: dict = Depends(get_current_user)):
    """Reactivate a subscription that was scheduled for cancellation"""
    if current_user['role'] != 'manager':
        raise HTTPException(status_code=403, detail="Only managers can reactivate subscriptions")
    
    # Get workspace
    workspace = await get_user_workspace(current_user['id'])
    
    if not workspace:
        raise HTTPException(status_code=404, detail="No workspace found")
    
    if not workspace.get('cancel_at_period_end'):
        raise HTTPException(status_code=400, detail="Subscription is not scheduled for cancellation")
    
    # Get Stripe subscription ID
    stripe_subscription_id = workspace.get('stripe_subscription_id')
    if not stripe_subscription_id:
        raise HTTPException(status_code=400, detail="No Stripe subscription found")
    
    try:
        import stripe as stripe_lib
        stripe_lib.api_key = STRIPE_API_KEY
        
        # Reactivate in Stripe - set cancel_at_period_end to false
        stripe_lib.Subscription.modify(
            stripe_subscription_id,
            cancel_at_period_end=False
        )
        
        # Update workspace
        await db.workspaces.update_one(
            {"id": workspace['id']},
            {"$set": {
                "cancel_at_period_end": False,
                "canceled_at": None,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        logger.info(f"Subscription reactivated: user={current_user['id']}")
        
        return {
            "success": True,
            "message": "Abonnement réactivé avec succès ! Vous ne serez plus facturé après la période en cours.",
            "cancel_at_period_end": False
        }
        
    except Exception as e:
        logger.error(f"Error reactivating subscription: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to reactivate subscription: {str(e)}")

@api_router.post("/subscription/change-seats")
async def change_subscription_seats(
    new_seats: int,
    current_user: dict = Depends(get_current_user)
):
    """
    Change number of seats using Workspace architecture
    - Applies prorated billing via Stripe
    - Updates workspace.stripe_quantity
    """
    if current_user['role'] != 'manager':
        raise HTTPException(status_code=403, detail="Only managers can modify subscriptions")
    
    # Validate seats
    if new_seats < 1:
        raise HTTPException(status_code=400, detail="Must have at least 1 seat")
    if new_seats > 15:
        raise HTTPException(status_code=400, detail="Maximum 15 seats")
    
    # Get workspace
    workspace = await get_user_workspace(current_user['id'])
    if not workspace:
        raise HTTPException(status_code=404, detail="No workspace found")
    
    if workspace['subscription_status'] not in ['active', 'trialing']:
        raise HTTPException(status_code=400, detail="Subscription must be active or trialing")
    
    # Get current ACTIVE sellers count in workspace (not including inactive/deleted)
    current_sellers_count = await db.users.count_documents({
        "workspace_id": workspace['id'], 
        "role": "seller",
        "$or": [
            {"status": "active"},
            {"status": {"$exists": False}}  # Old sellers without status field
        ]
    })
    
    # Check if trying to reduce below current usage
    if new_seats < current_sellers_count:
        raise HTTPException(
            status_code=400, 
            detail=f"Impossible de réduire à {new_seats} siège{'s' if new_seats > 1 else ''}. "
                   f"Vous avez actuellement {current_sellers_count} vendeur{'s' if current_sellers_count > 1 else ''} actif{'s' if current_sellers_count > 1 else ''}. "
                   f"Veuillez mettre en sommeil ou supprimer {current_sellers_count - new_seats} vendeur{'s' if (current_sellers_count - new_seats) > 1 else ''} avant de réduire votre abonnement."
        )
    
    current_seats = workspace.get('stripe_quantity', 0)
    if new_seats == current_seats:
        return {"success": True, "message": "No change needed", "seats": current_seats}
    
    try:
        import stripe as stripe_lib
        stripe_lib.api_key = STRIPE_API_KEY
        
        # If subscription has Stripe ID, modify it with proration
        stripe_subscription_id = workspace.get('stripe_subscription_id')
        amount_charged = 0
        
        if stripe_subscription_id:
            # Get Stripe subscription
            stripe_sub = stripe_lib.Subscription.retrieve(stripe_subscription_id)
            
            # Get the subscription item ID
            if not stripe_sub.get('items') or not stripe_sub['items']['data']:
                raise HTTPException(status_code=500, detail="Invalid Stripe subscription structure")
            
            subscription_item_id = stripe_sub['items']['data'][0]['id']
            
            # Modify subscription with new quantity (Stripe handles prorating automatically)
            updated_subscription = stripe_lib.Subscription.modify(
                stripe_subscription_id,
                items=[{
                    'id': subscription_item_id,
                    'quantity': new_seats
                }],
                proration_behavior='create_prorations'  # Automatic prorated billing
            )
            
            logger.info(f"Stripe subscription modified: {stripe_subscription_id}, new quantity: {new_seats}")
            
            # Get latest invoice to show amount charged/credited
            latest_invoice = stripe_lib.Invoice.retrieve(updated_subscription.latest_invoice) if updated_subscription.latest_invoice else None
            amount_charged = latest_invoice.amount_due / 100 if latest_invoice else 0
            
            # Update workspace with new subscription_item_id
            await db.workspaces.update_one(
                {"id": workspace['id']},
                {"$set": {
                    "stripe_subscription_item_id": subscription_item_id,
                    "stripe_quantity": new_seats,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }}
            )
        else:
            # Trial or no Stripe yet - just update locally
            await db.workspaces.update_one(
                {"id": workspace['id']},
                {"$set": {
                    "stripe_quantity": new_seats,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }}
            )
        
        logger.info(f"Seats changed: workspace={workspace['id']}, {current_seats}→{new_seats}")
        
        change_type = "Mise à niveau" if new_seats > current_seats else "Réduction"
        return {
            "success": True,
            "message": f"Sièges modifiés avec succès. {change_type} de {current_seats} à {new_seats}.",
            "seats": new_seats,
            "amount_charged": amount_charged,
            "used_seats": current_sellers_count
        }
        
    except Exception as e:
        logger.error(f"Error changing seats: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Failed to change seats: {str(e)}")


@api_router.get("/subscription/history")
async def get_subscription_history(current_user: dict = Depends(get_current_user)):
    """
    Get subscription change history (DEPRECATED - Legacy endpoint)
    
    ⚠️ DEPRECATION NOTICE:
    This endpoint is part of the old "Manager-led" billing system.
    The application has transitioned to a "Gérant-led" billing model where
    gérants manage subscriptions for their entire organization.
    
    This endpoint is kept for historical data access only and should not be
    used in new features. Use /api/gerant/subscription/status instead.
    """
    if current_user['role'] != 'manager':
        raise HTTPException(status_code=403, detail="Only managers have subscription history")
    
    try:
        history = await db.subscription_history.find(
            {"user_id": current_user['id']},
            {"_id": 0}  # Exclure _id pour éviter erreur de sérialisation
        ).sort("timestamp", -1).limit(20).to_list(20)
        
        return {"history": history if history else []}
    except Exception as e:
        logger.error(f"Error fetching subscription history: {str(e)}")
        # Retourner un historique vide au lieu de planter
        return {"history": []}

@api_router.get("/ai-credits/status")
async def get_ai_credits_status(current_user: dict = Depends(get_current_user)):
    """Get AI credits status for current user"""
    # For sellers, get their manager's credits
    user_id = current_user['id']
    if current_user['role'] == 'seller':
        user_id = current_user.get('manager_id')
        if not user_id:
            raise HTTPException(status_code=404, detail="Manager not found")
    
    # Check for monthly reset
    await check_and_reset_monthly_credits(user_id)
    
    sub = await db.subscriptions.find_one({"user_id": user_id}, {"_id": 0})
    
    if not sub:
        return {
            "credits_remaining": 0,
            "credits_used_this_month": 0,
            "plan": None,
            "status": "no_subscription"
        }
    
    return {
        "credits_remaining": sub.get('ai_credits_remaining', 0),
        "credits_used_this_month": sub.get('ai_credits_used_this_month', 0),
        "plan": sub.get('plan'),
        "status": sub.get('status')
    }

@api_router.get("/ai-credits/usage-history")
async def get_ai_usage_history(
    limit: int = 50,
    current_user: dict = Depends(get_current_user)
):
    """Get AI usage history"""
    user_id = current_user['id']
    if current_user['role'] == 'seller':
        user_id = current_user.get('manager_id')
    
    logs = await db.ai_usage_logs.find(
        {"user_id": user_id},
        {"_id": 0}
    ).sort("timestamp", -1).limit(limit).to_list(limit)
    
    return logs

@api_router.post("/checkout/create-session")
async def create_checkout_session(
    checkout_data: CheckoutRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Create or update Stripe subscription using Workspace architecture.
    - Prevents duplicate customers
    - Reuses existing customer_id if available
    - Updates existing subscription quantity instead of creating new one
    """
    if current_user['role'] != 'manager':
        raise HTTPException(status_code=403, detail="Only managers can subscribe")
    
    # Get workspace
    if not current_user.get('workspace_id'):
        raise HTTPException(status_code=400, detail="No workspace associated with this account")
    
    workspace = await db.workspaces.find_one({"id": current_user['workspace_id']}, {"_id": 0})
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    
    # Calculate quantity (number of sellers to pay for)
    seller_count = await db.users.count_documents({"workspace_id": current_user['workspace_id'], "role": "seller"})
    
    # Use provided quantity or default to max(seller_count, 1)
    quantity = checkout_data.quantity if checkout_data.quantity else max(seller_count, 1)
    
    # Validate quantity (minimum 1, maximum 15 for now)
    if quantity < 1:
        raise HTTPException(status_code=400, detail="La quantité minimum est 1 siège")
    if quantity > 15:
        raise HTTPException(status_code=400, detail="La quantité maximum est 15 sièges")
    
    try:
        import stripe as stripe_lib
        stripe_lib.api_key = STRIPE_API_KEY
        
        # STEP 1: Get or create Stripe customer
        stripe_customer_id = workspace.get('stripe_customer_id')
        
        if stripe_customer_id:
            # Verify customer still exists in Stripe
            try:
                customer = stripe_lib.Customer.retrieve(stripe_customer_id)
                if customer.get('deleted'):
                    stripe_customer_id = None  # Customer was deleted, create new one
                logger.info(f"Reusing existing Stripe customer: {stripe_customer_id}")
            except stripe_lib.error.InvalidRequestError:
                # Customer doesn't exist, create new one
                stripe_customer_id = None
                logger.warning(f"Stripe customer {stripe_customer_id} not found, will create new one")
        
        if not stripe_customer_id:
            # Create new customer
            customer = stripe_lib.Customer.create(
                email=current_user['email'],
                name=workspace['name'],
                metadata={
                    'workspace_id': workspace['id'],
                    'workspace_name': workspace['name'],
                    'manager_id': current_user['id']
                }
            )
            stripe_customer_id = customer.id
            
            # Save customer_id in workspace
            await db.workspaces.update_one(
                {"id": workspace['id']},
                {"$set": {
                    "stripe_customer_id": stripe_customer_id,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }}
            )
            logger.info(f"Created new Stripe customer: {stripe_customer_id} for workspace {workspace['name']}")
        
        # STEP 2: Check if active subscription exists
        existing_subscriptions = stripe_lib.Subscription.list(
            customer=stripe_customer_id,
            status='active',
            limit=10  # Get multiple to filter out canceled ones
        )
        
        # Filter to get only subscriptions without cancel_at_period_end
        active_subs = [sub for sub in existing_subscriptions.data if not sub.get('cancel_at_period_end', False)]
        
        if active_subs:
            # Check if billing period is changing
            subscription = active_subs[0]  # Use the first truly active subscription
            current_price_id = subscription['items'].data[0].price.id
            subscription_item_id = subscription['items'].data[0].id
            
            # Determine requested price ID
            billing_period = checkout_data.billing_period or 'monthly'
            requested_price_id = STRIPE_PRICE_ID_ANNUAL if billing_period == 'annual' else STRIPE_PRICE_ID_MONTHLY
            
            # If price ID is changing (monthly ↔ annual), UPDATE the subscription with new price
            if current_price_id != requested_price_id:
                # Check if trying to downgrade from annual to monthly (NOT ALLOWED)
                is_current_annual = current_price_id == STRIPE_PRICE_ID_ANNUAL
                is_requested_monthly = requested_price_id == STRIPE_PRICE_ID_MONTHLY
                
                if is_current_annual and is_requested_monthly:
                    raise HTTPException(
                        status_code=400, 
                        detail="Impossible de passer d'un abonnement annuel à mensuel. Pour changer, vous devez annuler votre abonnement actuel puis souscrire un nouveau plan mensuel."
                    )
                
                logger.info(f"Billing period changing from {current_price_id} to {requested_price_id} - updating subscription")
                
                # Update the subscription with new price ID and quantity
                updated_subscription = stripe_lib.Subscription.modify(
                    subscription.id,
                    items=[{
                        'id': subscription_item_id,
                        'price': requested_price_id,  # Change the price ID
                        'quantity': quantity
                    }],
                    proration_behavior='create_prorations'  # Create prorated invoice
                )
                
                # Update workspace
                await db.workspaces.update_one(
                    {"id": workspace['id']},
                    {"$set": {
                        "stripe_quantity": quantity,
                        "stripe_subscription_id": subscription.id,
                        "stripe_subscription_item_id": subscription_item_id,
                        "subscription_status": "active",
                        "updated_at": datetime.now(timezone.utc).isoformat()
                    }}
                )
                
                logger.info(f"Updated subscription {subscription.id} from {current_price_id} to {requested_price_id}")
                
                billing_msg = "à l'annuel" if billing_period == 'annual' else "au mensuel"
                return {
                    "success": True,
                    "message": f"Abonnement mis à jour : passage {billing_msg}",
                    "subscription_id": subscription.id,
                    "quantity": quantity,
                    "billing_period_changed": True
                }
            else:
                # Same billing period - just update quantity
                updated_subscription = stripe_lib.Subscription.modify(
                    subscription.id,
                    items=[{
                        'id': subscription_item_id,
                        'quantity': quantity
                    }],
                    proration_behavior='create_prorations'  # Create prorated invoice
                )
                
                # Update workspace with new quantity
                await db.workspaces.update_one(
                    {"id": workspace['id']},
                    {"$set": {
                        "stripe_quantity": quantity,
                        "stripe_subscription_id": subscription.id,
                        "stripe_subscription_item_id": subscription_item_id,
                        "subscription_status": "active",
                        "updated_at": datetime.now(timezone.utc).isoformat()
                    }}
                )
                
                logger.info(f"Updated existing subscription {subscription.id} to quantity {quantity}")
                
                return {
                    "success": True,
                    "message": f"Abonnement mis à jour : {quantity} siège(s)",
                    "subscription_id": subscription.id,
                    "quantity": quantity,
                    "updated_existing": True
                }
        
        # STEP 3: No active subscription - create checkout session
        success_url = f"{checkout_data.origin_url}/dashboard?session_id={{CHECKOUT_SESSION_ID}}"
        cancel_url = f"{checkout_data.origin_url}/dashboard"
        
        # Select price ID based on billing period
        billing_period = checkout_data.billing_period or 'monthly'
        stripe_price_id = STRIPE_PRICE_ID_ANNUAL if billing_period == 'annual' else STRIPE_PRICE_ID_MONTHLY
        
        session = stripe_lib.checkout.Session.create(
            mode='subscription',
            customer=stripe_customer_id,  # Use existing customer
            line_items=[{
                'price': stripe_price_id,  # Monthly or Annual price ID
                'quantity': quantity,
                'adjustable_quantity': {
                    'enabled': True,
                    'minimum': min(max(seller_count, 1), quantity),  # Cannot be greater than quantity
                    'maximum': 15
                }
            }],
            success_url=success_url,
            cancel_url=cancel_url,
            metadata={
                "workspace_id": workspace['id'],
                "workspace_name": workspace['name'],
                "manager_id": current_user['id'],
                "seller_count": str(quantity)
            },
            subscription_data={
                'description': f"Retail Performer AI - {workspace['name']}",
                'metadata': {
                    'workspace_id': workspace['id'],
                    'workspace_name': workspace['name']
                }
            }
        )
        
        # Create payment transaction record
        transaction = PaymentTransaction(
            user_id=current_user['id'],
            session_id=session.id,
            amount=quantity * 29,  # Approximate (Stripe will calculate exact with tiered pricing)
            currency="eur",
            plan="unified",
            payment_status="pending",
            metadata={
                "workspace_id": workspace['id'],
                "workspace_name": workspace['name'],
                "seller_count": quantity
            }
        )
        
        trans_doc = transaction.model_dump()
        trans_doc['created_at'] = trans_doc['created_at'].isoformat()
        trans_doc['updated_at'] = trans_doc['updated_at'].isoformat()
        
        await db.payment_transactions.insert_one(trans_doc)
        
        logger.info(f"Created checkout session {session.id} for workspace {workspace['name']} with {quantity} seats")
        
        return {
            "url": session.url,
            "session_id": session.id,
            "quantity": quantity,
            "updated_existing": False
        }
    
    except Exception as e:
        logger.error(f"Checkout session creation error: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Failed to create/update subscription: {str(e)}")

@api_router.get("/checkout/status/{session_id}")
async def get_checkout_status(
    session_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get checkout session status and update subscription if paid - using native Stripe API"""
    # Find transaction
    transaction = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
    
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    if transaction['user_id'] != current_user['id']:
        raise HTTPException(status_code=403, detail="Unauthorized")
    
    # If already processed, return cached status
    if transaction['payment_status'] in ['paid', 'failed', 'expired']:
        return {
            "status": transaction['payment_status'],
            "transaction": transaction
        }
    
    # Check status with Stripe using native API
    try:
        import stripe as stripe_lib
        stripe_lib.api_key = STRIPE_API_KEY
        
        # Retrieve checkout session from Stripe
        session = stripe_lib.checkout.Session.retrieve(session_id)
        
        # Determine payment status
        payment_status = 'pending'
        if session.payment_status == 'paid':
            payment_status = 'paid'
        elif session.payment_status == 'unpaid':
            payment_status = 'pending'
        elif session.status == 'expired':
            payment_status = 'expired'
        
        # Update transaction
        await db.payment_transactions.update_one(
            {"session_id": session_id},
            {"$set": {
                "payment_status": payment_status,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        # If payment successful, activate subscription
        if payment_status == 'paid':
            # Check if already activated (prevent double activation)
            sub = await db.subscriptions.find_one({"user_id": current_user['id']})
            
            if sub and sub.get('status') != 'active':
                # Activate subscription
                now = datetime.now(timezone.utc)
                period_end = now + timedelta(days=30)  # Monthly subscription
                
                # Calculate AI credits dynamically based on seats
                plan = transaction['plan']
                seats = transaction.get('metadata', {}).get('seller_count', 1)
                ai_credits = calculate_monthly_ai_credits(seats)
                
                # Get actual Stripe subscription ID
                stripe_subscription_id = session.subscription if hasattr(session, 'subscription') else session_id
                
                await db.subscriptions.update_one(
                    {"user_id": current_user['id']},
                    {"$set": {
                        "status": "active",
                        "plan": plan,
                        "seats": seats,
                        "current_period_start": now.isoformat(),
                        "current_period_end": period_end.isoformat(),
                        "stripe_subscription_id": stripe_subscription_id,
                        "ai_credits_remaining": ai_credits,
                        "ai_credits_used_this_month": 0,
                        "updated_at": now.isoformat()
                    }}
                )
                
                logger.info(f"Subscription activated for user {current_user['id']}, plan: {plan}, seats: {seats}, credits: {ai_credits}")
        
        return {
            "status": payment_status,
            "amount_total": session.amount_total / 100 if session.amount_total else 0,  # Convert from cents
            "currency": session.currency if hasattr(session, 'currency') else 'eur',
            "transaction": transaction
        }
    
    except Exception as e:
        logger.error(f"Failed to check payment status: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Failed to check payment status: {str(e)}")

@api_router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    """Handle Stripe webhooks using native Stripe API"""
    try:
        import stripe as stripe_lib
        stripe_lib.api_key = STRIPE_API_KEY
        
        body = await request.body()
        signature = request.headers.get("Stripe-Signature")
        
        # Get webhook secret from environment (optional for now)
        webhook_secret = os.environ.get('STRIPE_WEBHOOK_SECRET')
        
        # Parse and verify webhook event
        if webhook_secret and signature:
            try:
                event = stripe_lib.Webhook.construct_event(
                    body, signature, webhook_secret
                )
            except stripe_lib.error.SignatureVerificationError as e:
                logger.error(f"Webhook signature verification failed: {str(e)}")
                raise HTTPException(status_code=400, detail="Invalid signature")
        else:
            # In development, parse without verification (not recommended for production)
            event = stripe_lib.Event.construct_from(
                json.loads(body), stripe_lib.api_key
            )
        
        logger.info(f"Received Stripe webhook event: {event['type']}")
        
        # Handle checkout.session.completed event
        if event['type'] == 'checkout.session.completed':
            session = event['data']['object']
            session_id = session['id']
            metadata = session.get('metadata', {})
            
            logger.info(f"Processing checkout.session.completed for session: {session_id}")
            
            # Update transaction status
            await db.payment_transactions.update_one(
                {"session_id": session_id},
                {"$set": {
                    "payment_status": "paid",
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }}
            )
            
            # Activate subscription if payment successful
            workspace_id = metadata.get('workspace_id')
            if session.get('payment_status') == 'paid' and workspace_id:
                stripe_subscription_id = session.get('subscription')  # Get actual Stripe subscription ID
                
                logger.info(f"Activating subscription for workspace: {workspace_id}")
                
                # Get Stripe subscription to extract quantity and subscription_item_id
                stripe_sub = stripe_lib.Subscription.retrieve(stripe_subscription_id) if stripe_subscription_id else None
                quantity = 1
                subscription_item_id = None
                
                if stripe_sub and stripe_sub.get('items') and stripe_sub['items']['data']:
                    quantity = stripe_sub['items']['data'][0].get('quantity', 1)
                    subscription_item_id = stripe_sub['items']['data'][0]['id']
                
                # Update workspace with subscription details
                now = datetime.now(timezone.utc)
                # Extract period from Stripe subscription using helper function
                if stripe_sub:
                    period_start, period_end = extract_subscription_period(stripe_sub)
                    # Fallback if extraction failed
                    if not period_start:
                        period_start = now
                    if not period_end:
                        period_end = now + timedelta(days=30)
                else:
                    period_start = now
                    period_end = now + timedelta(days=30)
                
                await db.workspaces.update_one(
                    {"id": workspace_id},
                    {"$set": {
                        "subscription_status": "active",
                        "stripe_subscription_id": stripe_subscription_id,
                        "stripe_subscription_item_id": subscription_item_id,
                        "stripe_quantity": quantity,
                        "current_period_start": period_start.isoformat(),
                        "current_period_end": period_end.isoformat(),
                        "cancel_at_period_end": False,
                        "canceled_at": None,
                        "ai_credits_remaining": 500,  # Base credits for paid subscription
                        "ai_credits_used_this_month": 0,
                        "last_credit_reset": now.isoformat(),
                        "updated_at": now.isoformat()
                    }}
                )
                
                logger.info(f"Subscription activated successfully for workspace: {workspace_id} with {quantity} seats")
        
        # Handle subscription updates
        elif event['type'] in ['customer.subscription.updated', 'customer.subscription.deleted']:
            subscription = event['data']['object']
            stripe_subscription_id = subscription['id']
            
            logger.info(f"Processing subscription event: {event['type']} for subscription: {stripe_subscription_id}")
            
            # Find workspace by Stripe subscription ID
            workspace = await db.workspaces.find_one({"stripe_subscription_id": stripe_subscription_id}, {"_id": 0})
            
            if workspace:
                if event['type'] == 'customer.subscription.deleted' or subscription['status'] == 'canceled':
                    # Cancel subscription
                    await db.workspaces.update_one(
                        {"stripe_subscription_id": stripe_subscription_id},
                        {"$set": {
                            "subscription_status": "canceled",
                            "updated_at": datetime.now(timezone.utc).isoformat()
                        }}
                    )
                    logger.info(f"Subscription canceled for workspace: {workspace['id']}")
                
                elif subscription['status'] == 'active':
                    # Update subscription period and quantity using helper function
                    period_start, period_end = extract_subscription_period(subscription)
                    cancel_at_period_end = subscription.get('cancel_at_period_end', False)
                    
                    # Get quantity from subscription items
                    quantity = workspace.get('stripe_quantity', 1)
                    if subscription.get('items') and subscription['items']['data']:
                        quantity = subscription['items']['data'][0].get('quantity', 1)
                    
                    update_data = {
                        "subscription_status": "active",
                        "stripe_quantity": quantity,
                        "cancel_at_period_end": cancel_at_period_end,
                        "updated_at": datetime.now(timezone.utc).isoformat()
                    }
                    
                    # Add period fields only if available
                    if period_start:
                        update_data["current_period_start"] = period_start.isoformat()
                    if period_end:
                        update_data["current_period_end"] = period_end.isoformat()
                    
                    # If reactivated, clear cancellation timestamp
                    if not cancel_at_period_end:
                        update_data["canceled_at"] = None
                        logger.info(f"Subscription reactivated for workspace: {workspace['id']}")
                    
                    await db.workspaces.update_one(
                        {"stripe_subscription_id": stripe_subscription_id},
                        {"$set": update_data}
                    )
                    logger.info(f"Subscription updated for workspace {workspace['id']}: quantity={quantity}, status={subscription['status']}")
        
        return {"status": "success", "event_type": event['type']}
    
    except Exception as e:
        logger.error(f"Webhook error: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=400, detail=str(e))


# Add CORS middleware BEFORE including router (critical for proper OPTIONS handling)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origin_regex=r"https://.*\.emergentagent\.com|http://localhost:3000",
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# ===== RELATIONSHIP MANAGEMENT / CONFLICT RESOLUTION =====

class RelationshipAdviceRequest(BaseModel):
    seller_id: str
    advice_type: str  # "relationnel" or "conflit"
    situation_type: str  # "augmentation", "conflit_equipe", "demotivation", etc.
    description: str
    
@api_router.post("/manager/relationship-advice")
async def get_relationship_advice(
    request: RelationshipAdviceRequest,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """
    Generate AI-powered relationship/conflict management advice for managers.
    Uses manager profile, seller profile, KPIs, and recent debriefs.
    """
    try:
        # Verify manager
        token = credentials.credentials
        payload = decode_token(token)
        current_user = await db.users.find_one({"id": payload['user_id']}, {"_id": 0, "password": 0})
        if current_user.get('role') != 'manager':
            raise HTTPException(status_code=403, detail="Manager access only")
        
        manager_id = current_user['id']
        workspace_id = current_user.get('workspace_id')
        
        # Get seller info
        seller = await db.users.find_one({"id": request.seller_id}, {"_id": 0, "password": 0})
        if not seller:
            raise HTTPException(status_code=404, detail="Seller not found")
        
        # Get manager profile
        manager_diagnostic = await db.manager_diagnostic_results.find_one(
            {"manager_id": manager_id},
            {"_id": 0}
        )
        
        # Get seller profile
        seller_diagnostic = await db.diagnostics.find_one(
            {"seller_id": request.seller_id},
            {"_id": 0}
        )
        
        # Get seller KPIs (last 30 days)
        thirty_days_ago = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
        kpi_entries = await db.kpi_entries.find(
            {
                "seller_id": request.seller_id,
                "date": {"$gte": thirty_days_ago}
            },
            {"_id": 0}
        ).to_list(100)
        
        # Get recent shared debriefs (last 5)
        recent_debriefs = await db.debriefs.find(
            {
                "seller_id": request.seller_id,
                "shared_with_manager": True
            },
            {"_id": 0}
        ).sort("created_at", -1).limit(5).to_list(5)
        
        # Prepare data summary for AI
        kpi_summary = f"KPIs sur les 30 derniers jours : {len(kpi_entries)} entrées"
        if kpi_entries:
            total_ca = sum(entry.get('ca', 0) for entry in kpi_entries)
            total_ventes = sum(entry.get('ventes', 0) for entry in kpi_entries)
            kpi_summary += f"\n- CA total : {total_ca}€\n- Ventes totales : {total_ventes}"
        
        debrief_summary = f"{len(recent_debriefs)} debriefs récents"
        if recent_debriefs:
            debrief_summary += ":\n" + "\n".join([
                f"- {d.get('date', 'Date inconnue')}: {d.get('summary', 'Pas de résumé')[:100]}"
                for d in recent_debriefs
            ])
        
        # Build AI prompt
        advice_type_fr = "relationnelle" if request.advice_type == "relationnel" else "de conflit"
        
        system_message = f"""Tu es un expert en management d'équipe retail et en gestion {advice_type_fr}.
Tu dois fournir des conseils personnalisés basés sur les profils de personnalité et les performances."""

        user_prompt = f"""# Situation {advice_type_fr.upper()}

**Type de situation :** {request.situation_type}
**Description :** {request.description}

## Contexte Manager
**Prénom :** {current_user.get('first_name', 'Manager')}
**Profil de personnalité :** {json.dumps(manager_diagnostic.get('profile', {}), ensure_ascii=False) if manager_diagnostic else 'Non disponible'}

## Contexte Vendeur
**Prénom :** {seller.get('first_name', 'Vendeur')}
**Statut :** {seller.get('status', 'actif')}
**Profil de personnalité :** {json.dumps(seller_diagnostic.get('profile', {}), ensure_ascii=False) if seller_diagnostic else 'Non disponible'}

## Performances
{kpi_summary}

## Debriefs récents
{debrief_summary}

# Ta mission
Fournis une recommandation CONCISE et ACTIONNABLE (maximum 400 mots) structurée avec :

## Analyse de la situation (2-3 phrases max)
- Diagnostic rapide en tenant compte des profils de personnalité

## Conseils pratiques (3 actions concrètes max)
- Actions spécifiques et immédiatement applicables
- Adaptées aux profils de personnalité

## Phrases clés (2-3 phrases max)
- Formulations précises adaptées au profil du vendeur

## Points de vigilance (2 points max)
- Ce qu'il faut éviter compte tenu des profils

IMPORTANT : Sois CONCIS, DIRECT et PRATIQUE. Évite les longues explications théoriques."""

        # Call GPT-5
        emergent_key = os.environ.get('EMERGENT_LLM_KEY')
        if not emergent_key:
            raise HTTPException(status_code=500, detail="EMERGENT_LLM_KEY not configured")
        
        chat = LlmChat(
            api_key=emergent_key,
            session_id=f"relationship_{manager_id}_{request.seller_id}_{datetime.now(timezone.utc).isoformat()}",
            system_message=system_message
        ).with_model("openai", "gpt-5")
        
        user_message = UserMessage(text=user_prompt)
        ai_response = await chat.send_message(user_message)
        
        # Save to history
        consultation_id = str(uuid.uuid4())
        consultation = {
            "id": consultation_id,
            "manager_id": manager_id,
            "seller_id": request.seller_id,
            "seller_name": f"{seller.get('first_name', '')} {seller.get('last_name', '')}",
            "seller_status": seller.get('status', 'active'),
            "advice_type": request.advice_type,
            "situation_type": request.situation_type,
            "description": request.description,
            "recommendation": ai_response,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.relationship_consultations.insert_one(consultation)
        
        return {
            "consultation_id": consultation_id,
            "recommendation": ai_response,
            "seller_name": consultation["seller_name"]
        }
        
    except Exception as e:
        logger.error(f"Error generating relationship advice: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")

@api_router.get("/manager/relationship-history")
async def get_relationship_history(
    seller_id: Optional[str] = None,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Get manager's relationship consultation history with optional seller filter."""
    try:
        # Verify manager
        token = credentials.credentials
        payload = decode_token(token)
        current_user = await db.users.find_one({"id": payload['user_id']}, {"_id": 0, "password": 0})
        if not current_user or current_user.get('role') != 'manager':
            raise HTTPException(status_code=403, detail="Manager access only")
        
        manager_id = current_user['id']
        
        # Build query
        query = {"manager_id": manager_id}
        if seller_id:
            query["seller_id"] = seller_id
        
        # Get consultations
        consultations = await db.relationship_consultations.find(
            query,
            {"_id": 0}
        ).sort("created_at", -1).to_list(100)
        
        return {"consultations": consultations}
        
    except Exception as e:
        logger.error(f"Error fetching relationship history: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")

@api_router.delete("/manager/relationship-consultation/{consultation_id}")
async def delete_relationship_consultation(
    consultation_id: str,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Delete a relationship consultation. Manager can only delete their own consultations."""
    try:
        # Verify manager
        token = credentials.credentials
        payload = decode_token(token)
        current_user = await db.users.find_one({"id": payload['user_id']}, {"_id": 0, "password": 0})
        if not current_user or current_user.get('role') != 'manager':
            raise HTTPException(status_code=403, detail="Manager access only")
        
        manager_id = current_user['id']
        
        # Find and delete consultation (only if it belongs to this manager)
        result = await db.relationship_consultations.delete_one({
            "consultation_id": consultation_id,
            "manager_id": manager_id
        })
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Consultation not found or access denied")
        
        return {"status": "success", "message": "Consultation deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting consultation: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")

# ===== SUPERADMIN ENDPOINTS =====

async def get_super_admin(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Middleware pour vérifier que l'utilisateur est super_admin"""
    token = credentials.credentials
    payload = decode_token(token)
    user = await db.users.find_one({"id": payload['user_id']}, {"_id": 0, "password": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.get('role') != 'super_admin':
        raise HTTPException(status_code=403, detail="SuperAdmin access required")
    
    # Log d'audit
    await db.admin_logs.insert_one({
        "admin_id": user['id'],
        "admin_email": user['email'],
        "action": "superadmin_access",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "ip": "unknown"  # Peut être enrichi avec request.client.host
    })
    
    return user

@api_router.get("/superadmin/stats")
async def get_superadmin_stats(current_admin: dict = Depends(get_super_admin)):
    """Statistiques globales de la plateforme (métriques anonymisées)"""
    try:
        # Log access to dashboard
        await log_admin_action(
            admin=current_admin,
            action="access_superadmin_dashboard",
            details={"view": "stats"}
        )
        # Nombre de workspaces
        total_workspaces = await db.workspaces.count_documents({})
        active_workspaces = await db.workspaces.count_documents({"status": "active"})
        trial_workspaces = await db.workspaces.count_documents({"status": {"$in": ["trial", None]}})
        suspended_workspaces = await db.workspaces.count_documents({"status": "suspended"})
        
        # Nombre d'utilisateurs (UNIFORMISÉ - uniquement les actifs)
        active_managers = await db.users.count_documents({"role": "manager", "status": "active"})
        active_sellers = await db.users.count_documents({"role": "seller", "status": "active"})
        total_active_users = active_managers + active_sellers
        
        # Total incluant inactifs (pour référence)
        all_managers = await db.users.count_documents({"role": "manager"})
        all_sellers = await db.users.count_documents({"role": "seller"})
        
        # Statistiques d'utilisation IA (anonymisées)
        total_diagnostics = await db.diagnostics.count_documents({})
        total_debriefs = await db.debriefs.count_documents({})
        total_evaluations = await db.evaluations.count_documents({})
        
        # Abonnements et revenus
        subscriptions = await db.subscriptions.find({}, {"_id": 0}).to_list(1000)
        active_paid_subs = [sub for sub in subscriptions if sub.get('status') == 'active' and sub.get('amount', 0) > 0]
        trial_subs = [sub for sub in subscriptions if sub.get('status') == 'trialing']
        
        total_revenue = sum(sub.get('amount', 0) for sub in active_paid_subs)
        total_mrr = total_revenue  # Monthly Recurring Revenue
        
        # Activité récente (7 derniers jours)
        seven_days_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
        recent_signups = await db.users.count_documents({
            "created_at": {"$gte": seven_days_ago},
            "role": "manager"
        })
        
        # Analyses créées récemment (7 derniers jours)
        recent_debriefs = await db.debriefs.count_documents({
            "created_at": {"$gte": seven_days_ago}
        })
        
        return {
            "workspaces": {
                "total": total_workspaces,
                "active": active_workspaces,
                "trial": trial_workspaces,
                "suspended": suspended_workspaces
            },
            "users": {
                "total_active": total_active_users,
                "active_managers": active_managers,
                "active_sellers": active_sellers,
                "all_managers": all_managers,
                "all_sellers": all_sellers,
                "inactive": (all_managers + all_sellers) - total_active_users
            },
            "usage": {
                "diagnostics": total_diagnostics,
                "analyses_ventes": total_debriefs,
                "evaluations": total_evaluations,
                "total_ai_operations": total_diagnostics + total_debriefs + total_evaluations
            },
            "revenue": {
                "mrr": total_mrr,
                "active_subscriptions": len(active_paid_subs),
                "trial_subscriptions": len(trial_subs),
                "currency": "EUR"
            },
            "activity": {
                "recent_signups_7d": recent_signups,
                "recent_analyses_7d": recent_debriefs
            }
        }
    except Exception as e:
        logger.error(f"Error fetching superadmin stats: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/superadmin/workspaces")
async def get_all_workspaces(current_admin: dict = Depends(get_super_admin)):
    """Liste tous les workspaces avec informations de base"""
    try:
        # Log access
        await log_admin_action(
            admin=current_admin,
            action="access_workspaces_list",
            details={"view": "workspaces"}
        )
        workspaces = await db.workspaces.find({}, {"_id": 0}).to_list(1000)
        
        result = []
        for workspace in workspaces:
            # Récupérer le manager
            manager = await db.users.find_one({
                "workspace_id": workspace['id'],
                "role": "manager"
            }, {"_id": 0, "password": 0})
            
            # Compter les vendeurs actifs
            sellers_count = await db.users.count_documents({
                "workspace_id": workspace['id'],
                "role": "seller",
                "status": "active"
            })
            
            # Récupérer l'abonnement
            subscription = await db.subscriptions.find_one({
                "workspace_id": workspace['id']
            }, {"_id": 0})
            
            result.append({
                "id": workspace.get('id', 'unknown'),
                "name": workspace.get('name', 'Sans nom'),
                "status": workspace.get('status', 'active'),
                "created_at": workspace.get('created_at'),
                "manager": {
                    "email": manager.get('email') if manager else None,
                    "name": manager.get('name') if manager else None
                },
                "sellers_count": sellers_count,
                "subscription": {
                    "plan": subscription.get('plan_type') if subscription else 'trial',
                    "status": subscription.get('status') if subscription else 'trial',
                    "seats": subscription.get('seats') if subscription else 0,
                    "end_date": subscription.get('end_date') if subscription else workspace.get('trial_end')
                }
            })
        
        return result
    except Exception as e:
        logger.error(f"Error fetching workspaces: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.patch("/superadmin/workspaces/{workspace_id}/status")
async def update_workspace_status(
    workspace_id: str,
    status: str,
    current_admin: dict = Depends(get_super_admin)
):
    """Activer/désactiver un workspace"""
    try:
        if status not in ['active', 'suspended', 'deleted']:
            raise HTTPException(status_code=400, detail="Invalid status")
        
        result = await db.workspaces.update_one(
            {"id": workspace_id},
            {"$set": {"status": status, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
        
        if result.modified_count == 0:
            raise HTTPException(status_code=404, detail="Workspace not found")
        
        # Get workspace details for logging
        workspace = await db.workspaces.find_one({"id": workspace_id}, {"_id": 0, "name": 1})
        
        # Log d'audit enrichi
        await log_admin_action(
            admin=current_admin,
            action="workspace_status_change",
            workspace_id=workspace_id,
            details={
                "workspace_name": workspace.get('name') if workspace else 'Unknown',
                "old_status": "active",  # Could fetch this before update
                "new_status": status
            }
        )
        
        return {"success": True, "message": f"Workspace status updated to {status}"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating workspace status: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.patch("/superadmin/workspaces/{workspace_id}/plan")
async def update_workspace_plan(
    workspace_id: str,
    plan_data: dict,
    current_admin: dict = Depends(get_super_admin)
):
    """Changer le plan d'un workspace"""
    try:
        new_plan = plan_data.get('plan')
        valid_plans = ['trial', 'starter', 'professional', 'enterprise']
        
        if new_plan not in valid_plans:
            raise HTTPException(status_code=400, detail=f"Invalid plan. Must be one of: {valid_plans}")
        
        # Mettre à jour le workspace
        await db.workspaces.update_one(
            {"id": workspace_id},
            {"$set": {"plan_type": new_plan, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
        
        # Mettre à jour l'abonnement
        await db.subscriptions.update_one(
            {"workspace_id": workspace_id},
            {"$set": {"plan_type": new_plan, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
        
        # Get workspace details
        workspace = await db.workspaces.find_one({"id": workspace_id}, {"_id": 0, "name": 1, "plan_type": 1})
        
        # Log d'audit enrichi
        await log_admin_action(
            admin=current_admin,
            action="workspace_plan_change",
            workspace_id=workspace_id,
            details={
                "workspace_name": workspace.get('name') if workspace else 'Unknown',
                "old_plan": workspace.get('plan_type') if workspace else 'unknown',
                "new_plan": new_plan
            }
        )
        
        return {"success": True, "message": f"Plan changed to {new_plan}"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating workspace plan: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/superadmin/logs")
async def get_admin_logs(
    limit: int = 100,
    action: Optional[str] = None,
    admin_email: Optional[str] = None,
    admin_emails: Optional[str] = None,
    workspace_id: Optional[str] = None,
    days: int = 7,
    current_admin: dict = Depends(get_super_admin)
):
    """Récupère les logs d'audit admin avec filtres"""
    try:
        # Build query
        query = {}
        
        # Filter by time
        since = datetime.now(timezone.utc) - timedelta(days=days)
        query["timestamp"] = {"$gte": since.isoformat()}
        
        # Filter by action
        if action:
            query["action"] = action
        
        # Filter by admin email (single or multiple)
        if admin_emails:
            # Multiple emails sent as comma-separated string
            email_list = [email.strip() for email in admin_emails.split(',') if email.strip()]
            if email_list:
                query["admin_email"] = {"$in": email_list}
        elif admin_email:
            # Backward compatibility: single email with regex
            query["admin_email"] = {"$regex": admin_email, "$options": "i"}
        
        # Filter by workspace
        if workspace_id:
            query["workspace_id"] = workspace_id
        
        # Fetch logs
        logs = await db.admin_logs.find(
            query,
            {"_id": 0}
        ).sort("timestamp", -1).limit(limit).to_list(limit)
        
        # Get unique actions and admins for filter dropdowns
        all_actions = await db.admin_logs.distinct("action")
        all_admins = await db.admin_logs.aggregate([
            {"$group": {
                "_id": "$admin_email",
                "name": {"$first": "$admin_name"}
            }},
            {"$sort": {"_id": 1}}
        ]).to_list(100)
        
        available_admins = [
            {"email": admin["_id"], "name": admin.get("name") or admin["_id"]}
            for admin in all_admins if admin["_id"]
        ]
        
        return {
            "logs": logs,
            "available_actions": sorted(all_actions),
            "available_admins": available_admins,
            "filters_applied": {
                "action": action,
                "admin_email": admin_email,
                "admin_emails": admin_emails,
                "workspace_id": workspace_id,
                "days": days
            }
        }
    except Exception as e:
        logger.error(f"Error fetching admin logs: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/superadmin/system-logs")
async def get_system_logs(
    limit: int = 100,
    level: Optional[str] = None,
    log_type: Optional[str] = None,
    hours: int = 24,
    current_admin: dict = Depends(get_super_admin)
):
    """Récupère les logs système avec filtres"""
    try:
        # Log access to system logs
        await log_admin_action(
            admin=current_admin,
            action="access_system_logs",
            details={
                "filters": {
                    "level": level,
                    "type": log_type,
                    "hours": hours
                }
            }
        )
        # Build query
        query = {}
        
        # Filter by time
        since = datetime.now(timezone.utc) - timedelta(hours=hours)
        query["timestamp"] = {"$gte": since.isoformat()}
        
        # Filter by level (error, warning, info)
        if level:
            query["level"] = level
        
        # Filter by type (backend, frontend, database, api)
        if log_type:
            query["type"] = log_type
        
        # Fetch logs
        logs = await db.system_logs.find(
            query,
            {"_id": 0}
        ).sort("timestamp", -1).limit(limit).to_list(limit)
        
        # Get stats
        total_errors = await db.system_logs.count_documents({
            "level": "error",
            "timestamp": {"$gte": since.isoformat()}
        })
        
        total_warnings = await db.system_logs.count_documents({
            "level": "warning",
            "timestamp": {"$gte": since.isoformat()}
        })
        
        return {
            "logs": logs,
            "stats": {
                "total_errors": total_errors,
                "total_warnings": total_warnings,
                "period_hours": hours
            }
        }
    except Exception as e:
        logger.error(f"Error fetching system logs: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/superadmin/health")
async def get_system_health(current_admin: dict = Depends(get_super_admin)):
    """Get system health metrics"""
    try:
        # Errors in last 24h
        last_24h = datetime.now(timezone.utc) - timedelta(hours=24)
        errors_24h = await db.system_logs.count_documents({
            "level": "error",
            "timestamp": {"$gte": last_24h.isoformat()}
        })
        
        # Errors in last 10 minutes (for critical alerts)
        last_10min = datetime.now(timezone.utc) - timedelta(minutes=10)
        errors_10min = await db.system_logs.count_documents({
            "level": "error",
            "timestamp": {"$gte": last_10min.isoformat()}
        })
        
        # Get last critical error
        last_error = await db.system_logs.find_one(
            {"level": "error"},
            {"_id": 0},
            sort=[("timestamp", -1)]
        )
        
        # Determine health status
        if errors_10min >= 10:
            status = "critical"
        elif errors_24h >= 100:
            status = "warning"
        else:
            status = "healthy"
        
        return {
            "status": status,
            "errors_24h": errors_24h,
            "errors_10min": errors_10min,
            "last_error": last_error,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
    except Exception as e:
        logger.error(f"Error fetching health: {str(e)}")
        return {
            "status": "unknown",
            "error": str(e)
        }


@api_router.get("/superadmin/subscriptions/overview")
async def get_subscriptions_overview(current_admin: dict = Depends(get_super_admin)):
    """
    Vue d'ensemble de tous les abonnements Stripe des gérants.
    Affiche statuts, paiements, prorations, etc.
    """
    try:
        # Récupérer tous les gérants
        gerants = await db.users.find(
            {"role": "gerant"},
            {"_id": 0, "id": 1, "name": 1, "email": 1, "stripe_customer_id": 1, "created_at": 1}
        ).to_list(None)
        
        subscriptions_data = []
        
        for gerant in gerants:
            # Récupérer l'abonnement
            subscription = await db.subscriptions.find_one(
                {"user_id": gerant['id']},
                {"_id": 0}
            )
            
            # Compter les vendeurs actifs
            active_sellers_count = await db.users.count_documents({
                "gerant_id": gerant['id'],
                "role": "seller",
                "status": "active"
            })
            
            # Récupérer la dernière transaction
            last_transaction = await db.payment_transactions.find_one(
                {"user_id": gerant['id']},
                {"_id": 0},
                sort=[("created_at", -1)]
            )
            
            # Récupérer l'utilisation des crédits IA
            team_members = await db.users.find(
                {"gerant_id": gerant['id']},
                {"_id": 0, "id": 1}
            ).to_list(None)
            
            team_ids = [member['id'] for member in team_members]
            
            ai_credits_total = 0
            if team_ids:
                pipeline = [
                    {"$match": {"user_id": {"$in": team_ids}}},
                    {"$group": {"_id": None, "total": {"$sum": "$credits_consumed"}}}
                ]
                result = await db.ai_usage_logs.aggregate(pipeline).to_list(None)
                if result:
                    ai_credits_total = result[0]['total']
            
            subscriptions_data.append({
                "gerant": {
                    "id": gerant['id'],
                    "name": gerant['name'],
                    "email": gerant['email'],
                    "created_at": gerant.get('created_at')
                },
                "subscription": subscription,
                "active_sellers_count": active_sellers_count,
                "last_transaction": last_transaction,
                "ai_credits_used": ai_credits_total
            })
        
        # Statistiques globales
        total_gerants = len(gerants)
        active_subscriptions = sum(1 for s in subscriptions_data if s['subscription'] and s['subscription'].get('status') in ['active', 'trialing'])
        trialing_subscriptions = sum(1 for s in subscriptions_data if s['subscription'] and s['subscription'].get('status') == 'trialing')
        total_mrr = sum(
            s['subscription'].get('seats', 0) * s['subscription'].get('price_per_seat', 0)
            for s in subscriptions_data
            if s['subscription'] and s['subscription'].get('status') == 'active'
        )
        
        return {
            "summary": {
                "total_gerants": total_gerants,
                "active_subscriptions": active_subscriptions,
                "trialing_subscriptions": trialing_subscriptions,
                "total_mrr": round(total_mrr, 2)
            },
            "subscriptions": subscriptions_data
        }
        
    except Exception as e:
        logger.error(f"Error fetching subscriptions overview: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/superadmin/subscriptions/{gerant_id}/details")
async def get_subscription_details(
    gerant_id: str,
    current_admin: dict = Depends(get_super_admin)
):
    """
    Détails complets d'un abonnement spécifique.
    Inclut historique des prorations, paiements, événements webhook.
    """
    try:
        # Récupérer le gérant
        gerant = await db.users.find_one(
            {"id": gerant_id, "role": "gerant"},
            {"_id": 0}
        )
        
        if not gerant:
            raise HTTPException(status_code=404, detail="Gérant non trouvé")
        
        # Récupérer l'abonnement
        subscription = await db.subscriptions.find_one(
            {"user_id": gerant_id},
            {"_id": 0}
        )
        
        # Récupérer toutes les transactions
        transactions = await db.payment_transactions.find(
            {"user_id": gerant_id},
            {"_id": 0}
        ).sort("created_at", -1).to_list(100)
        
        # Récupérer les événements webhook liés
        webhook_events = []
        if subscription and subscription.get('stripe_subscription_id'):
            webhook_events = await db.stripe_events.find(
                {
                    "$or": [
                        {"data.object.id": subscription['stripe_subscription_id']},
                        {"data.object.subscription": subscription['stripe_subscription_id']},
                        {"data.object.customer": gerant.get('stripe_customer_id')}
                    ]
                },
                {"_id": 0}
            ).sort("created_at", -1).limit(50).to_list(None)
        
        # Compter les vendeurs
        active_sellers = await db.users.count_documents({
            "gerant_id": gerant_id,
            "role": "seller",
            "status": "active"
        })
        
        suspended_sellers = await db.users.count_documents({
            "gerant_id": gerant_id,
            "role": "seller",
            "status": "suspended"
        })
        
        return {
            "gerant": gerant,
            "subscription": subscription,
            "sellers": {
                "active": active_sellers,
                "suspended": suspended_sellers,
                "total": active_sellers + suspended_sellers
            },
            "transactions": transactions,
            "webhook_events": webhook_events
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching subscription details: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/superadmin/webhooks/recent")
async def get_recent_webhooks(
    limit: int = 50,
    current_admin: dict = Depends(get_super_admin)
):
    """
    Liste des webhooks Stripe récents.
    Utile pour déboguer et monitorer.
    """
    try:
        events = await db.stripe_events.find(
            {},
            {"_id": 0}
        ).sort("created_at", -1).limit(limit).to_list(None)
        
        # Statistiques
        total_events = await db.stripe_events.count_documents({})
        processed_events = await db.stripe_events.count_documents({"processed": True})
        failed_events = await db.stripe_events.count_documents({"processed": False})
        
        # Dernières 24h
        last_24h = datetime.now(timezone.utc) - timedelta(hours=24)
        events_24h = await db.stripe_events.count_documents({
            "created_at": {"$gte": last_24h.isoformat()}
        })
        
        return {
            "summary": {
                "total_events": total_events,
                "processed": processed_events,
                "failed": failed_events,
                "last_24h": events_24h
            },
            "events": events
        }
        
    except Exception as e:
        logger.error(f"Error fetching recent webhooks: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/superadmin/ai-credits/usage")
async def get_ai_credits_usage(current_admin: dict = Depends(get_super_admin)):
    """
    Récupère l'utilisation des crédits IA par gérant/workspace.
    Affiche le total des crédits consommés et les détails par action.
    """
    try:
        # Récupérer tous les gérants
        gerants = await db.users.find(
            {"role": "gerant"},
            {"_id": 0, "id": 1, "name": 1, "email": 1}
        ).to_list(None)
        
        usage_by_gerant = []
        total_credits_all = 0
        
        for gerant in gerants:
            # Récupérer tous les utilisateurs (managers + sellers) de ce gérant
            team_members = await db.users.find(
                {"gerant_id": gerant['id']},
                {"_id": 0, "id": 1}
            ).to_list(None)
            
            team_ids = [member['id'] for member in team_members]
            
            if not team_ids:
                usage_by_gerant.append({
                    "gerant": gerant,
                    "total_credits": 0,
                    "usage_by_action": {},
                    "recent_usage": []
                })
                continue
            
            # Agréger l'utilisation par type d'action
            pipeline = [
                {"$match": {"user_id": {"$in": team_ids}}},
                {"$group": {
                    "_id": "$action_type",
                    "total_credits": {"$sum": "$credits_consumed"},
                    "count": {"$sum": 1}
                }}
            ]
            
            usage_by_action = {}
            total_credits = 0
            
            async for result in db.ai_usage_logs.aggregate(pipeline):
                action_type = result['_id']
                credits = result['total_credits']
                count = result['count']
                
                usage_by_action[action_type] = {
                    "credits": credits,
                    "count": count
                }
                total_credits += credits
            
            total_credits_all += total_credits
            
            # Récupérer les 5 dernières utilisations
            recent_usage = await db.ai_usage_logs.find(
                {"user_id": {"$in": team_ids}},
                {"_id": 0}
            ).sort("timestamp", -1).limit(5).to_list(None)
            
            usage_by_gerant.append({
                "gerant": gerant,
                "total_credits": total_credits,
                "usage_by_action": usage_by_action,
                "recent_usage": recent_usage,
                "team_size": len(team_ids)
            })
        
        # Trier par crédits consommés (décroissant)
        usage_by_gerant.sort(key=lambda x: x['total_credits'], reverse=True)
        
        # Statistiques globales
        total_usage_count = await db.ai_usage_logs.count_documents({})
        
        # Usage des 30 derniers jours
        thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)
        usage_30d = await db.ai_usage_logs.aggregate([
            {"$match": {"timestamp": {"$gte": thirty_days_ago.isoformat()}}},
            {"$group": {"_id": None, "total": {"$sum": "$credits_consumed"}}}
        ]).to_list(None)
        
        credits_30d = usage_30d[0]['total'] if usage_30d else 0
        
        return {
            "summary": {
                "total_credits_consumed": total_credits_all,
                "total_usage_count": total_usage_count,
                "credits_last_30_days": credits_30d,
                "total_gerants": len(gerants)
            },
            "usage_by_gerant": usage_by_gerant
        }
        
    except Exception as e:
        logger.error(f"Error fetching AI credits usage: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/superadmin/admins")
async def get_super_admins(current_admin: dict = Depends(get_super_admin)):
    """Get list of super admins"""
    try:
        admins = await db.users.find(
            {"role": "super_admin"},
            {"_id": 0, "password": 0}
        ).to_list(100)
        
        return {"admins": admins}
    except Exception as e:
        logger.error(f"Error fetching admins: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/superadmin/admins")
async def add_super_admin(
    email: EmailStr,
    name: str,
    current_admin: dict = Depends(get_super_admin)
):
    """Add a new super admin by email"""
    try:
        # Check if user already exists
        existing = await db.users.find_one({"email": email})
        if existing:
            if existing.get('role') == 'super_admin':
                raise HTTPException(status_code=400, detail="Cet email est déjà super admin")
            else:
                raise HTTPException(status_code=400, detail="Cet email existe déjà avec un autre rôle")
        
        # Generate temporary password
        temp_password = secrets.token_urlsafe(16)
        hashed_password = bcrypt.hashpw(temp_password.encode('utf-8'), bcrypt.gensalt())
        
        # Create new super admin
        new_admin = {
            "id": str(uuid.uuid4()),
            "email": email,
            "password": hashed_password.decode('utf-8'),
            "name": name,
            "role": "super_admin",
            "status": "active",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "created_by": current_admin['email']
        }
        
        await db.users.insert_one(new_admin)
        
        # Log action enrichi
        await log_admin_action(
            admin=current_admin,
            action="add_super_admin",
            details={
                "new_admin_email": email,
                "new_admin_name": name,
                "temp_password_generated": True
            }
        )
        
        return {
            "success": True,
            "email": email,
            "temporary_password": temp_password,
            "message": "Super admin ajouté. Envoyez-lui le mot de passe temporaire."
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error adding super admin: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.delete("/superadmin/admins/{admin_id}")
async def remove_super_admin(
    admin_id: str,
    current_admin: dict = Depends(get_super_admin)
):
    """Remove a super admin (cannot remove yourself)"""
    try:
        # Cannot remove yourself
        if admin_id == current_admin['id']:
            raise HTTPException(status_code=400, detail="Vous ne pouvez pas vous retirer vous-même")
        
        # Find admin to remove
        admin_to_remove = await db.users.find_one({"id": admin_id, "role": "super_admin"})
        if not admin_to_remove:
            raise HTTPException(status_code=404, detail="Super admin non trouvé")
        
        # Remove admin
        await db.users.delete_one({"id": admin_id})
        
        # Log action enrichi
        await log_admin_action(
            admin=current_admin,
            action="remove_super_admin",
            details={
                "removed_admin_email": admin_to_remove['email'],
                "removed_admin_name": admin_to_remove.get('name'),
                "removed_admin_id": admin_id
            }
        )
        
        return {"success": True, "message": "Super admin supprimé"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error removing super admin: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================
# INVITATIONS MANAGEMENT - SuperAdmin Only
# ============================================

@api_router.get("/superadmin/invitations")
async def get_all_invitations(
    status: Optional[str] = None,
    current_admin: dict = Depends(get_super_admin)
):
    """Récupérer toutes les invitations (tous gérants)"""
    try:
        query = {}
        if status:
            query["status"] = status
        
        invitations = await db.gerant_invitations.find(query, {"_id": 0}).to_list(1000)
        
        # Enrichir avec les infos du gérant
        for invite in invitations:
            gerant = await db.users.find_one(
                {"id": invite.get("gerant_id")}, 
                {"_id": 0, "name": 1, "email": 1}
            )
            if gerant:
                invite["gerant_name"] = gerant.get("name", "N/A")
                invite["gerant_email"] = gerant.get("email", "N/A")
        
        return invitations
    except Exception as e:
        logger.error(f"Error fetching invitations: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.delete("/superadmin/invitations/{invitation_id}")
async def delete_invitation(
    invitation_id: str,
    current_admin: dict = Depends(get_super_admin)
):
    """Supprimer une invitation"""
    try:
        invitation = await db.gerant_invitations.find_one({"id": invitation_id}, {"_id": 0})
        if not invitation:
            raise HTTPException(status_code=404, detail="Invitation non trouvée")
        
        await db.gerant_invitations.delete_one({"id": invitation_id})
        
        # Log action
        await log_admin_action(
            admin=current_admin,
            action="delete_invitation",
            details={
                "invitation_id": invitation_id,
                "email": invitation.get("email"),
                "role": invitation.get("role"),
                "gerant_id": invitation.get("gerant_id")
            }
        )
        
        return {"success": True, "message": "Invitation supprimée"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting invitation: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/superadmin/invitations/{invitation_id}/resend")
async def resend_invitation(
    invitation_id: str,
    current_admin: dict = Depends(get_super_admin)
):
    """Renvoyer une invitation"""
    try:
        invitation = await db.gerant_invitations.find_one({"id": invitation_id}, {"_id": 0})
        if not invitation:
            raise HTTPException(status_code=404, detail="Invitation non trouvée")
        
        # Envoyer l'email
        try:
            # Utiliser le nom de l'invitation ou fallback sur email
            recipient_name = invitation.get('name', invitation['email'].split('@')[0])
            
            if invitation['role'] == 'manager':
                send_manager_invitation_email(
                    recipient_email=invitation['email'],
                    recipient_name=recipient_name,
                    invitation_token=invitation['token'],
                    gerant_name=invitation.get('gerant_name', 'Votre gérant'),
                    store_name=invitation.get('store_name', 'Votre magasin')
                )
            elif invitation['role'] == 'seller':
                send_seller_invitation_email(
                    recipient_email=invitation['email'],
                    recipient_name=recipient_name,
                    invitation_token=invitation['token'],
                    manager_name=invitation.get('manager_name', 'Votre manager'),
                    store_name=invitation.get('store_name', 'Votre magasin')
                )
            
            logger.info(f"Invitation resent to {invitation['email']} by super admin {current_admin['email']}")
        except Exception as e:
            logger.error(f"Failed to resend invitation email: {e}")
            raise HTTPException(status_code=500, detail=f"Erreur lors de l'envoi de l'email: {str(e)}")
        
        # Log action
        await log_admin_action(
            admin=current_admin,
            action="resend_invitation",
            details={
                "invitation_id": invitation_id,
                "email": invitation.get("email"),
                "role": invitation.get("role")
            }
        )
        
        return {"success": True, "message": "Invitation renvoyée"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error resending invitation: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================
# AI ASSISTANT ENDPOINTS - SuperAdmin Only
# ============================================

class ChatMessage(BaseModel):
    role: str  # 'user' or 'assistant'
    content: str
    timestamp: Optional[str] = None
    context: Optional[Dict] = None

class ChatRequest(BaseModel):
    message: str
    conversation_id: Optional[str] = None

class ActionRequest(BaseModel):
    action_type: str  # e.g., 'reactivate_workspace', 'change_plan'
    target_id: str
    params: Optional[Dict] = None

async def get_app_context_for_ai():
    """Gather relevant application context for AI assistant"""
    try:
        # Get recent errors (last 24h)
        last_24h = datetime.now(timezone.utc) - timedelta(hours=24)
        recent_errors = await db.system_logs.find(
            {"level": "error", "timestamp": {"$gte": last_24h.isoformat()}},
            {"_id": 0}
        ).sort("timestamp", -1).limit(10).to_list(10)
        
        # Get recent warnings
        recent_warnings = await db.system_logs.find(
            {"level": "warning", "timestamp": {"$gte": last_24h.isoformat()}},
            {"_id": 0}
        ).sort("timestamp", -1).limit(5).to_list(5)
        
        # Get recent admin actions (last 7 days)
        last_7d = datetime.now(timezone.utc) - timedelta(days=7)
        recent_actions = await db.admin_logs.find(
            {"timestamp": {"$gte": last_7d.isoformat()}},
            {"_id": 0}
        ).sort("timestamp", -1).limit(20).to_list(20)
        
        # Get platform stats
        total_workspaces = await db.workspaces.count_documents({})
        active_workspaces = await db.workspaces.count_documents({"status": "active"})
        suspended_workspaces = await db.workspaces.count_documents({"status": "suspended"})
        total_users = await db.users.count_documents({})
        
        # Get health status
        errors_24h = len(recent_errors)
        health_status = "healthy" if errors_24h < 10 else "warning" if errors_24h < 50 else "critical"
        
        context = {
            "platform_stats": {
                "total_workspaces": total_workspaces,
                "active_workspaces": active_workspaces,
                "suspended_workspaces": suspended_workspaces,
                "total_users": total_users,
                "health_status": health_status
            },
            "recent_errors": recent_errors[:5],  # Top 5 errors
            "recent_warnings": recent_warnings[:3],  # Top 3 warnings
            "recent_actions": recent_actions[:10],  # Last 10 admin actions
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
        return context
    except Exception as e:
        logger.error(f"Error gathering AI context: {str(e)}")
        return {}

@api_router.post("/superadmin/ai-assistant/chat")
async def chat_with_ai_assistant(
    request: ChatRequest,
    current_admin: dict = Depends(get_super_admin)
):
    """Chat with AI assistant for troubleshooting and support"""
    try:
        # Get or create conversation
        conversation_id = request.conversation_id
        if not conversation_id:
            # Create new conversation
            conversation_id = str(uuid.uuid4())
            conversation = {
                "id": conversation_id,
                "admin_email": current_admin['email'],
                "admin_name": current_admin.get('name', 'Admin'),
                "title": request.message[:50] + "..." if len(request.message) > 50 else request.message,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
            await db.ai_conversations.insert_one(conversation)
        else:
            # Update existing conversation
            await db.ai_conversations.update_one(
                {"id": conversation_id},
                {"$set": {"updated_at": datetime.now(timezone.utc).isoformat()}}
            )
        
        # Get app context
        app_context = await get_app_context_for_ai()
        
        # Get conversation history
        history = await db.ai_messages.find(
            {"conversation_id": conversation_id},
            {"_id": 0}
        ).sort("timestamp", 1).to_list(50)
        
        # Build messages for GPT-5
        system_prompt = f"""Tu es un assistant IA expert pour le SuperAdmin de Retail Performer AI, une plateforme SaaS de coaching commercial.

CONTEXTE DE L'APPLICATION:
{json.dumps(app_context, indent=2, ensure_ascii=False)}

TES CAPACITÉS:
1. Analyser les logs système et audit pour diagnostiquer les problèmes
2. Fournir des recommandations techniques précises
3. Suggérer des actions concrètes (avec validation admin requise)
4. Expliquer les fonctionnalités et l'architecture
5. Identifier les patterns d'erreurs et tendances

ACTIONS DISPONIBLES (toujours demander confirmation):
- reactivate_workspace: Réactiver un workspace suspendu
- change_workspace_plan: Changer le plan d'un workspace
- suspend_workspace: Suspendre un workspace problématique
- reset_ai_credits: Réinitialiser les crédits IA d'un workspace

STYLE DE RÉPONSE:
- Concis et technique
- Utilise le format Markdown pour une meilleure lisibilité :
  * Titres avec ## ou ### pour les sections
  * Listes à puces (-) ou numérotées (1.)
  * **Gras** pour les points importants
  * `code` pour les valeurs techniques
  * Sauts de ligne entre sections
- Utilise des emojis pour la lisibilité (🔍 analyse, ⚠️ alertes, ✅ solutions, 📊 stats)
- Structure tes réponses avec des sections claires et aérées
- Propose des actions concrètes quand nécessaire

Réponds toujours en français avec formatage Markdown."""

        messages = [{"role": "system", "content": system_prompt}]
        
        # Add conversation history (last 10 messages)
        for msg in history[-10:]:
            messages.append({
                "role": msg["role"],
                "content": msg["content"]
            })
        
        # Add current user message
        messages.append({"role": "user", "content": request.message})
        
        # Call GPT-5
        llm = LlmChat(
            api_key=os.environ.get('EMERGENT_LLM_KEY'),
            session_id=conversation_id or str(uuid.uuid4()),
            system_message=system_prompt
        ).with_model("openai", "gpt-5")
        
        # Create user message
        user_message = UserMessage(text=request.message)
        
        # Get AI response (returns str directly)
        ai_response = await llm.send_message(user_message)
        
        # Save user message
        user_msg = {
            "conversation_id": conversation_id,
            "role": "user",
            "content": request.message,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "context": app_context
        }
        await db.ai_messages.insert_one(user_msg)
        
        # Save assistant message
        assistant_msg = {
            "conversation_id": conversation_id,
            "role": "assistant",
            "content": ai_response,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        await db.ai_messages.insert_one(assistant_msg)
        
        # Log AI assistant usage
        await log_admin_action(
            admin=current_admin,
            action="ai_assistant_query",
            details={
                "conversation_id": conversation_id,
                "query_length": len(request.message),
                "response_length": len(ai_response)
            }
        )
        
        return {
            "conversation_id": conversation_id,
            "message": ai_response,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "context_used": {
                "errors_count": len(app_context.get('recent_errors', [])),
                "health_status": app_context.get('platform_stats', {}).get('health_status', 'unknown')
            }
        }
        
    except Exception as e:
        logger.error(f"Error in AI assistant chat: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Erreur AI: {str(e)}")

@api_router.get("/superadmin/ai-assistant/conversations")
async def get_ai_conversations(
    limit: int = 20,
    current_admin: dict = Depends(get_super_admin)
):
    """Get AI assistant conversation history (last 7 days)"""
    try:
        # Get conversations from last 7 days
        since = datetime.now(timezone.utc) - timedelta(days=7)
        
        conversations = await db.ai_conversations.find(
            {
                "admin_email": current_admin['email'],
                "created_at": {"$gte": since.isoformat()}
            },
            {"_id": 0}
        ).sort("updated_at", -1).limit(limit).to_list(limit)
        
        return {
            "conversations": conversations,
            "total": len(conversations)
        }
    except Exception as e:
        logger.error(f"Error fetching AI conversations: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/superadmin/ai-assistant/conversation/{conversation_id}")
async def get_conversation_messages(
    conversation_id: str,
    current_admin: dict = Depends(get_super_admin)
):
    """Get messages for a specific conversation"""
    try:
        # Verify conversation belongs to admin
        conversation = await db.ai_conversations.find_one(
            {
                "id": conversation_id,
                "admin_email": current_admin['email']
            },
            {"_id": 0}
        )
        
        if not conversation:
            raise HTTPException(status_code=404, detail="Conversation non trouvée")
        
        # Get messages
        messages = await db.ai_messages.find(
            {"conversation_id": conversation_id},
            {"_id": 0}
        ).sort("timestamp", 1).to_list(1000)
        
        return {
            "conversation": conversation,
            "messages": messages
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching conversation messages: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/superadmin/ai-assistant/execute-action")
async def execute_ai_suggested_action(
    action: ActionRequest,
    current_admin: dict = Depends(get_super_admin)
):
    """Execute an action suggested by AI assistant (with admin confirmation)"""
    try:
        result = None
        
        if action.action_type == "reactivate_workspace":
            # Reactivate workspace
            workspace = await db.workspaces.find_one({"id": action.target_id})
            if not workspace:
                raise HTTPException(status_code=404, detail="Workspace non trouvé")
            
            await db.workspaces.update_one(
                {"id": action.target_id},
                {"$set": {"status": "active", "updated_at": datetime.now(timezone.utc).isoformat()}}
            )
            
            result = {"success": True, "message": f"Workspace {workspace['name']} réactivé"}
            
            await log_admin_action(
                admin=current_admin,
                action="ai_reactivate_workspace",
                details={
                    "workspace_id": action.target_id,
                    "workspace_name": workspace['name'],
                    "via_ai_assistant": True
                }
            )
        
        elif action.action_type == "change_workspace_plan":
            new_plan = action.params.get('new_plan')
            if not new_plan:
                raise HTTPException(status_code=400, detail="new_plan requis")
            
            workspace = await db.workspaces.find_one({"id": action.target_id})
            if not workspace:
                raise HTTPException(status_code=404, detail="Workspace non trouvé")
            
            await db.workspaces.update_one(
                {"id": action.target_id},
                {"$set": {
                    "plan_type": new_plan,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }}
            )
            
            result = {"success": True, "message": f"Plan changé vers {new_plan}"}
            
            await log_admin_action(
                admin=current_admin,
                action="ai_change_plan",
                details={
                    "workspace_id": action.target_id,
                    "workspace_name": workspace['name'],
                    "old_plan": workspace.get('plan_type'),
                    "new_plan": new_plan,
                    "via_ai_assistant": True
                }
            )
        
        elif action.action_type == "suspend_workspace":
            workspace = await db.workspaces.find_one({"id": action.target_id})
            if not workspace:
                raise HTTPException(status_code=404, detail="Workspace non trouvé")
            
            await db.workspaces.update_one(
                {"id": action.target_id},
                {"$set": {"status": "suspended", "updated_at": datetime.now(timezone.utc).isoformat()}}
            )
            
            result = {"success": True, "message": f"Workspace {workspace['name']} suspendu"}
            
            await log_admin_action(
                admin=current_admin,
                action="ai_suspend_workspace",
                details={
                    "workspace_id": action.target_id,
                    "workspace_name": workspace['name'],
                    "reason": action.params.get('reason', 'Via AI assistant'),
                    "via_ai_assistant": True
                }
            )
        
        elif action.action_type == "reset_ai_credits":
            workspace = await db.workspaces.find_one({"id": action.target_id})
            if not workspace:
                raise HTTPException(status_code=404, detail="Workspace non trouvé")
            
            new_credits = action.params.get('credits', 100)
            
            await db.workspaces.update_one(
                {"id": action.target_id},
                {"$set": {
                    "ai_credits_remaining": new_credits,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }}
            )
            
            result = {"success": True, "message": f"Crédits IA réinitialisés à {new_credits}"}
            
            await log_admin_action(
                admin=current_admin,
                action="ai_reset_credits",
                details={
                    "workspace_id": action.target_id,
                    "workspace_name": workspace['name'],
                    "new_credits": new_credits,
                    "via_ai_assistant": True
                }
            )
        
        else:
            raise HTTPException(status_code=400, detail=f"Action non supportée: {action.action_type}")
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error executing AI action: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.delete("/superadmin/ai-assistant/conversation/{conversation_id}")
async def delete_conversation(
    conversation_id: str,
    current_admin: dict = Depends(get_super_admin)
):
    """Delete a conversation and its messages"""
    try:
        # Verify ownership
        conversation = await db.ai_conversations.find_one({
            "id": conversation_id,
            "admin_email": current_admin['email']
        })
        
        if not conversation:
            raise HTTPException(status_code=404, detail="Conversation non trouvée")
        
        # Delete messages
        await db.ai_messages.delete_many({"conversation_id": conversation_id})
        
        # Delete conversation
        await db.ai_conversations.delete_one({"id": conversation_id})
        
        return {"success": True, "message": "Conversation supprimée"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting conversation: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# ============================================
# SUPERADMIN - TRIAL MANAGEMENT
# ============================================

@api_router.get("/superadmin/gerants/trials")
async def get_gerants_trials(current_admin: dict = Depends(get_super_admin)):
    """Récupérer tous les gérants avec leurs informations d'essai"""
    try:
        # Récupérer tous les gérants
        gerants = await db.users.find(
            {"role": "gerant"},
            {"_id": 0, "password": 0}
        ).to_list(length=None)
        
        result = []
        for gerant in gerants:
            # Compter les vendeurs actifs
            active_sellers_count = await db.users.count_documents({
                "gerant_id": gerant['id'],
                "role": "seller",
                "status": "active"
            })
            
            # Vérifier s'il a un abonnement actif
            subscription = await db.subscriptions.find_one(
                {"user_id": gerant['id']},
                {"_id": 0}
            )
            
            has_subscription = False
            trial_end = None
            
            if subscription:
                has_subscription = subscription.get('status') in ['active', 'trialing']
                trial_end = subscription.get('trial_end')
            
            result.append({
                "id": gerant['id'],
                "name": gerant.get('name', 'N/A'),
                "email": gerant['email'],
                "trial_end": trial_end,
                "active_sellers_count": active_sellers_count,
                "has_subscription": has_subscription,
                "subscription_status": subscription.get('status') if subscription else None
            })
        
        # Trier par date d'expiration (les plus proches d'abord)
        result.sort(key=lambda x: (
            x['trial_end'] is None,  # Ceux sans essai en dernier
            x['trial_end'] if x['trial_end'] else ''
        ))
        
        return result
        
    except Exception as e:
        logger.error(f"Error fetching gerants trials: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.patch("/superadmin/gerants/{gerant_id}/trial")
async def update_gerant_trial(
    gerant_id: str,
    trial_data: dict,
    current_admin: dict = Depends(get_super_admin)
):
    """Modifier la période d'essai d'un gérant"""
    try:
        # Vérifier que le gérant existe
        gerant = await db.users.find_one(
            {"id": gerant_id, "role": "gerant"},
            {"_id": 0}
        )
        
        if not gerant:
            raise HTTPException(status_code=404, detail="Gérant non trouvé")
        
        # Récupérer la nouvelle date de fin d'essai
        trial_end_str = trial_data.get('trial_end')
        if not trial_end_str:
            raise HTTPException(status_code=400, detail="Date de fin d'essai requise")
        
        # Parser et valider la date
        try:
            trial_end_date = datetime.fromisoformat(trial_end_str.replace('Z', '+00:00'))
            # S'assurer que c'est en UTC
            if trial_end_date.tzinfo is None:
                trial_end_date = trial_end_date.replace(tzinfo=timezone.utc)
            trial_end = trial_end_date.isoformat()
        except ValueError:
            raise HTTPException(status_code=400, detail="Format de date invalide")
        
        # Mettre à jour ou créer l'abonnement
        subscription = await db.subscriptions.find_one({"user_id": gerant_id})
        
        if subscription:
            # Mettre à jour l'abonnement existant
            await db.subscriptions.update_one(
                {"user_id": gerant_id},
                {"$set": {
                    "trial_end": trial_end,
                    "status": "trialing",
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }}
            )
        else:
            # Créer un nouvel abonnement avec période d'essai
            from uuid import uuid4
            new_subscription = {
                "id": str(uuid4()),
                "user_id": gerant_id,
                "workspace_id": gerant.get('workspace_id'),
                "plan": "professional",  # Plan par défaut pour l'essai
                "status": "trialing",
                "seats": 10,  # 10 sièges par défaut
                "trial_end": trial_end,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
            await db.subscriptions.insert_one(new_subscription)
        
        logger.info(f"Trial period updated for gerant {gerant_id} by admin {current_admin['email']}")
        
        return {
            "success": True,
            "message": "Période d'essai mise à jour avec succès",
            "trial_end": trial_end
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating gerant trial: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# ============================================
# GERANT ENDPOINTS - Multi-Store Management
# ============================================

@api_router.post("/gerant/stores", response_model=Store)
async def create_store(store_data: StoreCreate, current_user: dict = Depends(get_current_user)):
    """Créer un nouveau magasin (réservé aux gérants)"""
    if current_user['role'] not in ['gerant', 'gérant']:
        raise HTTPException(status_code=403, detail="Accès réservé aux gérants")
    
    # Créer le magasin
    store = Store(
        name=store_data.name,
        location=store_data.location,
        gerant_id=current_user['id'],
        address=store_data.address,
        phone=store_data.phone,
        opening_hours=store_data.opening_hours
    )
    
    await db.stores.insert_one(store.model_dump())
    
    return store

@api_router.get("/gerant/stores")
async def get_gerant_stores(current_user: dict = Depends(get_current_user)):
    """Récupérer tous les magasins du gérant"""
    if current_user['role'] not in ['gerant', 'gérant']:
        raise HTTPException(status_code=403, detail="Accès réservé aux gérants")
    
    stores = await db.stores.find(
        {"gerant_id": current_user['id'], "active": True},
        {"_id": 0}
    ).to_list(length=None)
    
    return stores

@api_router.get("/gerant/stores/{store_id}")
async def get_store_details(store_id: str, current_user: dict = Depends(get_current_user)):
    """Récupérer les détails d'un magasin spécifique"""
    if current_user['role'] not in ['gerant', 'gérant']:
        raise HTTPException(status_code=403, detail="Accès réservé aux gérants")
    
    store = await db.stores.find_one(
        {"id": store_id, "gerant_id": current_user['id']},
        {"_id": 0}
    )
    
    if not store:
        raise HTTPException(status_code=404, detail="Magasin non trouvé")
    
    return store

@api_router.put("/gerant/stores/{store_id}")
async def update_store(
    store_id: str, 
    store_update: StoreUpdate, 
    current_user: dict = Depends(get_current_user)
):
    """Mettre à jour un magasin"""
    if current_user['role'] not in ['gerant', 'gérant']:
        raise HTTPException(status_code=403, detail="Accès réservé aux gérants")
    
    # Vérifier que le magasin appartient au gérant
    store = await db.stores.find_one({"id": store_id, "gerant_id": current_user['id']})
    if not store:
        raise HTTPException(status_code=404, detail="Magasin non trouvé")
    
    # Préparer les données de mise à jour
    update_data = {k: v for k, v in store_update.model_dump().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    # Mettre à jour
    await db.stores.update_one(
        {"id": store_id},
        {"$set": update_data}
    )
    
    # Récupérer le magasin mis à jour
    updated_store = await db.stores.find_one({"id": store_id}, {"_id": 0})
    return updated_store

@api_router.delete("/gerant/stores/{store_id}")
async def delete_store(store_id: str, current_user: dict = Depends(get_current_user)):
    """Supprimer un magasin et suspendre automatiquement l'équipe"""
    if current_user['role'] not in ['gerant', 'gérant']:
        raise HTTPException(status_code=403, detail="Accès réservé aux gérants")
    
    # Vérifier que le magasin appartient au gérant
    store = await db.stores.find_one({"id": store_id, "gerant_id": current_user['id']}, {"_id": 0})
    if not store:
        raise HTTPException(status_code=404, detail="Magasin non trouvé")
    
    # Compter les utilisateurs qui seront suspendus
    managers_count = await db.users.count_documents({
        "store_id": store_id, 
        "role": "manager",
        "status": {"$ne": "deleted"}
    })
    sellers_count = await db.users.count_documents({
        "store_id": store_id, 
        "role": "seller",
        "status": {"$ne": "deleted"}
    })
    
    # Suspendre automatiquement tous les managers et vendeurs du magasin
    if managers_count > 0 or sellers_count > 0:
        await db.users.update_many(
            {
                "store_id": store_id,
                "role": {"$in": ["manager", "seller"]},
                "status": {"$ne": "deleted"}
            },
            {
                "$set": {
                    "status": "suspended",
                    "suspended_reason": f"Magasin '{store['name']}' supprimé",
                    "suspended_at": datetime.now(timezone.utc).isoformat(),
                    "suspended_by": current_user['id']
                }
            }
        )
        
        logger.info(f"Magasin {store['name']} supprimé - {managers_count} manager(s) et {sellers_count} vendeur(s) suspendus")
    
    # Marquer le magasin comme inactif (soft delete)
    await db.stores.update_one(
        {"id": store_id},
        {
            "$set": {
                "active": False,
                "deleted_at": datetime.now(timezone.utc).isoformat(),
                "deleted_by": current_user['id'],
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    # Retourner les informations de l'action
    return {
        "message": "Magasin supprimé avec succès",
        "store_name": store['name'],
        "suspended_managers": managers_count,
        "suspended_sellers": sellers_count,
        "total_suspended": managers_count + sellers_count
    }

@api_router.get("/gerant/dashboard/stats")
async def get_gerant_dashboard_stats(current_user: dict = Depends(get_current_user)):
    """Récupérer les statistiques globales du gérant (tous magasins)"""
    if current_user['role'] not in ['gerant', 'gérant']:
        raise HTTPException(status_code=403, detail="Accès réservé aux gérants")
    
    # Récupérer tous les magasins actifs
    stores = await db.stores.find(
        {"gerant_id": current_user['id'], "active": True},
        {"_id": 0}
    ).to_list(length=None)
    
    store_ids = [store['id'] for store in stores]
    
    # Compter les managers actifs
    total_managers = await db.users.count_documents({
        "gerant_id": current_user['id'],
        "role": "manager",
        "status": "active"
    })
    
    # Compter les managers suspendus
    suspended_managers = await db.users.count_documents({
        "gerant_id": current_user['id'],
        "role": "manager",
        "status": "suspended"
    })
    
    # Compter les vendeurs actifs
    total_sellers = await db.users.count_documents({
        "gerant_id": current_user['id'],
        "role": "seller",
        "status": "active"
    })
    
    # Compter les vendeurs suspendus
    suspended_sellers = await db.users.count_documents({
        "gerant_id": current_user['id'],
        "role": "seller",
        "status": "suspended"
    })
    
    # Calculer le CA cumulé du mois en cours
    now = datetime.now(timezone.utc)
    first_day_of_month = now.replace(day=1).strftime('%Y-%m-%d')
    today = now.strftime('%Y-%m-%d')
    
    # Agréger le CA de tous les magasins pour le mois en cours
    # Note: kpi_entries n'a pas de gerant_id, on utilise store_id
    pipeline = [
        {
            "$match": {
                "store_id": {"$in": store_ids},
                "date": {"$gte": first_day_of_month, "$lte": today}
            }
        },
        {
            "$group": {
                "_id": None,
                "total_ca": {"$sum": {"$ifNull": ["$seller_ca", {"$ifNull": ["$ca_journalier", 0]}]}},
                "total_ventes": {"$sum": {"$ifNull": ["$nb_ventes", 0]}},
                "total_articles": {"$sum": {"$ifNull": ["$nb_articles", 0]}}
            }
        }
    ]
    
    kpi_stats = await db.kpi_entries.aggregate(pipeline).to_list(length=1)
    
    if kpi_stats:
        stats = kpi_stats[0]
    else:
        stats = {"total_ca": 0, "total_ventes": 0, "total_articles": 0}
    
    return {
        "total_stores": len(stores),
        "total_managers": total_managers,
        "suspended_managers": suspended_managers,
        "total_sellers": total_sellers,
        "suspended_sellers": suspended_sellers,
        "month_ca": stats.get("total_ca", 0),
        "month_ventes": stats.get("total_ventes", 0),
        "month_articles": stats.get("total_articles", 0),
        "stores": stores
    }

@api_router.get("/gerant/stores/{store_id}/stats")
async def get_store_stats(
    store_id: str, 
    period_type: str = 'week',  # 'week', 'month', 'year'
    period_offset: int = 0,
    current_user: dict = Depends(get_current_user)
):
    """Récupérer les statistiques d'un magasin spécifique pour une période donnée"""
    if current_user['role'] not in ['gerant', 'gérant']:
        raise HTTPException(status_code=403, detail="Accès réservé aux gérants")
    
    # Vérifier que le magasin appartient au gérant
    store = await db.stores.find_one(
        {"id": store_id, "gerant_id": current_user['id']},
        {"_id": 0}
    )
    if not store:
        raise HTTPException(status_code=404, detail="Magasin non trouvé")
    
    # Compter les managers actifs uniquement
    managers_count = await db.users.count_documents({
        "store_id": store_id, 
        "role": "manager",
        "status": "active"
    })
    
    # Compter les vendeurs actifs uniquement
    sellers_count = await db.users.count_documents({
        "store_id": store_id, 
        "role": "seller",
        "status": "active"
    })
    
    # Calculer le CA du jour (sellers + managers)
    today = datetime.now(timezone.utc).strftime('%Y-%m-%d')
    
    # Get sellers KPIs
    sellers_pipeline = [
        {
            "$match": {
                "store_id": store_id,
                "date": today
            }
        },
        {
            "$group": {
                "_id": None,
                "total_ca": {"$sum": {"$ifNull": ["$seller_ca", {"$ifNull": ["$ca_journalier", 0]}]}},
                "total_ventes": {"$sum": {"$ifNull": ["$nb_ventes", 0]}},
                "total_articles": {"$sum": {"$ifNull": ["$nb_articles", 0]}}
            }
        }
    ]
    
    sellers_stats = await db.kpi_entries.aggregate(sellers_pipeline).to_list(length=1)
    sellers_ca = sellers_stats[0].get("total_ca", 0) if sellers_stats else 0
    sellers_ventes = sellers_stats[0].get("total_ventes", 0) if sellers_stats else 0
    sellers_articles = sellers_stats[0].get("total_articles", 0) if sellers_stats else 0
    
    # Get managers KPIs
    managers_pipeline = [
        {
            "$match": {
                "store_id": store_id,
                "date": today
            }
        },
        {
            "$group": {
                "_id": None,
                "total_ca": {"$sum": {"$ifNull": ["$ca_journalier", 0]}},
                "total_ventes": {"$sum": {"$ifNull": ["$nb_ventes", 0]}},
                "total_articles": {"$sum": {"$ifNull": ["$nb_articles", 0]}}
            }
        }
    ]
    
    managers_stats = await db.manager_kpis.aggregate(managers_pipeline).to_list(length=1)
    managers_ca = managers_stats[0].get("total_ca", 0) if managers_stats else 0
    managers_ventes = managers_stats[0].get("total_ventes", 0) if managers_stats else 0
    managers_articles = managers_stats[0].get("total_articles", 0) if managers_stats else 0
    
    # Combine both for today
    stats = {
        "total_ca": sellers_ca + managers_ca,
        "total_ventes": sellers_ventes + managers_ventes,
        "total_articles": sellers_articles + managers_articles
    }
    
    # Calculate period dates based on period_type and period_offset
    from datetime import timedelta
    today_date = datetime.now(timezone.utc)
    
    if period_type == 'week':
        # Get Monday of current week (0 = Monday)
        days_since_monday = today_date.weekday()
        current_monday = today_date - timedelta(days=days_since_monday)
        
        # Apply period offset
        target_monday = current_monday + timedelta(weeks=period_offset)
        target_sunday = target_monday + timedelta(days=6)
        
        period_start = target_monday.strftime('%Y-%m-%d')
        period_end = target_sunday.strftime('%Y-%m-%d')
    elif period_type == 'month':
        # Calculate target month
        target_month = today_date.replace(day=1) + timedelta(days=32 * period_offset)
        target_month = target_month.replace(day=1)
        
        # First day of month
        period_start_date = target_month.replace(day=1)
        
        # Last day of month
        next_month = target_month.replace(day=28) + timedelta(days=4)
        period_end_date = next_month.replace(day=1) - timedelta(days=1)
        
        period_start = period_start_date.strftime('%Y-%m-%d')
        period_end = period_end_date.strftime('%Y-%m-%d')
    elif period_type == 'year':
        # Calculate target year
        target_year = today_date.year + period_offset
        period_start_date = datetime(target_year, 1, 1, tzinfo=timezone.utc)
        period_end_date = datetime(target_year, 12, 31, tzinfo=timezone.utc)
        
        period_start = period_start_date.strftime('%Y-%m-%d')
        period_end = period_end_date.strftime('%Y-%m-%d')
    else:
        raise HTTPException(status_code=400, detail="Invalid period_type")
    
    # Get sellers KPIs for the period
    sellers_period_pipeline = [
        {
            "$match": {
                "store_id": store_id,
                "date": {"$gte": period_start, "$lte": period_end}
            }
        },
        {
            "$group": {
                "_id": None,
                "total_ca": {"$sum": {"$ifNull": ["$seller_ca", {"$ifNull": ["$ca_journalier", 0]}]}},
                "total_ventes": {"$sum": {"$ifNull": ["$nb_ventes", 0]}}
            }
        }
    ]
    
    sellers_period = await db.kpi_entries.aggregate(sellers_period_pipeline).to_list(length=1)
    sellers_period_ca = sellers_period[0].get("total_ca", 0) if sellers_period else 0
    sellers_period_ventes = sellers_period[0].get("total_ventes", 0) if sellers_period else 0
    
    # Get managers KPIs for the period
    managers_period_pipeline = [
        {
            "$match": {
                "store_id": store_id,
                "date": {"$gte": period_start, "$lte": period_end}
            }
        },
        {
            "$group": {
                "_id": None,
                "total_ca": {"$sum": {"$ifNull": ["$seller_ca", {"$ifNull": ["$ca_journalier", 0]}]}},
                "total_ventes": {"$sum": {"$ifNull": ["$nb_ventes", 0]}}
            }
        }
    ]
    
    managers_period = await db.manager_kpis.aggregate(managers_period_pipeline).to_list(length=1)
    managers_period_ca = managers_period[0].get("total_ca", 0) if managers_period else 0
    managers_period_ventes = managers_period[0].get("total_ventes", 0) if managers_period else 0
    
    period_ca = sellers_period_ca + managers_period_ca
    period_ventes = sellers_period_ventes + managers_period_ventes
    
    # Calculate previous period CA for evolution
    if period_type == 'week':
        prev_start_date = target_monday - timedelta(weeks=1)
        prev_end_date = prev_start_date + timedelta(days=6)
    elif period_type == 'month':
        prev_start_date = period_start_date.replace(day=1) - timedelta(days=1)
        prev_start_date = prev_start_date.replace(day=1)
        prev_end_date = period_start_date - timedelta(days=1)
    elif period_type == 'year':
        prev_start_date = datetime(target_year - 1, 1, 1, tzinfo=timezone.utc)
        prev_end_date = datetime(target_year - 1, 12, 31, tzinfo=timezone.utc)
    
    prev_period_start = prev_start_date.strftime('%Y-%m-%d')
    prev_period_end = prev_end_date.strftime('%Y-%m-%d')
    
    # Get sellers KPIs for previous period
    sellers_prev_period = await db.kpi_entries.aggregate([
        {
            "$match": {
                "store_id": store_id,
                "date": {"$gte": prev_period_start, "$lte": prev_period_end}
            }
        },
        {
            "$group": {
                "_id": None,
                "total_ca": {"$sum": {"$ifNull": ["$seller_ca", {"$ifNull": ["$ca_journalier", 0]}]}}
            }
        }
    ]).to_list(length=1)
    
    # Get managers KPIs for previous period
    managers_prev_period = await db.manager_kpis.aggregate([
        {
            "$match": {
                "store_id": store_id,
                "date": {"$gte": prev_period_start, "$lte": prev_period_end}
            }
        },
        {
            "$group": {
                "_id": None,
                "total_ca": {"$sum": {"$ifNull": ["$seller_ca", {"$ifNull": ["$ca_journalier", 0]}]}}
            }
        }
    ]).to_list(length=1)
    
    prev_period_ca = (sellers_prev_period[0].get("total_ca", 0) if sellers_prev_period else 0) + \
                     (managers_prev_period[0].get("total_ca", 0) if managers_prev_period else 0)
    
    # Calculate month CA (current month)
    now = datetime.now(timezone.utc)
    first_day_of_month = now.replace(day=1).strftime('%Y-%m-%d')
    today_str = now.strftime('%Y-%m-%d')
    
    # Get sellers KPIs for current month
    sellers_month = await db.kpi_entries.aggregate([
        {
            "$match": {
                "store_id": store_id,
                "date": {"$gte": first_day_of_month, "$lte": today_str}
            }
        },
        {
            "$group": {
                "_id": None,
                "total_ca": {"$sum": {"$ifNull": ["$seller_ca", {"$ifNull": ["$ca_journalier", 0]}]}},
                "total_ventes": {"$sum": {"$ifNull": ["$nb_ventes", 0]}}
            }
        }
    ]).to_list(length=1)
    
    # Get managers KPIs for current month
    managers_month = await db.manager_kpis.aggregate([
        {
            "$match": {
                "store_id": store_id,
                "date": {"$gte": first_day_of_month, "$lte": today_str}
            }
        },
        {
            "$group": {
                "_id": None,
                "total_ca": {"$sum": {"$ifNull": ["$seller_ca", {"$ifNull": ["$ca_journalier", 0]}]}},
                "total_ventes": {"$sum": {"$ifNull": ["$nb_ventes", 0]}}
            }
        }
    ]).to_list(length=1)
    
    month_ca = (sellers_month[0].get("total_ca", 0) if sellers_month else 0) + \
               (managers_month[0].get("total_ca", 0) if managers_month else 0)
    month_ventes = (sellers_month[0].get("total_ventes", 0) if sellers_month else 0) + \
                   (managers_month[0].get("total_ventes", 0) if managers_month else 0)
    
    return {
        "store": store,
        "managers_count": managers_count,
        "sellers_count": sellers_count,
        "today_ca": stats.get("total_ca", 0),
        "today_ventes": stats.get("total_ventes", 0),
        "today_articles": stats.get("total_articles", 0),
        "month_ca": month_ca,
        "month_ventes": month_ventes,
        "period_ca": period_ca,
        "period_ventes": period_ventes,
        "prev_period_ca": prev_period_ca
    }

@api_router.get("/gerant/stores/{store_id}/managers")
async def get_store_managers(store_id: str, current_user: dict = Depends(get_current_user)):
    """Récupérer les managers d'un magasin (exclut les managers supprimés)"""
    if current_user['role'] not in ['gerant', 'gérant']:
        raise HTTPException(status_code=403, detail="Accès réservé aux gérants")
    
    managers = await db.users.find(
        {
            "store_id": store_id, 
            "role": "manager",
            "status": {"$ne": "deleted"}  # Exclure les managers supprimés
        },
        {"_id": 0, "password": 0}
    ).to_list(length=None)
    
    return managers

@api_router.get("/gerant/stores/{store_id}/sellers")
async def get_store_sellers(store_id: str, current_user: dict = Depends(get_current_user)):
    """Récupérer les vendeurs d'un magasin (exclut les vendeurs supprimés)"""
    if current_user['role'] not in ['gerant', 'gérant']:
        raise HTTPException(status_code=403, detail="Accès réservé aux gérants")
    
    sellers = await db.users.find(
        {
            "store_id": store_id, 
            "role": "seller",
            "status": {"$ne": "deleted"}  # Exclure les vendeurs supprimés
        },
        {"_id": 0, "password": 0}
    ).to_list(length=None)
    
    return sellers

@api_router.post("/gerant/stores/{store_id}/assign-manager")
async def assign_manager_to_store(
    store_id: str, 
    assignment: ManagerAssignment,
    current_user: dict = Depends(get_current_user)
):
    """Assigner un manager existant à un magasin"""
    if current_user['role'] not in ['gerant', 'gérant']:
        raise HTTPException(status_code=403, detail="Accès réservé aux gérants")
    
    # Vérifier que le magasin existe et appartient au gérant
    store = await db.stores.find_one({"id": store_id, "gerant_id": current_user['id']})
    if not store:
        raise HTTPException(status_code=404, detail="Magasin non trouvé")
    
    # Trouver le manager
    manager = await db.users.find_one({"email": assignment.manager_email, "role": "manager"})
    if not manager:
        raise HTTPException(status_code=404, detail="Manager non trouvé")
    
    # Assigner le manager au magasin
    await db.users.update_one(
        {"id": manager['id']},
        {"$set": {"store_id": store_id, "gerant_id": current_user['id']}}
    )
    
    return {"message": f"Manager {manager['name']} assigné au magasin {store['name']}"}

@api_router.patch("/gerant/managers/{manager_id}/suspend")
async def suspend_manager(
    manager_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Suspendre un manager (il ne peut plus se connecter)"""
    if current_user['role'] not in ['gerant', 'gérant']:
        raise HTTPException(status_code=403, detail="Accès réservé aux gérants")
    
    # Vérifier que le manager existe et appartient au gérant
    manager = await db.users.find_one(
        {"id": manager_id, "gerant_id": current_user['id'], "role": "manager"},
        {"_id": 0}
    )
    if not manager:
        raise HTTPException(status_code=404, detail="Manager non trouvé")
    
    if manager.get('status') == 'suspended':
        raise HTTPException(status_code=400, detail="Le manager est déjà suspendu")
    
    if manager.get('status') == 'deleted':
        raise HTTPException(status_code=400, detail="Impossible de suspendre un manager supprimé")
    
    # Suspendre le manager
    await db.users.update_one(
        {"id": manager_id},
        {"$set": {
            "status": "suspended",
            "suspended_at": datetime.now(timezone.utc).isoformat(),
            "suspended_by": current_user['id']
        }}
    )
    
    logger.info(f"Manager {manager_id} suspended by gerant {current_user['id']}")
    
    return {
        "success": True,
        "message": f"Manager {manager['name']} suspendu avec succès",
        "manager_id": manager_id,
        "status": "suspended"
    }

@api_router.patch("/gerant/managers/{manager_id}/reactivate")
async def reactivate_manager(
    manager_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Réactiver un manager suspendu"""
    if current_user['role'] not in ['gerant', 'gérant']:
        raise HTTPException(status_code=403, detail="Accès réservé aux gérants")
    
    # Vérifier que le manager existe et appartient au gérant
    manager = await db.users.find_one(
        {"id": manager_id, "gerant_id": current_user['id'], "role": "manager"},
        {"_id": 0}
    )
    if not manager:
        raise HTTPException(status_code=404, detail="Manager non trouvé")
    
    # Accepter suspended et inactive (ancien statut)
    if manager.get('status') not in ['suspended', 'inactive']:
        raise HTTPException(status_code=400, detail="Le manager n'est pas suspendu")
    
    # Préparer les champs à mettre à jour
    update_fields = {
        "status": "active",
        "reactivated_at": datetime.now(timezone.utc).isoformat()
    }
    unset_fields = {
        "suspended_at": "",
        "suspended_by": "",
        "suspended_reason": ""
    }
    
    # Vérifier si le manager est assigné à un magasin
    store_removed = False
    if manager.get('store_id'):
        # Vérifier que le magasin est actif
        store = await db.stores.find_one(
            {"id": manager['store_id']},
            {"_id": 0, "name": 1, "active": 1}
        )
        if not store or not store.get('active', False):
            # Si le magasin n'existe plus ou est inactif, retirer l'assignation
            unset_fields["store_id"] = ""
            store_removed = True
            store_name = store['name'] if store else "inconnu"
    
    # Réactiver le manager
    await db.users.update_one(
        {"id": manager_id},
        {
            "$set": update_fields,
            "$unset": unset_fields
        }
    )
    
    logger.info(f"Manager {manager_id} reactivated by gerant {current_user['id']}")
    
    message = f"Manager {manager['name']} réactivé avec succès"
    if store_removed:
        message += f". Le magasin '{store_name}' étant inactif, le manager a été désassigné et peut maintenant être assigné à un nouveau magasin."
    
    return {
        "success": True,
        "message": message,
        "manager_id": manager_id,
        "status": "active",
        "store_removed": store_removed
    }

@api_router.delete("/gerant/managers/{manager_id}")
async def delete_manager_gerant(
    manager_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Supprimer définitivement un manager (soft delete)"""
    if current_user['role'] not in ['gerant', 'gérant']:
        raise HTTPException(status_code=403, detail="Accès réservé aux gérants")
    
    # Vérifier que le manager existe et appartient au gérant
    manager = await db.users.find_one(
        {"id": manager_id, "gerant_id": current_user['id'], "role": "manager"},
        {"_id": 0}
    )
    if not manager:
        raise HTTPException(status_code=404, detail="Manager non trouvé")
    
    if manager.get('status') == 'deleted':
        raise HTTPException(status_code=400, detail="Le manager est déjà supprimé")
    
    # Compter les vendeurs actifs (info seulement, pas de blocage)
    active_sellers = await db.users.count_documents({
        "manager_id": manager_id,
        "role": "seller",
        "status": {"$ne": "deleted"}
    })
    
    # Note: On autorise la suppression même avec des vendeurs actifs
    # Les vendeurs gardent leur manager_id (historique) et restent attachés au magasin
    # Aucune perte de données car les KPI sont liés au store_id et seller_id
    
    # Soft delete : marquer comme supprimé
    await db.users.update_one(
        {"id": manager_id},
        {"$set": {
            "status": "deleted",
            "deleted_at": datetime.now(timezone.utc).isoformat(),
            "deleted_by": current_user['id']
        }}
    )
    
    logger.info(f"Manager {manager_id} deleted by gerant {current_user['id']}")
    
    return {
        "success": True,
        "message": f"Manager {manager['name']} supprimé avec succès",
        "manager_id": manager_id,
        "status": "deleted"
    }

@api_router.post("/gerant/managers/{manager_id}/transfer")
async def transfer_manager_to_store(
    manager_id: str,
    transfer: ManagerTransfer,
    current_user: dict = Depends(get_current_user)
):
    """Transférer un manager vers un autre magasin (les vendeurs restent)"""
    if current_user['role'] not in ['gerant', 'gérant']:
        raise HTTPException(status_code=403, detail="Accès réservé aux gérants")
    
    # Vérifier que le manager existe et appartient au gérant
    manager = await db.users.find_one({"id": manager_id, "gerant_id": current_user['id'], "role": "manager"})
    if not manager:
        raise HTTPException(status_code=404, detail="Manager non trouvé")
    
    # Vérifier que le nouveau magasin existe ET est actif
    new_store = await db.stores.find_one({"id": transfer.new_store_id, "gerant_id": current_user['id']})
    if not new_store:
        raise HTTPException(status_code=404, detail="Nouveau magasin non trouvé")
    
    if not new_store.get('active', False):
        raise HTTPException(
            status_code=400, 
            detail=f"Le magasin '{new_store['name']}' est inactif. Impossible de transférer vers un magasin inactif."
        )
    
    old_store_id = manager.get('store_id')
    
    # Préparer les champs à mettre à jour
    update_fields = {"store_id": transfer.new_store_id}
    unset_fields = {}
    
    # Si le manager était suspendu à cause d'un magasin inactif, le réactiver automatiquement
    if manager.get('status') == 'suspended' and manager.get('suspended_reason', '').startswith('Magasin'):
        update_fields["status"] = "active"
        update_fields["reactivated_at"] = datetime.now(timezone.utc).isoformat()
        unset_fields = {
            "suspended_at": "",
            "suspended_by": "",
            "suspended_reason": ""
        }
    
    # Transférer le manager
    update_operation = {"$set": update_fields}
    if unset_fields:
        update_operation["$unset"] = unset_fields
    
    await db.users.update_one(
        {"id": manager_id},
        update_operation
    )
    
    # Compter les vendeurs qui restent sans manager dans l'ancien magasin
    orphan_sellers = await db.users.count_documents({
        "manager_id": manager_id,
        "store_id": old_store_id,
        "role": "seller"
    })
    
    message = f"Manager transféré avec succès vers {new_store['name']}"
    if update_fields.get("status") == "active":
        message += " et réactivé automatiquement"
    
    return {
        "message": message,
        "orphan_sellers_count": orphan_sellers,
        "warning": f"{orphan_sellers} vendeur(s) restent dans l'ancien magasin sans manager" if orphan_sellers > 0 else None,
        "reactivated": update_fields.get("status") == "active"
    }

@api_router.post("/gerant/sellers/{seller_id}/transfer")
async def transfer_seller_to_store(
    seller_id: str,
    transfer: SellerTransfer,
    current_user: dict = Depends(get_current_user)
):
    """Transférer un vendeur vers un autre magasin avec nouveau manager"""
    if current_user['role'] not in ['gerant', 'gérant']:
        raise HTTPException(status_code=403, detail="Accès réservé aux gérants")
    
    # Vérifier que le vendeur existe et appartient au gérant
    seller = await db.users.find_one({"id": seller_id, "gerant_id": current_user['id'], "role": "seller"})
    if not seller:
        raise HTTPException(status_code=404, detail="Vendeur non trouvé")
    
    # Vérifier que le nouveau magasin existe ET est actif
    new_store = await db.stores.find_one({"id": transfer.new_store_id, "gerant_id": current_user['id']})
    if not new_store:
        raise HTTPException(status_code=404, detail="Nouveau magasin non trouvé")
    
    if not new_store.get('active', False):
        raise HTTPException(
            status_code=400, 
            detail=f"Le magasin '{new_store['name']}' est inactif. Impossible de transférer vers un magasin inactif."
        )
    
    # Vérifier que le nouveau manager existe et est bien dans le nouveau magasin
    new_manager = await db.users.find_one({
        "id": transfer.new_manager_id,
        "store_id": transfer.new_store_id,
        "role": "manager"
    })
    if not new_manager:
        raise HTTPException(status_code=404, detail="Manager non trouvé dans ce magasin")
    
    # Préparer les champs à mettre à jour
    update_fields = {
        "store_id": transfer.new_store_id,
        "manager_id": transfer.new_manager_id
    }
    unset_fields = {}
    
    # Si le vendeur était suspendu à cause d'un magasin inactif, le réactiver automatiquement
    if seller.get('status') == 'suspended' and seller.get('suspended_reason', '').startswith('Magasin'):
        update_fields["status"] = "active"
        update_fields["reactivated_at"] = datetime.now(timezone.utc).isoformat()
        unset_fields = {
            "suspended_at": "",
            "suspended_by": "",
            "suspended_reason": ""
        }
    
    # Transférer le vendeur
    update_operation = {"$set": update_fields}
    if unset_fields:
        update_operation["$unset"] = unset_fields
    
    await db.users.update_one(
        {"id": seller_id},
        update_operation
    )
    
    message = f"Vendeur transféré avec succès vers {new_store['name']}"
    if update_fields.get("status") == "active":
        message += " et réactivé automatiquement"
    
    return {
        "message": message,
        "new_manager": new_manager['name'],
        "reactivated": update_fields.get("status") == "active"
    }


@api_router.patch("/gerant/sellers/{seller_id}/suspend")
async def suspend_seller(
    seller_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Suspendre un vendeur (il ne peut plus se connecter)"""
    if current_user['role'] not in ['gerant', 'gérant']:
        raise HTTPException(status_code=403, detail="Accès réservé aux gérants")
    
    # Vérifier que le vendeur existe et appartient au gérant
    seller = await db.users.find_one(
        {"id": seller_id, "gerant_id": current_user['id'], "role": "seller"},
        {"_id": 0}
    )
    if not seller:
        raise HTTPException(status_code=404, detail="Vendeur non trouvé")
    
    if seller.get('status') == 'suspended':
        raise HTTPException(status_code=400, detail="Le vendeur est déjà suspendu")
    
    if seller.get('status') == 'deleted':
        raise HTTPException(status_code=400, detail="Impossible de suspendre un vendeur supprimé")
    
    # Suspendre le vendeur
    await db.users.update_one(
        {"id": seller_id},
        {"$set": {
            "status": "suspended",
            "suspended_at": datetime.now(timezone.utc).isoformat(),
            "suspended_by": current_user['id']
        }}
    )
    
    logger.info(f"Seller {seller_id} suspended by gerant {current_user['id']}")
    
    # Auto-update Stripe subscription quantity
    stripe_update = await auto_update_stripe_subscription_quantity(
        current_user['id'],
        reason=f"seller_suspended:{seller_id}"
    )
    
    message = f"Vendeur {seller['name']} suspendu avec succès"
    if stripe_update.get('updated'):
        message += f" (Abonnement mis à jour: {stripe_update['new_quantity']} vendeurs actifs)"
    
    return {
        "success": True,
        "message": message,
        "seller_id": seller_id,
        "status": "suspended",
        "stripe_updated": stripe_update.get('updated', False)
    }

@api_router.patch("/gerant/sellers/{seller_id}/reactivate")
async def reactivate_seller(
    seller_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Réactiver un vendeur suspendu"""
    if current_user['role'] not in ['gerant', 'gérant']:
        raise HTTPException(status_code=403, detail="Accès réservé aux gérants")
    
    # Vérifier que le vendeur existe et appartient au gérant
    seller = await db.users.find_one(
        {"id": seller_id, "gerant_id": current_user['id'], "role": "seller"},
        {"_id": 0}
    )
    if not seller:
        raise HTTPException(status_code=404, detail="Vendeur non trouvé")
    
    # Accepter suspended et inactive (ancien statut)
    if seller.get('status') not in ['suspended', 'inactive']:
        raise HTTPException(status_code=400, detail="Le vendeur n'est pas suspendu")
    
    # Préparer les champs à mettre à jour
    update_fields = {
        "status": "active",
        "reactivated_at": datetime.now(timezone.utc).isoformat()
    }
    unset_fields = {
        "suspended_at": "",
        "suspended_by": "",
        "suspended_reason": ""
    }
    
    # Vérifier si le vendeur est assigné à un magasin
    store_removed = False
    if seller.get('store_id'):
        # Vérifier que le magasin est actif
        store = await db.stores.find_one(
            {"id": seller['store_id']},
            {"_id": 0, "name": 1, "active": 1}
        )
        if not store or not store.get('active', False):
            # Si le magasin n'existe plus ou est inactif, retirer l'assignation
            unset_fields["store_id"] = ""
            unset_fields["manager_id"] = ""
            store_removed = True
            store_name = store['name'] if store else "inconnu"
    
    # Réactiver le vendeur
    await db.users.update_one(
        {"id": seller_id},
        {
            "$set": update_fields,
            "$unset": unset_fields
        }
    )
    
    logger.info(f"Seller {seller_id} reactivated by gerant {current_user['id']}")
    
    # Auto-update Stripe subscription quantity
    stripe_update = await auto_update_stripe_subscription_quantity(
        current_user['id'], 
        reason=f"seller_reactivated:{seller_id}"
    )
    
    message = f"Vendeur {seller['name']} réactivé avec succès"
    if store_removed:
        message += f". Le magasin '{store_name}' étant inactif, le vendeur a été désassigné et peut maintenant être assigné à un nouveau magasin."
    
    # Ajouter info sur mise à jour Stripe si elle a eu lieu
    if stripe_update.get('updated'):
        message += f" (Abonnement mis à jour: {stripe_update['new_quantity']} vendeurs actifs)"
    
    return {
        "success": True,
        "message": message,
        "seller_id": seller_id,
        "status": "active",
        "store_removed": store_removed,
        "stripe_updated": stripe_update.get('updated', False)
    }

@api_router.delete("/gerant/sellers/{seller_id}")
async def delete_seller_gerant(
    seller_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Supprimer définitivement un vendeur (soft delete)"""
    if current_user['role'] not in ['gerant', 'gérant']:
        raise HTTPException(status_code=403, detail="Accès réservé aux gérants")
    
    # Vérifier que le vendeur existe et appartient au gérant
    seller = await db.users.find_one(
        {"id": seller_id, "gerant_id": current_user['id'], "role": "seller"},
        {"_id": 0}
    )
    if not seller:
        raise HTTPException(status_code=404, detail="Vendeur non trouvé")
    
    if seller.get('status') == 'deleted':
        raise HTTPException(status_code=400, detail="Le vendeur est déjà supprimé")
    
    # Soft delete : marquer comme supprimé
    await db.users.update_one(
        {"id": seller_id},
        {"$set": {
            "status": "deleted",
            "deleted_at": datetime.now(timezone.utc).isoformat(),
            "deleted_by": current_user['id']
        }}
    )
    
    logger.info(f"Seller {seller_id} deleted by gerant {current_user['id']}")
    
    return {
        "success": True,
        "message": f"Vendeur {seller['name']} supprimé avec succès",
        "seller_id": seller_id,
        "status": "deleted"
    }

@api_router.patch("/gerant/sellers/{seller_id}/suspend")
async def suspend_seller_gerant(
    seller_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Suspendre un vendeur"""
    if current_user['role'] not in ['gerant', 'gérant']:
        raise HTTPException(status_code=403, detail="Accès réservé aux gérants")
    
    seller = await db.users.find_one(
        {"id": seller_id, "gerant_id": current_user['id'], "role": "seller"},
        {"_id": 0}
    )
    if not seller:
        raise HTTPException(status_code=404, detail="Vendeur non trouvé")
    
    if seller.get('status') == 'deleted':
        raise HTTPException(status_code=400, detail="Impossible de suspendre un vendeur supprimé")
    
    if seller.get('status') == 'suspended':
        raise HTTPException(status_code=400, detail="Le vendeur est déjà suspendu")
    
    await db.users.update_one(
        {"id": seller_id},
        {"$set": {"status": "suspended", "suspended_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"success": True, "message": f"Vendeur {seller['name']} suspendu avec succès", "status": "suspended"}

@api_router.patch("/gerant/sellers/{seller_id}/reactivate")
async def reactivate_seller_gerant(
    seller_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Réactiver un vendeur suspendu"""
    if current_user['role'] not in ['gerant', 'gérant']:
        raise HTTPException(status_code=403, detail="Accès réservé aux gérants")
    
    seller = await db.users.find_one(
        {"id": seller_id, "gerant_id": current_user['id'], "role": "seller"},
        {"_id": 0}
    )
    if not seller:
        raise HTTPException(status_code=404, detail="Vendeur non trouvé")
    
    if seller.get('status') == 'deleted':
        raise HTTPException(status_code=400, detail="Impossible de réactiver un vendeur supprimé")
    
    if seller.get('status') == 'active':
        raise HTTPException(status_code=400, detail="Le vendeur est déjà actif")
    
    await db.users.update_one(
        {"id": seller_id},
        {"$set": {"status": "active", "reactivated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"success": True, "message": f"Vendeur {seller['name']} réactivé avec succès", "status": "active"}

@api_router.patch("/gerant/managers/{manager_id}/suspend")
async def suspend_manager_gerant(
    manager_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Suspendre un manager"""
    if current_user['role'] not in ['gerant', 'gérant']:
        raise HTTPException(status_code=403, detail="Accès réservé aux gérants")
    
    manager = await db.users.find_one(
        {"id": manager_id, "gerant_id": current_user['id'], "role": "manager"},
        {"_id": 0}
    )
    if not manager:
        raise HTTPException(status_code=404, detail="Manager non trouvé")
    
    if manager.get('status') == 'deleted':
        raise HTTPException(status_code=400, detail="Impossible de suspendre un manager supprimé")
    
    if manager.get('status') == 'suspended':
        raise HTTPException(status_code=400, detail="Le manager est déjà suspendu")
    
    await db.users.update_one(
        {"id": manager_id},
        {"$set": {"status": "suspended", "suspended_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"success": True, "message": f"Manager {manager['name']} suspendu avec succès", "status": "suspended"}

@api_router.patch("/gerant/managers/{manager_id}/reactivate")
async def reactivate_manager_gerant(
    manager_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Réactiver un manager suspendu"""
    if current_user['role'] not in ['gerant', 'gérant']:
        raise HTTPException(status_code=403, detail="Accès réservé aux gérants")
    
    manager = await db.users.find_one(
        {"id": manager_id, "gerant_id": current_user['id'], "role": "manager"},
        {"_id": 0}
    )
    if not manager:
        raise HTTPException(status_code=404, detail="Manager non trouvé")
    
    if manager.get('status') == 'deleted':
        raise HTTPException(status_code=400, detail="Impossible de réactiver un manager supprimé")
    
    if manager.get('status') == 'active':
        raise HTTPException(status_code=400, detail="Le manager est déjà actif")
    
    await db.users.update_one(
        {"id": manager_id},
        {"$set": {"status": "active", "reactivated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"success": True, "message": f"Manager {manager['name']} réactivé avec succès", "status": "active"}

@api_router.get("/gerant/managers")
async def get_all_managers(current_user: dict = Depends(get_current_user)):
    """Récupérer tous les managers (actifs et suspendus, sauf deleted)"""
    if current_user['role'] not in ['gerant', 'gérant']:
        raise HTTPException(status_code=403, detail="Accès réservé aux gérants")
    
    managers = await db.users.find(
        {
            "gerant_id": current_user['id'], 
            "role": "manager", 
            "status": {"$ne": "deleted"}  # Exclude deleted
        },
        {"_id": 0, "password": 0}
    ).to_list(length=None)
    
    return managers

@api_router.get("/gerant/sellers")
async def get_all_sellers(current_user: dict = Depends(get_current_user)):
    """Récupérer tous les vendeurs (actifs et suspendus, sauf deleted)"""
    if current_user['role'] not in ['gerant', 'gérant']:
        raise HTTPException(status_code=403, detail="Accès réservé aux gérants")
    
    sellers = await db.users.find(
        {
            "gerant_id": current_user['id'], 
            "role": "seller", 
            "status": {"$ne": "deleted"}  # Exclude deleted
        },
        {"_id": 0, "password": 0}
    ).to_list(length=None)
    
    return sellers


# ============================================
# GERANT INVITATIONS ENDPOINTS
# ============================================

@api_router.post("/gerant/invitations")
async def create_gerant_invitation(
    invite_data: GerantInvitationCreate,
    current_user: dict = Depends(get_current_user)
):
    """Créer une invitation pour un manager ou vendeur (Gérant seulement)"""
    if current_user['role'] not in ['gerant', 'gérant']:
        raise HTTPException(status_code=403, detail="Accès réservé aux gérants")
    
    # Valider le rôle
    if invite_data.role not in ['manager', 'seller']:
        raise HTTPException(status_code=400, detail="Le rôle doit être 'manager' ou 'seller'")
    
    # Vérifier que le magasin existe et appartient au gérant
    store = await db.stores.find_one(
        {"id": invite_data.store_id, "gerant_id": current_user['id'], "active": True},
        {"_id": 0}
    )
    if not store:
        raise HTTPException(status_code=404, detail="Magasin non trouvé ou inactif")
    
    # Si c'est un vendeur, récupérer le manager (optionnel)
    manager_id = None
    manager_name = None
    if invite_data.role == 'seller' and invite_data.manager_id:
        # Si manager_id commence par "pending_", c'est une invitation en attente
        if invite_data.manager_id.startswith('pending_'):
            # Vérifier que l'invitation de manager existe
            pending_manager_id = invite_data.manager_id.replace('pending_', '')
            pending_invite = await db.gerant_invitations.find_one(
                {
                    "id": pending_manager_id,
                    "store_id": invite_data.store_id,
                    "role": "manager",
                    "status": "pending"
                },
                {"_id": 0}
            )
            if not pending_invite:
                raise HTTPException(status_code=404, detail="Invitation de manager non trouvée")
            
            # Utiliser l'email du manager en attente
            manager_id = None  # Sera assigné plus tard quand le manager accepte
            manager_name = f"{pending_invite['email']} (en attente)"
        else:
            # Manager actif
            manager = await db.users.find_one(
                {
                    "id": invite_data.manager_id,
                    "role": "manager",
                    "store_id": invite_data.store_id,
                    "gerant_id": current_user['id']
                },
                {"_id": 0}
            )
            if not manager:
                raise HTTPException(status_code=404, detail="Manager non trouvé dans ce magasin")
            
            manager_id = manager['id']
            manager_name = manager['name']
        
    # Si aucun manager spécifié pour un vendeur, c'est OK (sera assigné plus tard)
    elif invite_data.role == 'seller':
        manager_id = None
        manager_name = "À assigner plus tard"
    
    # Vérifier si l'email existe déjà (sauf si l'utilisateur est supprimé)
    existing_user = await db.users.find_one({
        "email": invite_data.email,
        "status": {"$ne": "deleted"}
    }, {"_id": 0})
    if existing_user:
        raise HTTPException(status_code=400, detail="Un utilisateur avec cet email existe déjà")
    
    # Vérifier s'il y a déjà une invitation en attente
    existing_invite = await db.gerant_invitations.find_one({
        "email": invite_data.email,
        "gerant_id": current_user['id'],
        "status": "pending"
    }, {"_id": 0})
    
    if existing_invite:
        raise HTTPException(status_code=400, detail="Une invitation est déjà en attente pour cet email")
    
    # NOUVEAU : Vérifier les quotas d'abonnement avant de créer l'invitation
    if invite_data.role == "seller":
        subscription_info = await get_gerant_subscription_info(current_user['id'])
        
        if not subscription_info['can_invite']:
            if subscription_info['needs_upgrade']:
                if subscription_info['subscription_tier'] == 'starter':
                    raise HTTPException(
                        status_code=400, 
                        detail="Vous avez dépassé la limite de 5 vendeurs. Veuillez passer à l'abonnement Professionnel pour inviter plus de vendeurs."
                    )
                else:
                    raise HTTPException(
                        status_code=400,
                        detail="Vous avez atteint la limite de 15 vendeurs. Contactez notre équipe pour un abonnement sur mesure."
                    )
            elif subscription_info['quota_exceeded']:
                raise HTTPException(
                    status_code=400,
                    detail=f"Quota dépassé ! Vous avez {subscription_info['active_sellers_count']} vendeurs actifs mais seulement {subscription_info['allowed_sellers']} autorisés. Mettez à niveau votre abonnement."
                )
            elif subscription_info['remaining_slots'] <= 0:
                raise HTTPException(
                    status_code=400,
                    detail=f"Limite atteinte ! Vous avez utilisé tous vos {subscription_info['allowed_sellers']} emplacements vendeurs. Mettez à niveau votre abonnement pour inviter plus de vendeurs."
                )
            else:
                raise HTTPException(
                    status_code=400,
                    detail="Impossible d'inviter un nouveau vendeur. Vérifiez votre abonnement."
                )
    
    # Les managers ne sont pas comptabilisés dans les quotas (gratuits)
    
    # Créer l'invitation
    invitation = GerantInvitation(
        name=invite_data.name,
        email=invite_data.email,
        role=invite_data.role,
        gerant_id=current_user['id'],
        gerant_name=current_user['name'],
        store_id=store['id'],
        store_name=store['name'],
        manager_id=manager_id,
        manager_name=manager_name
    )
    
    doc = invitation.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    doc['expires_at'] = doc['expires_at'].isoformat()
    
    await db.gerant_invitations.insert_one(doc)
    
    # Send invitation email based on role
    try:
        # Utiliser le nom fourni au lieu de l'email
        recipient_name = invite_data.name
        
        if invite_data.role == 'manager':
            send_manager_invitation_email(
                recipient_email=invite_data.email,
                recipient_name=recipient_name,
                invitation_token=invitation.token,
                gerant_name=current_user['name'],
                store_name=store['name']
            )
        elif invite_data.role == 'seller':
            send_seller_invitation_email(
                recipient_email=invite_data.email,
                recipient_name=recipient_name,
                invitation_token=invitation.token,
                manager_name=manager_name if manager_name else "Votre manager",
                store_name=store['name']
            )
        
        logger.info(f"Invitation email sent to {invite_data.email} (role: {invite_data.role})")
    except Exception as e:
        logger.error(f"Failed to send invitation email: {e}")
        # Continue even if email fails
    
    return invitation

@api_router.get("/gerant/invitations")
async def get_gerant_invitations(current_user: dict = Depends(get_current_user)):
    """Récupérer toutes les invitations du gérant"""
    if current_user['role'] not in ['gerant', 'gérant']:
        raise HTTPException(status_code=403, detail="Accès réservé aux gérants")
    
    invitations = await db.gerant_invitations.find(
        {"gerant_id": current_user['id']},
        {"_id": 0}
    ).sort("created_at", -1).to_list(1000)
    
    # Convertir les dates ISO
    for inv in invitations:
        if isinstance(inv.get('created_at'), str):
            inv['created_at'] = datetime.fromisoformat(inv['created_at'])
        if isinstance(inv.get('expires_at'), str):
            inv['expires_at'] = datetime.fromisoformat(inv['expires_at'])
    
    return invitations

@api_router.delete("/gerant/invitations/{invitation_id}")
async def cancel_gerant_invitation(
    invitation_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Annuler une invitation du gérant"""
    if current_user['role'] not in ['gerant', 'gérant']:
        raise HTTPException(status_code=403, detail="Accès réservé aux gérants")
    
    # Vérifier que l'invitation appartient bien au gérant
    invitation = await db.gerant_invitations.find_one({
        "id": invitation_id,
        "gerant_id": current_user['id']
    }, {"_id": 0})
    
    if not invitation:
        raise HTTPException(status_code=404, detail="Invitation non trouvée")
    
    # Supprimer l'invitation
    result = await db.gerant_invitations.delete_one({
        "id": invitation_id,
        "gerant_id": current_user['id']
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Invitation non trouvée")
    
    return {"success": True, "message": "Invitation annulée avec succès"}

@api_router.get("/invitations/gerant/verify/{token}")
async def verify_gerant_invitation(token: str):
    """Vérifier un token d'invitation Gérant"""
    invitation = await db.gerant_invitations.find_one({"token": token}, {"_id": 0})
    
    if not invitation:
        raise HTTPException(status_code=404, detail="Invitation non trouvée")
    
    # Convertir les dates
    if isinstance(invitation.get('created_at'), str):
        invitation['created_at'] = datetime.fromisoformat(invitation['created_at'])
    if isinstance(invitation.get('expires_at'), str):
        invitation['expires_at'] = datetime.fromisoformat(invitation['expires_at'])
    
    # Vérifier expiration
    if invitation['expires_at'] < datetime.now(timezone.utc):
        await db.gerant_invitations.update_one(
            {"token": token},
            {"$set": {"status": "expired"}}
        )
        raise HTTPException(status_code=400, detail="Cette invitation a expiré")
    
    if invitation['status'] != 'pending':
        raise HTTPException(status_code=400, detail=f"Cette invitation n'est plus valide (statut: {invitation['status']})")
    
    return invitation

@api_router.post("/auth/register-with-gerant-invite")
async def register_with_gerant_invite(invite_data: RegisterWithGerantInvite):
    """S'enregistrer avec une invitation Gérant"""
    # Vérifier l'invitation
    invitation = await db.gerant_invitations.find_one(
        {"token": invite_data.invitation_token},
        {"_id": 0}
    )
    
    if not invitation:
        raise HTTPException(status_code=404, detail="Invitation non trouvée")
    
    # Convertir dates
    if isinstance(invitation.get('expires_at'), str):
        invitation['expires_at'] = datetime.fromisoformat(invitation['expires_at'])
    
    # Vérifications
    if invitation['expires_at'] < datetime.now(timezone.utc):
        await db.gerant_invitations.update_one(
            {"token": invite_data.invitation_token},
            {"$set": {"status": "expired"}}
        )
        raise HTTPException(status_code=400, detail="Cette invitation a expiré")
    
    if invitation['status'] != 'pending':
        raise HTTPException(status_code=400, detail="Cette invitation n'est plus valide")
    
    # Récupérer l'email depuis l'invitation
    email = invitation['email']
    
    # Vérifier que l'email n'existe pas déjà
    existing_user = await db.users.find_one({"email": email}, {"_id": 0})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email déjà enregistré")
    
    # Hasher le mot de passe
    hashed_password = bcrypt.hashpw(invite_data.password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    
    # Créer l'utilisateur
    user_obj = User(
        name=invite_data.name,
        email=email,
        password=hashed_password,
        role=invitation['role'],
        manager_id=invitation.get('manager_id'),
        store_id=invitation['store_id'],
        gerant_id=invitation['gerant_id'],
        phone=invite_data.phone
    )
    
    user_dict = user_obj.model_dump()
    await db.users.insert_one(user_dict)
    
    # Si c'est un manager, réassigner automatiquement les vendeurs orphelins du même magasin
    if invitation['role'] == 'manager':
        orphan_sellers_result = await db.users.update_many(
            {
                "role": "seller",
                "store_id": invitation['store_id'],
                "manager_id": None,
                "status": {"$ne": "deleted"}
            },
            {
                "$set": {
                    "manager_id": user_obj.id,
                    "updatedAt": datetime.now(timezone.utc).isoformat()
                }
            }
        )
        if orphan_sellers_result.modified_count > 0:
            logger.info(f"Réassigné {orphan_sellers_result.modified_count} vendeur(s) orphelin(s) au nouveau manager {user_obj.email}")
    
    # Marquer l'invitation comme acceptée
    await db.gerant_invitations.update_one(
        {"token": invite_data.invitation_token},
        {"$set": {"status": "accepted"}}
    )
    
    # Auto-update Stripe subscription si c'est un vendeur
    if invitation['role'] == 'seller':
        await auto_update_stripe_subscription_quantity(
            invitation['gerant_id'],
            reason=f"seller_registered:{user_obj.id}"
        )
    
    # Créer le token
    token = create_token(user_obj.id, user_obj.email, user_obj.role)
    
    return {
        "token": token,
        "user": {
            "id": user_obj.id,
            "name": user_obj.name,
            "email": user_obj.email,
            "role": user_obj.role,
            "store_id": user_obj.store_id,
            "gerant_id": user_obj.gerant_id
        }
    }


# ============================================
# GERANT STRIPE CHECKOUT ENDPOINTS
# ============================================

@api_router.post("/gerant/stripe/checkout")
async def create_gerant_checkout_session(
    checkout_data: GerantCheckoutRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Créer une session de checkout Stripe pour un gérant.
    Tarification basée sur le nombre de vendeurs actifs :
    - 1-5 vendeurs actifs : 29€/vendeur
    - 6-15 vendeurs actifs : 25€/vendeur  
    - >15 vendeurs : sur devis (erreur)
    """
    if current_user['role'] not in ['gerant', 'gérant']:
        raise HTTPException(status_code=403, detail="Accès réservé aux gérants")
    
    try:
        # Compter les vendeurs ACTIFS uniquement (pas suspendus, pas supprimés)
        active_sellers_count = await db.users.count_documents({
            "gerant_id": current_user['id'],
            "role": "seller", 
            "status": "active"
        })
        
        # Utiliser la quantité fournie ou celle calculée
        quantity = checkout_data.quantity if checkout_data.quantity else active_sellers_count
        quantity = max(quantity, 1)  # Minimum 1 vendeur
        
        # Validation des limites et calcul du prix
        if quantity > 15:
            raise HTTPException(
                status_code=400, 
                detail="Plus de 15 vendeurs nécessite un devis personnalisé. Contactez notre équipe commerciale."
            )
        
        # Logique de tarification
        if 1 <= quantity <= 5:
            price_per_seller = 29.00  # 29€ par vendeur
        elif 6 <= quantity <= 15:
            price_per_seller = 25.00  # 25€ par vendeur
        else:
            raise HTTPException(status_code=400, detail="Quantité invalide")
        
        total_amount = int(price_per_seller * quantity * 100)  # En centimes pour Stripe
        
        import stripe as stripe_lib
        stripe_lib.api_key = STRIPE_API_KEY
        
        # Vérifier si le gérant a déjà un customer ID Stripe
        gerant = await db.users.find_one({"id": current_user['id']}, {"_id": 0})
        stripe_customer_id = gerant.get('stripe_customer_id')
        
        # Créer ou récupérer le client Stripe
        if stripe_customer_id:
            try:
                customer = stripe_lib.Customer.retrieve(stripe_customer_id)
                if customer.get('deleted'):
                    stripe_customer_id = None
                logger.info(f"Réutilisation du client Stripe: {stripe_customer_id}")
            except stripe_lib.error.InvalidRequestError:
                stripe_customer_id = None
                logger.warning(f"Client Stripe {stripe_customer_id} introuvable, création d'un nouveau")
        
        if not stripe_customer_id:
            customer = stripe_lib.Customer.create(
                email=current_user['email'],
                name=current_user['name'],
                metadata={
                    'gerant_id': current_user['id'],
                    'role': 'gerant'
                }
            )
            stripe_customer_id = customer.id
            
            # Mettre à jour l'ID client Stripe dans la base de données
            await db.users.update_one(
                {"id": current_user['id']},
                {"$set": {"stripe_customer_id": stripe_customer_id}}
            )
            logger.info(f"Nouveau client Stripe créé: {stripe_customer_id}")
        
        # URLs de succès et d'annulation
        success_url = f"{checkout_data.origin_url}/dashboard?session_id={{CHECKOUT_SESSION_ID}}"
        cancel_url = f"{checkout_data.origin_url}/dashboard"
        
        # Créer la session de checkout
        session = stripe_lib.checkout.Session.create(
            customer=stripe_customer_id,
            payment_method_types=['card'],
            line_items=[{
                'price_data': {
                    'currency': 'eur',
                    'product_data': {
                        'name': f'Retail Performer AI - {quantity} vendeur(s)',
                        'description': f'Abonnement pour {quantity} vendeur(s) actif(s) - {price_per_seller}€/vendeur/mois'
                    },
                    'unit_amount': int(price_per_seller * 100),  # En centimes
                    'recurring': {
                        'interval': 'month' if checkout_data.billing_period == 'monthly' else 'year'
                    }
                },
                'quantity': quantity,
            }],
            mode='subscription',
            success_url=success_url,
            cancel_url=cancel_url,
            metadata={
                'gerant_id': current_user['id'],
                'seller_quantity': str(quantity),
                'price_per_seller': str(price_per_seller)
            }
        )
        
        logger.info(f"Session de checkout créée {session.id} pour gérant {current_user['name']} avec {quantity} vendeur(s)")
        
        return {
            "checkout_url": session.url,
            "session_id": session.id,
            "quantity": quantity,
            "price_per_seller": price_per_seller,
            "total_monthly": price_per_seller * quantity,
            "active_sellers_count": active_sellers_count
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erreur lors de la création de la session de checkout: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Erreur lors de la création de l'abonnement: {str(e)}")


@api_router.get("/gerant/subscription/status")
async def get_gerant_subscription_status(current_user: dict = Depends(get_current_user)):
    """Obtenir le statut de l'abonnement du gérant"""
    if current_user['role'] not in ['gerant', 'gérant']:
        raise HTTPException(status_code=403, detail="Accès réservé aux gérants")
    
    try:
        # Récupérer les informations du gérant
        gerant = await db.users.find_one({"id": current_user['id']}, {"_id": 0})
        workspace_id = gerant.get('workspace_id')
        
        # PRIORITÉ 1: Vérifier le workspace (pour les essais gratuits sans Stripe)
        if workspace_id:
            workspace = await db.workspaces.find_one({"id": workspace_id}, {"_id": 0})
            if workspace:
                subscription_status = workspace.get('subscription_status')
                
                # Si en période d'essai dans le workspace
                if subscription_status == 'trialing':
                    trial_end = workspace.get('trial_end')
                    if trial_end:
                        if isinstance(trial_end, str):
                            trial_end_dt = datetime.fromisoformat(trial_end.replace('Z', '+00:00'))
                        else:
                            trial_end_dt = trial_end
                        
                        now = datetime.now(timezone.utc)
                        days_left = max(0, (trial_end_dt - now).days)
                        
                        # Compter les vendeurs actifs
                        active_sellers_count = await db.users.count_documents({
                            "gerant_id": current_user['id'],
                            "role": "seller",
                            "status": "active"
                        })
                        
                        # Déterminer le plan en fonction du nombre de vendeurs
                        current_plan = 'starter'
                        max_sellers = 5
                        if active_sellers_count >= 16:
                            current_plan = 'enterprise'
                            max_sellers = None  # Illimité
                        elif active_sellers_count >= 6:
                            current_plan = 'professional'
                            max_sellers = 15
                        
                        return {
                            "has_subscription": True,
                            "status": "trialing",
                            "days_left": days_left,
                            "trial_end": trial_end,
                            "current_plan": current_plan,
                            "used_seats": active_sellers_count,
                            "subscription": {
                                "seats": max_sellers or 999,  # Pour enterprise
                                "billing_interval": "month"
                            },
                            "remaining_seats": (max_sellers - active_sellers_count) if max_sellers else 999,
                            "message": f"Essai gratuit - {days_left} jour{'s' if days_left > 1 else ''} restant{'s' if days_left > 1 else ''}"
                        }
                
                # Si l'essai est terminé
                if subscription_status == 'trial_expired':
                    return {
                        "has_subscription": False,
                        "status": "trial_expired",
                        "message": "Essai gratuit terminé",
                        "active_sellers_count": await db.users.count_documents({
                            "gerant_id": current_user['id'],
                            "role": "seller",
                            "status": "active"
                        })
                    }
        
        # PRIORITÉ 2: Vérifier Stripe (pour les abonnements payants)
        stripe_customer_id = gerant.get('stripe_customer_id')
        
        if not stripe_customer_id:
            # Pas de Stripe ET pas de workspace trialing = nouveau compte sans essai configuré
            return {
                "has_subscription": False,
                "status": "no_subscription", 
                "message": "Aucun abonnement trouvé",
                "active_sellers_count": await db.users.count_documents({
                    "gerant_id": current_user['id'],
                    "role": "seller",
                    "status": "active"
                })
            }
        
        import stripe as stripe_lib
        stripe_lib.api_key = STRIPE_API_KEY
        
        # Récupérer les abonnements actifs
        subscriptions = stripe_lib.Subscription.list(
            customer=stripe_customer_id,
            status='active',
            limit=10
        )
        
        active_subscription = None
        for sub in subscriptions.data:
            if not sub.get('cancel_at_period_end', False):
                active_subscription = sub
                break
        
        if not active_subscription:
            # Vérifier s'il y a des abonnements en période d'essai
            trial_subs = stripe_lib.Subscription.list(
                customer=stripe_customer_id,
                status='trialing',
                limit=1
            )
            if trial_subs.data:
                active_subscription = trial_subs.data[0]
        
        if not active_subscription:
            # Vérifier dans la base de données locale si pas trouvé dans Stripe
            db_subscription = await db.subscriptions.find_one(
                {"user_id": current_user['id'], "status": {"$in": ["active", "trialing"]}},
                {"_id": 0}
            )
            
            if not db_subscription:
                return {
                    "has_subscription": False,
                    "status": "inactive",
                    "message": "Aucun abonnement actif",
                    "active_sellers_count": await db.users.count_documents({
                        "gerant_id": current_user['id'],
                        "role": "seller", 
                        "status": "active"
                    })
                }
            
            # Utiliser l'abonnement de la DB locale
            active_sellers_count = await db.users.count_documents({
                "gerant_id": current_user['id'],
                "role": "seller",
                "status": "active"
            })
            
            # Déterminer le plan basé sur la quantité
            quantity = db_subscription.get('seats', 1)
            current_plan = 'starter'
            if quantity >= 16:
                current_plan = 'enterprise'
            elif quantity >= 6:
                current_plan = 'professional'
            
            # Calculer les jours restants si en période d'essai
            days_left = None
            trial_end = None
            if db_subscription.get('trial_end'):
                trial_end = db_subscription['trial_end']
                now = datetime.now(timezone.utc)
                trial_end_dt = datetime.fromisoformat(trial_end.replace('Z', '+00:00'))
                days_left = max(0, (trial_end_dt - now).days)
            
            status = 'trialing' if db_subscription.get('trial_end') and days_left and days_left > 0 else 'active'
            
            return {
                "has_subscription": True,
                "status": status,
                "plan": current_plan,
                "subscription": {
                    "id": db_subscription.get('stripe_subscription_id'),
                    "seats": quantity,
                    "price_per_seat": 25 if current_plan == 'professional' else 29,  # Prix par défaut
                    "billing_interval": "month",
                    "current_period_start": db_subscription.get('current_period_start'),
                    "current_period_end": db_subscription.get('current_period_end'),
                    "cancel_at_period_end": db_subscription.get('cancel_at_period_end', False),
                    "subscription_item_id": db_subscription.get('stripe_subscription_item_id'),
                    "price_id": None
                },
                "trial_end": trial_end,
                "days_left": days_left,
                "active_sellers_count": active_sellers_count,
                "used_seats": active_sellers_count,
                "remaining_seats": max(0, quantity - active_sellers_count)
            }
        
        # Calculer les informations de l'abonnement
        quantity = 1
        subscription_item_id = None
        price_id = None
        unit_amount = None
        billing_interval = 'month'
        
        if active_subscription.get('items') and active_subscription['items']['data']:
            item_data = active_subscription['items']['data'][0]
            quantity = item_data.get('quantity', 1)
            subscription_item_id = item_data.get('id')
            
            # Récupérer les infos de prix
            if item_data.get('price'):
                price = item_data['price']
                price_id = price.get('id')
                unit_amount = price.get('unit_amount', 0) / 100  # Convertir en euros
                billing_interval = price.get('recurring', {}).get('interval', 'month')
        
        # Compter les vendeurs actifs
        active_sellers_count = await db.users.count_documents({
            "gerant_id": current_user['id'],
            "role": "seller",
            "status": "active"
        })
        
        # Déterminer le plan basé sur la quantité
        current_plan = 'starter'
        if quantity >= 16:
            current_plan = 'enterprise'
        elif quantity >= 6:
            current_plan = 'professional'
        
        # Calculer les jours restants si en période d'essai
        days_left = None
        trial_end = None
        if active_subscription.get('status') == 'trialing' and active_subscription.get('trial_end'):
            trial_end_ts = active_subscription['trial_end']
            trial_end = datetime.fromtimestamp(trial_end_ts, tz=timezone.utc).isoformat()
            now = datetime.now(timezone.utc)
            trial_end_dt = datetime.fromtimestamp(trial_end_ts, tz=timezone.utc)
            days_left = max(0, (trial_end_dt - now).days)
        
        return {
            "has_subscription": True,
            "status": active_subscription.get('status'),
            "plan": current_plan,
            "subscription": {
                "id": active_subscription.id,
                "seats": quantity,
                "price_per_seat": unit_amount,
                "billing_interval": billing_interval,
                "current_period_start": datetime.fromtimestamp(
                    active_subscription.get('current_period_start'), 
                    tz=timezone.utc
                ).isoformat() if active_subscription.get('current_period_start') else None,
                "current_period_end": datetime.fromtimestamp(
                    active_subscription.get('current_period_end'),
                    tz=timezone.utc
                ).isoformat() if active_subscription.get('current_period_end') else None,
                "cancel_at_period_end": active_subscription.get('cancel_at_period_end', False),
                "subscription_item_id": subscription_item_id,
                "price_id": price_id
            },
            "trial_end": trial_end,
            "days_left": days_left,
            "active_sellers_count": active_sellers_count,
            "used_seats": active_sellers_count,
            "remaining_seats": max(0, quantity - active_sellers_count)
        }
        
    except Exception as e:
        logger.error(f"Erreur lors de la récupération du statut d'abonnement: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================
# GERANT SUBSCRIPTION HELPERS
# ============================================

async def get_gerant_subscription_info(gerant_id: str):
    """
    Récupérer les informations complètes d'abonnement d'un gérant
    incluant quotas et limites
    """
    # Compter les vendeurs actifs
    active_sellers_count = await db.users.count_documents({
        "gerant_id": gerant_id,
        "role": "seller", 
        "status": "active"
    })
    
    # Récupérer les infos du gérant
    gerant = await db.users.find_one({"id": gerant_id}, {"_id": 0})
    if not gerant:
        raise HTTPException(status_code=404, detail="Gérant non trouvé")
        
    stripe_customer_id = gerant.get('stripe_customer_id')
    
    # Informations par défaut (pas d'abonnement)
    subscription_info = {
        "has_subscription": False,
        "status": "no_subscription",
        "allowed_sellers": 0,  # Pas de vendeurs autorisés sans abonnement
        "active_sellers_count": active_sellers_count,
        "remaining_slots": 0,
        "price_per_seller": 0,
        "total_monthly": 0,
        "subscription_tier": None,
        "quota_exceeded": active_sellers_count > 0,  # Si pas d'abonnement, toujours en dépassement
        "needs_upgrade": False,
        "can_invite": False
    }
    
    if not stripe_customer_id:
        return subscription_info
    
    try:
        import stripe as stripe_lib
        stripe_lib.api_key = STRIPE_API_KEY
        
        # Récupérer l'abonnement actif
        subscriptions = stripe_lib.Subscription.list(
            customer=stripe_customer_id,
            status='active',
            limit=1
        )
        
        active_subscription = None
        if subscriptions.data:
            active_subscription = subscriptions.data[0]
        else:
            # Vérifier les abonnements en trial
            trial_subs = stripe_lib.Subscription.list(
                customer=stripe_customer_id,
                status='trialing',
                limit=1
            )
            if trial_subs.data:
                active_subscription = trial_subs.data[0]
        
        if active_subscription:
            # Récupérer la quantité de l'abonnement
            allowed_sellers = 1
            if active_subscription.get('items') and active_subscription['items']['data']:
                allowed_sellers = active_subscription['items']['data'][0].get('quantity', 1)
            
            # Déterminer le tier de tarification
            if 1 <= allowed_sellers <= 5:
                subscription_tier = "starter"
                price_per_seller = 29.0
            elif 6 <= allowed_sellers <= 15:
                subscription_tier = "professional" 
                price_per_seller = 25.0
            else:
                subscription_tier = "enterprise"
                price_per_seller = 0  # Sur devis
            
            remaining_slots = allowed_sellers - active_sellers_count
            quota_exceeded = active_sellers_count > allowed_sellers
            
            # Vérifier si une mise à niveau est nécessaire
            needs_upgrade = (
                active_sellers_count > 5 and subscription_tier == "starter"
            ) or (
                active_sellers_count > 15 and subscription_tier == "professional"
            )
            
            subscription_info.update({
                "has_subscription": True,
                "status": active_subscription.get('status'),
                "subscription_id": active_subscription.id,
                "allowed_sellers": allowed_sellers,
                "remaining_slots": remaining_slots,
                "price_per_seller": price_per_seller,
                "total_monthly": price_per_seller * allowed_sellers,
                "subscription_tier": subscription_tier,
                "quota_exceeded": quota_exceeded,
                "needs_upgrade": needs_upgrade,
                "can_invite": remaining_slots > 0 and not needs_upgrade,
                "current_period_start": active_subscription.get('current_period_start'),
                "current_period_end": active_subscription.get('current_period_end'),
                "cancel_at_period_end": active_subscription.get('cancel_at_period_end', False)
            })
    
    except Exception as e:
        logger.error(f"Erreur lors de la récupération des infos d'abonnement: {str(e)}")
        # En cas d'erreur, retourner les infos de base
    
    return subscription_info


@api_router.get("/gerant/subscription/info")
async def get_gerant_subscription_detailed_info(current_user: dict = Depends(get_current_user)):
    """Obtenir les informations détaillées d'abonnement avec quotas"""
    if current_user['role'] not in ['gerant', 'gérant']:
        raise HTTPException(status_code=403, detail="Accès réservé aux gérants")
    
    return await get_gerant_subscription_info(current_user['id'])


@api_router.post("/gerant/subscription/upgrade")
async def upgrade_gerant_subscription(current_user: dict = Depends(get_current_user)):
    """
    Mettre à niveau automatiquement l'abonnement gérant
    (Starter vers Professional quand on dépasse 5 vendeurs)
    """
    if current_user['role'] not in ['gerant', 'gérant']:
        raise HTTPException(status_code=403, detail="Accès réservé aux gérants")
    
    try:
        subscription_info = await get_gerant_subscription_info(current_user['id'])
        
        if not subscription_info['has_subscription']:
            raise HTTPException(status_code=400, detail="Aucun abonnement actif trouvé")
        
        if not subscription_info['needs_upgrade']:
            return {
                "message": "Aucune mise à niveau nécessaire",
                "current_tier": subscription_info['subscription_tier'],
                "active_sellers": subscription_info['active_sellers_count']
            }
        
        import stripe as stripe_lib
        stripe_lib.api_key = STRIPE_API_KEY
        
        # Récupérer l'abonnement
        subscription = stripe_lib.Subscription.retrieve(subscription_info['subscription_id'])
        
        # Calculer la nouvelle quantité et le nouveau prix
        new_quantity = subscription_info['active_sellers_count']
        
        if subscription_info['subscription_tier'] == 'starter' and new_quantity > 5:
            # Passage de Starter (29€) à Professional (25€)
            new_price = 25.00
            new_tier = "professional"
        elif subscription_info['subscription_tier'] == 'professional' and new_quantity > 15:
            raise HTTPException(
                status_code=400,
                detail="Plus de 15 vendeurs nécessite un abonnement sur mesure. Contactez notre équipe commerciale."
            )
        else:
            raise HTTPException(status_code=400, detail="Mise à niveau non applicable")
        
        # Mettre à jour l'abonnement Stripe
        stripe_lib.Subscription.modify(
            subscription_info['subscription_id'],
            items=[{
                'id': subscription['items']['data'][0]['id'],
                'price_data': {
                    'currency': 'eur',
                    'product_data': {
                        'name': f'Retail Performer AI - {new_quantity} vendeur(s)',
                        'description': f'Abonnement {new_tier.capitalize()} - {new_price}€/vendeur/mois'
                    },
                    'unit_amount': int(new_price * 100),
                    'recurring': {'interval': 'month'}
                },
                'quantity': new_quantity,
            }],
            proration_behavior='create_prorations'  # Créer des prorations pour la différence
        )
        
        logger.info(f"Abonnement gérant {current_user['name']} mis à niveau vers {new_tier} avec {new_quantity} vendeurs")
        
        return {
            "message": "Abonnement mis à niveau avec succès",
            "old_tier": subscription_info['subscription_tier'],
            "new_tier": new_tier,
            "old_quantity": subscription_info['allowed_sellers'],
            "new_quantity": new_quantity,
            "new_price_per_seller": new_price,
            "new_total_monthly": new_price * new_quantity
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erreur lors de la mise à niveau d'abonnement: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Erreur lors de la mise à niveau: {str(e)}")


class UpdateSeatsRequest(BaseModel):
    seats: int = Field(..., ge=1, le=15, description="Nombre de sièges (1-15)")


@api_router.post("/gerant/subscription/preview-seats-update")
async def preview_gerant_seats_update(
    request: UpdateSeatsRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Prévisualiser le coût d'un changement de nombre de sièges
    sans effectuer la modification
    """
    if current_user['role'] not in ['gerant', 'gérant']:
        raise HTTPException(status_code=403, detail="Accès réservé aux gérants")
    
    new_seats = request.seats
    
    try:
        import stripe as stripe_lib
        stripe_lib.api_key = STRIPE_API_KEY
        
        # Récupérer les infos du gérant
        gerant = await db.users.find_one({"id": current_user['id']}, {"_id": 0})
        if not gerant or not gerant.get('stripe_customer_id'):
            # Pas d'abonnement encore, calculer juste le coût futur
            price_per_seat = 29.00 if new_seats <= 5 else 25.00
            tier = "starter" if new_seats <= 5 else "professional"
            
            return {
                "preview": True,
                "new_seats": new_seats,
                "current_seats": 0,
                "tier": tier,
                "price_per_seat": price_per_seat,
                "monthly_cost": new_seats * price_per_seat,
                "cost_difference": new_seats * price_per_seat,
                "is_trial": False,
                "proration_amount": 0,
                "message": "Coût mensuel après souscription"
            }
        
        # Récupérer l'abonnement
        subscriptions = stripe_lib.Subscription.list(
            customer=gerant['stripe_customer_id'],
            status='active',
            limit=10
        )
        
        subscription = None
        for sub in subscriptions.data:
            if not sub.get('cancel_at_period_end', False):
                subscription = sub
                break
        
        if not subscription:
            trial_subs = stripe_lib.Subscription.list(
                customer=gerant['stripe_customer_id'],
                status='trialing',
                limit=10
            )
            for sub in trial_subs.data:
                if not sub.get('cancel_at_period_end', False):
                    subscription = sub
                    break
        
        if not subscription:
            # Pas d'abonnement, retourner le coût futur
            price_per_seat = 29.00 if new_seats <= 5 else 25.00
            tier = "starter" if new_seats <= 5 else "professional"
            
            return {
                "preview": True,
                "new_seats": new_seats,
                "current_seats": 0,
                "tier": tier,
                "price_per_seat": price_per_seat,
                "monthly_cost": new_seats * price_per_seat,
                "cost_difference": new_seats * price_per_seat,
                "is_trial": False,
                "proration_amount": 0,
                "message": "Coût mensuel après souscription"
            }
        
        # Récupérer la quantité actuelle
        subscription_item = subscription['items']['data'][0]
        current_seats = subscription_item['quantity']
        
        # Calculer les prix
        current_price_per_seat = 29.00 if current_seats <= 5 else 25.00
        new_price_per_seat = 29.00 if new_seats <= 5 else 25.00
        new_tier = "starter" if new_seats <= 5 else "professional"
        
        old_monthly_cost = current_seats * current_price_per_seat
        new_monthly_cost = new_seats * new_price_per_seat
        cost_difference = new_monthly_cost - old_monthly_cost
        
        # Vérifier si en période d'essai
        is_trial = subscription['status'] == 'trialing'
        
        # Calculer la proratisation si nécessaire
        proration_amount = 0
        proration_message = ""
        
        if not is_trial and new_seats != current_seats:
            # Calculer les jours restants
            current_period_end = datetime.fromtimestamp(subscription['current_period_end'], tz=timezone.utc)
            now = datetime.now(timezone.utc)
            days_remaining = max(0, (current_period_end - now).days)
            days_in_cycle = 30
            
            if new_seats > current_seats:
                # Augmentation : payer le prorata pour les nouveaux sièges
                seats_added = new_seats - current_seats
                proration_amount = (seats_added * new_price_per_seat) * (days_remaining / days_in_cycle)
                proration_message = f"Coût immédiat (proratisé sur {days_remaining} jours restants)"
            else:
                # Diminution : crédit pour le prochain cycle
                seats_removed = current_seats - new_seats
                proration_amount = -(seats_removed * current_price_per_seat) * (days_remaining / days_in_cycle)
                proration_message = f"Crédit appliqué (proratisé sur {days_remaining} jours restants)"
        elif is_trial:
            proration_message = "Aucun coût pendant l'essai - Paiement à la fin de la période"
        
        return {
            "preview": True,
            "new_seats": new_seats,
            "current_seats": current_seats,
            "tier": new_tier,
            "price_per_seat": new_price_per_seat,
            "old_monthly_cost": old_monthly_cost,
            "new_monthly_cost": new_monthly_cost,
            "cost_difference": cost_difference,
            "is_trial": is_trial,
            "proration_amount": round(proration_amount, 2),
            "proration_message": proration_message,
            "days_remaining_in_cycle": (datetime.fromtimestamp(subscription['current_period_end'], tz=timezone.utc) - datetime.now(timezone.utc)).days if subscription else 0,
            "message": "Aperçu du changement de sièges"
        }
        
    except Exception as e:
        logger.error(f"Erreur lors de la prévisualisation: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Erreur: {str(e)}")


@api_router.post("/gerant/subscription/update-seats")
async def update_gerant_subscription_seats(
    request: UpdateSeatsRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Mettre à jour le nombre de sièges de l'abonnement Gérant.
    Pendant l'essai : Mise à jour sans frais
    Abonnement actif : Proratisation appliquée automatiquement
    """
    if current_user['role'] not in ['gerant', 'gérant']:
        raise HTTPException(status_code=403, detail="Accès réservé aux gérants")
    
    new_seats = request.seats
    
    # Validation
    if new_seats > 15:
        raise HTTPException(
            status_code=400,
            detail="Plus de 15 sièges nécessite un devis personnalisé. Contactez notre équipe."
        )
    
    try:
        import stripe as stripe_lib
        stripe_lib.api_key = STRIPE_API_KEY
        
        # Récupérer les infos du gérant
        gerant = await db.users.find_one({"id": current_user['id']}, {"_id": 0})
        if not gerant or not gerant.get('stripe_customer_id'):
            raise HTTPException(status_code=400, detail="Aucun compte Stripe trouvé")
        
        # Récupérer l'abonnement
        subscriptions = stripe_lib.Subscription.list(
            customer=gerant['stripe_customer_id'],
            status='active',
            limit=10
        )
        
        subscription = None
        for sub in subscriptions.data:
            if not sub.get('cancel_at_period_end', False):
                subscription = sub
                break
        
        # Si pas trouvé en actif, chercher en trial
        if not subscription:
            trial_subs = stripe_lib.Subscription.list(
                customer=gerant['stripe_customer_id'],
                status='trialing',
                limit=10
            )
            for sub in trial_subs.data:
                if not sub.get('cancel_at_period_end', False):
                    subscription = sub
                    break
        
        if not subscription:
            raise HTTPException(status_code=400, detail="Aucun abonnement actif trouvé")
        
        # Récupérer la quantité actuelle
        subscription_item = subscription['items']['data'][0]
        current_seats = subscription_item['quantity']
        
        if current_seats == new_seats:
            return {
                "success": True,
                "message": "Le nombre de sièges est déjà à jour",
                "seats": current_seats,
                "no_change": True
            }
        
        # Calculer le nouveau prix par siège selon le palier
        if new_seats <= 5:
            price_per_seat = 29.00
            tier = "starter"
        elif new_seats <= 15:
            price_per_seat = 25.00
            tier = "professional"
        else:
            raise HTTPException(status_code=400, detail="Nombre de sièges invalide")
        
        # Vérifier si en période d'essai
        is_trial = subscription['status'] == 'trialing'
        
        # Calculer le coût estimé
        old_monthly_cost = current_seats * (29 if current_seats <= 5 else 25)
        new_monthly_cost = new_seats * price_per_seat
        cost_difference = new_monthly_cost - old_monthly_cost
        
        # Si augmentation et abonnement actif, calculer la proratisation
        proration_amount = 0
        if not is_trial and new_seats > current_seats:
            # Calculer le nombre de jours restants dans le cycle actuel
            current_period_end = datetime.fromtimestamp(subscription['current_period_end'], tz=timezone.utc)
            now = datetime.now(timezone.utc)
            days_remaining = (current_period_end - now).days
            days_in_cycle = 30  # Approximation
            
            # Coût proraté pour les nouveaux sièges
            seats_difference = new_seats - current_seats
            proration_amount = (seats_difference * price_per_seat) * (days_remaining / days_in_cycle)
        
        # Mettre à jour l'abonnement Stripe
        updated_subscription = stripe_lib.Subscription.modify(
            subscription.id,
            items=[{
                'id': subscription_item.id,
                'quantity': new_seats
            }],
            proration_behavior='create_prorations' if not is_trial else 'none',
            metadata={
                'manual_update': 'true',
                'updated_by': current_user['id'],
                'previous_seats': str(current_seats),
                'new_seats': str(new_seats),
                'tier': tier,
                'updated_at': datetime.now(timezone.utc).isoformat()
            }
        )
        
        logger.info(
            f"✅ Sièges mis à jour manuellement pour gérant {current_user['name']}: "
            f"{current_seats} → {new_seats} sièges (Tier: {tier}, "
            f"Prix: {price_per_seat}€/siège, Essai: {is_trial})"
        )
        
        return {
            "success": True,
            "message": "Nombre de sièges mis à jour avec succès",
            "old_seats": current_seats,
            "new_seats": new_seats,
            "tier": tier,
            "price_per_seat": price_per_seat,
            "old_monthly_cost": old_monthly_cost,
            "new_monthly_cost": new_monthly_cost,
            "cost_difference": cost_difference,
            "is_trial": is_trial,
            "proration_amount": round(proration_amount, 2) if proration_amount > 0 else 0,
            "subscription_id": subscription.id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erreur lors de la mise à jour des sièges: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Erreur: {str(e)}")


# ============================================
# STRIPE WEBHOOKS
# ============================================

STRIPE_WEBHOOK_SECRET = os.environ.get('STRIPE_WEBHOOK_SECRET', '')

@api_router.post("/webhooks/stripe")
async def stripe_webhook_handler(request: Request):
    """
    Endpoint pour recevoir et traiter les webhooks Stripe.
    Gère la synchronisation automatique des abonnements et paiements.
    """
    try:
        import stripe as stripe_lib
        stripe_lib.api_key = STRIPE_API_KEY
        
        # Récupérer le payload et la signature
        payload = await request.body()
        sig_header = request.headers.get('stripe-signature')
        
        # Vérifier la signature du webhook (sécurité)
        try:
            if STRIPE_WEBHOOK_SECRET:
                event = stripe_lib.Webhook.construct_event(
                    payload, sig_header, STRIPE_WEBHOOK_SECRET
                )
            else:
                # Mode dev : accepter sans vérification (à ne pas utiliser en prod)
                event = json.loads(payload)
                logger.warning("⚠️ Webhook Stripe reçu sans vérification de signature (dev mode)")
        except ValueError as e:
            logger.error(f"❌ Payload webhook invalide: {str(e)}")
            raise HTTPException(status_code=400, detail="Invalid payload")
        except stripe_lib.error.SignatureVerificationError as e:
            logger.error(f"❌ Signature webhook invalide: {str(e)}")
            raise HTTPException(status_code=400, detail="Invalid signature")
        
        # Vérifier l'idempotence (éviter de traiter 2x le même événement)
        event_id = event.get('id')
        existing_event = await db.stripe_events.find_one({"event_id": event_id}, {"_id": 0})
        
        if existing_event:
            logger.info(f"✓ Événement webhook {event_id} déjà traité (idempotent)")
            return {"received": True, "status": "already_processed"}
        
        # Logger l'événement
        event_type = event.get('type')
        logger.info(f"📨 Webhook Stripe reçu: {event_type} (ID: {event_id})")
        
        # Stocker l'événement pour idempotence
        await db.stripe_events.insert_one({
            "event_id": event_id,
            "event_type": event_type,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "processed": False,
            "data": event
        })
        
        # Router vers le bon handler
        if event_type == 'customer.subscription.updated':
            await handle_subscription_updated(event)
        elif event_type == 'invoice.paid':
            await handle_invoice_paid(event)
        elif event_type == 'invoice.payment_failed':
            await handle_invoice_payment_failed(event)
        elif event_type == 'customer.subscription.deleted':
            await handle_subscription_deleted(event)
        else:
            logger.info(f"ℹ️ Événement {event_type} non géré (ignoré)")
        
        # Marquer comme traité
        await db.stripe_events.update_one(
            {"event_id": event_id},
            {"$set": {"processed": True, "processed_at": datetime.now(timezone.utc).isoformat()}}
        )
        
        return {"received": True, "status": "processed"}
        
    except Exception as e:
        logger.error(f"❌ Erreur webhook Stripe: {str(e)}")
        # Ne pas renvoyer 500 à Stripe pour éviter les retry infinis
        return {"received": True, "status": "error", "message": str(e)}


async def handle_subscription_updated(event):
    """
    Gérer la mise à jour d'un abonnement Stripe.
    Synchronise les changements (quantité, statut, prix) avec la DB.
    """
    try:
        subscription_data = event['data']['object']
        subscription_id = subscription_data['id']
        customer_id = subscription_data['customer']
        status = subscription_data['status']
        
        # Récupérer le gérant associé
        gerant = await db.users.find_one(
            {"stripe_customer_id": customer_id, "role": "gerant"},
            {"_id": 0}
        )
        
        if not gerant:
            logger.warning(f"⚠️ Gérant non trouvé pour customer {customer_id}")
            return
        
        # Récupérer la quantité et l'item ID
        items = subscription_data.get('items', {}).get('data', [])
        if not items:
            logger.warning(f"⚠️ Pas d'items dans l'abonnement {subscription_id}")
            return
        
        subscription_item = items[0]
        quantity = subscription_item['quantity']
        subscription_item_id = subscription_item['id']
        price_id = subscription_item.get('price', {}).get('id')
        
        # Prix unitaire
        unit_amount = subscription_item.get('price', {}).get('unit_amount', 0) / 100
        
        logger.info(
            f"📊 Mise à jour abonnement: Gérant {gerant['name']} → "
            f"Statut: {status}, Quantité: {quantity}, Prix: {unit_amount}€/siège"
        )
        
        # Mettre à jour ou créer l'abonnement dans notre DB
        await db.subscriptions.update_one(
            {"user_id": gerant['id']},
            {
                "$set": {
                    "stripe_subscription_id": subscription_id,
                    "stripe_customer_id": customer_id,
                    "subscription_item_id": subscription_item_id,
                    "price_id": price_id,
                    "status": status,
                    "seats": quantity,
                    "price_per_seat": unit_amount,
                    "current_period_start": datetime.fromtimestamp(
                        subscription_data['current_period_start'], tz=timezone.utc
                    ).isoformat(),
                    "current_period_end": datetime.fromtimestamp(
                        subscription_data['current_period_end'], tz=timezone.utc
                    ).isoformat(),
                    "trial_end": datetime.fromtimestamp(
                        subscription_data['trial_end'], tz=timezone.utc
                    ).isoformat() if subscription_data.get('trial_end') else None,
                    "cancel_at_period_end": subscription_data.get('cancel_at_period_end', False),
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }
            },
            upsert=True
        )
        
        logger.info(f"✅ Abonnement synchronisé pour gérant {gerant['name']}")
        
    except Exception as e:
        logger.error(f"❌ Erreur handle_subscription_updated: {str(e)}")
        raise


async def handle_invoice_paid(event):
    """
    Gérer une facture payée.
    Enregistre les prorations et confirme les paiements.
    """
    try:
        invoice_data = event['data']['object']
        invoice_id = invoice_data['id']
        customer_id = invoice_data['customer']
        subscription_id = invoice_data.get('subscription')
        amount_paid = invoice_data['amount_paid'] / 100  # Convertir en euros
        
        # Récupérer le gérant
        gerant = await db.users.find_one(
            {"stripe_customer_id": customer_id, "role": "gerant"},
            {"_id": 0}
        )
        
        if not gerant:
            logger.warning(f"⚠️ Gérant non trouvé pour facture {invoice_id}")
            return
        
        # Vérifier si c'est une facture de proration
        lines = invoice_data.get('lines', {}).get('data', [])
        has_proration = any(line.get('proration', False) for line in lines)
        
        logger.info(
            f"💰 Facture payée: {invoice_id} → Gérant {gerant['name']}, "
            f"Montant: {amount_paid}€, Proration: {has_proration}"
        )
        
        # Enregistrer dans la collection des transactions
        await db.payment_transactions.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": gerant['id'],
            "stripe_invoice_id": invoice_id,
            "stripe_subscription_id": subscription_id,
            "amount": amount_paid,
            "currency": invoice_data.get('currency', 'eur'),
            "status": "paid",
            "is_proration": has_proration,
            "invoice_pdf": invoice_data.get('invoice_pdf'),
            "paid_at": datetime.fromtimestamp(
                invoice_data['status_transitions']['paid_at'], tz=timezone.utc
            ).isoformat() if invoice_data.get('status_transitions', {}).get('paid_at') else None,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        
        # Mettre à jour la subscription avec la dernière facture
        if subscription_id:
            await db.subscriptions.update_one(
                {"user_id": gerant['id'], "stripe_subscription_id": subscription_id},
                {
                    "$set": {
                        "last_invoice_id": invoice_id,
                        "last_payment_status": "paid",
                        "last_payment_amount": amount_paid,
                        "last_payment_date": datetime.now(timezone.utc).isoformat()
                    }
                }
            )
        
        logger.info(f"✅ Paiement enregistré pour gérant {gerant['name']}")
        
    except Exception as e:
        logger.error(f"❌ Erreur handle_invoice_paid: {str(e)}")
        raise


async def handle_invoice_payment_failed(event):
    """
    Gérer un échec de paiement.
    Alerte le gérant et suspend potentiellement l'accès.
    """
    try:
        invoice_data = event['data']['object']
        invoice_id = invoice_data['id']
        customer_id = invoice_data['customer']
        subscription_id = invoice_data.get('subscription')
        amount_due = invoice_data['amount_due'] / 100
        
        # Récupérer le gérant
        gerant = await db.users.find_one(
            {"stripe_customer_id": customer_id, "role": "gerant"},
            {"_id": 0}
        )
        
        if not gerant:
            logger.warning(f"⚠️ Gérant non trouvé pour facture échouée {invoice_id}")
            return
        
        logger.warning(
            f"⚠️ PAIEMENT ÉCHOUÉ: Facture {invoice_id} → Gérant {gerant['name']}, "
            f"Montant dû: {amount_due}€"
        )
        
        # Enregistrer l'échec
        await db.payment_transactions.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": gerant['id'],
            "stripe_invoice_id": invoice_id,
            "stripe_subscription_id": subscription_id,
            "amount": amount_due,
            "currency": invoice_data.get('currency', 'eur'),
            "status": "failed",
            "failure_reason": invoice_data.get('last_payment_error', {}).get('message', 'Unknown'),
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        
        # Mettre à jour la subscription
        if subscription_id:
            await db.subscriptions.update_one(
                {"user_id": gerant['id'], "stripe_subscription_id": subscription_id},
                {
                    "$set": {
                        "last_payment_status": "failed",
                        "last_payment_failure_date": datetime.now(timezone.utc).isoformat(),
                        "payment_retry_count": invoice_data.get('attempt_count', 1)
                    }
                }
            )
        
        # TODO: Envoyer un email d'alerte au gérant
        # TODO: Après 3 échecs, suspendre l'accès
        
        logger.info(f"⚠️ Échec de paiement enregistré pour gérant {gerant['name']}")
        
    except Exception as e:
        logger.error(f"❌ Erreur handle_invoice_payment_failed: {str(e)}")
        raise


async def handle_subscription_deleted(event):
    """
    Gérer l'annulation/suppression d'un abonnement.
    """
    try:
        subscription_data = event['data']['object']
        subscription_id = subscription_data['id']
        customer_id = subscription_data['customer']
        
        # Récupérer le gérant
        gerant = await db.users.find_one(
            {"stripe_customer_id": customer_id, "role": "gerant"},
            {"_id": 0}
        )
        
        if not gerant:
            logger.warning(f"⚠️ Gérant non trouvé pour subscription deleted {subscription_id}")
            return
        
        logger.warning(f"🚫 Abonnement supprimé: {subscription_id} → Gérant {gerant['name']}")
        
        # Mettre à jour le statut
        await db.subscriptions.update_one(
            {"user_id": gerant['id'], "stripe_subscription_id": subscription_id},
            {
                "$set": {
                    "status": "canceled",
                    "canceled_at": datetime.now(timezone.utc).isoformat()
                }
            }
        )
        
        logger.info(f"✅ Abonnement marqué comme annulé pour gérant {gerant['name']}")
        
    except Exception as e:
        logger.error(f"❌ Erreur handle_subscription_deleted: {str(e)}")
        raise


# ============================================
# GERANT STORE PERFORMANCE ENDPOINTS
# ============================================

@api_router.get("/gerant/stores/{store_id}/kpi-overview")
async def get_gerant_store_kpi_overview(
    store_id: str,
    date: str = None,
    current_user: dict = Depends(get_current_user)
):
    """Get consolidated store KPI overview for a specific store (Gérant only)"""
    if current_user['role'] not in ['gerant', 'gérant']:
        raise HTTPException(status_code=403, detail="Accès réservé aux gérants")
    
    # Vérifier que le magasin appartient au gérant
    store = await db.stores.find_one(
        {"id": store_id, "gerant_id": current_user['id'], "active": True},
        {"_id": 0}
    )
    if not store:
        raise HTTPException(status_code=404, detail="Magasin non trouvé")
    
    if not date:
        date = datetime.now(timezone.utc).strftime('%Y-%m-%d')
    
    # Get all managers and sellers in this store (for display purposes only)
    managers = await db.users.find({
        "store_id": store_id,
        "role": "manager",
        "status": "active"
    }, {"_id": 0, "id": 1, "name": 1}).to_list(100)
    
    sellers = await db.users.find({
        "store_id": store_id,
        "role": "seller",
        "status": "active"
    }, {"_id": 0, "id": 1, "name": 1}).to_list(100)
    
    # Get ALL KPI entries for this store directly by store_id (not by user_id)
    # This ensures data persistence even if users change
    seller_entries = await db.kpi_entries.find({
        "store_id": store_id,
        "date": date
    }, {"_id": 0}).to_list(100)
    
    # Enrich seller entries with names from current sellers
    for entry in seller_entries:
        seller = next((s for s in sellers if s['id'] == entry.get('seller_id')), None)
        if seller:
            entry['seller_name'] = seller['name']
        else:
            # If seller not found (deleted/changed), show generic name
            entry['seller_name'] = entry.get('seller_name', 'Vendeur (historique)')
    
    # Get manager KPIs for this store (if they exist)
    manager_kpis_list = await db.manager_kpi.find({
        "store_id": store_id,
        "date": date
    }, {"_id": 0}).to_list(100)
    
    # Aggregate totals from managers
    managers_total = {
        "ca_journalier": sum((kpi.get("ca_journalier") or 0) for kpi in manager_kpis_list),
        "nb_ventes": sum((kpi.get("nb_ventes") or 0) for kpi in manager_kpis_list),
        "nb_clients": sum((kpi.get("nb_clients") or 0) for kpi in manager_kpis_list),
        "nb_articles": sum((kpi.get("nb_articles") or 0) for kpi in manager_kpis_list),
        "nb_prospects": sum((kpi.get("nb_prospects") or 0) for kpi in manager_kpis_list)
    }
    
    # Aggregate totals from sellers
    sellers_total = {
        "ca_journalier": sum((entry.get("seller_ca") or entry.get("ca_journalier") or 0) for entry in seller_entries),
        "nb_ventes": sum((entry.get("nb_ventes") or 0) for entry in seller_entries),
        "nb_clients": sum((entry.get("nb_clients") or 0) for entry in seller_entries),
        "nb_articles": sum((entry.get("nb_articles") or 0) for entry in seller_entries),
        "nb_prospects": sum((entry.get("nb_prospects") or 0) for entry in seller_entries),
        "nb_sellers_reported": len(seller_entries)
    }
    
    # Calculate store totals
    total_ca = managers_total["ca_journalier"] + sellers_total["ca_journalier"]
    total_ventes = managers_total["nb_ventes"] + sellers_total["nb_ventes"]
    total_clients = managers_total["nb_clients"] + sellers_total["nb_clients"]
    total_articles = managers_total["nb_articles"] + sellers_total["nb_articles"]
    total_prospects = managers_total["nb_prospects"] + sellers_total["nb_prospects"]
    
    # Calculate derived KPIs
    calculated_kpis = {
        "panier_moyen": round(total_ca / total_ventes, 2) if total_ventes > 0 else None,
        "taux_transformation": round((total_ventes / total_prospects) * 100, 2) if total_prospects > 0 else None,
        "indice_vente": round(total_articles / total_ventes, 2) if total_ventes > 0 else None
    }
    
    return {
        "date": date,
        "store": store,
        "managers_data": managers_total,
        "sellers_data": sellers_total,
        "seller_entries": seller_entries,
        "total_managers": len(managers),
        "total_sellers": len(sellers),
        "sellers_reported": len(seller_entries),
        "calculated_kpis": calculated_kpis,
        "totals": {
            "ca": total_ca,
            "ventes": total_ventes,
            "clients": total_clients,
            "articles": total_articles,
            "prospects": total_prospects
        },
        "kpi_config": {
            "seller_track_ca": True,
            "seller_track_ventes": True,
            "seller_track_clients": True,
            "seller_track_articles": True,
            "seller_track_prospects": True
        }
    }


@api_router.get("/gerant/stores/{store_id}/kpi-history")
async def get_gerant_store_kpi_history(
    store_id: str,
    days: int = 30,
    current_user: dict = Depends(get_current_user)
):
    """Get historical KPI data for a specific store (Gérant only)"""
    if current_user['role'] not in ['gerant', 'gérant']:
        raise HTTPException(status_code=403, detail="Accès réservé aux gérants")
    
    # Vérifier que le magasin appartient au gérant
    store = await db.stores.find_one(
        {"id": store_id, "gerant_id": current_user['id'], "active": True},
        {"_id": 0}
    )
    if not store:
        raise HTTPException(status_code=404, detail="Magasin non trouvé")
    
    # Calculate date range
    end_date = datetime.now(timezone.utc)
    start_date = end_date - timedelta(days=days)
    
    # Get ALL KPI entries for this store directly by store_id
    # This ensures data persistence even if managers/sellers change
    seller_entries = await db.kpi_entries.find({
        "store_id": store_id,
        "date": {"$gte": start_date.strftime('%Y-%m-%d'), "$lte": end_date.strftime('%Y-%m-%d')}
    }, {"_id": 0}).to_list(10000)
    
    # Get manager KPIs for this store (if they exist)
    manager_kpis = await db.manager_kpi.find({
        "store_id": store_id,
        "date": {"$gte": start_date.strftime('%Y-%m-%d'), "$lte": end_date.strftime('%Y-%m-%d')}
    }, {"_id": 0}).to_list(10000)
    
    # Aggregate data by date
    date_map = {}
    
    # Add manager KPIs
    for kpi in manager_kpis:
        date = kpi['date']
        if date not in date_map:
            date_map[date] = {
                "date": date,
                "ca_journalier": 0,
                "nb_ventes": 0,
                "nb_clients": 0,
                "nb_articles": 0,
                "nb_prospects": 0
            }
        date_map[date]["ca_journalier"] += kpi.get("ca_journalier") or 0
        date_map[date]["nb_ventes"] += kpi.get("nb_ventes") or 0
        date_map[date]["nb_clients"] += kpi.get("nb_clients") or 0
        date_map[date]["nb_articles"] += kpi.get("nb_articles") or 0
        date_map[date]["nb_prospects"] += kpi.get("nb_prospects") or 0
    
    # Add seller entries (handle both seller_ca and ca_journalier field names)
    for entry in seller_entries:
        date = entry['date']
        if date not in date_map:
            date_map[date] = {
                "date": date,
                "ca_journalier": 0,
                "nb_ventes": 0,
                "nb_clients": 0,
                "nb_articles": 0,
                "nb_prospects": 0
            }
        # Handle both field names for CA (seller_ca and ca_journalier)
        ca_value = entry.get("seller_ca") or entry.get("ca_journalier") or 0
        date_map[date]["ca_journalier"] += ca_value
        date_map[date]["nb_ventes"] += entry.get("nb_ventes") or 0
        date_map[date]["nb_clients"] += entry.get("nb_clients") or 0
        date_map[date]["nb_articles"] += entry.get("nb_articles") or 0
        date_map[date]["nb_prospects"] += entry.get("nb_prospects") or 0
    
    # Convert to sorted list
    historical_data = sorted(date_map.values(), key=lambda x: x['date'])
    
    return historical_data


@api_router.get("/gerant/stores/{store_id}/available-years")
async def get_store_available_years(
    store_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get available years with KPI data for this store"""
    if current_user['role'] not in ['gerant', 'gérant', 'manager']:
        raise HTTPException(status_code=403, detail="Accès non autorisé")
    
    # Get distinct years from kpi_entries
    kpi_years = await db.kpi_entries.distinct("date", {"store_id": store_id})
    years_set = set()
    for date_str in kpi_years:
        if date_str and len(date_str) >= 4:
            year = int(date_str[:4])
            years_set.add(year)
    
    # Get distinct years from manager_kpi
    manager_years = await db.manager_kpi.distinct("date", {"store_id": store_id})
    for date_str in manager_years:
        if date_str and len(date_str) >= 4:
            year = int(date_str[:4])
            years_set.add(year)
    
    # Sort descending (most recent first)
    years = sorted(list(years_set), reverse=True)
    
    return {"years": years}

# ============================================
# STORE INFO ENDPOINT (For all authenticated users)
# ============================================

@api_router.get("/stores/{store_id}/info")
async def get_store_info(
    store_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get basic store information (accessible by managers and sellers)"""
    # Vérifier que l'utilisateur a accès à ce magasin
    if current_user['role'] in ['gerant', 'gérant']:
        # Gérant peut accéder à tous ses magasins
        store = await db.stores.find_one(
            {"id": store_id, "gerant_id": current_user['id'], "active": True},
            {"_id": 0, "id": 1, "name": 1, "location": 1, "address": 1}
        )
    else:
        # Manager et Seller peuvent accéder uniquement à leur magasin
        if current_user.get('store_id') != store_id:
            raise HTTPException(status_code=403, detail="Accès non autorisé à ce magasin")
        
        store = await db.stores.find_one(
            {"id": store_id, "active": True},
            {"_id": 0, "id": 1, "name": 1, "location": 1, "address": 1}
        )
    
    if not store:
        raise HTTPException(status_code=404, detail="Magasin non trouvé")
    
    return store




# ============================================================================
# API INTEGRATION SYSTEM
# ============================================================================

import secrets
import hashlib

# Pydantic models for API Integration
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

# Generate secure API key
def generate_api_key() -> str:
    """Generate a secure API key with prefix"""
    random_part = secrets.token_urlsafe(32)
    return f"rp_live_{random_part}"

# Middleware: Verify API Key
async def verify_api_key_integration(request: Request):
    """Verify API key from header with rate limiting"""
    api_key = request.headers.get('X-API-Key') or request.headers.get('Authorization', '').replace('Bearer ', '')
    
    if not api_key:
        raise HTTPException(status_code=401, detail="API Key missing. Include X-API-Key header.")
    
    # Check rate limit BEFORE database query (performance)
    if not rate_limiter.is_allowed(api_key):
        remaining = rate_limiter.get_remaining(api_key)
        raise HTTPException(
            status_code=429, 
            detail=f"Rate limit exceeded. Maximum 100 requests per minute. Try again in a few seconds.",
            headers={"Retry-After": "60", "X-RateLimit-Remaining": str(remaining)}
        )
    
    # Find API key in database
    key_record = await db.api_keys.find_one({
        "key": api_key,
        "active": True
    }, {"_id": 0})
    
    if not key_record:
        raise HTTPException(status_code=401, detail="Invalid or inactive API Key")
    
    # Check expiration
    if key_record.get('expires_at'):
        expires_at = datetime.fromisoformat(key_record['expires_at'])
        if datetime.now(timezone.utc) > expires_at:
            raise HTTPException(status_code=401, detail="API Key expired")
    
    # Update last_used_at
    await db.api_keys.update_one(
        {"key": api_key},
        {"$set": {"last_used_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return key_record

# Endpoints: API Keys Management (for authenticated users)

@api_router.post("/manager/api-keys", response_model=APIKeyResponse)
async def create_api_key(
    key_data: APIKeyCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a new API key for integrations"""
    if current_user['role'] not in ['manager', 'gerant', 'gérant']:
        raise HTTPException(status_code=403, detail="Only managers and gerants can create API keys")
    
    # Generate unique key
    api_key = generate_api_key()
    
    # Calculate expiration
    expires_at = None
    if key_data.expires_days:
        expires_at = (datetime.now(timezone.utc) + timedelta(days=key_data.expires_days)).isoformat()
    
    # Create record
    key_id = str(uuid.uuid4())
    key_record = {
        "id": key_id,
        "user_id": current_user['id'],
        "store_id": current_user.get('store_id'),
        "gerant_id": current_user.get('id') if current_user['role'] in ['gerant', 'gérant'] else None,
        "key": api_key,
        "name": key_data.name,
        "permissions": key_data.permissions,
        "store_ids": key_data.store_ids,  # None = all stores
        "active": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "last_used_at": None,
        "expires_at": expires_at
    }
    
    await db.api_keys.insert_one(key_record)
    
    return APIKeyResponse(
        id=key_id,
        name=key_data.name,
        key=api_key,  # Only shown at creation
        permissions=key_data.permissions,
        active=True,
        created_at=key_record["created_at"],
        last_used_at=None,
        expires_at=expires_at,
        store_ids=key_data.store_ids
    )

@api_router.get("/manager/api-keys")
async def list_api_keys(current_user: dict = Depends(get_current_user)):
    """List all API keys for current user"""
    if current_user['role'] not in ['manager', 'gerant', 'gérant']:
        raise HTTPException(status_code=403, detail="Only managers and gerants can list API keys")
    
    # Find keys
    query = {"user_id": current_user['id']}
    keys = await db.api_keys.find(query, {"_id": 0, "key": 0}).to_list(100)  # Don't return the actual key
    
    return {"api_keys": keys}

@api_router.delete("/manager/api-keys/{key_id}")
async def delete_api_key(
    key_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete (deactivate) an API key"""
    if current_user['role'] not in ['manager', 'gerant', 'gérant']:
        raise HTTPException(status_code=403, detail="Only managers and gerants can delete API keys")
    
    # Verify ownership
    key = await db.api_keys.find_one({"id": key_id, "user_id": current_user['id']})
    if not key:
        raise HTTPException(status_code=404, detail="API key not found")
    
    # Deactivate instead of delete (for audit)
    await db.api_keys.update_one(
        {"id": key_id},
        {"$set": {"active": False, "deleted_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"message": "API key deactivated successfully"}

@api_router.post("/manager/api-keys/{key_id}/regenerate", response_model=APIKeyResponse)
async def regenerate_api_key(
    key_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Regenerate an API key (creates new key, deactivates old)"""
    if current_user['role'] not in ['manager', 'gerant', 'gérant']:
        raise HTTPException(status_code=403, detail="Only managers and gerants can regenerate API keys")
    
    # Find old key
    old_key = await db.api_keys.find_one({"id": key_id, "user_id": current_user['id']})
    if not old_key:
        raise HTTPException(status_code=404, detail="API key not found")
    
    # Deactivate old key
    await db.api_keys.update_one(
        {"id": key_id},
        {"$set": {"active": False, "regenerated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    # Create new key with same settings
    new_api_key = generate_api_key()
    new_key_id = str(uuid.uuid4())
    
    new_key_record = {
        "id": new_key_id,
        "user_id": current_user['id'],
        "store_id": old_key.get('store_id'),
        "gerant_id": old_key.get('gerant_id'),
        "key": new_api_key,
        "name": old_key['name'],
        "permissions": old_key['permissions'],
        "store_ids": old_key.get('store_ids'),  # Preserve store access
        "active": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "last_used_at": None,
        "expires_at": old_key.get('expires_at'),
        "previous_key_id": key_id
    }
    
    await db.api_keys.insert_one(new_key_record)
    
    return APIKeyResponse(
        id=new_key_id,
        name=new_key_record["name"],
        key=new_api_key,
        permissions=new_key_record["permissions"],
        active=True,
        created_at=new_key_record["created_at"],
        last_used_at=None,
        expires_at=new_key_record.get("expires_at"),
        store_ids=new_key_record.get("store_ids")
    )

@api_router.delete("/manager/api-keys/{key_id}/permanent")
async def delete_api_key_permanent(
    key_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Permanently delete an inactive API key"""
    if current_user['role'] not in ['manager', 'gerant', 'gérant']:
        raise HTTPException(status_code=403, detail="Only managers and gerants can delete API keys")
    
    # Find the key and verify ownership
    key = await db.api_keys.find_one({"id": key_id}, {"_id": 0})
    
    if not key:
        raise HTTPException(status_code=404, detail="API key not found")
    
    # Verify ownership
    if current_user['role'] == 'manager':
        if key.get('user_id') != current_user['id']:
            raise HTTPException(status_code=403, detail="Not authorized to delete this key")
    elif current_user['role'] in ['gerant', 'gérant']:
        if key.get('gerant_id') != current_user['id']:
            raise HTTPException(status_code=403, detail="Not authorized to delete this key")
    
    # Only allow deletion of inactive keys
    if key.get('active'):
        raise HTTPException(status_code=400, detail="Cannot permanently delete an active key. Deactivate it first.")
    
    # Permanently delete the key
    await db.api_keys.delete_one({"id": key_id})
    
    return {"success": True, "message": "API key permanently deleted"}

# Integration Endpoints (authenticated via API Key)

@api_router.post("/v1/integrations/kpi/sync")
async def sync_kpi_integration(
    data: KPISyncRequest,
    api_key_data: dict = Depends(verify_api_key_integration)
):
    """
    Sync KPI data from external systems (POS, ERP, etc.)
    Requires API Key authentication via X-API-Key header
    """
    # Verify permissions
    if "write:kpi" not in api_key_data.get('permissions', []):
        raise HTTPException(status_code=403, detail="Insufficient permissions. Requires 'write:kpi'")
    
    # Verify store access
    store = await db.stores.find_one({"id": data.store_id, "active": True})
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")
    
    # Verify API key has access to this store
    store_ids = api_key_data.get('store_ids')
    
    # If store_ids is None, it means access to all stores (for gerant)
    if store_ids is not None:
        # Specific stores are defined, check access
        if data.store_id not in store_ids:
            raise HTTPException(status_code=403, detail="API key does not have access to this store")
    else:
        # store_ids is None = all stores access
        # Check if gerant owns this store
        if api_key_data.get('gerant_id'):
            if store.get('gerant_id') != api_key_data['gerant_id']:
                raise HTTPException(status_code=403, detail="API key does not have access to this store")
        elif api_key_data.get('store_id'):
            # Manager's key - check specific store
            if api_key_data['store_id'] != data.store_id:
                raise HTTPException(status_code=403, detail="API key does not have access to this store")
    
    entries_created = 0
    entries_updated = 0
    errors = []
    
    for entry in data.kpi_entries:
        try:
            # Determine if this is for a seller or manager
            if entry.seller_id:
                # Verify seller exists and belongs to store
                seller = await db.users.find_one({
                    "id": entry.seller_id,
                    "role": "seller",
                    "store_id": data.store_id
                })
                if not seller:
                    errors.append(f"Seller {entry.seller_id} not found in store {data.store_id}")
                    continue
                
                # Check if entry already exists
                existing = await db.kpi_entries.find_one({
                    "seller_id": entry.seller_id,
                    "date": data.date,
                    "source": data.source
                })
                
                if existing:
                    # Update existing entry
                    await db.kpi_entries.update_one(
                        {"seller_id": entry.seller_id, "date": data.date, "source": data.source},
                        {"$set": {
                            "ca_journalier": entry.ca_journalier,
                            "nb_ventes": entry.nb_ventes,
                            "nb_articles": entry.nb_articles,
                            "updated_at": datetime.now(timezone.utc).isoformat()
                        }}
                    )
                    entries_updated += 1
                else:
                    # Create new entry
                    kpi_entry = {
                        "id": str(uuid.uuid4()),
                        "seller_id": entry.seller_id,
                        "store_id": data.store_id,
                        "date": data.date,
                        "ca_journalier": entry.ca_journalier,
                        "nb_ventes": entry.nb_ventes,
                        "nb_articles": entry.nb_articles,
                        "source": data.source,
                        "created_at": entry.timestamp or datetime.now(timezone.utc).isoformat()
                    }
                    await db.kpi_entries.insert_one(kpi_entry)
                    entries_created += 1
                    
            elif entry.manager_id:
                # Similar logic for manager KPIs
                manager = await db.users.find_one({
                    "id": entry.manager_id,
                    "role": "manager",
                    "store_id": data.store_id
                })
                if not manager:
                    errors.append(f"Manager {entry.manager_id} not found in store {data.store_id}")
                    continue
                
                existing = await db.manager_kpis.find_one({
                    "manager_id": entry.manager_id,
                    "date": data.date,
                    "source": data.source
                })
                
                if existing:
                    await db.manager_kpis.update_one(
                        {"manager_id": entry.manager_id, "date": data.date, "source": data.source},
                        {"$set": {
                            "ca_journalier": entry.ca_journalier,
                            "nb_ventes": entry.nb_ventes,
                            "prospects": entry.prospects or 0,
                            "updated_at": datetime.now(timezone.utc).isoformat()
                        }}
                    )
                    entries_updated += 1
                else:
                    manager_kpi = {
                        "id": str(uuid.uuid4()),
                        "manager_id": entry.manager_id,
                        "store_id": data.store_id,
                        "date": data.date,
                        "ca_journalier": entry.ca_journalier,
                        "nb_ventes": entry.nb_ventes,
                        "prospects": entry.prospects or 0,
                        "source": data.source,
                        "created_at": entry.timestamp or datetime.now(timezone.utc).isoformat()
                    }
                    await db.manager_kpis.insert_one(manager_kpi)
                    entries_created += 1
            else:
                errors.append("Entry must have either seller_id or manager_id")
                
        except Exception as e:
            errors.append(f"Error processing entry: {str(e)}")
    
    return {
        "status": "success" if entries_created + entries_updated > 0 else "partial_success",
        "entries_created": entries_created,
        "entries_updated": entries_updated,
        "errors": errors if errors else None,
        "message": f"Synchronized {entries_created + entries_updated} KPI entries"
    }

@api_router.get("/v1/integrations/stats")
async def get_integration_stats(
    store_id: str,
    start_date: str,
    end_date: str,
    api_key_data: dict = Depends(verify_api_key_integration)
):
    """
    Get store statistics for a date range
    Requires API Key with 'read:stats' permission
    """
    # Verify permissions
    if "read:stats" not in api_key_data.get('permissions', []):
        raise HTTPException(status_code=403, detail="Insufficient permissions. Requires 'read:stats'")
    
    # Verify store access
    store = await db.stores.find_one({"id": store_id, "active": True}, {"_id": 0})
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")
    
    # Aggregate KPI data
    pipeline = [
        {
            "$match": {
                "store_id": store_id,
                "date": {"$gte": start_date, "$lte": end_date}
            }
        },
        {
            "$group": {
                "_id": None,
                "total_ca": {"$sum": {"$ifNull": ["$seller_ca", {"$ifNull": ["$ca_journalier", 0]}]}},
                "total_ventes": {"$sum": {"$ifNull": ["$nb_ventes", 0]}},
                "total_articles": {"$sum": {"$ifNull": ["$nb_articles", 0]}}
            }
        }
    ]
    
    seller_stats = await db.kpi_entries.aggregate(pipeline).to_list(1)
    manager_stats = await db.manager_kpis.aggregate(pipeline).to_list(1)
    
    total_ca = (seller_stats[0].get("total_ca", 0) if seller_stats else 0) + \
               (manager_stats[0].get("total_ca", 0) if manager_stats else 0)
    total_ventes = (seller_stats[0].get("total_ventes", 0) if seller_stats else 0) + \
                   (manager_stats[0].get("total_ventes", 0) if manager_stats else 0)
    total_articles = (seller_stats[0].get("total_articles", 0) if seller_stats else 0) + \
                     (manager_stats[0].get("total_articles", 0) if manager_stats else 0)
    
    avg_basket = total_ca / total_ventes if total_ventes > 0 else 0
    
    return {
        "store_id": store_id,
        "store_name": store.get("name"),
        "period": {
            "start": start_date,
            "end": end_date
        },
        "metrics": {
            "total_ca": round(total_ca, 2),
            "total_ventes": total_ventes,
            "total_articles": total_articles,
            "average_basket": round(avg_basket, 2)
        }
    }


@api_router.get("/v1/integrations/my-stats")
async def get_my_integration_stats(
    start_date: str,
    end_date: str,
    api_key_data: dict = Depends(verify_api_key_integration)
):
    """
    Get statistics for all stores authorized by the API key
    Simplified endpoint - no store_id required
    Requires API Key with 'read:stats' permission
    """
    # Verify permissions
    if "read:stats" not in api_key_data.get('permissions', []):
        raise HTTPException(status_code=403, detail="Insufficient permissions. Requires 'read:stats'")
    
    # Determine which stores this API key has access to
    store_ids = api_key_data.get('store_ids')
    
    # Get all accessible stores
    if store_ids is None:
        # Access to all stores for this gerant
        gerant_id = api_key_data.get('gerant_id')
        if gerant_id:
            stores = await db.stores.find({"gerant_id": gerant_id, "active": True}, {"_id": 0}).to_list(100)
        else:
            # Manager with single store
            store_id = api_key_data.get('store_id')
            if store_id:
                stores = await db.stores.find({"id": store_id, "active": True}, {"_id": 0}).to_list(1)
            else:
                raise HTTPException(status_code=403, detail="API key has no store access defined")
    else:
        # Specific stores
        stores = await db.stores.find({"id": {"$in": store_ids}, "active": True}, {"_id": 0}).to_list(100)
    
    if not stores:
        raise HTTPException(status_code=404, detail="No accessible stores found")
    
    # Collect stats for each store
    stores_stats = []
    total_ca_all = 0
    total_ventes_all = 0
    total_articles_all = 0
    
    for store in stores:
        store_id = store['id']
        
        # Aggregate KPI data for this store
        pipeline = [
            {
                "$match": {
                    "store_id": store_id,
                    "date": {"$gte": start_date, "$lte": end_date}
                }
            },
            {
                "$group": {
                    "_id": None,
                    "total_ca": {"$sum": {"$ifNull": ["$seller_ca", {"$ifNull": ["$ca_journalier", 0]}]}},
                    "total_ventes": {"$sum": {"$ifNull": ["$nb_ventes", 0]}},
                    "total_articles": {"$sum": {"$ifNull": ["$nb_articles", 0]}}
                }
            }
        ]
        
        seller_stats = await db.kpi_entries.aggregate(pipeline).to_list(1)
        manager_stats = await db.manager_kpis.aggregate(pipeline).to_list(1)
        
        total_ca = (seller_stats[0].get("total_ca", 0) if seller_stats else 0) + \
                   (manager_stats[0].get("total_ca", 0) if manager_stats else 0)
        total_ventes = (seller_stats[0].get("total_ventes", 0) if seller_stats else 0) + \
                       (manager_stats[0].get("total_ventes", 0) if manager_stats else 0)
        total_articles = (seller_stats[0].get("total_articles", 0) if seller_stats else 0) + \
                         (manager_stats[0].get("total_articles", 0) if manager_stats else 0)
        
        avg_basket = total_ca / total_ventes if total_ventes > 0 else 0
        
        stores_stats.append({
            "store_id": store_id,
            "store_name": store.get("name"),
            "metrics": {
                "total_ca": round(total_ca, 2),
                "total_ventes": total_ventes,
                "total_articles": total_articles,
                "average_basket": round(avg_basket, 2)
            }
        })
        
        # Aggregate totals
        total_ca_all += total_ca
        total_ventes_all += total_ventes
        total_articles_all += total_articles
    
    avg_basket_all = total_ca_all / total_ventes_all if total_ventes_all > 0 else 0
    
    return {
        "period": {
            "start": start_date,
            "end": end_date
        },
        "stores": stores_stats,
        "total_all_stores": {
            "total_ca": round(total_ca_all, 2),
            "total_ventes": total_ventes_all,
            "total_articles": total_articles_all,
            "average_basket": round(avg_basket_all, 2)
        }
    }


@api_router.get("/v1/integrations/my-stores")
async def get_my_integration_stores(
    api_key_data: dict = Depends(verify_api_key_integration)
):
    """
    Get list of stores and their sellers accessible by the API key
    Useful for mapping external data to internal IDs
    Requires API Key with 'read:stats' permission
    """
    # Verify permissions
    if "read:stats" not in api_key_data.get('permissions', []):
        raise HTTPException(status_code=403, detail="Insufficient permissions. Requires 'read:stats'")
    
    # Determine which stores this API key has access to
    store_ids = api_key_data.get('store_ids')
    
    # Get all accessible stores
    if store_ids is None:
        # Access to all stores for this gerant
        gerant_id = api_key_data.get('gerant_id')
        if gerant_id:
            stores = await db.stores.find({"gerant_id": gerant_id, "active": True}, {"_id": 0}).to_list(100)
        else:
            # Manager with single store
            store_id = api_key_data.get('store_id')
            if store_id:
                stores = await db.stores.find({"id": store_id, "active": True}, {"_id": 0}).to_list(1)
            else:
                raise HTTPException(status_code=403, detail="API key has no store access defined")
    else:
        # Specific stores
        stores = await db.stores.find({"id": {"$in": store_ids}, "active": True}, {"_id": 0}).to_list(100)
    
    if not stores:
        raise HTTPException(status_code=404, detail="No accessible stores found")
    
    # For each store, get the list of sellers
    stores_with_sellers = []
    for store in stores:
        store_id = store['id']
        
        # Get all active sellers in this store
        sellers = await db.users.find(
            {
                "store_id": store_id,
                "role": "seller",
                "status": "active"
            },
            {"_id": 0, "password": 0}
        ).to_list(100)
        
        # Get all active managers in this store
        managers = await db.users.find(
            {
                "store_id": store_id,
                "role": "manager",
                "status": "active"
            },
            {"_id": 0, "password": 0}
        ).to_list(100)
        
        # Simplify seller data for API response
        sellers_list = [
            {
                "id": seller['id'],
                "name": seller['name'],
                "email": seller['email']
            }
            for seller in sellers
        ]
        
        # Simplify manager data for API response
        managers_list = [
            {
                "id": manager['id'],
                "name": manager['name'],
                "email": manager['email']
            }
            for manager in managers
        ]
        
        stores_with_sellers.append({
            "store_id": store['id'],
            "store_name": store['name'],
            "store_address": store.get('address'),
            "managers_count": len(managers_list),
            "managers": managers_list,
            "sellers_count": len(sellers_list),
            "sellers": sellers_list
        })
    
    return {
        "stores": stores_with_sellers,
        "total_stores": len(stores_with_sellers),
        "total_managers": sum(s['managers_count'] for s in stores_with_sellers),
        "total_sellers": sum(s['sellers_count'] for s in stores_with_sellers)
    }

# ============================================================================
# TEMPORARY ADMIN CREATION ENDPOINT (SECURE)
# ============================================================================

class CreateAdminRequest(BaseModel):
    secret_token: str
    email: EmailStr
    password: str
    name: str

@api_router.post("/auth/create-super-admin")
async def create_super_admin(request: CreateAdminRequest):
    """
    Endpoint temporaire et sécurisé pour créer un compte super_admin
    Utilisez un token secret pour l'authentification
    """
    # Vérifier le token secret
    expected_token = os.environ.get('ADMIN_CREATION_SECRET', 'CHANGE_ME_IN_PRODUCTION')
    if request.secret_token != expected_token:
        raise HTTPException(status_code=403, detail="Token secret invalide")
    
    # Vérifier si l'utilisateur existe déjà
    existing_user = await db.users.find_one({"email": request.email}, {"_id": 0})
    if existing_user:
        raise HTTPException(status_code=400, detail="Un utilisateur avec cet email existe déjà")
    
    # Créer le super_admin
    user_id = str(uuid.uuid4())
    hashed_pw = hash_password(request.password)
    
    user_doc = {
        "id": user_id,
        "email": request.email,
        "password": hashed_pw,
        "name": request.name,
        "role": "super_admin",
        "workspace_id": None,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.users.insert_one(user_doc)
    
    # Créer un token pour la connexion automatique
    token = create_token(user_id, request.email, "super_admin")
    
    logger.info(f"Super admin created: {request.email}")
    
    return {
        "message": "Super admin créé avec succès",
        "user": {
            "id": user_id,
            "email": request.email,
            "name": request.name,
            "role": "super_admin"
        },
        "token": token
    }

class SeedDatabaseRequest(BaseModel):
    secret_token: str

@api_router.post("/auth/seed-database")
async def seed_database(request: SeedDatabaseRequest):
    """
    Endpoint pour initialiser la base de données avec des comptes de test pour tous les rôles
    Protégé par token secret
    """
    # Vérifier le token secret
    expected_token = os.environ.get('ADMIN_CREATION_SECRET', 'CHANGE_ME_IN_PRODUCTION')
    if request.secret_token != expected_token:
        raise HTTPException(status_code=403, detail="Token secret invalide")
    
    created_accounts = []
    
    # Mot de passe par défaut pour tous les comptes
    default_password = "TestPassword123!"
    hashed_pw = hash_password(default_password)
    
    # 1. Créer un Super Admin
    superadmin_id = str(uuid.uuid4())
    superadmin_email = "admin@retail-coach.fr"
    existing = await db.users.find_one({"email": superadmin_email})
    if not existing:
        await db.users.insert_one({
            "id": superadmin_id,
            "email": superadmin_email,
            "password": hashed_pw,
            "name": "Super Administrateur",
            "role": "super_admin",
            "workspace_id": None,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        created_accounts.append({"email": superadmin_email, "role": "super_admin", "password": default_password})
        logger.info(f"Super admin created: {superadmin_email}")
    
    # 2. Créer un Gérant avec workspace
    gerant_id = str(uuid.uuid4())
    gerant_workspace_id = str(uuid.uuid4())
    gerant_email = "gerant@retail-coach.fr"
    existing = await db.users.find_one({"email": gerant_email})
    if not existing:
        # Créer le workspace
        trial_start = datetime.now(timezone.utc)
        trial_end = trial_start + timedelta(days=TRIAL_DAYS)
        await db.workspaces.insert_one({
            "id": gerant_workspace_id,
            "name": "Entreprise Demo",
            "owner_id": gerant_id,
            "subscription_status": "trialing",
            "trial_start": trial_start.isoformat(),
            "trial_end": trial_end.isoformat(),
            "ai_credits_remaining": TRIAL_AI_CREDITS,
            "ai_credits_used_this_month": 0,
            "last_credit_reset": trial_start.isoformat(),
            "created_at": trial_start.isoformat(),
            "updated_at": trial_start.isoformat()
        })
        
        # Créer le gérant
        await db.users.insert_one({
            "id": gerant_id,
            "email": gerant_email,
            "password": hashed_pw,
            "name": "Gérant Demo",
            "role": "gérant",
            "workspace_id": gerant_workspace_id,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        created_accounts.append({"email": gerant_email, "role": "gérant", "password": default_password, "workspace": "Entreprise Demo"})
        logger.info(f"Gérant created: {gerant_email}")
    
    # 3. Créer un IT Admin avec compte enterprise
    itadmin_id = str(uuid.uuid4())
    enterprise_account_id = str(uuid.uuid4())
    itadmin_email = "itadmin@retail-coach.fr"
    existing = await db.users.find_one({"email": itadmin_email})
    if not existing:
        # Créer le compte enterprise
        await db.enterprise_accounts.insert_one({
            "id": enterprise_account_id,
            "name": "Enterprise Demo",
            "owner_id": itadmin_id,
            "sync_mode": "manual",
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        
        # Créer l'IT Admin
        await db.users.insert_one({
            "id": itadmin_id,
            "email": itadmin_email,
            "password": hashed_pw,
            "name": "IT Admin Demo",
            "role": "it_admin",
            "enterprise_account_id": enterprise_account_id,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        created_accounts.append({"email": itadmin_email, "role": "it_admin", "password": default_password, "enterprise": "Enterprise Demo"})
        logger.info(f"IT Admin created: {itadmin_email}")
    
    # 4. Créer un Manager avec store
    manager_id = str(uuid.uuid4())
    manager_workspace_id = str(uuid.uuid4())
    store_id = str(uuid.uuid4())
    manager_email = "manager@retail-coach.fr"
    existing = await db.users.find_one({"email": manager_email})
    if not existing:
        # Créer le workspace
        trial_start = datetime.now(timezone.utc)
        trial_end = trial_start + timedelta(days=TRIAL_DAYS)
        await db.workspaces.insert_one({
            "id": manager_workspace_id,
            "name": "Magasin Demo",
            "owner_id": manager_id,
            "subscription_status": "trialing",
            "trial_start": trial_start.isoformat(),
            "trial_end": trial_end.isoformat(),
            "ai_credits_remaining": TRIAL_AI_CREDITS,
            "ai_credits_used_this_month": 0,
            "last_credit_reset": trial_start.isoformat(),
            "created_at": trial_start.isoformat(),
            "updated_at": trial_start.isoformat()
        })
        
        # Créer le manager
        await db.users.insert_one({
            "id": manager_id,
            "email": manager_email,
            "password": hashed_pw,
            "name": "Manager Demo",
            "role": "manager",
            "workspace_id": manager_workspace_id,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        
        # Créer le store
        await db.stores.insert_one({
            "id": store_id,
            "name": "Boutique Paris Centre",
            "manager_id": manager_id,
            "workspace_id": manager_workspace_id,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        
        created_accounts.append({"email": manager_email, "role": "manager", "password": default_password, "store": "Boutique Paris Centre"})
        logger.info(f"Manager created: {manager_email}")
    
    # 5. Créer un Vendeur attaché au manager
    seller_id = str(uuid.uuid4())
    seller_email = "vendeur@retail-coach.fr"
    existing = await db.users.find_one({"email": seller_email})
    if not existing:
        await db.users.insert_one({
            "id": seller_id,
            "email": seller_email,
            "password": hashed_pw,
            "name": "Vendeur Demo",
            "role": "seller",
            "manager_id": manager_id,
            "workspace_id": manager_workspace_id,
            "store_id": store_id,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        created_accounts.append({"email": seller_email, "role": "seller", "password": default_password, "manager": "manager@retail-coach.fr"})
        logger.info(f"Seller created: {seller_email}")
    
    return {
        "message": f"Base de données initialisée avec succès ! {len(created_accounts)} comptes créés.",
        "accounts": created_accounts,
        "instructions": "Utilisez ces identifiants pour vous connecter. Mot de passe par défaut: TestPassword123!"
    }

# Initialize enterprise router with dependencies
init_enterprise_router(db, rate_limiter, get_current_user)

# Include routers
app.include_router(api_router)
app.include_router(enterprise_router)

# ============================================================================
# AUDIT LOGGING HELPER
# ============================================================================

async def log_admin_action(
    admin: dict,
    action: str,
    details: dict = None,
    workspace_id: str = None
):
    """
    Centralized admin audit logging
    Logs all administrative actions for compliance and security
    """
    try:
        log_entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "admin_id": admin.get('id'),
            "admin_email": admin.get('email'),
            "admin_name": admin.get('name'),
            "action": action,
            "workspace_id": workspace_id,
            "details": details or {}
        }
        await db.admin_logs.insert_one(log_entry)
        logger.info(f"Admin action logged: {action} by {admin.get('email')}")
    except Exception as e:
        # Don't let logging errors break the app
        logger.error(f"Failed to log admin action: {str(e)}")

# ============================================================================
# SYSTEM LOGGING MIDDLEWARE
# ============================================================================

async def log_system_event(
    level: str,
    log_type: str,
    message: str,
    endpoint: str = None,
    user_id: str = None,
    http_code: int = None,
    stack_trace: str = None,
    details: dict = None
):
    """Log system event to database"""
    try:
        log_entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": level,  # error, warning, info
            "type": log_type,  # backend, frontend, database, api
            "message": message,
            "endpoint": endpoint,
            "user_id": user_id,
            "http_code": http_code,
            "stack_trace": stack_trace,
            "details": details or {}
        }
        await db.system_logs.insert_one(log_entry)
    except Exception as e:
        # Don't let logging errors break the app
        logger.error(f"Failed to log system event: {str(e)}")

@app.middleware("http")
async def logging_and_security_middleware(request: Request, call_next):
    """Combined middleware for logging and security headers"""
    start_time = time.time()
    
    # Get user info from token if available
    user_id = None
    try:
        token = request.headers.get('Authorization', '').replace('Bearer ', '')
        if token:
            payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
            user_id = payload.get('user_id')
    except:
        pass
    
    try:
        response = await call_next(request)
        
        # Calculate response time
        process_time = time.time() - start_time
        
        # Add security headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["X-Response-Time"] = str(process_time)
        
        # Log warnings and errors
        if response.status_code >= 500:
            await log_system_event(
                level="error",
                log_type="backend",
                message=f"Server error on {request.method} {request.url.path}",
                endpoint=str(request.url.path),
                user_id=user_id,
                http_code=response.status_code,
                details={"method": request.method, "response_time": process_time}
            )
        elif response.status_code == 429:
            await log_system_event(
                level="warning",
                log_type="api",
                message=f"Rate limit exceeded on {request.url.path}",
                endpoint=str(request.url.path),
                user_id=user_id,
                http_code=429,
                details={"method": request.method}
            )
        elif response.status_code in [401, 403]:
            await log_system_event(
                level="warning",
                log_type="api",
                message=f"Access denied on {request.method} {request.url.path}",
                endpoint=str(request.url.path),
                user_id=user_id,
                http_code=response.status_code,
                details={"method": request.method}
            )
        
        return response
        
    except Exception as e:
        # Log unhandled exceptions
        await log_system_event(
            level="error",
            log_type="backend",
            message=f"Unhandled exception: {str(e)}",
            endpoint=str(request.url.path),
            user_id=user_id,
            http_code=500,
            stack_trace=str(e),
            details={"method": request.method}
        )
        raise

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

