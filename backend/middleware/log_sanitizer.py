"""
Middleware pour sanitization des logs
Masque automatiquement les champs sensibles (password, token, api_key, etc.)
"""
import logging
import re
from typing import Any, Dict, List
from copy import deepcopy


# Liste des champs sensibles à masquer
SENSITIVE_FIELDS = [
    'password',
    'token',
    'api_key',
    'apiKey',
    'secret',
    'authorization',
    'Authorization',
    'x-api-key',
    'X-API-Key',
    'jwt_secret',
    'stripe_key',
    'stripe_secret',
    'brevo_key',
    'openai_key',
    'credentials',
    'access_token',
    'refresh_token',
    'bearer',
    'auth',
    'jwt',
    'session_id',
    'sessionId'
]

REDACTED_VALUE = "[REDACTED]"


def sanitize_dict(data: Any, depth: int = 0, max_depth: int = 10) -> Any:
    """
    Recursively sanitize a dictionary or list to mask sensitive fields.
    
    Args:
        data: Data structure to sanitize (dict, list, or primitive)
        depth: Current recursion depth
        max_depth: Maximum recursion depth to prevent infinite loops
        
    Returns:
        Sanitized data structure with sensitive fields masked
    """
    if depth > max_depth:
        return data
    
    if isinstance(data, dict):
        sanitized = {}
        for key, value in data.items():
            # Check if key contains sensitive field name (case-insensitive)
            key_lower = str(key).lower()
            is_sensitive = any(
                sensitive_field.lower() in key_lower 
                for sensitive_field in SENSITIVE_FIELDS
            )
            
            if is_sensitive:
                sanitized[key] = REDACTED_VALUE
            elif isinstance(value, (dict, list)):
                sanitized[key] = sanitize_dict(value, depth + 1, max_depth)
            else:
                sanitized[key] = value
        return sanitized
    
    elif isinstance(data, list):
        return [sanitize_dict(item, depth + 1, max_depth) for item in data]
    
    else:
        return data


def sanitize_string(text: str) -> str:
    """
    Sanitize a string by masking sensitive patterns.
    
    Args:
        text: String to sanitize
        
    Returns:
        Sanitized string with sensitive patterns masked
    """
    if not isinstance(text, str):
        return text
    
    # Patterns pour détecter les tokens/secrets dans les strings
    patterns = [
        (r'Bearer\s+[\w\-\.]+', 'Bearer [REDACTED]'),
        (r'password["\']?\s*[:=]\s*["\']?[^"\']+', 'password: [REDACTED]'),
        (r'token["\']?\s*[:=]\s*["\']?[^"\']+', 'token: [REDACTED]'),
        (r'api[_-]?key["\']?\s*[:=]\s*["\']?[^"\']+', 'api_key: [REDACTED]'),
        (r'secret["\']?\s*[:=]\s*["\']?[^"\']+', 'secret: [REDACTED]'),
    ]
    
    sanitized = text
    for pattern, replacement in patterns:
        sanitized = re.sub(pattern, replacement, sanitized, flags=re.IGNORECASE)
    
    return sanitized


class SanitizingFormatter(logging.Formatter):
    """
    Custom formatter that sanitizes log records before formatting.
    """
    
    def format(self, record: logging.LogRecord) -> str:
        """
        Format log record with sanitization.
        """
        # Sanitize extra fields if present
        if hasattr(record, 'extra') and isinstance(record.extra, dict):
            record.extra = sanitize_dict(record.extra)
        
        # Sanitize message
        if hasattr(record, 'msg') and isinstance(record.msg, str):
            record.msg = sanitize_string(record.msg)
        
        # Sanitize args if present
        if hasattr(record, 'args') and record.args:
            sanitized_args = []
            for arg in record.args:
                if isinstance(arg, (dict, list)):
                    sanitized_args.append(sanitize_dict(arg))
                elif isinstance(arg, str):
                    sanitized_args.append(sanitize_string(arg))
                else:
                    sanitized_args.append(arg)
            record.args = tuple(sanitized_args)
        
        return super().format(record)


def get_sanitized_logger(name: str) -> logging.Logger:
    """
    Get a logger with sanitization enabled.
    
    Args:
        name: Logger name
        
    Returns:
        Logger instance with sanitizing formatter
    """
    logger = logging.getLogger(name)
    
    # Add sanitizing formatter to handlers if not already present
    for handler in logger.handlers:
        if not isinstance(handler.formatter, SanitizingFormatter):
            formatter = SanitizingFormatter(
                '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
            )
            handler.setFormatter(formatter)
    
    return logger
