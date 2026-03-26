"""
Internal job endpoints — called by Railway Cron service.
Secured by X-Internal-Key header (INTERNAL_JOB_KEY env var).
"""
import asyncio
import logging
from fastapi import APIRouter, Depends, Header, HTTPException
from core.config import settings
from core.database import get_db

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/internal/jobs", tags=["Internal Jobs"])


def _verify_key(x_internal_key: str = Header(..., alias="X-Internal-Key")):
    key = settings.INTERNAL_JOB_KEY
    if not key or x_internal_key != key:
        raise HTTPException(status_code=403, detail="Forbidden")


# ── Weekly gérant recap ────────────────────────────────────────────────────
@router.post("/weekly-gerant-recap", dependencies=[Depends(_verify_key)])
async def run_weekly_gerant_recap(db=Depends(get_db)):
    """
    Computes and sends the weekly performance recap to all active gérants.
    Should be triggered every Monday at 08:00.
    """
    from services.jobs_service import JobsService
    from services.email_jobs import send_weekly_gerant_recap

    service = JobsService(db)
    recaps = await service.compute_weekly_gerant_recaps()

    sent, failed = 0, 0
    for recap in recaps:
        try:
            ok = await asyncio.to_thread(
                send_weekly_gerant_recap,
                recap["email"],
                recap["name"],
                recap,
            )
            if ok:
                sent += 1
            else:
                failed += 1
        except Exception:
            logger.exception("Failed to send recap to %s", recap.get("email"))
            failed += 1

    logger.info("weekly-gerant-recap: sent=%d failed=%d", sent, failed)
    return {"sent": sent, "failed": failed, "total": len(recaps)}


# ── Silent seller alerts ───────────────────────────────────────────────────
@router.post("/silent-seller-alerts", dependencies=[Depends(_verify_key)])
async def run_silent_seller_alerts(db=Depends(get_db)):
    """
    Sends an alert to each manager who has sellers without KPI entries
    in the last 2 business days.
    Should be triggered Mon-Fri at 08:00.
    """
    from services.jobs_service import JobsService
    from services.email_jobs import send_silent_seller_alert

    service = JobsService(db)
    alerts = await service.compute_silent_seller_alerts()

    sent, failed = 0, 0
    for alert in alerts:
        try:
            ok = await asyncio.to_thread(
                send_silent_seller_alert,
                alert["email"],
                alert["name"],
                alert,
            )
            if ok:
                sent += 1
            else:
                failed += 1
        except Exception:
            logger.exception("Failed to send alert to %s", alert.get("email"))
            failed += 1

    logger.info("silent-seller-alerts: sent=%d failed=%d", sent, failed)
    return {"sent": sent, "failed": failed, "total": len(alerts)}
