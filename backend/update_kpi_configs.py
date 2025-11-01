#!/usr/bin/env python3
"""
Script to update KPI configs to new structure
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

async def update_kpi_configs():
    MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
    DB_NAME = os.environ.get('DB_NAME', 'retail_coach_db')
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    print("Updating KPI configs to new structure...")
    
    # Get all KPI configs
    configs = await db.kpi_configs.find({}, {'_id': 0}).to_list(1000)
    print(f"Found {len(configs)} KPI configs")
    
    updated_count = 0
    for config in configs:
        # Check if old structure
        if 'enabled' in config and 'track_ca' not in config:
            await db.kpi_configs.update_one(
                {'id': config['id']},
                {'$set': {
                    'track_ca': True,
                    'track_ventes': True,
                    'track_clients': True,
                    'track_articles': True
                },
                '$unset': {
                    'enabled': ''
                }}
            )
            updated_count += 1
            print(f"  Updated config for manager {config.get('manager_id')}")
    
    print(f"✅ Updated {updated_count} KPI configurations")

if __name__ == "__main__":
    asyncio.run(update_kpi_configs())
