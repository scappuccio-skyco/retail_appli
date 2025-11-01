#!/usr/bin/env python3
"""
Script to migrate existing KPI data to add nb_articles field and recalculate indice_vente
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

async def migrate_kpi_data():
    MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
    DB_NAME = os.environ.get('DB_NAME', 'retail_coach_db')
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    print("Migrating KPI entries...")
    
    # Get all KPI entries
    entries = await db.kpi_entries.find({}, {'_id': 0}).to_list(100000)
    print(f"Found {len(entries)} KPI entries")
    
    updated_count = 0
    for entry in entries:
        # Add nb_articles if missing (default to 0)
        if 'nb_articles' not in entry:
            # Estimate nb_articles based on nb_ventes (average 2 articles per sale)
            nb_articles = entry.get('nb_ventes', 0) * 2
            
            # Recalculate indice_vente
            ca = entry.get('ca_journalier', 0)
            indice_vente = round(ca / nb_articles, 2) if nb_articles > 0 else 0
            
            await db.kpi_entries.update_one(
                {'id': entry['id']},
                {'$set': {
                    'nb_articles': nb_articles,
                    'indice_vente': indice_vente
                }}
            )
            updated_count += 1
    
    print(f"✅ Updated {updated_count} KPI entries with nb_articles and indice_vente")
    
    # Create default KPI config for all managers
    managers = await db.users.find({'role': 'manager'}, {'_id': 0, 'id': 1}).to_list(1000)
    print(f"\nFound {len(managers)} managers")
    
    config_count = 0
    for manager in managers:
        existing_config = await db.kpi_configs.find_one({'manager_id': manager['id']})
        if not existing_config:
            from datetime import datetime, timezone
            config = {
                'id': str(__import__('uuid').uuid4()),
                'manager_id': manager['id'],
                'track_ca': True,
                'track_ventes': True,
                'track_clients': True,
                'track_articles': True,
                'created_at': datetime.now(timezone.utc).isoformat(),
                'updated_at': datetime.now(timezone.utc).isoformat()
            }
            await db.kpi_configs.insert_one(config)
            config_count += 1
    
    print(f"✅ Created {config_count} default KPI configurations")
    print("\nMigration complete!")

if __name__ == "__main__":
    asyncio.run(migrate_kpi_data())
