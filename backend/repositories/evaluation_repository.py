"""
Evaluation Repository - Data access for self-evaluations
Security: All methods require seller_id or store_id to prevent IDOR
"""
from typing import Optional, List, Dict, Any
from repositories.base_repository import BaseRepository


class EvaluationRepository(BaseRepository):
    """Repository for evaluations collection with security filters"""
    
    def __init__(self, db):
        super().__init__(db, "evaluations")
    
    # ===== SECURE READ OPERATIONS (with seller_id/store_id filter) =====
    
    async def find_by_seller(
        self,
        seller_id: str,
        projection: Optional[Dict[str, int]] = None,
        limit: int = 50,
        skip: int = 0,
        sort: Optional[List[tuple]] = None
    ) -> List[Dict]:
        """
        Find evaluations for a seller (SECURITY: requires seller_id)
        
        Args:
            seller_id: Seller ID (required for security)
            projection: MongoDB projection
            limit: Maximum number of results
            skip: Number of results to skip
            sort: Sort order (default: [("created_at", -1)])
        """
        if not seller_id:
            raise ValueError("seller_id is required for security")
        
        filters = {"seller_id": seller_id}
        sort = sort or [("created_at", -1)]
        return await self.find_many(filters, projection, limit, skip, sort)
    
    async def find_by_store(
        self,
        store_id: str,
        seller_ids: List[str],
        projection: Optional[Dict[str, int]] = None,
        limit: int = 50,
        skip: int = 0,
        sort: Optional[List[tuple]] = None
    ) -> List[Dict]:
        """
        Find evaluations for a store (SECURITY: requires store_id and seller_ids)
        
        Args:
            store_id: Store ID (required for security)
            seller_ids: List of seller IDs in the store (required for security)
            projection: MongoDB projection
            limit: Maximum number of results
            skip: Number of results to skip
            sort: Sort order (default: [("created_at", -1)])
        """
        if not store_id:
            raise ValueError("store_id is required for security")
        
        if not seller_ids:
            raise ValueError("seller_ids are required for security (prevents access to all evaluations)")
        
        filters = {"seller_id": {"$in": seller_ids}}
        sort = sort or [("created_at", -1)]
        return await self.find_many(filters, projection, limit, skip, sort)
    
    async def find_by_id(
        self,
        evaluation_id: str,
        seller_id: Optional[str] = None,
        store_id: Optional[str] = None,
        seller_ids: Optional[List[str]] = None,
        projection: Optional[Dict[str, int]] = None
    ) -> Optional[Dict]:
        """
        Find evaluation by ID (SECURITY: requires seller_id or store_id + seller_ids)
        
        Args:
            evaluation_id: Evaluation ID
            seller_id: Seller ID (for security verification)
            store_id: Store ID (for security verification, requires seller_ids)
            seller_ids: List of seller IDs (required if using store_id)
            projection: MongoDB projection
        """
        if not evaluation_id:
            raise ValueError("evaluation_id is required")
        
        filters = {"id": evaluation_id}
        
        # Security: Require at least one filter
        if seller_id:
            filters["seller_id"] = seller_id
        elif store_id:
            if not seller_ids:
                raise ValueError("seller_ids are required when using store_id for security")
            filters["seller_id"] = {"$in": seller_ids}
        else:
            raise ValueError("seller_id or (store_id + seller_ids) is required for security")
        
        return await self.find_one(filters, projection)
    
    async def find_by_sale(
        self,
        sale_id: str,
        seller_id: str,
        projection: Optional[Dict[str, int]] = None
    ) -> Optional[Dict]:
        """
        Find evaluation by sale_id (SECURITY: requires seller_id)
        
        Args:
            sale_id: Sale ID
            seller_id: Seller ID (required for security)
            projection: MongoDB projection
        """
        if not sale_id or not seller_id:
            raise ValueError("sale_id and seller_id are required for security")
        
        filters = {"sale_id": sale_id, "seller_id": seller_id}
        return await self.find_one(filters, projection)
    
    # ===== WRITE OPERATIONS (with security validation) =====
    
    async def create_evaluation(
        self,
        evaluation_data: Dict[str, Any],
        seller_id: str
    ) -> str:
        """
        Create a new evaluation (SECURITY: validates seller_id)
        
        Args:
            evaluation_data: Evaluation data
            seller_id: Seller ID (required for security)
        """
        if not seller_id:
            raise ValueError("seller_id is required for security")
        
        # Ensure security field is set
        evaluation_data["seller_id"] = seller_id
        
        return await self.insert_one(evaluation_data)
    
    async def update_evaluation(
        self,
        evaluation_id: str,
        update_data: Dict[str, Any],
        seller_id: Optional[str] = None,
        store_id: Optional[str] = None,
        seller_ids: Optional[List[str]] = None
    ) -> bool:
        """
        Update an evaluation (SECURITY: requires seller_id or store_id + seller_ids)
        
        Args:
            evaluation_id: Evaluation ID
            update_data: Update data
            seller_id: Seller ID (for security verification)
            store_id: Store ID (for security verification, requires seller_ids)
            seller_ids: List of seller IDs (required if using store_id)
        """
        if not evaluation_id:
            raise ValueError("evaluation_id is required")
        
        filters = {"id": evaluation_id}
        
        # Security: Require at least one filter
        if seller_id:
            filters["seller_id"] = seller_id
        elif store_id:
            if not seller_ids:
                raise ValueError("seller_ids are required when using store_id for security")
            filters["seller_id"] = {"$in": seller_ids}
        else:
            raise ValueError("seller_id or (store_id + seller_ids) is required for security")
        
        return await self.update_one(filters, {"$set": update_data})
    
    async def delete_evaluation(
        self,
        evaluation_id: str,
        seller_id: Optional[str] = None,
        store_id: Optional[str] = None,
        seller_ids: Optional[List[str]] = None
    ) -> bool:
        """
        Delete an evaluation (SECURITY: requires seller_id or store_id + seller_ids)
        
        Args:
            evaluation_id: Evaluation ID
            seller_id: Seller ID (for security verification)
            store_id: Store ID (for security verification, requires seller_ids)
            seller_ids: List of seller IDs (required if using store_id)
        """
        if not evaluation_id:
            raise ValueError("evaluation_id is required")
        
        filters = {"id": evaluation_id}
        
        # Security: Require at least one filter
        if seller_id:
            filters["seller_id"] = seller_id
        elif store_id:
            if not seller_ids:
                raise ValueError("seller_ids are required when using store_id for security")
            filters["seller_id"] = {"$in": seller_ids}
        else:
            raise ValueError("seller_id or (store_id + seller_ids) is required for security")
        
        return await self.delete_one(filters)
    
    # ===== COUNT OPERATIONS =====
    
    async def count_by_seller(self, seller_id: str) -> int:
        """Count evaluations for a seller (SECURITY: requires seller_id)"""
        if not seller_id:
            raise ValueError("seller_id is required for security")
        return await self.count({"seller_id": seller_id})
    
    async def count_by_store(
        self,
        store_id: str,
        seller_ids: List[str]
    ) -> int:
        """Count evaluations for a store (SECURITY: requires store_id and seller_ids)"""
        if not store_id:
            raise ValueError("store_id is required for security")
        if not seller_ids:
            raise ValueError("seller_ids are required for security")
        return await self.count({"seller_id": {"$in": seller_ids}})
