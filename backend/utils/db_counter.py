"""
DB Operations Counter - Debug Mode
Temporaire: activé uniquement si PERF_DEBUG=true
Compte les opérations DB pour prouver que le nombre est fixe (indépendant de N)
"""
import os
from contextvars import ContextVar
from typing import Optional
from core.logging import request_id_var

# Context variable pour stocker le compteur par requête (thread-safe)
_db_ops_counter: ContextVar[Optional[int]] = ContextVar('db_ops_counter', default=None)

PERF_DEBUG_ENABLED = os.getenv('PERF_DEBUG', 'false').lower() == 'true'


def init_counter():
    """Initialise le compteur pour une nouvelle requête"""
    if PERF_DEBUG_ENABLED:
        _db_ops_counter.set(0)


def increment_db_op(operation: str = "unknown"):
    """Incrémente le compteur d'opérations DB"""
    if PERF_DEBUG_ENABLED:
        counter = _db_ops_counter.get()
        if counter is not None:
            _db_ops_counter.set(counter + 1)


def get_db_ops_count() -> int:
    """Retourne le nombre d'opérations DB pour la requête actuelle"""
    if PERF_DEBUG_ENABLED:
        counter = _db_ops_counter.get()
        return counter if counter is not None else 0
    return 0


def get_request_id() -> Optional[str]:
    """Retourne le request_id de la requête actuelle"""
    if PERF_DEBUG_ENABLED:
        return request_id_var.get()
    return None


def reset_counter():
    """Réinitialise le compteur (pour nettoyage)"""
    if PERF_DEBUG_ENABLED:
        _db_ops_counter.set(0)

