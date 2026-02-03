"""KPI Service - Business logic for KPI calculations and aggregations (repositories only)."""
from typing import List, Dict, Optional
from datetime import datetime, timezone
from uuid import uuid4

from repositories.kpi_repository import KPIRepository, ManagerKPIRepository
from repositories.user_repository import UserRepository
from repositories.store_repository import WorkspaceRepository, StoreRepository
from repositories.kpi_config_repository import KPIConfigRepository
from core.exceptions import ForbiddenError, NotFoundError, BusinessLogicError


class KPIService:
    """Service for KPI calculations and aggregations. All dependencies injected via __init__."""

    def __init__(
        self,
        kpi_repo: KPIRepository,
        manager_kpi_repo: ManagerKPIRepository,
        user_repo: UserRepository,
        workspace_repo: WorkspaceRepository,
        store_repo: StoreRepository,
        kpi_config_repo: KPIConfigRepository,
    ):
        self.kpi_repo = kpi_repo
        self.manager_kpi_repo = manager_kpi_repo
        self.user_repo = user_repo
        self.workspace_repo = workspace_repo
        self.store_repo = store_repo
        self.kpi_config_repo = kpi_config_repo
    
    async def get_kpi_by_seller_and_date(
        self, seller_id: str, date: str
    ) -> Optional[Dict]:
        """Get KPI entry for seller on date. Used by integrations sync route."""
        return await self.kpi_repo.find_by_seller_and_date(seller_id, date)

    async def get_kpis_by_date_range(
        self, seller_id: str, start_date: str, end_date: str
    ) -> List[Dict]:
        """Get KPI entries for seller in date range. Used by kpis route."""
        return await self.kpi_repo.find_by_date_range(seller_id, start_date, end_date)

    async def bulk_write_kpis(self, operations: list) -> Dict:
        """Execute bulk KPI write (insert/update). Used by integrations sync route."""
        return await self.kpi_repo.bulk_write(operations)

    async def check_user_write_access(self, user_id: str) -> bool:
        """
        Guard clause for Sellers/Managers: Get parent Gérant and check subscription access.
        
        Args:
            user_id: User ID (seller or manager)
            
        Returns:
            True if access is granted
            
        Raises:
            ForbiddenError if access denied (trial expired)
        """
        user = await self.user_repo.find_one(
            {"id": user_id},
            {"_id": 0}
        )
        
        if not user:
            raise ForbiddenError("Utilisateur non trouvé")
        
        # Get parent gérant_id
        gerant_id = user.get('gerant_id')
        
        if not gerant_id:
            # Safety: If no parent chain, deny by default
            raise ForbiddenError("Accès refusé: chaîne de parenté non trouvée")
        
        # Get gérant info
        gerant = await self.user_repo.find_one(
            {"id": gerant_id},
            {"_id": 0}
        )
        
        if not gerant:
            raise ForbiddenError("Gérant non trouvé")
        
        workspace_id = gerant.get('workspace_id')
        
        if not workspace_id:
            raise ForbiddenError("Aucun espace de travail associé")
        
        workspace = await self.workspace_repo.find_by_id(workspace_id)
        
        if not workspace:
            raise ForbiddenError("Espace de travail non trouvé")
        
        subscription_status = workspace.get('subscription_status', 'inactive')
        allowed = False

        if subscription_status == 'active':
            allowed = True
        elif subscription_status == 'trialing':
            trial_end = workspace.get('trial_end')
            if trial_end:
                if isinstance(trial_end, str):
                    trial_end_dt = datetime.fromisoformat(trial_end.replace('Z', '+00:00'))
                else:
                    trial_end_dt = trial_end

                now = datetime.now(timezone.utc)

                if now <= trial_end_dt:
                    allowed = True
                else:
                    await self.workspace_repo.update_by_id(
                        workspace_id,
                        {
                            "subscription_status": "trial_expired",
                            "updated_at": datetime.now(timezone.utc).isoformat()
                        }
                    )

        if not allowed:
            raise ForbiddenError("Période d'essai terminée. Veuillez contacter votre administrateur.")
        return True
    
    async def check_kpi_entry_enabled(self, store_id: str) -> dict:
        """Check if KPI entry is enabled for a store"""
        store = await self.store_repo.find_one({"id": store_id}, {"_id": 0, "sync_mode": 1})
        
        if not store:
            return {"enabled": True, "sync_mode": "manual"}
        
        sync_mode = store.get("sync_mode", "manual")
        
        # If sync mode is api_sync, manual entry might be disabled
        if sync_mode == "api_sync":
            config = await self.kpi_config_repo.find_by_store(store_id)
            
            if config and not config.get("saisie_enabled", True):
                return {"enabled": False, "sync_mode": sync_mode, "reason": "External sync configured"}
        
        return {"enabled": True, "sync_mode": sync_mode}
    
    def calculate_kpis(self, raw_data: Dict) -> Dict:
        """
        Calculate KPI metrics from raw data
        
        Args:
            raw_data: Dict with ca_journalier, nb_ventes, nb_articles, nb_prospects
            
        Returns:
            Dict with calculated KPIs
        """
        ca = raw_data.get('ca_journalier', 0)
        ventes = raw_data.get('nb_ventes', 0)
        articles = raw_data.get('nb_articles', 0)
        prospects = raw_data.get('nb_prospects', 0)
        
        # Panier moyen
        panier_moyen = round(ca / ventes, 2) if ventes > 0 else 0
        
        # Taux de transformation
        taux_transformation = round((ventes / prospects) * 100, 2) if prospects > 0 else None
        
        # Indice de vente (UPT - Units Per Transaction)
        indice_vente = round(articles / ventes, 2) if ventes > 0 else 0
        
        return {
            'panier_moyen': panier_moyen,
            'taux_transformation': taux_transformation,
            'indice_vente': indice_vente
        }
    
    async def create_or_update_seller_kpi(
        self,
        seller_id: str,
        date: str,
        kpi_data: Dict
    ) -> Dict:
        """
        Create or update KPI entry for seller
        
        Args:
            seller_id: Seller ID
            date: Date (YYYY-MM-DD)
            kpi_data: KPI raw data
            
        Returns:
            Created/updated KPI entry
            
        Raises:
            Exception: If KPI is locked (from API)
            ForbiddenError if trial expired
        """
        # === GUARD CLAUSE: Check subscription access ===
        await self.check_user_write_access(seller_id)
        
        # Check if entry exists
        existing = await self.kpi_repo.find_by_seller_and_date(seller_id, date)
        
        if existing:
            # Check if locked (from API/POS)
            if existing.get('locked', False):
                raise ForbiddenError(
                    "Ces données proviennent de votre logiciel de caisse et ne peuvent pas être modifiées manuellement."
                )
            
            # Calculate KPIs
            calculated = self.calculate_kpis(kpi_data)
            
            # Update
            update_data = {
                **kpi_data,
                **calculated,
                'updated_at': datetime.now(timezone.utc)
            }
            
            await self.kpi_repo.update_one(
                {"seller_id": seller_id, "date": date},
                {"$set": update_data}
            )
            
            return {**existing, **update_data}
        
        else:
            calculated = self.calculate_kpis(kpi_data)
            new_entry = {
                "id": str(uuid4()),
                "seller_id": seller_id,
                "date": date,
                **kpi_data,
                **calculated,
                "source": "manual",
                "locked": False,
                "created_at": datetime.now(timezone.utc)
            }
            
            await self.kpi_repo.insert_one(new_entry)
            return new_entry
    
    async def get_seller_kpi_summary(
        self,
        seller_id: str,
        start_date: str,
        end_date: str
    ) -> Dict:
        """
        Get KPI summary for seller over date range
        
        Args:
            seller_id: Seller ID
            start_date: Start date (YYYY-MM-DD)
            end_date: End date (YYYY-MM-DD)
            
        Returns:
            Dict with aggregated KPIs
        """
        # Get KPIs for period
        kpis = await self.kpi_repo.find_by_date_range(seller_id, start_date, end_date)
        
        if not kpis:
            return {
                "total_ca": 0,
                "total_ventes": 0,
                "avg_panier_moyen": 0,
                "count": 0
            }
        
        # Aggregate
        total_ca = sum(k.get('ca_journalier', 0) for k in kpis)
        total_ventes = sum(k.get('nb_ventes', 0) for k in kpis)
        total_articles = sum(k.get('nb_articles', 0) for k in kpis)
        
        avg_panier_moyen = round(total_ca / total_ventes, 2) if total_ventes > 0 else 0
        avg_indice_vente = round(total_articles / total_ventes, 2) if total_ventes > 0 else 0
        
        return {
            "total_ca": total_ca,
            "total_ventes": total_ventes,
            "total_articles": total_articles,
            "avg_panier_moyen": avg_panier_moyen,
            "avg_indice_vente": avg_indice_vente,
            "count": len(kpis)
        }
    
    async def aggregate_store_kpis(self, store_id: str, date: str) -> Dict:
        """
        Aggregate all seller KPIs for a store on a specific date
        
        Args:
            store_id: Store ID
            date: Date (YYYY-MM-DD)
            
        Returns:
            Aggregated store KPIs
        """
        pipeline = [
            {"$match": {"store_id": store_id, "date": date}},
            {
                "$group": {
                    "_id": None,
                    "total_ca": {"$sum": "$ca_journalier"},
                    "total_ventes": {"$sum": "$nb_ventes"},
                    "total_articles": {"$sum": "$nb_articles"},
                    "total_prospects": {"$sum": "$nb_prospects"},
                    "seller_count": {"$sum": 1}
                }
            }
        ]
        
        result = await self.kpi_repo.aggregate(pipeline, max_results=1)

        if not result:
            return {"total_ca": 0, "total_ventes": 0, "seller_count": 0}

        return result[0]

    async def get_stores_kpi_summary_for_gerant(
        self, gerant_id: str, date: str
    ) -> List[Dict]:
        """
        Get KPI summary per store for a gérant on a given date.
        Used by routes instead of instantiating StoreRepository in the route.
        """
        stores = await self.store_repo.find_by_gerant(gerant_id)
        results: List[Dict] = []
        for store in stores:
            summary = await self.aggregate_store_kpis(store["id"], date)
            results.append({"store": store, "kpis": summary})
        return results
