"""Challenges and daily challenge methods for SellerService."""
import logging
from datetime import datetime, timezone
from typing import Dict, List, Optional

from models.pagination import PaginatedResponse
from utils.pagination import paginate
from core.exceptions import ForbiddenError

logger = logging.getLogger(__name__)


class ChallengesMixin:

    async def get_challenge_if_accessible(self, challenge_id: str, store_id: str) -> Dict:
        """Return challenge if it belongs to store; else raise NotFoundError or ForbiddenError."""
        from core.exceptions import NotFoundError
        resource = await self.challenge_repo.find_one(
            {"id": challenge_id, "store_id": store_id}, {"_id": 0}
        )
        if resource:
            return resource
        exists = await self.challenge_repo.find_one({"id": challenge_id}, {"_id": 0})
        if exists:
            raise ForbiddenError("Challenge non trouvé ou accès refusé")
        raise NotFoundError("Challenge non trouvé")

    async def update_challenge_progress(
        self,
        challenge_id: str,
        store_id: str,
        update_data: Dict,
        progress_entry: Dict,
    ) -> Optional[Dict]:
        """Update challenge progress and progress_history. Returns updated challenge or None."""
        await self.challenge_repo.update_one(
            {"id": challenge_id, "store_id": store_id},
            {
                "$set": update_data,
                "$push": {"progress_history": {"$each": [progress_entry], "$slice": -50}},
            },
        )
        return await self.challenge_repo.find_by_id(
            challenge_id=challenge_id, store_id=store_id, projection={"_id": 0}
        )

    async def get_daily_challenge_for_seller_date(
        self, seller_id: str, date: str
    ) -> Optional[Dict]:
        """Get daily challenge for seller on date. Returns None if not set."""
        if not self.daily_challenge_repo:
            return None
        return await self.daily_challenge_repo.find_by_seller_and_date(seller_id, date)

    async def get_daily_challenge_completed_today(
        self, seller_id: str, date: str
    ) -> Optional[Dict]:
        """Get completed daily challenge for seller on date."""
        if not self.daily_challenge_repo:
            return None
        return await self.daily_challenge_repo.find_completed_today(seller_id, date)

    async def create_daily_challenge(self, challenge_data: Dict) -> str:
        """Create a daily challenge. Returns challenge id."""
        if not self.daily_challenge_repo:
            raise ForbiddenError("Service non configuré pour les défis quotidiens")
        return await self.daily_challenge_repo.create_challenge(challenge_data)

    async def update_daily_challenge(
        self, seller_id: str, date: str, update_data: Dict
    ) -> bool:
        """Update daily challenge for seller on date."""
        if not self.daily_challenge_repo:
            return False
        return await self.daily_challenge_repo.update_challenge(
            seller_id, date, update_data
        )

    async def delete_daily_challenges_for_seller(self, seller_id: str) -> int:
        """Delete all daily challenges for a seller."""
        if not self.daily_challenge_repo:
            return 0
        return await self.daily_challenge_repo.delete_by_seller(seller_id)

    async def get_daily_challenges_paginated(
        self, seller_id: str, page: int, size: int
    ) -> PaginatedResponse:
        """Get paginated daily challenges for seller."""
        if not self.daily_challenge_repo:
            return PaginatedResponse(items=[], total=0, page=page, size=size, pages=0)
        return await paginate(
            collection=self.daily_challenge_repo.collection,
            query={"seller_id": seller_id},
            page=page,
            size=size,
            projection={"_id": 0},
            sort=[("date", -1)],
        )

    async def delete_daily_challenges_by_filter(self, filters: Dict) -> int:
        """Delete daily challenges matching filters (e.g. for reset)."""
        if not self.daily_challenge_repo:
            return 0
        return await self.daily_challenge_repo.delete_many(filters)

    async def get_seller_challenges(self, seller_id: str, manager_id: str) -> List[Dict]:
        """
        Get all challenges (collective + individual) for seller

        CRITICAL: Filter by store_id (not manager_id) to include challenges created by:
        - Managers of the store
        - Gérants (store owners)
        """
        # Get seller's store_id for filtering
        # Exclusion-only projection: repo adds password:0; mixing inclusion (store_id:1) with exclusion causes MongoDB error
        seller = await self.user_repo.find_by_id(seller_id, projection={"_id": 0, "password": 0})
        seller_store_id = seller.get("store_id") if seller else None

        if not seller_store_id:
            return []

        # Build query: filter by store_id (not manager_id), visible, and type
        # This ensures challenges created by gérants are also visible to sellers
        query = {
            "store_id": seller_store_id,  # ✅ Filter by store, not manager
            "visible": True,
            "$or": [
                {"type": "collective"},
                {"type": "individual", "seller_id": seller_id}
            ]
        }
        # manager_id removed from query - used only for progress calculation

        # Get collective challenges + individual challenges assigned to this seller
        # From the store (created by manager OR gérant)
        challenges = await self.challenge_repo.find_by_store(
            seller_store_id,
            projection={"_id": 0},
            limit=100,
            sort=[("created_at", -1)]
        )
        # Filter by visible and type
        challenges = [c for c in challenges if c.get("visible", False) and (
            c.get("type") == "collective" or (c.get("type") == "individual" and c.get("seller_id") == seller_id)
        )]

        # Filter challenges based on visibility rules (for collective challenges)
        filtered_challenges = []
        for challenge in challenges:
            chall_type = challenge.get('type', 'collective')

            # Individual challenges: already filtered by query
            if chall_type == 'individual':
                filtered_challenges.append(challenge)
            # Collective challenges: check visible_to_sellers list
            else:
                visible_to = challenge.get('visible_to_sellers')
                # CRITICAL:
                # - If visible_to_sellers is None or [] (empty), challenge is visible to ALL sellers
                # - If visible_to_sellers is [id1, id2], challenge is visible ONLY to these sellers
                if visible_to is None or (isinstance(visible_to, list) and len(visible_to) == 0):
                    # Visible to all sellers (no restriction)
                    filtered_challenges.append(challenge)
                elif isinstance(visible_to, list) and seller_id in visible_to:
                    # Visible only to specific sellers, and this seller is in the list
                    filtered_challenges.append(challenge)

        for challenge in filtered_challenges:
            await self.calculate_challenge_progress(challenge, seller_id)
        await self.add_achievement_notification_flag(filtered_challenges, seller_id, "challenge")

        result = filtered_challenges
        return result

    async def get_seller_challenges_active(self, seller_id: str, manager_id: Optional[str] = None) -> List[Dict]:
        """
        Get only active challenges (collective + personal) for display in seller dashboard

        CRITICAL: Filter by store_id (not manager_id) to include challenges created by:
        - Managers of the store
        - Gérants (store owners)

        The manager_id parameter is optional and only used for progress calculation, NOT for filtering visibility.
        If manager_id is None, progress calculation may be limited but challenges will still be visible.
        """
        today = datetime.now(timezone.utc).date().isoformat()

        # Get seller's store_id for filtering
        # Exclusion-only projection: repo adds password:0; mixing inclusion (store_id:1) with exclusion causes MongoDB error
        seller = await self.user_repo.find_by_id(seller_id, projection={"_id": 0, "password": 0})
        seller_store_id = seller.get("store_id") if seller else None

        if not seller_store_id:
            return []

        # Build query: filter by store_id (not manager_id), visible, and period
        # This ensures challenges created by gérants are also visible to sellers
        # Note: We don't filter by status here because we need to calculate it first
        query = {
            "store_id": seller_store_id,  # ✅ Filter by store, not manager
            "end_date": {"$gte": today},
            "visible": True
        }
        # manager_id removed from query - used only for progress calculation

        # Get active challenges from the store (created by manager OR gérant)
        challenges = await self.challenge_repo.find_by_store(
            seller_store_id,
            projection={"_id": 0},
            limit=10,
            sort=[("start_date", 1)]
        )
        if not isinstance(challenges, list):
            challenges = []
        # Filter by end_date and visible
        challenges = [c for c in challenges if c.get("end_date", "") >= today and c.get("visible", False)]

        # Filter challenges based on visibility rules
        filtered_challenges = []
        for challenge in challenges:
            chall_type = challenge.get('type', 'collective')
            visible_to = challenge.get('visible_to_sellers')

            # Individual challenges: only show if it's for this seller
            if chall_type == 'individual':
                if challenge.get('seller_id') == seller_id:
                    filtered_challenges.append(challenge)
            # Collective challenges: check visible_to_sellers list
            else:
                # If visible_to_sellers is None or [] (empty), challenge is visible to ALL sellers
                # If visible_to_sellers is [id1, id2], challenge is visible ONLY to these sellers
                if visible_to is None or (isinstance(visible_to, list) and len(visible_to) == 0):
                    filtered_challenges.append(challenge)
                elif isinstance(visible_to, list) and seller_id in visible_to:
                    filtered_challenges.append(challenge)

        # Calculate progress for each challenge
        for challenge in filtered_challenges:
            await self.calculate_challenge_progress(challenge, seller_id)

        # Add achievement notification flags
        await self.add_achievement_notification_flag(filtered_challenges, seller_id, "challenge")

        # Filter out achieved/completed challenges (they should go to history)
        final_challenges = []
        for challenge in filtered_challenges:
            status = challenge.get('status')

            # Keep in active list ONLY if status is 'active' or 'failed'
            # ALL achieved/completed challenges go to history
            if status in ['active', 'failed']:
                final_challenges.append(challenge)
            elif status in ['achieved', 'completed']:
                # Exclude from active list - will appear in history
                pass
            # All other statuses are excluded

        return final_challenges

    async def get_seller_challenges_history(self, seller_id: str, manager_id: Optional[str] = None) -> List[Dict]:
        """
        Get completed challenges (past end_date) for seller

        CRITICAL: Filter by store_id (not manager_id) to include challenges created by:
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

        # Build query: filter by store_id (not manager_id), visible, and period
        # This ensures challenges created by gérants are also visible to sellers
        query = {
            "store_id": seller_store_id,  # ✅ Filter by store, not manager
            "end_date": {"$lt": today},
            "visible": True
        }
        # manager_id removed from query - used only for progress calculation

        # Get past challenges from the store (created by manager OR gérant)
        challenges = await self.challenge_repo.find_by_store(
            seller_store_id,
            projection={"_id": 0},
            limit=50,
            sort=[("start_date", -1)]
        )
        # Filter by end_date and visible
        challenges = [c for c in challenges if c.get("end_date", "") < today and c.get("visible", False)]

        # Filter challenges based on visibility rules
        filtered_challenges = []
        for challenge in challenges:
            chall_type = challenge.get('type', 'collective')

            # Individual challenges: only show if it's for this seller
            if chall_type == 'individual':
                if challenge.get('seller_id') == seller_id:
                    filtered_challenges.append(challenge)
            # Collective challenges: check visible_to_sellers list
            else:
                visible_to = challenge.get('visible_to_sellers')
                # CRITICAL:
                # - If visible_to_sellers is None or [] (empty), challenge is visible to ALL sellers
                # - If visible_to_sellers is [id1, id2], challenge is visible ONLY to these sellers
                if visible_to is None or (isinstance(visible_to, list) and len(visible_to) == 0):
                    # Visible to all sellers (no restriction)
                    filtered_challenges.append(challenge)
                elif isinstance(visible_to, list) and seller_id in visible_to:
                    # Visible only to specific sellers, and this seller is in the list
                    filtered_challenges.append(challenge)

        # Calculate progress for each challenge
        for challenge in filtered_challenges:
            await self.calculate_challenge_progress(challenge, seller_id)

        # Add 'achieved' property for frontend compatibility
        for challenge in filtered_challenges:
            status = challenge.get('status')
            # achieved = True if status is 'achieved' or 'completed', False otherwise
            challenge['achieved'] = (status in ['achieved', 'completed'])

        return filtered_challenges

    async def calculate_challenge_progress(self, challenge: dict, seller_id: str = None):
        """Calculate progress for a challenge"""
        # If progress is entered manually by the manager or seller, do NOT overwrite it from KPI aggregates.
        # Otherwise, any refresh will "reset" manual progress back to KPI-derived totals (often 0).
        # This prevents synchronization issues where manual updates are overwritten by automatic calculations.
        data_entry_responsible = str(challenge.get('data_entry_responsible', '')).lower()
        if data_entry_responsible in ['manager', 'seller']:
            target_value = challenge.get('target_value', 0)
            end_date = challenge.get('end_date') or challenge.get('period_end')
            current_value = float(challenge.get('current_value') or 0)
            # Recalculate status based on current_value (manually entered)
            new_status = self.compute_status(current_value, target_value, end_date)
            challenge['status'] = new_status
            # Only update status in DB, keep current_value as-is (manually entered)
            update_data = {"status": new_status}
            if new_status in ['achieved', 'completed']:
                update_data["completed_at"] = datetime.now(timezone.utc).isoformat()
            await self.challenge_repo.update_challenge(
                challenge['id'],
                update_data,
                store_id=challenge.get('store_id'),
                manager_id=challenge.get('manager_id')
            )
            return

        start_date = challenge.get('start_date') or challenge.get('period_start')
        end_date = challenge.get('end_date') or challenge.get('period_end')
        manager_id = challenge['manager_id']
        store_id = challenge.get('store_id')

        if challenge.get('type') == 'collective':
            # Get all sellers for this manager/store
            seller_query = {"role": "seller"}
            if store_id:
                seller_query["store_id"] = store_id
            else:
                seller_query["manager_id"] = manager_id

            # PHASE 8: iterator via repository, no .collection / no limit=1000
            seller_ids = []
            async for uid in self.user_repo.find_ids_by_query(seller_query):
                seller_ids.append(uid)

            # ✅ PHASE 6: Use aggregation instead of .to_list(10000) for memory efficiency
            # ✅ PHASE 7: Use injected repositories
            kpi_repo = self.kpi_repo
            manager_kpi_repo = self.manager_kpi_repo

            # Get KPI entries for all sellers in date range
            kpi_query = {
                "seller_id": {"$in": seller_ids}
            }
            if store_id:
                kpi_query["store_id"] = store_id

            date_range = {"$gte": start_date, "$lte": end_date}
            seller_totals = await kpi_repo.aggregate_totals(kpi_query, date_range)

            total_ca = seller_totals["total_ca"]
            total_ventes = seller_totals["total_ventes"]
            total_articles = seller_totals["total_articles"]
        else:
            # Individual challenge. Phase 0: use injected kpi_repo.
            target_seller_id = seller_id or challenge.get('seller_id')

            kpi_query = {"seller_id": target_seller_id}
            date_range = {"$gte": start_date, "$lte": end_date}
            seller_totals = await self.kpi_repo.aggregate_totals(kpi_query, date_range)

            total_ca = seller_totals["total_ca"]
            total_ventes = seller_totals["total_ventes"]
            total_articles = seller_totals["total_articles"]

        # Fallback to manager KPIs if seller data is missing
        if manager_id and (total_ca == 0 or total_ventes == 0 or total_articles == 0):
            manager_kpi_query = {"manager_id": manager_id}
            if store_id:
                manager_kpi_query["store_id"] = store_id

            date_range = {"$gte": start_date, "$lte": end_date}
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
        challenge['progress_ca'] = total_ca
        challenge['progress_ventes'] = total_ventes
        challenge['progress_articles'] = total_articles
        challenge['progress_panier_moyen'] = panier_moyen
        challenge['progress_indice_vente'] = indice_vente

        # Check if challenge is completed
        if datetime.now().strftime('%Y-%m-%d') > end_date:
            if challenge['status'] == 'active':
                # Check if all targets are met
                completed = True
                if challenge.get('ca_target') and total_ca < challenge['ca_target']:
                    completed = False
                if challenge.get('ventes_target') and total_ventes < challenge['ventes_target']:
                    completed = False
                if challenge.get('panier_moyen_target') and panier_moyen < challenge['panier_moyen_target']:
                    completed = False
                if challenge.get('indice_vente_target') and indice_vente < challenge['indice_vente_target']:
                    completed = False

                new_status = 'completed' if completed else 'failed'
                await self.challenge_repo.update_challenge(
                    challenge['id'],
                    {
                        "status": new_status,
                        "completed_at": datetime.now(timezone.utc).isoformat(),
                        "progress_ca": total_ca,
                        "progress_ventes": total_ventes,
                        "progress_articles": total_articles,
                        "progress_panier_moyen": panier_moyen,
                        "progress_indice_vente": indice_vente
                    },
                    store_id=challenge.get('store_id'),
                    manager_id=challenge.get('manager_id')
                )
                challenge['status'] = new_status
        else:
            # Challenge in progress: save only progress values
            await self.challenge_repo.update_challenge(
                challenge['id'],
                {
                    "progress_ca": total_ca,
                    "progress_ventes": total_ventes,
                    "progress_articles": total_articles,
                    "progress_panier_moyen": panier_moyen,
                    "progress_indice_vente": indice_vente
                },
                store_id=challenge.get('store_id'),
                manager_id=challenge.get('manager_id')
            )

    async def calculate_challenges_progress_batch(self, challenges: List[Dict], manager_id: str, store_id: str):
        """
        Calculate progress for multiple challenges in batch (optimized version)
        Preloads all KPI data once instead of N queries per challenge

        Args:
            challenges: List of challenge dicts
            manager_id: Manager ID
            store_id: Store ID (all challenges must be from same store)

        Returns:
            List of challenges with progress calculated (in-place modification)
        """
        result = challenges
        if not result:
            return result

        # Get all sellers for this store/manager (1 query)
        from utils.db_counter import increment_db_op

        seller_query = {"role": "seller"}
        if store_id:
            seller_query["store_id"] = store_id
        else:
            seller_query["manager_id"] = manager_id

        increment_db_op("db.users.find (sellers - challenges)")
        # PHASE 8: iterator via repository, no .collection / no limit=1000
        seller_ids = []
        async for uid in self.user_repo.find_ids_by_query(seller_query):
            seller_ids.append(uid)

        # Calculate global date range (min start, max end)
        date_ranges = []
        individual_seller_ids = set()
        for challenge in challenges:
            start_date = challenge.get('start_date') or challenge.get('period_start')
            end_date = challenge.get('end_date') or challenge.get('period_end')
            if start_date and end_date:
                date_ranges.append((start_date, end_date))

            # Collect individual challenge seller_ids
            if challenge.get('type') != 'collective':
                individual_seller_id = challenge.get('seller_id')
                if individual_seller_id:
                    individual_seller_ids.add(individual_seller_id)

        if not date_ranges:
            # No valid date ranges, set all progress to 0
            for challenge in result:
                challenge['progress_ca'] = 0
                challenge['progress_ventes'] = 0
                challenge['progress_articles'] = 0
                challenge['progress_panier_moyen'] = 0
                challenge['progress_indice_vente'] = 0
        else:
            min_start = min(dr[0] for dr in date_ranges)
            max_end = max(dr[1] for dr in date_ranges)

            # Combine seller_ids (collective + individual)
            all_seller_ids = list(set(seller_ids + list(individual_seller_ids)))

            # Preload all KPI entries for the global date range (1 query)
            kpi_query = {
                "seller_id": {"$in": all_seller_ids},
                "date": {"$gte": min_start, "$lte": max_end}
            }
            if store_id:
                kpi_query["store_id"] = store_id

            increment_db_op("db.kpi_entries.find (batch - challenges)")
            # ⚠️ SECURITY: Limit to 10,000 documents max to prevent OOM
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

            increment_db_op("db.manager_kpis.find (batch - challenges)")
            # ⚠️ SECURITY: Limit to 10,000 documents max to prevent OOM
            # ✅ PHASE 7: Use repository instead of direct DB access
            all_manager_kpis = await self.manager_kpi_repo.find_many(
                manager_kpi_query, {"_id": 0}, limit=MAX_KPI_BATCH_SIZE, allow_over_limit=True
            )

            if len(all_manager_kpis) == MAX_KPI_BATCH_SIZE:
                logger.warning(f"Manager KPIs query hit limit of {MAX_KPI_BATCH_SIZE} documents. Consider using pagination or date range filtering.")

            # Calculate progress for each challenge using preloaded data
            updates = []
            today = datetime.now(timezone.utc).date().isoformat()

            for challenge in result:
                start_date = challenge.get('start_date') or challenge.get('period_start')
                end_date = challenge.get('end_date') or challenge.get('period_end')

                # If progress is entered manually by the manager or seller, do NOT overwrite it from KPI aggregates.
                data_entry_responsible = str(challenge.get('data_entry_responsible', '')).lower()
                if data_entry_responsible in ['manager', 'seller']:
                    target_value = challenge.get('target_value', 0)
                    current_value = float(challenge.get('current_value') or 0)
                    new_status = self.compute_status(current_value, target_value, end_date)
                    challenge['status'] = new_status
                    continue

                if not start_date or not end_date:
                    challenge['progress_ca'] = 0
                    challenge['progress_ventes'] = 0
                    challenge['progress_articles'] = 0
                    challenge['progress_panier_moyen'] = 0
                    challenge['progress_indice_vente'] = 0
                    continue

                # Filter KPI entries for this challenge's date range and type
                if challenge.get('type') == 'collective':
                    challenge_kpi_entries = [
                        entry for entry in all_kpi_entries
                        if entry.get('seller_id') in seller_ids
                        and start_date <= entry.get('date', '') <= end_date
                    ]
                else:
                    target_seller_id = challenge.get('seller_id')
                    challenge_kpi_entries = [
                        entry for entry in all_kpi_entries
                        if entry.get('seller_id') == target_seller_id
                        and start_date <= entry.get('date', '') <= end_date
                    ]

                challenge_manager_kpis = [
                    entry for entry in all_manager_kpis
                    if start_date <= entry.get('date', '') <= end_date
                ]

                total_ca = sum(e.get('ca_journalier', 0) for e in challenge_kpi_entries)
                total_ventes = sum(e.get('nb_ventes', 0) for e in challenge_kpi_entries)
                total_articles = sum(e.get('nb_articles', 0) for e in challenge_kpi_entries)

                if challenge_manager_kpis:
                    if total_ca == 0:
                        total_ca = sum(e.get('ca_journalier', 0) for e in challenge_manager_kpis if e.get('ca_journalier'))
                    if total_ventes == 0:
                        total_ventes = sum(e.get('nb_ventes', 0) for e in challenge_manager_kpis if e.get('nb_ventes'))
                    if total_articles == 0:
                        total_articles = sum(e.get('nb_articles', 0) for e in challenge_manager_kpis if e.get('nb_articles'))

                panier_moyen = total_ca / total_ventes if total_ventes > 0 else 0
                indice_vente = total_ca / total_articles if total_articles > 0 else 0

                challenge['progress_ca'] = total_ca
                challenge['progress_ventes'] = total_ventes
                challenge['progress_articles'] = total_articles
                challenge['progress_panier_moyen'] = panier_moyen
                challenge['progress_indice_vente'] = indice_vente

                update_data = {
                    "progress_ca": total_ca,
                    "progress_ventes": total_ventes,
                    "progress_articles": total_articles,
                    "progress_panier_moyen": panier_moyen,
                    "progress_indice_vente": indice_vente
                }

                if today > end_date and challenge.get('status') == 'active':
                    completed = True
                    if challenge.get('ca_target') and total_ca < challenge['ca_target']:
                        completed = False
                    if challenge.get('ventes_target') and total_ventes < challenge['ventes_target']:
                        completed = False
                    if challenge.get('panier_moyen_target') and panier_moyen < challenge['panier_moyen_target']:
                        completed = False
                    if challenge.get('indice_vente_target') and indice_vente < challenge['indice_vente_target']:
                        completed = False
                    new_status = 'completed' if completed else 'failed'
                    challenge['status'] = new_status
                    update_data['status'] = new_status
                    update_data['completed_at'] = datetime.now(timezone.utc).isoformat()

                updates.append({
                    "id": challenge['id'],
                    "update": {"$set": update_data}
                })

            if updates:
                from pymongo import UpdateOne
                bulk_ops = [UpdateOne({"id": u["id"]}, u["update"]) for u in updates]
                if bulk_ops:
                    increment_db_op("db.challenges.bulk_write")
                    await self.challenge_repo.bulk_write(bulk_ops)

        return result
