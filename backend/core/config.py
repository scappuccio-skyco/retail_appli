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
    Get application settings (singleton pattern).
    Validates all required environment variables at first call.
    If validation fails, raises immediately — no fallback (fail-fast at startup).
    """
    global _settings
    if _settings is not None:
        return _settings
    _settings = Settings()
    return _settings


# Single point of access: module-level export calls get_settings() once at import
settings = get_settings()
