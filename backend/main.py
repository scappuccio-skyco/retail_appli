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
    - Connect to MongoDB (with retry for Atlas)
    """
    import os
    import asyncio
    worker_id = os.getpid()
    
    try:
        logger.info(f"Starting application (worker PID: {worker_id})...")
        
        # Connect to MongoDB with retry logic - important for Atlas cold starts
        max_retries = 10
        retry_delay = 1
        
        for attempt in range(max_retries):
            try:
                await database.connect()
                logger.info(f"✅ MongoDB connection established (worker {worker_id})")
                break
            except Exception as e:
                if attempt < max_retries - 1:
                    logger.warning(f"MongoDB connection attempt {attempt + 1}/{max_retries} failed: {e}, retrying in {retry_delay}s...")
                    await asyncio.sleep(retry_delay)
                    retry_delay = min(retry_delay * 1.5, 5)  # Cap at 5 seconds
                else:
                    logger.error(f"Failed to connect to MongoDB after {max_retries} attempts: {e}")
                    # Don't raise - let the app start anyway, endpoints will fail gracefully
                    logger.warning("Application starting without database connection - endpoints will return errors")
        
        logger.info(f"🚀 Application startup complete (worker PID: {worker_id})")
        
    except Exception as e:
        logger.error(f"❌ Startup error (non-fatal): {e}")
        # Don't raise - allow health check to pass


# Background task to create indexes (runs after startup)
@app.on_event("startup")
async def create_indexes_background():
    """Create indexes in background after startup to not block health check"""
    import asyncio
    import os
    
    worker_id = os.getpid()
    
    # Delay to let health check pass first and DB connection stabilize
    await asyncio.sleep(5)
    
    try:
        db = database.db
        if db is None:
            logger.warning(f"Database not connected, skipping index creation (worker {worker_id})")
            return
        
        # Create indexes for performance - use background=True
        try:
            await db.users.create_index("stripe_customer_id", sparse=True, background=True)
            await db.subscriptions.create_index("stripe_customer_id", sparse=True, background=True)
            await db.subscriptions.create_index("stripe_subscription_id", sparse=True, background=True)
            await db.workspaces.create_index("stripe_customer_id", sparse=True, background=True)
            logger.info(f"✅ Database indexes created/verified (worker {worker_id})")
        except Exception as e:
            logger.warning(f"Index creation warning: {e}")
        
        # Initialize database (create default admin if needed) - only try once
        try:
            from init_db import init_database
            init_database()
            logger.info("✅ Database initialization complete")
        except Exception as e:
            logger.debug(f"Database initialization skipped: {e}")
            
    except Exception as e:
        logger.warning(f"Background init warning (worker {worker_id}): {e}")

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
