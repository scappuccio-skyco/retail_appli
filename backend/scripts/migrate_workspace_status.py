"""
Migration script to add 'status' field to workspaces that are missing it.
Sets default status to 'active' for all workspaces without a status field.
"""
import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient

async def migrate_workspace_status():
    """Add status field to workspaces missing it"""
    mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
    db_name = os.environ.get('DB_NAME', 'retailperformer')
    
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    print("=" * 60)
    print("WORKSPACE STATUS MIGRATION")
    print("=" * 60)
    
    # Count workspaces without status
    workspaces_without_status = await db.workspaces.count_documents({
        "$or": [
            {"status": {"$exists": False}},
            {"status": None}
        ]
    })
    
    total_workspaces = await db.workspaces.count_documents({})
    
    print(f"\nTotal workspaces: {total_workspaces}")
    print(f"Workspaces without status field: {workspaces_without_status}")
    
    if workspaces_without_status == 0:
        print("\n All workspaces already have a status field. No migration needed.")
        client.close()
        return
    
    # Get list of workspaces without status (for logging)
    workspaces_to_update = await db.workspaces.find(
        {"$or": [{"status": {"$exists": False}}, {"status": None}]},
        {"_id": 0, "id": 1, "name": 1}
    ).to_list(None)
    
    print(f"\nWorkspaces to update:")
    for ws in workspaces_to_update:
        print(f"  - {ws.get('name', 'N/A')} (ID: {ws.get('id', 'N/A')})")
    
    # Perform the update
    result = await db.workspaces.update_many(
        {"$or": [{"status": {"$exists": False}}, {"status": None}]},
        {"$set": {"status": "active"}}
    )
    
    print(f"\n Migration complete!")
    print(f"   Matched: {result.matched_count}")
    print(f"   Modified: {result.modified_count}")
    
    # Verify the update
    remaining = await db.workspaces.count_documents({
        "$or": [{"status": {"$exists": False}}, {"status": None}]
    })
    
    if remaining == 0:
        print("\n Verification passed: All workspaces now have a status field.")
    else:
        print(f"\n Warning: {remaining} workspaces still missing status.")
    
    # Show status distribution
    print("\nStatus distribution after migration:")
    for status in ['active', 'suspended', 'deleted']:
        count = await db.workspaces.count_documents({"status": status})
        print(f"  - {status}: {count}")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(migrate_workspace_status())
