"""
Tests unitaires pour la logique de cache LLM ajoutée dans la session de perf.

Couvre :
- TeamAnalysisRepository.find_recent_by_period
- MorningBriefRepository.find_today_uncustomized
- ManagerService.get_cached_team_analysis
- ManagerService.get_cached_morning_brief

Exécution :
  pytest tests/test_cache_logic.py -v
  python -m unittest tests.test_cache_logic -v
"""
import asyncio
import unittest
from datetime import datetime, timezone, timedelta
from unittest.mock import AsyncMock, MagicMock
import sys
import os

if os.path.dirname(os.path.dirname(os.path.abspath(__file__))) not in sys.path:
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def _make_mock_db():
    db = MagicMock()
    db.__getitem__.return_value = MagicMock()
    return db


# ---------------------------------------------------------------------------
# TeamAnalysisRepository.find_recent_by_period
# ---------------------------------------------------------------------------

class TestFindRecentByPeriod(unittest.TestCase):

    def setUp(self):
        from repositories.team_analysis_repository import TeamAnalysisRepository
        self.repo = TeamAnalysisRepository(_make_mock_db())

    def _fresh_analysis(self):
        return {
            "id": "ana1",
            "store_id": "store1",
            "period_start": "2026-01-01",
            "period_end": "2026-01-31",
            "analysis": {"summary": "ok"},
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }

    def test_returns_analysis_when_found(self):
        """Retourne l'analyse si find_many renvoie un résultat."""
        ana = self._fresh_analysis()
        self.repo.find_many = AsyncMock(return_value=[ana])
        result = asyncio.run(self.repo.find_recent_by_period("store1", "2026-01-01", "2026-01-31"))
        self.assertEqual(result, ana)

    def test_returns_none_when_empty(self):
        """Retourne None si aucun résultat (cache miss)."""
        self.repo.find_many = AsyncMock(return_value=[])
        result = asyncio.run(self.repo.find_recent_by_period("store1", "2026-01-01", "2026-01-31"))
        self.assertIsNone(result)

    def test_filter_contains_store_and_period(self):
        """Le filtre transmis à find_many contient store_id, period_start, period_end."""
        self.repo.find_many = AsyncMock(return_value=[])
        asyncio.run(self.repo.find_recent_by_period("store42", "2026-02-01", "2026-02-28"))
        call_filter = self.repo.find_many.call_args[0][0]
        self.assertEqual(call_filter["store_id"], "store42")
        self.assertEqual(call_filter["period_start"], "2026-02-01")
        self.assertEqual(call_filter["period_end"], "2026-02-28")

    def test_filter_applies_ttl_cutoff(self):
        """Le filtre generated_at.$gte doit être dans le passé récent (< max_age_hours)."""
        self.repo.find_many = AsyncMock(return_value=[])
        before = datetime.now(timezone.utc) - timedelta(hours=6, seconds=5)
        asyncio.run(self.repo.find_recent_by_period("s", "2026-01-01", "2026-01-31", max_age_hours=6))
        call_filter = self.repo.find_many.call_args[0][0]
        cutoff_str = call_filter["generated_at"]["$gte"]
        cutoff_dt = datetime.fromisoformat(cutoff_str)
        # Le cutoff doit être après before (c'est-à-dire dans les 6h)
        self.assertGreater(cutoff_dt, before)

    def test_uses_limit_1_and_desc_sort(self):
        """find_many doit être appelé avec limit=1 et sort descendant."""
        self.repo.find_many = AsyncMock(return_value=[])
        asyncio.run(self.repo.find_recent_by_period("s", "2026-01-01", "2026-01-31"))
        call_kwargs = self.repo.find_many.call_args[1]
        self.assertEqual(call_kwargs.get("limit"), 1)
        self.assertIn(("generated_at", -1), call_kwargs.get("sort", []))


# ---------------------------------------------------------------------------
# MorningBriefRepository.find_today_uncustomized
# ---------------------------------------------------------------------------

