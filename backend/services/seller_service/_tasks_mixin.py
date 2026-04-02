"""Tasks and bilans methods for SellerService."""
import logging
from datetime import datetime, timezone
from typing import Dict, List

from models.pagination import PaginatedResponse
from utils.pagination import paginate
from core.exceptions import ForbiddenError

logger = logging.getLogger(__name__)


class TasksMixin:

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

    async def get_seller_tasks(self, seller_id: str) -> List[Dict]:
        """
        Get all pending tasks for a seller:
        - Diagnostic completion
        - Debrief submission (if none in last 7 days)
        - Daily challenge not yet completed
        - Active objective expiring in ≤3 days
        - Weekly bilan missing for previous complete week
        Jour 1 (compte < 24h) : seulement le diagnostic.
        """
        from datetime import date, timedelta
        tasks = []
        today = date.today()
        today_str = today.isoformat()

        # --- Détection compte tout neuf (< 24h) ---
        is_new_user = False
        try:
            user_doc = await self.user_repo.find_by_id(seller_id, projection={"_id": 0, "created_at": 1})
            created_at = user_doc.get("created_at") if user_doc else None
            if created_at:
                if isinstance(created_at, str):
                    created_dt = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
                else:
                    created_dt = created_at
                if created_dt.tzinfo is None:
                    created_dt = created_dt.replace(tzinfo=timezone.utc)
                is_new_user = (datetime.now(timezone.utc) - created_dt).total_seconds() < 86400
        except Exception:
            pass

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

        # Jour 1 : on s'arrête ici
        if is_new_user:
            return tasks

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
        # Only suggest if the seller actually has KPI data for that week
        try:
            weekday = today.weekday()  # 0 = Monday
            current_week_monday = today - timedelta(days=weekday)
            prev_week_monday = current_week_monday - timedelta(days=7)
            prev_week_sunday = current_week_monday - timedelta(days=1)
            prev_week_monday_str = prev_week_monday.isoformat()
            prev_week_sunday_str = prev_week_sunday.isoformat()
            recent_bilans = await self.seller_bilan_repo.find_by_seller(seller_id, limit=5)
            has_prev_week_bilan = any(
                b.get("period_start", "") <= prev_week_sunday_str
                and b.get("period_end", "") >= prev_week_monday_str
                for b in recent_bilans
            )
            if not has_prev_week_bilan:
                # Vérifier qu'il y a des KPIs sur la semaine précédente avant de proposer le bilan
                kpis_prev_week = await self.kpi_repo.count({
                    "seller_id": seller_id,
                    "date": {"$gte": prev_week_monday_str, "$lte": prev_week_sunday_str}
                })
                if kpis_prev_week > 0:
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
