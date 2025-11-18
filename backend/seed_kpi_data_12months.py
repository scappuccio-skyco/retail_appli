"""
Script pour générer des données KPI pour les 12 derniers mois
Du 18/11/2024 au 18/11/2025

- Managers : saisie prospects
- Vendeurs : saisie CA, Nombre de ventes, Nombre d'articles
"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timedelta
import random
import uuid

# Configuration
MONGO_URL = "mongodb://localhost:27017"
DB_NAME = "retail_coach"

async def seed_kpi_data():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    print("🚀 Début de la génération des données KPI pour 12 mois...")
    
    # Dates
    end_date = datetime(2025, 11, 18)
    start_date = datetime(2024, 11, 18)
    
    # Récupérer tous les vendeurs actifs
    sellers = await db.users.find({
        "role": "seller",
        "status": "active"
    }, {"_id": 0, "id": 1, "name": 1, "manager_id": 1, "store_id": 1}).to_list(100)
    
    print(f"📊 Vendeurs actifs trouvés : {len(sellers)}")
    
    # Récupérer tous les managers
    managers = await db.users.find({
        "role": "manager"
    }, {"_id": 0, "id": 1, "name": 1, "store_id": 1}).to_list(100)
    
    print(f"👔 Managers trouvés : {len(managers)}")
    
    # Supprimer les anciennes données pour éviter les doublons
    print("\n🗑️  Suppression des anciennes données KPI...")
    deleted_entries = await db.kpi_entries.delete_many({
        "date": {
            "$gte": start_date.strftime('%Y-%m-%d'),
            "$lte": end_date.strftime('%Y-%m-%d')
        }
    })
    print(f"   ✓ {deleted_entries.deleted_count} entrées vendeurs supprimées")
    
    deleted_manager_kpis = await db.manager_kpis.delete_many({
        "date": {
            "$gte": start_date.strftime('%Y-%m-%d'),
            "$lte": end_date.strftime('%Y-%m-%d')
        }
    })
    print(f"   ✓ {deleted_manager_kpis.deleted_count} entrées managers supprimées")
    
    # Générer les données jour par jour
    current_date = start_date
    total_days = (end_date - start_date).days + 1
    
    seller_entries_created = 0
    manager_kpis_created = 0
    
    print(f"\n📅 Génération de {total_days} jours de données...\n")
    
    while current_date <= end_date:
        date_str = current_date.strftime('%Y-%m-%d')
        weekday = current_date.weekday()  # 0=Lundi, 6=Dimanche
        is_weekend = weekday >= 5
        
        # Pour chaque vendeur
        for seller in sellers:
            # 80% de chance que le vendeur ait saisi ses données
            if random.random() < 0.80:
                # Facteur week-end (activité réduite)
                weekend_factor = 0.6 if is_weekend else 1.0
                
                # Facteur période (plus d'activité en fin de mois et avant Noël)
                day_of_month = current_date.day
                month = current_date.month
                period_factor = 1.0
                
                if day_of_month > 20:  # Fin de mois
                    period_factor = 1.3
                elif month == 12:  # Décembre (Noël)
                    period_factor = 1.5
                elif month in [7, 8]:  # Été (plus calme)
                    period_factor = 0.7
                
                # Générer des valeurs réalistes
                base_ca = random.uniform(500, 2000)
                ca_journalier = round(base_ca * weekend_factor * period_factor, 2)
                
                nb_ventes = max(1, int(random.uniform(3, 15) * weekend_factor * period_factor))
                nb_articles = max(nb_ventes, int(random.uniform(nb_ventes, nb_ventes * 2.5)))
                
                # Créer l'entrée KPI vendeur
                entry = {
                    "id": str(uuid.uuid4()),
                    "seller_id": seller['id'],
                    "manager_id": seller.get('manager_id'),
                    "store_id": seller.get('store_id'),
                    "date": date_str,
                    "ca_journalier": ca_journalier,
                    "nb_ventes": nb_ventes,
                    "nb_articles": nb_articles,
                    "created_at": current_date.isoformat()
                }
                
                await db.kpi_entries.insert_one(entry)
                seller_entries_created += 1
        
        # Pour chaque manager (saisie prospects)
        for manager in managers:
            # 85% de chance que le manager ait saisi ses données
            if random.random() < 0.85:
                weekend_factor = 0.7 if is_weekend else 1.0
                
                # Prospects : entre 15 et 60 par jour
                nb_prospects = max(10, int(random.uniform(15, 60) * weekend_factor))
                
                # Créer l'entrée KPI manager
                manager_kpi = {
                    "id": str(uuid.uuid4()),
                    "manager_id": manager['id'],
                    "store_id": manager.get('store_id'),
                    "date": date_str,
                    "ca_journalier": 0,  # Manager ne saisit pas le CA
                    "nb_ventes": 0,
                    "nb_clients": 0,
                    "nb_articles": 0,
                    "nb_prospects": nb_prospects,
                    "created_at": current_date.isoformat()
                }
                
                await db.manager_kpis.insert_one(manager_kpi)
                manager_kpis_created += 1
        
        # Afficher la progression tous les 30 jours
        days_processed = (current_date - start_date).days + 1
        if days_processed % 30 == 0:
            progress = (days_processed / total_days) * 100
            print(f"   📈 Progression : {days_processed}/{total_days} jours ({progress:.1f}%)")
        
        current_date += timedelta(days=1)
    
    print(f"\n✅ Génération terminée !")
    print(f"   📊 Entrées vendeurs créées : {seller_entries_created}")
    print(f"   👔 Entrées managers créées : {manager_kpis_created}")
    print(f"   📅 Période : {start_date.strftime('%d/%m/%Y')} → {end_date.strftime('%d/%m/%Y')}")
    print(f"   🎯 Total : {seller_entries_created + manager_kpis_created} entrées")
    
    # Stats par magasin
    print("\n📍 Stats par magasin :")
    stores = await db.stores.find({"active": True}, {"_id": 0, "id": 1, "name": 1}).to_list(10)
    
    for store in stores:
        sellers_count = len([s for s in sellers if s.get('store_id') == store['id']])
        entries_count = await db.kpi_entries.count_documents({
            "store_id": store['id'],
            "date": {"$gte": start_date.strftime('%Y-%m-%d'), "$lte": end_date.strftime('%Y-%m-%d')}
        })
        print(f"   🏢 {store['name']}: {sellers_count} vendeurs, {entries_count} entrées")
    
    client.close()
    print("\n🎉 Script terminé avec succès !")

if __name__ == "__main__":
    asyncio.run(seed_kpi_data())
