"""
Script pour mettre à jour le mot de passe de tous les vendeurs
Nouveau mot de passe : password123
"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import bcrypt

# Configuration
MONGO_URL = "mongodb://localhost:27017"
DB_NAME = "retail_coach"
NEW_PASSWORD = "password123"

async def update_sellers_password():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    print("🔐 Mise à jour du mot de passe des vendeurs...")
    print(f"   Nouveau mot de passe : {NEW_PASSWORD}\n")
    
    # Récupérer tous les vendeurs
    sellers = await db.users.find({
        "role": "seller"
    }, {"_id": 0, "id": 1, "name": 1, "email": 1}).to_list(1000)
    
    print(f"📊 Vendeurs trouvés : {len(sellers)}\n")
    
    if len(sellers) == 0:
        print("❌ Aucun vendeur trouvé dans la base de données")
        client.close()
        return
    
    # Hasher le nouveau mot de passe
    hashed_password = bcrypt.hashpw(NEW_PASSWORD.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    
    # Mettre à jour tous les vendeurs
    updated_count = 0
    
    for seller in sellers:
        result = await db.users.update_one(
            {"id": seller['id']},
            {"$set": {"password": hashed_password}}
        )
        
        if result.modified_count > 0:
            updated_count += 1
            print(f"   ✓ {seller['name']} ({seller['email']})")
    
    print(f"\n✅ Mise à jour terminée !")
    print(f"   {updated_count}/{len(sellers)} vendeurs mis à jour")
    print(f"   Nouveau mot de passe : {NEW_PASSWORD}")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(update_sellers_password())
