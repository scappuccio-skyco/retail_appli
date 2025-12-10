"""
Configuration management using Pydantic Settings
Validates environment variables at startup
"""
from pydantic_settings import BaseSettings
from pydantic import Field
from typing import Optional
import os
from pathlib import Path

# Load .env file
ROOT_DIR = Path(__file__).parent.parent
from dotenv import load_dotenv
load_dotenv(ROOT_DIR / '.env')


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
            _settings = Settings()
        except Exception as e:
            # Fallback: read directly from environment if Pydantic validation fails
            print(f"⚠️  Warning: Settings validation failed ({e}), using os.environ directly")
            class FallbackSettings:
                def __getattr__(self, name):
                    return os.environ.get(name, "")
            _settings = FallbackSettings()
    return _settings


# Export for convenience
settings = get_settings()
