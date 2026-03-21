"""
AIDataService - Database-integrated AI service for sellers and challenges.
"""

from typing import Dict, List


class AIDataService:
    """
    Service for AI operations with database access (Phase 12: repositories only).
    Handles data retrieval for AI features.
    """

    def __init__(self, db):
        from repositories.diagnostic_repository import DiagnosticRepository
        from repositories.kpi_repository import KPIRepository
        from services.ai_service import AIService
        self.diagnostic_repo = DiagnosticRepository(db)
        self.kpi_repo = KPIRepository(db)
        self.ai_service = AIService()

    async def get_seller_diagnostic(self, seller_id: str) -> Dict:
        """Get diagnostic profile for a seller"""
        diagnostic = await self.diagnostic_repo.find_by_seller(seller_id)

        if not diagnostic:
            return {"style": "Adaptateur", "level": 3}

        return diagnostic

    async def get_recent_kpis(self, seller_id: str, limit: int = 7) -> List[Dict]:
        """Get recent KPI entries for a seller"""
        kpis = await self.kpi_repo.find_by_seller(seller_id, limit=limit)
        return kpis

    async def generate_daily_challenge_with_data(self, seller_id: str) -> Dict:
        """Generate daily challenge by fetching data and using AI service"""
        diagnostic = await self.get_seller_diagnostic(seller_id)
        recent_kpis = await self.get_recent_kpis(seller_id, 7)

        return await self.ai_service.generate_daily_challenge(
            seller_profile=diagnostic,
            recent_kpis=recent_kpis
        )

    async def generate_seller_bilan_with_data(
        self,
        seller_id: str,
        seller_data: Dict,
        days: int = 30,
    ) -> Dict:
        """Generate seller bilan with enriched data: current period, previous period, objectives."""
        from datetime import datetime, timedelta, timezone
        from repositories.objective_repository import ObjectiveRepository

        today = datetime.now(timezone.utc)
        end_date = (today - timedelta(days=1)).strftime("%Y-%m-%d")
        start_date = (today - timedelta(days=days)).strftime("%Y-%m-%d")
        prev_end = (today - timedelta(days=days + 1)).strftime("%Y-%m-%d")
        prev_start = (today - timedelta(days=days * 2)).strftime("%Y-%m-%d")

        # Période courante
        kpis = await self.kpi_repo.find_by_date_range(seller_id, start_date, end_date)

        # Période précédente (même durée, pour comparaison)
        prev_kpis = await self.kpi_repo.find_by_date_range(seller_id, prev_start, prev_end)

        # Objectifs actifs du vendeur
        objectives = []
        store_id = seller_data.get("store_id")
        if store_id:
            try:
                obj_repo = ObjectiveRepository(self.kpi_repo.db)
                objectives = await obj_repo.find_by_seller(
                    seller_id=seller_id,
                    store_id=store_id,
                    limit=10,
                )
            except Exception:
                objectives = []

        return await self.ai_service.generate_seller_bilan(
            seller_data=seller_data,
            kpis=kpis,
            prev_kpis=prev_kpis,
            objectives=objectives,
        )
