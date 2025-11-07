import asyncio
import bcrypt
import uuid
from datetime import datetime, timezone, timedelta
from motor.motor_asyncio import AsyncIOMotorClient
import os
import random

# Get mongo connection
mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
client = AsyncIOMotorClient(mongo_url)
db = client['retail_coach']

# French names for sellers
FIRST_NAMES = [
    'Lucas', 'Emma', 'Hugo', 'Léa', 'Louis', 'Chloé', 'Mathis', 'Inès',
    'Nathan', 'Manon', 'Arthur', 'Sarah', 'Tom', 'Clara', 'Alexandre',
    'Camille', 'Maxime', 'Laura', 'Jules', 'Marine'
]

LAST_NAMES = [
    'Martin', 'Bernard', 'Dubois', 'Thomas', 'Robert', 'Richard', 'Petit',
    'Durand', 'Leroy', 'Moreau', 'Simon', 'Laurent', 'Lefebvre', 'Michel',
    'Garcia', 'David', 'Bertrand', 'Roux', 'Vincent', 'Fournier'
]

# Diagnostic questions (simplified)
DIAGNOSTIC_QUESTIONS = [
    "Communication et écoute client",
    "Connaissance produits",
    "Techniques de vente",
    "Gestion du stress",
    "Organisation personnelle",
    "Travail en équipe",
    "Réactivité face aux objections",
    "Présentation et accueil"
]

async def create_sellers_with_data():
    """Create 20 sellers with full diagnostic and 365 days of KPI data"""
    
    # Get manager
    manager = await db.users.find_one({"email": "manager@test.com"})
    if not manager:
        print("❌ Manager not found!")
        return
    
    manager_id = manager['id']
    print(f"✅ Manager found: {manager['name']} ({manager_id})")
    
    # Clear existing test sellers (optional - keep existing ones)
    # await db.users.delete_many({"email": {"$regex": "seller.*@retailtest.com"}})
    # await db.diagnostics.delete_many({})
    # await db.kpi_data.delete_many({})
    
    created_count = 0
    
    for i in range(20):
        first_name = random.choice(FIRST_NAMES)
        last_name = random.choice(LAST_NAMES)
        name = f"{first_name} {last_name}"
        email = f"seller{i+1}@retailtest.com"
        
        # Check if seller already exists
        existing = await db.users.find_one({"email": email})
        if existing:
            print(f"⚠️  Seller {email} already exists, skipping...")
            continue
        
        # Create seller
        seller_id = str(uuid.uuid4())
        hashed_password = bcrypt.hashpw("demo123".encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        
        seller = {
            "id": seller_id,
            "email": email,
            "password": hashed_password,
            "name": name,
            "role": "seller",
            "manager_id": manager_id,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.users.insert_one(seller)
        print(f"✅ Created seller: {name} ({email})")
        
        # Create diagnostic (completed)
        diagnostic_id = str(uuid.uuid4())
        answers = {}
        
        for idx, question in enumerate(DIAGNOSTIC_QUESTIONS):
            answers[f"q{idx+1}"] = random.randint(1, 5)  # Random score 1-5
        
        # Calculate average score
        avg_score = sum(answers.values()) / len(answers)
        
        # Determine profile based on score variance
        scores = list(answers.values())
        if max(scores) - min(scores) <= 1:
            profile = "equilibre"
        elif avg_score >= 4:
            profile = "excellence_commerciale"
        elif avg_score >= 3:
            profile = "communicant_naturel"
        else:
            profile = "potentiel_developper"
        
        diagnostic = {
            "id": diagnostic_id,
            "seller_id": seller_id,
            "answers": answers,
            "score": round(avg_score, 2),
            "profile": profile,
            "status": "completed",
            "completed_at": datetime.now(timezone.utc).isoformat(),
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.diagnostics.insert_one(diagnostic)
        print(f"  ✅ Diagnostic: score={avg_score:.2f}, profile={profile}")
        
        # Create 365 days of KPI data
        kpi_records = []
        base_ca = random.randint(800, 2500)  # Base daily CA
        base_ventes = random.randint(5, 25)  # Base daily sales
        base_articles = random.randint(15, 80)  # Base daily articles
        base_clients = random.randint(5, 20)  # Base daily clients
        
        for day in range(365):
            date = (datetime.now(timezone.utc) - timedelta(days=365-day)).date().isoformat()
            
            # Add some variance (+/- 30%)
            variance = random.uniform(0.7, 1.3)
            
            ca = round(base_ca * variance, 2)
            ventes = max(1, int(base_ventes * variance))
            articles = max(1, int(base_articles * variance))
            clients = max(1, int(base_clients * variance))
            
            # Calculate derived KPIs
            panier_moyen = round(ca / ventes, 2) if ventes > 0 else 0
            indice_vente = round(articles / ventes, 2) if ventes > 0 else 0
            taux_transformation = round((ventes / clients * 100), 2) if clients > 0 else 0
            
            kpi_record = {
                "id": str(uuid.uuid4()),
                "seller_id": seller_id,
                "manager_id": manager_id,
                "date": date,
                "ca": ca,
                "ventes": ventes,
                "articles": articles,
                "clients": clients,
                "panier_moyen": panier_moyen,
                "indice_vente": indice_vente,
                "taux_transformation": taux_transformation,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            
            kpi_records.append(kpi_record)
        
        # Bulk insert KPI data
        await db.kpi_data.insert_many(kpi_records)
        print(f"  ✅ Created 365 days of KPI data")
        
        created_count += 1
    
    print(f"\n🎉 Successfully created {created_count} sellers with diagnostics and 365 days of KPI data!")
    print(f"📧 All sellers use password: demo123")
    print(f"👤 Manager: manager@test.com")

if __name__ == "__main__":
    asyncio.run(create_sellers_with_data())
    client.close()
