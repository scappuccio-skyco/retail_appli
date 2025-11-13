#!/usr/bin/env python3
"""
Script to sync Stripe subscription data to MongoDB for Manager12@test.com
"""
import os
import sys
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient
import stripe as stripe_lib
import asyncio

# Configuration
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
STRIPE_API_KEY = os.environ.get('STRIPE_API_KEY', '')
TARGET_EMAIL = 'Manager12@test.com'

async def sync_subscription():
    """Find Stripe customer by email and sync subscription to MongoDB"""
    
    # Initialize Stripe
    stripe_lib.api_key = STRIPE_API_KEY
    
    # Connect to MongoDB
    client = AsyncIOMotorClient(MONGO_URL)
    db = client.retail_performer
    
    try:
        print(f"\n🔍 Searching for Stripe customer with email: {TARGET_EMAIL}")
        
        # Search for customer by email
        customers = stripe_lib.Customer.list(email=TARGET_EMAIL, limit=1)
        
        if not customers.data:
            print(f"❌ No Stripe customer found with email {TARGET_EMAIL}")
            return False
        
        customer = customers.data[0]
        print(f"✅ Found Stripe customer: {customer.id}")
        print(f"   Name: {customer.name}")
        print(f"   Email: {customer.email}")
        
        # Get active subscriptions for this customer
        subscriptions = stripe_lib.Subscription.list(
            customer=customer.id,
            status='active',
            limit=10
        )
        
        if not subscriptions.data:
            print(f"❌ No active subscriptions found for customer {customer.id}")
            return False
        
        # Get the first active subscription
        sub_id = subscriptions.data[0].id
        print(f"\n📋 Found active subscription: {sub_id}")
        
        # Retrieve full subscription details
        subscription = stripe_lib.Subscription.retrieve(sub_id)
        
        # Debug: print all available fields
        print(f"\n🔍 DEBUG - Available subscription fields:")
        print(f"   {list(subscription.keys())}")
        
        # Extract subscription details
        quantity = 1
        subscription_item_id = None
        if subscription.get('items') and subscription['items']['data']:
            quantity = subscription['items']['data'][0].get('quantity', 1)
            subscription_item_id = subscription['items']['data'][0]['id']
        
        # Access fields - try to get them safely
        try:
            period_start = datetime.fromtimestamp(subscription.current_period_start, tz=timezone.utc)
            period_end = datetime.fromtimestamp(subscription.current_period_end, tz=timezone.utc)
        except AttributeError:
            print("⚠️  Period fields not available in subscription object")
            period_start = None
            period_end = None
        
        status = subscription.status if hasattr(subscription, 'status') else 'unknown'
        cancel_at_period_end = subscription.cancel_at_period_end if hasattr(subscription, 'cancel_at_period_end') else False
        
        print(f"\n📊 Subscription Details:")
        print(f"   Status: {status}")
        print(f"   Quantity: {quantity} seats")
        print(f"   Period Start: {period_start.isoformat() if period_start else 'N/A'}")
        print(f"   Period End: {period_end.isoformat() if period_end else 'N/A'}")
        print(f"   Cancel at period end: {cancel_at_period_end}")
        
        # Find user's workspace in MongoDB
        user = await db.users.find_one({"email": TARGET_EMAIL}, {"_id": 0})
        if not user:
            print(f"\n❌ User {TARGET_EMAIL} not found in MongoDB")
            return False
        
        workspace_id = user.get('workspace_id')
        if not workspace_id:
            print(f"❌ User {TARGET_EMAIL} has no workspace_id")
            return False
        
        print(f"\n✅ Found user workspace: {workspace_id}")
        
        # Update workspace with Stripe data
        update_data = {
            "stripe_customer_id": customer.id,
            "stripe_subscription_id": subscription.id,
            "stripe_subscription_item_id": subscription_item_id,
            "stripe_quantity": quantity,
            "subscription_status": status,
            "cancel_at_period_end": cancel_at_period_end,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        # Only add period fields if they exist
        if period_start:
            update_data["current_period_start"] = period_start.isoformat()
        if period_end:
            update_data["current_period_end"] = period_end.isoformat()
        
        result = await db.workspaces.update_one(
            {"id": workspace_id},
            {"$set": update_data}
        )
        
        if result.modified_count > 0:
            print(f"\n✅ Successfully synced subscription data to workspace {workspace_id}")
            print(f"   - Updated {result.modified_count} document(s)")
            
            # Verify the update
            workspace = await db.workspaces.find_one(
                {"id": workspace_id},
                {"_id": 0, "subscription_status": 1, "current_period_end": 1, "stripe_quantity": 1}
            )
            print(f"\n📋 Verified workspace data:")
            print(f"   Status: {workspace.get('subscription_status')}")
            print(f"   Period End: {workspace.get('current_period_end')}")
            print(f"   Quantity: {workspace.get('stripe_quantity')}")
            
            return True
        else:
            print(f"\n⚠️  No changes made to workspace {workspace_id}")
            return False
            
    except Exception as e:
        print(f"\n❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        client.close()

if __name__ == "__main__":
    success = asyncio.run(sync_subscription())
    sys.exit(0 if success else 1)
