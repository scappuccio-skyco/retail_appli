#!/usr/bin/env python3
"""
Script pour créer un manager et ses vendeurs de test
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
import uuid
from datetime import datetime, timezone, timedelta
import bcrypt

# Configuration
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')

# Données du manager
MANAGER_DATA = {
    "email": "Manager12@test.com",
    "name": "Alex Martin",
    "password": "password123",  # Sera hashé
    "workspace_name": "Boutique Mode Paris"
}

# Données des 3 vendeurs
SELLERS_DATA = [
    {
        "email": "sophie.durand@test.com",
        "name": "Sophie Durand",
        "password": "password123"
    },
    {
        "email": "lucas.bernard@test.com",
        "name": "Lucas Bernard",
        "password": "password123"
    },
    {
        "email": "emma.petit@test.com",
        "name": "Emma Petit",
        "password": "password123"
    }
]

async def create_test_team():
    """Créer un manager et ses vendeurs"""
    client = AsyncIOMotorClient(MONGO_URL)
    db = client['retail_performer']
    
    print("🚀 Création de l'équipe de test...\n")
    
    # 1. Vérifier si le manager existe déjà
    existing_manager = await db.users.find_one({"email": MANAGER_DATA["email"]})
    if existing_manager:
        print(f"✅ Manager {MANAGER_DATA['email']} existe déjà")
        manager_id = existing_manager['id']
        workspace_id = existing_manager.get('workspace_id')
    else:
        # 2. Créer le workspace
        workspace_id = str(uuid.uuid4())
        workspace = {
            "id": workspace_id,
            "name": MANAGER_DATA["workspace_name"],
            "stripe_customer_id": None,
            "stripe_subscription_id": None,
            "stripe_subscription_item_id": None,
            "stripe_price_id": "price_1SS2XxIVM4C8dIGvpBRcYSNX",
            "stripe_quantity": 0,
            "subscription_status": "trialing",
            "trial_start": datetime.now(timezone.utc).isoformat(),
            "trial_end": (datetime.now(timezone.utc) + timedelta(days=14)).isoformat(),
            "current_period_start": None,
            "current_period_end": None,
            "cancel_at_period_end": False,
            "canceled_at": None,
            "ai_credits_remaining": 100,
            "ai_credits_used_this_month": 0,
            "last_credit_reset": None,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        await db.workspaces.insert_one(workspace)
        print(f"✅ Workspace créé: {MANAGER_DATA['workspace_name']} (ID: {workspace_id})")
        
        # 3. Créer le manager
        manager_id = str(uuid.uuid4())
        hashed_password = bcrypt.hashpw(MANAGER_DATA["password"].encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        
        manager = {
            "id": manager_id,
            "email": MANAGER_DATA["email"],
            "name": MANAGER_DATA["name"],
            "password": hashed_password,
            "role": "manager",
            "workspace_id": workspace_id,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.users.insert_one(manager)
        print(f"✅ Manager créé: {MANAGER_DATA['name']} ({MANAGER_DATA['email']})")
        print(f"   ID: {manager_id}")
        
        # 4. Créer une subscription en trial pour le manager
        subscription = {
            "id": str(uuid.uuid4()),
            "user_id": manager_id,
            "plan": "starter",
            "status": "trialing",
            "trial_start": datetime.now(timezone.utc).isoformat(),
            "trial_end": (datetime.now(timezone.utc) + timedelta(days=14)).isoformat(),
            "current_period_start": None,
            "current_period_end": None,
            "stripe_customer_id": None,
            "stripe_subscription_id": None,
            "stripe_subscription_item_id": None,
            "cancel_at_period_end": False,
            "canceled_at": None,
            "seats": 3,
            "used_seats": 0,
            "ai_credits_remaining": 100,
            "ai_credits_used_this_month": 0,
            "last_credit_reset": None,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        await db.subscriptions.insert_one(subscription)
        print(f"✅ Subscription créée (Trial 14 jours)")
    
    # 5. Créer les 3 vendeurs
    print(f"\n📝 Création de {len(SELLERS_DATA)} vendeurs...")
    
    for i, seller_data in enumerate(SELLERS_DATA, 1):
        # Vérifier si le vendeur existe déjà
        existing_seller = await db.users.find_one({"email": seller_data["email"]})
        if existing_seller:
            print(f"  ⚠️  Vendeur {i} ({seller_data['email']}) existe déjà - ignoré")
            continue
        
        seller_id = str(uuid.uuid4())
        hashed_password = bcrypt.hashpw(seller_data["password"].encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        
        seller = {
            "id": seller_id,
            "email": seller_data["email"],
            "name": seller_data["name"],
            "password": hashed_password,
            "role": "seller",
            "manager_id": manager_id,
            "workspace_id": workspace_id,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.users.insert_one(seller)
        print(f"  ✅ Vendeur {i}: {seller_data['name']} ({seller_data['email']})")
        print(f"     ID: {seller_id}")
    
    print("\n" + "="*60)
    print("🎉 ÉQUIPE CRÉÉE AVEC SUCCÈS !")
    print("="*60)
    print(f"\n📋 INFORMATIONS DE CONNEXION:")
    print(f"\n👤 MANAGER:")
    print(f"   Email    : {MANAGER_DATA['email']}")
    print(f"   Password : {MANAGER_DATA['password']}")
    print(f"   Name     : {MANAGER_DATA['name']}")
    
    print(f"\n👥 VENDEURS:")
    for i, seller in enumerate(SELLERS_DATA, 1):
        print(f"\n   Vendeur {i}:")
        print(f"   Email    : {seller['email']}")
        print(f"   Password : {seller['password']}")
        print(f"   Name     : {seller['name']}")
    
    print(f"\n🏢 WORKSPACE:")
    print(f"   Name     : {MANAGER_DATA['workspace_name']}")
    print(f"   ID       : {workspace_id}")
    
    print("\n" + "="*60)
    
    client.close()

if __name__ == "__main__":
    asyncio.run(create_test_team())
