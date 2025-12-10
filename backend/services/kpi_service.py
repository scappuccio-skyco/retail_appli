"""KPI Service - Business logic for KPI calculations and aggregations"""
from typing import List, Dict, Optional
from datetime import datetime, timezone
from repositories.kpi_repository import KPIRepository, ManagerKPIRepository
from repositories.user_repository import UserRepository


class KPIService:
    """Service for KPI calculations and aggregations"""
    
    def __init__(self, db):
        self.kpi_repo = KPIRepository(db)
        self.manager_kpi_repo = ManagerKPIRepository(db)
        self.user_repo = UserRepository(db)
        self.db = db
    
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
        """
        # Check if entry exists
        existing = await self.kpi_repo.find_by_seller_and_date(seller_id, date)
        
        if existing:
            # Check if locked (from API/POS)
            if existing.get('locked', False):
                raise Exception(
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
            # Calculate KPIs
            calculated = self.calculate_kpis(kpi_data)
            
            # Create new entry
            from uuid import uuid4
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
        
        result = await self.kpi_repo.aggregate(pipeline)
        
        if not result:
            return {"total_ca": 0, "total_ventes": 0, "seller_count": 0}
        
        return result[0]
