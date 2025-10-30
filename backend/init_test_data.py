#!/usr/bin/env python3
"""
Script pour initialiser ou réinitialiser les données de test
"""
import asyncio
import os
import bcrypt
from motor.motor_asyncio import AsyncIOMotorClient
import uuid
from datetime import datetime, timezone

# MongoDB connection
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
client = AsyncIOMotorClient(MONGO_URL)
db = client['retail_coach']

async def init_test_data():
    """Initialize test data with proper manager-seller relationships"""
    
    print("Initializing test data...")
    
    # Create manager if doesn't exist
    manager_email = "manager1@test.com"
    manager = await db.users.find_one({"email": manager_email})
    
    if not manager:
        print(f"Creating manager: {manager_email}")
        manager_id = str(uuid.uuid4())
        hashed_password = bcrypt.hashpw("password123".encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        
        manager_doc = {
            "id": manager_id,
            "name": "Test Manager 1",
            "email": manager_email,
            "password": hashed_password,
            "role": "manager",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.users.insert_one(manager_doc)
        print(f"✅ Manager created with ID: {manager_id}")
    else:
        manager_id = manager['id']
        print(f"✅ Manager exists with ID: {manager_id}")
    
    # Create/update sellers
    sellers_data = [
        {
            "email": "sophie@test.com",
            "name": "Sophie Martin",
            "password": "password123"
        },
        {
            "email": "thomas@test.com",
            "name": "Thomas Dubois",
            "password": "password123"
        },
        {
            "email": "marie@test.com",
            "name": "Marie Leclerc",
            "password": "password123"
        },
        {
            "email": "vendeur2@test.com",
            "name": "Test Vendeur 2",
            "password": "password123"
        }
    ]
    
    for seller_data in sellers_data:
        existing_seller = await db.users.find_one({"email": seller_data["email"]})
        
        if existing_seller:
            # Update manager_id if it's missing or wrong
            if existing_seller.get('manager_id') != manager_id:
                await db.users.update_one(
                    {"email": seller_data["email"]},
                    {"$set": {"manager_id": manager_id}}
                )
                print(f"✅ Updated {seller_data['name']} - linked to manager {manager_id}")
            else:
                print(f"✅ {seller_data['name']} already linked to manager")
        else:
            # Create new seller
            seller_id = str(uuid.uuid4())
            hashed_password = bcrypt.hashpw(seller_data["password"].encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
            
            seller_doc = {
                "id": seller_id,
                "name": seller_data["name"],
                "email": seller_data["email"],
                "password": hashed_password,
                "role": "seller",
                "manager_id": manager_id,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.users.insert_one(seller_doc)
            print(f"✅ Created {seller_data['name']} - linked to manager {manager_id}")
    
    print("\n✅ Test data initialization complete!")
    print(f"\nManager: manager1@test.com / password123")
    print(f"Sellers: sophie@test.com, thomas@test.com, marie@test.com, vendeur2@test.com / password123")

if __name__ == "__main__":
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        loop.run_until_complete(init_test_data())
    finally:
        loop.close()
