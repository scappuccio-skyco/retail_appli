"""
Script pour créer un workspace pour le gérant
"""
import os
import sys
from pymongo import MongoClient
from datetime import datetime, timezone, timedelta
from uuid import uuid4

mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
client = MongoClient(mongo_url)
db = client['retail_coach']

# Get gerant
gerant = db.users.find_one({"role": "gerant"})

if not gerant:
    print("❌ Aucun gérant trouvé")
    sys.exit(1)

print(f"✅ Gérant trouvé: {gerant.get('email')}")

# Check if workspace already exists
if gerant.get('workspace_id'):
    print(f"⚠️  Workspace existe déjà: {gerant.get('workspace_id')}")
    workspace = db.workspaces.find_one({"id": gerant['workspace_id']})
    if workspace:
        print(f"Status: {workspace.get('subscription_status')}")
        sys.exit(0)

# Create workspace for gerant
workspace_id = str(uuid4())
trial_end = datetime.now(timezone.utc) + timedelta(days=14)

workspace = {
    "id": workspace_id,
    "manager_id": gerant['id'],  # For compatibility
    "gerant_id": gerant['id'],   # New field
    "subscription_status": "trialing",
    "plan_type": "trial",
    "trial_end": trial_end.isoformat(),
    "ai_credits_remaining": 100,
    "stripe_customer_id": None,
    "stripe_subscription_id": None,
    "stripe_quantity": 0,
    "created_at": datetime.now(timezone.utc).isoformat(),
    "updated_at": datetime.now(timezone.utc).isoformat()
}

# Insert workspace
db.workspaces.insert_one(workspace)
print(f"✅ Workspace créé: {workspace_id}")

# Update gerant with workspace_id
db.users.update_one(
    {"id": gerant['id']},
    {"$set": {"workspace_id": workspace_id}}
)
print(f"✅ Gérant mis à jour avec workspace_id")

# Count sellers
sellers_count = db.users.count_documents({"gerant_id": gerant['id'], "role": "seller"})
print(f"\n📊 Vendeurs sous ce gérant: {sellers_count}")
print(f"📅 Période d'essai jusqu'au: {trial_end.strftime('%Y-%m-%d')}")
