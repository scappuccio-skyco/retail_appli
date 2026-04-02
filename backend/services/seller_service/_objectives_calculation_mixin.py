"""Objectives calculation methods for SellerService."""
import logging
from datetime import datetime, timezone
from typing import Dict, List, Optional

logger = logging.getLogger(__name__)


class ObjectivesCalculationMixin:

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
        if isinstance(end_date, datetime):
            end_date_obj = end_date.date()
        else:
            end_date_obj = datetime.fromisoformat(str(end_date).replace("Z", "+00:00")).date()

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
