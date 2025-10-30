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

async def add_kpi_data():
    """Add 90 days of KPI data for all sellers"""
    
    # Get all sellers
    sellers = await db.users.find({"role": "seller"}, {"_id": 0}).to_list(100)
    
    print(f"Found {len(sellers)} sellers")
    
    for seller in sellers:
        seller_id = seller['id']
        seller_name = seller['name']
        
        print(f"\nGenerating KPI data for {seller_name}...")
        
        # Generate data for last 90 days
        for day_offset in range(90):
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
                print(f"  KPI for {date.date()} already exists, skipping...")
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
        
        print(f"  ✅ Added 90 days of KPI data for {seller_name}")
    
    print("\n✅ KPI data generation complete!")

if __name__ == "__main__":
    asyncio.run(add_kpi_data())
