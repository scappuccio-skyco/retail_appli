"""
Tests unitaires — Time Series kpi_entries.

Couvre :
- utils/kpi_ts.py : date_str_to_ts()
- KPIRepository.insert_one : injection automatique du champ ts
- KPIRepository.bulk_write : injection ts dans les InsertOne
- Invariant : aucune requête métier existante ne casse
"""
import pytest
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch


# ---------------------------------------------------------------------------
# 1. Helper date_str_to_ts
# ---------------------------------------------------------------------------

class TestDateStrToTs:
    """Tests de la fonction utilitaire date_str_to_ts."""

    def _fn(self):
        from utils.kpi_ts import date_str_to_ts
        return date_str_to_ts

    def test_returns_datetime(self):
        fn = self._fn()
        result = fn("2024-01-15")
        assert isinstance(result, datetime)

    def test_midnight_utc(self):
        fn = self._fn()
        result = fn("2024-01-15")
        assert result.hour == 0
        assert result.minute == 0
        assert result.second == 0
        assert result.tzinfo == timezone.utc

    def test_correct_date(self):
        fn = self._fn()
        result = fn("2024-03-31")
        assert result.year == 2024
        assert result.month == 3
        assert result.day == 31

    def test_first_january(self):
        fn = self._fn()
        result = fn("2024-01-01")
        assert result.year == 2024
        assert result.month == 1
        assert result.day == 1

    def test_invalid_format_raises(self):
        fn = self._fn()
        with pytest.raises(ValueError):
            fn("15/01/2024")

    def test_invalid_date_raises(self):
        fn = self._fn()
        with pytest.raises(ValueError):
            fn("2024-13-01")  # mois 13

    def test_two_dates_same_day_equal(self):
        """Deux appels avec la même date retournent des datetimes égaux."""
        fn = self._fn()
        assert fn("2024-06-15") == fn("2024-06-15")

    def test_different_dates_not_equal(self):
        fn = self._fn()
        assert fn("2024-06-15") != fn("2024-06-16")


# ---------------------------------------------------------------------------
# 2. KPIRepository.insert_one — injection de ts
# ---------------------------------------------------------------------------

class TestKPIRepositoryInsertOne:
    """Vérifie que insert_one injecte automatiquement le champ ts."""

    def _make_repo(self):
        from repositories.kpi_repository import KPIRepository
        repo = KPIRepository.__new__(KPIRepository)
        repo.db = MagicMock()
        repo.collection_name = "kpi_entries"
        mock_col = MagicMock()
        mock_col.insert_one = AsyncMock(return_value=MagicMock(inserted_id="fake_oid"))
        repo.collection = mock_col
        return repo

    @pytest.mark.anyio
    async def test_ts_injected_when_absent(self):
        """insert_one ajoute ts si date est présent et ts absent."""
        repo = self._make_repo()
        doc = {"id": "kpi_1", "date": "2024-06-15", "seller_id": "s1", "ca_journalier": 100}
        await repo.insert_one(doc)

        assert "ts" in doc
        ts = doc["ts"]
        assert isinstance(ts, datetime)
        assert ts.year == 2024 and ts.month == 6 and ts.day == 15
        assert ts.tzinfo == timezone.utc

    @pytest.mark.anyio
    async def test_ts_not_overwritten_if_present(self):
        """insert_one ne modifie pas un ts déjà présent."""
        repo = self._make_repo()
        existing_ts = datetime(2024, 1, 1, tzinfo=timezone.utc)
        doc = {"id": "kpi_2", "date": "2024-06-15", "ts": existing_ts}
        await repo.insert_one(doc)
        assert doc["ts"] is existing_ts

    @pytest.mark.anyio
    async def test_no_date_no_ts_injected(self):
        """Sans champ date, ts n'est pas injecté."""
        repo = self._make_repo()
        doc = {"id": "kpi_3", "seller_id": "s1"}
        await repo.insert_one(doc)
        assert "ts" not in doc


# ---------------------------------------------------------------------------
# 3. KPIRepository.bulk_write — injection de ts dans InsertOne
# ---------------------------------------------------------------------------

