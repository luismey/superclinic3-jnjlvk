# sqlalchemy.ext.asyncio v2.0.0
# sqlalchemy.orm v2.0.0

import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    create_async_engine,
    async_sessionmaker,
)
from sqlalchemy.orm import declarative_base, DeclarativeMeta
from sqlalchemy import event

from ..core.config import settings, ENVIRONMENT, DEBUG, DATABASE_URL

# Configure module logger
logger = logging.getLogger(__name__)

# Database engine configuration based on environment
engine: AsyncEngine = create_async_engine(
    settings.DATABASE_URL,
    # Production-optimized connection pool settings
    pool_size=20,  # Maximum steady number of connections
    max_overflow=10,  # Maximum number of connections above pool_size
    pool_timeout=30,  # Seconds to wait for available connection
    pool_recycle=1800,  # Recycle connections every 30 minutes
    # Enable echo only in debug mode
    echo=settings.DEBUG,
    # Enable SSL in non-debug environments
    ssl=not settings.DEBUG,
    # Performance optimizations
    pool_pre_ping=True,  # Enable connection health checks
    echo_pool=settings.DEBUG,  # Log pool events in debug mode
)

# Configure session factory with optimized settings
SessionLocal = async_sessionmaker(
    bind=engine,
    autocommit=False,  # Explicit transaction management
    autoflush=False,  # Manual flush control
    expire_on_commit=False,  # Prevent expired object reloading
    class_=AsyncSession,  # Use async session class
)

# Create declarative base for models
Base: DeclarativeMeta = declarative_base()

# Add engine event listeners for monitoring
@event.listens_for(engine.sync_engine, "connect")
def receive_connect(dbapi_connection, connection_record):
    logger.info("Database connection established")

@event.listens_for(engine.sync_engine, "checkout")
def receive_checkout(dbapi_connection, connection_record, connection_proxy):
    logger.debug("Database connection checked out from pool")

@asynccontextmanager
async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    FastAPI dependency that provides an async database session with automatic
    cleanup and transaction management.
    
    Yields:
        AsyncSession: Database session for request handling
        
    Raises:
        SQLAlchemyError: Database-related exceptions
    """
    session = SessionLocal()
    try:
        logger.debug("Creating new database session")
        await session.begin()
        yield session
        await session.commit()
        logger.debug("Database session committed successfully")
    except Exception as e:
        await session.rollback()
        logger.error(f"Database session error: {str(e)}")
        raise
    finally:
        await session.close()
        logger.debug("Database session closed")

async def init_db() -> None:
    """
    Initialize database schema and create required indexes.
    Should be called during application startup.
    
    Raises:
        SQLAlchemyError: Database initialization errors
    """
    try:
        logger.info("Initializing database schema")
        
        # Create database tables
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        
        # Verify database connectivity
        async with SessionLocal() as session:
            await session.execute("SELECT 1")
            await session.commit()
        
        logger.info("Database initialization completed successfully")
    except Exception as e:
        logger.error(f"Database initialization failed: {str(e)}")
        raise

# Environment-specific optimizations
if ENVIRONMENT == "production":
    # Add production-specific event listeners
    @event.listens_for(engine.sync_engine, "engine_connect")
    def engine_connect(connection):
        logger.info("Production database connection established")
        
    # Configure connection pool monitoring
    @event.listens_for(engine.sync_engine, "pool_timeout")
    def pool_timeout(dbapi_connection, connection_record, error):
        logger.warning(f"Database connection pool timeout: {error}")

# Export required components
__all__ = ["Base", "get_db", "init_db"]