"""
Manager Service
Business logic for manager operations (team management, KPIs, diagnostics)
"""
from typing import Dict, List, Optional, Any
from datetime import datetime, timezone, timedelta
import logging

from repositories.user_repository import UserRepository
from repositories.store_repository import StoreRepository
from repositories.invitation_repository import InvitationRepository
from repositories.kpi_config_repository import KPIConfigRepository
from repositories.team_bilan_repository import TeamBilanRepository
from repositories.kpi_repository import KPIRepository, ManagerKPIRepository, StoreKPIRepository
from repositories.objective_repository import ObjectiveRepository
from repositories.challenge_repository import ChallengeRepository
from repositories.manager_diagnostic_repository import ManagerDiagnosticRepository
from repositories.enterprise_repository import APIKeyRepository
from repositories.morning_brief_repository import MorningBriefRepository
from repositories.diagnostic_repository import DiagnosticRepository
from repositories.debrief_repository import DebriefRepository
from repositories.team_analysis_repository import TeamAnalysisRepository
from repositories.relationship_consultation_repository import RelationshipConsultationRepository

logger = logging.getLogger(__name__)


class ManagerService:
    """Service for manager operations. Phase 0: repositories + notification_service only, no self.db."""

    def __init__(
        self,
        user_repo: UserRepository,
        store_repo: StoreRepository,
        invitation_repo: InvitationRepository,
        kpi_config_repo: KPIConfigRepository,
        team_bilan_repo: TeamBilanRepository,
        kpi_repo: KPIRepository,
        manager_kpi_repo: ManagerKPIRepository,
        objective_repo: ObjectiveRepository,
        challenge_repo: ChallengeRepository,
        manager_diagnostic_repo: ManagerDiagnosticRepository,
        api_key_repo: APIKeyRepository,
        notification_service,
        store_kpi_repo: Optional[StoreKPIRepository] = None,
        morning_brief_repo: Optional[MorningBriefRepository] = None,
        diagnostic_repo: Optional[DiagnosticRepository] = None,
        debrief_repo: Optional[DebriefRepository] = None,
        team_analysis_repo: Optional[TeamAnalysisRepository] = None,
        relationship_consultation_repo: Optional[RelationshipConsultationRepository] = None,
    ):
        self.user_repo = user_repo
        self.store_repo = store_repo
        self.invitation_repo = invitation_repo
        self.kpi_config_repo = kpi_config_repo
        self.team_bilan_repo = team_bilan_repo
        self.kpi_repo = kpi_repo
        self.manager_kpi_repo = manager_kpi_repo
        self.objective_repo = objective_repo
        self.challenge_repo = challenge_repo
        self.manager_diagnostic_repo = manager_diagnostic_repo
        self.api_key_repo = api_key_repo
        self.notification_service = notification_service
        self.store_kpi_repo = store_kpi_repo
        self.morning_brief_repo = morning_brief_repo
        self.diagnostic_repo = diagnostic_repo
        self.debrief_repo = debrief_repo
        self.team_analysis_repo = team_analysis_repo
        self.relationship_consultation_repo = relationship_consultation_repo
    
    async def get_sellers(self, manager_id: str, store_id: str) -> List[Dict]:
        """
        Get all sellers for a store
        
        Note: Uses store_id as primary filter. 
        manager_id is used for logging/audit but not required for filtering
        since a gérant can also query sellers.
        
        Returns only active sellers (status is 'active' or null/undefined, not 'suspended' or 'deleted').
        """
        # Query: sellers with store_id, role=seller, and status NOT in ['deleted', 'suspended']
        # This includes: status='active', status=None, or status field doesn't exist
        sellers = await self.user_repo.find_many(
            {
                "store_id": store_id,
                "role": "seller",
                "$or": [
                    {"status": {"$exists": False}},  # No status field (defaults to active)
                    {"status": None},  # Explicitly null
                    {"status": "active"}  # Explicitly active
                ]
            },
            {"_id": 0, "password": 0}
        )
        # Filter out any sellers that might have been included with 'suspended' or 'deleted' status
        # (though the query above should already exclude them)
        active_sellers = [s for s in sellers if s.get('status') not in ['deleted', 'suspended']]
        return active_sellers
    
    async def get_invitations(self, manager_id: str) -> List[Dict]:
        """Get pending invitations for manager"""
        invitations = await self.invitation_repo.find_by_manager(
            manager_id, status="pending", projection={"_id": 0}, limit=100
        )
        return invitations
    
    async def get_sync_mode(self, store_id: str) -> Dict:
        """Get sync mode configuration for store"""
        store = await self.store_repo.find_one({"id": store_id}, {"_id": 0})
        
        if not store:
            return {
                "sync_mode": "manual",
                "external_sync_enabled": False,
                "is_enterprise": False,
                "can_edit_kpi": True,
                "can_edit_objectives": True
            }
        
        # Ensure sync_mode is never null - default to "manual"
        sync_mode = store.get("sync_mode") or "manual"
        
        return {
            "sync_mode": sync_mode,
            "external_sync_enabled": sync_mode == "api_sync",
            "is_enterprise": sync_mode in ["api_sync", "scim_sync"],
            "can_edit_kpi": sync_mode == "manual",
            "can_edit_objectives": True  # Objectives can always be edited
        }
    
    async def get_kpi_config(self, store_id: str) -> Dict:
        """Get KPI configuration for store"""
        config = await self.kpi_config_repo.find_one(
            {"store_id": store_id},
            {"_id": 0}
        )
        
        if not config:
            # Return default config
            return {
                "store_id": store_id,
                "enabled_kpis": ["ca_journalier", "nb_ventes", "nb_articles", "panier_moyen"],
                "required_kpis": ["ca_journalier", "nb_ventes"],
                "saisie_enabled": True
            }
        
        return config
    
    async def get_team_bilans_all(self, manager_id: str, store_id: str) -> List[Dict]:
        """Get all team bilans for manager"""
        bilans = await self.team_bilan_repo.find_by_manager(
            manager_id, store_id, projection={"_id": 0}, limit=100, sort=[("created_at", -1)]
        )
        
        return bilans
    
    async def get_store_kpi_stats(
        self,
        store_id: str,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None
    ) -> Dict:
        """Get aggregated KPI stats for store"""
        from datetime import timedelta
        
        # Default to current month if no dates provided
        if not start_date:
            today = datetime.now(timezone.utc)
            start_date = today.replace(day=1).strftime('%Y-%m-%d')
        
        if not end_date:
            end_date = datetime.now(timezone.utc).strftime('%Y-%m-%d')
        
        # Aggregate seller KPIs
        seller_pipeline = [
            {"$match": {
                "store_id": store_id,
                "date": {"$gte": start_date, "$lte": end_date}
            }},
            {"$group": {
                "_id": None,
                "total_ca": {"$sum": {"$ifNull": ["$seller_ca", {"$ifNull": ["$ca_journalier", 0]}]}},
                "total_ventes": {"$sum": {"$ifNull": ["$nb_ventes", 0]}},
                "total_articles": {"$sum": {"$ifNull": ["$nb_articles", 0]}}
            }}
        ]
        
        seller_stats = await self.kpi_repo.aggregate(seller_pipeline, max_results=1)
        
        # Aggregate manager KPIs
        manager_pipeline = [
            {"$match": {
                "store_id": store_id,
                "date": {"$gte": start_date, "$lte": end_date}
            }},
            {"$group": {
                "_id": None,
                "total_ca": {"$sum": {"$ifNull": ["$ca_journalier", 0]}},
                "total_ventes": {"$sum": {"$ifNull": ["$nb_ventes", 0]}},
                "total_articles": {"$sum": {"$ifNull": ["$nb_articles", 0]}}
            }}
        ]
        
        manager_stats = await self.manager_kpi_repo.aggregate(manager_pipeline, max_results=1)
        
        seller_ca = seller_stats[0].get("total_ca", 0) if seller_stats else 0
        seller_ventes = seller_stats[0].get("total_ventes", 0) if seller_stats else 0
        seller_articles = seller_stats[0].get("total_articles", 0) if seller_stats else 0
        
        manager_ca = manager_stats[0].get("total_ca", 0) if manager_stats else 0
        manager_ventes = manager_stats[0].get("total_ventes", 0) if manager_stats else 0
        manager_articles = manager_stats[0].get("total_articles", 0) if manager_stats else 0
        
        total_ca = seller_ca + manager_ca
        total_ventes = seller_ventes + manager_ventes
        total_articles = seller_articles + manager_articles
        
        return {
            "store_id": store_id,
            "period": {
                "start": start_date,
                "end": end_date
            },
            "total_ca": total_ca,
            "total_ventes": total_ventes,
            "total_articles": total_articles,
            "panier_moyen": (total_ca / total_ventes) if total_ventes > 0 else 0,
            "uvc": (total_articles / total_ventes) if total_ventes > 0 else 0,
            "seller_stats": {
                "ca": seller_ca,
                "ventes": seller_ventes,
                "articles": seller_articles
            },
            "manager_stats": {
                "ca": manager_ca,
                "ventes": manager_ventes,
                "articles": manager_articles
            }
        }
    
    async def get_active_objectives(
        self,
        manager_id: str,
        store_id: str,
    ) -> List[Dict]:
        """
        Get active objectives for manager's team
        
        ✅ ÉTAPE C : Utilise NotificationService injecté (découplage)
        """
        # Phase 0: use injected notification_service
        today = datetime.now(timezone.utc).strftime('%Y-%m-%d')
        # Get all objectives for the store, then filter
        all_objectives = await self.objective_repo.find_by_store(
            store_id, projection={"_id": 0}, limit=100
        )
        # Filter by status and period
        objectives = [
            obj for obj in all_objectives
            if (obj.get("status") == "active" and obj.get("period_end", "") >= today)
            or obj.get("status") == "achieved"
        ]
        
        # Add achievement notification flags via NotificationService
        await self.notification_service.add_achievement_notification_flag(objectives, manager_id, "objective")
        
        return objectives
    
    async def get_active_challenges(
        self,
        manager_id: str,
        store_id: str,
    ) -> List[Dict]:
        """
        Get active challenges for manager's team
        
        ✅ ÉTAPE C : Utilise NotificationService injecté (découplage)
        """
        # Phase 0: use injected notification_service
        # Get all challenges for the store, then filter
        all_challenges = await self.challenge_repo.find_by_store(
            store_id, projection={"_id": 0}, limit=100
        )
        today = datetime.now(timezone.utc).strftime('%Y-%m-%d')
        # Filter by status and end_date
        challenges = [
            c for c in all_challenges
            if c.get("status") in ["active", "completed"]
            and c.get("end_date", "") >= today
        ]
        
        # Add achievement notification flags via NotificationService
        await self.notification_service.add_achievement_notification_flag(challenges, manager_id, "challenge")
        
        return challenges


