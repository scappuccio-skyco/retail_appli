"""
Script de migration pour créer les indexes MongoDB manquants
Optimise les performances des requêtes batch de la Vague 2

Usage:
    python backend/scripts/init_db_indexes.py
"""
import asyncio
import os
import sys
from pathlib import Path

# Add parent directory to path to import core modules
backend_root = Path(__file__).parent.parent
sys.path.insert(0, str(backend_root))

from motor.motor_asyncio import AsyncIOMotorClient


async def create_all_indexes():
    """
    Crée tous les indexes MongoDB nécessaires pour optimiser les requêtes batch.
    Utilise background=True pour ne pas bloquer la base de données.
    """
    # Get MongoDB connection from environment
    mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
    db_name = os.environ.get('DB_NAME', 'retail_coach')
    
    print(f"🔌 Connexion à MongoDB: {mongo_url}")
    print(f"📊 Base de données: {db_name}")
    
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    try:
        # Test connection
        await db.command('ping')
        print("✅ Connexion MongoDB établie\n")
    except Exception as e:
        print(f"❌ Erreur de connexion MongoDB: {e}")
        return
    
    indexes_created = 0
    indexes_skipped = 0
    indexes_failed = 0
    
    # ==========================================
    # INDEX COMPOSÉS CRITIQUES (Vague 2)
    # ==========================================
    
    print("=" * 60)
    print("📈 CRÉATION DES INDEX COMPOSÉS CRITIQUES")
    print("=" * 60)
    
    # 1. manager_kpis - Index composé pour requêtes batch
    try:
        await db.manager_kpis.create_index(
            [("manager_id", 1), ("date", -1), ("store_id", 1)],
            background=True,
            name="manager_date_store_idx"
        )
        print("✅ Index créé: manager_kpis.manager_date_store_idx [(manager_id, date, store_id)]")
        indexes_created += 1
    except Exception as e:
        if "already exists" in str(e).lower() or "duplicate" in str(e).lower():
            print("⏭️  Index déjà existant: manager_kpis.manager_date_store_idx")
            indexes_skipped += 1
        else:
            print(f"❌ Erreur création index manager_kpis: {e}")
            indexes_failed += 1
    
    # 2. kpi_entries - Vérifier/créer index composé
    try:
        await db.kpi_entries.create_index(
            [("seller_id", 1), ("date", -1)],
            background=True,
            name="seller_date_idx"
        )
        print("✅ Index créé/vérifié: kpi_entries.seller_date_idx [(seller_id, date)]")
        indexes_created += 1
    except Exception as e:
        if "already exists" in str(e).lower() or "duplicate" in str(e).lower():
            print("⏭️  Index déjà existant: kpi_entries.seller_date_idx")
            indexes_skipped += 1
        else:
            print(f"❌ Erreur création index kpi_entries: {e}")
            indexes_failed += 1
    
    # 3. objectives - Index pour requêtes par manager et période
    try:
        await db.objectives.create_index(
            [("manager_id", 1), ("period_start", 1)],
            background=True,
            name="manager_period_start_idx"
        )
        print("✅ Index créé: objectives.manager_period_start_idx [(manager_id, period_start)]")
        indexes_created += 1
    except Exception as e:
        if "already exists" in str(e).lower() or "duplicate" in str(e).lower():
            print("⏭️  Index déjà existant: objectives.manager_period_start_idx")
            indexes_skipped += 1
        else:
            print(f"❌ Erreur création index objectives: {e}")
            indexes_failed += 1
    
    # 4. objectives - Index composé pour store_id + period
    try:
        await db.objectives.create_index(
            [("store_id", 1), ("period_start", 1), ("period_end", 1)],
            background=True,
            name="store_period_idx"
        )
        print("✅ Index créé: objectives.store_period_idx [(store_id, period_start, period_end)]")
        indexes_created += 1
    except Exception as e:
        if "already exists" in str(e).lower() or "duplicate" in str(e).lower():
            print("⏭️  Index déjà existant: objectives.store_period_idx")
            indexes_skipped += 1
        else:
            print(f"❌ Erreur création index objectives: {e}")
            indexes_failed += 1
    
    # ==========================================
    # INDEX SIMPLES & TTL
    # ==========================================
    
    print("\n" + "=" * 60)
    print("⏰ CRÉATION DES INDEX TTL (AUTO-NETTOYAGE)")
    print("=" * 60)
    
    # 5. ai_usage_logs - Index sur timestamp
    try:
        await db.ai_usage_logs.create_index(
            [("timestamp", -1)],
            background=True,
            name="timestamp_idx"
        )
        print("✅ Index créé: ai_usage_logs.timestamp_idx [(timestamp)]")
        indexes_created += 1
    except Exception as e:
        if "already exists" in str(e).lower() or "duplicate" in str(e).lower():
            print("⏭️  Index déjà existant: ai_usage_logs.timestamp_idx")
            indexes_skipped += 1
        else:
            print(f"❌ Erreur création index ai_usage_logs.timestamp: {e}")
            indexes_failed += 1
    
    # 6. ai_usage_logs - Index composé user_id + timestamp
    try:
        await db.ai_usage_logs.create_index(
            [("user_id", 1), ("timestamp", -1)],
            background=True,
            name="user_timestamp_idx"
        )
        print("✅ Index créé: ai_usage_logs.user_timestamp_idx [(user_id, timestamp)]")
        indexes_created += 1
    except Exception as e:
        if "already exists" in str(e).lower() or "duplicate" in str(e).lower():
            print("⏭️  Index déjà existant: ai_usage_logs.user_timestamp_idx")
            indexes_skipped += 1
        else:
            print(f"❌ Erreur création index ai_usage_logs.user_timestamp: {e}")
            indexes_failed += 1
    
    # 7. ai_usage_logs - TTL de 365 jours
    try:
        await db.ai_usage_logs.create_index(
            "timestamp",
            expireAfterSeconds=365 * 24 * 60 * 60,  # 365 jours
            background=True,
            name="ai_usage_logs_ttl"
        )
        print("✅ Index TTL créé: ai_usage_logs (expiration 365 jours)")
        indexes_created += 1
    except Exception as e:
        if "already exists" in str(e).lower() or "duplicate" in str(e).lower():
            print("⏭️  Index TTL déjà existant: ai_usage_logs")
            indexes_skipped += 1
        else:
            print(f"❌ Erreur création TTL ai_usage_logs: {e}")
            indexes_failed += 1
    
    # 8. system_logs - TTL de 90 jours
    try:
        await db.system_logs.create_index(
            "created_at",
            expireAfterSeconds=90 * 24 * 60 * 60,  # 90 jours
            background=True,
            name="system_logs_ttl"
        )
        print("✅ Index TTL créé: system_logs (expiration 90 jours)")
        indexes_created += 1
    except Exception as e:
        if "already exists" in str(e).lower() or "duplicate" in str(e).lower():
            print("⏭️  Index TTL déjà existant: system_logs")
            indexes_skipped += 1
        else:
            print(f"❌ Erreur création TTL system_logs: {e}")
            indexes_failed += 1
    
    # 9. payment_transactions - Index sur user_id
    try:
        await db.payment_transactions.create_index(
            [("user_id", 1), ("created_at", -1)],
            background=True,
            name="user_created_idx"
        )
        print("✅ Index créé: payment_transactions.user_created_idx [(user_id, created_at)]")
        indexes_created += 1
    except Exception as e:
        if "already exists" in str(e).lower() or "duplicate" in str(e).lower():
            print("⏭️  Index déjà existant: payment_transactions.user_created_idx")
            indexes_skipped += 1
        else:
            print(f"❌ Erreur création index payment_transactions: {e}")
            indexes_failed += 1
    
    # 10. admin_logs - TTL de 180 jours
    try:
        await db.admin_logs.create_index(
            "created_at",
            expireAfterSeconds=180 * 24 * 60 * 60,  # 180 jours
            background=True,
            name="admin_logs_ttl"
        )
        print("✅ Index TTL créé: admin_logs (expiration 180 jours)")
        indexes_created += 1
    except Exception as e:
        if "already exists" in str(e).lower() or "duplicate" in str(e).lower():
            print("⏭️  Index TTL déjà existant: admin_logs")
            indexes_skipped += 1
        else:
            print(f"❌ Erreur création TTL admin_logs: {e}")
            indexes_failed += 1
    
    # ==========================================
    # RÉSUMÉ
    # ==========================================
    
    print("\n" + "=" * 60)
    print("📊 RÉSUMÉ")
    print("=" * 60)
    print(f"✅ Index créés: {indexes_created}")
    print(f"⏭️  Index déjà existants: {indexes_skipped}")
    print(f"❌ Erreurs: {indexes_failed}")
    print("=" * 60)
    
    if indexes_failed == 0:
        print("\n🎉 Tous les indexes ont été créés ou étaient déjà présents!")
        print("💡 Les indexes en background peuvent prendre quelques minutes à se construire.")
        print("💡 Utilisez le script verify_indexes.py pour vérifier leur utilisation.")
    else:
        print(f"\n⚠️  {indexes_failed} erreur(s) lors de la création des indexes.")
        print("💡 Vérifiez les logs ci-dessus pour plus de détails.")
    
    client.close()


if __name__ == "__main__":
    asyncio.run(create_all_indexes())
