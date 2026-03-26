"""
Application lifespan: startup and shutdown.
Handles MongoDB connection (with retry), Redis cache, background index creation,
and APScheduler for periodic jobs (weekly gérant recap, silent seller alerts).
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

# APScheduler instance (module-level so shutdown can reach it)
_scheduler = None


async def _ensure_timeseries_collections(db) -> None:
    """
    Crée les collections Time Series si elles n'existent pas encore.
    Appelé avant apply_indexes car les TS collections doivent exister
    avant la création de leurs index secondaires.
    Idempotent : CollectionInvalid ignoré si la collection existe déjà.
    """
    from pymongo.errors import CollectionInvalid, OperationFailure
    ts_collections = [
        {
            "name": "kpi_entries",
            "timeseries": {
                "timeField": "ts",
                "metaField": "store_id",
                "granularity": "hours",
            },
        },
    ]
    for spec in ts_collections:
        try:
            await db.create_collection(spec["name"], timeseries=spec["timeseries"])
            logger.info("Time Series collection créée : %s", spec["name"])
        except (CollectionInvalid, OperationFailure):
            logger.debug("Collection %s existe déjà, skip création TS", spec["name"])
        except Exception as e:
            logger.warning("Impossible de créer la TS collection %s : %s", spec["name"], e)


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

        await _ensure_timeseries_collections(db)
        created, skipped, errors = await apply_indexes(db, logger=logger)
        logger.info("Indexes: %s created, %s skipped, %s errors", created, skipped, len(errors))

        try:
            from core.schemas import apply_schemas
            await apply_schemas(db, logger=logger)
        except Exception as e:
            logger.warning("Schema validation setup warning (non-critical): %s", e)

        try:
            from init_db import init_database
            await asyncio.to_thread(init_database)
            logger.info("Database initialization complete")
        except Exception as e:
            logger.debug("Database initialization skipped: %s", e)

    except Exception as e:
        logger.warning("Background index init warning: %s", e)


def _start_scheduler(database) -> None:
    """
    Start APScheduler with two periodic jobs:
    - Weekly gérant recap : every Monday at 08:00 (Europe/Paris)
    - Silent seller alerts : Mon-Fri at 08:00 (Europe/Paris)
    No-op if APScheduler is not installed or INTERNAL_JOB_KEY is not set.
    """
    global _scheduler
    try:
        from apscheduler.schedulers.asyncio import AsyncIOScheduler
        from apscheduler.triggers.cron import CronTrigger
        from core.config import settings

        if not getattr(settings, "INTERNAL_JOB_KEY", ""):
            logger.info("APScheduler: INTERNAL_JOB_KEY not set — scheduled jobs disabled")
            return

        async def _run_weekly_gerant_recap():
            try:
                from core.database import database as db_inst
                from services.jobs_service import JobsService
                from services.email_jobs import send_weekly_gerant_recap
                import asyncio as _asyncio

                service = JobsService(db_inst.db)
                recaps = await service.compute_weekly_gerant_recaps()
                sent, failed = 0, 0
                for recap in recaps:
                    try:
                        ok = await _asyncio.to_thread(
                            send_weekly_gerant_recap,
                            recap["email"], recap["name"], recap,
                        )
                        if ok:
                            sent += 1
                        else:
                            failed += 1
                    except Exception:
                        logger.exception("weekly recap: failed to send to %s", recap.get("email"))
                        failed += 1
                logger.info("weekly-gerant-recap: sent=%d failed=%d total=%d", sent, failed, len(recaps))
            except Exception:
                logger.exception("weekly-gerant-recap job error")

        async def _run_silent_seller_alerts():
            try:
                from core.database import database as db_inst
                from services.jobs_service import JobsService
                from services.email_jobs import send_silent_seller_alert
                import asyncio as _asyncio

                service = JobsService(db_inst.db)
                alerts = await service.compute_silent_seller_alerts()
                sent, failed = 0, 0
                for alert in alerts:
                    try:
                        ok = await _asyncio.to_thread(
                            send_silent_seller_alert,
                            alert["email"], alert["name"], alert,
                        )
                        if ok:
                            sent += 1
                        else:
                            failed += 1
                    except Exception:
                        logger.exception("silent-seller-alerts: failed to send to %s", alert.get("email"))
                        failed += 1
                logger.info("silent-seller-alerts: sent=%d failed=%d total=%d", sent, failed, len(alerts))
            except Exception:
                logger.exception("silent-seller-alerts job error")

        _scheduler = AsyncIOScheduler(timezone="Europe/Paris")
        _scheduler.add_job(
            _run_weekly_gerant_recap,
            CronTrigger(day_of_week="mon", hour=8, minute=0, timezone="Europe/Paris"),
            id="weekly-gerant-recap",
            replace_existing=True,
        )
        _scheduler.add_job(
            _run_silent_seller_alerts,
            CronTrigger(day_of_week="mon-fri", hour=8, minute=0, timezone="Europe/Paris"),
            id="silent-seller-alerts",
            replace_existing=True,
        )
        _scheduler.start()
        logger.info("APScheduler started (weekly recap Mondays 08:00, silent alerts Mon-Fri 08:00 Paris)")

    except ImportError:
        logger.warning("APScheduler not installed — scheduled jobs disabled (pip install apscheduler)")
    except Exception as e:
        logger.warning("APScheduler init failed (non-critical): %s", e)


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

    # System log repo for persisting 5xx errors (visible in SuperAdmin "Logs Système")
    try:
        if database is not None and getattr(database, "db", None) is not None:
            from repositories.system_log_repository import SystemLogRepository
            app.state.system_log_repo = SystemLogRepository(database.db)
        else:
            app.state.system_log_repo = None
    except Exception as e:
        logger.warning("System log repo not available: %s", e)
        app.state.system_log_repo = None

    # WebSocket Redis pub/sub listener
    try:
        from core.ws_manager import ws_manager
        from core.config import settings
        redis_url = getattr(settings, "CACHE_REDIS_URL", None) or getattr(settings, "REDIS_URL", None)
        if redis_url and str(redis_url).strip():
            await ws_manager.start_redis_listener(str(redis_url).strip())
        else:
            logger.info("No Redis URL — WebSocket using local broadcast only")
    except Exception as e:
        logger.warning("WsManager init warning (non-critical): %s", e)

    # Schedule index creation in background (does not block healthcheck).
    # Keep task in module-level set to prevent premature garbage collection.
    index_task = asyncio.create_task(_create_indexes_background())
    _background_tasks.add(index_task)
    index_task.add_done_callback(lambda t: _background_tasks.discard(t))

    # APScheduler — periodic jobs (weekly recap + silent seller alerts)
    _start_scheduler(database)

    logger.info("Application startup complete (worker %s)", worker_id)
    yield

    # Shutdown
    global _scheduler
    if _scheduler is not None:
        try:
            _scheduler.shutdown(wait=False)
            logger.info("APScheduler stopped")
        except Exception as e:
            logger.warning("APScheduler shutdown warning: %s", e)
    try:
        from core.ws_manager import ws_manager
        await ws_manager.stop()
    except Exception as e:
        logger.warning("WsManager stop warning: %s", e)
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
