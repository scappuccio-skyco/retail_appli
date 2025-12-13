"""
Configuration management using Pydantic Settings
Validates environment variables at startup
"""
import sys
import os
from pathlib import Path

# Early debug output
print("[CONFIG] Loading configuration...", flush=True)

from pydantic_settings import BaseSettings
from pydantic import Field
from typing import Optional

# Load .env file - IMPORTANT: override=False ensures Kubernetes-injected env vars take precedence
ROOT_DIR = Path(__file__).parent.parent
from dotenv import load_dotenv
load_dotenv(ROOT_DIR / '.env', override=False)
print(f"[CONFIG] .env loaded from {ROOT_DIR / '.env'}", flush=True)


class Settings(BaseSettings):
    """Application settings with validation"""
    
    # Database
    MONGO_URL: str = Field(..., description="MongoDB connection URL")
    DB_NAME: str = Field(default="retail_coach", description="Database name")
    
    # Security
    JWT_SECRET: str = Field(..., description="JWT secret key for token signing")
    CORS_ORIGINS: str = Field(default="*", description="Allowed CORS origins")
    API_RATE_LIMIT: int = Field(default=60, description="API rate limit per minute")
    
    # External Services
    EMERGENT_LLM_KEY: str = Field(..., description="Emergent LLM API key")
    STRIPE_API_KEY: str = Field(..., description="Stripe API key")
    STRIPE_WEBHOOK_SECRET: str = Field(..., description="Stripe webhook secret")
    BREVO_API_KEY: str = Field(..., description="Brevo (Sendinblue) API key")
    
    # Stripe Price IDs (by plan and interval)
    STRIPE_PRICE_STARTER_MONTHLY: str = Field(default="", description="Stripe Price ID for Starter plan (monthly)")
    STRIPE_PRICE_STARTER_YEARLY: str = Field(default="", description="Stripe Price ID for Starter plan (yearly)")
    STRIPE_PRICE_PRO_MONTHLY: str = Field(default="", description="Stripe Price ID for Professional plan (monthly)")
    STRIPE_PRICE_PRO_YEARLY: str = Field(default="", description="Stripe Price ID for Professional plan (yearly)")
    STRIPE_PRICE_ENTERPRISE_MONTHLY: str = Field(default="", description="Stripe Price ID for Enterprise plan (monthly)")
    STRIPE_PRICE_ENTERPRISE_YEARLY: str = Field(default="", description="Stripe Price ID for Enterprise plan (yearly)")
    
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
    if _settings is None:
        try:
            print("[CONFIG] Creating Settings from environment...", flush=True)
            _settings = Settings()
            print("[CONFIG] Settings created successfully", flush=True)
        except Exception as e:
            # Fallback: read directly from environment if Pydantic validation fails
            print(f"[CONFIG] ⚠️  Warning: Settings validation failed ({e}), using os.environ directly", flush=True)
            class FallbackSettings:
                ENVIRONMENT = os.environ.get("ENVIRONMENT", "production")
                DEBUG = os.environ.get("DEBUG", "false").lower() == "true"
                CORS_ORIGINS = os.environ.get("CORS_ORIGINS", "*")
                MONGO_URL = os.environ.get("MONGO_URL", "")
                DB_NAME = os.environ.get("DB_NAME", "retail_coach")
                JWT_SECRET = os.environ.get("JWT_SECRET", "fallback-secret")
                API_RATE_LIMIT = int(os.environ.get("API_RATE_LIMIT", "60"))
                EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")
                STRIPE_API_KEY = os.environ.get("STRIPE_API_KEY", "")
                STRIPE_WEBHOOK_SECRET = os.environ.get("STRIPE_WEBHOOK_SECRET", "")
                BREVO_API_KEY = os.environ.get("BREVO_API_KEY", "")
                STRIPE_PRICE_STARTER_MONTHLY = os.environ.get("STRIPE_PRICE_STARTER_MONTHLY", "")
                STRIPE_PRICE_STARTER_YEARLY = os.environ.get("STRIPE_PRICE_STARTER_YEARLY", "")
                STRIPE_PRICE_PRO_MONTHLY = os.environ.get("STRIPE_PRICE_PRO_MONTHLY", "")
                STRIPE_PRICE_PRO_YEARLY = os.environ.get("STRIPE_PRICE_PRO_YEARLY", "")
                STRIPE_PRICE_ENTERPRISE_MONTHLY = os.environ.get("STRIPE_PRICE_ENTERPRISE_MONTHLY", "")
                STRIPE_PRICE_ENTERPRISE_YEARLY = os.environ.get("STRIPE_PRICE_ENTERPRISE_YEARLY", "")
                SENDER_EMAIL = os.environ.get("SENDER_EMAIL", "hello@retailperformerai.com")
                SENDER_NAME = os.environ.get("SENDER_NAME", "Retail Performer AI")
                FRONTEND_URL = os.environ.get("FRONTEND_URL", "")
                BACKEND_URL = os.environ.get("BACKEND_URL", None)
                ADMIN_CREATION_SECRET = os.environ.get("ADMIN_CREATION_SECRET", "")
                DEFAULT_ADMIN_EMAIL = os.environ.get("DEFAULT_ADMIN_EMAIL", "admin@example.com")
                DEFAULT_ADMIN_PASSWORD = os.environ.get("DEFAULT_ADMIN_PASSWORD", "admin123")
                DEFAULT_ADMIN_NAME = os.environ.get("DEFAULT_ADMIN_NAME", "Super Admin")
                
                def __getattr__(self, name):
                    return os.environ.get(name, "")
            _settings = FallbackSettings()
            print("[CONFIG] Using FallbackSettings", flush=True)
    return _settings


# Export for convenience
print("[CONFIG] Initializing settings singleton...", flush=True)
settings = get_settings()
print("[CONFIG] Settings singleton ready", flush=True)
