"""
Common Pydantic models and shared types
Used across multiple domains
"""
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime, timezone


class BaseResponse(BaseModel):
    """Standard API response wrapper"""
    success: bool
    message: str
    data: Optional[dict] = None


# ⚠️ DEPRECATED: Use models.pagination.PaginationParams instead
# This is kept for backward compatibility but will be removed in future versions
class PaginationParams(BaseModel):
    """Pagination parameters for list endpoints (DEPRECATED - use models.pagination.PaginationParams)"""
    skip: int = Field(default=0, ge=0)
    limit: int = Field(default=100, le=1000)


class DateRangeFilter(BaseModel):
    """Date range filter for queries"""
    start_date: Optional[str] = None  # YYYY-MM-DD
    end_date: Optional[str] = None    # YYYY-MM-DD
