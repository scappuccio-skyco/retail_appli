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
    print("[STARTUP] Using minimal fallback settings", flush=True)

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
# ⚠️ allow_credentials=True + "*" = ERREUR EN PROD
# Force explicit list for production
if settings.CORS_ORIGINS == "*":
    # Default to production URLs if wildcard is set
    logger.warning("CORS_ORIGINS set to '*' - using explicit production origins")
    allowed_origins = [
        "https://retailperformerai.com",
        "https://www.retailperformerai.com",
    ]
else:
    # Parse comma-separated list and strip whitespace
    parsed_origins = [origin.strip() for origin in settings.CORS_ORIGINS.split(",")]
    # Ensure production URLs are always included
    allowed_origins = list(set(parsed_origins + [
        "https://retailperformerai.com",
        "https://www.retailperformerai.com",
    ]))

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
    if router.prefix == "/briefs":
        logger.info("✅ Loaded router: /api/briefs")
        print("✅ Loaded router: /api/briefs", flush=True)
print("[STARTUP] 10/10 - All routers registered - APP READY FOR REQUESTS", flush=True)

# Log confirmation of briefs routes
briefs_routes = [r.path for r in app.routes if hasattr(r, 'path') and 'briefs' in r.path]
if briefs_routes:
    print(f"[STARTUP] Briefs routes registered: {briefs_routes}", flush=True)
    logger.info(f"Briefs routes: {briefs_routes}")
else:
    print("[STARTUP] ⚠️ WARNING: No briefs routes found!", flush=True)
    logger.warning("No briefs routes found in app.routes")

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
                print("[STARTUP-EVENT] ✅ MongoDB connected successfully!", flush=True)
                break
            except Exception as e:
                print(f"[STARTUP-EVENT] ❌ MongoDB attempt {attempt + 1} failed: {e}", flush=True)
                if attempt < max_retries - 1:
                    logger.warning(f"MongoDB connection attempt {attempt + 1}/{max_retries} failed: {e}, retrying in {retry_delay}s...")
                    await asyncio.sleep(retry_delay)
                    retry_delay = min(retry_delay * 1.5, 3)  # Cap at 3 seconds
                else:
                    logger.error(f"Failed to connect to MongoDB after {max_retries} attempts: {e}")
                    print("[STARTUP-EVENT] ⚠️ Starting without DB - endpoints will fail gracefully", flush=True)
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

# Debug endpoint to list all routes (not included in OpenAPI schema)
@app.get("/_debug/routes", include_in_schema=False)
async def debug_routes():
    """
    Debug endpoint to list all routes at runtime.
    Not included in OpenAPI schema for security.
    """
    from datetime import datetime
    
    routes_list = []
    
    for route in app.routes:
        if not hasattr(route, "path"):
            continue
        
        methods = sorted(getattr(route, "methods", set()))
        methods = [m for m in methods if m not in ["OPTIONS", "HEAD"]]
        
        if not methods:
            continue
        
        path = getattr(route, "path", "")
        name = getattr(route, "name", "")
        
        # Get dependencies
        dependencies = []
        if hasattr(route, "dependant"):
            deps = getattr(route.dependant, "dependencies", [])
            for dep in deps:
                if hasattr(dep, "call"):
                    dep_name = getattr(dep.call, "__name__", str(dep.call))
                    dependencies.append(dep_name)
        
        # Get tags
        tags = []
        if hasattr(route, "tags"):
            tags = list(route.tags) if route.tags else []
        
        deprecated = getattr(route, "deprecated", False)
        include_in_schema = getattr(route, "include_in_schema", True)
        
        for method in methods:
            routes_list.append({
                "path": path,
                "method": method,
                "name": name,
                "tags": tags,
                "dependencies": dependencies,
                "deprecated": deprecated,
                "include_in_schema": include_in_schema
            })
    
    routes_list.sort(key=lambda x: (x["path"], x["method"]))
    
    return {
        "generated_at": datetime.now().isoformat(),
        "source": "runtime_app_routes",
        "base_url": "https://api.retailperformerai.com",
        "total_routes": len(routes_list),
        "routes": routes_list
    }


# ==========================================
# Legacy/Compatibility endpoints for old invitation links
# ==========================================

@app.get("/api/invitations/gerant/verify/{token}")
async def verify_gerant_invitation_legacy(token: str):
    """
    Legacy endpoint for verifying gerant invitations.
    Redirects to the unified invitation verification endpoint.
    Used by old RegisterManager.js and RegisterSeller.js pages.
    """
    from core.database import get_db
    db = database.get_database()
    
    # Check in gerant_invitations collection
    invitation = await db.gerant_invitations.find_one(
        {"token": token},
        {"_id": 0}
    )
    
    if not invitation:
        # Try the old invitations collection
        invitation = await db.invitations.find_one(
            {"token": token},
            {"_id": 0}
        )
    
    if not invitation:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Invitation non trouvée ou expirée")
    
    if invitation.get('status') == 'accepted':
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="Cette invitation a déjà été utilisée")
    
    if invitation.get('status') == 'expired':
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="Cette invitation a expiré")
    
    return {
        "valid": True,
        "email": invitation.get('email'),
        "role": invitation.get('role', 'seller'),
        "store_name": invitation.get('store_name'),
        "gerant_name": invitation.get('gerant_name'),
        "manager_name": invitation.get('manager_name'),
        "name": invitation.get('name', ''),
        "gerant_id": invitation.get('gerant_id'),
        "store_id": invitation.get('store_id'),
        "manager_id": invitation.get('manager_id')
    }


@app.post("/api/auth/register-with-gerant-invite")
async def register_with_gerant_invite_legacy(request_data: dict):
    """
    Legacy endpoint for registering with gerant invitation.
    Used by old RegisterManager.js and RegisterSeller.js pages.
    """
    from services.auth_service import AuthService
    from repositories.user_repository import UserRepository
    
    db = database.get_database()
    user_repo = UserRepository(db)
    auth_service = AuthService(db, user_repo)
    
    invitation_token = request_data.get('invitation_token')
    
    # Get email from invitation if not provided
    email = request_data.get('email', '')
    if not email:
        invitation = await db.gerant_invitations.find_one(
            {"token": invitation_token},
            {"_id": 0}
        )
        if not invitation:
            invitation = await db.invitations.find_one(
                {"token": invitation_token},
                {"_id": 0}
            )
        if invitation:
            email = invitation.get('email', '')
    
    try:
        result = await auth_service.register_with_invitation(
            email=email,
            password=request_data.get('password'),
            name=request_data.get('name'),
            invitation_token=invitation_token
        )
        return result
    except Exception as e:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8001,
        reload=True if settings.ENVIRONMENT == "development" else False
    )
