import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone

# MongoDB connection
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.environ.get('DB_NAME', 'retail_coach')
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

async def sync_workspaces_with_stripe():
    """Force sync all workspaces with Stripe to get correct seats"""
    print("🔄 Starting workspace sync with Stripe...")
    
    # Import Stripe
    STRIPE_API_KEY = os.environ.get('STRIPE_API_KEY')
    if not STRIPE_API_KEY:
        print("❌ STRIPE_API_KEY not found in environment")
        return
    
    import stripe
    stripe.api_key = STRIPE_API_KEY
    
    # Get all workspaces with Stripe subscription ID
    workspaces = await db.workspaces.find({"stripe_subscription_id": {"$exists": True, "$ne": None}}).to_list(1000)
    print(f"📊 Found {len(workspaces)} workspaces with Stripe subscriptions\n")
    
    updated_count = 0
    error_count = 0
    
    for ws in workspaces:
        try:
            workspace_id = ws.get('id')
            workspace_name = ws.get('name')
            stripe_sub_id = ws.get('stripe_subscription_id')
            current_seats = ws.get('seats', 'NOT SET')
            
            print(f"\n🔍 Processing workspace: {workspace_name}")
            print(f"   Workspace ID: {workspace_id}")
            print(f"   Stripe Sub ID: {stripe_sub_id}")
            print(f"   Current seats in DB: {current_seats}")
            
            # Fetch from Stripe
            try:
                stripe_sub = stripe.Subscription.retrieve(stripe_sub_id)
                
                if stripe_sub and stripe_sub.get('items') and stripe_sub['items']['data']:
                    quantity = stripe_sub['items']['data'][0].get('quantity', 1)
                    subscription_item_id = stripe_sub['items']['data'][0]['id']
                    
                    print(f"   ✅ Stripe says: {quantity} seats")
                    
                    # Update workspace in MongoDB
                    await db.workspaces.update_one(
                        {"id": workspace_id},
                        {"$set": {
                            "seats": quantity,
                            "stripe_subscription_item_id": subscription_item_id,
                            "updated_at": datetime.now(timezone.utc).isoformat()
                        }}
                    )
                    
                    print(f"   💾 Updated workspace with {quantity} seats")
                    updated_count += 1
                else:
                    print(f"   ⚠️  No items found in Stripe subscription")
                    
            except Exception as e:
                if 'stripe' in str(e).lower():
                    print(f"   ❌ Stripe error: {str(e)}")
                else:
                    print(f"   ❌ Error: {str(e)}")
                error_count += 1
                
        except Exception as e:
            print(f"   ❌ Error processing workspace: {str(e)}")
            error_count += 1
    
    print(f"\n" + "="*50)
    print(f"✅ Sync complete!")
    print(f"   Updated: {updated_count}")
    print(f"   Errors: {error_count}")
    print(f"   Skipped: {len(workspaces) - updated_count - error_count}")
    print("="*50)

if __name__ == "__main__":
    asyncio.run(sync_workspaces_with_stripe())
