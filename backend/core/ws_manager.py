"""
WebSocket Manager — connexions temps reel par store.

Architecture :
- Connexions WebSocket en memoire (dict store_id -> set[WebSocket])
- Publication via Redis Pub/Sub (scalable multi-workers)
- Fallback broadcast direct en memoire si Redis indisponible

Canal Redis : kpi:store:{store_id}
"""
import asyncio
import json
import logging
from typing import Dict, Optional, Set

from fastapi import WebSocket

logger = logging.getLogger(__name__)

KPI_CHANNEL_PREFIX = "kpi:store:"


class WsManager:
    """
    Gestionnaire de connexions WebSocket par store_id.

    Utilisation :
        await ws_manager.connect(store_id, websocket)
        await ws_manager.publish(store_id, event_dict)   # depuis le service KPI
        await ws_manager.disconnect(store_id, websocket)
    """

    def __init__(self) -> None:
        self._connections: Dict[str, Set[WebSocket]] = {}
        self._redis_client = None
        self._listener_task: Optional[asyncio.Task] = None

    # ------------------------------------------------------------------
    # Cycle de vie des connexions
    # ------------------------------------------------------------------

    async def connect(self, store_id: str, websocket: WebSocket) -> None:
        """Accepte et enregistre une connexion WebSocket."""
        await websocket.accept()
        if store_id not in self._connections:
            self._connections[store_id] = set()
        self._connections[store_id].add(websocket)
        logger.info(
            "WS connected store=%s total_clients=%s",
            store_id,
            len(self._connections[store_id]),
        )

    async def disconnect(self, store_id: str, websocket: WebSocket) -> None:
        """Retire une connexion WebSocket."""
        if store_id in self._connections:
            self._connections[store_id].discard(websocket)
            if not self._connections[store_id]:
                del self._connections[store_id]
        logger.info("WS disconnected store=%s", store_id)

    # ------------------------------------------------------------------
    # Diffusion locale
    # ------------------------------------------------------------------

    async def broadcast_to_store(self, store_id: str, message: str) -> None:
        """Envoie un message texte a tous les WebSockets du store."""
        clients = self._connections.get(store_id, set()).copy()
        if not clients:
            return
        dead: Set[WebSocket] = set()
        for ws in clients:
            try:
                await ws.send_text(message)
            except Exception:
                dead.add(ws)
        # Nettoyage des connexions mortes
        if dead and store_id in self._connections:
            self._connections[store_id] -= dead

    # ------------------------------------------------------------------
    # Publication (Redis Pub/Sub ou fallback local)
    # ------------------------------------------------------------------

    async def publish(self, store_id: str, event: dict) -> None:
        """
        Publie un evenement KPI.

        - Redis disponible : publie sur kpi:store:{store_id}
          -> tous les workers recoivent via subscriber et diffusent localement
        - Redis indisponible : diffuse directement aux WebSockets de ce worker
        """
        message = json.dumps(event, default=str)
        if self._redis_client is not None:
            try:
                await self._redis_client.publish(
                    f"{KPI_CHANNEL_PREFIX}{store_id}", message
                )
                return
            except Exception as e:
                logger.warning(
                    "Redis publish failed, fallback local broadcast: %s", e
                )
        await self.broadcast_to_store(store_id, message)

    # ------------------------------------------------------------------
    # Subscriber Redis (demarre dans lifespan)
    # ------------------------------------------------------------------

    async def start_redis_listener(self, redis_url: str) -> None:
        """
        Cree une connexion Redis dediee au pub/sub et demarre la boucle d'ecoute.
        Une connexion separee est obligatoire (protocole Redis : pub/sub exclusif).
        """
        try:
            import redis.asyncio as aioredis

            # Client dedie a la publication
            self._redis_client = aioredis.from_url(
                redis_url, decode_responses=True
            )
            # Client dedie a l'abonnement
            sub_client = aioredis.from_url(redis_url, decode_responses=True)
            pubsub = sub_client.pubsub()
            await pubsub.psubscribe(f"{KPI_CHANNEL_PREFIX}*")
            self._listener_task = asyncio.create_task(self._listen(pubsub))
            logger.info(
                "WsManager: Redis pub/sub listener started (pattern=%s*)",
                KPI_CHANNEL_PREFIX,
            )
        except Exception as e:
            logger.warning(
                "WsManager: Redis pub/sub unavailable, local broadcast only: %s", e
            )
            self._redis_client = None

    async def _listen(self, pubsub) -> None:
        """Boucle d'ecoute Redis : recoit les messages et diffuse localement."""
        try:
            async for message in pubsub.listen():
                if message.get("type") != "pmessage":
                    continue
                channel: str = message.get("channel", "")
                data: str = message.get("data", "")
                if not channel.startswith(KPI_CHANNEL_PREFIX):
                    continue
                store_id = channel[len(KPI_CHANNEL_PREFIX):]
                await self.broadcast_to_store(store_id, data)
        except asyncio.CancelledError:
            logger.info("WsManager: Redis listener cancelled")
        except Exception as e:
            logger.error("WsManager: Redis listener error: %s", e)

    async def stop(self) -> None:
        """Arrete proprement le subscriber (appele dans lifespan shutdown)."""
        if self._listener_task and not self._listener_task.done():
            self._listener_task.cancel()
            try:
                await self._listener_task
            except asyncio.CancelledError:
                pass
        if self._redis_client is not None:
            try:
                await self._redis_client.aclose()
            except Exception:
                pass
            self._redis_client = None
        logger.info("WsManager stopped")


# Singleton — partage entre routes et services
ws_manager = WsManager()
