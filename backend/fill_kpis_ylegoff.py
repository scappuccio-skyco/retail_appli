import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from datetime import datetime
import uuid
import random

async def fill_kpis():
    # Connect to MongoDB
    mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
    client = AsyncIOMotorClient(mongo_url)
    db = client.retail_coach  # Utiliser la bonne base de données
    
    # Get manager
    manager = await db.users.find_one({"email": "y.legoff@skyco.fr"}, {"_id": 0})
    if not manager:
        print("❌ Manager non trouvé")
        return
    
    print(f"✅ Manager trouvé: {manager['name']} ({manager['email']})")
    manager_id = manager['id']
    
    # Get sellers
    sellers = await db.users.find({"manager_id": manager_id, "role": "seller"}, {"_id": 0}).to_list(length=None)
    print(f"✅ {len(sellers)} vendeurs trouvés\n")
    
    # Define the last 3 months
    months = [
        {"name": "Septembre 2024", "start": "2024-09-01", "end": "2024-09-30"},
        {"name": "Octobre 2024", "start": "2024-10-01", "end": "2024-10-31"},
        {"name": "Novembre 2024", "start": "2024-11-01", "end": "2024-11-30"},
    ]
    
    print("📊 Création des KPIs pour les 3 derniers mois...\n")
    
    for seller in sellers:
        print(f"📈 Vendeur: {seller['name']}")
        
        for month in months:
            # Check if KPI already exists
            existing_kpi = await db.kpis.find_one({
                "seller_id": seller['id'],
                "period_start": month['start'],
                "period_end": month['end']
            }, {"_id": 0})
            
            if existing_kpi:
                print(f"   ⚠️  KPI existe déjà pour {month['name']} - Mise à jour...")
                # Update existing KPI with new values
                ca_base = random.randint(18000, 38000)
                ventes_base = random.randint(90, 170)
                articles_base = random.randint(140, 280)
                panier_moyen = round(ca_base / ventes_base, 2) if ventes_base > 0 else 0
                upt = round(articles_base / ventes_base, 2) if ventes_base > 0 else 0
                
                await db.kpis.update_one(
                    {"id": existing_kpi['id']},
                    {"$set": {
                        "ca": ca_base,
                        "ventes": ventes_base,
                        "articles": articles_base,
                        "panier_moyen": panier_moyen,
                        "upt": upt,
                        "updated_at": datetime.now().isoformat()
                    }}
                )
                print(f"   ✅ KPI mis à jour pour {month['name']}: CA={ca_base}€, Ventes={ventes_base}, Articles={articles_base}")
            else:
                # Create new KPI
                ca_base = random.randint(18000, 38000)
                ventes_base = random.randint(90, 170)
                articles_base = random.randint(140, 280)
                panier_moyen = round(ca_base / ventes_base, 2) if ventes_base > 0 else 0
                upt = round(articles_base / ventes_base, 2) if ventes_base > 0 else 0
                
                kpi_data = {
                    "id": str(uuid.uuid4()),
                    "seller_id": seller['id'],
                    "manager_id": manager_id,
                    "period_start": month['start'],
                    "period_end": month['end'],
                    "ca": ca_base,
                    "ventes": ventes_base,
                    "articles": articles_base,
                    "panier_moyen": panier_moyen,
                    "upt": upt,
                    "created_at": datetime.now().isoformat(),
                    "updated_at": datetime.now().isoformat()
                }
                
                await db.kpis.insert_one(kpi_data)
                print(f"   ✅ KPI créé pour {month['name']}: CA={ca_base}€, Ventes={ventes_base}, Articles={articles_base}")
        
        print()
    
    print("🎉 Tous les KPIs ont été créés/mis à jour avec succès!")
    print(f"\n📧 Connexion Manager: {manager['email']} / password123")
    print("📧 Connexion Vendeurs: [prenom].[nom]@skyco.fr / password123")

# Run
asyncio.run(fill_kpis())
