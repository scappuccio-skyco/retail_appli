"""Interview notes and debrief methods for SellerService."""
import asyncio
import logging
from datetime import datetime, timezone
from typing import Dict, List, Optional

from models.pagination import PaginatedResponse
from utils.pagination import paginate
from core.exceptions import ForbiddenError

logger = logging.getLogger(__name__)


class NotesMixin:

    async def get_interview_notes_paginated(
        self, seller_id: str, page: int = 1, size: int = 50
    ) -> PaginatedResponse:
        """Get paginated interview notes for seller."""
        if not self.interview_note_repo:
            return PaginatedResponse(items=[], total=0, page=page, size=size, pages=0)
        return await paginate(
            collection=self.interview_note_repo.collection,
            query={"seller_id": seller_id},
            page=page,
            size=size,
            projection={"_id": 0},
            sort=[("date", -1)],
        )

    async def get_interview_note_by_seller_and_date(
        self, seller_id: str, date: str
    ) -> Optional[Dict]:
        """Get interview note for seller on date."""
        if not self.interview_note_repo:
            return None
        return await self.interview_note_repo.find_by_seller_and_date(seller_id, date)

    async def get_interview_notes_by_seller(self, seller_id: str) -> List[Dict]:
        """Get all interview notes for a seller. Used by evaluations route."""
        if not self.interview_note_repo:
            return []
        return await self.interview_note_repo.find_by_seller(seller_id)

    async def get_shared_interview_notes_by_seller(self, seller_id: str) -> List[Dict]:
        """Get interview notes shared with manager for a seller."""
        if not self.interview_note_repo:
            return []
        return await self.interview_note_repo.find_shared_by_seller(seller_id)

    async def toggle_interview_note_visibility(
        self, note_id: str, seller_id: str, shared: bool
    ) -> bool:
        """Toggle shared_with_manager visibility of an interview note."""
        if not self.interview_note_repo:
            return False
        result = await self.interview_note_repo.update_one(
            {"id": note_id, "seller_id": seller_id},
            {"$set": {"shared_with_manager": shared, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
        if result and shared:
            asyncio.create_task(_notify_manager_note_shared(seller_id, note_id))
        return result

    async def create_interview_note(self, note_data: Dict) -> str:
        """Create interview note. Returns note id."""
        if not self.interview_note_repo:
            raise ForbiddenError("Service notes d'entretien non configuré")
        return await self.interview_note_repo.create_note(note_data)

    async def update_interview_note_by_date(
        self, seller_id: str, date: str, update_data: Dict
    ) -> bool:
        """Update interview note by seller and date."""
        if not self.interview_note_repo:
            return False
        return await self.interview_note_repo.update_note_by_date(
            seller_id, date, update_data
        )

    async def get_interview_note_by_id_and_seller(
        self, note_id: str, seller_id: str
    ) -> Optional[Dict]:
        """Get interview note by id and seller (for ownership check)."""
        if not self.interview_note_repo:
            return None
        return await self.interview_note_repo.find_one(
            {"id": note_id, "seller_id": seller_id}, {"_id": 0}
        )

    async def update_interview_note_by_id(
        self, note_id: str, seller_id: str, update_data: Dict
    ) -> bool:
        """Update interview note by id (with seller_id for security)."""
        if not self.interview_note_repo:
            return False
        return await self.interview_note_repo.update_one(
            {"id": note_id, "seller_id": seller_id}, {"$set": update_data}
        )

    async def set_manager_reply_on_note(
        self, note_id: str, seller_id: str, reply: str
    ) -> bool:
        """Write or update manager reply on a shared interview note."""
        if not self.interview_note_repo:
            return False
        return await self.interview_note_repo.update_one(
            {"id": note_id, "seller_id": seller_id},
            {"$set": {
                "manager_reply": reply,
                "manager_reply_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }}
        )

    async def delete_interview_note_by_id(self, note_id: str, seller_id: str) -> bool:
        """Delete interview note by id (with seller_id for security)."""
        if not self.interview_note_repo:
            return False
        return await self.interview_note_repo.delete_note_by_id(note_id, seller_id)

    async def delete_interview_note_by_date(self, seller_id: str, date: str) -> bool:
        """Delete interview note by seller and date."""
        if not self.interview_note_repo:
            return False
        return await self.interview_note_repo.delete_note_by_date(seller_id, date)

    async def create_debrief(self, debrief_data: Dict, seller_id: str) -> str:
        """Create debrief. Used by debriefs route."""
        if not self.debrief_repo:
            raise ForbiddenError("Debrief repository not available")
        return await self.debrief_repo.create_debrief(debrief_data=debrief_data, seller_id=seller_id)

    async def get_debriefs_by_seller(
        self,
        seller_id: str,
        projection: Optional[Dict] = None,
        limit: int = 100,
        sort: Optional[List[tuple]] = None,
    ) -> List[Dict]:
        """Get debriefs for a seller. Used by debriefs route."""
        if not self.debrief_repo:
            return []
        proj = projection or {"_id": 0}
        s = sort or [("created_at", -1)]
        return await self.debrief_repo.find_by_seller(
            seller_id=seller_id, projection=proj, limit=limit, sort=s
        )

    async def get_debriefs_by_store(
        self,
        store_id: str,
        seller_ids: List[str],
        visible_to_manager: bool = True,
        projection: Optional[Dict] = None,
        limit: int = 100,
        sort: Optional[List[tuple]] = None,
    ) -> List[Dict]:
        """Get debriefs for a store (manager view). Used by debriefs route."""
        if not self.debrief_repo:
            return []
        proj = projection or {"_id": 0}
        s = sort or [("created_at", -1)]
        return await self.debrief_repo.find_by_store(
            store_id=store_id,
            seller_ids=seller_ids,
            visible_to_manager=visible_to_manager,
            projection=proj,
            limit=limit,
            sort=s,
        )

    async def update_debrief(
        self, debrief_id: str, update_data: Dict, seller_id: str
    ) -> bool:
        """Update debrief. Used by debriefs route."""
        if not self.debrief_repo:
            return False
        return await self.debrief_repo.update_debrief(
            debrief_id=debrief_id, update_data=update_data, seller_id=seller_id
        )

    async def delete_debrief(self, debrief_id: str, seller_id: str) -> bool:
        """Delete debrief. Used by debriefs route."""
        if not self.debrief_repo:
            return False
        return await self.debrief_repo.delete_debrief(
            debrief_id=debrief_id, seller_id=seller_id
        )


# ---------------------------------------------------------------------------
# Helper module-level (fire-and-forget via asyncio.create_task)
# ---------------------------------------------------------------------------

async def _notify_manager_note_shared(seller_id: str, note_id: str) -> None:
    """
    Fire-and-forget : notifie le manager quand un vendeur partage une note.
    """
    try:
        from core.database import database
        from repositories.user_repository import UserRepository
        from repositories.notification_repository import NotificationRepository

        db = database.db
        if db is None:
            return

        seller = await UserRepository(db).find_by_id(
            seller_id, projection={"_id": 0, "name": 1, "manager_id": 1}
        )
        if not seller or not seller.get("manager_id"):
            return

        seller_name = seller.get("name", "Un vendeur")
        await NotificationRepository(db).create(
            user_id=seller["manager_id"],
            notif_type="note_shared",
            title="Nouvelle note partagée 🗒️",
            message=f"{seller_name} a partagé une note avec vous",
            data={"seller_id": seller_id, "note_id": note_id},
        )
    except Exception as e:
        logger.warning("Note shared notification failed (non-critical): %s", e)
