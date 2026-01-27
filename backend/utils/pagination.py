"""
Pagination Utilities

Helper functions for paginated database queries.
Uses asyncio.gather for parallel execution of count and find operations.
"""
import asyncio
import logging
from typing import List, Dict, Any, Optional, Tuple
from motor.motor_asyncio import AsyncIOMotorCollection

from models.pagination import PaginatedResponse, PaginationParams
from config.limits import DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE
from exceptions.custom_exceptions import ValidationError

logger = logging.getLogger(__name__)


async def paginate(
    collection: AsyncIOMotorCollection,
    query: Dict[str, Any],
    page: int = 1,
    size: Optional[int] = None,
    projection: Optional[Dict[str, int]] = None,
    sort: Optional[List[Tuple[str, int]]] = None
) -> PaginatedResponse[Dict[str, Any]]:
    """
    Paginate a MongoDB collection query.
    
    Uses asyncio.gather to execute count_documents and find().to_list() in parallel
    for optimal performance.
    
    Args:
        collection: MongoDB collection to query
        query: MongoDB query filter
        page: Page number (1-indexed, default: 1)
        size: Number of items per page (default: DEFAULT_PAGE_SIZE, max: MAX_PAGE_SIZE)
        projection: MongoDB projection dict (e.g., {"_id": 0})
        sort: List of (field, direction) tuples for sorting (e.g., [("date", -1)])
        
    Returns:
        PaginatedResponse with items, total, page, size, and pages
        
    Raises:
        ValidationError: If page < 1 or size > MAX_PAGE_SIZE
        
    Example:
        ```python
        result = await paginate(
            db.kpi_entries,
            {"seller_id": seller_id},
            page=1,
            size=20,
            sort=[("date", -1)]
        )
        # result.items = [...]
        # result.total = 100
        # result.pages = 5
        ```
    """
    # Validate and set defaults
    if page < 1:
        raise ValidationError(f"Page must be >= 1, got {page}")
    
    if size is None:
        size = DEFAULT_PAGE_SIZE
    elif size > MAX_PAGE_SIZE:
        raise ValidationError(f"Page size cannot exceed {MAX_PAGE_SIZE}, got {size}")
    elif size < 1:
        raise ValidationError(f"Page size must be >= 1, got {size}")
    
    # Calculate skip
    skip = (page - 1) * size
    
    # Set default projection if not provided
    if projection is None:
        projection = {"_id": 0}
    
    # Build query cursor
    cursor = collection.find(query, projection)
    
    # Apply sorting if provided
    if sort:
        cursor = cursor.sort(sort)
    
    # Apply pagination
    cursor = cursor.skip(skip).limit(size)
    
    # Execute count and find in parallel for optimal performance
    count_task = collection.count_documents(query)
    items_task = cursor.to_list(length=size)
    
    total, items = await asyncio.gather(count_task, items_task)
    
    # Calculate total pages
    pages = (total + size - 1) // size if total > 0 else 0
    
    logger.debug(
        f"Paginated query: page={page}, size={size}, total={total}, pages={pages}, items_returned={len(items)}"
    )
    
    return PaginatedResponse(
        items=items,
        total=total,
        page=page,
        size=size,
        pages=pages
    )


async def paginate_with_params(
    collection: AsyncIOMotorCollection,
    query: Dict[str, Any],
    pagination: PaginationParams,
    projection: Optional[Dict[str, int]] = None,
    sort: Optional[List[Tuple[str, int]]] = None
) -> PaginatedResponse[Dict[str, Any]]:
    """
    Paginate using PaginationParams model (convenience wrapper).
    
    Args:
        collection: MongoDB collection to query
        query: MongoDB query filter
        pagination: PaginationParams from FastAPI dependency
        projection: MongoDB projection dict
        sort: List of (field, direction) tuples for sorting
        
    Returns:
        PaginatedResponse with items, total, page, size, and pages
        
    Example:
        ```python
        @router.get("/items")
        async def get_items(
            pagination: PaginationParams = Depends(),
            db = Depends(get_db)
        ):
            return await paginate_with_params(
                db.items,
                {},
                pagination
            )
        ```
    """
    return await paginate(
        collection=collection,
        query=query,
        page=pagination.page,
        size=pagination.size,
        projection=projection,
        sort=sort
    )
