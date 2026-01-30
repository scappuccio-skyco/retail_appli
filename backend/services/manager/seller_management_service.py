"""
Manager - Seller management: vendeurs, invitations, pagination.
Repositories injectés par __init__ (pas de db direct).
"""
from typing import Dict, List, Optional

from models.pagination import PaginatedResponse
from utils.pagination import paginate
from repositories.user_repository import UserRepository
from repositories.invitation_repository import InvitationRepository


class ManagerSellerManagementService:
    """Service gestion vendeurs et invitations (repos injectés)."""

    def __init__(
        self,
        user_repo: UserRepository,
        invitation_repo: InvitationRepository,
    ):
        self.user_repo = user_repo
        self.invitation_repo = invitation_repo

    async def get_user_by_id(
        self, user_id: str, projection: Optional[Dict] = None
    ) -> Optional[Dict]:
        """Récupère un utilisateur par id."""
        proj = projection or {"_id": 0, "password": 0}
        return await self.user_repo.find_one({"id": user_id}, proj)

    async def get_seller_by_id_and_store(
        self, seller_id: str, store_id: str
    ) -> Optional[Dict]:
        """Récupère un vendeur par id et magasin (vérif accès)."""
        return await self.user_repo.find_one(
            {"id": seller_id, "store_id": store_id, "role": "seller"},
            {"_id": 0, "password": 0},
        )

    async def get_users_by_ids_and_store(
        self,
        user_ids: List[str],
        store_id: str,
        role: str = "seller",
        limit: int = 50,
        projection: Optional[Dict] = None,
    ) -> List[Dict]:
        """Récupère des utilisateurs par ids et magasin."""
        if not user_ids:
            return []
        proj = projection or {"_id": 0, "id": 1, "name": 1}
        return await self.user_repo.find_many(
            {"id": {"$in": user_ids}, "store_id": store_id, "role": role},
            proj,
            limit=limit,
        )

    async def get_sellers_for_store_paginated(
        self,
        store_id: str,
        page: int = 1,
        size: int = 100,
        *,
        limit: Optional[int] = None,
        skip: Optional[int] = None,
    ) -> PaginatedResponse:
        """
        Liste paginée des vendeurs actifs du magasin.
        Utilise page/size (convertis en limit et skip par paginate) ou limit/skip explicites.
        """
        if limit is not None and skip is not None:
            page = (skip // limit) + 1 if limit > 0 else 1
            size = limit
        query = {
            "store_id": store_id,
            "role": "seller",
            "$or": [
                {"status": {"$exists": False}},
                {"status": None},
                {"status": "active"},
            ],
        }
        return await paginate(
            collection=self.user_repo.collection,
            query=query,
            page=page,
            size=size,
            projection={"_id": 0, "password": 0},
            sort=[("name", 1)],
        )

    async def get_sellers_by_status_paginated(
        self,
        store_id: str,
        status: str,
        page: int = 1,
        size: int = 50,
        *,
        limit: Optional[int] = None,
        skip: Optional[int] = None,
    ) -> PaginatedResponse:
        """
        Liste paginée des vendeurs par statut (ex: suspended).
        Utilise page/size (limit/skip internes) ou limit/skip explicites.
        """
        if limit is not None and skip is not None:
            page = (skip // limit) + 1 if limit > 0 else 1
            size = limit
        query = {
            "store_id": store_id,
            "role": "seller",
            "status": status,
        }
        return await paginate(
            collection=self.user_repo.collection,
            query=query,
            page=page,
            size=size,
            projection={"_id": 0, "password": 0},
            sort=[("updated_at", -1)],
        )

    async def get_sellers(
        self, manager_id: str, store_id: str, limit: int = 500
    ) -> List[Dict]:
        """
        Liste des vendeurs actifs du magasin (legacy, limitée pour éviter OOM).
        Préférer get_sellers_for_store_paginated(store_id, page, size) pour une
        pagination propre via paginate().
        """
        sellers = await self.user_repo.find_many(
            {
                "store_id": store_id,
                "role": "seller",
                "$or": [
                    {"status": {"$exists": False}},
                    {"status": None},
                    {"status": "active"},
                ],
            },
            {"_id": 0, "password": 0},
            limit=limit,
        )
        return [
            s
            for s in sellers
            if s.get("status") not in ["deleted", "suspended"]
        ]

    async def get_invitations(self, manager_id: str) -> List[Dict]:
        """Invitations en attente pour le manager."""
        return await self.invitation_repo.find_by_manager(
            manager_id,
            status="pending",
            projection={"_id": 0},
            limit=100,
        )
