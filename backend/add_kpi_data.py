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
    """Add KPI data for 365 days back from today for ALL sellers"""
    
    # Get all sellers from database
    sellers = await db.users.find({"role": "seller"}, {"_id": 0, "id": 1, "name": 1}).to_list(100)
    
    if not sellers:
        print("No sellers found in database!")
        return
    
    # End date: today
    end_date = datetime.now(timezone.utc)
    # Start date: 365 days ago from today
    start_date = end_date - timedelta(days=365)
    
    # Calculate number of days
    total_days = (end_date - start_date).days + 1
    
    print(f"Generating KPI data from {start_date.date()} to {end_date.date()}")
    print(f"Total days: {total_days}")
    print(f"Adding KPI data for {len(sellers)} sellers...")
    
    for seller in sellers:
        seller_id = seller['id']
        seller_name = seller.get('name', 'Unknown')
        print(f"\nGenerating KPI data for {seller_name} ({seller_id})...")
        
        added_count = 0
        updated_count = 0
        
        # Generate data for each day from start_date to end_date
        current_date = start_date
        while current_date <= end_date:
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
                "date": current_date.date().isoformat()
            })
            
            if existing:
                # Update existing entry
                await db.kpi_entries.update_one(
                    {"seller_id": seller_id, "date": current_date.date().isoformat()},
                    {"$set": {
                        "ca_journalier": round(ca_journalier, 2),
                        "nb_ventes": nb_ventes,
                        "panier_moyen": round(panier_moyen, 2),
                        "nb_clients": nb_clients,
                        "taux_transformation": round(taux_transformation, 2)
                    }}
                )
                updated_count += 1
            else:
                # Create new entry
                kpi_entry = {
                    "id": str(uuid.uuid4()),
                    "seller_id": seller_id,
                    "date": current_date.date().isoformat(),
                    "ca_journalier": round(ca_journalier, 2),
                    "nb_ventes": nb_ventes,
                    "panier_moyen": round(panier_moyen, 2),
                    "nb_clients": nb_clients,
                    "taux_transformation": round(taux_transformation, 2),
                    "created_at": current_date.isoformat()
                }
                await db.kpi_entries.insert_one(kpi_entry)
                added_count += 1
            
            # Move to next day
            current_date += timedelta(days=1)
        
        print(f"  ✅ {seller_name}: Added {added_count} new entries, Updated {updated_count} existing entries")
    
    print(f"\n✅ KPI data generation complete! Added data from 29/10/2024 to today for all sellers.")

if __name__ == "__main__":
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        loop.run_until_complete(add_kpi_data())
    finally:
        loop.close()
