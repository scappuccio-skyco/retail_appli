"""Staff lifecycle methods for GerantService: transfer, suspend, reactivate, delete."""
import logging
from typing import Dict
from datetime import datetime, timezone, timedelta
from core.exceptions import ValidationError, NotFoundError

logger = logging.getLogger(__name__)


class StaffLifecycleMixin:

    async def transfer_seller_to_store(
        self,
        seller_id: str,
        transfer_data: Dict,
        gerant_id: str
    ) -> Dict:
        """
        Transfer a seller to another store with a new manager

        Args:
            seller_id: Seller user ID
            transfer_data: {"new_store_id": "...", "new_manager_id": "..."}
            gerant_id: Current gérant ID for authorization

        Returns:
            Dict with success status and message
        """
        from models.sellers import SellerTransfer

        # Validate input
        try:
            transfer = SellerTransfer(**transfer_data)
        except Exception as e:
            raise ValidationError(f"Données de transfert invalides: {str(e)}", error_code="INVALID_TRANSFER_DATA")

        # Verify seller exists and belongs to current gérant
        seller = await self.user_repo.find_one({
            "id": seller_id,
            "gerant_id": gerant_id,
            "role": "seller"
        }, {"_id": 0})

        if not seller:
            raise NotFoundError("Vendeur non trouvé ou accès non autorisé", error_code="SELLER_NOT_FOUND")

        # Check if this is a same-store manager change or a full transfer
        is_same_store = seller.get('store_id') == transfer.new_store_id

        # Verify new store exists, is active, and belongs to current gérant
        new_store = await self.store_repo.find_one({
            "id": transfer.new_store_id,
            "gerant_id": gerant_id
        }, {"_id": 0})

        if not new_store:
            raise NotFoundError("Magasin non trouvé ou accès non autorisé", error_code="STORE_NOT_FOUND")

        # Only check if store is active if it's a different store
        if not is_same_store and not new_store.get('active', False):
            raise ValidationError(
                f"Le magasin '{new_store['name']}' est inactif. Impossible de transférer vers un magasin inactif.",
                error_code="STORE_INACTIVE"
            )

        # Verify new manager exists and is in the target store
        new_manager = await self.user_repo.find_one({
            "id": transfer.new_manager_id,
            "store_id": transfer.new_store_id,
            "role": "manager",
            "status": "active"
        }, {"_id": 0})

        if not new_manager:
            raise NotFoundError("Manager non trouvé dans ce magasin ou manager inactif", error_code="MANAGER_NOT_FOUND")

        # Prepare update fields
        update_fields = {
            "manager_id": transfer.new_manager_id,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }

        # Only update store_id if it's a different store
        if not is_same_store:
            update_fields["store_id"] = transfer.new_store_id
        unset_fields = {}

        # Auto-reactivation if seller was suspended due to inactive store
        if seller.get('status') == 'suspended' and seller.get('suspended_reason', '').startswith('Magasin'):
            update_fields["status"] = "active"
            update_fields["reactivated_at"] = datetime.now(timezone.utc).isoformat()
            unset_fields = {
                "suspended_at": "",
                "suspended_by": "",
                "suspended_reason": ""
            }

        # Add transfer history entry (only for real store changes)
        if not is_same_store:
            transfer_entry = {
                "from_store_id": seller.get("store_id"),
                "to_store_id": transfer.new_store_id,
                "transferred_at": datetime.now(timezone.utc).isoformat(),
                "transferred_by_gerant_id": gerant_id
            }
            update_operation = {"$set": update_fields, "$push": {"transfer_history": transfer_entry}}
        else:
            update_operation = {"$set": update_fields}

        if unset_fields:
            update_operation["$unset"] = unset_fields

        await self.user_repo.update_one(
            {"id": seller_id},
            update_operation
        )
        from core.cache import invalidate_user_cache
        await invalidate_user_cache(seller_id)

        # KPI entries intentionally NOT migrated — historical data stays with original store.
        # Use get_seller_passport() to view cross-store performance history.
        if not is_same_store:
            logger.info(
                "Seller %s transferred from store %s to store %s — KPI history preserved in original store",
                seller_id, seller.get('store_id'), transfer.new_store_id
            )

        # Build response message
        if is_same_store:
            message = f"Manager changé avec succès : {seller.get('name')} est maintenant sous la responsabilité de {new_manager['name']}"
        else:
            message = f"Vendeur transféré avec succès vers {new_store['name']}"
            if update_fields.get("status") == "active":
                message += " et réactivé automatiquement"

        return {
            "success": True,
            "message": message,
            "new_store": new_store['name'] if not is_same_store else seller.get('store_id'),
            "new_manager": new_manager['name'],
            "reactivated": update_fields.get("status") == "active",
            "same_store": is_same_store
        }

    async def get_seller_passport(self, seller_id: str, gerant_id: str) -> Dict:
        """
        Passeport vendeur cross-magasin : historique de transferts + métriques agrégées par magasin.
        Les KPI ne sont PAS filtrés par store_id courant — on voit tout l'historique du vendeur.

        Args:
            seller_id: ID du vendeur
            gerant_id: ID du gérant (vérification d'appartenance)
        """
        # Verify seller belongs to gerant
        seller = await self.user_repo.find_one({
            "id": seller_id,
            "gerant_id": gerant_id,
            "role": "seller"
        }, {"_id": 0, "password": 0})

        if not seller:
            raise ValueError("Vendeur non trouvé ou accès non autorisé")

        # Aggregate KPI by store (cross-store, no store_id filter)
        pipeline = [
            {"$match": {"seller_id": seller_id}},
            {"$group": {
                "_id": "$store_id",
                "total_ca": {"$sum": {"$ifNull": ["$seller_ca", {"$ifNull": ["$ca_journalier", 0]}]}},
                "total_ventes": {"$sum": {"$ifNull": ["$nb_ventes", 0]}},
                "total_clients": {"$sum": {"$ifNull": ["$nb_clients", 0]}},
                "total_articles": {"$sum": {"$ifNull": ["$nb_articles", 0]}},
                "entries": {"$sum": 1},
                "first_date": {"$min": "$date"},
                "last_date": {"$max": "$date"},
            }}
        ]
        kpi_by_store = await self.kpi_repo.aggregate(pipeline, max_results=50)

        # Resolve store names (KPI stores + transfer history stores)
        transfer_history = seller.get("transfer_history", [])
        history_store_ids = [
            sid for t in transfer_history
            for sid in [t.get("from_store_id"), t.get("to_store_id")]
            if sid
        ]
        store_ids = list({row["_id"] for row in kpi_by_store if row.get("_id")} | set(history_store_ids))
        stores_list = await self.store_repo.find_many(
            {"id": {"$in": store_ids}},
            {"_id": 0, "id": 1, "name": 1, "location": 1}
        ) if store_ids else []
        stores_map = {s["id"]: s for s in stores_list}

        # Build per-store stats
        store_stats = []
        for row in kpi_by_store:
            sid = row["_id"]
            ventes = row.get("total_ventes", 0)
            clients = row.get("total_clients", 0)
            ca = round(row.get("total_ca", 0), 2)
            store_stats.append({
                "store_id": sid,
                "store_name": stores_map.get(sid, {}).get("name", "Magasin inconnu"),
                "store_location": stores_map.get(sid, {}).get("location", ""),
                "total_ca": ca,
                "total_ventes": ventes,
                "total_clients": clients,
                "total_articles": row.get("total_articles", 0),
                "entries": row.get("entries", 0),
                "first_date": row.get("first_date"),
                "last_date": row.get("last_date"),
                "panier_moyen": round(ca / ventes, 2) if ventes > 0 else 0,
                "taux_transformation": round(ventes / clients * 100, 1) if clients > 0 else 0,
                "is_current_store": sid == seller.get("store_id"),
            })

        # Sort: current store first, then by total CA desc
        store_stats.sort(key=lambda s: (not s["is_current_store"], -s["total_ca"]))

        # Global metrics
        total_ca = sum(s["total_ca"] for s in store_stats)
        total_ventes = sum(s["total_ventes"] for s in store_stats)
        total_clients = sum(s["total_clients"] for s in store_stats)

        return {
            "seller": {
                "id": seller["id"],
                "name": seller.get("name"),
                "email": seller.get("email"),
                "status": seller.get("status"),
                "store_id": seller.get("store_id"),
                "created_at": seller.get("created_at"),
            },
            "current_store": stores_map.get(seller.get("store_id", ""), {}),
            "transfer_history": [
                {
                    **t,
                    "from_store_name": stores_map.get(t.get("from_store_id", ""), {}).get("name", "Magasin inconnu"),
                    "to_store_name": stores_map.get(t.get("to_store_id", ""), {}).get("name", "Magasin inconnu"),
                }
                for t in transfer_history
            ],
            "store_stats": store_stats,
            "global_metrics": {
                "total_ca": round(total_ca, 2),
                "total_ventes": total_ventes,
                "total_clients": total_clients,
                "panier_moyen": round(total_ca / total_ventes, 2) if total_ventes > 0 else 0,
                "taux_transformation": round(total_ventes / total_clients * 100, 1) if total_clients > 0 else 0,
                "stores_count": len(store_stats),
            }
        }

    async def suspend_user(self, user_id: str, gerant_id: str, role: str) -> Dict:
        """
        Suspend a manager or seller

        ✅ AUTORISÉ même si trial_expired pour permettre l'ajustement d'abonnement.
        Le calcul d'abonnement exclut automatiquement les vendeurs suspendus.

        Args:
            user_id: User ID to suspend
            gerant_id: Gérant ID for authorization
            role: 'manager' or 'seller'
        """
        # === GUARD CLAUSE: Check subscription access ===
        # ✅ Exception: allow_user_management=True pour bypasser le blocage trial_expired
        await self.check_gerant_active_access(gerant_id, allow_user_management=True)

        user = await self.user_repo.find_one({
            "id": user_id,
            "gerant_id": gerant_id,
            "role": role
        })

        if not user:
            raise ValueError(f"{role.capitalize()} non trouvé")

        if user.get('status') == 'suspended':
            raise ValueError(f"Ce {role} est déjà suspendu")

        if user.get('status') == 'deleted':
            raise ValueError(f"Ce {role} a été supprimé")

        await self.user_repo.update_one(
            {"id": user_id},
            {
                "$set": {
                    "status": "suspended",
                    "suspended_at": datetime.now(timezone.utc).isoformat(),
                    "suspended_by": gerant_id,
                    "suspended_reason": "Suspendu par le gérant",
                }
            },
        )

        return {"message": f"{role.capitalize()} suspendu avec succès"}

    async def reactivate_user(self, user_id: str, gerant_id: str, role: str) -> Dict:
        """
        Reactivate a suspended manager or seller

        ✅ AUTORISÉ même si trial_expired pour permettre l'ajustement d'abonnement.

        Args:
            user_id: User ID to reactivate
            gerant_id: Gérant ID for authorization
            role: 'manager' or 'seller'
        """
        # === GUARD CLAUSE: Check subscription access ===
        # ✅ Exception: allow_user_management=True pour bypasser le blocage trial_expired
        await self.check_gerant_active_access(gerant_id, allow_user_management=True)

        user = await self.user_repo.find_one({
            "id": user_id,
            "gerant_id": gerant_id,
            "role": role
        })

        if not user:
            raise ValueError(f"{role.capitalize()} non trouvé")

        if user.get('status') != 'suspended':
            raise ValueError(f"Ce {role} n'est pas suspendu")

        # PHASE 8: update_with_unset via repository, no .collection
        set_data = {
            "status": "active",
            "reactivated_at": datetime.now(timezone.utc).isoformat(),
            "reactivated_by": gerant_id
        }
        unset_data = {"suspended_at": "", "suspended_by": "", "suspended_reason": ""}
        await self.user_repo.update_with_unset({"id": user_id}, set_data, unset_data)
        from core.cache import invalidate_user_cache
        await invalidate_user_cache(user_id)

        return {"message": f"{role.capitalize()} réactivé avec succès"}

    async def delete_user(self, user_id: str, gerant_id: str, role: str) -> Dict:
        """
        Soft delete a manager or seller (set status to 'deleted')

        ✅ AUTORISÉ même si trial_expired pour permettre l'ajustement d'abonnement.

        Args:
            user_id: User ID to delete
            gerant_id: Gérant ID for authorization
            role: 'manager' or 'seller'
        """
        # === GUARD CLAUSE: Check subscription access ===
        # ✅ Exception: allow_user_management=True pour bypasser le blocage trial_expired
        await self.check_gerant_active_access(gerant_id, allow_user_management=True)

        user = await self.user_repo.find_one({
            "id": user_id,
            "gerant_id": gerant_id,
            "role": role
        })

        if not user:
            raise ValueError(f"{role.capitalize()} non trouvé")

        if user.get('status') == 'deleted':
            raise ValueError(f"Ce {role} a déjà été supprimé")

        anonymized_email = f"deleted+{user_id}@example.invalid"
        await self.user_repo.update_one(
            {"id": user_id},
            {
                "$set": {
                    "status": "deleted",
                    "email": anonymized_email,
                    "deleted_at": datetime.now(timezone.utc).isoformat(),
                    "deleted_by": gerant_id,
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }
            },
        )
        from core.cache import invalidate_user_cache
        await invalidate_user_cache(user_id)

        return {"message": f"{role.capitalize()} supprimé avec succès"}

    async def anonymize_inactive_emails(self, gerant_id: str) -> dict:
        """Anonymize emails for inactive/deleted users + non-pending invitations.

        Goal: free up emails for reuse while keeping historical data.
        Scope: only users/invitations belonging to this gérant.
        """
        import re
        from datetime import datetime, timezone

        # Users (seller/manager) under this gérant
        user_query = {
            "gerant_id": gerant_id,
            "status": {"$in": ["deleted", "inactive"]},
            "email": {"$exists": True, "$ne": None, "$ne": "", "$not": re.compile(r"^deleted\\+", re.I)},
        }
        users_matched = 0
        users_modified = 0
        async for u in self.user_repo.find_iter(user_query, projection={"_id": 0, "id": 1, "email": 1}):
            users_matched += 1
            uid = u.get("id")
            if not uid:
                continue
            new_email = f"deleted+{uid}@example.invalid"
            await self.user_repo.update_one(
                {"id": uid},
                {"$set": {"email": new_email, "updated_at": datetime.now(timezone.utc).isoformat()}},
            )
            users_modified += 1

        # Invitations (gerant_invitations)
        inv_query = {
            "gerant_id": gerant_id,
            "status": {"$ne": "pending"},
            "email": {"$exists": True, "$ne": None, "$ne": "", "$not": re.compile(r"^deleted\\+", re.I)},
        }
        invitations_matched = 0
        inv_modified = 0
        async for inv in self.gerant_invitation_repo.find_iter(inv_query, projection={"_id": 0, "id": 1, "token": 1, "email": 1}):
            invitations_matched += 1
            token = inv.get("token") or inv.get("id")
            if not token:
                continue
            new_email = f"deleted-invite+{token}@example.invalid"
            await self.gerant_invitation_repo.update_many(
                {"token": inv.get("token")},
                {"$set": {"email": new_email, "updated_at": datetime.now(timezone.utc).isoformat()}},
            )
            inv_modified += 1

        return {
            "users_matched": users_matched,
            "users_modified": users_modified,
            "invitations_matched": invitations_matched,
            "invitations_modified": inv_modified,
        }
