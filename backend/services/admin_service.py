"""
Admin Service
Business logic for SuperAdmin operations
PHASE 9: Refactoring - All business logic moved from admin.py routes
"""
from typing import List, Dict, Optional
from datetime import datetime, timezone, timedelta
import uuid
import bcrypt
import secrets
import logging
import stripe
from core.config import settings

from repositories.admin_repository import AdminRepository
from repositories.admin_log_repository import AdminLogRepository
from repositories.user_repository import UserRepository
from repositories.store_repository import StoreRepository, WorkspaceRepository
from repositories.subscription_repository import SubscriptionRepository
from repositories.gerant_invitation_repository import GerantInvitationRepository
from repositories.invitation_repository import InvitationRepository
from repositories.system_log_repository import SystemLogRepository
from repositories.base_repository import BaseRepository
from utils.pagination import paginate, paginate_aggregation
from config.limits import MAX_PAGE_SIZE
from models.pagination import PaginatedResponse

logger = logging.getLogger(__name__)


# Repositories pour collections sans repository dédié
class PaymentTransactionRepository(BaseRepository):
    """Repository for payment_transactions collection"""
    def __init__(self, db):
        super().__init__(db, "payment_transactions")


class StripeEventRepository(BaseRepository):
    """Repository for stripe_events collection"""
    def __init__(self, db):
        super().__init__(db, "stripe_events")


class AIConversationRepository(BaseRepository):
    """Repository for ai_conversations collection"""
    def __init__(self, db):
        super().__init__(db, "ai_conversations")


class AIMessageRepository(BaseRepository):
    """Repository for ai_messages collection"""
    def __init__(self, db):
        super().__init__(db, "ai_messages")


class AIUsageLogRepository(BaseRepository):
    """Repository for ai_usage_logs collection"""
    def __init__(self, db):
        super().__init__(db, "ai_usage_logs")


