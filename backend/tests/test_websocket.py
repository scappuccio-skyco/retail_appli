"""
Tests unitaires — WebSocket / Pub/Sub KPI temps reel.

Couvre :
- WsManager.connect / disconnect / broadcast_to_store
- WsManager.publish (Redis disponible et fallback local)
- _emit_kpi_event (fire-and-forget depuis KpiMixin)
- ws_store_kpi auth (token invalide, role non autorise, acces store)
"""
import asyncio
import json
import pytest
from unittest.mock import AsyncMock, MagicMock, patch


# ---------------------------------------------------------------------------
# 1. WsManager — connexions et diffusion locale
# ---------------------------------------------------------------------------

class TestWsManagerConnections:

    def _make_manager(self):
        from core.ws_manager import WsManager
        return WsManager()

    def _mock_ws(self):
        ws = MagicMock()
        ws.send_text = AsyncMock()
        ws.accept = AsyncMock()
        return ws

    @pytest.mark.anyio
    async def test_connect_accepts_websocket(self):
        mgr = self._make_manager()
        ws = self._mock_ws()
        await mgr.connect("store_1", ws)
        ws.accept.assert_called_once()
        assert "store_1" in mgr._connections
        assert ws in mgr._connections["store_1"]

    @pytest.mark.anyio
    async def test_disconnect_removes_websocket(self):
        mgr = self._make_manager()
        ws = self._mock_ws()
        await mgr.connect("store_1", ws)
        await mgr.disconnect("store_1", ws)
        assert "store_1" not in mgr._connections

    @pytest.mark.anyio
    async def test_disconnect_keeps_other_clients(self):
        mgr = self._make_manager()
        ws1, ws2 = self._mock_ws(), self._mock_ws()
        await mgr.connect("store_1", ws1)
        await mgr.connect("store_1", ws2)
        await mgr.disconnect("store_1", ws1)
        assert ws2 in mgr._connections["store_1"]
        assert ws1 not in mgr._connections.get("store_1", set())

    @pytest.mark.anyio
    async def test_broadcast_sends_to_all_clients(self):
        mgr = self._make_manager()
        ws1, ws2 = self._mock_ws(), self._mock_ws()
        await mgr.connect("store_1", ws1)
        await mgr.connect("store_1", ws2)
        await mgr.broadcast_to_store("store_1", '{"type":"test"}')
        ws1.send_text.assert_called_once_with('{"type":"test"}')
        ws2.send_text.assert_called_once_with('{"type":"test"}')

    @pytest.mark.anyio
    async def test_broadcast_no_clients_is_noop(self):
        mgr = self._make_manager()
        # Ne leve pas d'exception si aucun client connecte
        await mgr.broadcast_to_store("store_x", '{"type":"test"}')

    @pytest.mark.anyio
    async def test_broadcast_removes_dead_connections(self):
        """Un WebSocket qui leve une exception est retire automatiquement."""
        mgr = self._make_manager()
        ws_ok = self._mock_ws()
        ws_dead = self._mock_ws()
        ws_dead.send_text = AsyncMock(side_effect=Exception("connection closed"))
        await mgr.connect("store_1", ws_ok)
        await mgr.connect("store_1", ws_dead)
        await mgr.broadcast_to_store("store_1", "msg")
        assert ws_dead not in mgr._connections.get("store_1", set())
        assert ws_ok in mgr._connections.get("store_1", set())


# ---------------------------------------------------------------------------
# 2. WsManager.publish — Redis disponible vs fallback
# ---------------------------------------------------------------------------

class TestWsManagerPublish:

    def _make_manager(self):
        from core.ws_manager import WsManager
        return WsManager()

    @pytest.mark.anyio
    async def test_publish_uses_redis_when_available(self):
        """Si Redis client present, publish() appelle redis.publish."""
        mgr = self._make_manager()
        mock_redis = MagicMock()
        mock_redis.publish = AsyncMock()
        mgr._redis_client = mock_redis

        await mgr.publish("store_1", {"type": "kpi_entry_saved", "store_id": "store_1"})

        mock_redis.publish.assert_called_once()
        call_args = mock_redis.publish.call_args[0]
        assert call_args[0] == "kpi:store:store_1"
        payload = json.loads(call_args[1])
        assert payload["type"] == "kpi_entry_saved"

    @pytest.mark.anyio
    async def test_publish_fallback_when_no_redis(self):
        """Sans Redis client, publish() diffuse directement en local."""
        mgr = self._make_manager()
        mgr._redis_client = None

        ws = MagicMock()
        ws.accept = AsyncMock()
        ws.send_text = AsyncMock()
        await mgr.connect("store_1", ws)

        await mgr.publish("store_1", {"type": "kpi_entry_saved"})
        ws.send_text.assert_called_once()

    @pytest.mark.anyio
    async def test_publish_fallback_on_redis_error(self):
        """Si Redis leve une exception, fallback local."""
        mgr = self._make_manager()
        mock_redis = MagicMock()
        mock_redis.publish = AsyncMock(side_effect=Exception("Redis down"))
        mgr._redis_client = mock_redis

        ws = MagicMock()
        ws.accept = AsyncMock()
        ws.send_text = AsyncMock()
        await mgr.connect("store_1", ws)

        await mgr.publish("store_1", {"type": "test"})
        ws.send_text.assert_called_once()

    @pytest.mark.anyio
    async def test_publish_serializes_event(self):
        """L'evenement est serialise en JSON valide."""
        mgr = self._make_manager()
        mock_redis = MagicMock()
        mock_redis.publish = AsyncMock()
        mgr._redis_client = mock_redis

        event = {
            "type": "kpi_entry_saved",
            "store_id": "store_1",
            "seller_id": "seller_1",
            "date": "2024-06-15",
            "data": {"ca_journalier": 1500.0, "nb_ventes": 12},
        }
        await mgr.publish("store_1", event)
        raw = mock_redis.publish.call_args[0][1]
        parsed = json.loads(raw)
        assert parsed["data"]["ca_journalier"] == 1500.0


