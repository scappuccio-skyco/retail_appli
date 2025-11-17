import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone

# MongoDB connection
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
client = AsyncIOMotorClient(MONGO_URL)
db = client.retail_db

async def sync_subscriptions():
    """Force sync all subscriptions with Stripe to get correct seats"""
    print("🔄 Starting subscription sync with Stripe...")
    
    # Get all active subscriptions
    subscriptions = await db.subscriptions.find({"status": {"$in": ["active", "trialing"]}}).to_list(1000)
    print(f"📊 Found {len(subscriptions)} active subscriptions")
    
    # Import Stripe
    STRIPE_API_KEY = os.environ.get('STRIPE_API_KEY')
    if not STRIPE_API_KEY:
        print("❌ STRIPE_API_KEY not found in environment")
        return
    
    import stripe
    stripe.api_key = STRIPE_API_KEY
    
    updated_count = 0
    error_count = 0
    
    for sub in subscriptions:
        try:
            user_id = sub.get('user_id')
            stripe_sub_id = sub.get('stripe_subscription_id')
            
            # Skip trial subscriptions without real Stripe ID
            if not stripe_sub_id or stripe_sub_id.startswith('trial_'):
                print(f"⏭️  Skipping trial subscription for user {user_id}")
                continue
            
            print(f"\n🔍 Processing subscription for user {user_id}")
            print(f"   Stripe ID: {stripe_sub_id}")
            print(f"   Current seats in DB: {sub.get('seats', 'NOT SET')}")
            
            # Fetch from Stripe
            try:
                stripe_sub = stripe.Subscription.retrieve(stripe_sub_id)
                
                if stripe_sub and stripe_sub.get('items') and stripe_sub['items']['data']:
                    quantity = stripe_sub['items']['data'][0].get('quantity', 1)
                    subscription_item_id = stripe_sub['items']['data'][0]['id']
                    
                    print(f"   ✅ Stripe says: {quantity} seats")
                    
                    # Update MongoDB
                    await db.subscriptions.update_one(
                        {"user_id": user_id},
                        {"$set": {
                            "seats": quantity,
                            "stripe_subscription_item_id": subscription_item_id,
                            "updated_at": datetime.now(timezone.utc).isoformat()
                        }}
                    )
                    
                    print(f"   💾 Updated MongoDB with {quantity} seats")
                    updated_count += 1
                else:
                    print(f"   ⚠️  No items found in Stripe subscription")
                    
            except stripe.error.InvalidRequestError as e:
                print(f"   ❌ Stripe error: {str(e)}")
                error_count += 1
                
        except Exception as e:
            print(f"   ❌ Error processing subscription: {str(e)}")
            error_count += 1
    
    print(f"\n" + "="*50)
    print(f"✅ Sync complete!")
    print(f"   Updated: {updated_count}")
    print(f"   Errors: {error_count}")
    print(f"   Skipped: {len(subscriptions) - updated_count - error_count}")
    print("="*50)

if __name__ == "__main__":
    asyncio.run(sync_subscriptions())
