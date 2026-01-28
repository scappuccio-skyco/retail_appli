"""
Unit tests for PaymentTransactionRepository (Phase 5 - Preuve de testabilité).

Preuve que l'architecture est découplée : le repository est testé avec unittest.mock
(mock de la DB), sans connexion MongoDB réelle. Instanciation et appels à la collection
sont vérifiés via les mocks.

Exécution (depuis backend/ avec dépendances installées):
  - unittest: python -m unittest tests.test_payment_repository.TestPaymentTransactionRepositoryUnittest -v
  - pytest: pytest tests/test_payment_repository.py -v
"""
from unittest.mock import MagicMock, AsyncMock
import sys
import os

if os.path.dirname(os.path.dirname(os.path.abspath(__file__))) not in sys.path:
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from repositories.payment_transaction_repository import PaymentTransactionRepository

try:
    import pytest
    HAS_PYTEST = True
except ImportError:
    HAS_PYTEST = False
    pytest = None


def _make_mock_db():
    """Mock MongoDB database (Motor AsyncIOMotorDatabase)."""
    db = MagicMock()
    mock_collection = MagicMock()
    db.__getitem__.return_value = mock_collection
    return db


# --- Tests exécutables avec unittest (sans dépendance pytest) ---
import unittest


class TestPaymentTransactionRepositoryUnittest(unittest.TestCase):
    """Tests unitaires avec unittest.mock : DB mockée, pas de MongoDB réel."""

    def setUp(self):
        self.mock_db = MagicMock()
        self.mock_collection = MagicMock()
        self.mock_db.__getitem__.return_value = self.mock_collection
        self.repo = PaymentTransactionRepository(self.mock_db)

    def test_instanciation_uses_collection_name(self):
        self.assertEqual(self.repo.collection_name, "payment_transactions")
        self.assertIs(self.repo.db, self.mock_db)

    def test_collection_access_calls_db_getitem(self):
        _ = self.repo.collection
        self.mock_db.__getitem__.assert_called_once_with("payment_transactions")

    def test_is_base_repository_subclass(self):
        from repositories.base_repository import BaseRepository
        self.assertTrue(issubclass(PaymentTransactionRepository, BaseRepository))


# --- Tests pytest (optionnels, si pytest installé) ---
if HAS_PYTEST:
    @pytest.fixture
    def mock_db():
        return _make_mock_db()

    @pytest.fixture
    def repo(mock_db):
        return PaymentTransactionRepository(mock_db)

    def test_repo_instanciation(repo, mock_db):
        assert repo is not None
        assert repo.db is mock_db
        assert repo.collection_name == "payment_transactions"

    def test_repo_uses_correct_collection(repo, mock_db):
        _ = repo.collection
        mock_db.__getitem__.assert_called_with("payment_transactions")

    @pytest.mark.asyncio
    async def test_repo_find_one_delegates_to_base(repo, mock_db):
        repo.collection.find_one = AsyncMock(return_value={"id": "tx-1", "amount": 100})
        result = await repo.find_one({"id": "tx-1"})
        assert result == {"id": "tx-1", "amount": 100}
        repo.collection.find_one.assert_called_once()

    @pytest.mark.asyncio
    async def test_repo_insert_one_delegates_to_base(repo, mock_db):
        doc = {"id": "tx-new", "user_id": "u1", "amount": 50}
        repo.collection.insert_one = AsyncMock(
            return_value=MagicMock(inserted_id="tx-new")
        )
        result = await repo.insert_one(doc)
        assert result == "tx-new"
        repo.collection.insert_one.assert_called_once()
