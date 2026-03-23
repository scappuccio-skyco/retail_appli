"""Store CRUD and bulk import methods for GerantService."""
import logging
from typing import Dict, Optional, List
from datetime import datetime, timezone

logger = logging.getLogger(__name__)


class StoresMixin:

    async def get_all_stores(self, gerant_id: str) -> list:
        """Get all active stores for a gérant with staff counts"""
        stores = await self.store_repo.find_many(
            {"gerant_id": gerant_id, "active": True},
            {"_id": 0}
        )

        # PHASE 8: build pending counts per store via iterator (no limit=1000)
        pending_by_store = {}
        async for inv in self.gerant_invitation_repo.find_by_gerant_iter(gerant_id, status="pending"):
            sid = inv.get("store_id")
            if sid not in pending_by_store:
                pending_by_store[sid] = {"pending_managers": 0, "pending_sellers": 0}
            if inv.get("role") == "manager":
                pending_by_store[sid]["pending_managers"] += 1
            elif inv.get("role") == "seller":
                pending_by_store[sid]["pending_sellers"] += 1

        # PHASE 4: One aggregation instead of 2*N counts (N+1 optimization)
        store_ids = [s.get("id") for s in stores if s.get("id")]
        staff_by_store = {}
        if store_ids:
            pipeline = [
                {"$match": {
                    "store_id": {"$in": store_ids},
                    "status": {"$in": ["active", "Active"]}
                }},
                {"$group": {
                    "_id": "$store_id",
                    "manager_count": {"$sum": {"$cond": [{"$eq": ["$role", "manager"]}, 1, 0]}},
                    "seller_count": {"$sum": {"$cond": [{"$eq": ["$role", "seller"]}, 1, 0]}}
                }}
            ]
            agg_result = await self.user_repo.aggregate(pipeline, max_results=len(store_ids) + 1)
            staff_by_store = {
                r["_id"]: {"manager_count": r.get("manager_count", 0), "seller_count": r.get("seller_count", 0)}
                for r in agg_result
            }

        # Enrich stores with staff counts (from single aggregation + pending)
        for store in stores:
            store_id = store.get('id')
            counts = staff_by_store.get(store_id, {"manager_count": 0, "seller_count": 0})
            store['manager_count'] = counts["manager_count"]
            store['seller_count'] = counts["seller_count"]
            sid_counts = pending_by_store.get(store_id, {"pending_managers": 0, "pending_sellers": 0})
            store['pending_manager_count'] = sid_counts["pending_managers"]
            store['pending_seller_count'] = sid_counts["pending_sellers"]

        return stores

    async def create_store(self, store_data: Dict, gerant_id: str) -> Dict:
        """Create a new store for a gérant"""
        from uuid import uuid4

        # === GUARD CLAUSE: Check subscription access ===
        await self.check_gerant_active_access(gerant_id)

        name = store_data.get('name')
        if not name:
            raise ValueError("Le nom du magasin est requis")

        # Check for duplicate name
        existing = await self.store_repo.find_one({
            "gerant_id": gerant_id,
            "name": name,
            "active": True
        })
        if existing:
            raise ValueError("Un magasin avec ce nom existe déjà")

        store = {
            "id": str(uuid4()),
            "name": name,
            "location": store_data.get('location', ''),
            "address": store_data.get('address', ''),
            "phone": store_data.get('phone', ''),
            "opening_hours": store_data.get('opening_hours', ''),
            "gerant_id": gerant_id,
            "active": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }

        await self.store_repo.insert_one(store)

        # Remove _id for return
        store.pop('_id', None)
        return store

    async def delete_store(self, store_id: str, gerant_id: str) -> Dict:
        """Soft delete a store (set active=False)"""
        store = await self.store_repo.find_one({
            "id": store_id,
            "gerant_id": gerant_id
        })

        if not store:
            raise ValueError("Magasin non trouvé")

        # Soft delete - set active to False
        await self.store_repo.update_one(
            {"id": store_id, "gerant_id": gerant_id},
            {
                "$set": {
                    "active": False,
                    "deleted_at": datetime.now(timezone.utc).isoformat(),
                    "deleted_by": gerant_id,
                }
            },
        )
        from core.cache import invalidate_store_cache, invalidate_user_cache
        await invalidate_store_cache(store_id)

        # Suspend all staff in this store
        affected_users = await self.user_repo.find_many(
            {"store_id": store_id, "status": "active"},
            {"id": 1},
            limit=2000,
            allow_over_limit=True
        )
        await self.user_repo.update_many(
            {"store_id": store_id, "status": "active"},
            {
                "$set": {
                    "status": "suspended",
                    "suspended_reason": "Store deleted",
                    "suspended_at": datetime.now(timezone.utc).isoformat(),
                }
            },
        )
        for u in affected_users:
            if u.get("id"):
                await invalidate_user_cache(str(u["id"]))

        return {"message": "Magasin supprimé avec succès"}

    async def update_store(self, store_id: str, store_data: Dict, gerant_id: str) -> Dict:
        """Update store information"""
        store = await self.store_repo.find_one({
            "id": store_id,
            "gerant_id": gerant_id,
            "active": True
        })

        if not store:
            raise ValueError("Magasin non trouvé ou inactif")

        # Liste des champs modifiables
        allowed_fields = ['name', 'location', 'address', 'phone', 'email', 'description', 'opening_hours']

        update_fields = {}
        for field in allowed_fields:
            if field in store_data:
                update_fields[field] = store_data[field]

        if update_fields:
            update_fields['updated_at'] = datetime.now(timezone.utc).isoformat()
            await self.store_repo.update_one(
                {"id": store_id, "gerant_id": gerant_id},
                {"$set": update_fields},
            )

        # Return updated store
        updated_store = await self.store_repo.find_one({"id": store_id}, {"_id": 0})
        return updated_store

    async def transfer_manager_to_store(self, manager_id: str, transfer_data: Dict, gerant_id: str) -> Dict:
        """Transfer a manager to another store"""
        new_store_id = transfer_data.get('new_store_id')
        if not new_store_id:
            raise ValueError("new_store_id est requis")

        # Verify manager belongs to this gérant
        manager = await self.user_repo.find_one({
            "id": manager_id,
            "gerant_id": gerant_id,
            "role": "manager"
        })
        if not manager:
            raise ValueError("Manager non trouvé")

        # Guard: no-op transfer
        if manager.get("store_id") == new_store_id:
            raise ValueError("Le manager est déjà dans ce magasin")

        # Verify new store belongs to this gérant and is active
        new_store = await self.store_repo.find_one({
            "id": new_store_id,
            "gerant_id": gerant_id,
            "active": True
        })
        if not new_store:
            raise ValueError("Nouveau magasin non trouvé ou inactif")

        # Update manager's store
        await self.user_repo.update_one(
            {"id": manager_id},
            {
                "$set": {
                    "store_id": new_store_id,
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }
            },
        )
        from core.cache import invalidate_user_cache
        await invalidate_user_cache(manager_id)

        # Count sellers left without a manager in the same store as manager
        old_store_id = manager.get("store_id")
        orphaned_count = await self.user_repo.count({
            "manager_id": manager_id,
            "store_id": old_store_id,
            "role": "seller",
            "status": "active"
        })

        return {
            "message": f"Manager transféré vers {new_store.get('name')}",
            "manager_id": manager_id,
            "new_store_id": new_store_id,
            "orphaned_sellers_count": orphaned_count,
            "warning": f"{orphaned_count} vendeur(s) restent sans manager dans l'ancien magasin" if orphaned_count > 0 else None
        }

    async def bulk_import_stores(
        self,
        gerant_id: str,
        workspace_id: str,
        stores: list,
        mode: str = "create_or_update"
    ) -> Dict:
        """
        Import massif de magasins pour un Gérant.

        Adapté depuis EnterpriseService pour utiliser workspace_id au lieu de enterprise_account_id.

        Args:
            gerant_id: ID du gérant effectuant l'import
            workspace_id: ID du workspace du gérant
            stores: Liste de dictionnaires magasin [{name, location, address, phone, external_id}, ...]
            mode: "create_only" | "update_only" | "create_or_update"

        Returns:
            Dict avec résultats: total_processed, created, updated, failed, errors
        """
        from pymongo import UpdateOne, InsertOne
        from uuid import uuid4

        # === GUARD CLAUSE: Check subscription access ===
        await self.check_gerant_active_access(gerant_id)

        results = {
            "total_processed": 0,
            "created": 0,
            "updated": 0,
            "failed": 0,
            "errors": []
        }

        if not stores:
            return results

        # PHASE 1: Pre-load existing stores (1 query for all)
        store_names = [s.get('name') for s in stores if s.get('name')]
        external_ids = [s.get('external_id') for s in stores if s.get('external_id')]

        query = {"$or": [], "workspace_id": workspace_id}
        if store_names:
            query["$or"].append({"name": {"$in": store_names}})
        if external_ids:
            query["$or"].append({"external_id": {"$in": external_ids}})

        existing_stores_map = {}
        MAX_STORES_SYNC = 1000
        if query["$or"]:
            # PHASE 8: find_many via repository, no .collection
            existing_stores_list = await self.store_repo.find_many(
                query,
                {"_id": 0, "id": 1, "name": 1, "external_id": 1, "location": 1},
                limit=MAX_STORES_SYNC
            )
            if len(existing_stores_list) == MAX_STORES_SYNC:
                logger.warning(f"Stores sync query hit limit of {MAX_STORES_SYNC}. Some stores may not be matched correctly.")
            for store in existing_stores_list:
                if store.get('external_id'):
                    existing_stores_map[store['external_id']] = store
                existing_stores_map[store['name']] = store

        # PHASE 2: Build bulk operations list in memory
        bulk_operations = []

        for store_data in stores:
            results["total_processed"] += 1

            try:
                # Validation
                if not store_data.get('name'):
                    results["failed"] += 1
                    results["errors"].append({
                        "name": store_data.get('name', 'unknown'),
                        "error": "Champ requis manquant: name"
                    })
                    continue

                # Find existing store by external_id or name
                lookup_key = store_data.get('external_id') or store_data['name']
                existing_store = existing_stores_map.get(lookup_key)

                if existing_store:
                    # Update mode
                    if mode in ["update_only", "create_or_update"]:
                        update_fields = {
                            "name": store_data['name'],
                            "location": store_data.get('location', existing_store.get('location', '')),
                            "active": True,
                            "updated_at": datetime.now(timezone.utc).isoformat()
                        }

                        if store_data.get('address'):
                            update_fields['address'] = store_data['address']
                        if store_data.get('phone'):
                            update_fields['phone'] = store_data['phone']
                        if store_data.get('external_id'):
                            update_fields['external_id'] = store_data['external_id']

                        bulk_operations.append(
                            UpdateOne(
                                {"id": existing_store['id']},
                                {"$set": update_fields}
                            )
                        )
                        results["updated"] += 1
                    else:
                        results["failed"] += 1
                        results["errors"].append({
                            "name": store_data['name'],
                            "error": "Le magasin existe déjà (mode=create_only)"
                        })
                else:
                    # Create mode
                    if mode in ["create_only", "create_or_update"]:
                        store_id = str(uuid4())
                        new_store = {
                            "id": store_id,
                            "name": store_data['name'],
                            "location": store_data.get('location', ''),
                            "workspace_id": workspace_id,
                            "gerant_id": gerant_id,
                            "active": True,
                            "address": store_data.get('address'),
                            "phone": store_data.get('phone'),
                            "external_id": store_data.get('external_id'),
                            "created_at": datetime.now(timezone.utc).isoformat(),
                            "updated_at": datetime.now(timezone.utc).isoformat()
                        }

                        bulk_operations.append(InsertOne(new_store))
                        results["created"] += 1
                    else:
                        results["failed"] += 1
                        results["errors"].append({
                            "name": store_data['name'],
                            "error": "Le magasin n'existe pas (mode=update_only)"
                        })

            except Exception as e:
                results["failed"] += 1
                results["errors"].append({
                    "name": store_data.get('name', 'unknown'),
                    "error": str(e)
                })
                logger.error(f"Erreur import magasin {store_data.get('name')}: {str(e)}")

        # PHASE 3: Execute bulk write via repository (no .collection)
        if bulk_operations:
            try:
                await self.store_repo.bulk_write(bulk_operations)
                logger.info(f"✅ Import massif magasins: {results['created']} créés, {results['updated']} mis à jour")
            except Exception as e:
                logger.error(f"Erreur bulk write: {str(e)}")
                # Some operations may have succeeded

        return results
