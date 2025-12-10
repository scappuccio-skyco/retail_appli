"""
Manager Service
Business logic for manager operations (team management, KPIs, diagnostics)
"""
from typing import Dict, List, Optional
from datetime import datetime, timezone
import logging

from repositories.user_repository import UserRepository
from repositories.store_repository import StoreRepository

logger = logging.getLogger(__name__)


class ManagerService:
    """Service for manager operations"""
    
    def __init__(self, db):
        self.db = db
        self.user_repo = UserRepository(db)
        self.store_repo = StoreRepository(db)
    
    async def get_sellers(self, manager_id: str, store_id: str) -> List[Dict]:
        """Get all sellers for manager's store"""
        sellers = await self.user_repo.find_many(
            {
                "store_id": store_id,
                "manager_id": manager_id,
                "role": "seller",
                "status": {"$ne": "deleted"}
            },
            {"_id": 0, "password": 0}
        )
        return sellers
    
    async def get_invitations(self, manager_id: str) -> List[Dict]:
        """Get pending invitations for manager"""
        invitations = await self.db.invitations.find(
            {"invited_by": manager_id, "status": "pending"},
            {"_id": 0}
        ).to_list(100)
        return invitations
    
    async def get_sync_mode(self, store_id: str) -> Dict:
        """Get sync mode configuration for store"""
        store = await self.store_repo.find_one({"id": store_id}, {"_id": 0})
        
        if not store:
            return {"sync_mode": "manual"}
        
        return {
            "sync_mode": store.get("sync_mode", "manual"),
            "external_sync_enabled": store.get("sync_mode") == "api_sync"
        }
    
    async def get_kpi_config(self, store_id: str) -> Dict:
        """Get KPI configuration for store"""
        config = await self.db.kpi_configs.find_one(
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
        bilans = await self.db.team_bilans.find(
            {"manager_id": manager_id, "store_id": store_id},
            {"_id": 0}
        ).sort("created_at", -1).to_list(100)
        
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
        
        seller_stats = await self.db.kpi_entries.aggregate(seller_pipeline).to_list(1)
        
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
        
        manager_stats = await self.db.manager_kpis.aggregate(manager_pipeline).to_list(1)
        
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
    
    async def get_active_objectives(self, manager_id: str, store_id: str) -> List[Dict]:
        """Get active objectives for manager's team"""
        objectives = await self.db.objectives.find(
            {
                "store_id": store_id,
                "status": "active",
                "end_date": {"$gte": datetime.now(timezone.utc).strftime('%Y-%m-%d')}
            },
            {"_id": 0}
        ).to_list(100)
        
        return objectives
    
    async def get_active_challenges(self, manager_id: str, store_id: str) -> List[Dict]:
        """Get active challenges for manager's team"""
        challenges = await self.db.challenges.find(
            {
                "store_id": store_id,
                "status": "active",
                "end_date": {"$gte": datetime.now(timezone.utc).strftime('%Y-%m-%d')}
            },
            {"_id": 0}
        ).to_list(100)
        
        return challenges


class DiagnosticService:
    """Service for diagnostic operations"""
    
    def __init__(self, db):
        self.db = db
    
    async def get_manager_diagnostic(self, manager_id: str) -> Optional[Dict]:
        """Get manager's DISC diagnostic profile"""
        diagnostic = await self.db.manager_diagnostics.find_one(
            {"manager_id": manager_id},
            {"_id": 0}
        )
        
        return diagnostic
