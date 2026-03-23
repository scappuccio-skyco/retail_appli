"""Objectives, bilans, and progress computation methods for SellerService."""
import logging
from datetime import datetime, timezone
from typing import Dict, List, Optional

from models.pagination import PaginatedResponse
from utils.pagination import paginate
from core.exceptions import ForbiddenError

logger = logging.getLogger(__name__)


class ObjectivesMixin:

    async def get_bilans_paginated(
        self, seller_id: str, page: int = 1, size: int = 50
    ) -> PaginatedResponse:
        """Get paginated bilans for seller. Used by routes instead of seller_bilan_repo.collection."""
        if not self.seller_bilan_repo:
            return PaginatedResponse(items=[], total=0, page=page, size=size, pages=0)
        return await paginate(
            collection=self.seller_bilan_repo.collection,
            query={"seller_id": seller_id},
            page=page,
            size=size,
            projection={"_id": 0},
            sort=[("created_at", -1)],
        )

    async def create_bilan(self, bilan_data: Dict) -> str:
        """Create bilan. Used by routes instead of seller_bilan_repo.create_bilan."""
        if not self.seller_bilan_repo:
            raise ForbiddenError("Service bilan non configuré")
        return await self.seller_bilan_repo.create_bilan(bilan_data)

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

    async def get_seller_tasks(self, seller_id: str) -> List[Dict]:
        """
        Get all pending tasks for a seller:
        - Diagnostic completion
        - Pending manager requests
        - Debrief submission (if none in last 7 days)
        - Daily challenge not yet completed
        - Active objective expiring in ≤3 days
        - Weekly bilan missing for previous complete week
        """
        from datetime import date, timedelta
        tasks = []
        today = date.today()
        today_str = today.isoformat()

        # --- Diagnostic ---
        diagnostic = await self.diagnostic_repo.find_by_seller(seller_id)
        if not diagnostic:
            tasks.append({
                "id": "diagnostic",
                "type": "diagnostic",
                "category": "action",
                "title": "Complète ton diagnostic vendeur",
                "description": "Découvre ton profil unique en 10 minutes",
                "priority": "high",
                "icon": "📋"
            })

        # --- Debrief (none submitted in last 7 days) ---
        try:
            recent_debriefs = await self.debrief_repo.find_by_seller(
                seller_id,
                projection={"_id": 0, "created_at": 1},
                limit=1,
                sort=[("created_at", -1)],
            )
            if not recent_debriefs:
                tasks.append({
                    "id": "submit-debrief",
                    "type": "debrief",
                    "category": "action",
                    "title": "Soumets ton premier débrief",
                    "description": "Analyse une vente pour affiner ton profil de compétences",
                    "priority": "important",
                    "icon": "🗒️",
                })
            else:
                last_created = recent_debriefs[0].get("created_at")
                if last_created:
                    if isinstance(last_created, str):
                        last_dt = datetime.fromisoformat(last_created.replace("Z", "+00:00"))
                    else:
                        last_dt = last_created
                    if last_dt.tzinfo is None:
                        last_dt = last_dt.replace(tzinfo=timezone.utc)
                    days_since = (datetime.now(timezone.utc) - last_dt).days
                    if days_since > 7:
                        tasks.append({
                            "id": "submit-debrief",
                            "type": "debrief",
                            "category": "action",
                            "title": "Soumets un débrief",
                            "description": f"Dernier débrief il y a {days_since} jours — analyse une vente récente",
                            "priority": "normal",
                            "icon": "🗒️",
                        })
        except Exception:
            pass

        # --- Daily challenge not yet completed ---
        try:
            challenge = await self.daily_challenge_repo.find_by_seller_and_date(seller_id, today_str)
            if challenge and not challenge.get("completed", False):
                tasks.append({
                    "id": "daily-challenge",
                    "type": "challenge",
                    "category": "action",
                    "title": challenge.get("title", "Challenge du jour"),
                    "description": challenge.get("description", "Relève ton défi du jour"),
                    "priority": "normal",
                    "icon": "⚡",
                })
        except Exception:
            pass

        # --- Active objectives: new (≤2 days old) OR expiring in ≤3 days ---
        try:
            seller_profile = await self.user_repo.find_by_id(seller_id)
            store_id = seller_profile.get("store_id") if seller_profile else None
            if store_id:
                deadline_str = (today + timedelta(days=3)).isoformat()
                new_since_str = (today - timedelta(days=2)).isoformat()
                objectives = await self.objective_repo.find_by_seller(
                    seller_id,
                    store_id,
                    projection={"_id": 0, "id": 1, "title": 1, "period_end": 1, "period_start": 1, "status": 1, "created_at": 1},
                    limit=20,
                )
                seen_ids = set()
                for obj in objectives:
                    if obj.get("status") != "active":
                        continue
                    obj_id = obj.get("id", "")
                    period_end = obj.get("period_end", "")
                    created_at = (obj.get("created_at") or "")[:10]  # date part only
                    is_new = created_at >= new_since_str
                    is_expiring = today_str <= period_end <= deadline_str
                    if not (is_new or is_expiring) or obj_id in seen_ids:
                        continue
                    seen_ids.add(obj_id)
                    if is_new and not is_expiring:
                        tasks.append({
                            "id": f"objective-{obj_id}",
                            "type": "objective",
                            "category": "action",
                            "objective_id": obj_id,
                            "title": f"Nouvel objectif : {obj.get('title', '')}",
                            "description": "Consulte tes objectifs pour voir les détails",
                            "priority": "important",
                            "icon": "🎯",
                        })
                    else:
                        days_left = (date.fromisoformat(period_end) - today).days
                        label = "aujourd'hui" if days_left == 0 else ("demain" if days_left == 1 else f"dans {days_left} jours")
                        tasks.append({
                            "id": f"objective-{obj_id}",
                            "type": "objective",
                            "category": "action",
                            "objective_id": obj_id,
                            "title": f"Objectif se termine {label}",
                            "description": obj.get("title", "Vérifie ta progression"),
                            "priority": "important" if days_left <= 1 else "normal",
                            "icon": "🎯",
                        })
        except Exception:
            pass

        # --- Weekly bilan missing for previous complete week ---
        try:
            weekday = today.weekday()  # 0 = Monday
            current_week_monday = today - timedelta(days=weekday)
            prev_week_monday = current_week_monday - timedelta(days=7)
            prev_week_sunday = current_week_monday - timedelta(days=1)
            recent_bilans = await self.seller_bilan_repo.find_by_seller(seller_id, limit=5)
            has_prev_week_bilan = any(
                b.get("period_start", "") <= prev_week_sunday.isoformat()
                and b.get("period_end", "") >= prev_week_monday.isoformat()
                for b in recent_bilans
            )
            if not has_prev_week_bilan:
                tasks.append({
                    "id": "weekly-bilan",
                    "type": "bilan",
                    "category": "action",
                    "title": "Bilan de la semaine passée",
                    "description": f"Semaine du {prev_week_monday.strftime('%d/%m')} au {prev_week_sunday.strftime('%d/%m')} — génère ton analyse",
                    "priority": "normal",
                    "icon": "📊",
                })
        except Exception:
            pass

        return tasks

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

    @staticmethod
    def compute_status(current_value: float, target_value: float, end_date: str) -> str:
        """
        Compute objective status based on current value, target value, and end date.

        Rules:
        - status="active" by default (at creation)
        - status="achieved" only if current_value >= target_value (and target_value > 0)
        - status="failed" only if now > end_date AND not achieved
        - Never force "achieved" based on objective_type alone

        Args:
            current_value: Current progress value
            target_value: Target value
            end_date: End date in format YYYY-MM-DD

        Returns:
            "active" | "achieved" | "failed"
        """
        today = datetime.now(timezone.utc).date()
        end_date_obj = datetime.fromisoformat(end_date).date()

        # Ensure both values are floats for proper comparison (handles string/int/float types)
        current_value = float(current_value) if current_value is not None else 0.0
        target_value = float(target_value) if target_value is not None else 0.0

        # Check if objective is achieved (only if target is meaningful and current >= target)
        is_achieved = False
        if target_value > 0.01:  # Only consider achieved if target is meaningful
            # Use a small epsilon for floating point comparison to handle precision issues
            # This ensures that values like 30000.0 >= 30000.0 are correctly identified as achieved
            is_achieved = current_value >= (target_value - 0.001)

        # Check if period is over (today is after end_date)
        is_expired = today > end_date_obj

        # Determine status
        if is_achieved:
            return "achieved"
        elif is_expired:
            return "failed"
        else:
            return "active"

    async def calculate_objective_progress(self, objective: dict, manager_id: Optional[str] = None):
        """Calculate progress for an objective (team-wide)

        Args:
            objective: Objective dictionary
            manager_id: Optional manager ID (used only if store_id is not available for backward compatibility)
        """
        # If progress is entered manually by the manager or seller, do NOT overwrite it from KPI aggregates.
        # Otherwise, any refresh will "reset" manual progress back to KPI-derived totals (often 0).
        # This prevents synchronization issues where manual updates are overwritten by automatic calculations.
        data_entry_responsible = str(objective.get('data_entry_responsible', '')).lower()
        if data_entry_responsible in ['manager', 'seller']:
            target_value = objective.get('target_value', 0)
            end_date = objective.get('period_end') or objective.get('end_date')
            current_value = float(objective.get('current_value') or 0)
            objective['status'] = self.compute_status(current_value, target_value, end_date)
            # Only update status in DB, keep current_value as-is (manually entered)
            await self.objective_repo.update_objective(
                objective['id'],
                {"status": objective['status']},
                store_id=objective.get('store_id'),
                manager_id=objective.get('manager_id')
            )
            return

        start_date = objective['period_start']
        end_date = objective['period_end']
        store_id = objective.get('store_id')

        # Build query for sellers - prioritize store_id (multi-store support)
        seller_query = {"role": "seller"}
        if store_id:
            # CRITICAL: Use store_id for filtering (works for objectives created by managers OR gérants)
            seller_query["store_id"] = store_id
        elif manager_id:
            # Fallback to manager_id for backward compatibility (only if store_id is not available)
            seller_query["manager_id"] = manager_id
        else:
            # No store_id and no manager_id - cannot calculate progress
            return

        # Get all sellers for this store/manager (PHASE 8: iterator via repository, no .collection)
        seller_ids = []
        async for uid in self.user_repo.find_ids_by_query(seller_query):
            seller_ids.append(uid)

        # ✅ PHASE 6: Use aggregation instead of .to_list(10000) for memory efficiency. Phase 0: use injected repos.
        # Build KPI query with store_id filter if available
        kpi_query = {
            "seller_id": {"$in": seller_ids}
        }
        if store_id:
            kpi_query["store_id"] = store_id

        # Use aggregation to calculate totals (optimized - no .to_list(10000))
        date_range = {"$gte": start_date, "$lte": end_date}
        seller_totals = await self.kpi_repo.aggregate_totals(kpi_query, date_range)

        total_ca = seller_totals["total_ca"]
        total_ventes = seller_totals["total_ventes"]
        total_articles = seller_totals["total_articles"]

        # Fallback to manager KPIs if seller data is missing (only if manager_id is available)
        if manager_id and (total_ca == 0 or total_ventes == 0 or total_articles == 0):
            manager_kpi_query = {"manager_id": manager_id}
            if store_id:
                manager_kpi_query["store_id"] = store_id

            manager_totals = await self.manager_kpi_repo.aggregate_totals(manager_kpi_query, date_range)

            if total_ca == 0:
                total_ca = manager_totals["total_ca"]
            if total_ventes == 0:
                total_ventes = manager_totals["total_ventes"]
            if total_articles == 0:
                total_articles = manager_totals["total_articles"]

        # Calculate averages
        panier_moyen = total_ca / total_ventes if total_ventes > 0 else 0
        indice_vente = total_ca / total_articles if total_articles > 0 else 0

        # Update progress
        objective['progress_ca'] = total_ca
        objective['progress_ventes'] = total_ventes
        objective['progress_articles'] = total_articles
        objective['progress_panier_moyen'] = panier_moyen
        objective['progress_indice_vente'] = indice_vente

        # Determine current_value and target_value for status computation
        target_value = objective.get('target_value', 0)
        current_value = 0

        # For kpi_standard objectives, use the relevant KPI value
        if objective.get('objective_type') == 'kpi_standard' and objective.get('kpi_name'):
            kpi_name = objective['kpi_name']
            if kpi_name == 'ca':
                current_value = total_ca
            elif kpi_name == 'ventes':
                current_value = total_ventes
            elif kpi_name == 'articles':
                current_value = total_articles
            elif kpi_name == 'panier_moyen':
                current_value = panier_moyen
            elif kpi_name == 'indice_vente':
                current_value = indice_vente
        elif objective.get('objective_type') == 'product_focus':
            # For product_focus objectives, use current_value if manually entered, otherwise use target_value as fallback
            # The current_value should be updated manually by seller/manager via progress update endpoint
            current_value = float(objective.get('current_value', 0))
            # If current_value is 0 but we have progress data, it means it hasn't been updated yet
            # In this case, we should use the stored current_value (which might be from manual entry)
        elif objective.get('objective_type') == 'custom':
            # For custom objectives, use current_value if manually entered
            current_value = float(objective.get('current_value', 0))
        else:
            # For other objective types, use current_value if set, otherwise calculate from CA
            current_value = objective.get('current_value', total_ca)
            # For legacy objectives, check if they have specific targets
            if objective.get('ca_target'):
                target_value = objective.get('ca_target', 0)
                current_value = total_ca
            elif objective.get('panier_moyen_target'):
                target_value = objective.get('panier_moyen_target', 0)
                current_value = panier_moyen
            elif objective.get('indice_vente_target'):
                target_value = objective.get('indice_vente_target', 0)
                current_value = indice_vente

        # Ensure current_value and target_value are floats for proper comparison
        current_value = float(current_value) if current_value else 0.0
        target_value = float(target_value) if target_value else 0.0

        # Use centralized status computation
        objective['status'] = self.compute_status(current_value, target_value, end_date)

        # Save progress to database (including computed status)
        # CRITICAL: Use 'objectives' collection (not 'manager_objectives') to match where objectives are created
        await self.objective_repo.update_objective(
            objective['id'],
            {
                "progress_ca": total_ca,
                "progress_ventes": total_ventes,
                "progress_articles": total_articles,
                "progress_panier_moyen": panier_moyen,
                "progress_indice_vente": indice_vente,
                "status": objective['status'],
                "current_value": current_value
            },
            store_id=objective.get('store_id'),
            manager_id=objective.get('manager_id')
        )

    async def calculate_objectives_progress_batch(self, objectives: List[Dict], manager_id: str, store_id: str):
        """
        Calculate progress for multiple objectives in batch (optimized version)
        Preloads all KPI data once instead of N queries per objective

        Args:
            objectives: List of objective dicts
            manager_id: Manager ID
            store_id: Store ID (all objectives must be from same store)

        Returns:
            List of objectives with progress calculated (in-place modification)
        """
        if not objectives:
            return objectives

        # Get all sellers for this store/manager (1 query)
        from utils.db_counter import increment_db_op

        seller_query = {"role": "seller"}
        if store_id:
            seller_query["store_id"] = store_id
        else:
            seller_query["manager_id"] = manager_id

        increment_db_op("db.users.find (sellers - objectives)")
        # PHASE 8: iterator via repository, no .collection / no limit=1000
        seller_ids = []
        async for uid in self.user_repo.find_ids_by_query(seller_query):
            seller_ids.append(uid)

        if not seller_ids:
            # No sellers, set all progress to 0
            for objective in objectives:
                objective['progress_ca'] = 0
                objective['progress_ventes'] = 0
                objective['progress_articles'] = 0
                objective['progress_panier_moyen'] = 0
                objective['progress_indice_vente'] = 0
                objective['current_value'] = 0
                objective['status'] = self.compute_status(0, objective.get('target_value', 0), objective.get('period_end'))
            return objectives

        # Calculate global date range (min start, max end)
        min_start = min(obj.get('period_start', '') for obj in objectives if obj.get('period_start'))
        max_end = max(obj.get('period_end', '') for obj in objectives if obj.get('period_end'))

        if not min_start or not max_end:
            # Invalid date ranges, set all progress to 0
            for objective in objectives:
                objective['progress_ca'] = 0
                objective['progress_ventes'] = 0
                objective['progress_articles'] = 0
                objective['progress_panier_moyen'] = 0
                objective['progress_indice_vente'] = 0
                objective['current_value'] = 0
                objective['status'] = self.compute_status(0, objective.get('target_value', 0), objective.get('period_end'))
            return objectives

        # Preload all KPI entries for the global date range (1 query)
        kpi_query = {
            "seller_id": {"$in": seller_ids},
            "date": {"$gte": min_start, "$lte": max_end}
        }
        if store_id:
            kpi_query["store_id"] = store_id

        increment_db_op("db.kpi_entries.find (batch - objectives)")
        # ⚠️ SECURITY: Limit to 10,000 documents max to prevent OOM
        # If more data is needed, use streaming/cursor approach
        MAX_KPI_BATCH_SIZE = 10000
        # ✅ PHASE 7: Use repository instead of direct DB access (allow_over_limit for internal batch)
        all_kpi_entries = await self.kpi_repo.find_many(
            kpi_query, {"_id": 0}, limit=MAX_KPI_BATCH_SIZE, allow_over_limit=True
        )

        if len(all_kpi_entries) == MAX_KPI_BATCH_SIZE:
            logger.warning(f"KPI entries query hit limit of {MAX_KPI_BATCH_SIZE} documents. Consider using pagination or date range filtering.")

        # Preload all manager KPIs for the global date range (1 query)
        manager_kpi_query = {
            "manager_id": manager_id,
            "date": {"$gte": min_start, "$lte": max_end}
        }
        if store_id:
            manager_kpi_query["store_id"] = store_id

        increment_db_op("db.manager_kpis.find (batch - objectives)")
        # ⚠️ SECURITY: Limit to 10,000 documents max to prevent OOM
        # ✅ PHASE 7: Use repository instead of direct DB access
        all_manager_kpis = await self.manager_kpi_repo.find_many(
            manager_kpi_query, {"_id": 0}, limit=MAX_KPI_BATCH_SIZE, allow_over_limit=True
        )

        if len(all_manager_kpis) == MAX_KPI_BATCH_SIZE:
            logger.warning(f"Manager KPIs query hit limit of {MAX_KPI_BATCH_SIZE} documents. Consider using pagination or date range filtering.")

        # Group KPI entries by (seller_id, date) for fast lookup
        kpi_by_seller_date = {}
        for entry in all_kpi_entries:
            seller_id = entry.get('seller_id')
            date = entry.get('date')
            if seller_id and date:
                key = (seller_id, date)
                if key not in kpi_by_seller_date:
                    kpi_by_seller_date[key] = []
                kpi_by_seller_date[key].append(entry)

        # Group manager KPIs by (manager_id, date) for fast lookup
        manager_kpi_by_date = {}
        for entry in all_manager_kpis:
            date = entry.get('date')
            if date:
                if date not in manager_kpi_by_date:
                    manager_kpi_by_date[date] = []
                manager_kpi_by_date[date].append(entry)

        # Calculate progress for each objective using preloaded data
        updates = []
        for objective in objectives:
            start_date = objective.get('period_start')
            end_date = objective.get('period_end')

            # If progress is entered manually by the manager or seller, do NOT overwrite it from KPI aggregates.
            # Important: this function bulk-writes computed fields back to DB; we must skip manual objectives.
            # This prevents synchronization issues where manual updates are overwritten by automatic calculations.
            data_entry_responsible = str(objective.get('data_entry_responsible', '')).lower()
            if data_entry_responsible in ['manager', 'seller']:
                target_value = objective.get('target_value', 0)
                current_value = float(objective.get('current_value') or 0)
                objective['status'] = self.compute_status(current_value, target_value, end_date)
                # Keep stored progress_* and current_value as-is; do not append bulk update.
                continue

            if not start_date or not end_date:
                # Invalid date range, set progress to 0
                objective['progress_ca'] = 0
                objective['progress_ventes'] = 0
                objective['progress_articles'] = 0
                objective['progress_panier_moyen'] = 0
                objective['progress_indice_vente'] = 0
                objective['current_value'] = 0
                objective['status'] = self.compute_status(0, objective.get('target_value', 0), end_date)
                continue

            # Filter KPI entries for this objective's date range (in-memory filter)
            objective_kpi_entries = [
                entry for entry in all_kpi_entries
                if start_date <= entry.get('date', '') <= end_date
            ]

            # Filter manager KPIs for this objective's date range (in-memory filter)
            objective_manager_kpis = [
                entry for entry in all_manager_kpis
                if start_date <= entry.get('date', '') <= end_date
            ]

            # Calculate totals from seller entries
            total_ca = sum(e.get('ca_journalier', 0) for e in objective_kpi_entries)
            total_ventes = sum(e.get('nb_ventes', 0) for e in objective_kpi_entries)
            total_articles = sum(e.get('nb_articles', 0) for e in objective_kpi_entries)

            # Fallback to manager KPIs if seller data is missing
            if objective_manager_kpis:
                if total_ca == 0:
                    total_ca = sum(e.get('ca_journalier', 0) for e in objective_manager_kpis if e.get('ca_journalier'))
                if total_ventes == 0:
                    total_ventes = sum(e.get('nb_ventes', 0) for e in objective_manager_kpis if e.get('nb_ventes'))
                if total_articles == 0:
                    total_articles = sum(e.get('nb_articles', 0) for e in objective_manager_kpis if e.get('nb_articles'))

            # Calculate averages
            panier_moyen = total_ca / total_ventes if total_ventes > 0 else 0
            indice_vente = total_ca / total_articles if total_articles > 0 else 0

            # Update progress
            objective['progress_ca'] = total_ca
            objective['progress_ventes'] = total_ventes
            objective['progress_articles'] = total_articles
            objective['progress_panier_moyen'] = panier_moyen
            objective['progress_indice_vente'] = indice_vente

            # Determine current_value and target_value for status computation
            target_value = objective.get('target_value', 0)
            current_value = 0

            # For kpi_standard objectives, use the relevant KPI value
            if objective.get('objective_type') == 'kpi_standard' and objective.get('kpi_name'):
                kpi_name = objective['kpi_name']
                if kpi_name == 'ca':
                    current_value = total_ca
                elif kpi_name == 'ventes':
                    current_value = total_ventes
                elif kpi_name == 'articles':
                    current_value = total_articles
                elif kpi_name == 'panier_moyen':
                    current_value = panier_moyen
                elif kpi_name == 'indice_vente':
                    current_value = indice_vente
            else:
                # For other objective types, use current_value if set, otherwise calculate from CA
                current_value = objective.get('current_value', total_ca)
                # For legacy objectives, check if they have specific targets
                if objective.get('ca_target'):
                    target_value = objective.get('ca_target', 0)
                    current_value = total_ca
                elif objective.get('panier_moyen_target'):
                    target_value = objective.get('panier_moyen_target', 0)
                    current_value = panier_moyen
                elif objective.get('indice_vente_target'):
                    target_value = objective.get('indice_vente_target', 0)
                    current_value = indice_vente

            # Use centralized status computation
            objective['status'] = self.compute_status(current_value, target_value, end_date)
            objective['current_value'] = current_value

            # Prepare batch update
            updates.append({
                "id": objective['id'],
                "update": {
                    "$set": {
                        "progress_ca": total_ca,
                        "progress_ventes": total_ventes,
                        "progress_articles": total_articles,
                        "progress_panier_moyen": panier_moyen,
                        "progress_indice_vente": indice_vente,
                        "status": objective['status'],
                        "current_value": current_value
                    }
                }
            })

        # Batch update all objectives (1 bulk operation)
        if updates:
            from pymongo import UpdateOne
            bulk_ops = [UpdateOne({"id": u["id"]}, u["update"]) for u in updates]
            if bulk_ops:
                # CRITICAL: Use 'objectives' collection (not 'manager_objectives') to match where objectives are created
                increment_db_op("db.objectives.bulk_write")
                await self.objective_repo.bulk_write(bulk_ops)

        return objectives
