"""
Script d'indexation MongoDB - Production Ready
Crée tous les indexes critiques identifiés dans l'audit architectural.

Usage:
    python -m backend.scripts.ensure_indexes
    ou
    python backend/scripts/ensure_indexes.py

⚠️ IMPORTANT: À exécuter lors de chaque déploiement pour s'assurer que tous les indexes sont présents.
"""
import asyncio
import os
import sys
from pathlib import Path

# Add parent directory to path to import core modules
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from motor.motor_asyncio import AsyncIOMotorClient
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def ensure_indexes():
    """
    Crée tous les indexes critiques pour la performance en production.
    
    Basé sur l'audit architectural et les requêtes fréquentes identifiées.
    """
    mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
    db_name = os.environ.get('DB_NAME', 'retail_coach')
    
    print("=" * 80)
    print("🔧 CRÉATION DES INDEXES MONGODB - PRODUCTION READY")
    print("=" * 80)
    print(f"🔌 Connexion: {mongo_url}")
    print(f"📊 Base de données: {db_name}\n")
    
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    try:
        await db.command('ping')
        print("✅ Connexion MongoDB établie\n")
    except Exception as e:
        print(f"❌ Erreur de connexion MongoDB: {e}")
        return
    
    indexes_created = 0
    indexes_skipped = 0
    errors = []
    
    # ==========================================
    # INDEXES CRITIQUES - Collections principales
    # ==========================================
    
    print("📦 Création des indexes critiques...\n")
    
    # 1. debriefs - Index composé (seller_id, created_at) pour requêtes fréquentes
    try:
        await db.debriefs.create_index(
            [("seller_id", 1), ("created_at", -1)],
            background=True,
            name="seller_created_at_idx"
        )
        print("✅ debriefs.seller_created_at_idx créé")
        indexes_created += 1
    except Exception as e:
        if "already exists" in str(e).lower() or "duplicate" in str(e).lower():
            print("⏭️  debriefs.seller_created_at_idx existe déjà")
            indexes_skipped += 1
        else:
            print(f"❌ Erreur création debriefs.seller_created_at_idx: {e}")
            errors.append(f"debriefs.seller_created_at_idx: {e}")
    
    # 2. diagnostics - Index sur seller_id (requêtes fréquentes)
    try:
        await db.diagnostics.create_index(
            [("seller_id", 1), ("created_at", -1)],
            background=True,
            name="seller_created_at_idx"
        )
        print("✅ diagnostics.seller_created_at_idx créé")
        indexes_created += 1
    except Exception as e:
        if "already exists" in str(e).lower() or "duplicate" in str(e).lower():
            print("⏭️  diagnostics.seller_created_at_idx existe déjà")
            indexes_skipped += 1
        else:
            print(f"❌ Erreur création diagnostics.seller_created_at_idx: {e}")
            errors.append(f"diagnostics.seller_created_at_idx: {e}")
    
    # 3. kpi_entries - Index composé (seller_id, date) - CRITIQUE
    try:
        await db.kpi_entries.create_index(
            [("seller_id", 1), ("date", -1)],
            background=True,
            name="seller_date_idx"
        )
        print("✅ kpi_entries.seller_date_idx créé")
        indexes_created += 1
    except Exception as e:
        if "already exists" in str(e).lower() or "duplicate" in str(e).lower():
            print("⏭️  kpi_entries.seller_date_idx existe déjà")
            indexes_skipped += 1
        else:
            print(f"❌ Erreur création kpi_entries.seller_date_idx: {e}")
            errors.append(f"kpi_entries.seller_date_idx: {e}")
    
    # 4. kpi_entries - Index composé (store_id, date)
    try:
        await db.kpi_entries.create_index(
            [("store_id", 1), ("date", -1)],
            background=True,
            name="store_date_idx"
        )
        print("✅ kpi_entries.store_date_idx créé")
        indexes_created += 1
    except Exception as e:
        if "already exists" in str(e).lower() or "duplicate" in str(e).lower():
            print("⏭️  kpi_entries.store_date_idx existe déjà")
            indexes_skipped += 1
        else:
            print(f"❌ Erreur création kpi_entries.store_date_idx: {e}")
            errors.append(f"kpi_entries.store_date_idx: {e}")
    
    # 5. manager_kpis - Index composé (manager_id, date, store_id) - CRITIQUE
    try:
        await db.manager_kpis.create_index(
            [("manager_id", 1), ("date", -1), ("store_id", 1)],
            background=True,
            name="manager_date_store_idx"
        )
        print("✅ manager_kpis.manager_date_store_idx créé")
        indexes_created += 1
    except Exception as e:
        if "already exists" in str(e).lower() or "duplicate" in str(e).lower():
            print("⏭️  manager_kpis.manager_date_store_idx existe déjà")
            indexes_skipped += 1
        else:
            print(f"❌ Erreur création manager_kpis.manager_date_store_idx: {e}")
            errors.append(f"manager_kpis.manager_date_store_idx: {e}")
    
    # 6. users - Index composé (store_id, role, status)
    try:
        await db.users.create_index(
            [("store_id", 1), ("role", 1), ("status", 1)],
            background=True,
            name="store_role_status_idx"
        )
        print("✅ users.store_role_status_idx créé")
        indexes_created += 1
    except Exception as e:
        if "already exists" in str(e).lower() or "duplicate" in str(e).lower():
            print("⏭️  users.store_role_status_idx existe déjà")
            indexes_skipped += 1
        else:
            print(f"❌ Erreur création users.store_role_status_idx: {e}")
            errors.append(f"users.store_role_status_idx: {e}")
    
    # 7. objectives - Index composé (store_id, status)
    try:
        await db.objectives.create_index(
            [("store_id", 1), ("status", 1)],
            background=True,
            name="store_status_idx"
        )
        print("✅ objectives.store_status_idx créé")
        indexes_created += 1
    except Exception as e:
        if "already exists" in str(e).lower() or "duplicate" in str(e).lower():
            print("⏭️  objectives.store_status_idx existe déjà")
            indexes_skipped += 1
        else:
            print(f"❌ Erreur création objectives.store_status_idx: {e}")
            errors.append(f"objectives.store_status_idx: {e}")
    
    # 8. challenges - Index composé (store_id, status)
    try:
        await db.challenges.create_index(
            [("store_id", 1), ("status", 1)],
            background=True,
            name="store_status_idx"
        )
        print("✅ challenges.store_status_idx créé")
        indexes_created += 1
    except Exception as e:
        if "already exists" in str(e).lower() or "duplicate" in str(e).lower():
            print("⏭️  challenges.store_status_idx existe déjà")
            indexes_skipped += 1
        else:
            print(f"❌ Erreur création challenges.store_status_idx: {e}")
            errors.append(f"challenges.store_status_idx: {e}")
    
    # 9. sales - Index composé (seller_id, date)
    try:
        await db.sales.create_index(
            [("seller_id", 1), ("date", -1)],
            background=True,
            name="seller_date_idx"
        )
        print("✅ sales.seller_date_idx créé")
        indexes_created += 1
    except Exception as e:
        if "already exists" in str(e).lower() or "duplicate" in str(e).lower():
            print("⏭️  sales.seller_date_idx existe déjà")
            indexes_skipped += 1
        else:
            print(f"❌ Erreur création sales.seller_date_idx: {e}")
            errors.append(f"sales.seller_date_idx: {e}")
    
    # 10. subscriptions - Index unique sur stripe_subscription_id (sécurité)
    try:
        await db.subscriptions.create_index(
            "stripe_subscription_id",
            unique=True,
            partialFilterExpression={
                "stripe_subscription_id": {"$exists": True, "$type": "string", "$gt": ""}
            },
            background=True,
            name="unique_stripe_subscription_id"
        )
        print("✅ subscriptions.unique_stripe_subscription_id créé")
        indexes_created += 1
    except Exception as e:
        if "already exists" in str(e).lower() or "duplicate" in str(e).lower():
            print("⏭️  subscriptions.unique_stripe_subscription_id existe déjà")
            indexes_skipped += 1
        else:
            print(f"❌ Erreur création subscriptions.unique_stripe_subscription_id: {e}")
            errors.append(f"subscriptions.unique_stripe_subscription_id: {e}")
    
    # ==========================================
    # RÉSUMÉ
    # ==========================================
    
    print("\n" + "=" * 80)
    print("📊 RÉSUMÉ")
    print("=" * 80)
    print(f"✅ Indexes créés: {indexes_created}")
    print(f"⏭️  Indexes existants (ignorés): {indexes_skipped}")
    if errors:
        print(f"❌ Erreurs: {len(errors)}")
        for error in errors:
            print(f"   - {error}")
    else:
        print("✅ Aucune erreur")
    
    print("\n" + "=" * 80)
    print("✅ Indexation terminée")
    print("=" * 80)
    print("\n💡 Note: Les indexes sont créés en background pour ne pas bloquer les opérations.")
    print("   Ils seront disponibles dans quelques secondes.")
    
    client.close()


if __name__ == "__main__":
    asyncio.run(ensure_indexes())
