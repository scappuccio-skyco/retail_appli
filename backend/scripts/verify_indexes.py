"""
Script de vérification des indexes MongoDB
Utilise .explain('executionStats') pour prouver que les requêtes utilisent les indexes

Usage:
    python -m backend.scripts.verify_indexes
    ou
    python backend/scripts/verify_indexes.py
"""
import asyncio
import os
import sys
from pathlib import Path
from datetime import datetime, timezone, timedelta

# Add parent directory to path to import core modules
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from motor.motor_asyncio import AsyncIOMotorClient
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def verify_indexes():
    """
    Vérifie que les requêtes batch de la Vague 2 utilisent bien les indexes créés.
    """
    mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
    db_name = os.environ.get('DB_NAME', 'retail_coach')
    
    print(f"🔌 Connexion à MongoDB: {mongo_url}")
    print(f"📊 Base de données: {db_name}\n")
    
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    try:
        await db.command('ping')
        print("✅ Connexion MongoDB établie\n")
    except Exception as e:
        print(f"❌ Erreur de connexion MongoDB: {e}")
        return
    
    # Dates de test
    today = datetime.now(timezone.utc).date().isoformat()
    start_date = (datetime.now(timezone.utc) - timedelta(days=30)).date().isoformat()
    end_date = today
    
    print("=" * 80)
    print("🔍 VÉRIFICATION DES INDEXES - REQUÊTES BATCH (VAGUE 2)")
    print("=" * 80)
    
    # ==========================================
    # TEST 1: manager_kpis - Batch query avec manager_id, date, store_id
    # ==========================================
    
    print("\n📊 TEST 1: manager_kpis - Requête batch (admin.py)")
    print("-" * 80)
    
    # Simuler la requête batch de admin.py
    test_manager_id = "test_manager_123"  # ID fictif pour le test
    test_store_id = "test_store_123"
    
    query = {
        "manager_id": test_manager_id,
        "date": {"$gte": start_date, "$lte": end_date},
        "store_id": test_store_id
    }
    
    try:
        explain_result = await db.manager_kpis.find(query).explain("executionStats")
        execution_stats = explain_result.get('executionStats', {})
        winning_plan = explain_result.get('queryPlanner', {}).get('winningPlan', {})
        
        stage = winning_plan.get('stage', '')
        index_used = winning_plan.get('indexName', '')
        
        print(f"📝 Requête: {query}")
        print(f"📈 Stage: {stage}")
        print(f"🔑 Index utilisé: {index_used if index_used else 'AUCUN (COLLECTION SCAN!)'}")
        print(f"📊 Documents examinés: {execution_stats.get('totalDocsExamined', 0)}")
        print(f"📊 Documents retournés: {execution_stats.get('nReturned', 0)}")
        print(f"⏱️  Temps d'exécution: {execution_stats.get('executionTimeMillis', 0)}ms")
        
        if index_used and 'manager_date_store_idx' in index_used:
            print("✅ SUCCÈS: Index manager_date_store_idx utilisé!")
        elif stage == 'IXSCAN':
            print("✅ SUCCÈS: Un index est utilisé (peut être un autre index valide)")
        else:
            print("❌ ÉCHEC: Collection scan détecté - Index non utilisé!")
            
    except Exception as e:
        print(f"❌ Erreur lors du test: {e}")
    
    # ==========================================
    # TEST 2: kpi_entries - Batch query avec seller_id, date
    # ==========================================
    
    print("\n📊 TEST 2: kpi_entries - Requête batch (seller_service.py)")
    print("-" * 80)
    
    test_seller_ids = ["seller_1", "seller_2", "seller_3"]  # IDs fictifs
    
    query = {
        "seller_id": {"$in": test_seller_ids},
        "date": {"$gte": start_date, "$lte": end_date}
    }
    
    try:
        explain_result = await db.kpi_entries.find(query).explain("executionStats")
        execution_stats = explain_result.get('executionStats', {})
        winning_plan = explain_result.get('queryPlanner', {}).get('winningPlan', {})
        
        stage = winning_plan.get('stage', '')
        index_used = winning_plan.get('indexName', '')
        
        print(f"📝 Requête: seller_id in [{len(test_seller_ids)} IDs], date range")
        print(f"📈 Stage: {stage}")
        print(f"🔑 Index utilisé: {index_used if index_used else 'AUCUN (COLLECTION SCAN!)'}")
        print(f"📊 Documents examinés: {execution_stats.get('totalDocsExamined', 0)}")
        print(f"📊 Documents retournés: {execution_stats.get('nReturned', 0)}")
        print(f"⏱️  Temps d'exécution: {execution_stats.get('executionTimeMillis', 0)}ms")
        
        if index_used and ('seller_date_idx' in index_used or 'seller_id' in index_used.lower()):
            print("✅ SUCCÈS: Index seller_date_idx utilisé!")
        elif stage == 'IXSCAN':
            print("✅ SUCCÈS: Un index est utilisé")
        else:
            print("❌ ÉCHEC: Collection scan détecté - Index non utilisé!")
            
    except Exception as e:
        print(f"❌ Erreur lors du test: {e}")
    
    # ==========================================
    # TEST 3: objectives - Batch query avec manager_id, period_start
    # ==========================================
    
    print("\n📊 TEST 3: objectives - Requête batch (seller_service.py)")
    print("-" * 80)
    
    query = {
        "manager_id": test_manager_id,
        "period_start": {"$lte": end_date},
        "period_end": {"$gte": start_date}
    }
    
    try:
        explain_result = await db.objectives.find(query).explain("executionStats")
        execution_stats = explain_result.get('executionStats', {})
        winning_plan = explain_result.get('queryPlanner', {}).get('winningPlan', {})
        
        stage = winning_plan.get('stage', '')
        index_used = winning_plan.get('indexName', '')
        
        print(f"📝 Requête: manager_id + period range")
        print(f"📈 Stage: {stage}")
        print(f"🔑 Index utilisé: {index_used if index_used else 'AUCUN (COLLECTION SCAN!)'}")
        print(f"📊 Documents examinés: {execution_stats.get('totalDocsExamined', 0)}")
        print(f"📊 Documents retournés: {execution_stats.get('nReturned', 0)}")
        print(f"⏱️  Temps d'exécution: {execution_stats.get('executionTimeMillis', 0)}ms")
        
        if index_used and ('manager_period' in index_used.lower() or 'period' in index_used.lower()):
            print("✅ SUCCÈS: Index manager_period_start_idx utilisé!")
        elif stage == 'IXSCAN':
            print("✅ SUCCÈS: Un index est utilisé")
        else:
            print("❌ ÉCHEC: Collection scan détecté - Index non utilisé!")
            
    except Exception as e:
        print(f"❌ Erreur lors du test: {e}")
    
    # ==========================================
    # TEST 4: ai_usage_logs - Aggregation batch avec user_id, timestamp
    # ==========================================
    
    print("\n📊 TEST 4: ai_usage_logs - Aggregation batch (admin.py)")
    print("-" * 80)
    
    test_user_ids = ["user_1", "user_2", "user_3"]
    
    pipeline = [
        {"$match": {"user_id": {"$in": test_user_ids}}},
        {"$group": {"_id": None, "total": {"$sum": "$credits_consumed"}}}
    ]
    
    try:
        explain_result = await db.ai_usage_logs.aggregate(pipeline).explain("executionStats")
        stages = explain_result.get('stages', [])
        
        print(f"📝 Pipeline: $match user_id in [{len(test_user_ids)} IDs] + $group")
        
        if stages:
            first_stage = stages[0]
            stage_type = first_stage.get('stage', '')
            index_used = first_stage.get('indexName', '')
            
            print(f"📈 Premier stage: {stage_type}")
            print(f"🔑 Index utilisé: {index_used if index_used else 'AUCUN (COLLECTION SCAN!)'}")
            
            if index_used and ('user_timestamp' in index_used.lower() or 'timestamp' in index_used.lower()):
                print("✅ SUCCÈS: Index user_timestamp_idx utilisé!")
            elif stage_type == 'IXSCAN':
                print("✅ SUCCÈS: Un index est utilisé")
            else:
                print("❌ ÉCHEC: Collection scan détecté - Index non utilisé!")
        else:
            print("⚠️  Impossible d'analyser le plan d'exécution")
            
    except Exception as e:
        print(f"❌ Erreur lors du test: {e}")
    
    # ==========================================
    # TEST 5: payment_transactions - Batch query avec user_id, created_at
    # ==========================================
    
    print("\n📊 TEST 5: payment_transactions - Aggregation batch (admin.py)")
    print("-" * 80)
    
    test_gerant_ids = ["gerant_1", "gerant_2"]
    
    pipeline = [
        {"$match": {"user_id": {"$in": test_gerant_ids}}},
        {"$sort": {"created_at": -1}},
        {"$group": {"_id": "$user_id", "last_transaction": {"$first": "$$ROOT"}}}
    ]
    
    try:
        explain_result = await db.payment_transactions.aggregate(pipeline).explain("executionStats")
        stages = explain_result.get('stages', [])
        
        print(f"📝 Pipeline: $match user_id in [{len(test_gerant_ids)} IDs] + $sort + $group")
        
        if stages:
            first_stage = stages[0]
            stage_type = first_stage.get('stage', '')
            index_used = first_stage.get('indexName', '')
            
            print(f"📈 Premier stage: {stage_type}")
            print(f"🔑 Index utilisé: {index_used if index_used else 'AUCUN (COLLECTION SCAN!)'}")
            
            if index_used and 'user_created' in index_used.lower():
                print("✅ SUCCÈS: Index user_created_idx utilisé!")
            elif stage_type == 'IXSCAN':
                print("✅ SUCCÈS: Un index est utilisé")
            else:
                print("❌ ÉCHEC: Collection scan détecté - Index non utilisé!")
        else:
            print("⚠️  Impossible d'analyser le plan d'exécution")
            
    except Exception as e:
        print(f"❌ Erreur lors du test: {e}")
    
    # ==========================================
    # LISTE TOUS LES INDEXES CRÉÉS
    # ==========================================
    
    print("\n" + "=" * 80)
    print("📋 LISTE DES INDEXES PAR COLLECTION")
    print("=" * 80)
    
    collections_to_check = [
        'manager_kpis',
        'kpi_entries',
        'objectives',
        'ai_usage_logs',
        'payment_transactions',
        'system_logs',
        'admin_logs'
    ]
    
    for collection_name in collections_to_check:
        try:
            collection = db[collection_name]
            indexes = await collection.list_indexes().to_list(100)
            
            print(f"\n📦 {collection_name}:")
            if indexes:
                for idx in indexes:
                    idx_name = idx.get('name', 'unknown')
                    idx_keys = idx.get('key', {})
                    ttl = idx.get('expireAfterSeconds')
                    
                    keys_str = ', '.join([f"{k}: {v}" for k, v in idx_keys.items()])
                    ttl_str = f" (TTL: {ttl}s)" if ttl else ""
                    print(f"  - {idx_name}: [{keys_str}]{ttl_str}")
            else:
                print("  ⚠️  Aucun index trouvé")
                
        except Exception as e:
            print(f"  ❌ Erreur: {e}")
    
    print("\n" + "=" * 80)
    print("✅ Vérification terminée")
    print("=" * 80)
    
    client.close()


if __name__ == "__main__":
    asyncio.run(verify_indexes())
