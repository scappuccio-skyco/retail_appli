from fastapi import FastAPI, APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta, date
import bcrypt
import jwt
from emergentintegrations.llm.chat import LlmChat, UserMessage
from emergentintegrations.payments.stripe.checkout import StripeCheckout, CheckoutSessionResponse, CheckoutStatusResponse, CheckoutSessionRequest
import asyncio
import json
from fastapi import Request

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Configuration
JWT_SECRET = os.environ.get('JWT_SECRET', 'your-secret-key')
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
    gerant_id: str  # ID du gérant propriétaire
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
    email: EmailStr
    role: str  # "manager" ou "seller"
    store_id: str
    manager_id: Optional[str] = None  # Requis si role == "seller" (peut être pending_xxx)
    manager_email: Optional[str] = None  # Email du manager si en attente

class RegisterWithGerantInvite(BaseModel):
    """Modèle pour s'enregistrer avec une invitation Gérant"""
    name: str
    email: EmailStr
    password: str
    invitation_token: str

# ============================================
# USER MODELS (Modified for Multi-Store)
# ============================================

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    email: EmailStr
    role: str  # "gerant" | "manager" | "seller"
    status: str = "active"  # active, inactive, deleted
    
    # Hiérarchie Multi-Store
    gerant_id: Optional[str] = None  # null si role = gerant
    store_id: Optional[str] = None   # ID du magasin d'affectation
    manager_id: Optional[str] = None # null si role != seller
    
    # Double rôle pour gérant qui est aussi manager
    is_also_manager: bool = False
    managed_store_id: Optional[str] = None  # ID du magasin qu'il manage directement
    
    # Legacy (à garder pour compatibilité)
    workspace_id: Optional[str] = None  # ID du workspace (entreprise)
    deactivated_at: Optional[datetime] = None  # Date de désactivation
    deleted_at: Optional[datetime] = None  # Date de suppression
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: str
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
    
    # Force role to 'manager' for public registration (sellers are invited)
    user_data.role = "manager"
    
    # Vérifier que le nom d'entreprise est fourni pour les managers
    if user_data.role == "manager" and not user_data.workspace_name:
        raise HTTPException(status_code=400, detail="Le nom de l'entreprise est requis")
    
    # Vérifier que le nom d'entreprise n'existe pas déjà
    if user_data.workspace_name:
        existing_workspace = await db.workspaces.find_one({
            "name": {"$regex": f"^{user_data.workspace_name}$", "$options": "i"}
        }, {"_id": 0})
        if existing_workspace:
            raise HTTPException(status_code=400, detail="Ce nom d'entreprise est déjà utilisé")
    
    workspace_id = None
    
    # Créer le workspace pour les managers
    if user_data.role == "manager":
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

# ===== INVITATION ROUTES =====
@api_router.post("/manager/invite", response_model=Invitation)
async def create_invitation(invite_data: InvitationCreate, current_user: dict = Depends(get_current_user)):
    if current_user['role'] != 'manager':
        raise HTTPException(status_code=403, detail="Only managers can send invitations")
    
    # Check subscription access
    access_info = await check_subscription_access(current_user['id'])
    if not access_info['has_access']:
        raise HTTPException(
            status_code=403, 
            detail=f"Abonnement requis pour inviter des vendeurs. {access_info.get('message', '')}"
        )
    
    # Check seller limit
    seller_check = await check_can_add_seller(current_user['id'])
    if not seller_check['can_add']:
        raise HTTPException(
            status_code=400, 
            detail=f"Limite atteinte : vous avez {seller_check['current']} vendeur(s) sur un maximum de {seller_check['max']} pour votre plan"
        )
    
    # Check if user with this email already exists
    existing_user = await db.users.find_one({"email": invite_data.email}, {"_id": 0})
    if existing_user:
        raise HTTPException(status_code=400, detail="User with this email already exists")
    
    # Check if there's already a pending invitation
    existing_invite = await db.invitations.find_one({
        "email": invite_data.email,
        "manager_id": current_user['id'],
        "status": "pending"
    }, {"_id": 0})
    
    if existing_invite:
        raise HTTPException(status_code=400, detail="Invitation already sent to this email")
    
    # Create invitation
    invitation = Invitation(
        email=invite_data.email,
        manager_id=current_user['id'],
        manager_name=current_user['name']
    )
    
    doc = invitation.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    doc['expires_at'] = doc['expires_at'].isoformat()
    
    await db.invitations.insert_one(doc)
    
    return invitation

