"""Objectives data access methods for SellerService."""
import logging
from datetime import datetime, timezone
from typing import Dict, List, Optional

from core.exceptions import ForbiddenError

logger = logging.getLogger(__name__)


class ObjectivesMixin:

    async def get_objective_if_accessible(self, objective_id: str, store_id: str) -> Dict:
        """Return objective if it belongs to store; else raise NotFoundError or ForbiddenError."""
        from core.exceptions import NotFoundError
        resource = await self.objective_repo.find_one(
            {"id": objective_id, "store_id": store_id}, {"_id": 0}
        )
        if resource:
            return resource
        exists = await self.objective_repo.find_one({"id": objective_id}, {"_id": 0})
        if exists:
            raise ForbiddenError("Objective non trouvé ou accès refusé")
        raise NotFoundError("Objective non trouvé")

    async def update_objective_progress(
        self,
        objective_id: str,
        store_id: str,
        update_data: Dict,
        progress_entry: Dict,
    ) -> Optional[Dict]:
        """Update objective progress and progress_history. Returns updated objective or None."""
        await self.objective_repo.update_one(
            {"id": objective_id, "store_id": store_id},
            {
                "$set": update_data,
                "$push": {"progress_history": {"$each": [progress_entry], "$slice": -50}},
            },
        )
        return await self.objective_repo.find_by_id(
            objective_id=objective_id, store_id=store_id, projection={"_id": 0}
        )

    async def get_seller_objectives_active(self, seller_id: str, manager_id: Optional[str] = None) -> List[Dict]:
        """
        Get active team objectives for display in seller dashboard

        CRITICAL: Filter by store_id (not manager_id) to include objectives created by:
        - Managers of the store
        - Gérants (store owners)

        The manager_id parameter is optional and only used for progress calculation, NOT for filtering visibility.
        If manager_id is None, progress calculation may be limited but objectives will still be visible.
        """
        today = datetime.now(timezone.utc).date().isoformat()

        # Get seller's store_id for filtering
        # Exclusion-only projection: repo adds password:0; mixing inclusion (store_id:1) with exclusion causes MongoDB error
        seller = await self.user_repo.find_by_id(seller_id, projection={"_id": 0, "password": 0})
        seller_store_id = seller.get("store_id") if seller else None

        if not seller_store_id:
            return []

        # Build query: filter by store_id (not manager_id), visible, and period
        # This ensures objectives created by gérants are also visible to sellers
        query = {
            "store_id": seller_store_id,  # ✅ Filter by store, not manager
            "period_end": {"$gte": today},
            "visible": True
        }
        # manager_id removed from query - used only for progress calculation

        # Get active objectives from the store (created by manager OR gérant)
        objectives = await self.objective_repo.find_by_store(
            seller_store_id,
            projection={"_id": 0},
            limit=100,
            sort=[("period_start", 1)]
        )
        if not isinstance(objectives, list):
            objectives = []
        # Filter by period_end and visible
        objectives = [obj for obj in objectives if obj.get("period_end", "") >= today and obj.get("visible", False)]

        # Filter objectives based on visibility rules
        filtered_objectives = []
        for objective in objectives:
            obj_type = objective.get('type', 'collective')
            visible_to = objective.get('visible_to_sellers')

            # Individual objectives: only show if it's for this seller
            if obj_type == 'individual':
                if objective.get('seller_id') == seller_id:
                    filtered_objectives.append(objective)
            # Collective objectives: check visible_to_sellers list
            else:
                # - If visible_to_sellers is None or [] (empty), objective is visible to ALL sellers
                # - If visible_to_sellers is [id1, id2], objective is visible ONLY to these sellers
                if visible_to is None or (isinstance(visible_to, list) and len(visible_to) == 0):
                    # Visible to all sellers (no restriction)
                    filtered_objectives.append(objective)
                elif isinstance(visible_to, list) and seller_id in visible_to:
                    # Visible only to specific sellers, and this seller is in the list
                    filtered_objectives.append(objective)

        # Ensure status field exists and is up-to-date (recalculate if needed)
        for objective in filtered_objectives:
            current_val = objective.get('current_value', 0)
            target_val = objective.get('target_value', 0)
            period_end = objective.get('period_end')

            # Always recalculate status to ensure it's correct (especially after progress updates)
            if period_end:
                new_status = self.compute_status(current_val, target_val, period_end)
                old_status = objective.get('status')
                objective['status'] = new_status

                # Status updated
            else:
                objective['status'] = 'active'  # Fallback if no end_date

        # Add achievement notification flags
        await self.add_achievement_notification_flag(filtered_objectives, seller_id, "objective")

        # Filter out achieved objectives (they should go to history)
        # Achieved objectives are moved to history, regardless of notification status
        # The notification can still be shown when viewing history or dashboard
        # IMPORTANT: Once an objective is "achieved", it should NEVER appear in active list again
        final_objectives = []

        for objective in filtered_objectives:
            status = objective.get('status')

            # Keep in active list ONLY if status is 'active' or 'failed'
            # ALL achieved objectives go to history (even if has_unseen_achievement is true)
            # The notification modal should be triggered BEFORE the objective moves to history
            if status in ['active', 'failed']:
                final_objectives.append(objective)
            elif status == 'achieved':
                # Exclude from active list - will appear in history
                # Even if has_unseen_achievement is true, don't show it in active list
                pass
            # All other statuses are excluded

        return final_objectives

    async def get_seller_objectives_all(self, seller_id: str, manager_id: Optional[str] = None) -> Dict:
        """
        Get all team objectives (active and inactive) for seller

        CRITICAL: Filter by store_id (not manager_id) to include objectives created by:
        - Managers of the store
        - Gérants (store owners)

        The manager_id parameter is optional and only used for progress calculation, NOT for filtering visibility.
        """
        today = datetime.now(timezone.utc).date().isoformat()

        # Get seller's store_id for filtering
        # Exclusion-only projection: repo adds password:0; mixing inclusion (store_id:1) with exclusion causes MongoDB error
        seller = await self.user_repo.find_by_id(seller_id, projection={"_id": 0, "password": 0})
        seller_store_id = seller.get("store_id") if seller else None

        if not seller_store_id:
            return {"active": [], "inactive": []}

        # Build query: filter by store_id (not manager_id), and visible
        # This ensures objectives created by gérants are also visible to sellers
        query = {
            "store_id": seller_store_id,  # ✅ Filter by store, not manager
            "visible": True
        }
        # manager_id removed from query - used only for progress calculation

        # Get ALL objectives from the store (created by manager OR gérant)
        # CRITICAL: Use 'objectives' collection (not 'manager_objectives') to match where objectives are created
        all_objectives = await self.objective_repo.find_by_store(
            seller_store_id,
            projection={"_id": 0},
            limit=100,
            sort=[("period_start", -1)]
        )
        # Filter by visible
        all_objectives = [obj for obj in all_objectives if obj.get("visible", False)]

        # Filter objectives based on visibility rules and separate active/inactive
        active_objectives = []
        inactive_objectives = []

        for objective in all_objectives:
            obj_type = objective.get('type', 'collective')
            should_include = False

            # Individual objectives: only show if it's for this seller
            if obj_type == 'individual':
                if objective.get('seller_id') == seller_id:
                    should_include = True
            # Collective objectives: check visible_to_sellers list
            else:
                visible_to = objective.get('visible_to_sellers')
                # CRITICAL:
                # - If visible_to_sellers is None or [] (empty), objective is visible to ALL sellers
                # - If visible_to_sellers is [id1, id2], objective is visible ONLY to these sellers
                if visible_to is None or (isinstance(visible_to, list) and len(visible_to) == 0):
                    # Visible to all sellers (no restriction)
                    should_include = True
                elif isinstance(visible_to, list) and seller_id in visible_to:
                    # Visible only to specific sellers, and this seller is in the list
                    should_include = True

            if should_include:
                # Calculate progress
                await self.calculate_objective_progress(objective, manager_id)

                # Separate active vs inactive
                if objective.get('period_end', '') > today:
                    active_objectives.append(objective)
                else:
                    inactive_objectives.append(objective)

        return {
            "active": active_objectives,
            "inactive": inactive_objectives
        }

    async def get_seller_objectives_history(self, seller_id: str, manager_id: Optional[str] = None) -> List[Dict]:
        """
        Get completed objectives (past period_end date OR achieved with notification seen) for seller

        CRITICAL: Filter by store_id (not manager_id) to include objectives created by:
        - Managers of the store
        - Gérants (store owners)

        The manager_id parameter is optional and only used for progress calculation, NOT for filtering visibility.
        """
        today = datetime.now(timezone.utc).date().isoformat()

        # Get seller's store_id for filtering
        # Exclusion-only projection: repo adds password:0; mixing inclusion (store_id:1) with exclusion causes MongoDB error
        seller = await self.user_repo.find_by_id(seller_id, projection={"_id": 0, "password": 0})
        seller_store_id = seller.get("store_id") if seller else None

        if not seller_store_id:
            return []

        # Build query: filter by store_id (not manager_id), visible
        # Include objectives that are:
        # 1. Past period_end date (period_end < today)
        # 2. OR status is 'achieved' or 'failed' (regardless of period_end)
        query = {
            "store_id": seller_store_id,  # ✅ Filter by store, not manager
            "visible": True,
            "$or": [
                {"period_end": {"$lt": today}},  # Period ended
                {"status": {"$in": ["achieved", "failed"]}}  # Or achieved/failed (even if period not ended)
            ]
        }
        # manager_id removed from query - used only for progress calculation

        # Get past objectives from the store (created by manager OR gérant)
        # CRITICAL: Use 'objectives' collection (not 'manager_objectives') to match where objectives are created
        objectives = await self.objective_repo.find_by_store(
            seller_store_id,
            projection={"_id": 0},
            limit=50,
            sort=[("period_start", -1)]
        )
        # Filter by period_end, status, and visible
        objectives = [obj for obj in objectives if (
            obj.get("period_end", "") < today or obj.get("status") in ["achieved", "failed"]
        ) and obj.get("visible", False)]

        # Filter objectives based on visibility rules
        filtered_objectives = []
        for objective in objectives:
            obj_type = objective.get('type', 'collective')

            # Individual objectives: only show if it's for this seller
            if obj_type == 'individual':
                if objective.get('seller_id') == seller_id:
                    filtered_objectives.append(objective)
            # Collective objectives: check visible_to_sellers list
            else:
                visible_to = objective.get('visible_to_sellers')
                # CRITICAL:
                # - If visible_to_sellers is None or [] (empty), objective is visible to ALL sellers
                # - If visible_to_sellers is [id1, id2], objective is visible ONLY to these sellers
                if visible_to is None or (isinstance(visible_to, list) and len(visible_to) == 0):
                    # Visible to all sellers (no restriction)
                    filtered_objectives.append(objective)
                elif isinstance(visible_to, list) and seller_id in visible_to:
                    # Visible only to specific sellers, and this seller is in the list
                    filtered_objectives.append(objective)

        # Calculate progress for each objective (this will recalculate status)
        for objective in filtered_objectives:
            await self.calculate_objective_progress(objective, manager_id)

        # Filter: include ALL objectives that should be in history
        # 1. Period ended (period_end < today) - regardless of status
        # 2. OR status is 'achieved'/'failed' - regardless of notification status
        # This ensures achieved objectives appear in history even if notification wasn't seen
        final_objectives = []
        for objective in filtered_objectives:
            # Recalculate status to ensure it's up-to-date based on current_value and target_value
            # Ensure values are floats for proper comparison (handles string/int/float types)
            current_val = float(objective.get('current_value', 0)) if objective.get('current_value') is not None else 0.0
            target_val = float(objective.get('target_value', 0)) if objective.get('target_value') is not None else 0.0
            period_end_str = objective.get('period_end', '')

            if period_end_str:
                # Always recalculate status to ensure it's correct
                new_status = self.compute_status(current_val, target_val, period_end_str)
                objective['status'] = new_status

            status = objective.get('status')
            period_end = objective.get('period_end', '')

            # Include in history if:
            # 1. Period has ended (regardless of status)
            # 2. OR status is achieved/failed (regardless of period_end or notification status)
            if period_end < today:
                # Period ended, include in history
                final_objectives.append(objective)
            elif status in ['achieved', 'failed']:
                # Achieved/failed, include in history (even if notification not seen)
                final_objectives.append(objective)

            # Add 'achieved' property for frontend compatibility
            # achieved = True if status is 'achieved', False otherwise
            objective['achieved'] = (status == 'achieved')

        return final_objectives
