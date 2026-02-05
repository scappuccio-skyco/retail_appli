"""
Tests de sécurité IDOR - Vérification de l'isolation des données par store_id

Ces tests vérifient qu'un utilisateur ne peut jamais accéder aux données
d'un autre magasin, même en manipulant les IDs dans les URLs.
"""
import pytest
from fastapi.testclient import TestClient
from backend.main import app
from backend.core.database import get_db
from backend.core.security import create_token, get_password_hash
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os

# Configuration de test
TEST_MONGO_URL = os.environ.get("TEST_MONGO_URL", "mongodb://localhost:27017")
TEST_DB_NAME = "retail_coach_test"
TEST_USER_PASSWORD = os.environ.get("TEST_USER_PASSWORD", "default_test_pwd")
# Hash pour les documents de test (évite alertes Hardcoded Passwords)
_TEST_PASSWORD_HASH = get_password_hash(TEST_USER_PASSWORD)

client = TestClient(app)


@pytest.fixture
async def test_db():
    """Fixture pour créer une connexion de test à MongoDB"""
    test_client = AsyncIOMotorClient(TEST_MONGO_URL)
    test_db = test_client[TEST_DB_NAME]
    yield test_db
    await test_client.drop_database(TEST_DB_NAME)
    test_client.close()


@pytest.fixture
async def setup_test_data(test_db):
    """Fixture pour créer des données de test (2 stores, 2 managers, 2 sellers)"""
    # Store A
    store_a = {
        "id": "store_a_test",
        "name": "Magasin A",
        "gerant_id": "gerant_a_test",
        "active": True
    }
    
    # Store B
    store_b = {
        "id": "store_b_test",
        "name": "Magasin B",
        "gerant_id": "gerant_b_test",
        "active": True
    }
    
    # Manager A (Store A)
    manager_a = {
        "id": "manager_a_test",
        "email": "manager_a@test.com",
        "name": "Manager A",
        "role": "manager",
        "store_id": "store_a_test",
        "password": _TEST_PASSWORD_HASH
    }
    
    # Manager B (Store B)
    manager_b = {
        "id": "manager_b_test",
        "email": "manager_b@test.com",
        "name": "Manager B",
        "role": "manager",
        "store_id": "store_b_test",
        "password": _TEST_PASSWORD_HASH
    }
    
    # Seller A (Store A)
    seller_a = {
        "id": "seller_a_test",
        "email": "seller_a@test.com",
        "name": "Seller A",
        "role": "seller",
        "store_id": "store_a_test",
        "manager_id": "manager_a_test",
        "password": _TEST_PASSWORD_HASH
    }
    
    # Seller B (Store B)
    seller_b = {
        "id": "seller_b_test",
        "email": "seller_b@test.com",
        "name": "Seller B",
        "role": "seller",
        "store_id": "store_b_test",
        "manager_id": "manager_b_test",
        "password": _TEST_PASSWORD_HASH
    }
    
    # Objective A (Store A)
    objective_a = {
        "id": "objective_a_test",
        "title": "Objectif Store A",
        "store_id": "store_a_test",
        "target_value": 1000,
        "current_value": 500,
        "status": "active",
        "visible": True
    }
    
    # Objective B (Store B)
    objective_b = {
        "id": "objective_b_test",
        "title": "Objectif Store B",
        "store_id": "store_b_test",
        "target_value": 2000,
        "current_value": 1000,
        "status": "active",
        "visible": True
    }
    
    # Insert test data
    await test_db.stores.insert_one(store_a)
    await test_db.stores.insert_one(store_b)
    await test_db.users.insert_one(manager_a)
    await test_db.users.insert_one(manager_b)
    await test_db.users.insert_one(seller_a)
    await test_db.users.insert_one(seller_b)
    await test_db.objectives.insert_one(objective_a)
    await test_db.objectives.insert_one(objective_b)
    
    return {
        "store_a": store_a,
        "store_b": store_b,
        "manager_a": manager_a,
        "manager_b": manager_b,
        "seller_a": seller_a,
        "seller_b": seller_b,
        "objective_a": objective_a,
        "objective_b": objective_b
    }


def get_auth_token(user_id: str, email: str, role: str) -> str:
    """Helper pour créer un token JWT de test"""
    return create_token(user_id, email, role)


