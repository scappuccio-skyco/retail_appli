"""
Admin Service
Business logic for SuperAdmin operations
"""
from typing import List, Dict, Optional
from datetime import datetime, timezone, timedelta
from repositories.admin_repository import AdminRepository


class AdminService:
    """Service for SuperAdmin business logic"""
    
    def __init__(self, admin_repo: AdminRepository):
        self.admin_repo = admin_repo
    
    async def get_workspaces_with_details(self, include_deleted: bool = False) -> List[Dict]:
        """
        Get all workspaces with enriched details
        - Gérant info
        - Stores count
        - Managers and sellers count
        - Each store with its manager and sellers
        - Subscription with guaranteed plan field
        
        Args:
            include_deleted: If True, includes deleted/inactive workspaces
        """
        workspaces = await self.admin_repo.get_all_workspaces(include_deleted=include_deleted)
        
        for workspace in workspaces:
            workspace_id = workspace.get('id')
            gerant_id = workspace.get('gerant_id')
            
            # CRITICAL: Ensure workspace has a status field with default 'active'
            # Frontend displays "Supprimé" if status is not 'active' or 'suspended'
            # Only set default if status is missing, None, or empty string
            # If status is explicitly 'deleted', keep it as is
            current_status = workspace.get('status')
            if not current_status or current_status == '' or current_status is None:
                workspace['status'] = 'active'
            
            # Get gérant info
            if gerant_id:
                gerant = await self.admin_repo.get_gerant_by_id(gerant_id)
                workspace['gerant'] = gerant
            else:
                workspace['gerant'] = None
            
            # Get stores for this workspace - try both gerant_id and workspace_id
            stores = []
            if gerant_id:
                stores = await self.admin_repo.get_stores_by_gerant(gerant_id)
            
            # If no stores found via gerant_id, try workspace_id
            if not stores and workspace_id:
                stores = await self.admin_repo.get_stores_by_workspace(workspace_id)
            
            # Enrich each store with its manager and sellers
            total_managers = 0
            total_sellers = 0
            
            for store in stores:
                # Get manager for this store
                manager = await self.admin_repo.get_manager_for_store(store.get('id'))
                store['manager'] = manager
                if manager:
                    total_managers += 1
                
                # Get sellers for this store
                sellers = await self.admin_repo.get_sellers_for_store(store.get('id'))
                store['sellers'] = sellers
                store['sellers_count'] = len([s for s in sellers if s.get('status') == 'active'])
                store['total_sellers'] = len(sellers)
                total_sellers += store['sellers_count']
                
                # Ensure store has a status
                if not store.get('status'):
                    store['status'] = 'active' if store.get('active', True) else 'inactive'
            
            workspace['stores'] = stores
            workspace['stores_count'] = len(stores)
            workspace['managers_count'] = total_managers
            workspace['sellers_count'] = total_sellers
            
            # Also get total users directly from users collection for accuracy
            if gerant_id:
                total_workspace_sellers = await self.admin_repo.count_users_by_criteria({
                    "gerant_id": gerant_id,
                    "role": "seller",
                    "status": "active"
                })
            else:
                total_workspace_sellers = total_sellers
            workspace['total_sellers'] = total_workspace_sellers
            
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
        
        # ⚠️ IMPORTANT: Ne pas créer de logs mockés
        # Les logs doivent être créés automatiquement par l'application lors d'événements réels
        # Si aucun log n'est trouvé, retourner une liste vide plutôt que des données fictives
        # Cela évite les incohérences avec l'IA assistant qui analyse les logs
        
        return {
            "logs": normalized_logs,
            "total": len(normalized_logs),
            "period_hours": hours,
            "timestamp": now.isoformat(),
            "available_actions": sorted(list(all_actions)),
            "available_admins": all_admins
        }

    async def get_admin_audit_logs(
        self,
        hours: int = 24,
        limit: int = 100,
        action: Optional[str] = None,
        admin_emails: Optional[List[str]] = None
    ) -> Dict:
        """
        Get admin audit logs filtered by time window
        """
        now = datetime.now(timezone.utc)
        time_threshold = now - timedelta(hours=hours)

        logs = await self.admin_repo.get_admin_logs(
            time_threshold=time_threshold,
            limit=limit,
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
        admins = await self.admin_repo.get_admins_from_logs(time_threshold)

        # Normalize admin list for UI
        available_admins = []
        seen_emails = set()
        for admin in admins:
            email = admin.get('email')
            if not email or email in seen_emails:
                continue
            seen_emails.add(email)
            available_admins.append({
                "email": email,
                "name": admin.get('name') or email
            })

        return {
            "logs": normalized_logs,
            "total": len(normalized_logs),
            "period_hours": hours,
            "timestamp": now.isoformat(),
            "available_actions": sorted([a for a in actions if a]),
            "available_admins": available_admins
        }

