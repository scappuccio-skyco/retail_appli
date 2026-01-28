"""
Application lifespan: startup and shutdown.
Handles MongoDB connection (with retry), Redis cache, and background index creation.
Index creation runs after a delay so it does not block the healthcheck.
"""
import asyncio
import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI

logger = logging.getLogger(__name__)


async def _create_indexes_background() -> None:
    """
    Create MongoDB indexes in background (called after delay).
    Does not block healthcheck. Runs once per worker.
    """
    try:
        from core.database import database

        await asyncio.sleep(5)  # Let healthcheck pass and DB stabilize
        db = database.db
        if db is None:
            logger.warning("Database not connected, skipping index creation")
            return

        try:
            await db.users.create_index("stripe_customer_id", sparse=True, background=True)
            await db.subscriptions.create_index("stripe_customer_id", sparse=True, background=True)

            try:
                await db.subscriptions.create_index(
                    "stripe_subscription_id",
                    unique=True,
                    partialFilterExpression={
                        "stripe_subscription_id": {"$exists": True, "$type": "string", "$gt": ""}
                    },
                    background=True,
                    name="unique_stripe_subscription_id",
                )
                logger.info("Created unique index on stripe_subscription_id (partial filter)")
            except Exception as e:
                logger.error("Failed to create unique index on stripe_subscription_id: %s", e)
                duplicates = await db.subscriptions.aggregate([
                    {"$match": {"stripe_subscription_id": {"$exists": True, "$ne": None, "$ne": ""}}},
                    {"$group": {"_id": "$stripe_subscription_id", "count": {"$sum": 1}}},
                    {"$match": {"count": {"$gt": 1}}},
                ]).to_list(length=10)
                if duplicates:
                    logger.error("Duplicate stripe_subscription_id values: %s", [d["_id"] for d in duplicates])
                else:
                    logger.warning("Index creation failed but no duplicates found: %s", e)

            await db.subscriptions.create_index(
                [("user_id", 1), ("status", 1)], background=True, name="user_status_idx"
            )
            await db.subscriptions.create_index(
                [("workspace_id", 1), ("status", 1)],
                sparse=True,
                background=True,
                name="workspace_status_idx",
            )
            await db.subscriptions.create_index(
                [("user_id", 1), ("workspace_id", 1), ("status", 1)],
                sparse=True,
                background=True,
                name="user_workspace_status_idx",
            )
            await db.workspaces.create_index("stripe_customer_id", sparse=True, background=True)

            await db.kpi_entries.create_index([("seller_id", 1), ("date", -1)], background=True)
            await db.kpi_entries.create_index([("store_id", 1), ("date", -1)], background=True)
            await db.kpi_entries.create_index(
                [("seller_id", 1), ("store_id", 1), ("date", -1)], background=True
            )

            await db.objectives.create_index([("store_id", 1), ("status", 1)], background=True)
            await db.objectives.create_index([("seller_id", 1), ("status", 1)], background=True)
            await db.challenges.create_index([("store_id", 1), ("status", 1)], background=True)

            await db.users.create_index(
                [("store_id", 1), ("role", 1), ("status", 1)], background=True
            )
            await db.users.create_index([("store_id", 1), ("role", 1)], background=True)

            await db.sales.create_index([("seller_id", 1), ("date", -1)], background=True)
            await db.debriefs.create_index([("seller_id", 1), ("created_at", -1)], background=True)

            logger.info("Database indexes created/verified")
        except Exception as e:
            logger.warning("Index creation warning: %s", e)

        try:
            from init_db import init_database
            init_database()
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

    # Schedule index creation in background (does not block healthcheck)
    asyncio.create_task(_create_indexes_background())

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
