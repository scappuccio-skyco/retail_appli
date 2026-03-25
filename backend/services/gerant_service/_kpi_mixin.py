"""KPI statistics and analytics methods for GerantService."""
import calendar
import logging
from typing import Dict, Optional, List
from datetime import datetime, timezone, timedelta

from core.constants import MONGO_IFNULL, MONGO_MATCH, MONGO_GROUP, MONGO_SUM

logger = logging.getLogger(__name__)


class KpiMixin:

    async def get_store_stats(
        self,
        store_id: str,
        gerant_id: str,
        period_type: str = 'week',
        period_offset: int = 0
    ) -> Dict:
        """
        Get detailed statistics for a specific store

        Args:
            store_id: Store ID
            gerant_id: Gérant ID (for ownership verification)
            period_type: 'week', 'month', or 'year'
            period_offset: Number of periods to offset (0=current, -1=previous, etc.)
        """
        from datetime import timedelta

        # Verify store ownership
        store = await self.store_repo.find_one(
            {"id": store_id, "gerant_id": gerant_id},
            {"_id": 0}
        )

        if not store:
            raise ValueError("Store not found or access denied")

        # Count managers and sellers
        managers_count = await self.user_repo.count({
            "store_id": store_id,
            "role": "manager",
            "status": "active"
        })

        sellers_count = await self.user_repo.count({
            "store_id": store_id,
            "role": "seller",
            "status": "active"
        })

        # Calculate today's KPIs
        today = datetime.now(timezone.utc).strftime('%Y-%m-%d')

        # 🔒 ANTI-DOUBLON: Get manager_ids that have entries in manager_kpis for today (PHASE 8: via repository)
        managers_with_kpis_today = await self.manager_kpi_repo.distinct(
            "manager_id",
            {"store_id": store_id, "date": today}
        )

        # Sellers KPIs today (excluding managers with dedicated entries)
        seller_match_today = {
            "store_id": store_id,
            "date": today
        }
        if managers_with_kpis_today:
            seller_match_today["seller_id"] = {"$nin": managers_with_kpis_today}

        sellers_today = await self.kpi_repo.aggregate([
            {"$match": seller_match_today},
            {"$group": {
                "_id": None,
                "total_ca": {"$sum": {"$ifNull": ["$seller_ca", {"$ifNull": ["$ca_journalier", 0]}]}},
                "total_ventes": {"$sum": {"$ifNull": ["$nb_ventes", 0]}},
                "total_articles": {"$sum": {"$ifNull": ["$nb_articles", 0]}}
            }}
        ], max_results=1)

        # Managers KPIs today
        managers_today = await self.manager_kpi_repo.aggregate([
            {"$match": {"store_id": store_id, "date": today}},
            {"$group": {
                "_id": None,
                "total_ca": {"$sum": {"$ifNull": ["$ca_journalier", 0]}},
                "total_ventes": {"$sum": {"$ifNull": ["$nb_ventes", 0]}},
                "total_articles": {"$sum": {"$ifNull": ["$nb_articles", 0]}}
            }}
        ], max_results=1)

        sellers_ca = sellers_today[0].get("total_ca", 0) if sellers_today else 0
        sellers_ventes = sellers_today[0].get("total_ventes", 0) if sellers_today else 0
        sellers_articles = sellers_today[0].get("total_articles", 0) if sellers_today else 0

        managers_ca = managers_today[0].get("total_ca", 0) if managers_today else 0
        managers_ventes = managers_today[0].get("total_ventes", 0) if managers_today else 0
        managers_articles = managers_today[0].get("total_articles", 0) if managers_today else 0

        # Calculate period dates
        today_date = datetime.now(timezone.utc)

        is_partial_comparison = False

        if period_type == 'week':
            days_since_monday = today_date.weekday()
            current_monday = today_date - timedelta(days=days_since_monday)
            target_monday = current_monday + timedelta(weeks=period_offset)
            target_sunday = target_monday + timedelta(days=6)
            period_start = target_monday.strftime('%Y-%m-%d')
            period_end = target_sunday.strftime('%Y-%m-%d')
            prev_start = (target_monday - timedelta(weeks=1)).strftime('%Y-%m-%d')
            prev_end = (target_monday - timedelta(days=1)).strftime('%Y-%m-%d')
        elif period_type == 'month':
            target_month = today_date.replace(day=1) + timedelta(days=32 * period_offset)
            target_month = target_month.replace(day=1)
            period_start = target_month.strftime('%Y-%m-%d')
            next_month = target_month.replace(day=28) + timedelta(days=4)
            period_end = (next_month.replace(day=1) - timedelta(days=1)).strftime('%Y-%m-%d')
            prev_month = target_month - timedelta(days=1)
            prev_start = prev_month.replace(day=1).strftime('%Y-%m-%d')
            if period_offset == 0:
                # Mois courant : comparaison à jour identique (ex : mars 1→25 vs fév 1→25)
                last_day_prev = calendar.monthrange(prev_month.year, prev_month.month)[1]
                same_day = min(today_date.day, last_day_prev)
                prev_end = prev_month.replace(day=same_day).strftime('%Y-%m-%d')
                is_partial_comparison = True
            else:
                # Mois passé : comparaison mois complet vs mois complet
                prev_end = (target_month - timedelta(days=1)).strftime('%Y-%m-%d')
        elif period_type == 'year':
            target_year = today_date.year + period_offset
            period_start = f"{target_year}-01-01"
            period_end = f"{target_year}-12-31"
            prev_start = f"{target_year-1}-01-01"
            prev_end = f"{target_year-1}-12-31"
        else:
            raise ValueError("Invalid period_type. Must be 'week', 'month', or 'year'")

        # 🔒 ANTI-DOUBLON: Get manager_ids that have entries in manager_kpis for this period
        # This prevents double counting if a manager also has entries in kpi_entries
        managers_with_kpis = await self.manager_kpi_repo.distinct(
            "manager_id",
            {"store_id": store_id, "date": {"$gte": period_start, "$lte": period_end}}
        )

        # Build seller match filter - exclude managers who have entries in manager_kpis
        seller_match = {
            "store_id": store_id,
            "date": {"$gte": period_start, "$lte": period_end}
        }
        if managers_with_kpis:
            seller_match["seller_id"] = {"$nin": managers_with_kpis}

        # Get period KPIs (sellers only, excluding managers with dedicated entries)
        period_sellers = await self.kpi_repo.aggregate([
            {"$match": seller_match},
            {"$group": {
                "_id": None,
                "total_ca": {"$sum": {"$ifNull": ["$seller_ca", {"$ifNull": ["$ca_journalier", 0]}]}},
                "total_ventes": {"$sum": {"$ifNull": ["$nb_ventes", 0]}},
                "total_prospects": {"$sum": {"$ifNull": ["$nb_prospects", 0]}}
            }}
        ], max_results=1)

        period_managers = await self.manager_kpi_repo.aggregate([
            {"$match": {"store_id": store_id, "date": {"$gte": period_start, "$lte": period_end}}},
            {"$group": {
                "_id": None,
                "total_ca": {"$sum": {"$ifNull": ["$ca_journalier", 0]}},
                "total_ventes": {"$sum": {"$ifNull": ["$nb_ventes", 0]}},
                "total_prospects": {"$sum": {"$ifNull": ["$nb_prospects", 0]}}
            }}
        ], max_results=1)

        period_ca = (period_sellers[0].get("total_ca", 0) if period_sellers else 0) + \
                    (period_managers[0].get("total_ca", 0) if period_managers else 0)
        period_ventes = (period_sellers[0].get("total_ventes", 0) if period_sellers else 0) + \
                        (period_managers[0].get("total_ventes", 0) if period_managers else 0)
        period_prospects = (period_sellers[0].get("total_prospects", 0) if period_sellers else 0) + \
                           (period_managers[0].get("total_prospects", 0) if period_managers else 0)

        # Get previous period KPIs for evolution (same anti-doublon logic)
        prev_managers_with_kpis = await self.manager_kpi_repo.distinct(
            "manager_id",
            {"store_id": store_id, "date": {"$gte": prev_start, "$lte": prev_end}}
        )

        prev_seller_match = {
            "store_id": store_id,
            "date": {"$gte": prev_start, "$lte": prev_end}
        }
        if prev_managers_with_kpis:
            prev_seller_match["seller_id"] = {"$nin": prev_managers_with_kpis}

        prev_sellers = await self.kpi_repo.aggregate([
            {"$match": prev_seller_match},
            {"$group": {"_id": None, "total_ca": {"$sum": {"$ifNull": ["$seller_ca", {"$ifNull": ["$ca_journalier", 0]}]}}}}
        ], max_results=1)

        prev_managers = await self.manager_kpi_repo.aggregate([
            {"$match": {"store_id": store_id, "date": {"$gte": prev_start, "$lte": prev_end}}},
            {"$group": {"_id": None, "total_ca": {"$sum": {"$ifNull": ["$ca_journalier", 0]}}}}
        ], max_results=1)

        prev_ca = (prev_sellers[0].get("total_ca", 0) if prev_sellers else 0) + \
                  (prev_managers[0].get("total_ca", 0) if prev_managers else 0)

        # Calculate evolution
        ca_evolution = ((period_ca - prev_ca) / prev_ca * 100) if prev_ca > 0 else 0

        return {
            "store": store,
            "managers_count": managers_count,
            "sellers_count": sellers_count,
            "today": {
                "total_ca": sellers_ca + managers_ca,
                "total_ventes": sellers_ventes + managers_ventes,
                "total_articles": sellers_articles + managers_articles
            },
            "period": {
                "type": period_type,
                "offset": period_offset,
                "start": period_start,
                "end": period_end,
                "ca": period_ca,
                "ventes": period_ventes,
                "prospects": period_prospects,
                "ca_evolution": round(ca_evolution, 2)
            },
            "previous_period": {
                "start": prev_start,
                "end": prev_end,
                "ca": prev_ca,
                "is_partial_comparison": is_partial_comparison
            }
        }

    def _build_staff_counts_pipeline(self, gerant_id: str) -> List[Dict]:
        """Pipeline agrégation pour compter managers/sellers actifs et suspendus."""
        return [
            {MONGO_MATCH: {
                "gerant_id": gerant_id,
                "role": {"$in": ["manager", "seller"]},
                "status": {"$in": ["active", "suspended"]}
            }},
            {MONGO_GROUP: {
                "_id": {"role": "$role", "status": "$status"},
                "count": {MONGO_SUM: 1}
            }}
        ]

    def _parse_staff_counts(self, staff_counts_result: List[Dict]) -> tuple:
        """Extrait (total_managers, suspended_managers, total_sellers, suspended_sellers) du résultat d'agrégation."""
        counts_map = {
            ("manager", "active"): 0,
            ("manager", "suspended"): 0,
            ("seller", "active"): 0,
            ("seller", "suspended"): 0,
        }
        for row in staff_counts_result:
            key = (row["_id"]["role"], row["_id"]["status"])
            if key in counts_map:
                counts_map[key] = row["count"]
        return (
            counts_map[("manager", "active")],
            counts_map[("manager", "suspended")],
            counts_map[("seller", "active")],
            counts_map[("seller", "suspended")],
        )

    def _build_seller_kpi_month_pipeline(
        self,
        store_ids: List[str],
        first_day: str,
        today: str,
        managers_with_kpis: List,
    ) -> List[Dict]:
        """Pipeline agrégation KPI vendeurs (mois), en excluant les managers ayant des entrées dédiées."""
        seller_match = {
            "store_id": {"$in": store_ids},
            "date": {"$gte": first_day, "$lte": today}
        }
        if managers_with_kpis:
            seller_match["seller_id"] = {"$nin": managers_with_kpis}
        return [
            {MONGO_MATCH: seller_match},
            {MONGO_GROUP: {
                "_id": None,
                "total_ca": {MONGO_SUM: {MONGO_IFNULL: ["$seller_ca", {MONGO_IFNULL: ["$ca_journalier", 0]}]}},
                "total_ventes": {MONGO_SUM: {MONGO_IFNULL: ["$nb_ventes", 0]}},
                "total_articles": {MONGO_SUM: {MONGO_IFNULL: ["$nb_articles", 0]}}
            }}
        ]

    def _build_manager_kpi_month_pipeline(
        self, store_ids: List[str], first_day: str, today: str
    ) -> List[Dict]:
        """Pipeline agrégation KPI managers (mois)."""
        return [
            {MONGO_MATCH: {
                "store_id": {"$in": store_ids},
                "date": {"$gte": first_day, "$lte": today}
            }},
            {MONGO_GROUP: {
                "_id": None,
                "total_ca": {MONGO_SUM: {MONGO_IFNULL: ["$ca_journalier", 0]}},
                "total_ventes": {MONGO_SUM: {MONGO_IFNULL: ["$nb_ventes", 0]}},
                "total_articles": {MONGO_SUM: {MONGO_IFNULL: ["$nb_articles", 0]}}
            }}
        ]

    def _combine_seller_manager_stats(
        self, kpi_stats: List[Dict], manager_stats: List[Dict]
    ) -> Dict:
        """Combine les totaux KPI vendeurs et managers en un seul dict (total_ca, total_ventes, total_articles)."""
        seller_ca = kpi_stats[0].get("total_ca", 0) if kpi_stats else 0
        seller_ventes = kpi_stats[0].get("total_ventes", 0) if kpi_stats else 0
        seller_articles = kpi_stats[0].get("total_articles", 0) if kpi_stats else 0
        manager_ca = manager_stats[0].get("total_ca", 0) if manager_stats else 0
        manager_ventes = manager_stats[0].get("total_ventes", 0) if manager_stats else 0
        manager_articles = manager_stats[0].get("total_articles", 0) if manager_stats else 0
        return {
            "total_ca": seller_ca + manager_ca,
            "total_ventes": seller_ventes + manager_ventes,
            "total_articles": seller_articles + manager_articles
        }

    async def get_dashboard_stats(self, gerant_id: str) -> Dict:
        """
        Get aggregated dashboard statistics for a gérant

        Args:
            gerant_id: Gérant user ID

        Returns:
            Dict with store counts, user counts, and monthly KPI aggregations
        """
        stores = await self.get_all_stores(gerant_id)
        store_ids = [store['id'] for store in stores]

        staff_counts_pipeline = self._build_staff_counts_pipeline(gerant_id)
        staff_counts_result = await self.user_repo.aggregate(
            staff_counts_pipeline, max_results=4
        )
        total_managers, suspended_managers, total_sellers, suspended_sellers = self._parse_staff_counts(
            staff_counts_result
        )

        now = datetime.now(timezone.utc)
        first_day_of_month = now.replace(day=1).strftime('%Y-%m-%d')
        # Use end of month (same range as get_store_stats) so both endpoints are consistent
        next_month = now.replace(day=28) + timedelta(days=4)
        last_day_of_month = (next_month.replace(day=1) - timedelta(days=1)).strftime('%Y-%m-%d')

        managers_with_kpis = await self.manager_kpi_repo.distinct(
            "manager_id",
            {"store_id": {"$in": store_ids}, "date": {"$gte": first_day_of_month, "$lte": last_day_of_month}}
        )

        pipeline = self._build_seller_kpi_month_pipeline(
            store_ids, first_day_of_month, last_day_of_month, managers_with_kpis
        )
        kpi_stats = await self.kpi_repo.aggregate(pipeline, max_results=1)

        manager_pipeline = self._build_manager_kpi_month_pipeline(
            store_ids, first_day_of_month, last_day_of_month
        )
        manager_stats = await self.manager_kpi_repo.aggregate(manager_pipeline, max_results=1)

        stats = self._combine_seller_manager_stats(kpi_stats, manager_stats)

        return {
            "total_stores": len(stores),
            "total_managers": total_managers,
            "suspended_managers": suspended_managers,
            "total_sellers": total_sellers,
            "suspended_sellers": suspended_sellers,
            "month_ca": stats.get("total_ca", 0),
            "month_ventes": stats.get("total_ventes", 0),
            "month_articles": stats.get("total_articles", 0),
            "stores": stores
        }

    async def get_store_kpi_history(self, store_id: str, user_id: str, days: int = 30, start_date_str: str = None, end_date_str: str = None) -> list:
        """
        Get historical KPI data for a specific store

        Args:
            store_id: Store identifier
            user_id: User ID (gérant owner or assigned manager)
            days: Number of days to retrieve (default: 30) - used if no dates
            start_date_str: Start date in YYYY-MM-DD format (optional)
            end_date_str: End date in YYYY-MM-DD format (optional)

        Returns:
            List of daily aggregated KPI data sorted by date

        Security: Accessible to gérants (owner) and managers (assigned)
        """
        from datetime import timedelta

        # First check if user is a gérant who owns this store
        store = await self.store_repo.find_one(
            {"id": store_id, "gerant_id": user_id, "active": True},
            {"_id": 0}
        )

        # If not gérant, check if user is a manager assigned to this store
        if not store:
            user = await self.user_repo.find_by_id(user_id, projection={"_id": 0})
            if user and user.get('role') == 'manager' and user.get('store_id') == store_id:
                store = await self.store_repo.find_one(
                    {"id": store_id, "active": True},
                    {"_id": 0}
                )

        if not store:
            raise ValueError("Magasin non trouvé ou accès non autorisé")

        # Calculate date range
        if start_date_str and end_date_str:
            # Use provided dates
            start_date_query = start_date_str
            end_date_query = end_date_str
        else:
            # Use days parameter
            end_date = datetime.now(timezone.utc)
            start_date = end_date - timedelta(days=days)
            start_date_query = start_date.strftime('%Y-%m-%d')
            end_date_query = end_date.strftime('%Y-%m-%d')

        # ✅ PHASE 6: Use aggregation for date aggregation instead of .to_list(10000)
        # We still need individual entries for priority logic, but we'll use cursor iteration
        # instead of loading everything in memory at once. Phase 0: use injected repos.
        # Get KPI entries for this store (use cursor iteration with reasonable batch size)
        # Note: We need individual entries for priority logic (created_by='manager' > 'seller')
        # So we can't use pure aggregation here, but we'll process in batches
        kpi_query = {"store_id": store_id}
        date_range = {"$gte": start_date_query, "$lte": end_date_query}

        # PHASE 8: iterator via repository, no .collection
        all_seller_entries = []
        kpi_query_with_date = {**kpi_query, "date": date_range}
        async for entry in self.kpi_repo.find_iter(kpi_query_with_date, {"_id": 0}):
            all_seller_entries.append(entry)
            if len(all_seller_entries) >= 10000:
                logger.warning(f"Store {store_id} has > 10000 KPI entries in date range - consider data cleanup")
                break

        # ⭐ PRIORITÉ DE LA DONNÉE : Si un vendeur ET un manager ont saisi pour la même journée/vendeur,
        # utiliser la version du manager (created_by: 'manager')
        seller_entries_dict = {}
        for entry in all_seller_entries:
            seller_id = entry.get('seller_id')
            date = entry.get('date')
            if not seller_id or not date:
                continue

            # Clé unique : seller_id + date
            key = f"{seller_id}_{date}"

            # Si aucune entrée pour ce vendeur/date, l'ajouter
            if key not in seller_entries_dict:
                seller_entries_dict[key] = entry
            else:
                # Si une entrée existe déjà, vérifier la priorité
                existing_entry = seller_entries_dict[key]
                existing_created_by = existing_entry.get('created_by')
                new_created_by = entry.get('created_by')

                # Priorité : created_by='manager' > created_by='seller' ou None
                if new_created_by == 'manager' and existing_created_by != 'manager':
                    seller_entries_dict[key] = entry  # Remplacer par la version manager
                # Sinon, garder l'existant (déjà manager ou pas de priorité)

        # Convertir le dictionnaire en liste (sans doublons)
        seller_entries = list(seller_entries_dict.values())

        # Get manager KPIs for this store. PHASE 8: iterator via repository, no .collection
        manager_kpis = []
        manager_query = {
            "store_id": store_id,
            "date": {"$gte": start_date_query, "$lte": end_date_query}
        }
        async for entry in self.manager_kpi_repo.find_iter(manager_query, {"_id": 0}):
            manager_kpis.append(entry)
            if len(manager_kpis) >= 10000:
                logger.warning(f"Store {store_id} has > 10000 manager KPIs in date range - consider data cleanup")
                break

        # Aggregate data by date
        date_map = {}
        locked_dates = set()  # Track which dates have locked entries

        # ⭐ NOTE : manager_kpis ne contient plus que nb_prospects (globaux) avec la nouvelle logique
        # Les CA/ventes/articles sont maintenant dans kpi_entries avec created_by='manager'
        # Add manager KPIs (uniquement prospects globaux)
        for kpi in manager_kpis:
            date = kpi['date']
            if date not in date_map:
                date_map[date] = {
                    "date": date,
                    "ca_journalier": 0,
                    "nb_ventes": 0,
                    "nb_clients": 0,
                    "nb_articles": 0,
                    "nb_prospects": 0,
                    "locked": False
                }
            # ⭐ Avec la nouvelle logique, manager_kpis ne devrait plus contenir CA/ventes/articles
            # (seulement nb_prospects globaux pour répartition)
            date_map[date]["nb_prospects"] += kpi.get("nb_prospects") or 0
            # Check if locked
            if kpi.get("locked"):
                locked_dates.add(date)

        # Add seller entries (déjà filtrées pour priorité manager)
        for entry in seller_entries:
            date = entry['date']
            if date not in date_map:
                date_map[date] = {
                    "date": date,
                    "ca_journalier": 0,
                    "nb_ventes": 0,
                    "nb_clients": 0,
                    "nb_articles": 0,
                    "nb_prospects": 0,
                    "locked": False
                }
            # Handle both field names for CA
            ca_value = entry.get("seller_ca") or entry.get("ca_journalier") or 0
            date_map[date]["ca_journalier"] += ca_value
            date_map[date]["nb_ventes"] += entry.get("nb_ventes") or 0
            date_map[date]["nb_clients"] += entry.get("nb_clients") or 0
            date_map[date]["nb_articles"] += entry.get("nb_articles") or 0
            date_map[date]["nb_prospects"] += entry.get("nb_prospects") or 0
            # Check if locked
            if entry.get("locked"):
                locked_dates.add(date)

        # Apply locked status to date_map
        for date in locked_dates:
            if date in date_map:
                date_map[date]["locked"] = True

        # Convert to sorted list
        historical_data = sorted(date_map.values(), key=lambda x: x['date'])

        return historical_data

    async def get_store_available_years(self, store_id: str, user_id: str) -> Dict:
        """
        Get available years with KPI data for this store

        Returns dict with 'years' list (integers) in descending order (most recent first)
        Used for date filter dropdowns in the frontend

        Security: Accessible to gérants (owner) and managers (assigned)
        """
        # First check if user is a gérant who owns this store
        store = await self.store_repo.find_one(
            {"id": store_id, "gerant_id": user_id, "active": True},
            {"_id": 0}
        )

        # If not gérant, check if user is a manager assigned to this store
        if not store:
            user = await self.user_repo.find_by_id(user_id, projection={"_id": 0})
            if user and user.get('role') == 'manager' and user.get('store_id') == store_id:
                store = await self.store_repo.find_one(
                    {"id": store_id, "active": True},
                    {"_id": 0}
                )

        if not store:
            raise ValueError("Magasin non trouvé ou accès non autorisé")

        # Get distinct years from kpi_entries (guard against None/non-iterable)
        kpi_years = await self.kpi_repo.distinct("date", {"store_id": store_id})
        if kpi_years is None:
            kpi_years = []
        years_set = set()
        for date_str in (kpi_years or []):
            if date_str and len(str(date_str)) >= 4:
                try:
                    years_set.add(int(str(date_str)[:4]))
                except (ValueError, TypeError):
                    pass
        # Get distinct years from manager_kpi
        manager_years = await self.manager_kpi_repo.distinct("date", {"store_id": store_id})
        if manager_years is None:
            manager_years = []
        for date_str in (manager_years or []):
            if date_str and len(str(date_str)) >= 4:
                try:
                    years_set.add(int(str(date_str)[:4]))
                except (ValueError, TypeError):
                    pass

        # Sort descending (most recent first)
        years = sorted(list(years_set), reverse=True)

        return {"years": years}

    @staticmethod
    def _merge_seller_entries_by_priority(all_seller_entries: List[Dict]) -> List[Dict]:
        """Fusionne les entrées KPI par seller_id en privilégiant created_by='manager'."""
        seller_entries_dict = {}
        for entry in all_seller_entries:
            seller_id = entry.get('seller_id')
            if not seller_id:
                continue
            if seller_id not in seller_entries_dict:
                seller_entries_dict[seller_id] = entry
            else:
                existing_entry = seller_entries_dict[seller_id]
                existing_created_by = existing_entry.get('created_by')
                new_created_by = entry.get('created_by')
                if new_created_by == 'manager' and existing_created_by != 'manager':
                    seller_entries_dict[seller_id] = entry
        return list(seller_entries_dict.values())

    @staticmethod
    def _enrich_seller_entries_with_names(seller_entries: List[Dict], sellers: List[Dict]) -> None:
        """Enrichit les entrées avec seller_name (in-place)."""
        for entry in seller_entries:
            seller = next((s for s in sellers if s['id'] == entry.get('seller_id')), None)
            entry['seller_name'] = seller['name'] if seller else entry.get('seller_name', 'Vendeur (historique)')

    @staticmethod
    def _compute_prospect_prorata(
        global_prospects: float,
        seller_entries: List[Dict],
        sellers: List[Dict],
    ) -> Dict[str, float]:
        """
        Calcule le prorata de prospects par vendeur (répartition équitable des prospects globaux).
        Retourne un dict seller_id -> prorata.
        """
        prospect_prorata_per_seller = {}
        sellers_with_data = len(seller_entries)
        active_sellers_count = len(sellers)
        if global_prospects <= 0:
            return prospect_prorata_per_seller
        sellers_count_for_prorata = sellers_with_data if sellers_with_data > 0 else active_sellers_count
        if sellers_count_for_prorata <= 0:
            return prospect_prorata_per_seller
        base_prorata = global_prospects / sellers_count_for_prorata
        if sellers_with_data > 0:
            for entry in seller_entries:
                seller_id = entry.get('seller_id')
                if seller_id:
                    prospect_prorata_per_seller[seller_id] = base_prorata
        else:
            for seller in sellers:
                seller_id = seller.get('id')
                if seller_id:
                    prospect_prorata_per_seller[seller_id] = base_prorata
        return prospect_prorata_per_seller

    @staticmethod
    def _enrich_entries_with_prospect_prorata(
        seller_entries: List[Dict], prospect_prorata_per_seller: Dict[str, float]
    ) -> None:
        """Enrichit les entrées avec prospect_prorata (in-place)."""
        for entry in seller_entries:
            seller_id = entry.get('seller_id')
            if not entry.get('nb_prospects') or entry.get('nb_prospects') == 0:
                entry['prospect_prorata'] = prospect_prorata_per_seller.get(seller_id, 0)
            else:
                entry['prospect_prorata'] = entry.get('nb_prospects', 0)

    @staticmethod
    def _aggregate_managers_totals(manager_kpis_list: List[Dict], global_prospects: float) -> Dict:
        """Agrège les totaux KPI managers (CA, ventes, clients, articles, prospects)."""
        return {
            "ca_journalier": sum((kpi.get("ca_journalier") or 0) for kpi in manager_kpis_list),
            "nb_ventes": sum((kpi.get("nb_ventes") or 0) for kpi in manager_kpis_list),
            "nb_clients": sum((kpi.get("nb_clients") or 0) for kpi in manager_kpis_list),
            "nb_articles": sum((kpi.get("nb_articles") or 0) for kpi in manager_kpis_list),
            "nb_prospects": global_prospects,
        }

    @staticmethod
    def _aggregate_sellers_totals(seller_entries: List[Dict]) -> Dict:
        """Agrège les totaux KPI vendeurs (CA, ventes, clients, articles, prospects, nb_sellers_reported)."""
        return {
            "ca_journalier": sum((entry.get("seller_ca") or entry.get("ca_journalier") or 0) for entry in seller_entries),
            "nb_ventes": sum((entry.get("nb_ventes") or 0) for entry in seller_entries),
            "nb_clients": sum((entry.get("nb_clients") or 0) for entry in seller_entries),
            "nb_articles": sum((entry.get("nb_articles") or 0) for entry in seller_entries),
            "nb_prospects": sum((entry.get("nb_prospects") or 0) for entry in seller_entries),
            "nb_sellers_reported": len(seller_entries),
        }

    @staticmethod
    def _compute_total_prospects_with_prorata(
        sellers_total: Dict,
        seller_entries: List[Dict],
        prospect_prorata_per_seller: Dict[str, float],
        sellers_with_data: int,
        global_prospects: float,
    ) -> float:
        """Calcule le total prospects en incluant le prorata pour les vendeurs sans prospects individuels."""
        total = sellers_total["nb_prospects"]
        for entry in seller_entries:
            seller_id = entry.get('seller_id')
            if (not entry.get('nb_prospects') or entry.get('nb_prospects') == 0) and prospect_prorata_per_seller.get(seller_id, 0) > 0:
                total += prospect_prorata_per_seller.get(seller_id, 0)
        if sellers_with_data == 0 and global_prospects > 0:
            total = global_prospects
        return total

    @staticmethod
    def _calculate_store_derived_kpis(
        total_ca: float,
        total_ventes: float,
        total_articles: float,
        total_prospects: float,
        global_prospects: float,
        sellers_total: Dict,
        prospect_prorata_per_seller: Dict,
        total_prospects_with_prorata: float,
        active_sellers_count: int,
        sellers_with_data: int,
    ) -> Dict:
        """Calcule les KPI dérivés (panier moyen, taux transformation, indice vente) et la répartition prospects."""
        calculated_kpis = {
            "panier_moyen": round(total_ca / total_ventes, 2) if total_ventes > 0 else None,
            "taux_transformation": round((total_ventes / total_prospects) * 100, 2) if total_prospects > 0 else None,
            "indice_vente": round(total_articles / total_ventes, 2) if total_ventes > 0 else None,
        }
        calculated_kpis["prospect_repartition"] = {
            "global_prospects": global_prospects,
            "sellers_prospects": sellers_total["nb_prospects"],
            "prospect_prorata_per_seller": prospect_prorata_per_seller,
            "total_with_prorata": total_prospects_with_prorata,
            "active_sellers_count": active_sellers_count,
            "sellers_with_data": sellers_with_data,
        }
        return calculated_kpis

    async def get_store_kpi_overview(self, store_id: str, user_id: str, date: str = None) -> Dict:
        """
        Get consolidated store KPI overview for a specific date

        Returns:
        - Store info
        - Manager aggregated data
        - Seller aggregated data
        - Individual seller entries
        - Calculated KPIs (panier moyen, taux transformation, indice vente)

        Security: Verifies store ownership (gérant) or assignment (manager)
        """
        from datetime import datetime, timezone

        # First check if user is a gérant who owns this store
        store = await self.store_repo.find_by_id(store_id, gerant_id=user_id, projection={"_id": 0})

        # If not gérant, check if user is a manager assigned to this store
        if not store or not store.get('active'):
            user = await self.user_repo.find_by_id(user_id, projection={"_id": 0})
            if user and user.get('role') == 'manager' and user.get('store_id') == store_id:
                store = await self.store_repo.find_by_id(store_id, projection={"_id": 0})

        if not store or not store.get('active'):
            raise ValueError("Magasin non trouvé ou accès non autorisé")

        # Default to today
        if not date:
            date = datetime.now(timezone.utc).strftime('%Y-%m-%d')

        # Get all managers and sellers in this store
        managers = await self.user_repo.find_by_store(
            store_id,
            role="manager",
            projection={"_id": 0, "id": 1, "name": 1, "status": 1},
            limit=100
        )
        managers = [m for m in managers if m.get('status') == 'active']

        sellers = await self.user_repo.find_by_store(
            store_id,
            role="seller",
            projection={"_id": 0, "id": 1, "name": 1, "status": 1},
            limit=100
        )
        sellers = [s for s in sellers if s.get('status') == 'active']

        all_seller_entries = await self.kpi_repo.find_by_store(store_id, date, projection={"_id": 0})
        seller_entries = self._merge_seller_entries_by_priority(all_seller_entries)
        self._enrich_seller_entries_with_names(seller_entries, sellers)

        manager_kpis_list = await self.manager_kpi_repo.find_many({
            "store_id": store_id,
            "date": date
        }, {"_id": 0}, limit=100)
        global_prospects = sum((kpi.get("nb_prospects") or 0) for kpi in manager_kpis_list)
        sellers_with_data = len(seller_entries)
        active_sellers_count = len(sellers)

        prospect_prorata_per_seller = self._compute_prospect_prorata(
            global_prospects, seller_entries, sellers
        )
        self._enrich_entries_with_prospect_prorata(seller_entries, prospect_prorata_per_seller)

        managers_total = self._aggregate_managers_totals(manager_kpis_list, global_prospects)
        sellers_total = self._aggregate_sellers_totals(seller_entries)

        total_prospects_with_prorata = self._compute_total_prospects_with_prorata(
            sellers_total, seller_entries, prospect_prorata_per_seller,
            sellers_with_data, global_prospects
        )

        total_ca = sellers_total["ca_journalier"]
        total_ventes = sellers_total["nb_ventes"]
        total_clients = sellers_total["nb_clients"]
        total_articles = sellers_total["nb_articles"]
        total_prospects = total_prospects_with_prorata if total_prospects_with_prorata > 0 else global_prospects

        calculated_kpis = self._calculate_store_derived_kpis(
            total_ca, total_ventes, total_articles, total_prospects,
            global_prospects, sellers_total, prospect_prorata_per_seller,
            total_prospects_with_prorata, active_sellers_count, sellers_with_data
        )

        return {
            "date": date,
            "store": store,
            "managers_data": managers_total,
            "sellers_data": sellers_total,
            "seller_entries": seller_entries,
            "total_managers": len(managers),
            "total_sellers": len(sellers),
            "sellers_reported": len(seller_entries),
            "calculated_kpis": calculated_kpis,
            "totals": {
                "ca": total_ca,
                "ventes": total_ventes,
                "clients": total_clients,
                "articles": total_articles,
                "prospects": total_prospects
            },
            "kpi_config": {
                "seller_track_ca": True,
                "seller_track_ventes": True,
                "seller_track_clients": False,
                "seller_track_articles": True,
                "seller_track_prospects": True
            }
        }

    async def get_store_overview_for_gerant(self, store_id: str, gerant_id: str, date: str = None) -> Dict:
        """
        Vue consolidée du magasin pour le gérant uniquement.
        Vérifie strictement que le magasin appartient au gérant, puis renvoie les chiffres
        consolidés (tous managers + vendeurs du magasin) sans passer par les endpoints manager.

        Args:
            store_id: Identifiant du magasin
            gerant_id: Identifiant du gérant (doit être propriétaire du magasin)
            date: Date cible (YYYY-MM-DD), défaut = aujourd'hui

        Returns:
            Même structure que get_store_kpi_overview (store, managers_data, sellers_data,
            seller_entries, calculated_kpis, totals, etc.)

        Raises:
            Exception: Magasin non trouvé ou accès non autorisé
        """
        store = await self.store_repo.find_by_id(store_id, gerant_id=gerant_id, projection={"_id": 0})
        if not store or not store.get("active"):
            raise Exception("Magasin non trouvé ou accès non autorisé")
        return await self.get_store_kpi_overview(store_id, gerant_id, date)
