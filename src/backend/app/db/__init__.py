# sqlalchemy.ext.asyncio v2.0.0

import logging
from typing import AsyncGenerator, Callable

from sqlalchemy.ext.asyncio import AsyncSession

from .base import Base
from .session import AsyncSessionLocal, get_db

# Configure module logger
logger = logging.getLogger(__name__)

# Version and documentation
__version__ = "1.0.0"
__doc__ = "Database initialization module providing core database components and connection management."

# Define exported components
__all__ = ["AsyncSessionLocal", "get_db", "Base"]

# Type hints for exported components
AsyncSessionFactory = Callable[[], AsyncGenerator[AsyncSession, None]]

# Verify critical database components are properly initialized
if not Base.metadata.tables:
    logger.warning("No tables found in SQLAlchemy metadata. Ensure models are properly registered.")

if not AsyncSessionLocal:
    raise RuntimeError("AsyncSessionLocal not properly configured")

if not get_db:
    raise RuntimeError("Database dependency getter not properly configured")

# Log initialization status
logger.info(
    "Database components initialized successfully:\n"
    f"- Metadata Tables: {len(Base.metadata.tables)}\n"
    f"- Session Factory: {AsyncSessionLocal.__name__}\n"
    f"- DB Dependency: {get_db.__name__}"
)

# Export type hints for better IDE support
__annotations__ = {
    "AsyncSessionLocal": AsyncSessionFactory,
    "get_db": AsyncSessionFactory,
    "Base": type(Base)
}