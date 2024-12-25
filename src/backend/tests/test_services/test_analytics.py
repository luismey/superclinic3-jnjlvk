# pytest v7.0.0
# pytest_asyncio v0.21.0
# pytest_mock v3.10.0
# pytest_cov v4.1.0
# freezegun v1.2.0

import pytest
import pytest_asyncio
from datetime import datetime, timedelta
from uuid import UUID, uuid4
from freezegun import freeze_time

from app.services.analytics.metrics import MetricsService, validate_metric
from app.services.analytics.reports import ReportGenerator
from app.models.analytics import MetricCategory, AggregationType, TimePeriod

class TestMetricsService:
    """Test class for metrics service with comprehensive coverage."""

    @pytest.fixture
    async def metrics_service(self, test_db, redis_mock):
        """Fixture for metrics service instance."""
        config = {
            "max_metrics_per_minute": 1000,
            "cache_ttl": 300,
            "validation_rules": {
                "system": {
                    "min_value": 0,
                    "max_value": float('inf'),
                    "required_metadata": ["component", "instance_id"]
                }
            }
        }
        return MetricsService(test_db, redis_mock, config)

    @pytest.fixture
    def test_data(self):
        """Fixture for test data with multi-tenant isolation."""
        return {
            "org_id": uuid4(),
            "metrics": [
                {
                    "name": "api_latency",
                    "category": "PERFORMANCE",
                    "value": 150.5,
                    "metadata": {
                        "endpoint": "/api/v1/users",
                        "method": "GET"
                    }
                },
                {
                    "name": "memory_usage",
                    "category": "SYSTEM",
                    "value": 75.2,
                    "metadata": {
                        "component": "web_server",
                        "instance_id": "web-1"
                    }
                }
            ]
        }

    @pytest.mark.asyncio
    async def test_record_metric(self, metrics_service, test_data):
        """Test recording metrics with validation and multi-tenant isolation."""
        org_id = test_data["org_id"]
        
        # Test successful metric recording
        for metric_data in test_data["metrics"]:
            recorded_metric = await metrics_service.record_metric(
                name=metric_data["name"],
                category=metric_data["category"],
                value=metric_data["value"],
                organization_id=org_id,
                metadata=metric_data["metadata"]
            )
            
            assert recorded_metric is not None
            assert recorded_metric.name == metric_data["name"]
            assert recorded_metric.value == metric_data["value"]
            assert recorded_metric.organization_id == org_id
            assert recorded_metric.metadata == metric_data["metadata"]

        # Test rate limiting
        with pytest.raises(Exception) as exc_info:
            for _ in range(1001):  # Exceed rate limit
                await metrics_service.record_metric(
                    name="test_metric",
                    category="SYSTEM",
                    value=1.0,
                    organization_id=org_id
                )
        assert "Rate limit exceeded" in str(exc_info.value)

        # Test validation failure
        with pytest.raises(ValueError):
            await metrics_service.record_metric(
                name="invalid_metric",
                category="INVALID",
                value=-1,
                organization_id=org_id
            )

    @pytest.mark.asyncio
    async def test_get_metrics(self, metrics_service, test_data):
        """Test retrieving metrics with filters and caching."""
        org_id = test_data["org_id"]
        
        # Record test metrics
        for metric_data in test_data["metrics"]:
            await metrics_service.record_metric(
                name=metric_data["name"],
                category=metric_data["category"],
                value=metric_data["value"],
                organization_id=org_id,
                metadata=metric_data["metadata"]
            )

        # Test retrieval with filters
        end_time = datetime.utcnow()
        start_time = end_time - timedelta(hours=1)
        
        metrics = await metrics_service.get_metrics(
            organization_id=org_id,
            category="SYSTEM",
            start_time=start_time,
            end_time=end_time,
            filters={"name": "memory_usage"}
        )
        
        assert len(metrics) > 0
        assert all(m.category == MetricCategory.SYSTEM for m in metrics)
        assert all(m.name == "memory_usage" for m in metrics)
        assert all(start_time <= m.timestamp <= end_time for m in metrics)

        # Test cache hit
        cached_metrics = await metrics_service.get_metrics(
            organization_id=org_id,
            category="SYSTEM",
            start_time=start_time,
            end_time=end_time
        )
        assert len(cached_metrics) == len(metrics)

        # Test tenant isolation
        other_org_metrics = await metrics_service.get_metrics(
            organization_id=uuid4(),
            start_time=start_time,
            end_time=end_time
        )
        assert len(other_org_metrics) == 0

    @pytest.mark.asyncio
    async def test_calculate_statistics(self, metrics_service, test_data):
        """Test statistical calculations with validation."""
        org_id = test_data["org_id"]
        
        # Record test metrics
        for metric_data in test_data["metrics"]:
            await metrics_service.record_metric(
                name=metric_data["name"],
                category=metric_data["category"],
                value=metric_data["value"],
                organization_id=org_id,
                metadata=metric_data["metadata"]
            )

        # Calculate statistics
        end_time = datetime.utcnow()
        start_time = end_time - timedelta(hours=1)
        
        metrics = await metrics_service.get_metrics(
            organization_id=org_id,
            start_time=start_time,
            end_time=end_time
        )
        
        stats = await metrics_service.calculate_statistics(
            metrics=metrics,
            statistics=["mean", "median", "p95", "trend"],
            grouping={"category": True}
        )
        
        # Verify statistics
        assert "SYSTEM" in stats
        assert "PERFORMANCE" in stats
        for category_stats in stats.values():
            assert "mean" in category_stats
            assert "median" in category_stats
            assert "trend" in category_stats
            assert category_stats["count"] > 0

        # Test edge cases
        empty_stats = await metrics_service.calculate_statistics(
            metrics=[],
            statistics=["mean"],
            grouping={"category": True}
        )
        assert len(empty_stats) == 0

    @pytest.mark.asyncio
    async def test_metric_validation(self):
        """Test metric validation rules."""
        valid_metric = {
            "name": "cpu_usage",
            "category": "SYSTEM",
            "value": 75.5,
            "metadata": {
                "component": "api_server",
                "instance_id": "api-1"
            }
        }
        
        validation_rules = {
            "system": {
                "min_value": 0,
                "max_value": 100,
                "required_metadata": ["component", "instance_id"]
            }
        }

        # Test valid metric
        assert validate_metric(
            valid_metric["name"],
            valid_metric["category"],
            valid_metric["value"],
            valid_metric["metadata"],
            validation_rules
        )

        # Test invalid cases
        invalid_cases = [
            # Invalid name
            {"name": "", "category": "SYSTEM", "value": 75.5, "metadata": valid_metric["metadata"]},
            # Invalid category
            {"name": "cpu_usage", "category": "INVALID", "value": 75.5, "metadata": valid_metric["metadata"]},
            # Value out of range
            {"name": "cpu_usage", "category": "SYSTEM", "value": -1, "metadata": valid_metric["metadata"]},
            # Missing required metadata
            {"name": "cpu_usage", "category": "SYSTEM", "value": 75.5, "metadata": {"component": "api_server"}}
        ]

        for invalid_metric in invalid_cases:
            assert not validate_metric(
                invalid_metric["name"],
                invalid_metric["category"],
                invalid_metric["value"],
                invalid_metric.get("metadata"),
                validation_rules
            )

    @pytest.mark.asyncio
    async def test_metrics_aggregation(self, metrics_service, test_data):
        """Test metrics aggregation functionality."""
        from app.services.analytics.aggregator import MetricsAggregator
        
        aggregator = MetricsAggregator(
            metrics_service=metrics_service,
            db_session=metrics_service.db,
            config={"cache_size": 1000, "cache_ttl": 300}
        )

        org_id = test_data["org_id"]
        end_time = datetime.utcnow()
        start_time = end_time - timedelta(hours=24)

        # Record test metrics
        for metric_data in test_data["metrics"]:
            await metrics_service.record_metric(
                name=metric_data["name"],
                category=metric_data["category"],
                value=metric_data["value"],
                organization_id=org_id,
                metadata=metric_data["metadata"]
            )

        # Test aggregation
        aggregation = await aggregator.aggregate_metrics(
            aggregation_type=AggregationType.HOURLY.value,
            time_period=TimePeriod.DAY.value,
            start_time=start_time,
            end_time=end_time,
            organization_id=org_id
        )

        assert aggregation is not None
        assert aggregation.organization_id == org_id
        assert "time_series" in aggregation.aggregated_data
        assert "distributions" in aggregation.aggregated_data
        assert start_time <= aggregation.start_time <= end_time