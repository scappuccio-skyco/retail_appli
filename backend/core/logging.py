"""
Logging structuré JSON avec request_id
"""
import json
import logging
import sys
from contextvars import ContextVar
from typing import Optional

# Context variable pour request_id
request_id_var: ContextVar[Optional[str]] = ContextVar('request_id', default=None)

class JSONFormatter(logging.Formatter):
    """Formatter JSON pour logs structurés"""
    
    def format(self, record):
        log_data = {
            'timestamp': self.formatTime(record, self.datefmt),
            'level': record.levelname,
            'logger': record.name,
            'message': record.getMessage(),
            'request_id': request_id_var.get(),
        }
        
        # Ajouter extra fields si présents
        if hasattr(record, 'user_id'):
            log_data['user_id'] = record.user_id
        if hasattr(record, 'store_id'):
            log_data['store_id'] = record.store_id
        if hasattr(record, 'duration_ms'):
            log_data['duration_ms'] = record.duration_ms
        if hasattr(record, 'endpoint'):
            log_data['endpoint'] = record.endpoint
        if hasattr(record, 'method'):
            log_data['method'] = record.method
        if hasattr(record, 'status_code'):
            log_data['status_code'] = record.status_code
        
        # Ajouter exception si présente
        if record.exc_info:
            log_data['exception'] = self.formatException(record.exc_info)
        
        return json.dumps(log_data)

# Configurer logger par défaut
_handler = logging.StreamHandler(sys.stdout)
_handler.setFormatter(JSONFormatter())

def get_logger(name: str = __name__):
    """Retourne un logger configuré avec JSON formatter"""
    logger = logging.getLogger(name)
    if not logger.handlers:
        logger.addHandler(_handler)
        logger.setLevel(logging.INFO)
    return logger

# Logger par défaut
logger = get_logger(__name__)

