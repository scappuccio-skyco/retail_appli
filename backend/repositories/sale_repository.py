"""
Sale Repository - Data access for sales records
Security: All methods require seller_id or store_id to prevent IDOR
"""
from typing import Optional, List, Dict, Any
from repositories.base_repository import BaseRepository

# Messages de validation (Sonar: éviter duplication de littéraux)
ERR_SELLER_ID_REQUIRED = "seller_id is required for security"
ERR_STORE_ID_REQUIRED = "store_id is required for security"
ERR_SELLER_IDS_REQUIRED = "seller_ids are required for security (prevents access to all sales)"
ERR_SELLER_IDS_WHEN_STORE = "seller_ids are required when using store_id for security"
ERR_SELLER_OR_STORE_IDS = "seller_id or (store_id + seller_ids) is required for security"
ERR_SELLER_IDS_REQUIRED_GENERIC = "seller_ids are required for security"
ERR_SALE_ID_REQUIRED = "sale_id is required"


class SaleRepository(BaseRepository):
    """Repository for sales collection with security filters"""
    
    def __init__(self, db):
        super().__init__(db, "sales")
    
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
        Find sales for a seller (SECURITY: requires seller_id)
        
        Args:
            seller_id: Seller ID (required for security)
            projection: MongoDB projection
            limit: Maximum number of results
            skip: Number of results to skip
            sort: Sort order (default: [("date", -1)])
        """
        if not seller_id:
            raise ValueError("seller_id is required for security")
        
        filters = {"seller_id": seller_id}
        sort = sort or [("date", -1)]
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
        Find sales for a store (SECURITY: requires store_id and seller_ids)
        
        Args:
            store_id: Store ID (required for security)
            seller_ids: List of seller IDs in the store (required for security)
            projection: MongoDB projection
            limit: Maximum number of results
            skip: Number of results to skip
            sort: Sort order (default: [("date", -1)])
        """
        if not store_id:
            raise ValueError(ERR_STORE_ID_REQUIRED)
        
        if not seller_ids:
            raise ValueError("seller_ids are required for security (prevents access to all sales)")
        
        filters = {"seller_id": {"$in": seller_ids}}
        sort = sort or [("date", -1)]
        return await self.find_many(filters, projection, limit, skip, sort)
    
    async def find_by_id(
        self,
        sale_id: str,
        seller_id: Optional[str] = None,
        store_id: Optional[str] = None,
        seller_ids: Optional[List[str]] = None,
        projection: Optional[Dict[str, int]] = None
    ) -> Optional[Dict]:
        """
        Find sale by ID (SECURITY: requires seller_id or store_id + seller_ids)
        
        Args:
            sale_id: Sale ID
            seller_id: Seller ID (for security verification)
            store_id: Store ID (for security verification, requires seller_ids)
            seller_ids: List of seller IDs (required if using store_id)
            projection: MongoDB projection
        """
        if not sale_id:
            raise ValueError(ERR_SALE_ID_REQUIRED)
        
        filters = {"id": sale_id}
        
        # Security: Require at least one filter
        if seller_id:
            filters["seller_id"] = seller_id
        elif store_id:
            if not seller_ids:
                raise ValueError(ERR_SELLER_IDS_WHEN_STORE)
            filters["seller_id"] = {"$in": seller_ids}
        else:
            raise ValueError("seller_id or (store_id + seller_ids) is required for security")
        
        return await self.find_one(filters, projection)
    
    # ===== WRITE OPERATIONS (with security validation) =====
    
    async def create_sale(
        self,
        sale_data: Dict[str, Any],
        seller_id: str
    ) -> str:
        """
        Create a new sale (SECURITY: validates seller_id)
        
        Args:
            sale_data: Sale data
            seller_id: Seller ID (required for security)
        """
        if not seller_id:
            raise ValueError("seller_id is required for security")
        
        # Ensure security field is set
        sale_data["seller_id"] = seller_id
        
        return await self.insert_one(sale_data)
    
    async def update_sale(
        self,
        sale_id: str,
        update_data: Dict[str, Any],
        seller_id: Optional[str] = None,
        store_id: Optional[str] = None,
        seller_ids: Optional[List[str]] = None
    ) -> bool:
        """
        Update a sale (SECURITY: requires seller_id or store_id + seller_ids)
        
        Args:
            sale_id: Sale ID
            update_data: Update data
            seller_id: Seller ID (for security verification)
            store_id: Store ID (for security verification, requires seller_ids)
            seller_ids: List of seller IDs (required if using store_id)
        """
        if not sale_id:
            raise ValueError(ERR_SALE_ID_REQUIRED)
        
        filters = {"id": sale_id}
        
        # Security: Require at least one filter
        if seller_id:
            filters["seller_id"] = seller_id
        elif store_id:
            if not seller_ids:
                raise ValueError(ERR_SELLER_IDS_WHEN_STORE)
            filters["seller_id"] = {"$in": seller_ids}
        else:
            raise ValueError("seller_id or (store_id + seller_ids) is required for security")
        
        return await self.update_one(filters, {"$set": update_data})
    
    async def delete_sale(
        self,
        sale_id: str,
        seller_id: Optional[str] = None,
        store_id: Optional[str] = None,
        seller_ids: Optional[List[str]] = None
    ) -> bool:
        """
        Delete a sale (SECURITY: requires seller_id or store_id + seller_ids)
        
        Args:
            sale_id: Sale ID
            seller_id: Seller ID (for security verification)
            store_id: Store ID (for security verification, requires seller_ids)
            seller_ids: List of seller IDs (required if using store_id)
        """
        if not sale_id:
            raise ValueError(ERR_SALE_ID_REQUIRED)
        
        filters = {"id": sale_id}
        
        # Security: Require at least one filter
        if seller_id:
            filters["seller_id"] = seller_id
        elif store_id:
            if not seller_ids:
                raise ValueError(ERR_SELLER_IDS_WHEN_STORE)
            filters["seller_id"] = {"$in": seller_ids}
        else:
            raise ValueError("seller_id or (store_id + seller_ids) is required for security")
        
        return await self.delete_one(filters)
    
    # ===== COUNT OPERATIONS =====
    
    async def count_by_seller(self, seller_id: str) -> int:
        """Count sales for a seller (SECURITY: requires seller_id)"""
        if not seller_id:
            raise ValueError("seller_id is required for security")
        return await self.count({"seller_id": seller_id})
    
    async def count_by_store(
        self,
        store_id: str,
        seller_ids: List[str]
    ) -> int:
        """Count sales for a store (SECURITY: requires store_id and seller_ids)"""
        if not store_id:
            raise ValueError(ERR_STORE_ID_REQUIRED)
        if not seller_ids:
            raise ValueError(ERR_SELLER_IDS_REQUIRED_GENERIC)
        return await self.count({"seller_id": {"$in": seller_ids}})
