#!/usr/bin/env python3
"""
Script pour réinitialiser le mot de passe d'un utilisateur
"""
import asyncio
import bcrypt
from motor.motor_asyncio import AsyncIOMotorClient
import os

async def reset_password():
    # Connexion MongoDB
    mongo_url = os.getenv('MONGO_URL', 'mongodb://localhost:27017')
    client = AsyncIOMotorClient(mongo_url)
    db = client['retail_performer']
    
    # Email de l'utilisateur
    email = "y.legoff@skyco.fr"
    
    # Nouveau mot de passe
    new_password = "demo123"
    
    # Hash du mot de passe avec bcrypt
    hashed_password = bcrypt.hashpw(new_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    
    # Mise à jour dans la base de données
    result = await db.users.update_one(
        {"email": email},
        {"$set": {"password": hashed_password}}
    )
    
    if result.matched_count > 0:
        print(f"✅ Mot de passe réinitialisé avec succès pour {email}")
        print(f"   Nouveau mot de passe : {new_password}")
    else:
        print(f"❌ Utilisateur {email} introuvable")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(reset_password())
