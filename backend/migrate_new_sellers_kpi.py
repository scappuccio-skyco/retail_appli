import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os

# Get mongo connection
mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
client = AsyncIOMotorClient(mongo_url)
db = client['retail_coach']

async def migrate_kpi_data():
    """Migrate KPI data from kpi_data to kpi_entries with correct field names"""
    
    # Get all new sellers (those with @retailtest.com)
    new_sellers = await db.users.find(
        {"email": {"$regex": "retailtest.com"}},
        {"_id": 0}
    ).to_list(100)
    
    print(f"Found {len(new_sellers)} new sellers to migrate")
    
    total_migrated = 0
    
    for seller in new_sellers:
        seller_id = seller['id']
        seller_name = seller['name']
        
        # Check if already has data in kpi_entries
        existing = await db.kpi_entries.count_documents({"seller_id": seller_id})
        if existing > 0:
            print(f"⚠️  {seller_name} already has {existing} entries in kpi_entries, skipping...")
            continue
        
        # Get all kpi_data for this seller
        kpi_data_records = await db.kpi_data.find(
            {"seller_id": seller_id},
            {"_id": 0}
        ).to_list(1000)
        
        if not kpi_data_records:
            print(f"⚠️  No KPI data found for {seller_name}")
            continue
        
        # Transform field names: ca -> ca_journalier, ventes -> nb_ventes, etc.
        kpi_entries_records = []
        for record in kpi_data_records:
            entry = {
                "id": record['id'],
                "seller_id": record['seller_id'],
                "manager_id": record['manager_id'],
                "date": record['date'],
                "ca_journalier": record.get('ca', 0),
                "nb_ventes": record.get('ventes', 0),
                "nb_articles": record.get('articles', 0),
                "nb_clients": record.get('clients', 0),
                "panier_moyen": record.get('panier_moyen', 0),
                "indice_vente": record.get('indice_vente', 0),
                "taux_transformation": record.get('taux_transformation', 0),
                "created_at": record.get('created_at')
            }
            kpi_entries_records.append(entry)
        
        # Insert into kpi_entries
        if kpi_entries_records:
            await db.kpi_entries.insert_many(kpi_entries_records)
            total_migrated += len(kpi_entries_records)
            print(f"✅ {seller_name}: Migrated {len(kpi_entries_records)} KPI records")
    
    print(f"\n🎉 Migration complete! Total records migrated: {total_migrated}")

if __name__ == "__main__":
    asyncio.run(migrate_kpi_data())
    client.close()
