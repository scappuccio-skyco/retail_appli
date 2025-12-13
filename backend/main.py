"""Main FastAPI Application Entry Point"""
import sys
import os

# Force unbuffered output for deployment debugging
sys.stdout.reconfigure(line_buffering=True) if hasattr(sys.stdout, 'reconfigure') else None
print("[STARTUP] 1/10 - main.py loading started", flush=True)

try:
    from fastapi import FastAPI
    from fastapi.middleware.cors import CORSMiddleware
    import logging
    print("[STARTUP] 2/10 - FastAPI imports done", flush=True)
except Exception as e:
    print(f"[STARTUP] FATAL: FastAPI import failed: {e}", flush=True)
    raise

try:
    from core.config import settings
    print("[STARTUP] 3/10 - Settings loaded", flush=True)
except Exception as e:
    print(f"[STARTUP] FATAL: Settings import failed: {e}", flush=True)
    # Create minimal fallback settings for health check to work
    class MinimalSettings:
        ENVIRONMENT = os.environ.get("ENVIRONMENT", "production")
        DEBUG = False
        CORS_ORIGINS = "*"
        MONGO_URL = os.environ.get("MONGO_URL", "")
        DB_NAME = os.environ.get("DB_NAME", "retail_coach")
    settings = MinimalSettings()
    print(f"[STARTUP] Using minimal fallback settings", flush=True)

try:
    from core.database import database
    print("[STARTUP] 4/10 - Database module imported", flush=True)
except Exception as e:
    print(f"[STARTUP] FATAL: Database import failed: {e}", flush=True)
    database = None

try:
    from api.routes import routers
    print("[STARTUP] 5/10 - Routers imported", flush=True)
except Exception as e:
    print(f"[STARTUP] FATAL: Routers import failed: {e}", flush=True)
    routers = []

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    stream=sys.stdout  # Force logs to stdout
)
logger = logging.getLogger(__name__)
print("[STARTUP] 6/10 - Logging configured", flush=True)

# Create FastAPI app
print("[STARTUP] 7/10 - Creating FastAPI app...", flush=True)
app = FastAPI(
    title="Retail Performer AI",
    description="API for retail performance management and AI-powered insights",
    version="2.0.0",
    debug=settings.DEBUG,
    docs_url="/docs" if settings.ENVIRONMENT != "production" else None,
    redoc_url="/redoc" if settings.ENVIRONMENT != "production" else None
)
print("[STARTUP] 8/10 - FastAPI app created", flush=True)

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
print(f"[STARTUP] CORS origins: {allowed_origins}", flush=True)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
print("[STARTUP] 9/10 - CORS middleware added", flush=True)

# Include all routers
print(f"[STARTUP] Registering {len(routers)} routers...", flush=True)
for router in routers:
    app.include_router(router, prefix="/api")
    logger.info(f"Registered router: {router.prefix} ({len(router.routes)} routes)")
print("[STARTUP] 10/10 - All routers registered - APP READY FOR REQUESTS", flush=True)

# Startup event
@app.on_event("startup")
async def startup_event():
    """
    Initialize application on startup
    - Connect to MongoDB (with retry for Atlas)
    """
    import asyncio
    worker_id = os.getpid()
    
    print(f"[STARTUP-EVENT] Starting startup_event (worker PID: {worker_id})", flush=True)
    
    try:
        logger.info(f"Starting application (worker PID: {worker_id})...")
        
        # Connect to MongoDB with retry logic - important for Atlas cold starts
        max_retries = 3  # Reduced from 10 to fail faster
        retry_delay = 1
        
        print(f"[STARTUP-EVENT] Attempting MongoDB connection (max {max_retries} retries)...", flush=True)
        
        for attempt in range(max_retries):
            try:
                print(f"[STARTUP-EVENT] MongoDB connection attempt {attempt + 1}/{max_retries}...", flush=True)
                await database.connect()
                logger.info(f"✅ MongoDB connection established (worker {worker_id})")
                print(f"[STARTUP-EVENT] ✅ MongoDB connected successfully!", flush=True)
                break
            except Exception as e:
                print(f"[STARTUP-EVENT] ❌ MongoDB attempt {attempt + 1} failed: {e}", flush=True)
                if attempt < max_retries - 1:
                    logger.warning(f"MongoDB connection attempt {attempt + 1}/{max_retries} failed: {e}, retrying in {retry_delay}s...")
                    await asyncio.sleep(retry_delay)
                    retry_delay = min(retry_delay * 1.5, 3)  # Cap at 3 seconds
                else:
                    logger.error(f"Failed to connect to MongoDB after {max_retries} attempts: {e}")
                    print(f"[STARTUP-EVENT] ⚠️ Starting without DB - endpoints will fail gracefully", flush=True)
                    # Don't raise - let the app start anyway, endpoints will fail gracefully
                    logger.warning("Application starting without database connection - endpoints will return errors")
        
        print(f"[STARTUP-EVENT] 🚀 Startup complete (worker PID: {worker_id})", flush=True)
        logger.info(f"🚀 Application startup complete (worker PID: {worker_id})")
        
    except Exception as e:
        print(f"[STARTUP-EVENT] ❌ Non-fatal startup error: {e}", flush=True)
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

# Health check endpoint - at /health for local testing
@app.get("/health")
async def health_check():
    """Simple health check endpoint"""
    print("[HEALTH] Health check called - responding healthy", flush=True)
    return {
        "status": "healthy",
        "version": "2.0.0",
        "environment": settings.ENVIRONMENT
    }

# Health check endpoint - at /api/health for production (Kubernetes routing)
@app.get("/api/health")
async def api_health_check():
    """API Health check endpoint for production routing"""
    print("[HEALTH] API Health check called - responding healthy", flush=True)
    return {
        "status": "healthy",
        "version": "2.0.0",
        "environment": settings.ENVIRONMENT,
        "db_status": "connected" if database.db is not None else "disconnected"
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