class TestFindTodayUncustomized(unittest.TestCase):

    def setUp(self):
        from repositories.morning_brief_repository import MorningBriefRepository
        self.repo = MorningBriefRepository(_make_mock_db())

    def _today(self):
        return datetime.now(timezone.utc).strftime("%Y-%m-%d")

    def _fresh_brief(self):
        return {
            "brief_id": "b1",
            "store_id": "store1",
            "brief": "Bonjour !",
            "context": None,
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }

    def test_returns_brief_when_found(self):
        brief = self._fresh_brief()
        self.repo.find_many = AsyncMock(return_value=[brief])
        result = asyncio.run(self.repo.find_today_uncustomized("store1", self._today()))
        self.assertEqual(result, brief)

    def test_returns_none_when_empty(self):
        self.repo.find_many = AsyncMock(return_value=[])
        result = asyncio.run(self.repo.find_today_uncustomized("store1", self._today()))
        self.assertIsNone(result)

    def test_raises_on_missing_store_id(self):
        """Sécurité : store_id vide doit lever ValueError."""
        with self.assertRaises(ValueError):
            asyncio.run(self.repo.find_today_uncustomized("", self._today()))

    def test_filter_contains_store_id_and_today(self):
        """Le filtre doit restreindre à store_id et à la date du jour."""
        self.repo.find_many = AsyncMock(return_value=[])
        today = self._today()
        asyncio.run(self.repo.find_today_uncustomized("store99", today))
        call_filter = self.repo.find_many.call_args[0][0]
        self.assertEqual(call_filter["store_id"], "store99")
        self.assertIn(today, call_filter["generated_at"]["$gte"])

    def test_filter_excludes_custom_context(self):
        """Le filtre doit exclure les briefs avec un contexte custom ($or None/'')."""
        self.repo.find_many = AsyncMock(return_value=[])
        asyncio.run(self.repo.find_today_uncustomized("store1", self._today()))
        call_filter = self.repo.find_many.call_args[0][0]
        self.assertIn("$or", call_filter)
        context_values = [c.get("context") for c in call_filter["$or"]]
        self.assertIn(None, context_values)
        self.assertIn("", context_values)


# ---------------------------------------------------------------------------
# ManagerService.get_cached_team_analysis / get_cached_morning_brief
# ---------------------------------------------------------------------------

class TestManagerServiceCacheMethods(unittest.TestCase):
    """Teste la délégation du service vers les repos cache."""

    def _make_service(self):
        """Crée un ManagerService minimal avec repos mockés."""
        from services.manager_service import ManagerService
        svc = ManagerService.__new__(ManagerService)
        svc.team_analysis_repo = MagicMock()
        svc.morning_brief_repo = MagicMock()
        return svc

    # --- get_cached_team_analysis ---

    def test_get_cached_team_analysis_delegates_to_repo(self):
        svc = self._make_service()
        expected = {"analysis": {}, "generated_at": "2026-03-23T10:00:00+00:00"}
        svc.team_analysis_repo.find_recent_by_period = AsyncMock(return_value=expected)

        result = asyncio.run(svc.get_cached_team_analysis("store1", "2026-01-01", "2026-01-31"))

        self.assertEqual(result, expected)
        svc.team_analysis_repo.find_recent_by_period.assert_called_once_with(
            store_id="store1",
            period_start="2026-01-01",
            period_end="2026-01-31",
            max_age_hours=6,
        )

    def test_get_cached_team_analysis_returns_none_when_no_repo(self):
        svc = self._make_service()
        svc.team_analysis_repo = None
        result = asyncio.run(svc.get_cached_team_analysis("store1", "2026-01-01", "2026-01-31"))
        self.assertIsNone(result)

    def test_get_cached_team_analysis_cache_miss(self):
        svc = self._make_service()
        svc.team_analysis_repo.find_recent_by_period = AsyncMock(return_value=None)
        result = asyncio.run(svc.get_cached_team_analysis("store1", "2026-01-01", "2026-01-31"))
        self.assertIsNone(result)

    # --- get_cached_morning_brief ---

    def test_get_cached_morning_brief_delegates_to_repo(self):
        svc = self._make_service()
        expected = {"brief_id": "b1", "brief": "Bonjour !"}
        svc.morning_brief_repo.find_today_uncustomized = AsyncMock(return_value=expected)

        result = asyncio.run(svc.get_cached_morning_brief("store1"))

        self.assertEqual(result, expected)
        call_args = svc.morning_brief_repo.find_today_uncustomized.call_args[0]
        self.assertEqual(call_args[0], "store1")
        # Le second arg doit être la date du jour format YYYY-MM-DD
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        self.assertEqual(call_args[1], today)

    def test_get_cached_morning_brief_returns_none_when_no_repo(self):
        svc = self._make_service()
        svc.morning_brief_repo = None
        result = asyncio.run(svc.get_cached_morning_brief("store1"))
        self.assertIsNone(result)

    def test_get_cached_morning_brief_cache_miss(self):
        svc = self._make_service()
        svc.morning_brief_repo.find_today_uncustomized = AsyncMock(return_value=None)
        result = asyncio.run(svc.get_cached_morning_brief("store1"))
        self.assertIsNone(result)


if __name__ == "__main__":
    unittest.main()