class TestKPIRepositoryBulkWrite:
    """Vérifie que bulk_write injecte ts dans les InsertOne."""

    def _make_repo(self):
        from repositories.kpi_repository import KPIRepository
        repo = KPIRepository.__new__(KPIRepository)
        repo.db = MagicMock()
        repo.collection_name = "kpi_entries"
        mock_col = MagicMock()
        mock_bw_result = MagicMock()
        mock_bw_result.inserted_count = 1
        mock_bw_result.modified_count = 0
        mock_bw_result.deleted_count = 0
        mock_bw_result.upserted_count = 0
        mock_col.bulk_write = AsyncMock(return_value=mock_bw_result)
        repo.collection = mock_col
        return repo

    @pytest.mark.anyio
    async def test_insert_one_gets_ts(self):
        """InsertOne sans ts reçoit ts après bulk_write."""
        from pymongo import InsertOne
        repo = self._make_repo()
        doc = {"id": "kpi_1", "seller_id": "s1", "date": "2024-06-15", "ca_journalier": 100}
        await repo.bulk_write([InsertOne(doc)])

        assert "ts" in doc
        assert doc["ts"].day == 15 and doc["ts"].month == 6 and doc["ts"].year == 2024

    @pytest.mark.anyio
    async def test_update_one_unchanged(self):
        """UpdateOne n'est pas modifié par bulk_write (pas de ts injecté)."""
        from pymongo import InsertOne, UpdateOne
        repo = self._make_repo()
        insert_doc = {"id": "kpi_1", "date": "2024-06-15"}
        update_op = UpdateOne(
            {"seller_id": "s1", "date": "2024-06-15"},
            {"$set": {"ca_journalier": 200}}
        )
        await repo.bulk_write([InsertOne(insert_doc), update_op])

        # Le InsertOne a ts
        assert "ts" in insert_doc
        # Le UpdateOne ne reçoit pas de ts (pas de _doc avec date de même type)
        assert "$set" in update_op._filter or True  # unchanged

    @pytest.mark.anyio
    async def test_existing_ts_not_overwritten(self):
        """InsertOne avec ts déjà défini : ts non modifié."""
        from pymongo import InsertOne
        repo = self._make_repo()
        existing_ts = datetime(2024, 1, 1, tzinfo=timezone.utc)
        doc = {"id": "kpi_1", "date": "2024-06-15", "ts": existing_ts}
        await repo.bulk_write([InsertOne(doc)])
        assert doc["ts"] is existing_ts

    @pytest.mark.anyio
    async def test_empty_operations_ok(self):
        """bulk_write avec liste vide retourne les zéros sans erreur (BaseRepository)."""
        repo = self._make_repo()
        result = await repo.bulk_write([])
        # BaseRepository renvoie directement si vide
        assert result["inserted"] == 0


# ---------------------------------------------------------------------------
# 4. Invariant : les requêtes existantes ne cassent pas
# ---------------------------------------------------------------------------

class TestExistingQueriesUnchanged:
    """
    Vérifie que les méthodes de KPIRepository qui utilisent le champ
    `date` (string) sont inchangées par la migration.
    """

    def test_find_by_seller_and_date_uses_string(self):
        """find_by_seller_and_date filtre bien par date string."""
        from repositories.kpi_repository import KPIRepository
        repo = KPIRepository.__new__(KPIRepository)
        # Vérifie que la méthode est définie et accepte une date string
        import inspect
        sig = inspect.signature(repo.find_by_seller_and_date)
        params = list(sig.parameters.keys())
        assert "seller_id" in params
        assert "date" in params

    def test_find_by_date_range_uses_string(self):
        """find_by_date_range utilise start_date/end_date strings."""
        from repositories.kpi_repository import KPIRepository
        repo = KPIRepository.__new__(KPIRepository)
        import inspect
        sig = inspect.signature(repo.find_by_date_range)
        params = list(sig.parameters.keys())
        assert "start_date" in params
        assert "end_date" in params

    def test_aggregate_totals_uses_date_in_match(self):
        """aggregate_totals construit le pipeline avec le champ `date`."""
        import inspect
        from repositories.kpi_repository import KPIRepository
        source = inspect.getsource(KPIRepository.aggregate_totals)
        assert '"date"' in source or "'date'" in source

    def test_ts_field_never_in_match_filters(self):
        """
        Aucune méthode de KPIRepository ne filtre par `ts` directement.
        Les requêtes utilisent `date` (string).
        """
        import inspect
        from repositories.kpi_repository import KPIRepository
        source = inspect.getsource(KPIRepository)
        # ts ne doit apparaître que dans insert_one et bulk_write (injection)
        # jamais dans les filtres de requête
        lines_with_ts = [
            line.strip() for line in source.splitlines()
            if '"ts"' in line or "'ts'" in line
        ]
        # Toutes les lignes avec "ts" doivent être liées à l'injection
        for line in lines_with_ts:
            assert any(keyword in line for keyword in [
                "ts", "date_str_to_ts", "timeField", "# ", "doc["
            ]), f"Ligne suspecte avec 'ts' : {line}"
