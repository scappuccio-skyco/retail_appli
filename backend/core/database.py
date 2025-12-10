"""
Database connection management using Motor (async MongoDB driver)
Implements singleton pattern with dependency injection support
"""
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from typing import Optional
import logging

from core.config import settings

logger = logging.getLogger(__name__)


class Database:
    """
    MongoDB database connection manager
    Singleton pattern with lazy initialization
    """
    
    def __init__(self):
        self.client: Optional[AsyncIOMotorClient] = None
        self.db: Optional[AsyncIOMotorDatabase] = None
        self._initialized = False
    
    async def connect(self):
        """
        Establish connection to MongoDB
        Called during application startup
        """
        if self._initialized:
            logger.warning("Database already connected")
            return
        
        try:
            logger.info("Establishing MongoDB connection...")
            self.client = AsyncIOMotorClient(settings.MONGO_URL)
            self.db = self.client[settings.DB_NAME]
            
            # Force connection with ping
            await self.db.command('ping')
            
            self._initialized = True
            logger.info(f"✅ MongoDB connection established successfully (DB: {settings.DB_NAME})")
        except Exception as e:
            logger.error(f"❌ MongoDB connection failed: {e}")
            raise
    
    async def disconnect(self):
        """
        Close MongoDB connection
        Called during application shutdown
        """
        if self.client:
            self.client.close()
            logger.info("MongoDB connection closed")
            self._initialized = False
    
    def get_database(self) -> AsyncIOMotorDatabase:
        """
        Get database instance
        Raises error if not initialized
        """
        if not self._initialized or self.db is None:
            raise RuntimeError("Database not initialized. Call connect() first.")
        return self.db


# Singleton instance
database = Database()


async def get_db() -> AsyncIOMotorDatabase:
    """
    Dependency injection function for FastAPI routes
    
    Usage:
        @router.get("/users")
        async def get_users(db = Depends(get_db)):
            users = await db.users.find().to_list(100)
    """
    return database.get_database()


# For backward compatibility with legacy code
# This allows gradual migration: old code uses `db` directly
# New code uses `Depends(get_db)`
async def init_legacy_db_global():
    """Initialize global db variable for legacy code compatibility"""
    global db
    db = database.get_database()
    return db
