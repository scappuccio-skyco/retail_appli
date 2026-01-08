"""
Script de vérification des doublons avant création d'index unique.

À exécuter AVANT déploiement pour vérifier:
- Doublons de stripe_subscription_id
- Valeurs null/incohérentes
- Données legacy à nettoyer
"""
import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()

MONGO_URL = os.environ.get('MONGO_URL')
DB_NAME = os.environ.get('DB_NAME', 'retail_coach')

async def check_duplicates():
    """Check for duplicate stripe_subscription_id values"""
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    print("🔍 Checking for duplicate stripe_subscription_id values...\n")
    
    # Find duplicates
    duplicates = await db.subscriptions.aggregate([
        {
            "$match": {
                "stripe_subscription_id": {"$exists": True, "$ne": None, "$ne": ""}
            }
        },
        {
            "$group": {
                "_id": "$stripe_subscription_id",
                "count": {"$sum": 1},
                "docs": {"$push": {
                    "id": "$id",
                    "user_id": "$user_id",
                    "status": "$status",
                    "created_at": "$created_at"
                }}
            }
        },
        {
            "$match": {"count": {"$gt": 1}}
        }
    ]).to_list(length=100)
    
    if duplicates:
        print(f"❌ Found {len(duplicates)} duplicate stripe_subscription_id values:\n")
        for dup in duplicates:
            stripe_id = dup['_id']
            count = dup['count']
            print(f"  stripe_subscription_id: {stripe_id}")
            print(f"  Count: {count}")
            print(f"  Documents:")
            for doc in dup['docs']:
                print(f"    - id: {doc['id']}, user_id: {doc['user_id']}, status: {doc['status']}, created: {doc.get('created_at', 'N/A')}")
            print()
        
        print("⚠️  ACTION REQUIRED: Clean up duplicates before creating unique index!")
        return False
    else:
        print("✅ No duplicates found. Safe to create unique index.")
        return True
    
    # Check for nulls
    print("\n🔍 Checking for null/missing stripe_subscription_id...\n")
    
    null_count = await db.subscriptions.count_documents({
        "$or": [
            {"stripe_subscription_id": None},
            {"stripe_subscription_id": ""},
            {"stripe_subscription_id": {"$exists": False}}
        ]
    })
    
    if null_count > 0:
        print(f"ℹ️  Found {null_count} subscriptions without stripe_subscription_id (legacy data)")
        print("   ✅ This is OK - index will be partial (sparse=True + partialFilterExpression)")
    else:
        print("✅ All subscriptions have stripe_subscription_id")
    
    client.close()
    return True

if __name__ == "__main__":
    result = asyncio.run(check_duplicates())
    exit(0 if result else 1)