class AdminService:
    """Service for SuperAdmin business logic"""
    
    def __init__(
        self,
        admin_repo: AdminRepository,
        admin_log_repo: AdminLogRepository,
        user_repo: UserRepository,
        store_repo: StoreRepository,
        workspace_repo: WorkspaceRepository,
        subscription_repo: SubscriptionRepository,
        payment_transaction_repo: PaymentTransactionRepository,
        stripe_event_repo: StripeEventRepository,
        ai_conversation_repo: AIConversationRepository,
        ai_message_repo: AIMessageRepository,
        gerant_invitation_repo: GerantInvitationRepository,
        invitation_repo: InvitationRepository,
        system_log_repo: SystemLogRepository,
        ai_usage_log_repo: AIUsageLogRepository
    ):
        self.admin_repo = admin_repo
        self.admin_log_repo = admin_log_repo
        self.user_repo = user_repo
        self.store_repo = store_repo
        self.workspace_repo = workspace_repo
        self.subscription_repo = subscription_repo
        self.payment_transaction_repo = payment_transaction_repo
        self.stripe_event_repo = stripe_event_repo
        self.ai_conversation_repo = ai_conversation_repo
        self.ai_message_repo = ai_message_repo
        self.gerant_invitation_repo = gerant_invitation_repo
        self.invitation_repo = invitation_repo
        self.system_log_repo = system_log_repo
        self.ai_usage_log_repo = ai_usage_log_repo
    
    async def get_workspaces_with_details(self, include_deleted: bool = False) -> List[Dict]:
        """
        Get all workspaces with enriched details
        - Gérant info
        - Stores count
        - Managers and sellers count
        - Each store with its manager and sellers
        - Subscription with guaranteed plan field

        Uses batch fetching ($in) to avoid N+1: gérants, managers, sellers, counts in bulk.
        """
        workspaces = await self.admin_repo.get_all_workspaces(include_deleted=include_deleted)
        return await self._enrich_workspaces_with_details(workspaces)

    async def _enrich_workspaces_with_details(self, workspaces: List[Dict]) -> List[Dict]:
        """Enrich workspaces with gérants, stores, managers, sellers (batch fetch)."""
        if not workspaces:
            return []

        gerant_ids = [w.get('gerant_id') for w in workspaces if w.get('gerant_id')]
        all_gerants = await self.admin_repo.get_gerants_by_ids(gerant_ids)
        gerant_map = {g['id']: g for g in all_gerants}

        count_by_gerant = await self.admin_repo.count_active_sellers_by_gerant_ids(gerant_ids)

        store_ids = []
        workspace_stores: List[List[Dict]] = []
        for workspace in workspaces:
            workspace_id = workspace.get('id')
            gerant_id = workspace.get('gerant_id')
            stores = []
            if gerant_id:
                stores = await self.admin_repo.get_stores_by_gerant(gerant_id)
            if not stores and workspace_id:
                stores = await self.admin_repo.get_stores_by_workspace(workspace_id)
            workspace_stores.append(stores)
            store_ids.extend(s.get('id') for s in stores if s.get('id'))

        all_managers = await self.admin_repo.get_managers_for_stores(store_ids)
        manager_map = {m['store_id']: m for m in all_managers}
        all_sellers = await self.admin_repo.get_sellers_for_stores(store_ids)
        sellers_map: Dict[str, List[Dict]] = {}
        for sid in set(store_ids):
            sellers_map[sid] = []
        for s in all_sellers:
            sid = s.get('store_id')
            if sid and sid in sellers_map:
                sellers_map[sid].append(s)

        for i, workspace in enumerate(workspaces):
            workspace_id = workspace.get('id')
            gerant_id = workspace.get('gerant_id')
            current_status = workspace.get('status')
            if not current_status or current_status == '' or current_status is None:
                workspace['status'] = 'active'
            workspace['gerant'] = gerant_map.get(gerant_id) if gerant_id else None

            stores = workspace_stores[i]
            total_managers = 0
            total_sellers = 0
            for store in stores:
                sid = store.get('id')
                manager = manager_map.get(sid) if sid else None
                store['manager'] = manager
                if manager:
                    total_managers += 1
                sellers = sellers_map.get(sid, []) if sid else []
                store['sellers'] = sellers
                store['sellers_count'] = len([s for s in sellers if s.get('status') == 'active'])
                store['total_sellers'] = len(sellers)
                total_sellers += store['sellers_count']
                if not store.get('status'):
                    store['status'] = 'active' if store.get('active', True) else 'inactive'

            workspace['stores'] = stores
            workspace['stores_count'] = len(stores)
            workspace['managers_count'] = total_managers
            workspace['sellers_count'] = total_sellers
            workspace['total_sellers'] = count_by_gerant.get(gerant_id, total_sellers) if gerant_id else total_sellers

            default_subscription = {
                "plan": "free",
                "status": "active",
                "created_at": workspace.get('created_at'),
                "trial_ends_at": workspace.get('trial_ends_at')
            }
            if workspace.get('subscription') and isinstance(workspace.get('subscription'), dict):
                workspace['subscription']['plan'] = workspace['subscription'].get('plan') or workspace.get('subscription_plan', 'free')
                workspace['subscription']['status'] = workspace['subscription'].get('status') or workspace.get('subscription_status', 'active')
            else:
                workspace['subscription'] = default_subscription
                workspace['subscription']['plan'] = workspace.get('subscription_plan', 'free')
                workspace['subscription']['status'] = workspace.get('subscription_status', 'active')
        return workspaces

    async def get_workspaces_with_details_paginated(
        self,
        page: int = 1,
        size: int = 50,
        include_deleted: bool = False,
    ) -> PaginatedResponse:
        """
        Get workspaces paginated with enriched details (Phase 3: scalable admin).
        Same enrichment as get_workspaces_with_details but on a single page (batch fetch).
        """
        result = await self.admin_repo.get_all_workspaces_paginated(
            page=page,
            size=size,
            include_deleted=include_deleted,
        )
        workspaces = await self._enrich_workspaces_with_details(result.items)
        return PaginatedResponse(
            items=workspaces,
            total=result.total,
            page=result.page,
            size=result.size,
            pages=result.pages,
        )

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
        mrr = active_subscriptions * 29  # Average price per subscription
        
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
                "admin_email": str(admin_email),
                "admin_name": str(admin_name),
                "workspace_id": log.get('workspace_id'),
                "details": log.get('details') or {},
                "level": log.get('level', 'info'),
                "message": log.get('message', '')
            }
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
    
    # ===== WORKSPACE OPERATIONS =====
    
    async def update_workspace_status(
        self,
        workspace_id: str,
        status: str,
        current_admin: Dict
    ) -> Dict:
        """
        Update workspace status (active or deleted)
        
        Args:
            workspace_id: Workspace ID
            status: New status (active or deleted)
            current_admin: Current admin user dict
        """
        if status not in ['active', 'deleted']:
            raise ValueError("Invalid status. Must be: active or deleted")
        
        # Get current workspace
        workspace = await self.workspace_repo.find_by_id(workspace_id)
        if not workspace:
            raise ValueError("Workspace not found")
        
        old_status = workspace.get('status')
        
        # If status is already the same, return early
        if old_status == status:
            return {
                "success": True,
                "message": f"Workspace status is already {status}",
                "status_unchanged": True
            }
        
        # Update workspace
        updated = await self.workspace_repo.update_one(
            {"id": workspace_id},
            {"$set": {"status": status, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
        if updated:
            from core.cache import invalidate_workspace_cache
            await invalidate_workspace_cache(workspace_id)
        
        if not updated:
            raise ValueError("Workspace status update failed")
        
        # Log admin action
        await self.log_admin_action(
            admin_id=current_admin.get('id'),
            admin_email=current_admin.get('email'),
            admin_name=current_admin.get('name'),
            action="workspace_status_change",
            workspace_id=workspace_id,
            details={
                "workspace_name": workspace.get('name', 'Unknown'),
                "old_status": old_status,
                "new_status": status
            }
        )
        
        return {"success": True, "message": f"Workspace status updated to {status}"}
    
    async def update_workspace_plan(
        self,
        workspace_id: str,
        new_plan: str,
        current_admin: Dict
    ) -> Dict:
        """
        Update workspace plan
        
        Args:
            workspace_id: Workspace ID
            new_plan: New plan (trial, starter, professional, enterprise)
            current_admin: Current admin user dict
        """
        valid_plans = ['trial', 'starter', 'professional', 'enterprise']
        if new_plan not in valid_plans:
            raise ValueError(f"Invalid plan. Must be one of: {valid_plans}")
        
        # Get current workspace
        workspace = await self.workspace_repo.find_by_id(workspace_id)
        if not workspace:
            raise ValueError("Workspace not found")
        
        old_plan = workspace.get('plan_type') or workspace.get('subscription_plan', 'trial')
        
        # Update workspace
        await self.workspace_repo.update_one(
            {"id": workspace_id},
            {"$set": {
                "plan_type": new_plan,
                "subscription_plan": new_plan,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        from core.cache import invalidate_workspace_cache
        await invalidate_workspace_cache(workspace_id)
        
        # Update subscription if exists
        subscription = await self.subscription_repo.find_by_workspace(workspace_id)
        if subscription:
            await self.subscription_repo.update_by_workspace(
                workspace_id,
                {
                    "plan_type": new_plan,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }
            )
        
        # Log admin action
        await self.log_admin_action(
            admin_id=current_admin.get('id'),
            admin_email=current_admin.get('email'),
            admin_name=current_admin.get('name'),
            action="workspace_plan_change",
            workspace_id=workspace_id,
            details={
                "workspace_name": workspace.get('name', 'Unknown'),
                "old_plan": old_plan,
                "new_plan": new_plan
            }
        )
        
        return {"success": True, "message": f"Plan changed to {new_plan}"}
    
    async def bulk_update_workspace_status(
        self,
        workspace_ids: List[str],
        status: str,
        current_admin: Dict
    ) -> Dict:
        """
        Bulk update workspace status
        
        Args:
            workspace_ids: List of workspace IDs
            status: New status (active or deleted)
            current_admin: Current admin user dict
        """
        if status not in ['active', 'deleted']:
            raise ValueError("Invalid status. Must be: active or deleted")
        
        if not workspace_ids:
            raise ValueError("No workspace IDs provided")
        
        # Update all workspaces
        updated_count = await self.workspace_repo.update_many(
            {"id": {"$in": workspace_ids}},
            {"$set": {"status": status, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
        
        # Log admin action
        await self.log_admin_action(
            admin_id=current_admin.get('id'),
            admin_email=current_admin.get('email'),
            admin_name=current_admin.get('name'),
            action="bulk_workspace_status_change",
            details={
                "workspace_ids": workspace_ids,
                "new_status": status,
                "updated_count": updated_count
            }
        )
        
        return {
            "success": True,
            "message": f"Updated {updated_count} workspace(s) to status {status}",
            "updated_count": updated_count
        }
    
    # ===== SUBSCRIPTION OPERATIONS =====
    
    async def resolve_subscription_duplicates(
        self,
        gerant_id: str,
        apply: bool,
        current_admin: Dict,
        request_headers: Dict
    ) -> Dict:
        """
        Resolve duplicate subscriptions for a gerant
        
        Args:
            gerant_id: Gérant ID
            apply: If True, apply changes. If False, dry-run only
            current_admin: Current admin user dict
            request_headers: Request headers dict (for IP extraction)
        """
        # Extract IP from headers
        client_ip = None
        x_forwarded_for = request_headers.get("x-forwarded-for")
        x_real_ip = request_headers.get("x-real-ip")
        cf_connecting_ip = request_headers.get("cf-connecting-ip")
        
        if cf_connecting_ip:
            client_ip = cf_connecting_ip.split(",")[0].strip()
        elif x_real_ip:
            client_ip = x_real_ip.split(",")[0].strip()
        elif x_forwarded_for:
            client_ip = x_forwarded_for.split(",")[0].strip()
        elif request_headers.get("x-vercel-forwarded-for"):
            client_ip = request_headers.get("x-vercel-forwarded-for").split(",")[0].strip()
        elif request_headers.get("x-railway-client-ip"):
            client_ip = request_headers.get("x-railway-client-ip").split(",")[0].strip()
        
        if not client_ip:
            client_ip = "unknown"
        
        # Log admin action
        await self.log_admin_action(
            admin_id=current_admin.get('id'),
            admin_email=current_admin.get('email'),
            admin_name=current_admin.get('name'),
            action="resolve_subscription_duplicates",
            gerant_id=gerant_id,
            ip=client_ip,
            x_forwarded_for=x_forwarded_for,
            x_real_ip=x_real_ip,
            cf_connecting_ip=cf_connecting_ip,
            apply=apply
        )
        
        # Get all active subscriptions for this gerant (paginated, max 100)
        active_subscriptions = await self.subscription_repo.find_many_by_user_status(
            user_id=gerant_id,
            status_list=["active", "trialing"],
            limit=100
        )
        
        if len(active_subscriptions) <= 1:
            return {
                "success": True,
                "message": "Aucun doublon détecté",
                "active_subscriptions_count": len(active_subscriptions),
                "plan": None
            }
        
        # Sort by current_period_end (most recent first)
        sorted_subs = sorted(
            active_subscriptions,
            key=lambda s: (
                s.get('current_period_end', '') or s.get('created_at', ''),
                s.get('status') == 'active'  # Prefer active over trialing
            ),
            reverse=True
        )
        
        # Keep the most recent one
        keep_subscription = sorted_subs[0]
        cancel_subscriptions = sorted_subs[1:]
        
        # Build resolution plan
        plan = {
            "keep": {
                "stripe_subscription_id": keep_subscription.get('stripe_subscription_id'),
                "workspace_id": keep_subscription.get('workspace_id'),
                "price_id": keep_subscription.get('price_id'),
                "status": keep_subscription.get('status'),
                "current_period_end": keep_subscription.get('current_period_end'),
                "reason": "Most recent subscription (by current_period_end)"
            },
            "cancel": [
                {
                    "stripe_subscription_id": sub.get('stripe_subscription_id'),
                    "workspace_id": sub.get('workspace_id'),
                    "price_id": sub.get('price_id'),
                    "status": sub.get('status'),
                    "current_period_end": sub.get('current_period_end'),
                    "action": "cancel_at_period_end"
                }
                for sub in cancel_subscriptions
            ]
        }
        
        if not apply:
            # Dry-run: return plan only
            return {
                "success": True,
                "mode": "dry-run",
                "message": f"Plan de résolution pour {len(active_subscriptions)} abonnements actifs",
                "active_subscriptions_count": len(active_subscriptions),
                "plan": plan,
                "instructions": "Passez apply=true pour appliquer ce plan"
            }
        
        # Apply plan: cancel subscriptions via Stripe
        if not settings.STRIPE_API_KEY:
            raise ValueError("Configuration Stripe manquante")
        
        stripe.api_key = settings.STRIPE_API_KEY
        
        canceled_results = []
        errors = []
        
        for sub_to_cancel in cancel_subscriptions:
            stripe_sub_id = sub_to_cancel.get('stripe_subscription_id')
            if not stripe_sub_id:
                errors.append({
                    "stripe_subscription_id": None,
                    "error": "No stripe_subscription_id found"
                })
                continue
            
            try:
                # Cancel at period end (not immediately)
                stripe.Subscription.modify(stripe_sub_id, cancel_at_period_end=True)
                
                # Update database
                await self.subscription_repo.update_by_stripe_subscription(
                    stripe_sub_id,
                    {
                        "cancel_at_period_end": True,
                        "canceled_at": datetime.now(timezone.utc).isoformat(),
                        "updated_at": datetime.now(timezone.utc).isoformat()
                    }
                )
                
                canceled_results.append({
                    "stripe_subscription_id": stripe_sub_id,
                    "status": "scheduled_for_cancellation"
                })
                
                logger.info(f"✅ Scheduled cancellation for subscription {stripe_sub_id}")
                
            except Exception as e:
                errors.append({
                    "stripe_subscription_id": stripe_sub_id,
                    "error": str(e)
                })
                logger.error(f"❌ Error canceling subscription {stripe_sub_id}: {e}")
        
        return {
            "success": True,
            "mode": "applied",
            "message": f"Plan appliqué: {len(canceled_results)} abonnement(s) programmé(s) pour annulation",
            "active_subscriptions_count": len(active_subscriptions),
            "plan": plan,
            "results": {
                "canceled_count": len(canceled_results),
                "canceled": canceled_results,
                "errors": errors
            }
        }
    
    # ===== ADMIN USER OPERATIONS =====
    
    async def get_admins_paginated(
        self,
        page: int = 1,
        size: int = 50
    ) -> Dict:
        """
        Get paginated list of super admins
        
        Args:
            page: Page number (1-based)
            size: Items per page (max 100)
        """
        if size > 100:
            size = 100
        
        skip = (page - 1) * size
        
        admins = await self.user_repo.admin_find_all_paginated(
            role="super_admin",
            projection={"_id": 0, "password": 0},
            limit=size,
            skip=skip,
            sort=[("created_at", -1)]
        )
        
        total = await self.user_repo.admin_count_all(role="super_admin")
        pages = (total + size - 1) // size
        
        return {
            "admins": admins,
            "total": total,
            "page": page,
            "pages": pages
        }
    
    async def add_super_admin(
        self,
        email: str,
        name: str,
        current_admin: Dict
    ) -> Dict:
        """
        Add a new super admin
        
        Args:
            email: Admin email
            name: Admin name
            current_admin: Current admin user dict
        """
        # Check if user already exists
        existing = await self.user_repo.find_by_email(email)
        if existing:
            if existing.get('role') == 'super_admin':
                raise ValueError("Cet email est déjà super admin")
            else:
                raise ValueError("Cet email existe déjà avec un autre rôle")
        
        # Generate temporary password
        temp_password = secrets.token_urlsafe(16)
        hashed_password = bcrypt.hashpw(temp_password.encode('utf-8'), bcrypt.gensalt())
        
        # Create new super admin
        new_admin = {
            "id": str(uuid.uuid4()),
            "email": email,
            "password": hashed_password.decode('utf-8'),
            "name": name,
            "role": "super_admin",
            "status": "active",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "created_by": current_admin['email']
        }
        
        await self.user_repo.insert_one(new_admin)
        
        # Log admin action
        await self.log_admin_action(
            admin_id=current_admin.get('id'),
            admin_email=current_admin.get('email'),
            admin_name=current_admin.get('name'),
            action="add_super_admin",
            details={
                "new_admin_email": email,
                "new_admin_name": name,
                "temp_password_generated": True
            }
        )
        
        return {
            "success": True,
            "email": email,
            "temporary_password": temp_password,
            "message": "Super admin ajouté. Envoyez-lui le mot de passe temporaire."
        }
    
    async def remove_super_admin(
        self,
        admin_id: str,
        current_admin: Dict
    ) -> Dict:
        """
        Remove a super admin (cannot remove yourself)
        
        Args:
            admin_id: Admin ID to remove
            current_admin: Current admin user dict
        """
        # Cannot remove yourself
        if admin_id == current_admin['id']:
            raise ValueError("Vous ne pouvez pas vous retirer vous-même")
        
        # Find admin to remove
        admin_to_remove = await self.user_repo.find_by_id(admin_id, include_password=False)
        if not admin_to_remove or admin_to_remove.get('role') != 'super_admin':
            raise ValueError("Super admin non trouvé")
        
        # Remove admin
        await self.user_repo.delete_one({"id": admin_id})
        from core.cache import invalidate_user_cache
        await invalidate_user_cache(admin_id)
        
        # Log admin action
        await self.log_admin_action(
            admin_id=current_admin.get('id'),
            admin_email=current_admin.get('email'),
            admin_name=current_admin.get('name'),
            action="remove_super_admin",
            details={
                "removed_admin_email": admin_to_remove.get('email'),
                "removed_admin_name": admin_to_remove.get('name'),
                "removed_admin_id": admin_id
            }
        )
        
        return {"success": True, "message": "Super admin supprimé"}
    
    # ===== SUBSCRIPTION OVERVIEW & DETAILS =====
    
    async def get_subscriptions_overview(
        self,
        page: int = 1,
        size: int = 100
    ) -> Dict:
        """
        Get subscriptions overview with KPIs (MRR, Total Users, etc.)
        Uses MongoDB aggregations to avoid loading all data in RAM
        
        Args:
            page: Page number (1-based)
            size: Items per page (max 100)
        """
        if size > 100:
            size = 100
        
        skip = (page - 1) * size
        
        # 1. Get paginated gerants
        gerants = await self.user_repo.admin_find_all_paginated(
            role="gerant",
            projection={"_id": 0, "id": 1, "name": 1, "email": 1, "stripe_customer_id": 1, "created_at": 1},
            limit=size,
            skip=skip,
            sort=[("created_at", -1)]
        )
        
        total_gerants = await self.user_repo.admin_count_all(role="gerant")
        pages = (total_gerants + size - 1) // size
        
        if not gerants:
            return {
                "summary": {
                    "total_gerants": 0,
                    "active_subscriptions": 0,
                    "trialing_subscriptions": 0,
                    "total_mrr": 0
                },
                "subscriptions": [],
                "pagination": {
                    "page": page,
                    "size": size,
                    "total": 0,
                    "pages": 0
                }
            }
        
        gerant_ids = [g['id'] for g in gerants]
        
        # 2. Get subscriptions for current page gerants (using repository)
        subscriptions = await self.subscription_repo.find_many(
            {"user_id": {"$in": gerant_ids}},
            limit=1000  # Max subscriptions for current page
        )
        subscriptions_map = {sub['user_id']: sub for sub in subscriptions}
        
        # 3. Get active sellers counts using aggregation (via UserRepository)
        sellers_count_pipeline = [
            {"$match": {
                "gerant_id": {"$in": gerant_ids},
                "role": "seller",
                "status": "active"
            }},
            {"$group": {
                "_id": "$gerant_id",
                "count": {"$sum": 1}
            }}
        ]
        sellers_counts = await self.user_repo.aggregate(sellers_count_pipeline, max_results=1000)
        sellers_count_map = {item['_id']: item['count'] for item in sellers_counts}
        
        # 4. Get team members for AI credits calculation
        team_members = await self.user_repo.find_many(
            {"gerant_id": {"$in": gerant_ids}},
            projection={"_id": 0, "id": 1, "gerant_id": 1},
            limit=1000
        )
        team_members_by_gerant = {}
        for member in team_members:
            gerant_id = member.get('gerant_id')
            if gerant_id:
                if gerant_id not in team_members_by_gerant:
                    team_members_by_gerant[gerant_id] = []
                team_members_by_gerant[gerant_id].append(member['id'])
        
        # 5. Get last transactions using aggregation (via PaymentTransactionRepository)
        all_team_ids = []
        MAX_TEAM_MEMBERS = 1000
        for team_ids in team_members_by_gerant.values():
            all_team_ids.extend(team_ids[:MAX_TEAM_MEMBERS])
        
        transactions_map = {}
        if gerant_ids:
            transactions_pipeline = [
                {"$match": {"user_id": {"$in": gerant_ids}}},
                {"$sort": {"created_at": -1}},
                {"$group": {
                    "_id": "$user_id",
                    "last_transaction": {"$first": "$$ROOT"}
                }}
            ]
            transactions_result = await self.payment_transaction_repo.aggregate(
                transactions_pipeline,
                max_results=1000
            )
            for item in transactions_result:
                transaction = item.get('last_transaction', {})
                transaction.pop('_id', None)
                transactions_map[item['_id']] = transaction
        
        # 6. Get AI credits usage by team using aggregation (via AIUsageLogRepository)
        ai_credits_map = {}
        if all_team_ids:
            try:
                ai_credits_pipeline = [
                    {"$match": {"user_id": {"$in": all_team_ids}}},
                    {"$lookup": {
                        "from": "users",
                        "localField": "user_id",
                        "foreignField": "id",
                        "as": "user_info"
                    }},
                    {"$unwind": {"path": "$user_info", "preserveNullAndEmptyArrays": True}},
                    {"$group": {
                        "_id": "$user_info.gerant_id",
                        "total": {"$sum": "$credits_consumed"}
                    }}
                ]
                ai_credits_result = await self.ai_usage_log_repo.aggregate(ai_credits_pipeline, max_results=1000)
                ai_credits_map = {item['_id']: item.get('total', 0) for item in ai_credits_result if item.get('_id')}
            except Exception as e:
                logger.warning(f"Could not fetch AI credits: {e}")
        
        # 7. Build response using lookup maps
        subscriptions_data = []
        for gerant in gerants:
            gerant_id = gerant['id']
            
            subscription = subscriptions_map.get(gerant_id)
            active_sellers_count = sellers_count_map.get(gerant_id, 0)
            last_transaction = transactions_map.get(gerant_id)
            ai_credits_total = ai_credits_map.get(gerant_id, 0)
            
            subscriptions_data.append({
                "gerant": {
                    "id": gerant['id'],
                    "name": gerant['name'],
                    "email": gerant['email'],
                    "created_at": gerant.get('created_at')
                },
                "subscription": subscription,
                "active_sellers_count": active_sellers_count,
                "last_transaction": last_transaction,
                "ai_credits_used": ai_credits_total
            })
        
        # Calculate summary statistics
        active_subscriptions = sum(
            1 for s in subscriptions_data
            if s['subscription'] and s['subscription'].get('status') in ['active', 'trialing']
        )
        trialing_subscriptions = sum(
            1 for s in subscriptions_data
            if s['subscription'] and s['subscription'].get('status') == 'trialing'
        )
        total_mrr = sum(
            s['subscription'].get('seats', 0) * s['subscription'].get('price_per_seat', 0)
            for s in subscriptions_data
            if s['subscription'] and s['subscription'].get('status') == 'active'
        )
        
        return {
            "summary": {
                "total_gerants": len(gerants),
                "active_subscriptions": active_subscriptions,
                "trialing_subscriptions": trialing_subscriptions,
                "total_mrr": round(total_mrr, 2)
            },
            "subscriptions": subscriptions_data,
            "pagination": {
                "page": page,
                "size": size,
                "total": total_gerants,
                "pages": pages
            }
        }
    
    async def get_subscription_details(self, gerant_id: str) -> Dict:
        """
        Get complete subscription details for a gerant
        Includes workspace, subscription, transactions, webhook events, sellers
        
        Args:
            gerant_id: Gérant ID
        """
        # Get gerant
        gerant = await self.user_repo.find_by_id(gerant_id, include_password=False)
        if not gerant or gerant.get('role') != 'gerant':
            raise ValueError("Gérant non trouvé")
        
        # Get subscription
        subscription = await self.subscription_repo.find_by_user(gerant_id)
        
        # Get workspace
        workspace = await self.workspace_repo.find_by_gerant(gerant_id)
        
        # Get transactions (paginated, max 100)
        transactions = await self.payment_transaction_repo.find_many(
            {"user_id": gerant_id},
            limit=100,
            sort=[("created_at", -1)]
        )
        
        # Get webhook events (paginated, max 100)
        webhook_events = []
        if subscription and subscription.get('stripe_subscription_id'):
            stripe_sub_id = subscription['stripe_subscription_id']
            stripe_customer_id = gerant.get('stripe_customer_id')
            
            # Build query for webhook events
            webhook_query = {
                "$or": [
                    {"data.object.id": stripe_sub_id},
                    {"data.object.subscription": stripe_sub_id}
                ]
            }
            if stripe_customer_id:
                webhook_query["$or"].append({"data.object.customer": stripe_customer_id})
            
            webhook_events = await self.stripe_event_repo.find_many(
                webhook_query,
                limit=100,
                sort=[("created_at", -1)]
            )
        
        # Count sellers by status (using repository count method)
        active_sellers_final = await self.user_repo.count({
            "gerant_id": gerant_id,
            "role": "seller",
            "status": "active"
        })
        suspended_sellers_final = await self.user_repo.count({
            "gerant_id": gerant_id,
            "role": "seller",
            "status": "suspended"
        })
        
        return {
            "gerant": gerant,
            "subscription": subscription,
            "workspace": workspace,
            "sellers": {
                "active": active_sellers_final,
                "suspended": suspended_sellers_final,
                "total": active_sellers_final + suspended_sellers_final
            },
            "transactions": transactions,
            "webhook_events": webhook_events
        }
    
    # ===== TRIAL MANAGEMENT =====
    
    async def get_gerants_trials(
        self,
        page: int = 1,
        size: int = 100
    ) -> Dict:
        """
        Get paginated list of gerants with trial information
        
        Args:
            page: Page number (1-based)
            size: Items per page (max 100)
        """
        if size > 100:
            size = 100
        
        skip = (page - 1) * size
        
        # Get paginated gerants
        gerants = await self.user_repo.admin_find_all_paginated(
            role="gerant",
            projection={"_id": 0, "password": 0},
            limit=size,
            skip=skip,
            sort=[("created_at", -1)]
        )
        
        total_gerants = await self.user_repo.admin_count_all(role="gerant")
        pages = (total_gerants + size - 1) // size
        
        result = []
        for gerant in gerants:
            gerant_id = gerant['id']
            
            # Count active sellers
            active_sellers_count = await self.user_repo.count({
                "gerant_id": gerant_id,
                "role": "seller",
                "status": "active"
            })
            
            # Get workspace (source of truth for trials)
            workspace = await self.workspace_repo.find_by_gerant(gerant_id)
            
            # Get subscription (fallback)
            subscription = await self.subscription_repo.find_by_user(gerant_id)
            
            has_subscription = False
            trial_end = None
            subscription_status = None
            
            # Priority to workspace for trial info
            if workspace:
                subscription_status = workspace.get('subscription_status', 'inactive')
                trial_end = workspace.get('trial_end')
                
                if subscription_status == 'trialing' and trial_end:
                    has_subscription = True
                elif subscription_status == 'active':
                    has_subscription = True
            elif subscription:
                subscription_status = subscription.get('status')
                has_subscription = subscription_status in ['active', 'trialing']
                trial_end = subscription.get('trial_end')
            
            # Calculate days left if in trial
            days_left = None
            if subscription_status == 'trialing' and trial_end:
                try:
                    if isinstance(trial_end, str):
                        trial_end_dt = datetime.fromisoformat(trial_end.replace('Z', '+00:00'))
                    else:
                        trial_end_dt = trial_end
                    
                    now = datetime.now(timezone.utc)
                    if trial_end_dt.tzinfo is None:
                        trial_end_dt = trial_end_dt.replace(tzinfo=timezone.utc)
                    
                    # Calculate difference in calendar days
                    trial_end_date = trial_end_dt.date()
                    now_date = now.date()
                    days_delta = (trial_end_date - now_date).days
                    days_left = max(0, days_delta)
                    
                    # If days_left is 0 but trial_end is in the future (same day), adjust to 1
                    if days_left == 0 and trial_end_dt >= now:
                        days_left = 1
                except Exception as e:
                    logger.warning(f"Error calculating days_left for gerant {gerant_id}: {e}")
            
            # Determine max sellers limit based on plan
            max_sellers = None
            if subscription_status == 'trialing':
                max_sellers = 15  # Trial limit
            elif subscription_status == 'active':
                if active_sellers_count >= 16:
                    max_sellers = None  # Unlimited for enterprise
                elif active_sellers_count >= 6:
                    max_sellers = 15  # Professional
                else:
                    max_sellers = 5  # Starter
            
            result.append({
                "id": gerant_id,
                "name": gerant.get('name', 'N/A'),
                "email": gerant['email'],
                "trial_end": trial_end,
                "active_sellers_count": active_sellers_count,
                "max_sellers": max_sellers,
                "days_left": days_left,
                "has_subscription": has_subscription,
                "subscription_status": subscription_status
            })
        
        # Sort by trial_end date (closest first)
        result.sort(key=lambda x: (
            x['trial_end'] is None,  # Those without trial last
            x['trial_end'] if x['trial_end'] else ''
        ))
        
        return {
            "gerants": result,
            "pagination": {
                "page": page,
                "size": size,
                "total": total_gerants,
                "pages": pages
            }
        }
    
    async def update_gerant_trial(
        self,
        gerant_id: str,
        trial_end_str: str,
        current_admin: Dict
    ) -> Dict:
        """
        Update gerant trial end date
        
        Args:
            gerant_id: Gérant ID
            trial_end_str: New trial end date (ISO format or YYYY-MM-DD)
            current_admin: Current admin user dict
        """
        # Validate gerant exists
        gerant = await self.user_repo.find_by_id(gerant_id, include_password=False)
        if not gerant or gerant.get('role') != 'gerant':
            raise ValueError("Gérant non trouvé")
        
        # Parse and validate date
        try:
            if isinstance(trial_end_str, str):
                # If YYYY-MM-DD format, add time to end of day
                if len(trial_end_str) == 10 and trial_end_str.count('-') == 2:
                    trial_end_str = f"{trial_end_str}T23:59:59.999Z"
                
                trial_end_str_normalized = trial_end_str.replace('Z', '+00:00')
                trial_end_date = datetime.fromisoformat(trial_end_str_normalized)
            else:
                trial_end_date = trial_end_str
            
            # Ensure UTC timezone
            if trial_end_date.tzinfo is None:
                trial_end_date = trial_end_date.replace(tzinfo=timezone.utc)
            trial_end = trial_end_date.isoformat()
        except (ValueError, AttributeError) as e:
            raise ValueError(f"Format de date invalide: {trial_end_str}")
        
        # Get workspace (source of truth)
        workspace = await self.workspace_repo.find_by_gerant(gerant_id)
        if not workspace:
            raise ValueError("Workspace non trouvé pour ce gérant")
        
        # Prolongation only: forbid shortening
        current_trial_end = workspace.get('trial_end')
        if current_trial_end:
            current_trial_dt = current_trial_end
            if isinstance(current_trial_end, str):
                current_trial_dt = datetime.fromisoformat(current_trial_end.replace('Z', '+00:00'))
            if current_trial_dt.tzinfo is None:
                current_trial_dt = current_trial_dt.replace(tzinfo=timezone.utc)
            
            if trial_end_date < current_trial_dt:
                raise ValueError("La nouvelle date doit prolonger l'essai")
        
        # Update workspace
        now = datetime.now(timezone.utc)
        update_data = {
            "trial_end": trial_end,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        # If new date is in future, ensure subscription_status is 'trialing' (unless already 'active')
        if trial_end_date > now:
            current_status = workspace.get('subscription_status', 'inactive')
            if current_status != 'active':
                update_data["subscription_status"] = "trialing"
        
        await self.workspace_repo.update_one(
            {"gerant_id": gerant_id},
            {"$set": update_data}
        )
        workspace_id = workspace.get("id")
        if workspace_id:
            from core.cache import invalidate_workspace_cache
            await invalidate_workspace_cache(workspace_id)
        
        # Update subscription if exists (for compatibility)
        subscription = await self.subscription_repo.find_by_user(gerant_id)
        if subscription:
            subscription_update = {
                "trial_end": trial_end,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
            if trial_end_date > now:
                current_sub_status = subscription.get('status', 'inactive')
                if current_sub_status != 'active':
                    subscription_update["status"] = "trialing"
            
            await self.subscription_repo.update_by_user(gerant_id, subscription_update)
        
        # Log admin action
        await self.log_admin_action(
            admin_id=current_admin.get('id'),
            admin_email=current_admin.get('email'),
            admin_name=current_admin.get('name'),
            action="update_gerant_trial",
            gerant_id=gerant_id,
            details={
                "gerant_email": gerant.get('email'),
                "trial_end": trial_end
            }
        )
        
        return {
            "success": True,
            "message": "Période d'essai mise à jour avec succès",
            "trial_end": trial_end
        }
    
    # ===== AI CONVERSATIONS =====
    
    async def get_ai_conversations(
        self,
        admin_email: str,
        limit: int = 20,
        page: int = 1
    ) -> Dict:
        """
        Get paginated AI conversations for admin
        
        Args:
            admin_email: Admin email
            limit: Items per page (max 100)
            page: Page number (1-based)
        """
        if limit > 100:
            limit = 100
        
        skip = (page - 1) * limit
        
        # Get conversations from last 7 days
        since = datetime.now(timezone.utc) - timedelta(days=7)
        
        conversations = await self.ai_conversation_repo.find_many(
            {
                "admin_email": admin_email,
                "created_at": {"$gte": since.isoformat()}
            },
            limit=limit,
            skip=skip,
            sort=[("updated_at", -1)]
        )
        
        total = await self.ai_conversation_repo.count({
            "admin_email": admin_email,
            "created_at": {"$gte": since.isoformat()}
        })
        pages = (total + limit - 1) // limit
        
        return {
            "conversations": conversations,
            "total": total,
            "page": page,
            "pages": pages
        }
    
    async def get_conversation_messages(
        self,
        conversation_id: str,
        admin_email: str,
        page: int = 1,
        size: int = 100
    ) -> Dict:
        """
        Get messages for a specific conversation
        
        Args:
            conversation_id: Conversation ID
            admin_email: Admin email (for verification)
            page: Page number (1-based)
            size: Items per page (max 100)
        """
        if size > 100:
            size = 100
        
        # Verify conversation belongs to admin
        conversation = await self.ai_conversation_repo.find_one({
            "id": conversation_id,
            "admin_email": admin_email
        })
        
        if not conversation:
            raise ValueError("Conversation non trouvée")
        
        skip = (page - 1) * size
        
        # Get messages (paginated)
        messages = await self.ai_message_repo.find_many(
            {"conversation_id": conversation_id},
            limit=size,
            skip=skip,
            sort=[("timestamp", 1)]
        )
        
        total = await self.ai_message_repo.count({"conversation_id": conversation_id})
        pages = (total + size - 1) // size
        
        return {
            "conversation": conversation,
            "messages": messages,
            "total": total,
            "page": page,
            "pages": pages
        }
    
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
    
    # ===== AI ASSISTANT =====
    
    async def get_app_context_for_ai(self) -> Dict:
        """
        Gather relevant application context for AI assistant
        Uses repositories only, no direct DB access
        """
        try:
            # Get recent errors (last 24h) - paginated, max 10
            last_24h = datetime.now(timezone.utc) - timedelta(hours=24)
            recent_errors = await self.system_log_repo.find_recent_logs(
                limit=10,
                filters={"level": "error", "timestamp": {"$gte": last_24h.isoformat()}}
            )
            
            # Get recent warnings - paginated, max 5
            recent_warnings = await self.system_log_repo.find_recent_logs(
                limit=5,
                filters={"level": "warning", "timestamp": {"$gte": last_24h.isoformat()}}
            )
            
            # Get recent admin actions (last 7 days) - paginated, max 20
            last_7d = datetime.now(timezone.utc) - timedelta(days=7)
            recent_actions = await self.admin_log_repo.find_recent_logs(
                hours=168,  # 7 days
                limit=20
            )
            
            # Get platform stats using repositories
            total_workspaces = await self.workspace_repo.count({})
            active_workspaces = await self.workspace_repo.count({"status": "active"})
            suspended_workspaces = await self.workspace_repo.count({"status": "suspended"})
            total_users = await self.user_repo.admin_count_all()
            
            # Get health status
            errors_24h = len(recent_errors)
            health_status = "healthy" if errors_24h < 10 else "warning" if errors_24h < 50 else "critical"
            
            context = {
                "platform_stats": {
                    "total_workspaces": total_workspaces,
                    "active_workspaces": active_workspaces,
                    "suspended_workspaces": suspended_workspaces,
                    "total_users": total_users,
                    "health_status": health_status
                },
                "recent_errors": recent_errors[:5],  # Top 5 errors
                "recent_warnings": recent_warnings[:3],  # Top 3 warnings
                "recent_actions": recent_actions[:10],  # Last 10 admin actions
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
            
            return context
        except Exception as e:
            logger.error(f"Error gathering AI context: {str(e)}")
            return {}
    
    async def chat_with_ai_assistant(
        self,
        message: str,
        conversation_id: Optional[str],
        current_admin: Dict
    ) -> Dict:
        """
        Chat with AI assistant for troubleshooting and support
        
        Args:
            message: User message
            conversation_id: Optional conversation ID (for continuing conversation)
            current_admin: Current admin user dict
        """
        import json
        from services.ai_service import AIService
        
        # Get or create conversation
        if not conversation_id:
            # Create new conversation
            conversation_id = str(uuid.uuid4())
            conversation = {
                "id": conversation_id,
                "admin_email": current_admin['email'],
                "admin_name": current_admin.get('name', 'Admin'),
                "title": message[:50] + "..." if len(message) > 50 else message,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
            await self.ai_conversation_repo.insert_one(conversation)
        else:
            # Update existing conversation
            await self.ai_conversation_repo.update_one(
                {"id": conversation_id},
                {"$set": {"updated_at": datetime.now(timezone.utc).isoformat()}}
            )
        
        # Get app context
        app_context = await self.get_app_context_for_ai()
        
        # Get conversation history (paginated, max 100)
        history = await self.ai_message_repo.find_many(
            {"conversation_id": conversation_id},
            limit=100,
            sort=[("timestamp", 1)]
        )
        
        # Build system prompt
        system_prompt = f"""Tu es un assistant IA expert pour le SuperAdmin de Retail Performer AI, une plateforme SaaS de coaching commercial.

CONTEXTE DE L'APPLICATION:
{json.dumps(app_context, indent=2, ensure_ascii=False)}

TES CAPACITÉS:
1. Analyser les logs système et audit pour diagnostiquer les problèmes
2. Fournir des recommandations techniques précises
3. Suggérer des actions concrètes (avec validation admin requise)
4. Expliquer les fonctionnalités et l'architecture
5. Identifier les patterns d'erreurs et tendances

ACTIONS DISPONIBLES (toujours demander confirmation):
- reactivate_workspace: Réactiver un workspace suspendu
- change_workspace_plan: Changer le plan d'un workspace
- suspend_workspace: Suspendre un workspace problématique
- reset_ai_credits: Réinitialiser les crédits IA d'un workspace

STYLE DE RÉPONSE:
- Concis et technique
- Utilise le format Markdown pour une meilleure lisibilité :
  * Titres avec ## ou ### pour les sections
  * Listes à puces (-) ou numérotées (1.)
  * **Gras** pour les points importants
  * `code` pour les valeurs techniques
  * Sauts de ligne entre sections
- Utilise des emojis pour la lisibilité (🔍 analyse, ⚠️ alertes, ✅ solutions, 📊 stats)
- Structure tes réponses avec des sections claires et aérées
- Propose des actions concrètes quand nécessaire

Réponds toujours en français avec formatage Markdown."""

        # Use OpenAI via AIService
        ai_service = AIService()
        
        if ai_service.available:
            # Build user prompt with conversation history
            user_prompt_parts = []
            
            # Add conversation history (last 10 messages)
            for msg in history[-10:]:
                role = msg.get("role", "user")
                content = msg.get("content", "")
                if role == "user":
                    user_prompt_parts.append(f"Utilisateur: {content}")
                elif role == "assistant":
                    user_prompt_parts.append(f"Assistant: {content}")
            
            # Add current user message
            user_prompt_parts.append(f"Utilisateur: {message}")
            user_prompt = "\n\n".join(user_prompt_parts)
            
            # Get AI response using OpenAI
            ai_response = await ai_service._send_message(
                system_message=system_prompt,
                user_prompt=user_prompt,
                model="gpt-4o-mini",  # Use mini for cost efficiency
                temperature=0.7
            )
            
            if not ai_response:
                raise Exception("OpenAI service returned no response")
        else:
            # Fallback: Simple response if OpenAI not available
            logger.warning("OpenAI not available, using fallback response")
            ai_response = f"""🔍 **Analyse de votre demande**

Je comprends votre question : "{message}"

⚠️ **Note** : Le système OpenAI n'est pas configuré actuellement. Pour une assistance complète, veuillez configurer la clé API `OPENAI_API_KEY`.

**Contexte de la plateforme** :
- Workspaces actifs : {app_context.get('platform_stats', {}).get('active_workspaces', 0)}
- Erreurs récentes (24h) : {len(app_context.get('recent_errors', []))}
- Statut de santé : {app_context.get('platform_stats', {}).get('health_status', 'unknown')}

Pour obtenir de l'aide, vous pouvez :
1. Consulter les logs système via `/superadmin/system-logs`
2. Vérifier les actions admin récentes via `/superadmin/logs`
3. Examiner les workspaces via `/superadmin/workspaces`"""
        
        # Save user message
        user_msg = {
            "conversation_id": conversation_id,
            "role": "user",
            "content": message,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "context": app_context
        }
        await self.ai_message_repo.insert_one(user_msg)
        
        # Save assistant message
        assistant_msg = {
            "conversation_id": conversation_id,
            "role": "assistant",
            "content": ai_response,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        await self.ai_message_repo.insert_one(assistant_msg)
        
        # Log admin action
        await self.log_admin_action(
            admin_id=current_admin.get('id'),
            admin_email=current_admin.get('email'),
            admin_name=current_admin.get('name'),
            action="ai_assistant_query",
            details={
                "conversation_id": conversation_id,
                "query_length": len(message),
                "response_length": len(ai_response)
            }
        )
        
        return {
            "conversation_id": conversation_id,
            "message": ai_response,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "context_used": {
                "errors_count": len(app_context.get('recent_errors', [])),
                "health_status": app_context.get('platform_stats', {}).get('health_status', 'unknown')
            }
        }

