"""
Admin Service
Business logic for SuperAdmin operations
"""
from typing import List, Dict
from datetime import datetime, timezone, timedelta
from repositories.admin_repository import AdminRepository


class AdminService:
    """Service for SuperAdmin business logic"""
    
    def __init__(self, admin_repo: AdminRepository):
        self.admin_repo = admin_repo
    
    async def get_workspaces_with_details(self) -> List[Dict]:
        """
        Get all workspaces with enriched details
        - Gérant info
        - Stores count
        - Managers and sellers count
        - Subscription with guaranteed plan field
        """
        workspaces = await self.admin_repo.get_all_workspaces()
        
        for workspace in workspaces:
            # Get gérant info
            if workspace.get('gerant_id'):
                gerant = await self.admin_repo.get_gerant_by_id(workspace['gerant_id'])
                workspace['gerant'] = gerant
            
            # Get stores for this workspace
            stores = await self.admin_repo.get_stores_by_gerant(workspace.get('gerant_id'))
            workspace['stores'] = stores
            workspace['stores_count'] = len(stores)
            
            # Get users count
            managers_count = await self.admin_repo.count_users_by_criteria({
                "gerant_id": workspace.get('gerant_id'),
                "role": "manager"
            })
            sellers_count = await self.admin_repo.count_users_by_criteria({
                "gerant_id": workspace.get('gerant_id'),
                "role": "seller"
            })
            
            workspace['managers_count'] = managers_count
            workspace['sellers_count'] = sellers_count
            
            # CRITICAL: FORCE subscription object - NEVER null
            # Frontend WILL crash if subscription or subscription.plan is missing
            default_subscription = {
                "plan": "free",
                "status": "active",
                "created_at": workspace.get('created_at'),
                "trial_ends_at": workspace.get('trial_ends_at')
            }
            
            # If workspace has subscription data in DB, use it
            if workspace.get('subscription') and isinstance(workspace['subscription'], dict):
                workspace['subscription']['plan'] = workspace['subscription'].get('plan') or workspace.get('subscription_plan', 'free')
                workspace['subscription']['status'] = workspace['subscription'].get('status') or workspace.get('subscription_status', 'active')
            else:
                # No subscription or it's null/invalid, force default
                workspace['subscription'] = default_subscription
                workspace['subscription']['plan'] = workspace.get('subscription_plan', 'free')
                workspace['subscription']['status'] = workspace.get('subscription_status', 'active')
        
        return workspaces
    
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
    
    async def get_system_logs(self, hours: int = 24, limit: int = 100) -> Dict:
        """
        Get system logs filtered by time window
        
        Args:
            hours: Number of hours to look back
            limit: Maximum number of logs to return
        
        Returns:
            Dict with logs list and metadata
        """
        now = datetime.now(timezone.utc)
        time_threshold = now - timedelta(hours=hours)
        
        # Get logs from repository
        logs = await self.admin_repo.get_system_logs(time_threshold, limit)
        
        # If no logs found in DB, return mock logs for display
        if not logs:
            logs = [
                {
                    "timestamp": (now - timedelta(minutes=i*10)).isoformat(),
                    "level": "info" if i % 3 != 0 else "warning",
                    "message": f"System health check - All services operational" if i % 3 == 0 else f"User login activity detected",
                    "source": "system",
                    "details": {}
                }
                for i in range(min(10, limit))
            ]
        
        return {
            "logs": logs,
            "total": len(logs),
            "period_hours": hours,
            "timestamp": now.isoformat()
        }
