"""
Test suite initialization module for FastAPI backend.
Configures pytest environment, async testing support, and coverage reporting.

pytest version: ^7.0.0
pytest-asyncio version: ^0.21.0
pytest-cov version: ^4.1.0
"""

import logging
import os
from typing import List

import pytest
from pytest import Config, Item, Session

# Configure test logger
logger = logging.getLogger(__name__)

# Test environment configuration
TEST_ENV = "test"

# Required pytest plugins
PYTEST_PLUGINS = [
    "pytest_asyncio",  # Async test support
    "pytest_cov"      # Coverage reporting
]

# Coverage configuration
MIN_COVERAGE_THRESHOLD = 90.0  # Required 90% test coverage

def pytest_configure(config: Config) -> None:
    """
    Configure pytest environment for test suite execution.
    Sets up coverage reporting, async support, and test isolation.

    Args:
        config: Pytest configuration object
    """
    try:
        # Set test environment
        os.environ["ENVIRONMENT"] = TEST_ENV
        os.environ["DEBUG"] = "false"
        logger.info(f"Configured test environment: {TEST_ENV}")

        # Configure async test settings
        config.option.asyncio_mode = "auto"
        logger.debug("Configured async test mode")

        # Configure coverage settings
        config.option.cov_config = ".coveragerc"
        config.option.cov_branch = True
        config.option.cov_report = {
            "term-missing": True,
            "html": "coverage_html",
            "xml": "coverage.xml"
        }
        config.option.cov_fail_under = MIN_COVERAGE_THRESHOLD
        logger.info(f"Configured coverage requirements: {MIN_COVERAGE_THRESHOLD}%")

        # Configure test database settings
        os.environ["DATABASE_URL"] = "postgresql+asyncpg://test:test@localhost:5432/test_db"
        logger.debug("Configured test database connection")

        # Configure test monitoring
        config.option.verbose = 2  # Detailed test output
        config.option.durations = 10  # Show slowest 10 tests
        config.option.durations_min = 1.0  # Show tests taking > 1s
        logger.debug("Configured test monitoring")

        # Configure error handling
        config.option.reruns = 2  # Retry flaky tests
        config.option.reruns_delay = 1  # Delay between retries
        logger.debug("Configured test retry settings")

    except Exception as e:
        logger.error(f"Test configuration failed: {str(e)}")
        raise

def pytest_collection_modifyitems(session: Session, config: Config, items: List[Item]) -> None:
    """
    Modify test collection to handle async tests and test ordering.
    Applies markers and configures test execution order.

    Args:
        session: Pytest session object
        config: Pytest configuration object
        items: List of collected test items
    """
    try:
        for item in items:
            # Mark async tests
            if item.get_closest_marker("asyncio") is None:
                if "async" in item.name or "coroutine" in str(item.function):
                    item.add_marker(pytest.mark.asyncio)
                    logger.debug(f"Added asyncio marker to {item.name}")

            # Add performance monitoring markers
            if "test_performance" in item.keywords:
                item.add_marker(pytest.mark.timeout(30))  # 30s timeout for perf tests
            else:
                item.add_marker(pytest.mark.timeout(5))   # 5s timeout for regular tests

            # Add database test markers
            if "test_db" in item.fixturenames:
                item.add_marker(pytest.mark.database)
                logger.debug(f"Added database marker to {item.name}")

            # Add integration test markers
            if "integration" in item.keywords:
                item.add_marker(pytest.mark.integration)
                logger.debug(f"Added integration marker to {item.name}")

        # Order tests - database tests first, then integration, then unit
        items.sort(key=lambda x: (
            1 if "database" in x.keywords else 
            2 if "integration" in x.keywords else 
            3
        ))
        logger.info(f"Collected and ordered {len(items)} tests")

    except Exception as e:
        logger.error(f"Test collection modification failed: {str(e)}")
        raise