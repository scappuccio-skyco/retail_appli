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
from datetime import datetime, timezone, timedelta
import bcrypt
import jwt
from emergentintegrations.llm.chat import LlmChat, UserMessage
import asyncio
import json

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

# Security
security = HTTPBearer()

app = FastAPI()
api_router = APIRouter(prefix="/api")

# ===== MODELS =====
class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    email: EmailStr
    role: str  # manager or seller
    manager_id: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: str
    manager_id: Optional[str] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

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
    # Section 1 - Contexte rapide
    produit: str
    type_client: str
    situation_vente: str
    # Section 2 - Ce qui s'est passé
    description_vente: str
    moment_perte_client: str
    raisons_echec: str
    amelioration_pensee: str
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
    actions_prioritaires: list[str]  # 3 actions concrètes
    suggestion_brief: str  # Trame de brief prête à utiliser
    kpi_resume: dict  # Résumé des KPIs (CA, ventes, etc.)
    competences_moyenne: dict  # Moyenne des compétences de l'équipe
    donnees_sources: list[dict]  # Données brutes par vendeur pour vérification
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
    },
    "nb_clients": {
        "name": "Nombre de clients accueillis",
        "unit": "clients",
        "type": "number",
        "icon": "👥",
        "description": "Nombre total de clients venus"
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
        "formula": "(nb_ventes / nb_clients) * 100",
        "icon": "📈"
    },
    "indice_vente": {
        "name": "Indice de vente",
        "unit": "ventes/client",
        "formula": "nb_ventes / nb_clients",
        "icon": "📊"
    }
}

def calculate_kpis(raw_data: dict) -> dict:
    """Calculate derived KPIs from raw seller input"""
    calculated = {}
    
    ca = raw_data.get('ca_journalier', 0)
    nb_ventes = raw_data.get('nb_ventes', 0)
    nb_clients = raw_data.get('nb_clients', 0)
    
    # Panier moyen
    if nb_ventes > 0:
        calculated['panier_moyen'] = round(ca / nb_ventes, 2)
    else:
        calculated['panier_moyen'] = 0
    
    # Taux de transformation
    if nb_clients > 0:
        calculated['taux_transformation'] = round((nb_ventes / nb_clients) * 100, 2)
        calculated['indice_vente'] = round(nb_ventes / nb_clients, 2)
    else:
        calculated['taux_transformation'] = 0
        calculated['indice_vente'] = 0
    
    return calculated

