"""Achievement notifications, sales, and evaluation methods for SellerService."""
import logging
from datetime import datetime, timezone
from typing import Dict, List, Optional

from models.pagination import PaginatedResponse
from utils.pagination import paginate
from core.exceptions import ForbiddenError

logger = logging.getLogger(__name__)


class SalesMixin:

    async def check_achievement_notification(self, user_id: str, item_type: str, item_id: str) -> bool:
        """
        Check if user has already seen the achievement notification for an objective/challenge

        Args:
            user_id: User ID (seller or manager)
            item_type: "objective" or "challenge"
            item_id: Objective or challenge ID

        Returns:
            True if notification has been seen, False if unseen
        """
        notification = await self.achievement_notification_repo.find_by_user_and_item(
            user_id, item_type, item_id
        )
        return notification is not None

    async def mark_achievement_as_seen(self, user_id: str, item_type: str, item_id: str):
        """
        Mark an achievement notification as seen by a user

        Args:
            user_id: User ID (seller or manager)
            item_type: "objective" or "challenge"
            item_id: Objective or challenge ID
        """
        now = datetime.now(timezone.utc).isoformat()
        notification_data = {
            "seen_at": now,
            "updated_at": now,
            "created_at": now
        }
        await self.achievement_notification_repo.upsert_notification(
            user_id, item_type, item_id, notification_data
        )

    async def add_achievement_notification_flag(self, items: List[Dict], user_id: str, item_type: str):
        """
        Add has_unseen_achievement flag to objectives or challenges

        Args:
            items: List of objectives or challenges
            user_id: User ID (seller or manager)
            item_type: "objective" or "challenge"
        """
        for item in items:
            # Check if item is achieved/completed and notification not seen
            status = item.get('status')
            is_achieved = status in ['achieved', 'completed']

            if is_achieved:
                item_id = item.get('id')
                has_seen = await self.check_achievement_notification(user_id, item_type, item_id)
                item['has_unseen_achievement'] = not has_seen
            else:
                item['has_unseen_achievement'] = False

    async def create_sale(self, seller_id: str, sale_data: Dict) -> Dict:
        """Create a sale for a seller. Used by routes instead of instantiating SaleRepository."""
        if not self.sale_repo:
            raise ForbiddenError("Service non configuré pour les ventes")
        await self.sale_repo.create_sale(sale_data=sale_data, seller_id=seller_id)
        out = {k: v for k, v in sale_data.items() if k != "_id"}
        return out

    async def get_sales_paginated(
        self, user_id: str, role: str, store_id: Optional[str], page: int, size: int
    ) -> PaginatedResponse:
        """Get sales paginated: seller sees own, manager sees store's sellers."""
        if not self.sale_repo:
            return PaginatedResponse(items=[], total=0, page=page, size=size, pages=0)
        if role == "seller":
            return await paginate(
                collection=self.sale_repo.collection,
                query={"seller_id": user_id},
                page=page,
                size=size,
                projection={"_id": 0},
                sort=[("date", -1)],
            )
        if store_id:
            sellers = await self.user_repo.find_many(
                {"store_id": store_id, "role": "seller"},
                projection={"_id": 0, "id": 1},
                limit=100,
            )
            seller_ids = [s["id"] for s in sellers]
            if seller_ids:
                return await paginate(
                    collection=self.sale_repo.collection,
                    query={"seller_id": {"$in": seller_ids}},
                    page=page,
                    size=size,
                    projection={"_id": 0},
                    sort=[("date", -1)],
                )
        return PaginatedResponse(items=[], total=0, page=page, size=size, pages=0)

    async def get_sale_by_id_for_seller(self, sale_id: str, seller_id: str) -> Optional[Dict]:
        """Get a sale by id for a seller (for validation before creating evaluation)."""
        if not self.sale_repo:
            return None
        return await self.sale_repo.find_by_id(
            sale_id=sale_id, seller_id=seller_id, projection={"_id": 0}
        )

    async def create_evaluation(self, seller_id: str, evaluation_data: Dict) -> Dict:
        """Create an evaluation for a sale. Used by routes instead of instantiating EvaluationRepository."""
        if not self.evaluation_repo:
            raise ForbiddenError("Service non configuré pour les évaluations")
        await self.evaluation_repo.create_evaluation(
            evaluation_data=evaluation_data, seller_id=seller_id
        )
        return {k: v for k, v in evaluation_data.items() if k != "_id"}

    async def get_evaluations_paginated(
        self, user_id: str, role: str, store_id: Optional[str], page: int, size: int
    ) -> PaginatedResponse:
        """Get evaluations paginated: seller sees own, manager sees store's sellers."""
        if not self.evaluation_repo:
            return PaginatedResponse(items=[], total=0, page=page, size=size, pages=0)
        if role == "seller":
            return await paginate(
                collection=self.evaluation_repo.collection,
                query={"seller_id": user_id},
                page=page,
                size=size,
                projection={"_id": 0},
                sort=[("created_at", -1)],
            )
        if store_id:
            sellers = await self.user_repo.find_many(
                {"store_id": store_id, "role": "seller"},
                projection={"_id": 0, "id": 1},
                limit=100,
            )
            seller_ids = [s["id"] for s in sellers]
            if seller_ids:
                return await paginate(
                    collection=self.evaluation_repo.collection,
                    query={"seller_id": {"$in": seller_ids}},
                    page=page,
                    size=size,
                    projection={"_id": 0},
                    sort=[("created_at", -1)],
                )
        return PaginatedResponse(items=[], total=0, page=page, size=size, pages=0)
