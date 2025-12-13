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
    - Create indexes (only on first worker to avoid conflicts)
    - Initialize default admin user
    """
    import os
    import asyncio
    worker_id = os.getpid()
    
    try:
        logger.info(f"Starting application (worker PID: {worker_id})...")
        
        # Connect to MongoDB with retry logic
        max_retries = 5
        retry_delay = 1
        
        for attempt in range(max_retries):
            try:
                await database.connect()
                logger.info("✅ MongoDB connection established")
                break
            except Exception as e:
                if attempt < max_retries - 1:
                    logger.warning(f"MongoDB connection attempt {attempt + 1} failed: {e}, retrying in {retry_delay}s...")
                    await asyncio.sleep(retry_delay)
                    retry_delay = min(retry_delay * 2, 10)  # Cap at 10 seconds
                else:
                    logger.error(f"Failed to connect to MongoDB after {max_retries} attempts")
                    raise
        
        logger.info(f"🚀 Application startup complete (worker PID: {worker_id})")
        
    except Exception as e:
        logger.error(f"❌ Startup failed: {e}")
        raise


# Background task to create indexes (runs after startup)
@app.on_event("startup")
async def create_indexes_background():
    """Create indexes in background after startup to not block health check"""
    import asyncio
    
    # Small delay to let health check pass first
    await asyncio.sleep(2)
    
    try:
        db = database.db
        
        # Create indexes for performance - use background=True
        await db.users.create_index("stripe_customer_id", sparse=True, background=True)
        await db.subscriptions.create_index("stripe_customer_id", sparse=True, background=True)
        await db.subscriptions.create_index("stripe_subscription_id", sparse=True, background=True)
        await db.workspaces.create_index("stripe_customer_id", sparse=True, background=True)
        
        logger.info("✅ Database indexes created/verified")
        
        # Initialize database (create default admin if needed)
        try:
            from init_db import init_database
            init_database()
            logger.info("✅ Database initialization complete")
        except Exception as e:
            logger.warning(f"Database initialization warning: {e}")
            
    except Exception as e:
        logger.warning(f"Index creation warning (may already exist): {e}")

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
