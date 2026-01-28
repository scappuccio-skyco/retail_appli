"""
Unit tests for PaymentTransactionRepository (Phase 5 - Preuve de testabilité).

Montre que la classe extraite en Phase 1 est isolée : on peut l'instancier
et la tester sans lancer toute l'app ni MongoDB.
"""
import pytest
from unittest.mock import MagicMock, AsyncMock

# Run from backend/ or add backend to path
import sys
import os
if os.path.dirname(os.path.dirname(os.path.abspath(__file__))) not in sys.path:
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from repositories.payment_transaction_repository import PaymentTransactionRepository


@pytest.fixture
def mock_db():
    """Mock MongoDB database (Motor AsyncIOMotorDatabase)."""
    db = MagicMock()
    # Simuler db["payment_transactions"] pour que repo.collection soit défini
    mock_collection = MagicMock()
    db.__getitem__.return_value = mock_collection
    return db


@pytest.fixture
def repo(mock_db):
    """PaymentTransactionRepository instance with mocked db."""
    return PaymentTransactionRepository(mock_db)


def test_repo_instanciation(repo, mock_db):
    """Repository s'instancie avec un db mock sans erreur."""
    assert repo is not None
    assert repo.db is mock_db
    assert repo.collection_name == "payment_transactions"


def test_repo_uses_correct_collection(repo, mock_db):
    """Le repository accède bien à la collection payment_transactions."""
    _ = repo.collection
    mock_db.__getitem__.assert_called_with("payment_transactions")


@pytest.mark.asyncio
async def test_repo_find_one_delegates_to_base(repo, mock_db):
    """find_one délègue au collection (héritage BaseRepository)."""
    repo.collection.find_one = AsyncMock(return_value={"id": "tx-1", "amount": 100})
    result = await repo.find_one({"id": "tx-1"})
    assert result == {"id": "tx-1", "amount": 100}
    repo.collection.find_one.assert_called_once()


@pytest.mark.asyncio
async def test_repo_insert_one_delegates_to_base(repo, mock_db):
    """insert_one délègue au collection (héritage BaseRepository)."""
    doc = {"id": "tx-new", "user_id": "u1", "amount": 50}
    repo.collection.insert_one = AsyncMock(return_value=MagicMock(inserted_id="tx-new"))
    result = await repo.insert_one(doc)
    assert result == "tx-new"
    repo.collection.insert_one.assert_called_once()


def test_repo_is_base_repository_subclass():
    """PaymentTransactionRepository hérite de BaseRepository."""
    from repositories.base_repository import BaseRepository
    assert issubclass(PaymentTransactionRepository, BaseRepository)
