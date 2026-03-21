"""Workspaces mixin for AdminService."""
import logging
import stripe
from typing import Dict, List, Optional
from datetime import datetime, timezone

from models.pagination import PaginatedResponse

logger = logging.getLogger(__name__)


class WorkspacesMixin:

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

        # Cancel Stripe subscription when deleting a workspace
        stripe_canceled = False
        if status == 'deleted':
            subscription = await self.subscription_repo.find_by_workspace(workspace_id)
            stripe_sub_id = subscription.get('stripe_subscription_id') if subscription else None
            if stripe_sub_id:
                try:
                    stripe.Subscription.delete(stripe_sub_id)
                    stripe_canceled = True
                    await self.subscription_repo.update_by_workspace(
                        workspace_id,
                        {
                            "status": "canceled",
                            "subscription_status": "canceled",
                            "updated_at": datetime.now(timezone.utc).isoformat(),
                        }
                    )
                    logger.info("Stripe subscription %s canceled on workspace deletion %s", stripe_sub_id, workspace_id)
                except stripe.error.InvalidRequestError as e:
                    # Already canceled or not found — not a blocking error
                    logger.warning("Stripe subscription %s could not be canceled (may already be canceled): %s", stripe_sub_id, e)
                except Exception as e:
                    logger.error("Unexpected error canceling Stripe subscription %s: %s", stripe_sub_id, e)

        # Update workspace
        updated = await self.workspace_repo.update_one(
            {"id": workspace_id},
            {"$set": {
                "status": status,
                "subscription_status": "canceled" if status == 'deleted' else workspace.get('subscription_status'),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }}
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

        # Cancel Stripe subscriptions when bulk-deleting workspaces
        if status == 'deleted':
            for workspace_id in workspace_ids:
                subscription = await self.subscription_repo.find_by_workspace(workspace_id)
                stripe_sub_id = subscription.get('stripe_subscription_id') if subscription else None
                if stripe_sub_id:
                    try:
                        stripe.Subscription.delete(stripe_sub_id)
                        await self.subscription_repo.update_by_workspace(
                            workspace_id,
                            {
                                "status": "canceled",
                                "subscription_status": "canceled",
                                "updated_at": datetime.now(timezone.utc).isoformat(),
                            }
                        )
                        logger.info("Stripe subscription %s canceled on bulk workspace deletion %s", stripe_sub_id, workspace_id)
                    except stripe.error.InvalidRequestError as e:
                        logger.warning("Stripe subscription %s could not be canceled (may already be canceled): %s", stripe_sub_id, e)
                    except Exception as e:
                        logger.error("Unexpected error canceling Stripe subscription %s: %s", stripe_sub_id, e)

        # Update all workspaces
        workspace_set = {"status": status, "updated_at": datetime.now(timezone.utc).isoformat()}
        if status == 'deleted':
            workspace_set["subscription_status"] = "canceled"
        updated_count = await self.workspace_repo.update_many(
            {"id": {"$in": workspace_ids}},
            {"$set": workspace_set}
        )

        for workspace_id in workspace_ids:
            try:
                from core.cache import invalidate_workspace_cache
                await invalidate_workspace_cache(workspace_id)
            except Exception:
                pass

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
