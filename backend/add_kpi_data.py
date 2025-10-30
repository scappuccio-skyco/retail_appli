#!/usr/bin/env python3
"""
Script pour ajouter plus de données KPI pour chaque vendeur
"""
import asyncio
import os
import sys
from datetime import datetime, timedelta, timezone
from motor.motor_asyncio import AsyncIOMotorClient
import random
import uuid

# MongoDB connection
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
client = AsyncIOMotorClient(MONGO_URL)
db = client['retail_coach']

# IDs de vendeurs existants (basé sur l'application)
SELLER_IDS = [
    "647f438b-d3c7-4286-81bc-3682a443c480",  # Test Vendeur 2 / vendeur2@test.com
]

async def add_kpi_data():
    """Add 365 days (1 year) of KPI data for specified sellers"""
    
    print(f"Adding KPI data for {len(SELLER_IDS)} sellers...")
    
    for seller_id in SELLER_IDS:
        print(f"\nGenerating KPI data for seller {seller_id}...")
        
        # Generate data for last 365 days (1 year)
        added_count = 0
        for day_offset in range(365):
            date = datetime.now(timezone.utc) - timedelta(days=day_offset)
            
            # Generate realistic KPI data with some variation
            base_ventes = random.randint(5, 15)
            base_ca = random.uniform(800, 2500)
            nb_ventes = base_ventes
            ca_journalier = base_ca
            nb_clients = random.randint(base_ventes + 2, base_ventes + 10)
            panier_moyen = ca_journalier / nb_ventes if nb_ventes > 0 else 0
            taux_transformation = (nb_ventes / nb_clients * 100) if nb_clients > 0 else 0
            
            # Check if entry already exists for this date
            existing = await db.kpi_entries.find_one({
                "seller_id": seller_id,
                "date": date.date().isoformat()
            })
            
            if existing:
                continue
            
            kpi_entry = {
                "id": str(uuid.uuid4()),
                "seller_id": seller_id,
                "date": date.date().isoformat(),
                "ca_journalier": round(ca_journalier, 2),
                "nb_ventes": nb_ventes,
                "panier_moyen": round(panier_moyen, 2),
                "nb_clients": nb_clients,
                "taux_transformation": round(taux_transformation, 2),
                "created_at": date.isoformat()
            }
            
            await db.kpi_entries.insert_one(kpi_entry)
            added_count += 1
        
        print(f"  ✅ Added {added_count} days of KPI data for seller {seller_id} (Total: 365 days)")
    
    print("\n✅ KPI data generation complete! Added 1 year of data.")

if __name__ == "__main__":
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        loop.run_until_complete(add_kpi_data())
    finally:
        loop.close()
