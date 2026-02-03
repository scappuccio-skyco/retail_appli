"""
Redis Cache Service
Provides caching layer to reduce MongoDB load for frequently accessed data.

Features:
- Graceful fallback if Redis is unavailable (continues without cache)
- JSON serialization/deserialization with MongoDB ObjectId and datetime support
- TTL support for automatic expiration
- Pattern-based invalidation
"""
import json
import logging
from typing import Optional, Dict, Any, List
from datetime import datetime, timezone
from bson import ObjectId
from pydantic import BaseModel

from core.config import settings

logger = logging.getLogger(__name__)

# Try to import redis, fallback to None if not available
try:
    from redis import asyncio as redis
    REDIS_AVAILABLE = True
except ImportError:
    try:
        # Fallback for older redis versions
        import redis.asyncio as redis
        REDIS_AVAILABLE = True
    except ImportError:
        REDIS_AVAILABLE = False
        logger.warning("Redis not available - cache will be disabled. Install redis package to enable caching.")


class CacheService:
    """
    Redis cache service with graceful fallback.
    
    If Redis is unavailable, all operations silently fail and return None/False,
    allowing the application to continue using MongoDB directly.
    """
    
    def __init__(self):
        self.redis_client: Optional[redis.Redis] = None
        self.enabled = False
        self._initialized = False
    
    async def connect(self):
        """Initialize Redis connection"""
        if not REDIS_AVAILABLE:
            logger.info("Redis package not installed - cache disabled")
            return
        
        if not settings.REDIS_ENABLED:
            logger.info("Redis disabled via REDIS_ENABLED=false - cache disabled")
            return
        
        if not settings.REDIS_URL:
            logger.info("REDIS_URL not configured - cache disabled (graceful fallback)")
            return
        
        try:
            # Parse Redis URL or use default
            redis_url = settings.REDIS_URL
            if not redis_url.startswith("redis://") and not redis_url.startswith("rediss://"):
                # Assume it's just host:port
                redis_url = f"redis://{redis_url}"
            
            self.redis_client = redis.from_url(
                redis_url,
                encoding="utf-8",
                decode_responses=True,
                socket_connect_timeout=2,  # Fast timeout for graceful fallback
                socket_timeout=2,
                retry_on_timeout=False
            )
            
            # Test connection
            await self.redis_client.ping()
            self.enabled = True
            self._initialized = True
            logger.info(f"✅ Redis cache connected: {redis_url}")
            
        except Exception as e:
            logger.warning(f"⚠️ Redis connection failed - cache disabled (graceful fallback): {e}")
            self.enabled = False
            self._initialized = True
            if self.redis_client:
                try:
                    await self.redis_client.aclose()
                except Exception:
                    pass
                self.redis_client = None
    
    async def disconnect(self):
        """Close Redis connection"""
        if self.redis_client:
            try:
                await self.redis_client.aclose()
                logger.info("Redis cache disconnected")
            except Exception as e:
                logger.warning(f"Error disconnecting Redis: {e}")
            finally:
                self.redis_client = None
                self.enabled = False
    
    def _serialize(self, value: Any) -> str:
        """
        Serialize value to JSON string.
        Handles MongoDB ObjectId and datetime objects.
        """
        if isinstance(value, BaseModel):
            # Use Pydantic's json() method for models
            return value.model_dump_json()
        
        # Custom JSON encoder for ObjectId and datetime
        class CustomJSONEncoder(json.JSONEncoder):
            def default(self, obj):
                if isinstance(obj, ObjectId):
                    return str(obj)
                if isinstance(obj, datetime):
                    return obj.isoformat()
                if isinstance(obj, BaseModel):
                    return obj.model_dump()
                return super().default(obj)
        
        return json.dumps(value, cls=CustomJSONEncoder, ensure_ascii=False)
    
    def _deserialize(self, value: str) -> Any:
        """Deserialize JSON string to Python object"""
        try:
            return json.loads(value)
        except json.JSONDecodeError as e:
            logger.error(f"Failed to deserialize cache value: {e}")
            return None
    
    async def get(self, key: str) -> Optional[Any]:
        """
        Get value from cache.
        
        Returns:
            Cached value or None if not found or cache unavailable
        """
        if not self.enabled or not self.redis_client:
            return None
        
        try:
            value = await self.redis_client.get(key)
            if value is None:
                return None
            return self._deserialize(value)
        except Exception as e:
            logger.warning(f"Cache get failed for key '{key}': {e} (graceful fallback)")
            return None
    
    async def set(self, key: str, value: Any, ttl: int = 300) -> bool:
        """
        Set value in cache with TTL.
        
        Args:
            key: Cache key
            value: Value to cache (will be JSON serialized)
            ttl: Time to live in seconds (default: 5 minutes)
        
        Returns:
            True if successful, False otherwise (graceful fallback)
        """
        if not self.enabled or not self.redis_client:
            return False
        
        try:
            serialized = self._serialize(value)
            await self.redis_client.setex(key, ttl, serialized)
            return True
        except Exception as e:
            logger.warning(f"Cache set failed for key '{key}': {e} (graceful fallback)")
            return False
    
    async def delete(self, key: str) -> bool:
        """
        Delete a single key from cache.
        
        Returns:
            True if successful or cache unavailable, False on error
        """
        if not self.enabled or not self.redis_client:
            return True  # Consider it successful if cache is disabled
        
        try:
            await self.redis_client.delete(key)
            return True
        except Exception as e:
            logger.warning(f"Cache delete failed for key '{key}': {e}")
            return False
    
    async def invalidate_pattern(self, pattern: str) -> int:
        """
        Delete all keys matching a pattern.
        
        Args:
            pattern: Redis pattern (e.g., "user:*", "store:*")
        
        Returns:
            Number of keys deleted (0 if cache unavailable)
        """
        if not self.enabled or not self.redis_client:
            return 0
        
        try:
            keys = []
            async for key in self.redis_client.scan_iter(match=pattern):
                keys.append(key)
            
            if keys:
                deleted = await self.redis_client.delete(*keys)
                logger.debug(f"Invalidated {deleted} cache keys matching pattern '{pattern}'")
                return deleted
            return 0
        except Exception as e:
            logger.warning(f"Cache pattern invalidation failed for '{pattern}': {e}")
            return 0
    
    async def exists(self, key: str) -> bool:
        """Check if a key exists in cache"""
        if not self.enabled or not self.redis_client:
            return False
        
        try:
            return await self.redis_client.exists(key) > 0
        except Exception as e:
            logger.warning(f"Cache exists check failed for key '{key}': {e}")
            return False
    
    async def clear(self) -> bool:
        """Clear all cache (use with caution!)"""
        if not self.enabled or not self.redis_client:
            return True
        
        try:
            await self.redis_client.flushdb()
            logger.warning("Cache cleared - all keys deleted")
            return True
        except Exception as e:
            logger.error(f"Cache clear failed: {e}")
            return False


