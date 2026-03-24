"""
WebSocket endpoint — mises a jour KPI en temps reel.

Connexion :
    ws(s)://<host>/api/ws/store/<store_id>?token=<JWT>

Auth : JWT en query param (les WebSockets ne supportent pas les headers Authorization).
Roles : manager (doit etre assigne au store) ou gerant (doit posseder le store).

Evenements recus par le client :
    {"type": "connected",        "store_id": "..."}
    {"type": "kpi_entry_saved",  "store_id": "...", "seller_id": "...",
     "date": "YYYY-MM-DD",       "data": {kpi fields}}
"""
import json
import logging

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect

from core.exceptions import ForbiddenError, UnauthorizedError
from core.ws_auth import _authenticate_ws
from core.ws_manager import ws_manager

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ws", tags=["WebSocket"])


@router.websocket("/store/{store_id}")
async def ws_store_kpi(
    websocket: WebSocket,
    store_id: str,
    token: str = Query(..., description="JWT token"),
) -> None:
    """
    WebSocket temps reel pour les KPIs d'un store.
    Envoie un evenement JSON a chaque saisie ou modification de KPI.
    """
    try:
        await _authenticate_ws(token, store_id)
    except (UnauthorizedError, ForbiddenError) as e:
        await websocket.close(code=4001, reason=str(e.detail if hasattr(e, "detail") else e))
        return
    except Exception as e:
        logger.error("WS auth unexpected error store=%s: %s", store_id, e)
        await websocket.close(code=4000, reason="Erreur d'authentification")
        return

    await ws_manager.connect(store_id, websocket)
    try:
        await websocket.send_text(
            json.dumps({"type": "connected", "store_id": store_id})
        )
        # Maintien de la connexion ; on ignore les messages entrants (lecture seule)
        while True:
            try:
                await websocket.receive_text()
            except WebSocketDisconnect:
                break
    except Exception as e:
        logger.warning("WS error store=%s: %s", store_id, e)
    finally:
        await ws_manager.disconnect(store_id, websocket)
