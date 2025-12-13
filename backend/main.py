"""Main FastAPI Application Entry Point"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging

from core.config import settings
from core.database import database
from api.routes import routers

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title="Retail Performer AI",
    description="API for retail performance management and AI-powered insights",
    version="2.0.0",
    debug=settings.DEBUG,
    docs_url="/docs" if settings.ENVIRONMENT != "production" else None,
    redoc_url="/redoc" if settings.ENVIRONMENT != "production" else None
)

# Configure CORS - CRITICAL for production
# Parse CORS origins from environment
if settings.CORS_ORIGINS == "*":
    # Wildcard not allowed with credentials
    logger.warning("CORS_ORIGINS set to '*' - this is insecure and may not work with credentials!")
    allowed_origins = ["*"]
else:
    # Parse comma-separated list and strip whitespace
    allowed_origins = [origin.strip() for origin in settings.CORS_ORIGINS.split(",")]

logger.info(f"CORS allowed origins: {allowed_origins}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include all routers
for router in routers:
    app.include_router(router, prefix="/api")
    logger.info(f"Registered router: {router.prefix} ({len(router.routes)} routes)")

# Startup event
@app.on_event("startup")
async def startup_event():
    """
    Initialize application on startup
    - Connect to MongoDB
    - Create indexes (only if needed)
    - Initialize default admin user
    """
    import os
    worker_id = os.getpid()
    
    try:
        logger.info(f"Starting application (worker PID: {worker_id})...")
        
        # Connect to MongoDB with retry logic
        max_retries = 3
        retry_delay = 2
        
        for attempt in range(max_retries):
            try:
                await database.connect()
                logger.info("✅ MongoDB connection established")
                break
            except Exception as e:
                if attempt < max_retries - 1:
                    logger.warning(f"MongoDB connection attempt {attempt + 1} failed: {e}, retrying in {retry_delay}s...")
                    import asyncio
                    await asyncio.sleep(retry_delay)
                    retry_delay *= 2
                else:
                    raise
        
        # Create indexes for performance (TÂCHE 3: Index stripe_customer_id)
        try:
            db = database.db
            
            # Index on stripe_customer_id for fast webhook lookups
            await db.users.create_index("stripe_customer_id", sparse=True)
            logger.info("✅ Index created: users.stripe_customer_id")
            
            # Index on subscriptions for fast lookups
            await db.subscriptions.create_index("stripe_customer_id", sparse=True)
            await db.subscriptions.create_index("stripe_subscription_id", sparse=True)
            logger.info("✅ Index created: subscriptions.stripe_customer_id, stripe_subscription_id")
            
            # Index on workspaces
            await db.workspaces.create_index("stripe_customer_id", sparse=True)
            logger.info("✅ Index created: workspaces.stripe_customer_id")
            
        except Exception as e:
            logger.warning(f"Index creation warning (may already exist): {e}")
        
        # Initialize database (create default admin if needed)
        try:
            from init_db import init_database
            init_database()
            logger.info("✅ Database initialization complete")
        except Exception as e:
            logger.warning(f"Database initialization warning: {e}")
        
        logger.info("🚀 Application startup complete")
        
    except Exception as e:
        logger.error(f"❌ Startup failed: {e}")
        raise

# Shutdown event
@app.on_event("shutdown")
async def shutdown_event():
    """
    Cleanup on application shutdown
    - Close MongoDB connection
    """
    try:
        await database.disconnect()
        logger.info("MongoDB connection closed")
    except Exception as e:
        logger.error(f"Error during shutdown: {e}")

# Health check endpoint
@app.get("/health")
async def health_check():
    """Simple health check endpoint"""
    return {
        "status": "healthy",
        "version": "2.0.0",
        "environment": settings.ENVIRONMENT
    }

# Root endpoint
@app.get("/")
async def root():
    """API root endpoint"""
    return {
        "message": "Retail Performer AI API",
        "version": "2.0.0",
        "docs": "/docs" if settings.ENVIRONMENT != "production" else "Contact admin for documentation"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8001,
        reload=True if settings.ENVIRONMENT == "development" else False
    )
