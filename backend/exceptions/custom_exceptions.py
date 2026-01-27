"""
Custom Exceptions for Centralized Error Handling

All application exceptions should inherit from AppException.
The error handler middleware will automatically convert these to HTTP responses.
"""
from typing import Optional


class AppException(Exception):
    """
    Base exception class for all application errors.
    
    All custom exceptions should inherit from this class.
    The error handler middleware will automatically handle these exceptions
    and convert them to appropriate HTTP responses.
    
    Attributes:
        status_code: HTTP status code to return (default: 500)
        detail: Error message to return to client
        error_code: Optional error code for client-side handling
    """
    
    def __init__(
        self,
        detail: str,
        status_code: int = 500,
        error_code: Optional[str] = None
    ):
        """
        Initialize exception.
        
        Args:
            detail: Human-readable error message
            status_code: HTTP status code (default: 500)
            error_code: Optional error code for programmatic handling
        """
        self.detail = detail
        self.status_code = status_code
        self.error_code = error_code
        super().__init__(self.detail)


class NotFoundError(AppException):
    """
    Resource not found (404).
    
    Use when a requested resource doesn't exist.
    Example: User not found, Store not found, etc.
    """
    
    def __init__(self, detail: str, error_code: Optional[str] = None):
        super().__init__(
            detail=detail,
            status_code=404,
            error_code=error_code or "NOT_FOUND"
        )


class ValidationError(AppException):
    """
    Validation error (400).
    
    Use when input data is invalid or doesn't meet requirements.
    Example: Invalid email format, missing required field, etc.
    """
    
    def __init__(self, detail: str, error_code: Optional[str] = None):
        super().__init__(
            detail=detail,
            status_code=400,
            error_code=error_code or "VALIDATION_ERROR"
        )


class UnauthorizedError(AppException):
    """
    Unauthorized access (401).
    
    Use when authentication is required but missing or invalid.
    Example: Invalid credentials, expired token, etc.
    """
    
    def __init__(self, detail: str, error_code: Optional[str] = None):
        super().__init__(
            detail=detail,
            status_code=401,
            error_code=error_code or "UNAUTHORIZED"
        )


class ForbiddenError(AppException):
    """
    Forbidden access (403).
    
    Use when user is authenticated but doesn't have permission.
    Example: User trying to access another user's data, etc.
    """
    
    def __init__(self, detail: str, error_code: Optional[str] = None):
        super().__init__(
            detail=detail,
            status_code=403,
            error_code=error_code or "FORBIDDEN"
        )


class BusinessLogicError(AppException):
    """
    Business logic error (422).
    
    Use when request is valid but violates business rules.
    Example: Cannot delete active subscription, trial expired, etc.
    """
    
    def __init__(self, detail: str, error_code: Optional[str] = None):
        super().__init__(
            detail=detail,
            status_code=422,
            error_code=error_code or "BUSINESS_LOGIC_ERROR"
        )