# ---------------------------------------------------------------------------
# 3. _emit_kpi_event
# ---------------------------------------------------------------------------

class TestEmitKpiEvent:

    @pytest.mark.anyio
    async def test_emit_calls_ws_manager_publish(self):
        from services.seller_service._kpi_mixin import _emit_kpi_event

        with patch("core.ws_manager.ws_manager") as mock_mgr:
            mock_mgr.publish = AsyncMock()
            entry = {
                "store_id": "store_1",
                "seller_id": "seller_1",
                "date": "2024-06-15",
                "ca_journalier": 1500,
                "nb_ventes": 10,
            }
            await _emit_kpi_event(entry)

        mock_mgr.publish.assert_called_once()
        store_id_arg, event_arg = mock_mgr.publish.call_args[0]
        assert store_id_arg == "store_1"
        assert event_arg["type"] == "kpi_entry_saved"
        assert event_arg["data"]["ca_journalier"] == 1500

    @pytest.mark.anyio
    async def test_emit_no_store_id_is_noop(self):
        """Sans store_id, emit ne fait rien."""
        from services.seller_service._kpi_mixin import _emit_kpi_event

        with patch("core.ws_manager.ws_manager") as mock_mgr:
            mock_mgr.publish = AsyncMock()
            await _emit_kpi_event({"seller_id": "s1", "date": "2024-06-15"})

        mock_mgr.publish.assert_not_called()

    @pytest.mark.anyio
    async def test_emit_exception_is_swallowed(self):
        """Une exception dans publish ne propage pas."""
        from services.seller_service._kpi_mixin import _emit_kpi_event

        with patch("core.ws_manager.ws_manager") as mock_mgr:
            mock_mgr.publish = AsyncMock(side_effect=Exception("Redis down"))
            # Ne doit pas lever
            await _emit_kpi_event({"store_id": "s1", "seller_id": "u1", "date": "2024-01-01"})

    @pytest.mark.anyio
    async def test_emit_only_kpi_fields_in_data(self):
        """Seuls les champs KPI sont inclus dans data (pas id, ts, etc.)."""
        from services.seller_service._kpi_mixin import _emit_kpi_event

        with patch("core.ws_manager.ws_manager") as mock_mgr:
            mock_mgr.publish = AsyncMock()
            entry = {
                "id": "kpi_uuid",
                "store_id": "store_1",
                "seller_id": "s1",
                "date": "2024-06-15",
                "ts": "2024-06-15T00:00:00Z",
                "ca_journalier": 500,
                "nb_ventes": 5,
                "source": "manual",
            }
            await _emit_kpi_event(entry)

        _, event = mock_mgr.publish.call_args[0]
        assert "id" not in event["data"]
        assert "ts" not in event["data"]
        assert "source" not in event["data"]
        assert event["data"]["ca_journalier"] == 500


# ---------------------------------------------------------------------------
# 4. Auth WebSocket (_authenticate_ws)
# ---------------------------------------------------------------------------

class TestWsAuth:

    def _make_token(self, user_id="u1", role="manager"):
        from core.security import JWT_SECRET, JWT_ALGORITHM
        import jwt, time
        payload = {
            "user_id": user_id,
            "role": role,
            "exp": int(time.time()) + 3600,
        }
        return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

    @pytest.mark.anyio
    async def test_manager_correct_store_allowed(self):
        from core.ws_auth import _authenticate_ws

        token = self._make_token(user_id="mgr_1", role="manager")
        mock_user = {"id": "mgr_1", "role": "manager", "store_id": "store_1"}

        with patch("core.ws_auth.UserRepository") as MockRepo:
            MockRepo.return_value.find_one = AsyncMock(return_value=mock_user)
            with patch("core.ws_auth.get_db", new=AsyncMock(return_value=MagicMock())):
                result = await _authenticate_ws(token, "store_1")

        assert result["id"] == "mgr_1"

    @pytest.mark.anyio
    async def test_manager_wrong_store_forbidden(self):
        from core.ws_auth import _authenticate_ws
        from core.exceptions import ForbiddenError

        token = self._make_token(user_id="mgr_1", role="manager")
        mock_user = {"id": "mgr_1", "role": "manager", "store_id": "store_A"}

        with patch("core.ws_auth.UserRepository") as MockRepo:
            MockRepo.return_value.find_one = AsyncMock(return_value=mock_user)
            with patch("core.ws_auth.get_db", new=AsyncMock(return_value=MagicMock())):
                with pytest.raises(ForbiddenError):
                    await _authenticate_ws(token, "store_B")

    @pytest.mark.anyio
    async def test_invalid_token_unauthorized(self):
        from core.ws_auth import _authenticate_ws
        from core.exceptions import UnauthorizedError

        with pytest.raises(UnauthorizedError):
            await _authenticate_ws("not.a.jwt", "store_1")

    @pytest.mark.anyio
    async def test_seller_role_forbidden(self):
        from core.ws_auth import _authenticate_ws
        from core.exceptions import ForbiddenError

        token = self._make_token(user_id="s1", role="seller")
        mock_user = {"id": "s1", "role": "seller", "store_id": "store_1"}

        with patch("core.ws_auth.UserRepository") as MockRepo:
            MockRepo.return_value.find_one = AsyncMock(return_value=mock_user)
            with patch("core.ws_auth.get_db", new=AsyncMock(return_value=MagicMock())):
                with pytest.raises(ForbiddenError):
                    await _authenticate_ws(token, "store_1")