@api_router.get("/manager/invitations")
async def get_invitations(current_user: dict = Depends(get_current_user)):
    if current_user['role'] != 'manager':
        raise HTTPException(status_code=403, detail="Only managers can view invitations")
    
    invitations = await db.invitations.find({"manager_id": current_user['id']}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    
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
async def get_sellers(current_user: dict = Depends(get_current_user)):
    if current_user['role'] != 'manager':
        raise HTTPException(status_code=403, detail="Only managers can access this")
    
    # Priority: store_id > workspace_id > manager_id
    # A manager manages a store, so sellers in that store belong to this manager
    # This allows for manager changes without losing seller data
    if current_user.get('store_id'):
        # Use store_id for filtering (most reliable for multi-store architecture)
        filter_query = {
            "store_id": current_user['store_id'],
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
async def get_my_manager_diagnostic(current_user: dict = Depends(get_current_user)):
    if current_user['role'] != 'manager':
        raise HTTPException(status_code=403, detail="Only managers can access their diagnostic")
    
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
async def check_kpi_enabled(current_user: dict = Depends(get_current_user)):
    if current_user['role'] != 'seller':
        raise HTTPException(status_code=403, detail="Only sellers can access this endpoint")
    
    if not current_user.get('manager_id'):
        return {"enabled": False, "seller_input_kpis": SELLER_INPUT_KPIS}
    
    config = await db.kpi_configs.find_one({"manager_id": current_user['manager_id']}, {"_id": 0})
    
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
            api_key="sk-emergent-dB388Be0647671cF21",
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
            api_key="sk-emergent-dB388Be0647671cF21",
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
async def get_kpi_config(current_user: dict = Depends(get_current_user)):
    if current_user['role'] != 'manager':
        raise HTTPException(status_code=403, detail="Only managers can access KPI config")
    
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
async def get_store_kpi_stats(current_user: dict = Depends(get_current_user)):
    """Get store KPI stats with transformation rate"""
    if current_user['role'] != 'manager':
        raise HTTPException(status_code=403, detail="Only managers can access store KPI stats")
    
    today = datetime.now().strftime('%Y-%m-%d')
    
    # Get week dates
    today_date = datetime.now()
    week_start = (today_date - timedelta(days=today_date.weekday())).strftime('%Y-%m-%d')
    week_end = today_date.strftime('%Y-%m-%d')
    
    # Get month dates
    month_start = today_date.replace(day=1).strftime('%Y-%m-%d')
    month_end = today_date.strftime('%Y-%m-%d')
    
    # Get store KPIs
    today_kpi = await db.store_kpis.find_one({
        "manager_id": current_user['id'],
        "date": today
    }, {"_id": 0})
    
    week_kpis = await db.store_kpis.find({
        "manager_id": current_user['id'],
        "date": {"$gte": week_start, "$lte": week_end}
    }, {"_id": 0}).to_list(1000)
    
    month_kpis = await db.store_kpis.find({
        "manager_id": current_user['id'],
        "date": {"$gte": month_start, "$lte": month_end}
    }, {"_id": 0}).to_list(1000)
    
    # Get sellers for this manager
    sellers = await db.users.find({
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
        
        # Build context with team data
        sellers_summary = []
        for seller in team_data.get('sellers_details', []):
            sellers_summary.append(
                f"- {seller['name']}: CA {seller['ca']:.0f}€, {seller['ventes']} ventes, "
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
    """Analyze store KPIs using AI"""
    if current_user['role'] != 'manager':
        raise HTTPException(status_code=403, detail="Only managers can access this endpoint")
    
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
        sellers_total["ca_journalier"] += entry.get("ca_journalier", 0)
        sellers_total["nb_ventes"] += entry.get("nb_ventes", 0)
        sellers_total["nb_clients"] += entry.get("nb_clients", 0)
        sellers_total["nb_articles"] += entry.get("nb_articles", 0)
        sellers_total["nb_prospects"] += entry.get("nb_prospects", 0)
    
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

# ===== MANAGER OBJECTIVES ENDPOINTS =====
@api_router.get("/manager/objectives")
async def get_manager_objectives(current_user: dict = Depends(get_current_user)):
    if current_user['role'] != 'manager':
        raise HTTPException(status_code=403, detail="Only managers can access objectives")
    
    objectives = await db.manager_objectives.find(
        {"manager_id": current_user['id']},
        {"_id": 0}
    ).sort("created_at", -1).to_list(10)
    
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
async def get_active_manager_objectives(current_user: dict = Depends(get_current_user)):
    """Get only active objectives for display in manager dashboard"""
    if current_user['role'] != 'manager':
        raise HTTPException(status_code=403, detail="Only managers can access objectives")
    
    today = datetime.now(timezone.utc).date().isoformat()
    objectives = await db.manager_objectives.find(
        {
            "manager_id": current_user['id'],
            "period_end": {"$gt": today}  # Only objectives that haven't ended yet (strict >)
        },
        {"_id": 0}
    ).sort("period_start", 1).to_list(10)
    
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
async def get_active_manager_challenges(current_user: dict = Depends(get_current_user)):
    """Get only active collective challenges for display in manager dashboard"""
    if current_user['role'] != 'manager':
        raise HTTPException(status_code=403, detail="Only managers can access challenges")
    
    today = datetime.now(timezone.utc).date().isoformat()
    challenges = await db.challenges.find(
        {
            "manager_id": current_user['id'],
            "type": "collective",
            "status": "active",
            "end_date": {"$gt": today}  # Only challenges that haven't ended yet (strict >)
        },
        {"_id": 0}
    ).sort("start_date", 1).to_list(10)  # Sort by start_date to show upcoming first
    
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
    
    # Determine status
    today = datetime.now(timezone.utc).date().isoformat()
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
        # Period is ongoing - check if target is already reached
        objective_met = True
        if objective.get('ca_target') and total_ca < objective['ca_target']:
            objective_met = False
        if objective.get('panier_moyen_target') and panier_moyen < objective['panier_moyen_target']:
            objective_met = False
        if objective.get('indice_vente_target') and indice_vente < objective['indice_vente_target']:
            objective_met = False
        
        # Only mark as 'achieved' if target is reached AND period is still ongoing
        # Otherwise keep as 'active' or 'in_progress'
        if objective_met:
            objective['status'] = 'achieved'
        else:
            objective['status'] = 'active' if objective.get('status') == 'active' else 'in_progress'
    
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
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "role": 1, "id": 1})
    if user and user.get('role') == 'gerant':
        seller_count = await db.users.count_documents({"gerant_id": user_id, "role": "seller", "status": {"$ne": "deleted"}})
    else:
        seller_count = await db.users.count_documents({"manager_id": user_id, "role": "seller"})
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
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "role": 1})
    if user and user.get('role') == 'gerant':
        seller_count = await db.users.count_documents({"gerant_id": user_id, "role": "seller", "status": {"$ne": "deleted"}})
    else:
        seller_count = await db.users.count_documents({"manager_id": user_id, "role": "seller"})
    
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
    if current_user['role'] not in ['manager', 'gerant']:
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
    if current_user['role'] == 'gerant':
        seller_count = await db.users.count_documents({
            "gerant_id": current_user['id'], 
            "role": "seller",
            "status": {"$ne": "deleted"}
        })
    else:
        seller_count = await db.users.count_documents({"workspace_id": workspace['id'], "role": "seller"})
    
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
    """Get subscription change history"""
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
**Nom :** {current_user.get('first_name', '')} {current_user.get('last_name', '')}
**Profil de personnalité :** {json.dumps(manager_diagnostic.get('profile', {}), ensure_ascii=False) if manager_diagnostic else 'Non disponible'}

## Contexte Vendeur
**Nom :** {seller.get('first_name', '')} {seller.get('last_name', '')}
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
                "id": workspace['id'],
                "name": workspace['name'],
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
        
        # Log d'audit
        await db.admin_logs.insert_one({
            "admin_id": current_admin['id'],
            "action": "workspace_status_change",
            "workspace_id": workspace_id,
            "new_status": status,
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
        
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
        
        # Log d'audit
        await db.admin_logs.insert_one({
            "admin_id": current_admin['id'],
            "action": "workspace_plan_change",
            "workspace_id": workspace_id,
            "new_plan": new_plan,
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
        
        return {"success": True, "message": f"Plan changed to {new_plan}"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating workspace plan: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/superadmin/logs")
async def get_admin_logs(
    limit: int = 100,
    current_admin: dict = Depends(get_super_admin)
):
    """Récupère les logs d'audit admin"""
    try:
        logs = await db.admin_logs.find(
            {},
            {"_id": 0}
        ).sort("timestamp", -1).limit(limit).to_list(limit)
        
        return logs
    except Exception as e:
        logger.error(f"Error fetching admin logs: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# ============================================
# GERANT ENDPOINTS - Multi-Store Management
# ============================================

@api_router.post("/gerant/stores", response_model=Store)
async def create_store(store_data: StoreCreate, current_user: dict = Depends(get_current_user)):
    """Créer un nouveau magasin (réservé aux gérants)"""
    if current_user['role'] != 'gerant':
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
    if current_user['role'] != 'gerant':
        raise HTTPException(status_code=403, detail="Accès réservé aux gérants")
    
    stores = await db.stores.find(
        {"gerant_id": current_user['id'], "active": True},
        {"_id": 0}
    ).to_list(length=None)
    
    return stores

@api_router.get("/gerant/stores/{store_id}")
async def get_store_details(store_id: str, current_user: dict = Depends(get_current_user)):
    """Récupérer les détails d'un magasin spécifique"""
    if current_user['role'] != 'gerant':
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
    if current_user['role'] != 'gerant':
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
    """Supprimer un magasin (avec validation stricte)"""
    if current_user['role'] != 'gerant':
        raise HTTPException(status_code=403, detail="Accès réservé aux gérants")
    
    # Vérifier que le magasin appartient au gérant
    store = await db.stores.find_one({"id": store_id, "gerant_id": current_user['id']})
    if not store:
        raise HTTPException(status_code=404, detail="Magasin non trouvé")
    
    # Vérifier qu'il n'y a pas de managers assignés
    managers_count = await db.users.count_documents({"store_id": store_id, "role": "manager"})
    if managers_count > 0:
        raise HTTPException(
            status_code=400, 
            detail=f"Impossible de supprimer : {managers_count} manager(s) assigné(s)"
        )
    
    # Vérifier qu'il n'y a pas de vendeurs assignés
    sellers_count = await db.users.count_documents({"store_id": store_id, "role": "seller"})
    if sellers_count > 0:
        raise HTTPException(
            status_code=400, 
            detail=f"Impossible de supprimer : {sellers_count} vendeur(s) assigné(s)"
        )
    
    # Marquer comme inactif au lieu de supprimer (soft delete)
    await db.stores.update_one(
        {"id": store_id},
        {"$set": {"active": False, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"message": "Magasin désactivé avec succès"}

@api_router.get("/gerant/dashboard/stats")
async def get_gerant_dashboard_stats(current_user: dict = Depends(get_current_user)):
    """Récupérer les statistiques globales du gérant (tous magasins)"""
    if current_user['role'] != 'gerant':
        raise HTTPException(status_code=403, detail="Accès réservé aux gérants")
    
    # Récupérer tous les magasins actifs
    stores = await db.stores.find(
        {"gerant_id": current_user['id'], "active": True},
        {"_id": 0}
    ).to_list(length=None)
    
    store_ids = [store['id'] for store in stores]
    
    # Compter les managers
    total_managers = await db.users.count_documents({
        "gerant_id": current_user['id'],
        "role": "manager"
    })
    
    # Compter les vendeurs
    total_sellers = await db.users.count_documents({
        "gerant_id": current_user['id'],
        "role": "seller"
    })
    
    # Calculer le CA total (du jour)
    today = datetime.now(timezone.utc).strftime('%Y-%m-%d')
    
    pipeline = [
        {
            "$match": {
                "gerant_id": current_user['id'],
                "date": today
            }
        },
        {
            "$group": {
                "_id": None,
                "total_ca": {"$sum": "$ca"},
                "total_ventes": {"$sum": "$ventes"},
                "total_articles": {"$sum": "$articles"}
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
        "total_sellers": total_sellers,
        "today_ca": stats.get("total_ca", 0),
        "today_ventes": stats.get("total_ventes", 0),
        "today_articles": stats.get("total_articles", 0),
        "stores": stores
    }

@api_router.get("/gerant/stores/{store_id}/stats")
async def get_store_stats(store_id: str, current_user: dict = Depends(get_current_user)):
    """Récupérer les statistiques d'un magasin spécifique"""
    if current_user['role'] != 'gerant':
        raise HTTPException(status_code=403, detail="Accès réservé aux gérants")
    
    # Vérifier que le magasin appartient au gérant
    store = await db.stores.find_one(
        {"id": store_id, "gerant_id": current_user['id']},
        {"_id": 0}
    )
    if not store:
        raise HTTPException(status_code=404, detail="Magasin non trouvé")
    
    # Compter les managers
    managers_count = await db.users.count_documents({"store_id": store_id, "role": "manager"})
    
    # Compter les vendeurs
    sellers_count = await db.users.count_documents({"store_id": store_id, "role": "seller"})
    
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
                "total_ca": {"$sum": "$ca_journalier"},
                "total_ventes": {"$sum": "$nb_ventes"},
                "total_articles": {"$sum": "$nb_articles"}
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
                "total_ca": {"$sum": "$ca_journalier"},
                "total_ventes": {"$sum": "$nb_ventes"},
                "total_articles": {"$sum": "$nb_articles"}
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
    
    # Calculate week CA (from Monday to today)
    from datetime import timedelta
    today_date = datetime.now(timezone.utc)
    # Get Monday of current week (0 = Monday)
    days_since_monday = today_date.weekday()
    monday = (today_date - timedelta(days=days_since_monday)).strftime('%Y-%m-%d')
    
    # Get sellers KPIs for the week
    sellers_week_pipeline = [
        {
            "$match": {
                "store_id": store_id,
                "date": {"$gte": monday, "$lte": today}
            }
        },
        {
            "$group": {
                "_id": None,
                "total_ca": {"$sum": "$ca_journalier"},
                "total_ventes": {"$sum": "$nb_ventes"}
            }
        }
    ]
    
    sellers_week = await db.kpi_entries.aggregate(sellers_week_pipeline).to_list(length=1)
    sellers_week_ca = sellers_week[0].get("total_ca", 0) if sellers_week else 0
    sellers_week_ventes = sellers_week[0].get("total_ventes", 0) if sellers_week else 0
    
    # Get managers KPIs for the week
    managers_week_pipeline = [
        {
            "$match": {
                "store_id": store_id,
                "date": {"$gte": monday, "$lte": today}
            }
        },
        {
            "$group": {
                "_id": None,
                "total_ca": {"$sum": "$ca_journalier"},
                "total_ventes": {"$sum": "$nb_ventes"}
            }
        }
    ]
    
    managers_week = await db.manager_kpis.aggregate(managers_week_pipeline).to_list(length=1)
    managers_week_ca = managers_week[0].get("total_ca", 0) if managers_week else 0
    managers_week_ventes = managers_week[0].get("total_ventes", 0) if managers_week else 0
    
    week_ca = sellers_week_ca + managers_week_ca
    week_ventes = sellers_week_ventes + managers_week_ventes
    
    return {
        "store": store,
        "managers_count": managers_count,
        "sellers_count": sellers_count,
        "today_ca": stats.get("total_ca", 0),
        "today_ventes": stats.get("total_ventes", 0),
        "today_articles": stats.get("total_articles", 0),
        "week_ca": week_ca,
        "week_ventes": week_ventes
    }

@api_router.get("/gerant/stores/{store_id}/managers")
async def get_store_managers(store_id: str, current_user: dict = Depends(get_current_user)):
    """Récupérer les managers d'un magasin"""
    if current_user['role'] != 'gerant':
        raise HTTPException(status_code=403, detail="Accès réservé aux gérants")
    
    managers = await db.users.find(
        {"store_id": store_id, "role": "manager"},
        {"_id": 0, "password": 0}
    ).to_list(length=None)
    
    return managers

@api_router.get("/gerant/stores/{store_id}/sellers")
async def get_store_sellers(store_id: str, current_user: dict = Depends(get_current_user)):
    """Récupérer les vendeurs d'un magasin"""
    if current_user['role'] != 'gerant':
        raise HTTPException(status_code=403, detail="Accès réservé aux gérants")
    
    sellers = await db.users.find(
        {"store_id": store_id, "role": "seller"},
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
    if current_user['role'] != 'gerant':
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

@api_router.post("/gerant/managers/{manager_id}/transfer")
async def transfer_manager_to_store(
    manager_id: str,
    transfer: ManagerTransfer,
    current_user: dict = Depends(get_current_user)
):
    """Transférer un manager vers un autre magasin (les vendeurs restent)"""
    if current_user['role'] != 'gerant':
        raise HTTPException(status_code=403, detail="Accès réservé aux gérants")
    
    # Vérifier que le manager existe et appartient au gérant
    manager = await db.users.find_one({"id": manager_id, "gerant_id": current_user['id'], "role": "manager"})
    if not manager:
        raise HTTPException(status_code=404, detail="Manager non trouvé")
    
    # Vérifier que le nouveau magasin existe
    new_store = await db.stores.find_one({"id": transfer.new_store_id, "gerant_id": current_user['id']})
    if not new_store:
        raise HTTPException(status_code=404, detail="Nouveau magasin non trouvé")
    
    old_store_id = manager.get('store_id')
    
    # Transférer le manager
    await db.users.update_one(
        {"id": manager_id},
        {"$set": {"store_id": transfer.new_store_id}}
    )
    
    # Compter les vendeurs qui restent sans manager dans l'ancien magasin
    orphan_sellers = await db.users.count_documents({
        "manager_id": manager_id,
        "store_id": old_store_id,
        "role": "seller"
    })
    
    return {
        "message": f"Manager transféré avec succès",
        "orphan_sellers_count": orphan_sellers,
        "warning": f"{orphan_sellers} vendeur(s) restent dans l'ancien magasin sans manager" if orphan_sellers > 0 else None
    }

@api_router.post("/gerant/sellers/{seller_id}/transfer")
async def transfer_seller_to_store(
    seller_id: str,
    transfer: SellerTransfer,
    current_user: dict = Depends(get_current_user)
):
    """Transférer un vendeur vers un autre magasin avec nouveau manager"""
    if current_user['role'] != 'gerant':
        raise HTTPException(status_code=403, detail="Accès réservé aux gérants")
    
    # Vérifier que le vendeur existe et appartient au gérant
    seller = await db.users.find_one({"id": seller_id, "gerant_id": current_user['id'], "role": "seller"})
    if not seller:
        raise HTTPException(status_code=404, detail="Vendeur non trouvé")
    
    # Vérifier que le nouveau magasin existe
    new_store = await db.stores.find_one({"id": transfer.new_store_id, "gerant_id": current_user['id']})
    if not new_store:
        raise HTTPException(status_code=404, detail="Nouveau magasin non trouvé")
    
    # Vérifier que le nouveau manager existe et est bien dans le nouveau magasin
    new_manager = await db.users.find_one({
        "id": transfer.new_manager_id,
        "store_id": transfer.new_store_id,
        "role": "manager"
    })
    if not new_manager:
        raise HTTPException(status_code=404, detail="Manager non trouvé dans ce magasin")
    
    # Transférer le vendeur
    await db.users.update_one(
        {"id": seller_id},
        {"$set": {
            "store_id": transfer.new_store_id,
            "manager_id": transfer.new_manager_id
        }}
    )
    
    return {
        "message": f"Vendeur transféré avec succès vers {new_store['name']}",
        "new_manager": new_manager['name']
    }

@api_router.get("/gerant/managers")
async def get_all_managers(current_user: dict = Depends(get_current_user)):
    """Récupérer tous les managers du gérant"""
    if current_user['role'] != 'gerant':
        raise HTTPException(status_code=403, detail="Accès réservé aux gérants")
    
    managers = await db.users.find(
        {"gerant_id": current_user['id'], "role": "manager"},
        {"_id": 0, "password": 0}
    ).to_list(length=None)
    
    return managers

@api_router.get("/gerant/sellers")
async def get_all_sellers(current_user: dict = Depends(get_current_user)):
    """Récupérer tous les vendeurs du gérant"""
    if current_user['role'] != 'gerant':
        raise HTTPException(status_code=403, detail="Accès réservé aux gérants")
    
    sellers = await db.users.find(
        {"gerant_id": current_user['id'], "role": "seller"},
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
    if current_user['role'] != 'gerant':
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
    
    # Si c'est un vendeur, vérifier que le manager existe (actif ou en attente)
    manager_id = None
    manager_name = None
    if invite_data.role == 'seller':
        if not invite_data.manager_id:
            raise HTTPException(status_code=400, detail="Un manager est requis pour inviter un vendeur")
        
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
    
    # Vérifier si l'email existe déjà
    existing_user = await db.users.find_one({"email": invite_data.email}, {"_id": 0})
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
    
    # Créer l'invitation
    invitation = GerantInvitation(
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
    
    return invitation

@api_router.get("/gerant/invitations")
async def get_gerant_invitations(current_user: dict = Depends(get_current_user)):
    """Récupérer toutes les invitations du gérant"""
    if current_user['role'] != 'gerant':
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
    
    if invitation['email'] != invite_data.email:
        raise HTTPException(status_code=400, detail="L'email ne correspond pas à l'invitation")
    
    # Vérifier que l'email n'existe pas déjà
    existing_user = await db.users.find_one({"email": invite_data.email}, {"_id": 0})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email déjà enregistré")
    
    # Hasher le mot de passe
    hashed_password = bcrypt.hashpw(invite_data.password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    
    # Créer l'utilisateur
    user_obj = User(
        name=invite_data.name,
        email=invite_data.email,
        password=hashed_password,
        role=invitation['role'],
        manager_id=invitation.get('manager_id'),
        store_id=invitation['store_id'],
        gerant_id=invitation['gerant_id']
    )
    
    user_dict = user_obj.model_dump()
    await db.users.insert_one(user_dict)
    
    # Marquer l'invitation comme acceptée
    await db.gerant_invitations.update_one(
        {"token": invite_data.invitation_token},
        {"$set": {"status": "accepted"}}
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
# GERANT STORE PERFORMANCE ENDPOINTS
# ============================================

@api_router.get("/gerant/stores/{store_id}/kpi-overview")
async def get_gerant_store_kpi_overview(
    store_id: str,
    date: str = None,
    current_user: dict = Depends(get_current_user)
):
    """Get consolidated store KPI overview for a specific store (Gérant only)"""
    if current_user['role'] != 'gerant':
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
    
    # Get all managers in this store
    managers = await db.users.find({
        "store_id": store_id,
        "role": "manager",
        "gerant_id": current_user['id']
    }, {"_id": 0, "id": 1}).to_list(100)
    
    manager_ids = [m['id'] for m in managers]
    
    # Get all sellers in this store
    sellers = await db.users.find({
        "store_id": store_id,
        "role": "seller",
        "status": "active",
        "gerant_id": current_user['id']
    }, {"_id": 0, "id": 1, "name": 1}).to_list(100)
    
    seller_ids = [s['id'] for s in sellers]
    
    # Aggregate manager KPIs for the date
    manager_kpis_list = []
    if manager_ids:
        manager_kpis_list = await db.manager_kpis.find({
            "manager_id": {"$in": manager_ids},
            "date": date
        }, {"_id": 0}).to_list(100)
    
    # Aggregate seller KPI entries for the date
    seller_entries = []
    if seller_ids:
        seller_entries = await db.kpi_entries.find({
            "seller_id": {"$in": seller_ids},
            "date": date
        }, {"_id": 0}).to_list(100)
    
    # Enrich seller entries with names
    for entry in seller_entries:
        seller = next((s for s in sellers if s['id'] == entry['seller_id']), None)
        if seller:
            entry['seller_name'] = seller['name']
    
    # Aggregate totals from managers
    managers_total = {
        "ca_journalier": sum(kpi.get("ca_journalier", 0) for kpi in manager_kpis_list),
        "nb_ventes": sum(kpi.get("nb_ventes", 0) for kpi in manager_kpis_list),
        "nb_clients": sum(kpi.get("nb_clients", 0) for kpi in manager_kpis_list),
        "nb_articles": sum(kpi.get("nb_articles", 0) for kpi in manager_kpis_list),
        "nb_prospects": sum(kpi.get("nb_prospects", 0) for kpi in manager_kpis_list)
    }
    
    # Aggregate totals from sellers
    sellers_total = {
        "ca_journalier": sum(entry.get("ca_journalier", 0) for entry in seller_entries),
        "nb_ventes": sum(entry.get("nb_ventes", 0) for entry in seller_entries),
        "nb_clients": sum(entry.get("nb_clients", 0) for entry in seller_entries),
        "nb_articles": sum(entry.get("nb_articles", 0) for entry in seller_entries),
        "nb_prospects": sum(entry.get("nb_prospects", 0) for entry in seller_entries),
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
    if current_user['role'] != 'gerant':
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
    
    # Get all managers in this store
    managers = await db.users.find({
        "store_id": store_id,
        "role": "manager",
        "gerant_id": current_user['id']
    }, {"_id": 0, "id": 1}).to_list(100)
    
    manager_ids = [m['id'] for m in managers]
    
    # Get all sellers in this store
    sellers = await db.users.find({
        "store_id": store_id,
        "role": "seller",
        "gerant_id": current_user['id']
    }, {"_id": 0, "id": 1}).to_list(100)
    
    seller_ids = [s['id'] for s in sellers]
    
    # Get manager KPIs for the period
    manager_kpis = []
    if manager_ids:
        manager_kpis = await db.manager_kpis.find({
            "manager_id": {"$in": manager_ids},
            "date": {"$gte": start_date.strftime('%Y-%m-%d'), "$lte": end_date.strftime('%Y-%m-%d')}
        }, {"_id": 0}).to_list(10000)
    
    # Get seller KPI entries for the period
    seller_entries = []
    if seller_ids:
        seller_entries = await db.kpi_entries.find({
            "seller_id": {"$in": seller_ids},
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
        date_map[date]["ca_journalier"] += kpi.get("ca_journalier", 0)
        date_map[date]["nb_ventes"] += kpi.get("nb_ventes", 0)
        date_map[date]["nb_clients"] += kpi.get("nb_clients", 0)
        date_map[date]["nb_articles"] += kpi.get("nb_articles", 0)
        date_map[date]["nb_prospects"] += kpi.get("nb_prospects", 0)
    
    # Add seller entries
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
        date_map[date]["ca_journalier"] += entry.get("ca_journalier", 0)
        date_map[date]["nb_ventes"] += entry.get("nb_ventes", 0)
        date_map[date]["nb_clients"] += entry.get("nb_clients", 0)
        date_map[date]["nb_articles"] += entry.get("nb_articles", 0)
        date_map[date]["nb_prospects"] += entry.get("nb_prospects", 0)
    
    # Convert to sorted list
    historical_data = sorted(date_map.values(), key=lambda x: x['date'])
    
    return historical_data


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
    if current_user['role'] == 'gerant':
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

    return {
        "store": store,
        "days": days,
        "start_date": start_date.strftime('%Y-%m-%d'),
        "end_date": end_date.strftime('%Y-%m-%d'),
        "data": historical_data
    }



# Include router
app.include_router(api_router)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

