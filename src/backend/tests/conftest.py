"""
Pytest configuration file providing shared fixtures for backend testing.
Implements comprehensive test infrastructure with async support and proper cleanup.

pytest version: ^7.0.0
sqlalchemy version: ^2.0.0
fastapi version: ^0.100.0
"""

import asyncio
import logging
from typing import AsyncGenerator, Generator
from unittest.mock import AsyncMock

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    create_async_engine,
    async_sessionmaker
)

from app.db.session import Base, get_db
from app.core.config import settings
from app.models.users import User, UserRole

# Configure test logger
logger = logging.getLogger(__name__)

# Test user constants
TEST_USER_EMAIL = "test@example.com"
TEST_USER_PASSWORD = "TestPass123!@#"
TEST_USER_NAME = "Test User"

@pytest.fixture(scope="session")
def event_loop() -> Generator[asyncio.AbstractEventLoop, None, None]:
    """
    Create an event loop instance for async tests with proper cleanup.
    
    Returns:
        Generator[asyncio.AbstractEventLoop, None, None]: Event loop for async operations
    """
    try:
        # Create and set new event loop
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        logger.debug("Created new event loop for test session")
        
        yield loop
        
        # Cleanup
        loop.close()
        logger.debug("Closed test session event loop")
        
    except Exception as e:
        logger.error(f"Event loop setup/cleanup error: {str(e)}")
        raise

@pytest.fixture(scope="function")
async def test_db(event_loop: asyncio.AbstractEventLoop) -> AsyncGenerator[AsyncSession, None]:
    """
    Provide an isolated test database session with proper cleanup.
    
    Args:
        event_loop: Event loop fixture for async operations
        
    Returns:
        AsyncGenerator[AsyncSession, None]: Async database session for tests
    """
    try:
        # Create test database engine
        engine = create_async_engine(
            settings.TEST_DATABASE_URL,
            echo=settings.DEBUG,
            pool_pre_ping=True,
            pool_size=5,
            max_overflow=0
        )
        
        # Create test session factory
        test_session_maker = async_sessionmaker(
            engine,
            class_=AsyncSession,
            expire_on_commit=False,
            autocommit=False,
            autoflush=False
        )
        
        # Create database schema
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)
            await conn.run_sync(Base.metadata.create_all)
            logger.debug("Created test database schema")
        
        # Create and yield test session
        async with test_session_maker() as session:
            logger.debug("Created test database session")
            yield session
            
            # Rollback any pending transactions
            await session.rollback()
            logger.debug("Rolled back test database session")
            
    except Exception as e:
        logger.error(f"Test database setup/cleanup error: {str(e)}")
        raise
    
    finally:
        # Cleanup database
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)
            logger.debug("Dropped test database schema")
        
        await engine.dispose()
        logger.debug("Disposed test database engine")

@pytest.fixture(scope="function")
def test_client(test_db: AsyncSession) -> TestClient:
    """
    Provide a configured FastAPI test client with database overrides.
    
    Args:
        test_db: Test database session fixture
        
    Returns:
        TestClient: Configured test client instance
    """
    try:
        from app.main import app  # Local import to avoid circular dependencies
        
        # Override database dependency
        async def override_get_db():
            try:
                yield test_db
            finally:
                await test_db.rollback()
        
        app.dependency_overrides[get_db] = override_get_db
        logger.debug("Configured database dependency override")
        
        # Create test client
        client = TestClient(app)
        logger.debug("Created test client")
        
        return client
        
    except Exception as e:
        logger.error(f"Test client setup error: {str(e)}")
        raise
    
    finally:
        # Reset dependency overrides
        app.dependency_overrides = {}
        logger.debug("Reset dependency overrides")

@pytest.fixture(scope="function")
async def test_user(test_db: AsyncSession) -> User:
    """
    Provide a test user instance with proper setup and cleanup.
    
    Args:
        test_db: Test database session fixture
        
    Returns:
        User: Configured test user instance
    """
    try:
        # Create test organization first (required for user)
        from app.models.organizations import Organization
        
        org = Organization(
            name="Test Organization",
            plan="free"
        )
        test_db.add(org)
        await test_db.flush()
        
        # Create test user
        user = User(
            email=TEST_USER_EMAIL,
            full_name=TEST_USER_NAME,
            role=UserRole.ADMIN,
            organization_id=org.id
        )
        user.set_password(TEST_USER_PASSWORD)
        user.is_active = True
        
        # Add to database
        test_db.add(user)
        await test_db.commit()
        logger.debug(f"Created test user: {user.email}")
        
        return user
        
    except Exception as e:
        logger.error(f"Test user setup error: {str(e)}")
        await test_db.rollback()
        raise