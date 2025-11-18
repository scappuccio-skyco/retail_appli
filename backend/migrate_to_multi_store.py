"""
Script de Migration vers Architecture Multi-Magasins
====================================================

Ce script migre les données existantes vers la nouvelle architecture multi-magasins :
1. Crée 3 magasins fictifs (Paris, Lyon, Bordeaux)
2. Crée un utilisateur gérant par défaut
3. Répartit les managers existants entre les magasins
4. Assigne les vendeurs aux magasins de leurs managers
5. Ajoute store_id et gerant_id aux KPIs existants

Date : 2025-11-18
"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from passlib.context import CryptContext
import uuid
from datetime import datetime

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

async def migrate_to_multi_store():
    """Migration principale vers architecture multi-magasins"""
    
    print("=" * 60)
    print("🚀 MIGRATION VERS ARCHITECTURE MULTI-MAGASINS")
    print("=" * 60)
    print()
    
    # Connexion MongoDB
    mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
    client = AsyncIOMotorClient(mongo_url)
    db = client.retail_coach
    
    # ============================================
    # ÉTAPE 1 : Créer le Gérant par Défaut
    # ============================================
    print("📋 ÉTAPE 1/6 : Création du Gérant")
    print("-" * 60)
    
    gerant_email = "gerant@skyco.fr"
    gerant_password = "gerant123"
    
    # Vérifier si le gérant existe déjà
    existing_gerant = await db.users.find_one({"email": gerant_email})
    
    if existing_gerant:
        print(f"⚠️  Gérant existe déjà : {gerant_email}")
        gerant_id = existing_gerant['id']
    else:
        gerant_id = str(uuid.uuid4())
        gerant_data = {
            "id": gerant_id,
            "email": gerant_email,
            "password": pwd_context.hash(gerant_password),
            "name": "Directeur Skyco",
            "role": "gerant",
            "status": "active",
            "gerant_id": None,  # null pour le gérant
            "store_id": None,   # null par défaut
            "manager_id": None,
            "is_also_manager": False,
            "managed_store_id": None,
            "created_at": datetime.utcnow()
        }
        
        await db.users.insert_one(gerant_data)
        print(f"✅ Gérant créé : {gerant_email}")
    
    print(f"   📧 Email: {gerant_email}")
    print(f"   🔑 Mot de passe: {gerant_password}")
    print(f"   🆔 ID: {gerant_id}")
    print()
    
    # ============================================
    # ÉTAPE 2 : Créer les Magasins
    # ============================================
    print("📋 ÉTAPE 2/6 : Création des Magasins")
    print("-" * 60)
    
    stores_data = [
        {
            "id": str(uuid.uuid4()),
            "name": "Skyco Paris Centre",
            "location": "75001 Paris",
            "address": "123 Rue de Rivoli, 75001 Paris",
            "phone": "+33 1 42 60 30 00",
            "opening_hours": "9h-19h du Lundi au Samedi"
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Skyco Lyon Part-Dieu",
            "location": "69003 Lyon",
            "address": "45 Rue de la République, 69003 Lyon",
            "phone": "+33 4 78 63 40 00",
            "opening_hours": "9h-19h du Lundi au Samedi"
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Skyco Bordeaux Mériadeck",
            "location": "33000 Bordeaux",
            "address": "78 Cours de l'Intendance, 33000 Bordeaux",
            "phone": "+33 5 56 44 20 00",
            "opening_hours": "9h-19h du Lundi au Samedi"
        }
    ]
    
    stores = []
    for store_data in stores_data:
        # Vérifier si le magasin existe déjà
        existing_store = await db.stores.find_one({"name": store_data['name']})
        
        if existing_store:
            print(f"⚠️  Magasin existe déjà : {store_data['name']}")
            stores.append(existing_store)
        else:
            store = {
                **store_data,
                "gerant_id": gerant_id,
                "active": True,
                "created_at": datetime.utcnow().isoformat(),
                "updated_at": datetime.utcnow().isoformat()
            }
            
            await db.stores.insert_one(store)
            stores.append(store)
            print(f"✅ Magasin créé : {store['name']}")
            print(f"   📍 Localisation: {store['location']}")
            print(f"   🆔 ID: {store['id']}")
    
    print()
    
    # ============================================
    # ÉTAPE 3 : Récupérer les Managers Existants
    # ============================================
    print("📋 ÉTAPE 3/6 : Récupération des Managers Existants")
    print("-" * 60)
    
    existing_managers = await db.users.find({"role": "manager"}, {"_id": 0}).to_list(length=None)
    print(f"✅ {len(existing_managers)} manager(s) trouvé(s)")
    
    for manager in existing_managers:
        print(f"   👤 {manager['name']} ({manager['email']})")
    
    print()
    
    # ============================================
    # ÉTAPE 4 : Répartir les Managers entre Magasins
    # ============================================
    print("📋 ÉTAPE 4/6 : Répartition des Managers entre Magasins")
    print("-" * 60)
    
    if existing_managers:
        # Répartition équitable des managers
        for i, manager in enumerate(existing_managers):
            store = stores[i % len(stores)]  # Distribution cyclique
            
            await db.users.update_one(
                {"id": manager['id']},
                {"$set": {
                    "gerant_id": gerant_id,
                    "store_id": store['id']
                }}
            )
            
            print(f"✅ Manager {manager['name']} assigné à {store['name']}")
    else:
        print("⚠️  Aucun manager existant à répartir")
    
    print()
    
    # ============================================
    # ÉTAPE 5 : Assigner les Vendeurs aux Magasins
    # ============================================
    print("📋 ÉTAPE 5/6 : Assignment des Vendeurs aux Magasins")
    print("-" * 60)
    
    existing_sellers = await db.users.find({"role": "seller"}, {"_id": 0}).to_list(length=None)
    print(f"✅ {len(existing_sellers)} vendeur(s) trouvé(s)")
    
    for seller in existing_sellers:
        # Récupérer le manager du vendeur
        manager_id = seller.get('manager_id')
        
        if manager_id:
            # Trouver le magasin du manager
            manager = await db.users.find_one({"id": manager_id}, {"_id": 0})
            
            if manager and manager.get('store_id'):
                await db.users.update_one(
                    {"id": seller['id']},
                    {"$set": {
                        "gerant_id": gerant_id,
                        "store_id": manager['store_id']
                    }}
                )
                
                # Récupérer le nom du magasin
                store = await db.stores.find_one({"id": manager['store_id']}, {"_id": 0})
                store_name = store['name'] if store else "Magasin inconnu"
                
                print(f"✅ Vendeur {seller['name']} assigné à {store_name}")
            else:
                print(f"⚠️  Manager non trouvé pour {seller['name']}, assignation au premier magasin")
                await db.users.update_one(
                    {"id": seller['id']},
                    {"$set": {
                        "gerant_id": gerant_id,
                        "store_id": stores[0]['id']
                    }}
                )
        else:
            print(f"⚠️  Pas de manager pour {seller['name']}, assignation au premier magasin")
            await db.users.update_one(
                {"id": seller['id']},
                {"$set": {
                    "gerant_id": gerant_id,
                    "store_id": stores[0]['id']
                }}
            )
    
    print()
    
    # ============================================
    # ÉTAPE 6 : Migrer les KPIs (ajouter store_id et gerant_id)
    # ============================================
    print("📋 ÉTAPE 6/6 : Migration des KPIs")
    print("-" * 60)
    
    # Migrer kpi_entries
    kpi_entries = await db.kpi_entries.find({}, {"_id": 0}).to_list(length=None)
    print(f"   📊 {len(kpi_entries)} KPI entries trouvées")
    
    kpi_entries_migrated = 0
    for kpi in kpi_entries:
        seller_id = kpi.get('seller_id')
        
        if seller_id:
            # Récupérer le vendeur pour avoir son store_id
            seller = await db.users.find_one({"id": seller_id}, {"_id": 0})
            
            if seller and seller.get('store_id'):
                await db.kpi_entries.update_one(
                    {"id": kpi['id']},
                    {"$set": {
                        "store_id": seller['store_id'],
                        "gerant_id": gerant_id
                    }}
                )
                kpi_entries_migrated += 1
    
    print(f"✅ {kpi_entries_migrated} KPI entries migrées")
    
    # Migrer kpis (mensuels)
    kpis = await db.kpis.find({}, {"_id": 0}).to_list(length=None)
    print(f"   📊 {len(kpis)} KPIs mensuels trouvés")
    
    kpis_migrated = 0
    for kpi in kpis:
        seller_id = kpi.get('seller_id')
        
        if seller_id:
            seller = await db.users.find_one({"id": seller_id}, {"_id": 0})
            
            if seller and seller.get('store_id'):
                await db.kpis.update_one(
                    {"id": kpi['id']},
                    {"$set": {
                        "store_id": seller['store_id'],
                        "gerant_id": gerant_id
                    }}
                )
                kpis_migrated += 1
    
    print(f"✅ {kpis_migrated} KPIs mensuels migrés")
    
    # Migrer objectives
    objectives = await db.objectives.find({}, {"_id": 0}).to_list(length=None)
    print(f"   🎯 {len(objectives)} objectifs trouvés")
    
    objectives_migrated = 0
    for objective in objectives:
        # Les objectifs peuvent être collectifs ou individuels
        seller_id = objective.get('seller_id')
        manager_id = objective.get('manager_id')
        
        if seller_id:
            seller = await db.users.find_one({"id": seller_id}, {"_id": 0})
            if seller and seller.get('store_id'):
                await db.objectives.update_one(
                    {"id": objective['id']},
                    {"$set": {
                        "store_id": seller['store_id'],
                        "gerant_id": gerant_id
                    }}
                )
                objectives_migrated += 1
        elif manager_id:
            manager = await db.users.find_one({"id": manager_id}, {"_id": 0})
            if manager and manager.get('store_id'):
                await db.objectives.update_one(
                    {"id": objective['id']},
                    {"$set": {
                        "store_id": manager['store_id'],
                        "gerant_id": gerant_id
                    }}
                )
                objectives_migrated += 1
    
    print(f"✅ {objectives_migrated} objectifs migrés")
    
    # Migrer challenges
    challenges = await db.challenges.find({}, {"_id": 0}).to_list(length=None)
    print(f"   🏆 {len(challenges)} challenges trouvés")
    
    challenges_migrated = 0
    for challenge in challenges:
        seller_id = challenge.get('seller_id')
        manager_id = challenge.get('manager_id')
        
        if seller_id:
            seller = await db.users.find_one({"id": seller_id}, {"_id": 0})
            if seller and seller.get('store_id'):
                await db.challenges.update_one(
                    {"id": challenge['id']},
                    {"$set": {
                        "store_id": seller['store_id'],
                        "gerant_id": gerant_id
                    }}
                )
                challenges_migrated += 1
        elif manager_id:
            manager = await db.users.find_one({"id": manager_id}, {"_id": 0})
            if manager and manager.get('store_id'):
                await db.challenges.update_one(
                    {"id": challenge['id']},
                    {"$set": {
                        "store_id": manager['store_id'],
                        "gerant_id": gerant_id
                    }}
                )
                challenges_migrated += 1
    
    print(f"✅ {challenges_migrated} challenges migrés")
    
    print()
    
    # ============================================
    # RÉSUMÉ FINAL
    # ============================================
    print("=" * 60)
    print("✅ MIGRATION TERMINÉE AVEC SUCCÈS")
    print("=" * 60)
    print()
    
    print("📊 RÉSUMÉ :")
    print(f"   🏪 Magasins créés : {len(stores)}")
    print(f"   👤 Managers assignés : {len(existing_managers)}")
    print(f"   👥 Vendeurs assignés : {len(existing_sellers)}")
    print(f"   📈 KPI entries migrées : {kpi_entries_migrated}")
    print(f"   📊 KPIs mensuels migrés : {kpis_migrated}")
    print(f"   🎯 Objectifs migrés : {objectives_migrated}")
    print(f"   🏆 Challenges migrés : {challenges_migrated}")
    print()
    
    print("🔑 ACCÈS GÉRANT :")
    print(f"   📧 Email: {gerant_email}")
    print(f"   🔑 Mot de passe: {gerant_password}")
    print()
    
    print("🏪 MAGASINS CRÉÉS :")
    for store in stores:
        print(f"   📍 {store['name']} - {store['location']}")
    print()
    
    # Compter les utilisateurs par magasin
    print("👥 RÉPARTITION PAR MAGASIN :")
    for store in stores:
        managers_count = await db.users.count_documents({"store_id": store['id'], "role": "manager"})
        sellers_count = await db.users.count_documents({"store_id": store['id'], "role": "seller"})
        print(f"   📍 {store['name']}:")
        print(f"      - {managers_count} manager(s)")
        print(f"      - {sellers_count} vendeur(s)")
    print()
    
    print("=" * 60)
    print("🎉 Vous pouvez maintenant tester l'architecture multi-magasins !")
    print("=" * 60)

if __name__ == "__main__":
    asyncio.run(migrate_to_multi_store())
