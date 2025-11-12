#!/usr/bin/env python3
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone
import uuid

MONGO_URL = "mongodb://localhost:27017"
DB_NAME = "retail_coach"
MANAGER_ID = "f332dd18-5011-4744-a965-91ca38c9ed0d"

async def create_sellers():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    sellers = [
        {"name": "Vendeur Test 1", "email": "vendeur1@test.com"},
        {"name": "Vendeur Test 2", "email": "vendeur2@test.com"},
        {"name": "Vendeur Test 3", "email": "vendeur3@test.com"},
        {"name": "Vendeur Test 4", "email": "vendeur4@test.com"},
    ]
    
    for seller in sellers:
        # Check if already exists
        existing = await db.users.find_one({"email": seller["email"]})
        if existing:
            print(f"✅ {seller['email']} already exists")
            continue
        
        user = {
            "id": str(uuid.uuid4()),
            "email": seller["email"],
            "name": seller["name"],
            "password": "$2b$10$YourHashedPassword",  # password
            "role": "seller",
            "manager_id": MANAGER_ID,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.users.insert_one(user)
        print(f"✅ Created {seller['email']}")
    
    # Count sellers
    count = await db.users.count_documents({"manager_id": MANAGER_ID, "role": "seller"})
    print(f"\n📊 Total sellers for manager: {count}")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(create_sellers())
