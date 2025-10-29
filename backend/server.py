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
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class DiagnosticCreate(BaseModel):
    responses: dict

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
    # Always enabled since sellers only input 3 basic metrics
    enabled: bool = True
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
    # Calculated KPIs
    panier_moyen: float = 0
    taux_transformation: float = 0
    indice_vente: float = 0
    comment: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class KPIEntryCreate(BaseModel):
    date: str
    ca_journalier: float
    nb_ventes: int
    nb_clients: int
    comment: Optional[str] = None

class KPIConfigUpdate(BaseModel):
    enabled: bool

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
    if not user or not verify_password(credentials.password, user['password']):
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

# ===== MANAGER ROUTES =====
@api_router.get("/manager/sellers")
async def get_sellers(current_user: dict = Depends(get_current_user)):
    if current_user['role'] != 'manager':
        raise HTTPException(status_code=403, detail="Only managers can access this")
    
    sellers = await db.users.find({"manager_id": current_user['id']}, {"_id": 0, "password": 0}).to_list(1000)
    
    # Add stats for each seller
    result = []
    for seller in sellers:
        evals = await db.evaluations.find({"seller_id": seller['id']}, {"_id": 0}).to_list(1000)
        
        avg_score = 0
        last_feedback_date = None
        
        if evals:
            scores = []
            for e in evals:
                avg = (e['accueil'] + e['decouverte'] + e['argumentation'] + e['closing'] + e['fidelisation']) / 5
                scores.append(avg)
            avg_score = sum(scores) / len(scores)
            
            # Get latest evaluation date
            latest = max(evals, key=lambda x: x.get('created_at', ''))
            last_feedback_date = latest.get('created_at')
        
        result.append({
            **seller,
            "avg_score": round(avg_score, 2),
            "last_feedback_date": last_feedback_date,
            "total_evaluations": len(evals)
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
    
    # Get evaluations
    evals = await db.evaluations.find({"seller_id": seller_id}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    
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
   - son niveau global (Débutant / Intermédiaire / Expert terrain)
   - ses leviers de motivation (Relation, Reconnaissance, Performance, Découverte)

2. Rédige un retour structuré :
   - Une phrase d'introduction qui décrit son style.
   - Deux points forts concrets observés dans ses réponses.
   - Un axe d'amélioration principal avec un conseil précis.
   - Une phrase motivante adaptée à son profil.

3. Utilise un ton bienveillant, professionnel et simple.
4. Évite le jargon.

Réponds au format JSON avec cette structure exacte :
{{
  "style": "Convivial|Explorateur|Dynamique|Discret|Stratège",
  "level": "Débutant|Intermédiaire|Expert terrain",
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
            "level": "Intermédiaire",
            "motivation": "Relation",
            "summary": "Profil en cours d'analyse. Votre diagnostic a été enregistré avec succès."
        }

@api_router.post("/diagnostic", response_model=DiagnosticResult)
async def create_diagnostic(diagnostic_data: DiagnosticCreate, current_user: dict = Depends(get_current_user)):
    if current_user['role'] != 'seller':
        raise HTTPException(status_code=403, detail="Only sellers can create diagnostics")
    
    # Check if diagnostic already exists
    existing = await db.diagnostics.find_one({"seller_id": current_user['id']}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Diagnostic already completed")
    
    # Analyze with AI
    ai_analysis = await analyze_diagnostic_with_ai(diagnostic_data.responses)
    
    # Create diagnostic result
    diagnostic_obj = DiagnosticResult(
        seller_id=current_user['id'],
        responses=diagnostic_data.responses,
        ai_profile_summary=ai_analysis['summary'],
        style=ai_analysis['style'],
        level=ai_analysis['level'],
        motivation=ai_analysis['motivation']
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
    return KPI_DEFINITIONS

# Manager: Get/Update KPI Configuration
@api_router.get("/manager/kpi-config")
async def get_kpi_config(current_user: dict = Depends(get_current_user)):
    if current_user['role'] != 'manager':
        raise HTTPException(status_code=403, detail="Only managers can access KPI configuration")
    
    config = await db.kpi_configurations.find_one({"manager_id": current_user['id']}, {"_id": 0})
    
    if not config:
        # Create default config with no KPIs enabled
        default_config = KPIConfiguration(
            manager_id=current_user['id'],
            enabled_kpis=[]
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
    
    # Validate KPI keys
    for kpi_key in config_update.enabled_kpis:
        if kpi_key not in KPI_DEFINITIONS:
            raise HTTPException(status_code=400, detail=f"Invalid KPI key: {kpi_key}")
    
    config = await db.kpi_configurations.find_one({"manager_id": current_user['id']}, {"_id": 0})
    
    if not config:
        # Create new config
        new_config = KPIConfiguration(
            manager_id=current_user['id'],
            enabled_kpis=config_update.enabled_kpis
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
                "enabled_kpis": config_update.enabled_kpis,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        config['enabled_kpis'] = config_update.enabled_kpis
        config['updated_at'] = datetime.now(timezone.utc)
        return config

# Seller: Get enabled KPIs
@api_router.get("/seller/enabled-kpis")
async def get_enabled_kpis(current_user: dict = Depends(get_current_user)):
    if current_user['role'] != 'seller':
        raise HTTPException(status_code=403, detail="Only sellers can access this endpoint")
    
    if not current_user.get('manager_id'):
        return {"enabled_kpis": [], "kpi_definitions": {}}
    
    config = await db.kpi_configurations.find_one({"manager_id": current_user['manager_id']}, {"_id": 0})
    
    if not config:
        return {"enabled_kpis": [], "kpi_definitions": {}}
    
    # Return enabled KPIs with their definitions
    enabled_kpis = config.get('enabled_kpis', [])
    kpi_definitions = {key: KPI_DEFINITIONS[key] for key in enabled_kpis if key in KPI_DEFINITIONS}
    
    return {
        "enabled_kpis": enabled_kpis,
        "kpi_definitions": kpi_definitions
    }

# Seller: Submit KPI entry
@api_router.post("/seller/kpi-entry")
async def create_kpi_entry(entry_data: KPIEntryCreate, current_user: dict = Depends(get_current_user)):
    if current_user['role'] != 'seller':
        raise HTTPException(status_code=403, detail="Only sellers can submit KPI entries")
    
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
                "kpi_values": entry_data.kpi_values,
                "comment": entry_data.comment,
                "created_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        existing['kpi_values'] = entry_data.kpi_values
        existing['comment'] = entry_data.comment
        return existing
    
    # Create new entry
    entry = KPIEntry(
        seller_id=current_user['id'],
        date=entry_data.date,
        kpi_values=entry_data.kpi_values,
        comment=entry_data.comment
    )
    
    doc = entry.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.kpi_entries.insert_one(doc)
    
    return entry

# Seller: Get my KPI entries
@api_router.get("/seller/kpi-entries")
async def get_my_kpi_entries(days: int = 30, current_user: dict = Depends(get_current_user)):
    if current_user['role'] != 'seller':
        raise HTTPException(status_code=403, detail="Only sellers can access their KPI entries")
    
    entries = await db.kpi_entries.find(
        {"seller_id": current_user['id']},
        {"_id": 0}
    ).sort("date", -1).limit(days).to_list(days)
    
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
            {"_id": 0}
        ).sort("date", -1)
        
        summary.append({
            "seller_id": seller['id'],
            "seller_name": seller['name'],
            "latest_entry": latest_entry
        })
    
    return summary

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
