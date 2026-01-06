"""
Middleware pour logging avec request_id et durée
"""
import time
import uuid
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from core.logging import request_id_var, get_logger

logger = get_logger(__name__)

class LoggingMiddleware(BaseHTTPMiddleware):
    """Middleware pour logging structuré avec request_id et durée"""
    
    async def dispatch(self, request: Request, call_next):
        # Générer request_id
        request_id = str(uuid.uuid4())[:8]
        request_id_var.set(request_id)
        
        # Ajouter request_id au request state
        request.state.request_id = request_id
        
        # Mesurer durée
        start_time = time.time()
        
        try:
            response = await call_next(request)
            duration_ms = (time.time() - start_time) * 1000
            
            # Log structuré
            logger.info(
                'Request completed',
                extra={
                    'request_id': request_id,
                    'method': request.method,
                    'endpoint': request.url.path,
                    'status_code': response.status_code,
                    'duration_ms': round(duration_ms, 2),
                }
            )
            
            # Ajouter request_id au header de réponse
            response.headers['X-Request-ID'] = request_id
            return response
            
        except Exception as e:
            duration_ms = (time.time() - start_time) * 1000
            logger.exception(
                'Request failed',
                extra={
                    'request_id': request_id,
                    'method': request.method,
                    'endpoint': request.url.path,
                    'duration_ms': round(duration_ms, 2),
                }
            )
            raise

