# pytest v7.0.0
# pytest-asyncio v0.20.0

import logging
from typing import Any, Dict

import pytest
import pytest_asyncio
from app.core.config import ENVIRONMENT, DEBUG

# Global test configuration constants
TEST_ENVIRONMENT = "testing"
PERFORMANCE_THRESHOLD_MS = 200  # Maximum allowed response time in milliseconds

# Configure test logger
logger = logging.getLogger(__name__)

def pytest_configure(config: pytest.Config) -> None:
    """
    Configures the pytest environment for service testing with custom markers,
    async support, and test settings.

    This function sets up:
    - Custom test markers for different service types
    - Performance thresholds and timing metrics
    - Async test support
    - Test environment isolation
    - Coverage targets

    Args:
        config: pytest configuration object

    Returns:
        None
    """
    # Register service-specific test markers
    config.addinivalue_line(
        "markers",
        "ai_service: mark tests that integrate with AI/LLM services"
    )
    config.addinivalue_line(
        "markers",
        "whatsapp_service: mark tests that integrate with WhatsApp API services"
    )
    config.addinivalue_line(
        "markers",
        "analytics_service: mark tests for analytics and reporting services"
    )
    config.addinivalue_line(
        "markers",
        "campaign_service: mark tests for campaign and bulk messaging services"
    )
    config.addinivalue_line(
        "markers",
        f"performance: mark tests that validate response times under {PERFORMANCE_THRESHOLD_MS}ms"
    )

    # Configure async test settings
    pytest_asyncio.ASYNC_TEST_TIMEOUT = 30  # 30 second timeout for async tests

    # Set test environment configuration
    config.option.log_level = "DEBUG" if DEBUG else "INFO"
    config.option.log_cli = True
    config.option.log_cli_level = config.option.log_level

    # Configure test coverage settings
    config.option.cov_branch = True
    config.option.cov_report = "term-missing"
    config.option.cov_fail_under = 90.0  # Enforce 90% minimum coverage

    # Initialize test metrics collection
    config.test_timing_data = {}  # type: Dict[str, Any]

    # Log test environment initialization
    logger.info(f"Initializing test environment: {TEST_ENVIRONMENT}")
    logger.info(f"Performance threshold set to: {PERFORMANCE_THRESHOLD_MS}ms")
    logger.info("Test coverage target: 90%")

    # Verify test environment isolation
    if ENVIRONMENT != TEST_ENVIRONMENT:
        logger.warning(
            f"Test environment mismatch - expected: {TEST_ENVIRONMENT}, "
            f"current: {ENVIRONMENT}"
        )

    # Register custom test result processors
    config.pluginmanager.register(PerformanceTestResult(), "performance_results")

class PerformanceTestResult:
    """
    Custom test result processor for collecting and validating 
    performance metrics against thresholds.
    """
    
    @pytest.hookimpl(hookwrapper=True)
    def pytest_runtest_makereport(self, item: pytest.Item, call: pytest.CallInfo) -> None:
        """
        Process test results and collect performance metrics.

        Args:
            item: Test item being executed
            call: Test call information
        """
        outcome = yield
        report = outcome.get_result()

        if call.when == "call" and "performance" in item.keywords:
            if hasattr(call, "duration"):
                duration_ms = call.duration * 1000
                if duration_ms > PERFORMANCE_THRESHOLD_MS:
                    report.outcome = "failed"
                    report.longrepr = (
                        f"Performance threshold exceeded: {duration_ms:.2f}ms "
                        f"(threshold: {PERFORMANCE_THRESHOLD_MS}ms)"
                    )
                
                # Store timing data for reporting
                item.config.test_timing_data[item.nodeid] = {
                    "duration_ms": duration_ms,
                    "threshold_ms": PERFORMANCE_THRESHOLD_MS,
                    "passed": duration_ms <= PERFORMANCE_THRESHOLD_MS
                }