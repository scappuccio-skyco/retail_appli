import asyncio
import sys
from datetime import datetime, timedelta, timezone
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv
import uuid
import random

load_dotenv()

MONGO_URL = os.environ.get('MONGO_URL')

async def fill_kpi_data():
    print(f"Connecting to MongoDB: {MONGO_URL}")
    client = AsyncIOMotorClient(MONGO_URL)
    db = client['retail_coach']
    
    # Test connection
    try:
        await client.admin.command('ping')
        print("✅ MongoDB connection successful")
    except Exception as e:
        print(f"❌ MongoDB connection failed: {e}")
        return
    
    # Get manager
    manager = await db.users.find_one({"email": "manager@demo.com"}, {"_id": 0})
    if not manager:
        print("Manager not found!")
        return
    
    # Get sellers
    sellers = await db.users.find({"manager_id": manager['id'], "role": "seller"}, {"_id": 0}).to_list(10)
    
    if not sellers:
        print("No sellers found!")
        return
    
    print(f"Found {len(sellers)} sellers")
    for seller in sellers:
        print(f"  - {seller['name']} ({seller['email']})")
    
    # Delete existing KPI entries for these sellers
    seller_ids = [s['id'] for s in sellers]
    result = await db.kpi_entries.delete_many({"seller_id": {"$in": seller_ids}})
    print(f"\nDeleted {result.deleted_count} existing KPI entries")
    
    # Generate KPI data for last 365 days
    today = datetime.now(timezone.utc)
    entries_to_insert = []
    
    for seller in sellers:
        print(f"\nGenerating data for {seller['name']}...")
        
        # Generate consistent performance profile for each seller
        base_ca = random.uniform(800, 1500)  # Base daily CA
        base_ventes = random.randint(8, 15)  # Base daily sales
        
        for day_offset in range(365):
            date = (today - timedelta(days=day_offset)).strftime('%Y-%m-%d')
            
            # Add some randomness and trends
            trend_factor = 1 + (day_offset / 180)  # Slight improvement over time
            daily_variation = random.uniform(0.7, 1.3)  # Daily variation
            
            ca_journalier = base_ca * trend_factor * daily_variation
            nb_ventes = max(1, int(base_ventes * trend_factor * daily_variation))
            nb_clients = int(nb_ventes * random.uniform(1.0, 1.3))
            nb_articles = int(nb_ventes * random.uniform(1.5, 2.5))
            nb_prospects = int(nb_ventes * random.uniform(3, 6))
            
            # Calculate derived KPIs
            panier_moyen = round(ca_journalier / nb_ventes, 2) if nb_ventes > 0 else 0
            taux_transformation = round((nb_ventes / nb_prospects) * 100, 2) if nb_prospects > 0 else None
            indice_vente = round(nb_articles / nb_ventes, 2) if nb_ventes > 0 else 0
            
            entry = {
                "id": str(uuid.uuid4()),
                "seller_id": seller['id'],
                "date": date,
                "ca_journalier": round(ca_journalier, 2),
                "nb_ventes": nb_ventes,
                "nb_clients": nb_clients,
                "nb_articles": nb_articles,
                "nb_prospects": nb_prospects,
                "panier_moyen": panier_moyen,
                "taux_transformation": taux_transformation,
                "indice_vente": indice_vente,
                "comment": None,
                "created_at": (today - timedelta(days=day_offset)).isoformat()
            }
            
            entries_to_insert.append(entry)
        
        print(f"  Generated {365} entries for {seller['name']}")
    
    # Insert all entries
    if entries_to_insert:
        await db.kpi_entries.insert_many(entries_to_insert)
        print(f"\n✅ Successfully inserted {len(entries_to_insert)} KPI entries")
        print(f"   Total: {len(entries_to_insert)} entries for {len(sellers)} sellers over 90 days")
    
    # Verify data
    print("\n📊 Verification:")
    for seller in sellers:
        count = await db.kpi_entries.count_documents({"seller_id": seller['id']})
        
        # Get date range
        entries = await db.kpi_entries.find({"seller_id": seller['id']}, {"date": 1, "_id": 0}).to_list(1000)
        if entries:
            dates = [e['date'] for e in entries]
            oldest = min(dates)
            newest = max(dates)
            
            # Calculate totals
            all_entries = await db.kpi_entries.find({"seller_id": seller['id']}, {"_id": 0}).to_list(1000)
            total_ca = sum(e['ca_journalier'] for e in all_entries)
            total_ventes = sum(e['nb_ventes'] for e in all_entries)
            
            print(f"  {seller['name']}:")
            print(f"    - {count} entries")
            print(f"    - From {oldest} to {newest}")
            print(f"    - Total CA: {total_ca:.2f} €")
            print(f"    - Total Ventes: {total_ventes}")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(fill_kpi_data())
