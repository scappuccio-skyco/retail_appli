"""Profile, workspace, billing and access guard methods for GerantService."""
import logging
from typing import Dict, Optional, List
from datetime import datetime, timezone

from core.exceptions import ForbiddenError

logger = logging.getLogger(__name__)


class ProfileMixin:

    # ===== USER (for routes: no direct user_repo access) =====

    async def get_gerant_by_id(
        self, gerant_id: str, include_password: bool = False
    ) -> Optional[Dict]:
        """Get gérant user by id. Used by routes instead of user_repo.find_by_id."""
        return await self.user_repo.find_by_id(
            user_id=gerant_id, include_password=include_password
        )

    async def find_user_by_email(self, email: str) -> Optional[Dict]:
        """Find *active* user by email.

        Used by routes for duplicate checks (renames). Soft-deleted/inactive users should
        not block email reuse.
        """
        return await self.user_repo.find_one(
            {"email": email, "status": "active"},
            {"_id": 0},
        )

    async def update_gerant_user_one(
        self, gerant_id: str, update_data: Dict
    ) -> bool:
        """Update gérant user. Used by routes instead of user_repo.update_one."""
        return await self.user_repo.update_one(
            {"id": gerant_id}, {"$set": update_data}
        )

    async def update_user_one(self, user_id: str, update_data: Dict) -> bool:
        """Update any user by id (e.g. password for manager/seller). Used by routes."""
        return await self.user_repo.update_one(
            {"id": user_id}, {"$set": update_data}
        )

    async def get_user_by_id(
        self, user_id: str, include_password: bool = False
    ) -> Optional[Dict]:
        """Get any user by id (e.g. manager/seller for password change). Used by routes."""
        return await self.user_repo.find_by_id(
            user_id=user_id, include_password=include_password
        )

    async def insert_user(self, user_doc: Dict) -> None:
        """Insert a user (manager or seller). Used by integrations route."""
        await self.user_repo.insert_one(user_doc)

    async def get_manager_in_store(
        self, store_id: str, manager_id: Optional[str] = None
    ) -> Optional[Dict]:
        """Get manager in store: by manager_id if provided, else first active manager. Used by integrations route."""
        if manager_id:
            return await self.user_repo.find_one(
                {"id": manager_id, "role": "manager", "store_id": store_id},
                {"_id": 0},
            )
        return await self.user_repo.find_one(
            {"role": "manager", "store_id": store_id, "status": "active"},
            {"_id": 0},
        )

    async def count_active_sellers_for_gerant(self, gerant_id: str) -> int:
        """Count active sellers for gérant. Used by routes instead of user_repo.count_active_sellers."""
        return await self.user_repo.count_active_sellers(gerant_id)

    # ===== WORKSPACE (for routes: no direct workspace_repo access) =====

    async def get_workspace_by_id(
        self, workspace_id: str, projection: Optional[Dict] = None
    ) -> Optional[Dict]:
        """Get workspace by id. Used by routes instead of workspace_repo.find_by_id."""
        return await self.workspace_repo.find_by_id(
            workspace_id, projection=projection or {"_id": 0}
        )

    async def update_workspace_one(
        self, workspace_id: str, update_data: Dict
    ) -> bool:
        """Update workspace. Used by routes instead of workspace_repo.update_one."""
        return await self.workspace_repo.update_one(
            {"id": workspace_id}, {"$set": update_data}
        )

    async def log_company_name_change(
        self, old_name: str, new_name: str, workspace_id: str
    ) -> None:
        """Log company name change for audit. Used by routes instead of system_log_repo."""
        if not self.system_log_repo or not old_name or old_name == new_name:
            return
        try:
            await self.system_log_repo.create_log({
                "event": "company_name_updated",
                "workspace_id": workspace_id,
                "old_name": old_name,
                "new_name": new_name,
                "created_at": datetime.now(timezone.utc).isoformat(),
            })
        except Exception as e:
            logger.warning("Failed to log company name change: %s", e)

    # ===== BILLING PROFILE (for routes: no direct billing_profile_repo access) =====

    async def get_billing_profile_by_gerant(self, gerant_id: str) -> Optional[Dict]:
        """Get billing profile for gérant. Used by routes instead of billing_profile_repo.find_by_gerant."""
        if not self.billing_profile_repo:
            return None
        return await self.billing_profile_repo.find_by_gerant(gerant_id)

    async def update_billing_profile_by_gerant(
        self, gerant_id: str, update_data: Dict
    ) -> bool:
        """Update billing profile for gérant. Used by routes."""
        if not self.billing_profile_repo:
            return False
        return await self.billing_profile_repo.update_by_gerant(
            gerant_id, update_data
        )

    async def create_billing_profile(self, profile_data: Dict) -> str:
        """Create billing profile. Used by routes."""
        if not self.billing_profile_repo:
            raise ForbiddenError("Service de facturation non configuré")
        return await self.billing_profile_repo.create(profile_data)

    async def check_gerant_active_access(
        self,
        gerant_id: str,
        allow_user_management: bool = False
    ) -> bool:
        """
        Guard clause: Check if gérant has active subscription for write operations.
        Raises ForbiddenError if trial expired or no active subscription.

        Args:
            gerant_id: Gérant user ID
            allow_user_management: If True, allows suspend/reactivate/delete even if trial_expired.
                                  ⚠️ SECURITY: Only bypasses subscription check, still verifies gérant exists.

        Returns:
            True if access is granted

        Raises:
            ForbiddenError if access denied
        """
        # Get gérant info
        gerant = await self.user_repo.find_one(
            {"id": gerant_id},
            {"_id": 0}
        )

        if not gerant:
            raise ForbiddenError("Utilisateur non trouvé")

        allowed = False
        if allow_user_management:
            if gerant.get('status') == 'deleted':
                raise ForbiddenError("Gérant supprimé")
            allowed = True
        else:
            workspace_id = gerant.get('workspace_id')
            if not workspace_id:
                raise ForbiddenError("Aucun espace de travail associé")

            workspace = await self.workspace_repo.find_by_id(workspace_id, projection={"_id": 0})
            if not workspace:
                raise ForbiddenError("Espace de travail non trouvé")

            subscription_status = workspace.get('subscription_status', 'inactive')
            if subscription_status in ('active', 'past_due'):
                allowed = True
            elif subscription_status == 'trialing':
                trial_end = workspace.get('trial_end')
                if trial_end:
                    if isinstance(trial_end, str):
                        trial_end_dt = datetime.fromisoformat(trial_end.replace('Z', '+00:00'))
                    else:
                        trial_end_dt = trial_end

                    now = datetime.now(timezone.utc)
                    if trial_end_dt.tzinfo is None:
                        trial_end_dt = trial_end_dt.replace(tzinfo=timezone.utc)

                    if now <= trial_end_dt:
                        allowed = True
                    else:
                        await self.workspace_repo.update_one(
                            {"id": workspace_id},
                            {
                                "subscription_status": "trial_expired",
                                "updated_at": datetime.now(timezone.utc).isoformat()
                            }
                        )
                        from core.cache import invalidate_workspace_cache
                        await invalidate_workspace_cache(workspace_id)

        if not allowed:
            raise ForbiddenError(
                "Votre période d'essai est terminée. Veuillez souscrire à un abonnement pour continuer."
            )
        return allowed

    async def check_user_write_access(self, user_id: str) -> bool:
        """
        Guard clause for Sellers/Managers: Get parent Gérant and check access.

        Args:
            user_id: User ID (seller or manager)

        Returns:
            True if access is granted

        Raises:
            ForbiddenError if access denied
        """
        user = await self.user_repo.find_one(
            {"id": user_id},
            {"_id": 0}
        )

        if not user:
            raise ForbiddenError("Utilisateur non trouvé")

        # Get parent gérant_id
        gerant_id = user.get('gerant_id')

        if not gerant_id:
            # Safety: If no parent chain, deny by default
            raise ForbiddenError("Accès refusé: chaîne de parenté non trouvée")

        # Delegate to gérant check
        return await self.check_gerant_active_access(gerant_id)
