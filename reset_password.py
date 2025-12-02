#!/usr/bin/env python3
"""
Script pour réinitialiser le mot de passe d'un utilisateur
"""
import asyncio
import os
import sys
from pathlib import Path
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import bcrypt

# Load environment
ROOT_DIR = Path(__file__).parent / "backend"
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

def hash_password(password: str) -> str:
    """Hash a password using bcrypt"""
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')

async def reset_password(email: str, new_password: str):
    """Reset password for a user"""
    user = await db.users.find_one({"email": email})
    if not user:
        print(f"❌ Utilisateur {email} non trouvé")
        return False
    
    hashed = hash_password(new_password)
    await db.users.update_one(
        {"email": email},
        {"$set": {"password": hashed}}
    )
    
    print(f"✅ Mot de passe réinitialisé pour {email}")
    print(f"   Nouveau mot de passe: {new_password}")
    print(f"   Rôle: {user.get('role')}")
    print(f"   Nom: {user.get('name')}")
    return True

async def main():
    print("=== Réinitialisation de mots de passe ===\n")
    
    # Key accounts to reset
    accounts = [
        ("gerant@skyco.fr", "TestPassword123!"),
        ("y.legoff@skyco.fr", "TestPassword123!"),
        ("itadmin@testenterprise.com", "TestPassword123!"),
        ("admin@demo-enterprise.com", "DemoPassword123!"),
        ("admin@retailperformer.com", "AdminPassword123!"),
    ]
    
    for email, password in accounts:
        await reset_password(email, password)
        print()
    
    client.close()

if __name__ == "__main__":
    asyncio.run(main())
