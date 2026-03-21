"""Profile, config, diagnostic, and user access methods for SellerService."""
import logging
from datetime import datetime, timezone
from typing import Dict, List, Optional

from core.exceptions import NotFoundError, ForbiddenError

logger = logging.getLogger(__name__)


class ProfileMixin:

    async def get_seller_subscription_status(self, gerant_id: str) -> Dict:
        """
        Check if the seller's gérant has an active subscription (workspace).
        Returns dict with isReadOnly, status, message, optional daysLeft.
        """
        if not gerant_id:
            return {"isReadOnly": True, "status": "no_gerant", "message": "Aucun gérant associé"}
        gerant = await self.user_repo.find_by_id(user_id=gerant_id)
        if not gerant:
            return {"isReadOnly": True, "status": "gerant_not_found", "message": "Gérant non trouvé"}
        workspace_id = gerant.get("workspace_id")
        if not workspace_id:
            return {"isReadOnly": True, "status": "no_workspace", "message": "Aucun espace de travail"}
        if not self.workspace_repo:
            return {"isReadOnly": True, "status": "error", "message": "Service non configuré"}
        workspace = await self.workspace_repo.find_by_id(workspace_id)
        if not workspace:
            return {"isReadOnly": True, "status": "workspace_not_found", "message": "Espace de travail non trouvé"}
        subscription_status = workspace.get("subscription_status", "inactive")
        if subscription_status == "active":
            return {"isReadOnly": False, "status": "active", "message": "Abonnement actif"}
        if subscription_status == "trialing":
            trial_end = workspace.get("trial_end")
            if trial_end:
                from datetime import timezone as tz
                now = datetime.now(tz.utc)
                if isinstance(trial_end, str):
                    trial_end_dt = datetime.fromisoformat(trial_end.replace("Z", "+00:00"))
                else:
                    trial_end_dt = trial_end
                if trial_end_dt.tzinfo is None:
                    trial_end_dt = trial_end_dt.replace(tzinfo=tz.utc)
                if now < trial_end_dt:
                    days_left = (trial_end_dt - now).days
                    return {"isReadOnly": False, "status": "trialing", "message": f"Essai gratuit - {days_left} jours restants", "daysLeft": days_left}
            return {"isReadOnly": True, "status": "trial_expired", "blockCode": "TRIAL_EXPIRED"}
        # Subscription canceled, past_due, inactive, or any other non-active status
        return {"isReadOnly": True, "status": "subscription_expired", "blockCode": "SUBSCRIPTION_INACTIVE"}

    async def get_kpi_config_for_seller(self, store_id: Optional[str], manager_id: Optional[str]) -> Optional[Dict]:
        """Find KPI config by store_id or manager_id. Returns None if kpi_config_repo not set."""
        if not self.kpi_config_repo:
            return None
        return await self.kpi_config_repo.find_by_store_or_manager(store_id=store_id, manager_id=manager_id)

    async def get_kpi_config_by_store(self, store_id: str) -> Optional[Dict]:
        """Get KPI config for a store. Used by routes instead of service.kpi_config_repo."""
        if not self.kpi_config_repo:
            return None
        return await self.kpi_config_repo.find_by_store(store_id)

    async def get_diagnostic_for_seller(self, seller_id: str) -> Optional[Dict]:
        """Get diagnostic for a seller. Used by routes instead of service.diagnostic_repo."""
        return await self.diagnostic_repo.find_by_seller(seller_id)

    async def update_diagnostic_scores_by_seller(self, seller_id: str, scores: Dict) -> bool:
        """Update diagnostic competence scores for a seller. Used by debriefs route."""
        return await self.diagnostic_repo.update_scores_by_seller(seller_id, scores)

    async def get_disc_profile_for_evaluation(self, user_id: str) -> Optional[Dict]:
        """Get DISC profile for evaluation guide: diagnostic first, then user.disc_profile fallback."""
        diagnostic = await self.diagnostic_repo.find_one(
            {"seller_id": user_id},
            {"_id": 0, "style": 1, "level": 1, "strengths": 1, "weaknesses": 1, "axes_de_developpement": 1},
        )
        if diagnostic:
            if "weaknesses" in diagnostic and "axes_de_developpement" not in diagnostic:
                diagnostic["axes_de_developpement"] = diagnostic.pop("weaknesses", [])
            return diagnostic
        user = await self.user_repo.find_one(
            {"id": user_id},
            {"_id": 0, "disc_profile": 1},
        )
        if user and user.get("disc_profile"):
            return user["disc_profile"]
        return None

    async def create_diagnostic_for_seller(self, diagnostic_data: Dict) -> str:
        """Create diagnostic. Used by routes instead of service.diagnostic_repo."""
        return await self.diagnostic_repo.create_diagnostic(diagnostic_data)

    async def delete_diagnostic_by_seller(self, seller_id: str) -> int:
        """Delete all diagnostics for a seller. Used by routes instead of service.diagnostic_repo."""
        return await self.diagnostic_repo.delete_by_seller(seller_id)

    async def get_seller_profile(
        self, user_id: str, projection: Optional[Dict] = None
    ) -> Optional[Dict]:
        """Get user/seller by id. Used by routes instead of service.user_repo.find_by_id."""
        proj = projection if projection is not None else {"_id": 0, "password": 0}
        return await self.user_repo.find_one({"id": user_id}, proj)

    async def list_managers_for_store(
        self,
        store_id: str,
        projection: Optional[Dict] = None,
        limit: int = 1,
    ) -> List[Dict]:
        """List managers for a store. Used by routes instead of service.user_repo.find_by_store."""
        proj = projection or {"_id": 0, "id": 1, "name": 1}
        return await self.user_repo.find_by_store(
            store_id=store_id, role="manager", projection=proj, limit=limit
        )

    async def get_user_by_id_and_role(
        self, user_id: str, role: str, projection: Optional[Dict] = None
    ) -> Optional[Dict]:
        """Get user by id and role. Used by evaluations/diagnostics and verify_evaluation_employee_access."""
        proj = projection or {"_id": 0}
        return await self.user_repo.find_one({"id": user_id, "role": role}, proj)

    async def get_users_by_store_and_role(
        self,
        store_id: str,
        role: str,
        projection: Optional[Dict] = None,
        limit: int = 100,
    ) -> List[Dict]:
        """Get users in store by role. Used by debriefs route for seller_ids."""
        proj = projection or {"_id": 0, "id": 1}
        return await self.user_repo.find_by_store(
            store_id=store_id, role=role, projection=proj, limit=limit
        )

    async def update_seller_manager_id(self, seller_id: str, manager_id: str) -> None:
        """Set manager_id on a seller. Used by routes instead of service.user_repo.update_one."""
        await self.user_repo.update_one(
            {"id": seller_id},
            {"$set": {"manager_id": manager_id, "updated_at": datetime.now(timezone.utc).isoformat()}},
        )

    async def ensure_seller_has_manager_link(self, seller_id: str) -> Optional[Dict]:
        """
        If seller has store_id but no manager_id, find first active manager for store and link.
        Returns seller profile (possibly updated). Used by objectives/challenges routes.
        """
        user = await self.get_seller_profile(seller_id)
        if not user or user.get("manager_id") or not user.get("store_id"):
            return user
        store_id = user["store_id"]
        managers = await self.list_managers_for_store(store_id, limit=1)
        manager = managers[0] if managers and managers[0].get("status") == "active" else None
        if not manager:
            return user
        manager_id = manager.get("id")
        await self.update_seller_manager_id(seller_id, manager_id)
        user["manager_id"] = manager_id
        return user

    async def get_store_by_id(
        self,
        store_id: str,
        gerant_id: Optional[str] = None,
        projection: Optional[Dict] = None,
    ) -> Optional[Dict]:
        """Get store by id. Used by routes instead of service.store_repo."""
        if not self.store_repo:
            return None
        return await self.store_repo.find_by_id(
            store_id=store_id, gerant_id=gerant_id, projection=projection
        )
