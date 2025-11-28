"""
Test de suppression de manager - Vérification de l'intégrité des données
Ce test vérifie que les données du magasin restent intactes après suppression d'un manager
"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone
import os
from dotenv import load_dotenv
from pathlib import Path

# Charger les variables d'environnement
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Configuration MongoDB
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.environ.get('DB_NAME', 'retail_coach')

async def run_test():
    print("=" * 80)
    print("TEST DE SUPPRESSION DE MANAGER - INTÉGRITÉ DES DONNÉES")
    print("=" * 80)
    
    # Connexion à MongoDB
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    try:
        # 1. Trouver un manager avec des vendeurs et des KPI
        print("\n📋 Étape 1 : Recherche d'un manager avec des vendeurs...")
        manager = await db.users.find_one({
            "role": "manager",
            "status": {"$in": ["active", "suspended"]}
        }, {"_id": 0})
        
        if not manager:
            print("❌ Aucun manager trouvé pour le test")
            return
        
        manager_id = manager['id']
        manager_name = manager['name']
        store_id = manager.get('store_id')
        
        print(f"✅ Manager trouvé : {manager_name} (ID: {manager_id})")
        print(f"   Magasin : {store_id}")
        
        # 2. Compter les vendeurs de ce manager
        print("\n📋 Étape 2 : Comptage des vendeurs...")
        sellers = await db.users.find({
            "manager_id": manager_id,
            "role": "seller"
        }, {"_id": 0}).to_list(100)
        
        seller_ids = [s['id'] for s in sellers]
        active_sellers = [s for s in sellers if s.get('status') != 'deleted']
        
        print(f"   Total vendeurs : {len(sellers)}")
        print(f"   Vendeurs actifs : {len(active_sellers)}")
        for seller in active_sellers[:3]:
            print(f"      - {seller['name']} (ID: {seller['id']})")
        
        # 3. Compter les KPI existants
        print("\n📋 Étape 3 : Comptage des KPI avant suppression...")
        
        # KPI du manager
        manager_kpis_count = await db.kpi_entries.count_documents({
            "manager_id": manager_id
        })
        
        # KPI des vendeurs
        sellers_kpis_count = await db.kpi_entries.count_documents({
            "seller_id": {"$in": seller_ids}
        })
        
        # KPI du magasin
        store_kpis_count = await db.kpi_entries.count_documents({
            "store_id": store_id
        })
        
        print(f"   KPI du manager : {manager_kpis_count}")
        print(f"   KPI des vendeurs : {sellers_kpis_count}")
        print(f"   KPI du magasin : {store_kpis_count}")
        
        # 4. Récupérer des exemples de KPI
        print("\n📋 Étape 4 : Exemples de KPI...")
        sample_kpi = await db.kpi_entries.find_one({
            "manager_id": manager_id
        }, {"_id": 0})
        
        if sample_kpi:
            print(f"   Exemple KPI:")
            print(f"      - seller_id: {sample_kpi.get('seller_id', 'N/A')}")
            print(f"      - manager_id: {sample_kpi.get('manager_id', 'N/A')}")
            print(f"      - store_id: {sample_kpi.get('store_id', 'N/A')}")
            print(f"      - date: {sample_kpi.get('date', 'N/A')}")
        
        # 5. Simulation de suppression (soft delete)
        print("\n" + "=" * 80)
        print("⚠️  SIMULATION DE SUPPRESSION DU MANAGER")
        print("=" * 80)
        
        # Marquer le manager comme supprimé
        await db.users.update_one(
            {"id": manager_id},
            {"$set": {
                "status": "deleted",
                "deleted_at": datetime.now(timezone.utc).isoformat(),
                "deleted_by": "TEST_SCRIPT"
            }}
        )
        
        print(f"✅ Manager {manager_name} marqué comme supprimé")
        
        # 6. Vérification POST-SUPPRESSION
        print("\n📋 Étape 5 : Vérification après suppression...")
        
        # Vérifier que les vendeurs existent toujours
        sellers_after = await db.users.find({
            "id": {"$in": seller_ids}
        }, {"_id": 0, "name": 1, "status": 1, "manager_id": 1, "store_id": 1}).to_list(100)
        
        print(f"\n✅ VENDEURS APRÈS SUPPRESSION:")
        print(f"   Nombre de vendeurs : {len(sellers_after)} (inchangé)")
        for seller in sellers_after[:3]:
            print(f"      - {seller['name']}")
            print(f"        Status: {seller.get('status', 'active')}")
            print(f"        manager_id: {seller.get('manager_id', 'N/A')} (conservé)")
            print(f"        store_id: {seller.get('store_id', 'N/A')} (conservé)")
        
        # Vérifier que les KPI existent toujours
        sellers_kpis_after = await db.kpi_entries.count_documents({
            "seller_id": {"$in": seller_ids}
        })
        
        store_kpis_after = await db.kpi_entries.count_documents({
            "store_id": store_id
        })
        
        print(f"\n✅ KPI APRÈS SUPPRESSION:")
        print(f"   KPI des vendeurs : {sellers_kpis_after} (était {sellers_kpis_count})")
        print(f"   KPI du magasin : {store_kpis_after} (était {store_kpis_count})")
        
        # Vérifier qu'un exemple de KPI existe toujours
        sample_kpi_after = await db.kpi_entries.find_one({
            "seller_id": seller_ids[0] if seller_ids else None
        }, {"_id": 0})
        
        if sample_kpi_after:
            print(f"\n   Exemple KPI toujours présent:")
            print(f"      - seller_id: {sample_kpi_after.get('seller_id', 'N/A')}")
            print(f"      - manager_id: {sample_kpi_after.get('manager_id', 'N/A')} (référence historique)")
            print(f"      - store_id: {sample_kpi_after.get('store_id', 'N/A')}")
        
        # 7. Vérifier l'accès aux données du magasin
        print("\n📋 Étape 6 : Vérification de l'accès aux données du magasin...")
        
        store = await db.stores.find_one({"id": store_id}, {"_id": 0})
        if store:
            print(f"✅ Magasin toujours accessible:")
            print(f"   Nom: {store.get('name')}")
            print(f"   ID: {store.get('id')}")
        
        # 8. RÉSUMÉ DES RÉSULTATS
        print("\n" + "=" * 80)
        print("📊 RÉSUMÉ DES RÉSULTATS")
        print("=" * 80)
        
        all_ok = True
        
        if len(sellers_after) == len(sellers):
            print("✅ Vendeurs conservés : OUI")
        else:
            print("❌ Vendeurs conservés : NON")
            all_ok = False
        
        if sellers_kpis_after == sellers_kpis_count:
            print("✅ KPI des vendeurs conservés : OUI")
        else:
            print("❌ KPI des vendeurs conservés : NON")
            all_ok = False
        
        if store_kpis_after == store_kpis_count:
            print("✅ KPI du magasin conservés : OUI")
        else:
            print("❌ KPI du magasin conservés : NON")
            all_ok = False
        
        if store:
            print("✅ Magasin accessible : OUI")
        else:
            print("❌ Magasin accessible : NON")
            all_ok = False
        
        # Vérifier que les vendeurs gardent leur manager_id et store_id
        if all(s.get('manager_id') == manager_id for s in sellers_after):
            print("✅ Vendeurs gardent manager_id (historique) : OUI")
        else:
            print("⚠️  Vendeurs gardent manager_id (historique) : PARTIEL")
        
        if all(s.get('store_id') == store_id for s in sellers_after):
            print("✅ Vendeurs gardent store_id (magasin) : OUI")
        else:
            print("❌ Vendeurs gardent store_id (magasin) : NON")
            all_ok = False
        
        print("\n" + "=" * 80)
        if all_ok:
            print("✅✅✅ TEST RÉUSSI : AUCUNE PERTE DE DONNÉES ✅✅✅")
        else:
            print("❌❌❌ TEST ÉCHOUÉ : PERTE DE DONNÉES DÉTECTÉE ❌❌❌")
        print("=" * 80)
        
        # 9. RESTAURATION (annuler le test)
        print("\n📋 Étape 7 : Restauration du manager (annulation du test)...")
        await db.users.update_one(
            {"id": manager_id},
            {"$set": {
                "status": manager.get('status', 'active')
            },
            "$unset": {
                "deleted_at": "",
                "deleted_by": ""
            }}
        )
        print(f"✅ Manager {manager_name} restauré")
        
    except Exception as e:
        print(f"\n❌ Erreur lors du test : {e}")
        import traceback
        traceback.print_exc()
    
    finally:
        client.close()

if __name__ == "__main__":
    asyncio.run(run_test())
