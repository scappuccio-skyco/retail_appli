"""
Script pour créer un compte SuperAdmin
Usage: python create_superadmin.py
"""
import asyncio
import bcrypt
import uuid
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone
import os
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

async def create_superadmin():
    # Connexion MongoDB
    mongo_url = os.environ['MONGO_URL']
    client = AsyncIOMotorClient(mongo_url)
    db = client[os.environ['DB_NAME']]
    
    # Données du super admin
    email = input("Email du SuperAdmin: ").strip()
    password = input("Mot de passe: ").strip()
    name = input("Nom: ").strip()
    
    # Vérifier si l'email existe déjà
    existing = await db.users.find_one({"email": email})
    if existing:
        print(f"❌ Un utilisateur avec l'email {email} existe déjà")
        if existing.get('role') == 'super_admin':
            print("✅ C'est déjà un SuperAdmin")
        else:
            update_existing = input("Voulez-vous le promouvoir en SuperAdmin ? (y/n): ").lower()
            if update_existing == 'y':
                await db.users.update_one(
                    {"email": email},
                    {"$set": {"role": "super_admin"}}
                )
                print("✅ Utilisateur promu en SuperAdmin")
        client.close()
        return
    
    # Hasher le mot de passe
    hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    
    # Créer le super admin
    superadmin = {
        "id": str(uuid.uuid4()),
        "email": email,
        "password": hashed_password,
        "name": name,
        "role": "super_admin",
        "status": "active",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.users.insert_one(superadmin)
    print(f"\n✅ SuperAdmin créé avec succès !")
    print(f"📧 Email: {email}")
    print(f"👤 Nom: {name}")
    print(f"🔑 Rôle: super_admin")
    print(f"\nVous pouvez maintenant vous connecter sur /superadmin")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(create_superadmin())
