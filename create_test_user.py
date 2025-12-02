#!/usr/bin/env python3
"""
Script pour créer un utilisateur de test en production
"""
import asyncio
import os
import sys
from pathlib import Path
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import bcrypt
from datetime import datetime, timezone
from uuid import uuid4

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

async def list_existing_users():
    """List all existing users"""
    print("\n=== Utilisateurs existants ===")
    users = await db.users.find({}, {"_id": 0, "email": 1, "role": 1, "name": 1}).to_list(100)
    if not users:
        print("Aucun utilisateur trouvé dans la base de données.")
    else:
        for i, user in enumerate(users, 1):
            print(f"{i}. {user.get('email')} - {user.get('role')} - {user.get('name', 'N/A')}")
    return users

async def create_test_gerant():
    """Create a test 'gérant' account"""
    email = "test@retail-coach.com"
    password = "TestPassword123!"
    name = "Test Gérant"
    
    # Check if user already exists
    existing = await db.users.find_one({"email": email})
    if existing:
        print(f"\n⚠️  L'utilisateur {email} existe déjà.")
        # Reset password
        hashed = hash_password(password)
        await db.users.update_one(
            {"email": email},
            {"$set": {"password": hashed}}
        )
        print(f"✅ Mot de passe réinitialisé pour {email}")
        print(f"   Email: {email}")
        print(f"   Mot de passe: {password}")
        return
    
    # Create new user
    user_id = str(uuid4())
    workspace_id = str(uuid4())
    hashed = hash_password(password)
    
    # Create workspace
    workspace = {
        "id": workspace_id,
        "name": f"Test Workspace",
        "owner_id": user_id,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.workspaces.insert_one(workspace)
    
    # Create user
    user = {
        "id": user_id,
        "email": email,
        "password": hashed,
        "name": name,
        "role": "gérant",
        "workspace_id": workspace_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "subscription_status": "trial",
        "trial_ends_at": (datetime.now(timezone.utc)).isoformat(),
        "ai_credits_remaining": 100
    }
    await db.users.insert_one(user)
    
    print(f"\n✅ Utilisateur créé avec succès!")
    print(f"   Email: {email}")
    print(f"   Mot de passe: {password}")
    print(f"   Rôle: gérant")
    print(f"   Workspace ID: {workspace_id}")

async def main():
    print("=== Gestion des utilisateurs de test ===")
    
    # List existing users
    await list_existing_users()
    
    # Create test user
    print("\n=== Création d'un utilisateur de test ===")
    await create_test_gerant()
    
    # List again to confirm
    await list_existing_users()
    
    client.close()

if __name__ == "__main__":
    asyncio.run(main())