class DiagnosticService:
    """Service for diagnostic operations. Phase 0: repository only, no self.db."""

    def __init__(self, manager_diagnostic_repo: ManagerDiagnosticRepository):
        self.manager_diagnostic_repo = manager_diagnostic_repo

    async def get_manager_diagnostic(self, manager_id: str) -> Optional[Dict]:
        """Get manager's DISC diagnostic profile"""
        diagnostic = await self.manager_diagnostic_repo.find_latest_by_manager(
            manager_id,
            projection={"_id": 0}
        )
        
        return diagnostic


class APIKeyService:
    """Service for API key management operations. Phase 0: repository only, no self.db."""

    def __init__(self, api_key_repo: APIKeyRepository):
        self.api_key_repo = api_key_repo

    async def create_api_key(
        self,
        user_id: str,
        store_id: Optional[str],
        gerant_id: Optional[str],
        name: str,
        permissions: List[str],
        store_ids: Optional[List[str]] = None,
        expires_days: Optional[int] = None
    ) -> Dict:
        """
        Create a new API key
        
        Args:
            user_id: User ID owning the key
            store_id: Store ID (for manager)
            gerant_id: Gérant ID (if applicable)
            name: Friendly name for the key
            permissions: List of permissions
            store_ids: Optional list of specific store IDs
            expires_days: Optional expiration in days
            
        Returns:
            Dict with key details (including the key itself, shown only once)
        """
        from uuid import uuid4
        import secrets
        from core.security import get_password_hash
        
        # Generate secure API key
        random_part = secrets.token_urlsafe(32)
        api_key = f"sk_live_{random_part}"
        
        # Hash the key for storage (same system as IntegrationService)
        hashed_key = get_password_hash(api_key)
        
        # Calculate expiration
        expires_at = None
        if expires_days:
            expires_at = datetime.now(timezone.utc).timestamp() + (expires_days * 86400)
        
        # Create record (using same format as IntegrationService for compatibility)
        key_id = str(uuid4())
        key_record = {
            "id": key_id,
            "user_id": user_id,
            "store_id": store_id,
            "gerant_id": gerant_id,
            "key_hash": hashed_key,  # Store hashed key instead of plain text
            "key_prefix": api_key[:12],  # Store prefix for lookup
            "name": name,
            "permissions": permissions,
            "store_ids": store_ids,
            "active": True,
            "created_at": datetime.now(timezone.utc),
            "last_used_at": None,
            "expires_at": expires_at
        }
        
        await self.api_key_repo.create_key(key_record, user_id)
        
        # Convert created_at to ISO string for JSON serialization
        created_at_iso = key_record["created_at"].isoformat() if isinstance(key_record["created_at"], datetime) else key_record["created_at"]
        
        # Convert expires_at timestamp to ISO string if it exists
        expires_at_iso = None
        if expires_at:
            if isinstance(expires_at, (int, float)):
                expires_at_iso = datetime.fromtimestamp(expires_at, tz=timezone.utc).isoformat()
            elif isinstance(expires_at, datetime):
                expires_at_iso = expires_at.isoformat()
            else:
                expires_at_iso = expires_at
        
        return {
            "id": key_id,
            "name": name,
            "key": api_key,  # Only shown at creation (for frontend compatibility)
            "api_key": api_key,  # Also return as api_key for consistency
            "permissions": permissions,
            "active": True,
            "created_at": created_at_iso,
            "last_used_at": None,
            "expires_at": expires_at_iso,
            "store_ids": store_ids
        }
    
    async def list_api_keys(self, user_id: str) -> Dict:
        """
        List all API keys for a user (without the actual key value)
        
        Args:
            user_id: User ID
            
        Returns:
            Dict with api_keys list
        """
        keys = await self.api_key_repo.find_by_user(
            user_id,
            projection={"_id": 0, "key": 0}  # Don't return _id or actual key
        )
        
        return {"api_keys": keys}
    
    async def deactivate_api_key(self, key_id: str, user_id: str) -> Dict:
        """
        Deactivate an API key (soft delete)
        
        Args:
            key_id: API key ID
            user_id: User ID for ownership verification
            
        Returns:
            Success message
            
        Raises:
            ValueError: If key not found
        """
        # Verify ownership
        key = await self.api_key_repo.find_by_id(key_id, user_id=user_id)
        if not key:
            raise ValueError("API key not found")
        
        # Deactivate instead of delete (for audit)
        await self.api_key_repo.update_key(
            key_id,
            {"active": False, "deleted_at": datetime.now(timezone.utc).isoformat()},
            user_id=user_id
        )
        
        return {"message": "API key deactivated successfully"}
    
    async def regenerate_api_key(self, key_id: str, user_id: str) -> Dict:
        """
        Regenerate an API key (creates new key, deactivates old)
        
        Args:
            key_id: API key ID
            user_id: User ID for ownership verification
            
        Returns:
            New key details
            
        Raises:
            ValueError: If key not found
        """
        from uuid import uuid4
        import secrets
        
        # Find old key
        old_key = await self.api_key_repo.find_by_id(key_id, user_id=user_id)
        if not old_key:
            raise ValueError("API key not found")
        
        # Deactivate old key
        await self.api_key_repo.update_key(
            key_id,
            {"active": False, "regenerated_at": datetime.now(timezone.utc).isoformat()},
            user_id=user_id
        )
        
        # Generate new key
        from core.security import get_password_hash
        
        random_part = secrets.token_urlsafe(32)
        new_api_key = f"sk_live_{random_part}"
        
        # Hash the key for storage (same system as IntegrationService)
        hashed_key = get_password_hash(new_api_key)
        
        new_key_id = str(uuid4())
        
        # Handle expiration format (could be timestamp or ISO string)
        expires_at = old_key.get('expires_at')
        if expires_at and isinstance(expires_at, str):
            # Convert ISO string to timestamp if needed
            try:
                expires_dt = datetime.fromisoformat(expires_at.replace('Z', '+00:00'))
                expires_at = expires_dt.timestamp()
            except:
                pass
        
        new_key_record = {
            "id": new_key_id,
            "user_id": user_id,
            "store_id": old_key.get('store_id'),
            "gerant_id": old_key.get('gerant_id'),
            "key_hash": hashed_key,  # Store hashed key instead of plain text
            "key_prefix": new_api_key[:12],  # Store prefix for lookup
            "name": old_key['name'],
            "permissions": old_key['permissions'],
            "store_ids": old_key.get('store_ids'),
            "active": True,
            "created_at": datetime.now(timezone.utc),
            "last_used_at": None,
            "expires_at": expires_at,
            "previous_key_id": key_id
        }
        
        await self.api_key_repo.create_key(new_key_record, user_id)
        
        return {
            "id": new_key_id,
            "key": new_api_key,  # Only shown at regeneration (for frontend compatibility)
            "api_key": new_api_key,  # Also return as api_key for consistency
            "name": new_key_record["name"],
            "permissions": new_key_record["permissions"],
            "active": True,
            "created_at": new_key_record["created_at"],
            "last_used_at": None,
            "expires_at": new_key_record.get("expires_at"),
            "store_ids": new_key_record.get("store_ids")
        }
    
    async def delete_api_key_permanent(
        self,
        key_id: str,
        user_id: str,
        role: str
    ) -> Dict:
        """
        Permanently delete an inactive API key
        
        Args:
            key_id: API key ID
            user_id: User ID for ownership verification
            role: User role (manager, gerant)
            
        Returns:
            Success message
            
        Raises:
            ValueError: If key not found or not authorized
        """
        # Find the key
        key = await self.api_key_repo.find_by_id(key_id, projection={"_id": 0})
        
        if not key:
            raise ValueError("API key not found")
        
        # Verify ownership based on role
        if role == 'manager':
            if key.get('user_id') != user_id:
                raise PermissionError("Not authorized to delete this key")
        elif role in ['gerant', 'gérant']:
            if key.get('gerant_id') != user_id:
                raise PermissionError("Not authorized to delete this key")
        
        # Only allow deletion of inactive keys
        if key.get('active'):
            raise ValueError("Cannot permanently delete an active key. Deactivate it first.")
        
        # Permanently delete
        await self.api_key_repo.delete_key(key_id, user_id=user_id if role == 'manager' else None)
        
        return {"success": True, "message": "API key permanently deleted"}

    async def get_yesterday_stats_for_brief(
        self, store_id: Optional[str], manager_id: str
    ) -> Dict[str, Any]:
        """
        Récupère les statistiques du dernier jour avec des données de vente pour le brief matinal.
        Cherche dans les 30 derniers jours pour trouver le dernier jour travaillé.
        Utilise store_kpi_repo, kpi_repo, user_repo, store_repo (injectés).
        """
        today = datetime.now(timezone.utc)
        start_of_week = today - timedelta(days=today.weekday())
        stats: Dict[str, Any] = {
            "ca_yesterday": 0,
            "objectif_yesterday": 0,
            "ventes_yesterday": 0,
            "panier_moyen_yesterday": 0,
            "taux_transfo_yesterday": 0,
            "indice_vente_yesterday": 0,
            "top_seller_yesterday": None,
            "ca_week": 0,
            "objectif_week": 0,
            "team_present": "Non renseigné",
            "data_date": None,
        }
        if not store_id or not self.store_kpi_repo:
            return stats
        try:
            store_kpi_repo = self.store_kpi_repo
            kpi_repo = self.kpi_repo
            last_data_date = None
            for days_back in range(1, 31):
                check_date = today - timedelta(days=days_back)
                check_date_str = check_date.strftime("%Y-%m-%d")
                kpi_check = await store_kpi_repo.find_one_with_ca(store_id, check_date_str)
                if not kpi_check:
                    kpi_check = await kpi_repo.find_one(
                        {
                            "store_id": store_id,
                            "date": check_date_str,
                            "ca_journalier": {"$gt": 0},
                        },
                        {"_id": 0, "date": 1},
                    )
                if kpi_check:
                    last_data_date = check_date_str
                    break
            if not last_data_date:
                last_data_date = (today - timedelta(days=1)).strftime("%Y-%m-%d")
            stats["data_date"] = last_data_date

            kpis_yesterday = await store_kpi_repo.find_many_for_store(
                store_id, date=last_data_date, limit=50
            )
            if not kpis_yesterday:
                kpi_entries = await kpi_repo.find_by_store(store_id, last_data_date)
                if kpi_entries:
                    total_ca = sum(k.get("ca_journalier", 0) or 0 for k in kpi_entries)
                    total_ventes = sum(k.get("nb_ventes", 0) or 0 for k in kpi_entries)
                    total_articles = sum(
                        k.get("nb_articles", k.get("nb_ventes", 0)) or 0 for k in kpi_entries
                    )
                    total_visiteurs = sum(
                        k.get("nb_visiteurs", k.get("nb_prospects", 0)) or 0 for k in kpi_entries
                    )
                    stats["ca_yesterday"] = total_ca
                    stats["ventes_yesterday"] = total_ventes
                    if total_ventes > 0:
                        stats["panier_moyen_yesterday"] = total_ca / total_ventes
                        stats["indice_vente_yesterday"] = total_articles / total_ventes
                    if total_visiteurs > 0:
                        stats["taux_transfo_yesterday"] = (total_ventes / total_visiteurs) * 100
                    if kpi_entries:
                        sorted_sellers = sorted(
                            kpi_entries, key=lambda x: x.get("ca_journalier", 0) or 0, reverse=True
                        )
                        if sorted_sellers:
                            top_kpi = sorted_sellers[0]
                            top_seller = await self.user_repo.find_one(
                                {"id": top_kpi.get("seller_id")},
                                {"_id": 0, "name": 1},
                            )
                            if top_seller:
                                stats["top_seller_yesterday"] = (
                                    f"{top_seller.get('name')} ({top_kpi.get('ca_journalier', 0):,.0f}€)"
                                )
            if kpis_yesterday:
                total_ca = sum(k.get("ca", 0) or 0 for k in kpis_yesterday)
                total_ventes = sum(k.get("nb_ventes", 0) or 0 for k in kpis_yesterday)
                total_articles = sum(k.get("nb_articles", 0) or 0 for k in kpis_yesterday)
                total_visiteurs = sum(k.get("nb_visiteurs", 0) or 0 for k in kpis_yesterday)
                stats["ca_yesterday"] = total_ca
                stats["ventes_yesterday"] = total_ventes
                if total_ventes > 0:
                    stats["panier_moyen_yesterday"] = total_ca / total_ventes
                    stats["indice_vente_yesterday"] = total_articles / total_ventes
                if total_visiteurs > 0:
                    stats["taux_transfo_yesterday"] = (total_ventes / total_visiteurs) * 100
                sorted_sellers = sorted(
                    kpis_yesterday, key=lambda x: x.get("ca", 0) or 0, reverse=True
                )
                if sorted_sellers:
                    top_kpi = sorted_sellers[0]
                    top_seller = await self.user_repo.find_one(
                        {"id": top_kpi.get("seller_id")},
                        {"_id": 0, "name": 1},
                    )
                    if top_seller:
                        stats["top_seller_yesterday"] = (
                            f"{top_seller.get('name')} ({top_kpi.get('ca', 0):,.0f}€)"
                        )

            store_obj = await self.store_repo.find_by_id(
                store_id, None, {"_id": 0, "objective_daily": 1, "objective_weekly": 1}
            )
            if store_obj:
                stats["objectif_yesterday"] = store_obj.get("objective_daily", 0) or 0
                stats["objectif_week"] = store_obj.get("objective_weekly", 0) or 0

            week_start_str = start_of_week.strftime("%Y-%m-%d")
            kpi_week_aggregate = [
                {
                    "$match": {
                        "store_id": store_id,
                        "date": {"$gte": week_start_str, "$lte": last_data_date},
                    }
                },
                {"$group": {"_id": None, "total_ca": {"$sum": {"$ifNull": ["$ca_journalier", 0]}}}},
            ]
            kpi_week_result = await kpi_repo.aggregate(kpi_week_aggregate, max_results=1)
            if kpi_week_result:
                stats["ca_week"] = kpi_week_result[0].get("total_ca", 0) or 0
            else:
                kpis_week = await store_kpi_repo.find_many_for_store(
                    store_id,
                    date_range={"$gte": week_start_str, "$lte": last_data_date},
                    limit=500,
                    projection={"_id": 0, "ca": 1},
                )
                if kpis_week:
                    stats["ca_week"] = sum(k.get("ca", 0) or 0 for k in kpis_week)

            sellers = await self.user_repo.find_by_store(
                store_id, role="seller", status="active",
                projection={"_id": 0, "name": 1}, limit=50
            )
            if sellers:
                names = [s.get("name", "").split()[0] for s in sellers[:5]]
                stats["team_present"] = ", ".join(names)
                if len(sellers) > 5:
                    stats["team_present"] += f" et {len(sellers) - 5} autres"
        except Exception as e:
            logger.error("Erreur récupération stats brief: %s", e)
        return stats

