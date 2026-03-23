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
from utils.kpi_pipeline import build_seller_kpi_pipeline, EMPTY_KPI_METRICS
from core.cache import get_cache_service, CacheKeys


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

    async def get_locked_seller_ids_by_date(self, store_id: str, date_filter: dict = None) -> dict:
        """Retourne {date: [seller_id, ...]} pour toutes les entrées verrouillées du magasin."""
        query = {"store_id": store_id, "locked": True}
        if date_filter:
            query["date"] = date_filter
        entries = await self.kpi_repo.find_many(
            query,
            {"_id": 0, "date": 1, "seller_id": 1},
            limit=2000,
        )
        result: dict = {}
        for entry in entries:
            date_str = entry.get("date")
            seller_id = entry.get("seller_id")
            if date_str and seller_id:
                result.setdefault(date_str, []).append(seller_id)
        return result

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

    async def get_seller_kpi_metrics(
        self,
        seller_id: str,
        start_date: str,
        end_date: str,
    ) -> Dict:
        """
        Source unique de vérité pour les métriques KPI d'un vendeur sur une période.
        Agrégation 100% server-side — pas de pagination, pas d'approximation client.
        Utilisée par : dashboard manager (SellerDetailView) ET dashboard vendeur (PerformanceModal).
        """
        pipeline = build_seller_kpi_pipeline(seller_id, start_date, end_date)
        result = await self.kpi_repo.aggregate(pipeline, max_results=1)
        return result[0] if result else dict(EMPTY_KPI_METRICS)

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
        """Statistiques KPI agrégées du magasin (avec cache Redis 5min/1h)."""
        if not start_date:
            today = datetime.now(timezone.utc)
            start_date = today.replace(day=1).strftime("%Y-%m-%d")
        if not end_date:
            end_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")

        # Cache Redis : 5 min si période courante, 1h si historique
        cache_key = CacheKeys.key_for_kpi_stats(store_id, start_date, end_date)
        try:
            cache = await get_cache_service()
            cached = await cache.get(cache_key)
            if cached is not None:
                return cached
        except Exception:
            pass  # fallback silencieux

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
        result = {
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

        # Stocker en cache : 5 min si période inclut aujourd'hui, 1h sinon
        try:
            today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
            ttl = 300 if end_date >= today_str else 3600
            await cache.set(cache_key, result, ttl=ttl)
        except Exception:
            pass  # fallback silencieux

        return result
