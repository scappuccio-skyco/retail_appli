"""Stats mixin for AdminService."""
import logging
from typing import Dict, List, Optional
from datetime import datetime, timezone, timedelta

from config.limits import MAX_PAGE_SIZE
from core.constants import PRICE_PER_SEAT_STARTER
from models.pagination import PaginatedResponse

logger = logging.getLogger(__name__)


class StatsMixin:

    async def get_stores_paginated(
        self,
        page: int = 1,
        size: int = 50,
        active_only: Optional[bool] = None,
        gerant_id: Optional[str] = None,
    ) -> PaginatedResponse:
        """
        Get stores paginated (Phase 3: admin list).
        skip = (page - 1) * size, limit = size.
        """
        size = min(size, MAX_PAGE_SIZE)
        skip = (page - 1) * size
        items = await self.store_repo.admin_find_all_paginated(
            active_only=active_only,
            gerant_id=gerant_id,
            limit=size,
            skip=skip,
        )
        total = await self.store_repo.admin_count_all(
            active_only=active_only,
            gerant_id=gerant_id,
        )
        pages = (total + size - 1) // size if size else 0
        return PaginatedResponse(items=items, total=total, page=page, size=size, pages=pages)

    async def get_users_paginated(
        self,
        page: int = 1,
        size: int = 50,
        role: Optional[str] = None,
        status: Optional[str] = None,
    ) -> PaginatedResponse:
        """
        Get users paginated (Phase 3: admin list).
        skip = (page - 1) * size, limit = size.
        """
        size = min(size, MAX_PAGE_SIZE)
        skip = (page - 1) * size
        items = await self.user_repo.admin_find_all_paginated(
            role=role,
            status=status,
            limit=size,
            skip=skip,
        )
        total = await self.user_repo.admin_count_all(role=role, status=status)
        pages = (total + size - 1) // size if size else 0
        return PaginatedResponse(items=items, total=total, page=page, size=size, pages=pages)

    async def get_platform_stats(self) -> Dict:
        """
        Get platform-wide statistics
        Returns structured data for frontend dashboard
        """
        # Workspaces stats
        total_workspaces = await self.admin_repo.count_workspaces_by_criteria({})
        active_workspaces = await self.admin_repo.count_workspaces_by_criteria({"subscription_status": "active"})
        trial_workspaces = await self.admin_repo.count_workspaces_by_criteria({"subscription_status": "trialing"})

        # Users stats
        total_active_users = await self.admin_repo.count_users_by_criteria({"status": "active"})
        active_managers = await self.admin_repo.count_users_by_criteria({"role": "manager", "status": "active"})
        active_sellers = await self.admin_repo.count_users_by_criteria({"role": "seller", "status": "active"})
        inactive_users = await self.admin_repo.count_users_by_criteria({"status": "suspended"})

        # Usage stats
        total_diagnostics = await self.admin_repo.count_diagnostics()
        total_ai_operations = await self.admin_repo.count_relationship_consultations()

        # Revenue stats
        active_subscriptions = await self.admin_repo.count_workspaces_by_criteria({
            "subscription_status": "active"
        })
        trial_subscriptions = await self.admin_repo.count_workspaces_by_criteria({
            "subscription_status": "trialing"
        })
        mrr = active_subscriptions * PRICE_PER_SEAT_STARTER  # Indicatif : basé sur le tarif Starter

        # Activity stats (recent signups and analyses)
        seven_days_ago = datetime.now(timezone.utc) - timedelta(days=7)
        recent_signups = await self.admin_repo.count_users_by_criteria({
            "created_at": {"$gte": seven_days_ago}
        })
        recent_analyses = await self.admin_repo.count_users_by_criteria({
            "created_at": {"$gte": seven_days_ago.isoformat()}
        })

        return {
            "workspaces": {
                "total": total_workspaces,
                "active": active_workspaces,
                "trial": trial_workspaces
            },
            "users": {
                "total_active": total_active_users,
                "active_managers": active_managers,
                "active_sellers": active_sellers,
                "inactive": inactive_users
            },
            "usage": {
                "total_ai_operations": total_ai_operations,
                "analyses_ventes": 0,
                "diagnostics": total_diagnostics
            },
            "revenue": {
                "mrr": mrr,
                "active_subscriptions": active_subscriptions,
                "trial_subscriptions": trial_subscriptions
            },
            "activity": {
                "recent_signups_7d": recent_signups,
                "recent_analyses_7d": recent_analyses
            },
            "timestamp": datetime.now(timezone.utc).isoformat()
        }

    async def health_check(self) -> Dict:
        """
        Check database and system health (for /superadmin/health).
        Uses workspace repository's database connection to ping MongoDB.
        """
        try:
            await self.workspace_repo.db.command("ping")
            db_status = "healthy"
        except Exception as e:
            logger.error(f"Database health check failed: {str(e)}")
            db_status = "unhealthy"
        return {
            "status": "healthy" if db_status == "healthy" else "degraded",
            "database": db_status,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "version": "2.0.0"
        }

    async def get_system_logs(
        self,
        hours: int = 24,
        page: int = 1,
        size: int = 50,
        level: Optional[str] = None,
        type_filter: Optional[str] = None
    ) -> Dict:
        """
        Get system logs filtered by time window (paginated).

        Args:
            hours: Number of hours to look back
            page: Page number (1-indexed)
            size: Number of items per page

        Returns:
            Dict with items, total, page, size, pages and optional available_actions/admins
        """
        size = min(size, MAX_PAGE_SIZE)
        now = datetime.now(timezone.utc)
        time_threshold = now - timedelta(hours=hours)

        logs, total = await self.admin_repo.get_system_logs(
            time_threshold, page=page, size=size
        )

        # Normalize logs to ensure required fields exist
        normalized_logs = []
        all_actions = set()
        all_admins = []
        admin_emails_seen = set()

        for log in logs:
            # Ensure action field exists (CRITICAL for frontend .replace())
            action = log.get('action') or log.get('type') or log.get('level') or 'system_event'
            admin_email = log.get('admin_email') or log.get('email') or 'system@retailperformer.com'
            admin_name = log.get('admin_name') or log.get('name') or 'System'

            normalized_log = {
                "id": log.get('id', str(len(normalized_logs))),
                "timestamp": str(log.get('timestamp') or log.get('created_at') or now.isoformat()),
                "action": str(action),  # CRITICAL: Never None
                "type": str(log.get('type') or action or 'api'),
                "admin_email": str(admin_email),
                "admin_name": str(admin_name),
                "workspace_id": log.get('workspace_id'),
                "details": log.get('details') or {},
                "level": log.get('level', 'info'),
                "message": log.get('message', '')
            }
            if log.get('http_code') is not None:
                normalized_log["http_code"] = log['http_code']
            if log.get('endpoint') is not None:
                normalized_log["endpoint"] = log['endpoint']
            if log.get('stack_trace') is not None:
                normalized_log["stack_trace"] = log['stack_trace']
            normalized_logs.append(normalized_log)
            all_actions.add(action)

            if admin_email not in admin_emails_seen:
                admin_emails_seen.add(admin_email)
                all_admins.append({
                    "email": admin_email,
                    "name": admin_name
                })

        # Apply optional filters (level = log level, type_filter = action/type)
        if level or type_filter:
            filtered_logs = []
            for log in normalized_logs:
                if level and log.get("level") != level:
                    continue
                if type_filter and log.get("action") != type_filter:
                    continue
                filtered_logs.append(log)
            normalized_logs = filtered_logs

        pages = (total + size - 1) // size if total > 0 else 0
        return {
            "items": normalized_logs,
            "total": total,
            "page": page,
            "size": size,
            "pages": pages,
            "period_hours": hours,
            "timestamp": now.isoformat(),
            "available_actions": sorted(list(all_actions)),
            "available_admins": all_admins
        }

    async def get_admin_audit_logs(
        self,
        hours: int = 24,
        page: int = 1,
        size: int = 50,
        action: Optional[str] = None,
        admin_emails: Optional[List[str]] = None
    ) -> Dict:
        """
        Get admin audit logs filtered by time window (paginated).
        Returns dict with items, total, page, size, pages.
        """
        size = min(size, MAX_PAGE_SIZE)
        now = datetime.now(timezone.utc)
        time_threshold = now - timedelta(hours=hours)

        logs, total = await self.admin_repo.get_admin_logs(
            time_threshold=time_threshold,
            page=page,
            size=size,
            action=action,
            admin_emails=admin_emails
        )

        normalized_logs = []
        for log in logs:
            admin_email = log.get('admin_email') or log.get('email') or 'system@retailperformer.com'
            admin_name = log.get('admin_name') or log.get('name') or 'System'
            normalized_logs.append({
                "id": log.get('id', str(len(normalized_logs))),
                "timestamp": str(log.get('timestamp') or log.get('created_at') or now.isoformat()),
                "action": str(log.get('action') or 'admin_event'),
                "admin_email": str(admin_email),
                "admin_name": str(admin_name),
                "workspace_id": log.get('workspace_id'),
                "details": log.get('details') or {},
                "level": log.get('level', 'info'),
                "message": log.get('message', '')
            })

        actions = await self.admin_repo.get_admin_actions(time_threshold)
        admins_list, _ = await self.admin_repo.get_admins_from_logs(
            time_threshold, page=1, size=500
        )

        # Normalize admin list for UI (filter dropdown)
        available_admins = []
        seen_emails = set()
        for admin in admins_list:
            email = admin.get('email')
            if not email or email in seen_emails:
                continue
            seen_emails.add(email)
            available_admins.append({
                "email": email,
                "name": admin.get('name') or email
            })

        pages = (total + size - 1) // size if total > 0 else 0
        return {
            "items": normalized_logs,
            "total": total,
            "page": page,
            "size": size,
            "pages": pages,
            "period_hours": hours,
            "timestamp": now.isoformat(),
            "available_actions": sorted([a for a in actions if a]),
            "available_admins": available_admins
        }

    # ===== ADMIN LOG OPERATIONS =====

    async def log_admin_action(
        self,
        admin_id: str,
        admin_email: str,
        admin_name: str,
        action: str,
        details: Optional[Dict] = None,
        workspace_id: Optional[str] = None,
        gerant_id: Optional[str] = None,
        ip: Optional[str] = None,
        **kwargs
    ) -> str:
        """
        Log an admin action to admin_logs collection

        Args:
            admin_id: Admin user ID
            admin_email: Admin email
            admin_name: Admin name
            action: Action name (e.g., "workspace_status_change")
            details: Optional details dict
            workspace_id: Optional workspace ID
            gerant_id: Optional gerant ID
            ip: Optional IP address
            **kwargs: Additional fields to log
        """
        log_data = {
            "admin_id": admin_id,
            "admin_email": admin_email,
            "admin_name": admin_name,
            "action": action,
            "details": details or {},
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "created_at": datetime.now(timezone.utc).isoformat()
        }

        if workspace_id:
            log_data["workspace_id"] = workspace_id
        if gerant_id:
            log_data["gerant_id"] = gerant_id
        if ip:
            log_data["ip"] = ip

        # Add any additional fields
        log_data.update(kwargs)

        return await self.admin_log_repo.create_log(log_data)

    # ===== INVITATIONS =====

    async def get_all_invitations(
        self,
        status: Optional[str] = None,
        page: int = 1,
        size: int = 50
    ) -> Dict:
        """
        Get all invitations (gerant + manager) paginated

        Args:
            status: Optional status filter
            page: Page number (1-based)
            size: Items per page (max 100)
        """
        if size > 100:
            size = 100

        skip = (page - 1) * size

        # Get gerant invitations (paginated)
        gerant_invitations = await self.gerant_invitation_repo.admin_find_all_paginated(
            status=status,
            limit=size,
            skip=skip,
            sort=[("created_at", -1)]
        )

        # Get manager invitations (paginated)
        manager_invitations = await self.invitation_repo.admin_find_all_paginated(
            status=status,
            limit=size,
            skip=skip,
            sort=[("created_at", -1)]
        )

        # Combine and enrich with gerant info
        all_invitations = []

        # Process gerant invitations
        for invite in gerant_invitations:
            gerant_id = invite.get("gerant_id")
            if gerant_id:
                gerant = await self.user_repo.find_one(
                    {"id": gerant_id},
                    {"_id": 0, "name": 1, "email": 1}
                )
                if gerant:
                    invite["gerant_name"] = gerant.get("name", "N/A")
                    invite["gerant_email"] = gerant.get("email", "N/A")
            all_invitations.append({**invite, "type": "gerant"})

        # Process manager invitations (they don't have gerant_id, so skip enrichment for now)
        for invite in manager_invitations:
            all_invitations.append({**invite, "type": "manager"})

        # Sort by created_at (most recent first)
        all_invitations.sort(key=lambda x: x.get('created_at', ''), reverse=True)

        # Count totals
        total_gerant = await self.gerant_invitation_repo.admin_count_all(status=status)
        total_manager = await self.invitation_repo.admin_count_all(status=status)
        total = total_gerant + total_manager
        pages = (total + size - 1) // size

        return {
            "invitations": all_invitations,
            "total": total,
            "page": page,
            "pages": pages
        }
