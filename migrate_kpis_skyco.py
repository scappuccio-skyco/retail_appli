import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone

MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
client = AsyncIOMotorClient(MONGO_URL)
db = client.retail_coach

async def migrate():
    """Migrer les KPI de la collection 'kpis' vers 'kpi_entries' avec le bon format"""
    
    # Trouver tous les KPI créés dans la collection 'kpis'
    kpis_to_migrate = await db.kpis.find({}, {"_id": 0}).to_list(length=1000)
    
    print(f"📦 Trouvé {len(kpis_to_migrate)} KPI à migrer")
    
    migrated = 0
    for kpi in kpis_to_migrate:
        kpi_data = kpi.get('kpi_data', {})
        
        # Convertir vers le format kpi_entries
        kpi_entry = {
            "id": kpi['id'],
            "seller_id": kpi['seller_id'],
            "date": kpi['date'],
            "ca_journalier": float(kpi_data.get('chiffre_affaires', 0)),
            "nb_ventes": int(kpi_data.get('nombre_ventes', 0)),
            "panier_moyen": float(kpi_data.get('panier_moyen', 0)),
            "nb_clients": int(kpi_data.get('nombre_clients', 0)),
            "taux_transformation": float(kpi_data.get('taux_conversion', 0)),
            "created_at": kpi.get('created_at', datetime.now(timezone.utc).isoformat())
        }
        
        # Insérer dans kpi_entries (upsert pour éviter les doublons)
        await db.kpi_entries.update_one(
            {"id": kpi_entry['id']},
            {"$set": kpi_entry},
            upsert=True
        )
        migrated += 1
    
    print(f"✅ {migrated} KPI migrés vers kpi_entries")
    
    # Vérifier le résultat
    print("\n📊 Vérification:")
    for seller_id in set(kpi['seller_id'] for kpi in kpis_to_migrate):
        count = await db.kpi_entries.count_documents({"seller_id": seller_id})
        seller = await db.users.find_one({"id": seller_id}, {"_id": 0, "name": 1})
        if seller:
            print(f"   {seller['name']}: {count} entrées KPI")

async def main():
    try:
        await migrate()
    finally:
        client.close()

if __name__ == "__main__":
    asyncio.run(main())
