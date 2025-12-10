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

# Configure CORS
allowed_origins = settings.CORS_ORIGINS.split(",") if "," in settings.CORS_ORIGINS else [settings.CORS_ORIGINS]

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
    - Initialize default admin user
    """
    try:
        logger.info("Starting application...")
        
        # Connect to MongoDB
        await database.connect()
        logger.info("✅ MongoDB connection established")
        
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
