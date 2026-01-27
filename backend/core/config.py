"""
Configuration management using Pydantic Settings
Validates environment variables at startup
"""
import os
from pathlib import Path

from pydantic_settings import BaseSettings
from pydantic import Field
from typing import Optional

# Load .env file - IMPORTANT: override=False ensures Kubernetes-injected env vars take precedence
ROOT_DIR = Path(__file__).parent.parent
from dotenv import load_dotenv
load_dotenv(ROOT_DIR / '.env', override=False)


class Settings(BaseSettings):
    """Application settings with validation"""
    
    # Database
    MONGO_URL: str = Field(..., description="MongoDB connection URL")
    DB_NAME: str = Field(default="retail_coach", description="Database name")
    MONGO_MAX_POOL_SIZE: int = Field(default=50, description="Maximum MongoDB connection pool size (production: 50-100)")
    MONGO_MIN_POOL_SIZE: int = Field(default=1, description="Minimum MongoDB connection pool size")
    MONGO_CONNECT_TIMEOUT_MS: int = Field(default=5000, description="MongoDB connection timeout in milliseconds")
    MONGO_SOCKET_TIMEOUT_MS: int = Field(default=30000, description="MongoDB socket timeout in milliseconds")
    MONGO_SERVER_SELECTION_TIMEOUT_MS: int = Field(default=5000, description="MongoDB server selection timeout in milliseconds")
    
    # Cache (Redis)
    REDIS_URL: Optional[str] = Field(default=None, description="Redis connection URL (e.g., redis://localhost:6379/0). If not provided, cache is disabled (graceful fallback)")
    REDIS_ENABLED: bool = Field(default=True, description="Enable Redis cache (set to False to disable even if REDIS_URL is set)")
    
    # Security
    JWT_SECRET: str = Field(..., description="JWT secret key for token signing")
    CORS_ORIGINS: str = Field(default="*", description="Allowed CORS origins")
    API_RATE_LIMIT: int = Field(default=60, description="API rate limit per minute")
    
    # External Services
    OPENAI_API_KEY: str = Field(..., description="OpenAI API key")
    STRIPE_API_KEY: str = Field(..., description="Stripe API key")
    STRIPE_WEBHOOK_SECRET: str = Field(..., description="Stripe webhook secret")
    BREVO_API_KEY: str = Field(..., description="Brevo (Sendinblue) API key")
    
    # Stripe Price IDs (single product with tiered pricing)
    STRIPE_PRICE_ID_MONTHLY: str = Field(..., description="Stripe Price ID for monthly subscription (tiered pricing)")
    STRIPE_PRICE_ID_YEARLY: str = Field(..., description="Stripe Price ID for yearly subscription (tiered pricing)")
    
    # Email Configuration
    SENDER_EMAIL: str = Field(default="hello@retailperformerai.com")
    SENDER_NAME: str = Field(default="Retail Performer AI")
    
    # URLs
    FRONTEND_URL: str = Field(..., description="Frontend application URL")
    BACKEND_URL: Optional[str] = Field(default=None, description="Backend URL (optional)")
    
    # Admin Configuration
    ADMIN_CREATION_SECRET: str = Field(..., description="Secret for admin creation")
    DEFAULT_ADMIN_EMAIL: str = Field(..., description="Default admin email")
    DEFAULT_ADMIN_PASSWORD: str = Field(..., description="Default admin password")
    DEFAULT_ADMIN_NAME: str = Field(default="Super Admin")
    
    # Application
    ENVIRONMENT: str = Field(default="development", description="Environment: development, staging, production")
    DEBUG: bool = Field(default=False, description="Debug mode")
    
    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "allow"  # Allow extra fields for flexibility


# Singleton instance
_settings = None

def get_settings() -> Settings:
    """
    Get application settings (singleton pattern)
    Validates all required environment variables at first call
    """
    global _settings
    if _settings is not None:
        return _settings

    try:
        _settings = Settings()
        return _settings
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)

        env = os.environ.get("ENVIRONMENT", "development").lower()

        # ✅ FAIL-FAST en production
        if env == "production":
            logger.error(f"❌ Settings validation failed in production: {e}")
            raise

        # ✅ Fallback uniquement hors prod
        logger.warning(f"⚠️ Settings validation failed ({e}), using os.environ fallback (env={env})")

        class FallbackSettings:
            ENVIRONMENT = os.environ.get("ENVIRONMENT", "development")
            DEBUG = os.environ.get("DEBUG", "false").lower() == "true"
            CORS_ORIGINS = os.environ.get("CORS_ORIGINS", "*")
            MONGO_URL = os.environ.get("MONGO_URL", "")
            DB_NAME = os.environ.get("DB_NAME", "retail_coach")
            MONGO_MAX_POOL_SIZE = int(os.environ.get("MONGO_MAX_POOL_SIZE", "50"))
            MONGO_MIN_POOL_SIZE = int(os.environ.get("MONGO_MIN_POOL_SIZE", "1"))
            MONGO_CONNECT_TIMEOUT_MS = int(os.environ.get("MONGO_CONNECT_TIMEOUT_MS", "5000"))
            MONGO_SOCKET_TIMEOUT_MS = int(os.environ.get("MONGO_SOCKET_TIMEOUT_MS", "30000"))
            MONGO_SERVER_SELECTION_TIMEOUT_MS = int(os.environ.get("MONGO_SERVER_SELECTION_TIMEOUT_MS", "5000"))
            REDIS_URL = os.environ.get("REDIS_URL")
            REDIS_ENABLED = os.environ.get("REDIS_ENABLED", "true").lower() == "true"
            JWT_SECRET = os.environ.get("JWT_SECRET", "")
            API_RATE_LIMIT = int(os.environ.get("API_RATE_LIMIT", "60"))

            OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")
            STRIPE_API_KEY = os.environ.get("STRIPE_API_KEY", "")
            STRIPE_WEBHOOK_SECRET = os.environ.get("STRIPE_WEBHOOK_SECRET", "")
            BREVO_API_KEY = os.environ.get("BREVO_API_KEY", "")

            STRIPE_PRICE_ID_MONTHLY = os.environ.get("STRIPE_PRICE_ID_MONTHLY", "")
            STRIPE_PRICE_ID_YEARLY = os.environ.get("STRIPE_PRICE_ID_YEARLY", "")

            SENDER_EMAIL = os.environ.get("SENDER_EMAIL", "hello@retailperformerai.com")
            SENDER_NAME = os.environ.get("SENDER_NAME", "Retail Performer AI")

            FRONTEND_URL = os.environ.get("FRONTEND_URL", "")
            BACKEND_URL = os.environ.get("BACKEND_URL")  # None si absent

            ADMIN_CREATION_SECRET = os.environ.get("ADMIN_CREATION_SECRET", "")
            DEFAULT_ADMIN_EMAIL = os.environ.get("DEFAULT_ADMIN_EMAIL", "")
            DEFAULT_ADMIN_PASSWORD = os.environ.get("DEFAULT_ADMIN_PASSWORD", "")
            DEFAULT_ADMIN_NAME = os.environ.get("DEFAULT_ADMIN_NAME", "Super Admin")

            def __getattr__(self, name):
                return os.environ.get(name, "")

        _settings = FallbackSettings()
        return _settings


# Export for convenience
settings = get_settings()