# Singleton instance
_cache_service = None


async def get_cache_service() -> CacheService:
    """
    Get cache service instance (singleton).
    Automatically connects on first call.
    """
    global _cache_service
    
    if _cache_service is None:
        _cache_service = CacheService()
        await _cache_service.connect()
    
    return _cache_service


# Cache key prefixes (for organization and easy invalidation)
class CacheKeys:
    """Cache key prefixes and helpers"""
    
    USER = "user:"
    STORE = "store:"
    WORKSPACE = "workspace:"
    STORE_CONFIG = "store_config:"
    DIAGNOSTIC = "diagnostic:"
    
    @staticmethod
    def key_for_user(user_id: str) -> str:
        return f"{CacheKeys.USER}{user_id}"

    @staticmethod
    def key_for_store(store_id: str) -> str:
        return f"{CacheKeys.STORE}{store_id}"

    @staticmethod
    def key_for_workspace(workspace_id: str) -> str:
        return f"{CacheKeys.WORKSPACE}{workspace_id}"

    @staticmethod
    def key_for_store_config(store_id: str) -> str:
        return f"{CacheKeys.STORE_CONFIG}{store_id}"

    @staticmethod
    def key_for_diagnostic(seller_id: str) -> str:
        return f"{CacheKeys.DIAGNOSTIC}{seller_id}"


async def invalidate_user_cache(user_id: str):
    """
    Invalidate all cache entries related to a user.
    Called when user data is updated.
    """
    cache = await get_cache_service()
    if not cache.enabled:
        return
    
    # Invalidate user cache
    await cache.delete(CacheKeys.key_for_user(user_id))
    
    # Invalidate workspace cache if user has workspace_id
    # (We'll need to fetch user to get workspace_id, but that's OK for invalidation)
    logger.debug(f"Invalidated cache for user {user_id}")


async def invalidate_store_cache(store_id: str):
    """
    Invalidate all cache entries related to a store.
    Called when store data is updated.
    """
    cache = await get_cache_service()
    if not cache.enabled:
        return
    
    # Invalidate store cache
    await cache.delete(CacheKeys.key_for_store(store_id))
    await cache.delete(CacheKeys.key_for_store_config(store_id))
    
    logger.debug(f"Invalidated cache for store {store_id}")


async def invalidate_workspace_cache(workspace_id: str):
    """
    Invalidate all cache entries related to a workspace.
    Called when workspace data is updated.
    """
    cache = await get_cache_service()
    if not cache.enabled:
        return
    
    # Invalidate workspace cache
    await cache.delete(CacheKeys.key_for_workspace(workspace_id))
    
    logger.debug(f"Invalidated cache for workspace {workspace_id}")
