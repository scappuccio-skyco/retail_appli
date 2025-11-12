#!/usr/bin/env python3
import os
import stripe
from motor.motor_asyncio import AsyncIOMotorClient
import asyncio

# Configuration
STRIPE_API_KEY = "sk_test_51SS2RMIVM4C8dIGvbPPqorZcnu61WxTJvnXlm1XkQj3lzEpcMaWGRrL1mDoGWdqOPH5UxUdYhX69MZyo9c5wYbvm00s9cyYn63"
MONGO_URL = "mongodb://localhost:27017"
DB_NAME = "retail_coach"

stripe.api_key = STRIPE_API_KEY

async def fix_seats():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    # Get all subscriptions with Stripe ID
    subs = await db.subscriptions.find({"stripe_subscription_id": {"$exists": True}}).to_list(length=None)
    
    print(f"Found {len(subs)} subscriptions to check\n")
    
    for sub in subs:
        stripe_sub_id = sub.get('stripe_subscription_id')
        if not stripe_sub_id:
            continue
            
        try:
            # Fetch from Stripe
            stripe_sub = stripe.Subscription.retrieve(stripe_sub_id)
            
            if stripe_sub and stripe_sub.get('items') and stripe_sub['items']['data']:
                quantity = stripe_sub['items']['data'][0].get('quantity', 1)
                subscription_item_id = stripe_sub['items']['data'][0]['id']
                
                print(f"User: {sub['user_id']}")
                print(f"  Stripe Sub ID: {stripe_sub_id}")
                print(f"  Current seats in DB: {sub.get('seats', 'NOT SET')}")
                print(f"  Quantity in Stripe: {quantity}")
                print(f"  Subscription Item ID: {subscription_item_id}")
                
                # Update database
                result = await db.subscriptions.update_one(
                    {"user_id": sub['user_id']},
                    {"$set": {
                        "seats": quantity,
                        "stripe_subscription_item_id": subscription_item_id
                    }}
                )
                
                print(f"  ✅ Updated: {result.modified_count} document(s)\n")
            else:
                print(f"❌ No items found in Stripe subscription {stripe_sub_id}\n")
                
        except Exception as e:
            print(f"❌ Error for {stripe_sub_id}: {str(e)}\n")
    
    client.close()
    print("Done!")

if __name__ == "__main__":
    asyncio.run(fix_seats())
