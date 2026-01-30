"""
Manager - KPI: calculs KPIs, agrégations, bilans équipe.
Repositories injectés par __init__ (pas de db direct).
"""
from datetime import datetime, timezone
from typing import Dict, List, Optional

from models.pagination import PaginatedResponse
from utils.pagination import paginate
from repositories.kpi_repository import KPIRepository, ManagerKPIRepository
from repositories.team_bilan_repository import TeamBilanRepository


class ManagerKpiService:
    """Service KPIs manager (repos injectés)."""

    def __init__(
        self,
        kpi_repo: KPIRepository,
        manager_kpi_repo: ManagerKPIRepository,
        team_bilan_repo: TeamBilanRepository,
    ):
        self.kpi_repo = kpi_repo
        self.manager_kpi_repo = manager_kpi_repo
        self.team_bilan_repo = team_bilan_repo

    async def get_kpi_distinct_dates(self, query: Dict) -> List[str]:
        """Dates distinctes des KPIs vendeurs."""
        return await self.kpi_repo.distinct_dates(query)

    async def get_manager_kpi_distinct_dates(self, query: Dict) -> List[str]:
        """Dates distinctes des KPIs manager."""
        return await self.manager_kpi_repo.distinct_dates(query)

    async def get_manager_kpis_paginated(
        self,
        store_id: str,
        start_date: str,
        end_date: str,
        page: int = 1,
        size: int = 50,
    ) -> PaginatedResponse:
        """KPIs manager paginés par période."""
        query = {
            "store_id": store_id,
            "date": {"$gte": start_date, "$lte": end_date},
        }
        return await paginate(
            collection=self.manager_kpi_repo.collection,
            query=query,
            page=page,
            size=size,
            projection={"_id": 0},
            sort=[("date", -1)],
        )

    async def get_kpi_locked_entries(
        self, store_id: str, date: str, limit: int = 1
    ) -> List[Dict]:
        """Entrées KPI verrouillées pour store/date."""
        return await self.kpi_repo.find_many(
            {"store_id": store_id, "date": date, "locked": True},
            {"_id": 0},
            limit=limit,
        )

    async def get_kpi_entries_locked_or_api(
        self, store_id: str, date: str, limit: int = 1
    ) -> List[Dict]:
        """Entrées KPI verrouillées ou source API."""
        return await self.kpi_repo.find_many(
            {
                "store_id": store_id,
                "date": date,
                "$or": [{"locked": True}, {"source": "api"}],
            },
            {"_id": 0, "locked": 1},
            limit=limit,
        )

    async def get_kpi_entry_by_seller_and_date(
        self, seller_id: str, date: str
    ) -> Optional[Dict]:
        """Entrée KPI vendeur/date."""
        return await self.kpi_repo.find_by_seller_and_date(seller_id, date)

    async def update_kpi_entry_one(self, filter: Dict, update: Dict) -> bool:
        """Met à jour une entrée KPI."""
        return await self.kpi_repo.update_one(filter, {"$set": update})

    async def insert_kpi_entry_one(self, data: Dict) -> str:
        """Insère une entrée KPI."""
        return await self.kpi_repo.insert_one(data)

    async def get_manager_kpi_by_store_and_date(
        self, store_id: str, date: str
    ) -> Optional[Dict]:
        """KPI manager (prospects) store/date."""
        return await self.manager_kpi_repo.find_by_store_and_date(
            store_id, date
        )

    async def update_manager_kpi_one(self, filter: Dict, update: Dict) -> bool:
        """Met à jour une entrée KPI manager."""
        return await self.manager_kpi_repo.update_one(filter, {"$set": update})

    async def insert_manager_kpi_one(self, data: Dict) -> str:
        """Insère une entrée KPI manager."""
        return await self.manager_kpi_repo.insert_one(data)

    async def aggregate_kpi(
        self, pipeline: List[Dict], max_results: int = 1
    ) -> List[Dict]:
        """Agrégation pipeline sur les KPIs."""
        return await self.kpi_repo.aggregate(
            pipeline, max_results=max_results
        )

    async def aggregate_manager_kpi(
        self, pipeline: List[Dict], max_results: int = 1
    ) -> List[Dict]:
        """Agrégation pipeline sur les KPIs manager."""
        return await self.manager_kpi_repo.aggregate(
            pipeline, max_results=max_results
        )

    async def get_kpi_entries_paginated(
        self,
        query: Dict,
        page: int = 1,
        size: int = 50,
    ) -> PaginatedResponse:
        """Entrées KPI paginées par requête."""
        return await paginate(
            collection=self.kpi_repo.collection,
            query=query,
            page=page,
            size=size,
            projection={"_id": 0},
            sort=[("date", -1)],
        )

    async def get_team_bilans_all(
        self, manager_id: str, store_id: str
    ) -> List[Dict]:
        """Tous les bilans équipe pour le manager."""
        return await self.team_bilan_repo.find_by_manager(
            manager_id,
            store_id,
            projection={"_id": 0},
            limit=100,
            sort=[("created_at", -1)],
        )

    async def get_store_kpi_stats(
        self,
        store_id: str,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
    ) -> Dict:
        """Statistiques KPI agrégées du magasin."""
        if not start_date:
            today = datetime.now(timezone.utc)
            start_date = today.replace(day=1).strftime("%Y-%m-%d")
        if not end_date:
            end_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        seller_pipeline = [
            {
                "$match": {
                    "store_id": store_id,
                    "date": {"$gte": start_date, "$lte": end_date},
                }
            },
            {
                "$group": {
                    "_id": None,
                    "total_ca": {
                        "$sum": {
                            "$ifNull": [
                                "$seller_ca",
                                {"$ifNull": ["$ca_journalier", 0]},
                            ]
                        }
                    },
                    "total_ventes": {"$sum": {"$ifNull": ["$nb_ventes", 0]}},
                    "total_articles": {"$sum": {"$ifNull": ["$nb_articles", 0]}},
                },
            },
        ]
        manager_pipeline = [
            {
                "$match": {
                    "store_id": store_id,
                    "date": {"$gte": start_date, "$lte": end_date},
                }
            },
            {
                "$group": {
                    "_id": None,
                    "total_ca": {"$sum": {"$ifNull": ["$ca_journalier", 0]}},
                    "total_ventes": {"$sum": {"$ifNull": ["$nb_ventes", 0]}},
                    "total_articles": {"$sum": {"$ifNull": ["$nb_articles", 0]}},
                },
            },
        ]
        seller_stats = await self.kpi_repo.aggregate(
            seller_pipeline, max_results=1
        )
        manager_stats = await self.manager_kpi_repo.aggregate(
            manager_pipeline, max_results=1
        )
        seller_ca = seller_stats[0].get("total_ca", 0) if seller_stats else 0
        seller_ventes = (
            seller_stats[0].get("total_ventes", 0) if seller_stats else 0
        )
        seller_articles = (
            seller_stats[0].get("total_articles", 0) if seller_stats else 0
        )
        manager_ca = (
            manager_stats[0].get("total_ca", 0) if manager_stats else 0
        )
        manager_ventes = (
            manager_stats[0].get("total_ventes", 0) if manager_stats else 0
        )
        manager_articles = (
            manager_stats[0].get("total_articles", 0) if manager_stats else 0
        )
        total_ca = seller_ca + manager_ca
        total_ventes = seller_ventes + manager_ventes
        total_articles = seller_articles + manager_articles
        return {
            "store_id": store_id,
            "period": {"start": start_date, "end": end_date},
            "total_ca": total_ca,
            "total_ventes": total_ventes,
            "total_articles": total_articles,
            "panier_moyen": (total_ca / total_ventes) if total_ventes > 0 else 0,
            "uvc": (total_articles / total_ventes) if total_ventes > 0 else 0,
            "seller_stats": {
                "ca": seller_ca,
                "ventes": seller_ventes,
                "articles": seller_articles,
            },
            "manager_stats": {
                "ca": manager_ca,
                "ventes": manager_ventes,
                "articles": manager_articles,
            },
        }
