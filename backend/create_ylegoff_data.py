import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from passlib.context import CryptContext
import uuid
from datetime import datetime, timedelta
import random

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

async def create_manager_and_data():
    # Connect to MongoDB
    mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
    client = AsyncIOMotorClient(mongo_url)
    db = client.retail_performer
    
    # Create manager
    manager_id = str(uuid.uuid4())
    manager_data = {
        "id": manager_id,
        "email": "y.legoff@skyco.fr",
        "password": pwd_context.hash("password123"),
        "name": "Yann Le Goff",
        "role": "manager",
        "store_name": "Skyco Paris",
        "created_at": datetime.now().isoformat()
    }
    
    # Check if manager already exists
    existing = await db.users.find_one({"email": "y.legoff@skyco.fr"})
    if existing:
        print("⚠️  Manager existe déjà, utilisation de l'ID existant")
        manager_id = existing['id']
        manager_data = existing
    else:
        await db.users.insert_one(manager_data)
        print(f"✅ Manager créé: {manager_data['name']} ({manager_data['email']})")
    
    # Create sellers
    sellers_data = [
        {"name": "Sophie Dubois", "email": "sophie.dubois@skyco.fr"},
        {"name": "Pierre Martin", "email": "pierre.martin@skyco.fr"},
        {"name": "Julie Bernard", "email": "julie.bernard@skyco.fr"},
        {"name": "Thomas Roux", "email": "thomas.roux@skyco.fr"},
    ]
    
    sellers = []
    for seller_info in sellers_data:
        existing_seller = await db.users.find_one({"email": seller_info['email']})
        if existing_seller:
            print(f"⚠️  Vendeur existe déjà: {seller_info['name']}")
            sellers.append(existing_seller)
        else:
            seller_id = str(uuid.uuid4())
            seller_data = {
                "id": seller_id,
                "email": seller_info['email'],
                "password": pwd_context.hash("password123"),
                "name": seller_info['name'],
                "role": "seller",
                "manager_id": manager_id,
                "created_at": datetime.now().isoformat()
            }
            await db.users.insert_one(seller_data)
            sellers.append(seller_data)
            print(f"✅ Vendeur créé: {seller_data['name']} ({seller_data['email']})")
    
    # Generate KPIs for the last 3 months (September, October, November 2024)
    months = [
        {"name": "Septembre 2024", "start": "2024-09-01", "end": "2024-09-30"},
        {"name": "Octobre 2024", "start": "2024-10-01", "end": "2024-10-31"},
        {"name": "Novembre 2024", "start": "2024-11-01", "end": "2024-11-30"},
    ]
    
    print("\n📊 Création des KPIs pour les 3 derniers mois...")
    
    for seller in sellers:
        for month in months:
            # Generate realistic KPI data
            ca_base = random.randint(15000, 35000)
            ventes_base = random.randint(80, 150)
            articles_base = random.randint(120, 250)
            panier_moyen = ca_base / ventes_base if ventes_base > 0 else 0
            upt = articles_base / ventes_base if ventes_base > 0 else 0
            
            kpi_data = {
                "id": str(uuid.uuid4()),
                "seller_id": seller['id'],
                "manager_id": manager_id,
                "period_start": month['start'],
                "period_end": month['end'],
                "ca": ca_base,
                "ventes": ventes_base,
                "articles": articles_base,
                "panier_moyen": round(panier_moyen, 2),
                "upt": round(upt, 2),
                "created_at": datetime.now().isoformat(),
                "updated_at": datetime.now().isoformat()
            }
            
            # Check if KPI already exists for this period
            existing_kpi = await db.kpis.find_one({
                "seller_id": seller['id'],
                "period_start": month['start'],
                "period_end": month['end']
            })
            
            if existing_kpi:
                print(f"   ⚠️  KPI existe déjà pour {seller['name']} - {month['name']}")
            else:
                await db.kpis.insert_one(kpi_data)
                print(f"   ✅ KPI créé pour {seller['name']} - {month['name']}: CA={ca_base}€, Ventes={ventes_base}, Articles={articles_base}")
    
    print("\n🎉 Données créées avec succès!")
    print(f"\n📧 Connexion Manager: {manager_data['email']} / password123")
    print(f"📧 Connexion Vendeurs: [nom]@skyco.fr / password123")

# Run
asyncio.run(create_manager_and_data())
