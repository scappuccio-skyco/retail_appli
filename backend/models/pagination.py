"""
Pagination Models
Standard pagination response model for list endpoints
"""
from typing import List, TypeVar, Generic, Optional
from pydantic import BaseModel, Field

T = TypeVar('T')


class PaginatedResponse(BaseModel, Generic[T]):
    """
    Standard paginated response model.
    
    Generic type T allows type-safe pagination of any model type.
    
    Example:
        PaginatedResponse[User] for paginated user lists
        PaginatedResponse[KPIEntry] for paginated KPI entries
    """
    items: List[T] = Field(..., description="List of items for current page")
    total: int = Field(..., ge=0, description="Total number of items across all pages")
    page: int = Field(..., ge=1, description="Current page number (1-indexed)")
    size: int = Field(..., ge=1, description="Number of items per page")
    pages: int = Field(..., ge=0, description="Total number of pages")
    
    class Config:
        json_schema_extra = {
            "example": {
                "items": [],
                "total": 100,
                "page": 1,
                "size": 20,
                "pages": 5
            }
        }


class PaginationParams(BaseModel):
    """
    Pagination query parameters for list endpoints.
    
    Use this as a dependency in FastAPI routes to get pagination params.
    """
    page: int = Field(default=1, ge=1, description="Page number (1-indexed)")
    size: int = Field(default=20, ge=1, le=100, description="Number of items per page (max 100)")
    
    @property
    def skip(self) -> int:
        """Calculate skip value for MongoDB queries"""
        return (self.page - 1) * self.size
    
    @property
    def limit(self) -> int:
        """Get limit value (same as size)"""
        return self.size
