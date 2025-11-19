"""
Script pour désactiver le KPI "Clients" (redondant avec Ventes)
"""
import os
from pymongo import MongoClient

mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
client = MongoClient(mongo_url)
db = client['retail_coach']

# Update all kpi_configs to disable "Clients"
result = db.kpi_configs.update_many(
    {},
    {
        "$set": {
            "seller_track_clients": False,
            "manager_track_clients": False
        }
    }
)

print(f"✅ Mis à jour {result.modified_count} configurations KPI")
print("   seller_track_clients = False")
print("   manager_track_clients = False")
