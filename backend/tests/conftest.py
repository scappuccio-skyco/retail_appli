"""
conftest.py — Configuration pytest pour les tests unitaires backend.

Injecte les variables d'environnement requises par pydantic-settings
AVANT que les modules de l'application soient importés. Sans ces stubs,
core/config.py lève une ValidationError au chargement.

Ces valeurs sont fictives et ne se connectent à rien : le but est de
permettre les imports pour les tests unitaires (qui mockent les dépendances).
"""
import os

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
