#!/usr/bin/env python3
"""
Script to fix status for all objectives in the database
Recalculates status based on current_value vs target_value
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone
import os

# MongoDB connection
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
client = AsyncIOMotorClient(MONGO_URL)
db = client['retail_coach']

async def fix_objectives_status():
    """Fix status for all objectives"""
    print("🔧 Starting objectives status fix...")
    
    # Get all objectives
    objectives = await db.manager_objectives.find({}, {"_id": 0}).to_list(1000)
    
    if not objectives:
        print("❌ No objectives found in database")
        return
    
    print(f"📋 Found {len(objectives)} objectives to check")
    
    updated_count = 0
    for obj in objectives:
        obj_id = obj.get('id')
        current_val = obj.get('current_value', 0)
        target_val = obj.get('target_value')
        period_end = obj.get('period_end')
        
        if not target_val or not period_end:
            print(f"⚠️  Skipping objective {obj_id} - missing target_value or period_end")
            continue
        
        # Calculate correct status
        today_date = datetime.now(timezone.utc).date()
        period_end_date = datetime.fromisoformat(period_end).date()
        
        if current_val >= target_val:
            new_status = 'achieved'
        elif today_date > period_end_date:
            new_status = 'failed'
        else:
            new_status = 'active'
        
        old_status = obj.get('status', 'unknown')
        
        # Update if status is different
        if old_status != new_status:
            await db.manager_objectives.update_one(
                {"id": obj_id},
                {"$set": {"status": new_status}}
            )
            print(f"✅ Updated objective '{obj.get('title', 'Untitled')}': {old_status} → {new_status} (current: {current_val}, target: {target_val})")
            updated_count += 1
        else:
            print(f"✓  Objective '{obj.get('title', 'Untitled')}' already correct: {new_status}")
    
    print(f"\n🎉 Done! Updated {updated_count} objectives")

if __name__ == "__main__":
    asyncio.run(fix_objectives_status())
