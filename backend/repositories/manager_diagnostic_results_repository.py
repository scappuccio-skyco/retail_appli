"""
Manager Diagnostic Results Repository - Data access for manager_diagnostic_results collection
(Results of manager diagnostic / profile, used by relationship and conflict services)
"""
from typing import Optional, Dict
from repositories.base_repository import BaseRepository


class ManagerDiagnosticResultsRepository(BaseRepository):
    """Repository for manager_diagnostic_results collection"""

    def __init__(self, db):
        super().__init__(db, "manager_diagnostic_results")

    async def find_by_manager(self, manager_id: str, projection: Optional[Dict] = None) -> Optional[Dict]:
        """Find manager diagnostic result by manager_id."""
        return await self.find_one({"manager_id": manager_id}, projection or {"_id": 0})