class TestIDORSecurity:
    """Tests de sécurité IDOR"""
    
    @pytest.mark.asyncio
    async def test_manager_cannot_access_other_store_objective(self, test_db, setup_test_data):
        """
        Test IDOR 1: Manager A ne peut pas accéder à un objectif du Store B
        """
        data = await setup_test_data
        
        # Token pour Manager A (Store A)
        token = get_auth_token(
            data["manager_a"]["id"],
            data["manager_a"]["email"],
            data["manager_a"]["role"]
        )
        
        headers = {"Authorization": f"Bearer {token}"}
        
        # Tentative d'accès à l'objectif du Store B
        response = client.post(
            f"/api/manager/objectives/{data['objective_b']['id']}/progress",
            headers=headers,
            json={"value": 100}
        )
        
        # Doit retourner 403 ou 404 (accès refusé)
        assert response.status_code in [403, 404], \
            f"Expected 403/404, got {response.status_code}: {response.json()}"
    
    @pytest.mark.asyncio
    async def test_manager_cannot_access_other_store_seller(self, test_db, setup_test_data):
        """
        Test IDOR 2: Manager A ne peut pas accéder aux stats d'un seller du Store B
        """
        data = await setup_test_data
        
        # Token pour Manager A (Store A)
        token = get_auth_token(
            data["manager_a"]["id"],
            data["manager_a"]["email"],
            data["manager_a"]["role"]
        )
        
        headers = {"Authorization": f"Bearer {token}"}
        
        # Tentative d'accès aux stats du Seller B (Store B)
        response = client.get(
            f"/api/manager/seller/{data['seller_b']['id']}/stats",
            headers=headers
        )
        
        # Doit retourner 403 ou 404
        assert response.status_code in [403, 404], \
            f"Expected 403/404, got {response.status_code}: {response.json()}"
    
    @pytest.mark.asyncio
    async def test_seller_cannot_access_other_store_objective(self, test_db, setup_test_data):
        """
        Test IDOR 3: Seller A ne peut pas mettre à jour un objectif du Store B
        """
        data = await setup_test_data
        
        # Token pour Seller A (Store A)
        token = get_auth_token(
            data["seller_a"]["id"],
            data["seller_a"]["email"],
            data["seller_a"]["role"]
        )
        
        headers = {"Authorization": f"Bearer {token}"}
        
        # Tentative de mise à jour de l'objectif du Store B
        response = client.post(
            f"/api/seller/objectives/{data['objective_b']['id']}/progress",
            headers=headers,
            json={"value": 100}
        )
        
        # Doit retourner 403 ou 404
        assert response.status_code in [403, 404], \
            f"Expected 403/404, got {response.status_code}: {response.json()}"
    
    @pytest.mark.asyncio
    async def test_gerant_cannot_access_other_gerant_store(self, test_db, setup_test_data):
        """
        Test IDOR 4: Gérant A ne peut pas accéder au Store B (même avec store_id en paramètre)
        """
        data = await setup_test_data
        
        # Créer un gérant A
        gerant_a = {
            "id": "gerant_a_test",
            "email": "gerant_a@test.com",
            "name": "Gérant A",
            "role": "gerant",
            "password": _TEST_PASSWORD_HASH
        }
        await test_db.users.insert_one(gerant_a)
        
        # Token pour Gérant A
        token = get_auth_token(
            gerant_a["id"],
            gerant_a["email"],
            gerant_a["role"]
        )
        
        headers = {"Authorization": f"Bearer {token}"}
        
        # Tentative d'accès au Store B avec store_id en paramètre
        response = client.get(
            f"/api/manager/objectives?store_id={data['store_b']['id']}",
            headers=headers
        )
        
        # Doit retourner 403 (le gérant ne possède pas ce store)
        assert response.status_code == 403, \
            f"Expected 403, got {response.status_code}: {response.json()}"
    
    @pytest.mark.asyncio
    async def test_manager_can_access_own_store_data(self, test_db, setup_test_data):
        """
        Test positif: Manager A peut accéder aux données de son propre store
        """
        data = await setup_test_data
        
        # Token pour Manager A (Store A)
        token = get_auth_token(
            data["manager_a"]["id"],
            data["manager_a"]["email"],
            data["manager_a"]["role"]
        )
        
        headers = {"Authorization": f"Bearer {token}"}
        
        # Accès à l'objectif du Store A (devrait fonctionner)
        response = client.get(
            f"/api/manager/objectives",
            headers=headers
        )
        
        # Doit retourner 200
        assert response.status_code == 200, \
            f"Expected 200, got {response.status_code}: {response.json()}"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
