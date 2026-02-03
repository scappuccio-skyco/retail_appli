"""
Application lifespan: startup and shutdown.
Handles MongoDB connection (with retry), Redis cache, and background index creation.
Index creation runs after a delay so it does not block the healthcheck.
Uses core.indexes as single source of truth (Audit 2.6). init_database runs in
thread pool to avoid blocking the event loop (Audit 1.7).
"""
import asyncio
import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI

logger = logging.getLogger(__name__)

# Tâches asyncio en arrière-plan : les garder dans un set pour éviter le GC (Sonar: save task in variable).
_background_tasks = set()


async def _create_indexes_background() -> None:
    """
    Create MongoDB indexes in background (called after delay).
    Uses core.indexes.apply_indexes. Then runs init_database in thread pool.
    """
    try:
        from core.database import database
        from core.indexes import apply_indexes

        await asyncio.sleep(5)  # Let healthcheck pass and DB stabilize
        db = database.db
        if db is None:
            logger.warning("Database not connected, skipping index creation")
            return

        created, skipped, errors = await apply_indexes(db, logger=logger)
        logger.info("Indexes: %s created, %s skipped, %s errors", created, skipped, len(errors))

        try:
            from init_db import init_database
            await asyncio.to_thread(init_database)
            logger.info("Database initialization complete")
        except Exception as e:
            logger.debug("Database initialization skipped: %s", e)

    except Exception as e:
        logger.warning("Background index init warning: %s", e)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """
    Application lifespan: startup (DB + Redis + schedule index creation) and shutdown.
    """
    import os
    from core.database import database

    worker_id = os.getpid()
    logger.info("Starting application (worker PID: %s)...", worker_id)

    # MongoDB with retry
    max_retries = 3
    retry_delay = 1.0
    for attempt in range(max_retries):
        try:
            await database.connect()
            logger.info("MongoDB connection established (worker %s)", worker_id)
            break
        except Exception as e:
            logger.warning(
                "MongoDB connection attempt %s/%s failed: %s",
                attempt + 1,
                max_retries,
                e,
            )
            if attempt < max_retries - 1:
                await asyncio.sleep(retry_delay)
                retry_delay = min(retry_delay * 1.5, 3.0)
            else:
                logger.error("Failed to connect to MongoDB after %s attempts", max_retries)
                logger.warning("Application starting without DB - endpoints will fail gracefully")

    # Redis cache (optional)
    try:
        from core.cache import get_cache_service
        cache = await get_cache_service()
        if cache.enabled:
            logger.info("Redis cache connected")
        else:
            logger.info("Redis cache disabled (graceful fallback)")
    except Exception as e:
        logger.warning("Redis cache initialization failed (non-critical): %s", e)

    # Schedule index creation in background (does not block healthcheck).
    # Keep task in module-level set to prevent premature garbage collection.
    index_task = asyncio.create_task(_create_indexes_background())
    _background_tasks.add(index_task)
    index_task.add_done_callback(lambda t: _background_tasks.discard(t))

    logger.info("Application startup complete (worker %s)", worker_id)
    yield

    # Shutdown
    try:
        await database.disconnect()
        logger.info("MongoDB connection closed")
    except Exception as e:
        logger.error("Error during MongoDB shutdown: %s", e)
    try:
        from core.cache import get_cache_service
        cache = await get_cache_service()
        await cache.disconnect()
        logger.info("Redis cache disconnected")
    except Exception as e:
        logger.warning("Error disconnecting Redis cache: %s", e)
