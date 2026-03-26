"""
Scheduled job logic for email notifications:
- weekly_gerant_recap  : weekly performance recap for all gérants (Monday 8h)
- silent_seller_alerts : alert managers when sellers haven't entered KPIs in 2 business days
"""
import logging
from datetime import date, timedelta
from typing import List, Dict

logger = logging.getLogger(__name__)


def _two_business_days_ago(today: date) -> date:
    """Return the date 2 business days ago (Mon → Thu, Tue → Fri, else today - 2 days)."""
    weekday = today.weekday()  # 0=Mon … 6=Sun
    if weekday == 0:    # Monday → go back to Thursday
        return today - timedelta(days=4)
    elif weekday == 1:  # Tuesday → go back to Friday
        return today - timedelta(days=4)
    else:
        return today - timedelta(days=2)


class JobsService:
    def __init__(self, db):
        from repositories.user_repository import UserRepository
        from repositories.store_repository import StoreRepository
        from repositories.kpi_repository import KPIRepository
        from repositories.workspace_repository import WorkspaceRepository
        from repositories.notification_repository import NotificationRepository

        self.user_repo = UserRepository(db)
        self.store_repo = StoreRepository(db)
        self.kpi_repo = KPIRepository(db)
        self.workspace_repo = WorkspaceRepository(db)
        self.notification_repo = NotificationRepository(db)

    # ── Weekly gérant recap ────────────────────────────────────────────────

    async def compute_weekly_gerant_recaps(self) -> List[Dict]:
        """
        Returns one recap dict per active gérant with subscription active/trial.
        Used to send the Monday morning email.
        """
        today = date.today()
        weekday = today.weekday()
        # Last complete week: Mon→Sun
        days_since_monday = weekday
        last_monday = today - timedelta(days=days_since_monday + 7)
        last_sunday = last_monday + timedelta(days=6)
        prev_monday = last_monday - timedelta(days=7)
        prev_sunday = last_monday - timedelta(days=1)

        last_week_start = last_monday.isoformat()
        last_week_end = last_sunday.isoformat()
        prev_week_start = prev_monday.isoformat()
        prev_week_end = prev_sunday.isoformat()

        recaps = []
        new_gerant_cutoff = (today - timedelta(days=7)).isoformat()

        try:
            gerants = await self.user_repo.find_many(
                {"role": {"$in": ["gerant", "gérant"]}, "status": "active"},
                projection={"_id": 0, "id": 1, "name": 1, "email": 1, "created_at": 1}
            )
        except Exception:
            logger.exception("weekly_gerant_recap: cannot fetch gérants")
            return []

        for gerant in gerants:
            gerant_id = gerant.get("id")
            if not gerant_id:
                continue

            # Skip gérants whose account was created less than 7 days ago
            created = (gerant.get("created_at") or "")
            if isinstance(created, str):
                created_str = created[:10]
            else:
                created_str = created.date().isoformat() if hasattr(created, "date") else ""
            if created_str and created_str >= new_gerant_cutoff:
                continue

            # Check workspace is billable (active or trial)
            try:
                workspace = await self.workspace_repo.find_one(
                    {"gerant_id": gerant_id},
                    projection={"_id": 0, "subscription_status": 1}
                )
                status = (workspace or {}).get("subscription_status", "")
                if status not in ("active", "trialing", "trial", "past_due"):
                    continue
            except Exception:
                continue

            # Stores for this gérant
            try:
                stores = await self.store_repo.find_many(
                    {"gerant_id": gerant_id, "active": True},
                    projection={"_id": 0, "id": 1, "name": 1}
                )
            except Exception:
                continue

            if not stores:
                continue

            store_stats = []
            total_ca = 0
            total_ca_prev = 0
            top_seller = None
            top_seller_ca = 0

            for store in stores:
                store_id = store.get("id")
                store_name = store.get("name", "Magasin")

                # KPI last week
                try:
                    result = await self.kpi_repo.aggregate([
                        {"$match": {"store_id": store_id, "date": {"$gte": last_week_start, "$lte": last_week_end}}},
                        {"$group": {
                            "_id": None,
                            "ca": {"$sum": {"$ifNull": ["$seller_ca", {"$ifNull": ["$ca_journalier", 0]}]}},
                            "ventes": {"$sum": {"$ifNull": ["$nb_ventes", 0]}},
                        }}
                    ], max_results=1)
                    ca = result[0].get("ca", 0) if result else 0
                    ventes = result[0].get("ventes", 0) if result else 0
                except Exception:
                    ca, ventes = 0, 0

                # KPI prev week (for evolution)
                try:
                    prev_result = await self.kpi_repo.aggregate([
                        {"$match": {"store_id": store_id, "date": {"$gte": prev_week_start, "$lte": prev_week_end}}},
                        {"$group": {"_id": None, "ca": {"$sum": {"$ifNull": ["$seller_ca", {"$ifNull": ["$ca_journalier", 0]}]}}}}
                    ], max_results=1)
                    ca_prev = prev_result[0].get("ca", 0) if prev_result else 0
                except Exception:
                    ca_prev = 0

                evolution = round(((ca - ca_prev) / ca_prev * 100), 1) if ca_prev > 0 else None

                # Top seller this store
                try:
                    sellers_agg = await self.kpi_repo.aggregate([
                        {"$match": {"store_id": store_id, "date": {"$gte": last_week_start, "$lte": last_week_end}}},
                        {"$group": {
                            "_id": "$seller_id",
                            "ca": {"$sum": {"$ifNull": ["$seller_ca", {"$ifNull": ["$ca_journalier", 0]}]}}
                        }},
                        {"$sort": {"ca": -1}},
                    ], max_results=1)
                    if sellers_agg:
                        s_id = sellers_agg[0].get("_id")
                        s_ca = sellers_agg[0].get("ca", 0)
                        if s_ca > top_seller_ca:
                            seller_doc = await self.user_repo.find_by_id(s_id, projection={"_id": 0, "name": 1})
                            top_seller_ca = s_ca
                            top_seller = {
                                "name": (seller_doc or {}).get("name", "—"),
                                "store": store_name,
                                "ca": s_ca,
                            }
                except Exception:
                    pass

                total_ca += ca
                total_ca_prev += ca_prev
                store_stats.append({
                    "name": store_name,
                    "ca": ca,
                    "ventes": ventes,
                    "evolution": evolution,
                })

            if total_ca == 0 and not any(s["ca"] > 0 for s in store_stats):
                # Aucune donnée cette semaine — pas d'email
                continue

            total_evolution = round(((total_ca - total_ca_prev) / total_ca_prev * 100), 1) if total_ca_prev > 0 else None

            recaps.append({
                "email": gerant.get("email"),
                "name": gerant.get("name", ""),
                "week_start": last_monday.strftime("%d/%m"),
                "week_end": last_sunday.strftime("%d/%m/%Y"),
                "total_ca": total_ca,
                "total_evolution": total_evolution,
                "stores": store_stats,
                "top_seller": top_seller,
            })

        return recaps

    # ── Silent seller alerts ────────────────────────────────────────────────

    async def compute_silent_seller_alerts(self) -> List[Dict]:
        """
        Returns one alert dict per manager who has at least one silent seller.
        A seller is "silent" if no KPI entry in the last 2 business days
        and their account is older than 3 days.
        """
        today = date.today()
        cutoff = _two_business_days_ago(today).isoformat()
        new_account_cutoff = (today - timedelta(days=3)).isoformat()

        new_manager_cutoff = (today - timedelta(days=3)).isoformat()

        alerts = []
        try:
            managers = await self.user_repo.find_many(
                {"role": "manager", "status": "active"},
                projection={"_id": 0, "id": 1, "name": 1, "email": 1, "store_id": 1, "created_at": 1}
            )
        except Exception:
            logger.exception("silent_seller_alerts: cannot fetch managers")
            return []

        for manager in managers:
            manager_id = manager.get("id")
            store_id = manager.get("store_id")
            if not manager_id or not store_id:
                continue

            # Skip managers whose account was created less than 3 days ago
            m_created = (manager.get("created_at") or "")
            if isinstance(m_created, str):
                m_created_str = m_created[:10]
            else:
                m_created_str = m_created.date().isoformat() if hasattr(m_created, "date") else ""
            if m_created_str and m_created_str >= new_manager_cutoff:
                continue

            try:
                sellers = await self.user_repo.find_many(
                    {"manager_id": manager_id, "store_id": store_id,
                     "role": "seller", "status": "active"},
                    projection={"_id": 0, "id": 1, "name": 1, "created_at": 1}
                )
            except Exception:
                continue

            silent = []
            for seller in sellers:
                seller_id = seller.get("id")
                # Skip brand-new accounts (< 3 days)
                created = (seller.get("created_at") or "")[:10]
                if created >= new_account_cutoff:
                    continue

                try:
                    recent = await self.kpi_repo.find_many(
                        {"seller_id": seller_id, "date": {"$gte": cutoff}},
                        projection={"_id": 0, "date": 1},
                        limit=1,
                    )
                    if recent:
                        continue  # active — skip

                    # Find last entry to compute "X days ago"
                    last = await self.kpi_repo.find_many(
                        {"seller_id": seller_id},
                        projection={"_id": 0, "date": 1},
                        sort=[("date", -1)],
                        limit=1,
                    )
                    if not last:
                        continue  # never entered any KPI — skip (handled by onboarding task)

                    last_date = date.fromisoformat(last[0]["date"])
                    days_ago = (today - last_date).days
                    silent.append({"name": seller.get("name", "—"), "days_ago": days_ago})
                    # Notif in-app pour le manager
                    try:
                        await self.notification_repo.create(
                            user_id=manager_id,
                            notif_type="silent_seller",
                            title="Vendeur silencieux ⚠️",
                            message=f"{seller.get('name', '—')} n'a pas saisi ses KPI depuis {days_ago} jour{'s' if days_ago > 1 else ''}",
                            data={"seller_id": seller_id, "days_ago": days_ago},
                        )
                    except Exception:
                        pass
                except Exception:
                    continue

            if silent:
                alerts.append({
                    "email": manager.get("email"),
                    "name": manager.get("name", ""),
                    "sellers": silent,
                })

        return alerts
