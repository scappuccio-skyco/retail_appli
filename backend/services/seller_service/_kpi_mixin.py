"""KPI-related methods for SellerService."""
import asyncio
import logging
from typing import Dict, List, Optional

from models.pagination import PaginatedResponse
from utils.pagination import paginate
from utils.kpi_pipeline import build_seller_kpi_pipeline, EMPTY_KPI_METRICS

logger = logging.getLogger(__name__)


class KpiMixin:

    async def get_kpi_distinct_dates(self, query: Dict) -> List[str]:
        """Get distinct dates matching KPI query. Used by routes instead of service.kpi_repo."""
        return await self.kpi_repo.distinct_dates(query)

    async def get_kpi_entries_paginated(
        self, seller_id: str, page: int, size: int, projection: Optional[Dict] = None
    ) -> PaginatedResponse:
        """Get paginated KPI entries for seller. Used by routes instead of service.kpi_repo.collection."""
        proj = projection or {"_id": 0}
        return await paginate(
            collection=self.kpi_repo.collection,
            query={"seller_id": seller_id},
            page=page,
            size=size,
            projection=proj,
            sort=[("date", -1)],
        )

    async def get_kpi_entry_for_seller_date(
        self, seller_id: str, date: str
    ) -> Optional[Dict]:
        """Get KPI entry for seller on date. Used by routes instead of kpi_repo.find_by_seller_and_date."""
        return await self.kpi_repo.find_by_seller_and_date(seller_id, date)

    async def get_kpis_by_date_range(
        self, seller_id: str, start_date: str, end_date: str
    ) -> List[Dict]:
        """Get KPI entries for seller in date range. Used by evaluations route."""
        return await self.kpi_repo.find_by_date_range(seller_id, start_date, end_date)

    async def check_kpi_date_locked(self, store_id: str, date: str) -> bool:
        """Check if store/date has locked or API-sourced KPI entries. Used by routes instead of kpi_repo.find_many."""
        entries = await self.kpi_repo.find_many(
            {
                "store_id": store_id,
                "date": date,
                "$or": [{"locked": True}, {"source": "api"}],
            },
            projection={"_id": 0, "locked": 1, "source": 1},
            limit=1,
        )
        return len(entries) > 0

    async def get_seller_kpi_metrics(
        self,
        seller_id: str,
        start_date: str,
        end_date: str,
    ) -> Dict:
        """
        Source unique de vérité pour les métriques KPI d'un vendeur sur une période.
        Même pipeline que ManagerKpiService.get_seller_kpi_metrics — garantit l'identité
        des résultats entre dashboard vendeur et dashboard manager.
        """
        pipeline = build_seller_kpi_pipeline(seller_id, start_date, end_date)
        result = await self.kpi_repo.aggregate(pipeline, max_results=1)
        return result[0] if result else dict(EMPTY_KPI_METRICS)

    async def update_kpi_entry_by_id(self, entry_id: str, update_data: Dict) -> bool:
        """Update KPI entry by id. Used by routes instead of kpi_repo.update_one."""
        result = await self.kpi_repo.update_one(
            {"id": entry_id}, {"$set": update_data}
        )
        if result and update_data.get("store_id"):
            asyncio.create_task(_emit_kpi_event(update_data))
        return result

    async def create_kpi_entry(self, entry_data: Dict) -> str:
        """Create KPI entry. Used by routes instead of kpi_repo.insert_one."""
        result = await self.kpi_repo.insert_one(entry_data)
        asyncio.create_task(_emit_kpi_event(entry_data))
        return result

    async def get_kpis_for_period_paginated(
        self,
        seller_id: str,
        start_date: Optional[str],
        end_date: Optional[str],
        page: int = 1,
        size: int = 50,
    ) -> PaginatedResponse:
        """Get paginated KPI entries for seller in date range (e.g. for bilan)."""
        query: Dict = {"seller_id": seller_id}
        if start_date and end_date:
            query["date"] = {"$gte": start_date, "$lte": end_date}
        return await paginate(
            collection=self.kpi_repo.collection,
            query=query,
            page=page,
            size=size,
            projection={"_id": 0},
            sort=[("date", -1)],
        )


# ---------------------------------------------------------------------------
# Helper module-level (fire-and-forget via asyncio.create_task)
# ---------------------------------------------------------------------------

_KPI_EVENT_FIELDS = (
    "ca_journalier", "nb_ventes", "nb_articles", "nb_clients", "nb_prospects"
)


async def _emit_kpi_event(entry: dict) -> None:
    """
    Publie un evenement kpi_entry_saved sur le canal WebSocket du store.
    Fire-and-forget : les erreurs sont loggees mais n'interrompent pas le flux.
    """
    store_id = entry.get("store_id")
    if not store_id:
        return
    try:
        from core.ws_manager import ws_manager
        event = {
            "type": "kpi_entry_saved",
            "store_id": store_id,
            "seller_id": entry.get("seller_id"),
            "date": entry.get("date"),
            "data": {k: entry[k] for k in _KPI_EVENT_FIELDS if k in entry},
        }
        await ws_manager.publish(store_id, event)
    except Exception as e:
        logger.warning("KPI event emit failed (non-critical): %s", e)
