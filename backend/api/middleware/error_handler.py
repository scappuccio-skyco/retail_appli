"""
Global Error Handler Middleware

Intercepts all exceptions and converts them to appropriate HTTP responses.
- AppException subclasses → Return their status_code and detail
- Unexpected errors → Log with traceback and return clean 500
"""
import logging
import traceback
from typing import Callable

from fastapi import Request, Response, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from exceptions.custom_exceptions import AppException

logger = logging.getLogger(__name__)


class ErrorHandlerMiddleware(BaseHTTPMiddleware):
    """
    Global error handler middleware.
    
    Intercepts all exceptions raised during request processing:
    - AppException subclasses: Returns their status_code and detail
    - Unexpected errors: Logs with full traceback and returns clean 500
    """
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """
        Process request and handle any exceptions.
        
        Args:
            request: FastAPI request object
            call_next: Next middleware/handler in chain
            
        Returns:
            Response with appropriate status code and error details
        """
        try:
            response = await call_next(request)
            return response
            
        except AppException as e:
            # ✅ Expected application error - return clean response
            logger.warning(
                f"Application error: {e.detail}",
                extra={
                    "error_code": e.error_code,
                    "status_code": e.status_code,
                    "path": request.url.path,
                    "method": request.method,
                }
            )
            
            return JSONResponse(
                status_code=e.status_code,
                content={
                    "detail": e.detail,
                    "error_code": e.error_code,
                }
            )
            
        except Exception as e:
            # ❌ Unexpected error - log with traceback and return clean 500
            error_traceback = traceback.format_exc()
            
            logger.error(
                f"Unexpected error: {str(e)}",
                extra={
                    "error_type": type(e).__name__,
                    "path": request.url.path,
                    "method": request.method,
                    "traceback": error_traceback,
                },
                exc_info=True  # Include full exception info in logs
            )
            
            # Return clean 500 error (don't expose internal details to client)
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content={
                    "detail": "Une erreur interne s'est produite. Veuillez réessayer plus tard.",
                    "error_code": "INTERNAL_SERVER_ERROR",
                }
            )