class KPIConfiguration(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    manager_id: str
    # KPIs that sellers can fill
    track_ca: bool = True
    track_ventes: bool = True
    track_clients: bool = True
    track_articles: bool = True
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
    nb_clients: int = 0
    nb_articles: int = 0  # NEW: Number of articles sold
    # Calculated KPIs
    panier_moyen: float = 0
    taux_transformation: float = 0
    indice_vente: float = 0  # CA / nb_articles
    comment: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class KPIEntryCreate(BaseModel):
    date: str
    ca_journalier: float = 0
    nb_ventes: int = 0
    nb_clients: int = 0
    nb_articles: int = 0
    comment: Optional[str] = None

class KPIConfigUpdate(BaseModel):
    track_ca: Optional[bool] = None
    track_ventes: Optional[bool] = None
    track_clients: Optional[bool] = None
    track_articles: Optional[bool] = None


# ===== MANAGER OBJECTIVES MODELS =====
class ManagerObjectives(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    manager_id: str
    ca_target: Optional[float] = None
    indice_vente_target: Optional[float] = None
    panier_moyen_target: Optional[float] = None
    period_start: str  # Format: YYYY-MM-DD
    period_end: str  # Format: YYYY-MM-DD
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ManagerObjectivesCreate(BaseModel):
    ca_target: Optional[float] = None
    indice_vente_target: Optional[float] = None
    panier_moyen_target: Optional[float] = None
    period_start: str
    period_end: str

# ===== CHALLENGE MODELS =====
class Challenge(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    manager_id: str
    title: str
    description: Optional[str] = None
    type: str  # "individual" or "collective"
    seller_id: Optional[str] = None  # Only for individual challenges
    # Objectives
    ca_target: Optional[float] = None
    ventes_target: Optional[int] = None
    indice_vente_target: Optional[float] = None
    panier_moyen_target: Optional[float] = None
    # Dates
    start_date: str  # Format: YYYY-MM-DD
    end_date: str  # Format: YYYY-MM-DD
    # Status
    status: str = "active"  # active, completed, failed
    # Progress (calculated)
    progress_ca: float = 0
    progress_ventes: int = 0
    progress_indice_vente: float = 0
    progress_panier_moyen: float = 0
    # Metadata
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    completed_at: Optional[datetime] = None

class ChallengeCreate(BaseModel):
    title: str
    description: Optional[str] = None
    type: str  # "individual" or "collective"
    seller_id: Optional[str] = None
    ca_target: Optional[float] = None
    ventes_target: Optional[int] = None
    indice_vente_target: Optional[float] = None
    panier_moyen_target: Optional[float] = None
    start_date: str
    end_date: str

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
@api_router.post("/auth/register")
async def register(user_data: UserCreate):
    # Check if user exists
    existing = await db.users.find_one({"email": user_data.email}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Hash password
    hashed_pw = hash_password(user_data.password)
    
    # Create user
    user_dict = user_data.model_dump()
    user_dict.pop('password')
    user_obj = User(**user_dict)
    
    doc = user_obj.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    doc['password'] = hashed_pw
    
    await db.users.insert_one(doc)
    
    # Create token
    token = create_token(user_obj.id, user_obj.email, user_obj.role)
    
    return {
        "user": user_obj.model_dump(),
        "token": token
    }

@api_router.post("/auth/login")
async def login(credentials: UserLogin):
    user = await db.users.find_one({"email": credentials.email}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not verify_password(credentials.password, user['password']):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
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

async def generate_ai_debrief_analysis(debrief_data: dict, seller_name: str, current_scores: dict) -> dict:
    """Generate AI coaching feedback for a debrief"""
    
    prompt = f"""Tu es un coach expert en vente retail.
Analyse la vente décrite pour identifier les causes probables de l'échec et proposer des leviers d'amélioration concrets.

### CONTEXTE
Tu viens de débriefer une vente qui n'a pas abouti. Voici les détails :

🎯 Produit : {debrief_data.get('produit')}
👥 Type de client : {debrief_data.get('type_client')}
💼 Situation : {debrief_data.get('situation_vente')}
💬 Description : {debrief_data.get('description_vente')}
📍 Moment clé du blocage : {debrief_data.get('moment_perte_client')}
❌ Raisons évoquées : {debrief_data.get('raisons_echec')}
🔄 Ce que tu penses pouvoir faire différemment : {debrief_data.get('amelioration_pensee')}

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
  "exemple_concret": "[Une phrase illustrant ce que tu aurais pu dire ou faire dans cette situation]",
  "score_accueil": 3.5,
  "score_decouverte": 4.0,
  "score_argumentation": 3.0,
  "score_closing": 3.5,
  "score_fidelisation": 4.0
}}

### STYLE ATTENDU
- Ton professionnel, positif, utile et centré sur la performance commerciale
- TUTOIEMENT OBLIGATOIRE : utilise "tu", "ta", "tes", "ton" (ex: "Tu as bien identifié le besoin", "Ta reformulation pourrait être...")
- Évite toute approche psychologique ou moralisante
- Utilise un vocabulaire de vendeur retail : client, besoin, argument, reformulation, closing, objection
- L'exemple doit être simple, réaliste et crédible ("Tu aurais pu dire : 'Je comprends, ce modèle est plus léger et répond mieux à ce que vous cherchez.'")
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
    
    # Generate AI analysis with current scores
    analysis = await generate_ai_debrief_analysis(debrief_data.model_dump(), current_user['name'], current_scores)
    
    # Create debrief object
    debrief = Debrief(
        seller_id=current_user['id'],
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
    
    sellers = await db.users.find({"manager_id": current_user['id']}, {"_id": 0, "password": 0}).to_list(1000)
    
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

@api_router.get("/manager/seller/{seller_id}/stats")
async def get_seller_stats(seller_id: str, current_user: dict = Depends(get_current_user)):
    if current_user['role'] != 'manager':
        raise HTTPException(status_code=403, detail="Only managers can access this")
    
    # Verify seller belongs to manager
    seller = await db.users.find_one({"id": seller_id, "manager_id": current_user['id']}, {"_id": 0, "password": 0})
    if not seller:
        raise HTTPException(status_code=404, detail="Seller not found")
    
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
    
    # Calculate average radar scores
    avg_radar = {"accueil": 0, "decouverte": 0, "argumentation": 0, "closing": 0, "fidelisation": 0}
    if evals:
        for key in avg_radar.keys():
            avg_radar[key] = round(sum(e[key] for e in evals) / len(evals), 2)
    
    return {
        "seller": seller,
        "evaluations": evals,
        "avg_radar_scores": avg_radar
    }

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

1. Analyse ses réponses pour identifier :
   - son style de vente dominant (Convivial, Explorateur, Dynamique, Discret ou Stratège)
   - son niveau global selon cette échelle gamifiée (utilise ces niveaux UNIQUEMENT) :
     * **Explorateur** (🟢 Niveau 1) : Découvre le terrain, teste, apprend les bases. Curieux et volontaire.
     * **Challenger** (🟡 Niveau 2) : A pris ses repères, cherche à performer, teste de nouvelles approches.
     * **Ambassadeur** (🟠 Niveau 3) : Inspire confiance, maîtrise les étapes de la vente, partage ses pratiques.
     * **Maître du Jeu** (🔴 Niveau 4) : Expert de la relation client, capable d'adapter son style et d'entraîner les autres.
   - ses leviers de motivation (Relation, Reconnaissance, Performance, Découverte)

2. **IMPORTANT** : Évalue ses compétences sur les 5 étapes de la vente en analysant ses réponses.
   Attribue un score de 1 à 5 pour chaque compétence :
   - **Accueil** : Capacité à créer le premier contact, mettre à l'aise
   - **Découverte** : Capacité à identifier les besoins, poser les bonnes questions
   - **Argumentation** : Capacité à présenter le produit, convaincre avec des arguments
   - **Closing** : Capacité à conclure la vente, gérer les objections finales
   - **Fidélisation** : Capacité à créer une relation durable, assurer le suivi

3. Rédige un retour structuré :
   - Une phrase d'introduction qui décrit son style.
   - Deux points forts concrets observés dans ses réponses.
   - Un axe d'amélioration principal avec un conseil précis.
   - Une phrase motivante adaptée à son profil.

4. Utilise un ton bienveillant, professionnel et simple.
5. Évite le jargon.

Réponds au format JSON avec cette structure exacte :
{{
  "style": "Convivial|Explorateur|Dynamique|Discret|Stratège",
  "level": "Explorateur|Challenger|Ambassadeur|Maître du Jeu",
  "motivation": "Relation|Reconnaissance|Performance|Découverte",
  "summary": "Ton analyse complète en texte",
  "score_accueil": 3.5,
  "score_decouverte": 4.0,
  "score_argumentation": 3.0,
  "score_closing": 3.5,
  "score_fidelisation": 4.0
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
            "summary": "Profil en cours d'analyse. Votre diagnostic a été enregistré avec succès.",
            "score_accueil": 3.0,
            "score_decouverte": 3.0,
            "score_argumentation": 3.0,
            "score_closing": 3.0,
            "score_fidelisation": 3.0
        }

@api_router.post("/diagnostic", response_model=DiagnosticResult)
async def create_diagnostic(diagnostic_data: DiagnosticCreate, current_user: dict = Depends(get_current_user)):
    if current_user['role'] != 'seller':
        raise HTTPException(status_code=403, detail="Only sellers can create diagnostics")
    
    # Check if diagnostic already exists - if yes, delete it to allow update
    existing = await db.diagnostics.find_one({"seller_id": current_user['id']}, {"_id": 0})
    if existing:
        await db.diagnostics.delete_one({"seller_id": current_user['id']})
    
    # Analyze with AI
    ai_analysis = await analyze_diagnostic_with_ai(diagnostic_data.responses)
    
    # Create diagnostic result
    diagnostic_obj = DiagnosticResult(
        seller_id=current_user['id'],
        responses=diagnostic_data.responses,
        ai_profile_summary=ai_analysis['summary'],
        style=ai_analysis['style'],
        level=ai_analysis['level'],
        motivation=ai_analysis['motivation'],
        score_accueil=ai_analysis.get('score_accueil', 3.0),
        score_decouverte=ai_analysis.get('score_decouverte', 3.0),
        score_argumentation=ai_analysis.get('score_argumentation', 3.0),
        score_closing=ai_analysis.get('score_closing', 3.0),
        score_fidelisation=ai_analysis.get('score_fidelisation', 3.0)
    )
    
    doc = diagnostic_obj.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.diagnostics.insert_one(doc)
    
    return diagnostic_obj

@api_router.get("/diagnostic/me")
async def get_my_diagnostic(current_user: dict = Depends(get_current_user)):
    if current_user['role'] != 'seller':
        raise HTTPException(status_code=403, detail="Only sellers can access their diagnostic")
    
    diagnostic = await db.diagnostics.find_one({"seller_id": current_user['id']}, {"_id": 0})
    
    if not diagnostic:
        return {"status": "not_completed", "diagnostic": None}
    
    if isinstance(diagnostic.get('created_at'), str):
        diagnostic['created_at'] = datetime.fromisoformat(diagnostic['created_at'])
    
    return {"status": "completed", "diagnostic": diagnostic}

# ===== MANAGER DIAGNOSTIC =====
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
    
    # Check if diagnostic already exists - if yes, delete it to allow update
    existing = await db.manager_diagnostics.find_one({"manager_id": current_user['id']}, {"_id": 0})
    if existing:
        await db.manager_diagnostics.delete_one({"manager_id": current_user['id']})
    
    # Analyze with AI
    ai_analysis = await analyze_manager_diagnostic_with_ai(diagnostic_data.responses)
    
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
        exemple_concret=ai_analysis['exemple_concret']
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
    
    # Verify seller belongs to manager
    seller = await db.users.find_one({"id": seller_id, "manager_id": current_user['id']}, {"_id": 0})
    if not seller:
        raise HTTPException(status_code=404, detail="Seller not found or not in your team")
    
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
    
    # Verify seller belongs to manager
    seller = await db.users.find_one({"id": seller_id, "manager_id": current_user['id']}, {"_id": 0})
    if not seller:
        raise HTTPException(status_code=404, detail="Seller not in your team")
    
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
@api_router.get("/manager/kpi-config")
async def get_kpi_config(current_user: dict = Depends(get_current_user)):
    if current_user['role'] != 'manager':
        raise HTTPException(status_code=403, detail="Only managers can access KPI configuration")
    
    config = await db.kpi_configurations.find_one({"manager_id": current_user['id']}, {"_id": 0})
    
    if not config:
        # Create default config with KPI enabled
        default_config = KPIConfiguration(
            manager_id=current_user['id'],
            enabled=True
        )
        doc = default_config.model_dump()
        doc['created_at'] = doc['created_at'].isoformat()
        doc['updated_at'] = doc['updated_at'].isoformat()
        await db.kpi_configurations.insert_one(doc)
        return default_config
    
    return config

@api_router.put("/manager/kpi-config")
async def update_kpi_config(config_update: KPIConfigUpdate, current_user: dict = Depends(get_current_user)):
    if current_user['role'] != 'manager':
        raise HTTPException(status_code=403, detail="Only managers can update KPI configuration")
    
    config = await db.kpi_configurations.find_one({"manager_id": current_user['id']}, {"_id": 0})
    
    if not config:
        # Create new config
        new_config = KPIConfiguration(
            manager_id=current_user['id'],
            enabled=config_update.enabled
        )
        doc = new_config.model_dump()
        doc['created_at'] = doc['created_at'].isoformat()
        doc['updated_at'] = doc['updated_at'].isoformat()
        await db.kpi_configurations.insert_one(doc)
        return new_config
    else:
        # Update existing config
        await db.kpi_configurations.update_one(
            {"manager_id": current_user['id']},
            {"$set": {
                "enabled": config_update.enabled,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        config['enabled'] = config_update.enabled
        config['updated_at'] = datetime.now(timezone.utc)
        return config

# Seller: Check if KPIs are enabled
@api_router.get("/seller/kpi-enabled")
async def check_kpi_enabled(current_user: dict = Depends(get_current_user)):
    if current_user['role'] != 'seller':
        raise HTTPException(status_code=403, detail="Only sellers can access this endpoint")
    
    if not current_user.get('manager_id'):
        return {"enabled": False, "seller_input_kpis": SELLER_INPUT_KPIS}
    
    config = await db.kpi_configurations.find_one({"manager_id": current_user['manager_id']}, {"_id": 0})
    
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
        "nb_clients": entry_data.nb_clients
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
    if current_user['role'] != 'seller':
        raise HTTPException(status_code=403, detail="Only sellers can access their KPI entries")
    
    # If days is specified, filter by date range
    if days:
        entries = await db.kpi_entries.find(
            {"seller_id": current_user['id']},
            {"_id": 0}
        ).sort("date", -1).limit(days).to_list(days)
    else:
        # Return all entries (no limit)
        cursor = db.kpi_entries.find(
            {"seller_id": current_user['id']},
            {"_id": 0}
        ).sort("date", -1)
        entries = await cursor.to_list(length=None)  # Get ALL entries without limit
    
    return entries

# Manager: Get KPI entries for a seller
@api_router.get("/manager/kpi-entries/{seller_id}")
async def get_seller_kpi_entries(seller_id: str, days: int = 30, current_user: dict = Depends(get_current_user)):
    if current_user['role'] != 'manager':
        raise HTTPException(status_code=403, detail="Only managers can access seller KPI entries")
    
    # Verify seller belongs to this manager
    seller = await db.users.find_one({"id": seller_id}, {"_id": 0})
    if not seller or seller.get('manager_id') != current_user['id']:
        raise HTTPException(status_code=404, detail="Seller not in your team")
    
    entries = await db.kpi_entries.find(
        {"seller_id": seller_id},
        {"_id": 0}
    ).sort("date", -1).limit(days).to_list(days)
    
    return entries

# Manager: Get all sellers KPI summary
@api_router.get("/manager/kpi-summary")
async def get_team_kpi_summary(current_user: dict = Depends(get_current_user)):
    if current_user['role'] != 'manager':
        raise HTTPException(status_code=403, detail="Only managers can access team KPI summary")
    
    # Get all sellers
    sellers = await db.users.find({"manager_id": current_user['id']}, {"_id": 0}).to_list(1000)
    
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
            avg_clients = sum(e.get('nb_clients', 0) for e in recent_entries) / len(recent_entries)
            avg_panier = sum(e.get('panier_moyen', 0) for e in recent_entries) / len(recent_entries)
            avg_taux = sum(e.get('taux_transformation', 0) for e in recent_entries) / len(recent_entries)
        else:
            avg_ca = avg_ventes = avg_clients = avg_panier = avg_taux = 0
        
        summary.append({
            "seller_id": seller['id'],
            "seller_name": seller['name'],
            "latest_entry": latest_entry,
            "seven_day_averages": {
                "ca_journalier": round(avg_ca, 2),
                "nb_ventes": round(avg_ventes, 1),
                "nb_clients": round(avg_clients, 1),
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
    
    # Verify seller belongs to this manager
    seller = await db.users.find_one({"id": seller_id}, {"_id": 0})
    if not seller or seller.get('manager_id') != current_user['id']:
        raise HTTPException(status_code=404, detail="Seller not in your team")
    
    # Get all debriefs for this seller
    debriefs = await db.debriefs.find(
        {"seller_id": seller_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(1000)
    
    return debriefs

# Manager: Get seller competences history
@api_router.get("/manager/competences-history/{seller_id}")
async def get_seller_competences_history(seller_id: str, current_user: dict = Depends(get_current_user)):
    if current_user['role'] != 'manager':
        raise HTTPException(status_code=403, detail="Only managers can access seller competences")
    
    # Verify seller belongs to this manager
    seller = await db.users.find_one({"id": seller_id}, {"_id": 0})
    if not seller or seller.get('manager_id') != current_user['id']:
        raise HTTPException(status_code=404, detail="Seller not in your team")
    
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
@api_router.post("/manager/team-bilan", response_model=TeamBilan)
async def generate_team_bilan(current_user: dict = Depends(get_current_user)):
    if current_user['role'] != 'manager':
        raise HTTPException(status_code=403, detail="Only managers can generate team bilan")
    
    # Get all sellers for this manager
    sellers = await db.users.find({"manager_id": current_user['id'], "role": "seller"}, {"_id": 0}).to_list(1000)
    
    if not sellers:
        raise HTTPException(status_code=404, detail="No sellers in your team")
    
    # Calculate period (last 7 days)
    end_date = datetime.now(timezone.utc)
    start_date = end_date - timedelta(days=7)
    periode = f"Semaine du {start_date.strftime('%d/%m')} au {end_date.strftime('%d/%m')}"
    
    # Collect data for all sellers
    team_data = []
    total_ca = 0
    total_ventes = 0
    total_clients = 0
    competences_sum = {"accueil": 0, "decouverte": 0, "argumentation": 0, "closing": 0, "fidelisation": 0}
    competences_count = 0
    
    for seller in sellers:
        seller_id = seller['id']
        
        # Get KPIs (last 7 days)
        kpi_entries = await db.kpi_entries.find({
            "seller_id": seller_id,
            "date": {"$gte": start_date.strftime('%Y-%m-%d')}
        }, {"_id": 0}).to_list(1000)
        
        seller_ca = sum(e.get('ca_journalier', 0) for e in kpi_entries)
        seller_ventes = sum(e.get('nb_ventes', 0) for e in kpi_entries)
        seller_clients = sum(e.get('nb_clients', 0) for e in kpi_entries)
        
        total_ca += seller_ca
        total_ventes += seller_ventes
        total_clients += seller_clients
        
        # Get latest competences (from diagnostic or latest debrief)
        diagnostic = await db.diagnostics.find_one({"seller_id": seller_id}, {"_id": 0})
        debriefs = await db.debriefs.find({"seller_id": seller_id}, {"_id": 0}).sort("created_at", -1).limit(1).to_list(1)
        
        latest_scores = None
        if debriefs:
            latest_scores = debriefs[0]
        elif diagnostic:
            latest_scores = diagnostic
        
        if latest_scores:
            competences_sum["accueil"] += latest_scores.get('score_accueil', 0)
            competences_sum["decouverte"] += latest_scores.get('score_decouverte', 0)
            competences_sum["argumentation"] += latest_scores.get('score_argumentation', 0)
            competences_sum["closing"] += latest_scores.get('score_closing', 0)
            competences_sum["fidelisation"] += latest_scores.get('score_fidelisation', 0)
            competences_count += 1
        
        team_data.append({
            "name": seller.get('name'),
            "ca": seller_ca,
            "ventes": seller_ventes,
            "panier_moyen": seller_ca / seller_ventes if seller_ventes > 0 else 0,
            "scores": latest_scores
        })
    
    # Calculate averages
    panier_moyen_equipe = total_ca / total_ventes if total_ventes > 0 else 0
    taux_transfo_equipe = (total_ventes / total_clients * 100) if total_clients > 0 else 0
    
    competences_moyenne = {}
    if competences_count > 0:
        for comp in competences_sum:
            competences_moyenne[comp] = round(competences_sum[comp] / competences_count, 2)
    
    # Generate AI analysis
    try:
        api_key = os.environ.get('EMERGENT_LLM_KEY')
        chat = LlmChat(
            api_key=api_key,
            session_id=f"team_bilan_{uuid.uuid4()}",
            system_message="Tu es un coach IA expert en management retail et analyse de performance d'équipe commerciale."
        ).with_model("openai", "gpt-4o-mini")
        
        # Prepare data summary for AI
        team_summary = f"""
**Période :** {periode}

**Performance globale :**
- CA total : {total_ca:.2f}€
- Ventes : {total_ventes}
- Clients : {total_clients}
- Panier moyen équipe : {panier_moyen_equipe:.2f}€
- Taux de transformation : {taux_transfo_equipe:.2f}%

**Compétences moyennes de l'équipe (sur 5) :**
- Accueil : {competences_moyenne.get('accueil', 0)}/5
- Découverte : {competences_moyenne.get('decouverte', 0)}/5
- Argumentation : {competences_moyenne.get('argumentation', 0)}/5
- Closing : {competences_moyenne.get('closing', 0)}/5
- Fidélisation : {competences_moyenne.get('fidelisation', 0)}/5

**Performance individuelle :**
"""
        for seller_info in team_data:
            team_summary += f"\n- {seller_info['name']} : {seller_info['ca']:.2f}€ CA, {seller_info['ventes']} ventes, PM {seller_info['panier_moyen']:.2f}€"
        
        prompt = f"""{team_summary}

En tant que coach IA, analyse ces données et génère un bilan hebdomadaire actionnable pour ce manager retail.

Réponds UNIQUEMENT au format JSON suivant (sans markdown, sans ```json) :
{{
  "synthese": "1-2 phrases sur la performance globale de la semaine avec un ton positif et professionnel",
  "points_forts": ["Point fort 1", "Point fort 2"],
  "points_attention": ["Point d'attention 1", "Point d'attention 2"],
  "actions_prioritaires": ["Action 1", "Action 2", "Action 3"],
  "suggestion_brief": "Trame de brief matinal prête à utiliser (2-3 phrases max, ton motivant)"
}}

Conseils :
- Sois concret et actionnable
- Utilise le tutoiement
- Mentionne les prénoms des vendeurs si pertinent
- UTILISE UNIQUEMENT LES CHIFFRES FOURNIS CI-DESSUS (ne jamais inventer de chiffres)
- Si tu mentionnes un chiffre, il DOIT correspondre EXACTEMENT aux données fournies
- Ne mentionne QUE les vendeurs listés ci-dessus
- Ton positif mais lucide"""

        user_message = UserMessage(text=prompt)
        response = await chat.send_message(user_message)
        
        # Clean and parse response
        content = response.strip()
        if content.startswith('```'):
            content = content.split('```')[1]
            if content.startswith('json'):
                content = content[4:]
        content = content.strip()
        
        ai_result = json.loads(content)
        
        # Create bilan object
        bilan = TeamBilan(
            manager_id=current_user['id'],
            periode=periode,
            synthese=ai_result.get('synthese', ''),
            points_forts=ai_result.get('points_forts', []),
            points_attention=ai_result.get('points_attention', []),
            actions_prioritaires=ai_result.get('actions_prioritaires', []),
            suggestion_brief=ai_result.get('suggestion_brief', ''),
            kpi_resume={
                "ca_total": round(total_ca, 2),
                "ventes": total_ventes,
                "clients": total_clients,
                "panier_moyen": round(panier_moyen_equipe, 2),
                "taux_transformation": round(taux_transfo_equipe, 2)
            },
            competences_moyenne=competences_moyenne,
            donnees_sources=team_data  # Données brutes pour vérification
        )
        
        # Save to database
        doc = bilan.model_dump()
        doc['created_at'] = doc['created_at'].isoformat()
        await db.team_bilans.insert_one(doc)
        
        return bilan
        
    except Exception as e:
        logger.error(f"Error generating team bilan: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error generating bilan: {str(e)}")

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
- Langage managérial retail
- Maximum 15 lignes au total
- Orienté solution et action
- Langage managérial retail
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

# Include router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
