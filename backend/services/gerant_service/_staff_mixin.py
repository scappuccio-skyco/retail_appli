"""Staff query methods for GerantService."""
import logging
import re
from typing import Dict
from datetime import datetime, timezone

logger = logging.getLogger(__name__)


class StaffMixin:

    async def get_all_managers(self, gerant_id: str, page: int = 1, size: int = 100) -> dict:
        """Get managers paginated (active and suspended, excluding deleted)."""
        size = min(max(size, 1), 200)
        skip = (page - 1) * size
        filter_q = {"gerant_id": gerant_id, "role": "manager", "status": {"$ne": "deleted"}}
        total = await self.user_repo.count_by_gerant(gerant_id, role="manager")
        managers = await self.user_repo.find_many(
            filter_q, {"_id": 0, "password": 0},
            limit=size, skip=skip, sort=[("name", 1)]
        )
        return {"items": managers, "total": total, "page": page, "size": size, "pages": -(-total // size)}

    async def get_all_sellers(self, gerant_id: str, page: int = 1, size: int = 100) -> dict:
        """Get sellers paginated (active and suspended, excluding deleted)."""
        size = min(max(size, 1), 200)
        skip = (page - 1) * size
        filter_q = {"gerant_id": gerant_id, "role": "seller", "status": {"$ne": "deleted"}}
        total = await self.user_repo.count_by_gerant(gerant_id, role="seller")
        sellers = await self.user_repo.find_many(
            filter_q, {"_id": 0, "password": 0},
            limit=size, skip=skip, sort=[("name", 1)]
        )
        return {"items": sellers, "total": total, "page": page, "size": size, "pages": -(-total // size)}

    async def get_store_managers(self, store_id: str, gerant_id: str) -> list:
        """
        Get all managers for a specific store (exclude deleted)

        Security: Verifies store ownership
        """
        # Verify store ownership
        store = await self.store_repo.find_by_id(store_id, gerant_id=gerant_id, projection={"_id": 0})
        if not store or not store.get('active'):
            raise Exception("Magasin non trouvé ou accès non autorisé")

        # Get managers (exclude deleted ones)
        managers = await self.user_repo.find_by_store(
            store_id,
            role="manager",
            projection={"_id": 0, "password": 0},
            limit=100
        )
        # Filter out deleted
        managers = [m for m in managers if m.get('status') != 'deleted']

        return managers

    async def get_store_sellers(self, store_id: str, gerant_id: str) -> list:
        """
        Get all sellers for a specific store (exclude deleted)

        Security: Verifies store ownership
        """
        # Verify store ownership
        store = await self.store_repo.find_by_id(store_id, gerant_id=gerant_id, projection={"_id": 0})
        if not store or not store.get('active'):
            raise Exception("Magasin non trouvé ou accès non autorisé")

        # Get sellers (exclude deleted ones). PHASE 8: iterator via repository, no .collection
        sellers = []
        async for seller in self.user_repo.find_by_store_iter(
            store_id, role="seller", status_exclude="deleted", projection={"_id": 0, "password": 0}
        ):
            sellers.append(seller)

        return sellers

    async def find_user_by_email_scoped(self, gerant_id: str, email: str) -> dict:
        """Find a user by email (case-insensitive) within the gérant scope."""
        email_raw = (email or "").strip()
        if not email_raw:
            return {"found": False}

        user = await self.user_repo.find_one(
            {"email": {"$regex": f"^{re.escape(email_raw)}$", "$options": "i"}},
            {"_id": 0, "id": 1, "email": 1, "role": 1, "status": 1, "store_id": 1, "gerant_id": 1, "workspace_id": 1, "name": 1},
        )
        if not user:
            return {"found": False}

        # Scope guard: user must belong to this gérant (either direct gerant account or child).
        if user.get("id") != gerant_id and user.get("gerant_id") != gerant_id:
            return {"found": True, "in_scope": False}

        return {"found": True, "in_scope": True, "user": user}

    async def free_email(self, gerant_id: str, email: str) -> dict:
        """Soft-delete + anonymize the user that currently owns `email` (within gérant scope)."""
        info = await self.find_user_by_email_scoped(gerant_id, email)
        if not info.get("found"):
            return {"found": False}
        if not info.get("in_scope"):
            return {"found": True, "in_scope": False}

        user = info.get("user") or {}
        uid = user.get("id")
        if not uid:
            return {"found": True, "in_scope": True, "updated": False}

        new_email = f"deleted+{uid}@example.invalid"
        await self.user_repo.update_one(
            {"id": uid},
            {
                "$set": {
                    "status": "deleted",
                    "email": new_email,
                    "deleted_at": datetime.now(timezone.utc).isoformat(),
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }
            },
        )
        return {"found": True, "in_scope": True, "updated": True, "user_id": uid, "new_email": new_email}
