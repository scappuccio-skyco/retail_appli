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


class PaginationParams(BaseModel):
    """Pagination parameters for list endpoints"""
    skip: int = Field(default=0, ge=0)
    limit: int = Field(default=100, le=1000)


class DateRangeFilter(BaseModel):
    """Date range filter for queries"""
    start_date: Optional[str] = None  # YYYY-MM-DD
    end_date: Optional[str] = None    # YYYY-MM-DD
