"""
conftest.py — Configuration pytest pour les tests unitaires backend.

Injecte les variables d'environnement requises par pydantic-settings
AVANT que les modules de l'application soient importés. Sans ces stubs,
core/config.py lève une ValidationError au chargement.

Ces valeurs sont fictives et ne se connectent à rien : le but est de
permettre les imports pour les tests unitaires (qui mockent les dépendances).
"""
import sys
import os
from unittest.mock import MagicMock

# Stub optional third-party modules not installed in unit-test environment.
# CI installs the real packages; locally these stubs allow imports to succeed.
for _stub in ("sib_api_v3_sdk", "sib_api_v3_sdk.rest", "sib_api_v3_sdk.api",
              "sib_api_v3_sdk.api.transactional_emails_api",
              "sib_api_v3_sdk.models", "sib_api_v3_sdk.configuration"):
    if _stub not in sys.modules:
        sys.modules[_stub] = MagicMock()

_TEST_ENV = {
    "MONGO_URL": "mongodb://localhost:27017/test_retail",
    "JWT_SECRET": "test-jwt-secret-not-real-32chars!!",
    "OPENAI_API_KEY": "sk-test-not-real",
    "STRIPE_API_KEY": "sk_test_not_real",
    "STRIPE_WEBHOOK_SECRET": "whsec_test_not_real",
    "BREVO_API_KEY": "test-brevo-not-real",
    "STRIPE_PRICE_ID_MONTHLY": "price_test_monthly",
    "STRIPE_PRICE_ID_YEARLY": "price_test_yearly",
    "FRONTEND_URL": "http://localhost:3000",
    "ADMIN_CREATION_SECRET": "test-admin-secret-not-real",
    "DEFAULT_ADMIN_EMAIL": "admin@test.local",
    "DEFAULT_ADMIN_PASSWORD": "TestAdminPass123!",
}

for key, value in _TEST_ENV.items():
    os.environ.setdefault(key, value)

# anyio: utiliser uniquement asyncio (trio n'est pas dans les deps de prod)
import pytest

@pytest.fixture(params=["asyncio"])
def anyio_backend(request):
    return request.param
