"""
DiagnosticService — gestionnaire des diagnostics manager.
"""
from __future__ import annotations
from typing import Dict, Optional

from repositories.manager_diagnostic_repository import ManagerDiagnosticRepository


class DiagnosticService:
    """Service for diagnostic operations. Phase 0: repository only, no self.db."""

    def __init__(self, manager_diagnostic_repo: ManagerDiagnosticRepository):
        self.manager_diagnostic_repo = manager_diagnostic_repo

    async def get_manager_diagnostic(
        self, manager_id: str, projection: Optional[Dict] = None
    ) -> Optional[Dict]:
        """Get manager's latest DISC diagnostic profile. Used by diagnostics route."""
        proj = projection or {"_id": 0}
        return await self.manager_diagnostic_repo.find_latest_by_manager(
            manager_id, projection=proj
        )

    async def get_latest_manager_diagnostic(
        self, manager_id: str, projection: Optional[Dict] = None
    ) -> Optional[Dict]:
        """Alias for get_manager_diagnostic. Used by diagnostics route."""
        return await self.get_manager_diagnostic(manager_id, projection)

    async def delete_manager_diagnostic_by_manager(self, manager_id: str) -> bool:
        """Delete latest manager diagnostic (before creating new one). Used by diagnostics route."""
        return await self.manager_diagnostic_repo.delete_one({"manager_id": manager_id})

    async def create_manager_diagnostic(
        self, diagnostic_doc: Dict, manager_id: str
    ) -> str:
        """Create manager diagnostic. Used by diagnostics route."""
        return await self.manager_diagnostic_repo.create_diagnostic(
            diagnostic_doc, manager_id
        )
