#!/usr/bin/env python3
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone

MONGO_URL = "mongodb://localhost:27017"
DB_NAME = "retail_coach"
USER_ID = "f332dd18-5011-4744-a965-91ca38c9ed0d"

async def fix_subscription():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    # Get current subscription
    sub = await db.subscriptions.find_one({"user_id": USER_ID})
    
    if not sub:
        print("❌ No subscription found")
        return
    
    print(f"Current status:")
    print(f"  status: {sub.get('status')}")
    print(f"  cancel_at_period_end: {sub.get('cancel_at_period_end')}")
    print(f"  canceled_at: {sub.get('canceled_at')}")
    
    # Fix the subscription
    result = await db.subscriptions.update_one(
        {"user_id": USER_ID},
        {"$set": {
            "cancel_at_period_end": False,
            "canceled_at": None,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    print(f"\n✅ Fixed subscription: {result.modified_count} document(s) updated")
    
    # Verify
    sub = await db.subscriptions.find_one({"user_id": USER_ID})
    print(f"\nNew status:")
    print(f"  status: {sub.get('status')}")
    print(f"  cancel_at_period_end: {sub.get('cancel_at_period_end')}")
    print(f"  canceled_at: {sub.get('canceled_at')}")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(fix_subscription())
