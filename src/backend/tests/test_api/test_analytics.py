# pytest v7.0.0
# fastapi.testclient v0.100.0
# datetime (latest)
# uuid (latest)
# time (latest)
# asyncio (latest)

import asyncio
import time
from datetime import datetime, timedelta
from typing import Dict, List
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient

from ...app.api.v1.endpoints.analytics import (
    get_dashboard_metrics,
    record_metric,
    get_metrics,
    generate_report
)
from ...app.schemas.analytics import MetricCreate, MetricResponse
from ...app.models.analytics import MetricCategory

class TestAnalyticsAPI:
    """Test suite for analytics API endpoints with comprehensive validation."""

    def setup_method(self):
        """Setup test environment before each test."""
        # Initialize test organization
        self.test_organization = {
            "id": uuid4(),
            "name": "Test Organization",
            "plan": "business"
        }

        # Initialize test metrics data
        self.test_metrics = {
            "system": [
                {
                    "name": "cpu_usage",
                    "value": 45.5,
                    "tags": {"component": "api", "instance_id": "i-123"}
                },
                {
                    "name": "memory_usage",
                    "value": 78.2,
                    "tags": {"component": "worker", "instance_id": "i-456"}
                }
            ],
            "performance": [
                {
                    "name": "api_latency",
                    "value": 156.7,
                    "tags": {"endpoint": "/messages", "method": "POST"}
                },
                {
                    "name": "error_rate",
                    "value": 0.02,
                    "tags": {"service": "chat", "environment": "production"}
                }
            ],
            "business": [
                {
                    "name": "conversion_rate",
                    "value": 23.5,
                    "tags": {"funnel": "signup", "source": "organic"}
                },
                {
                    "name": "response_time",
                    "value": 420.0,
                    "tags": {"channel": "whatsapp", "type": "customer"}
                }
            ]
        }

    @pytest.mark.asyncio
    async def test_get_dashboard_metrics(self, client: TestClient):
        """Test dashboard metrics retrieval with performance validation."""
        # Setup test data
        await self._seed_test_metrics(client)

        # Record start time for performance measurement
        start_time = time.time()

        # Make request
        response = client.get(
            f"/api/v1/analytics/dashboard",
            params={
                "time_range": "24h",
                "organization_id": str(self.test_organization["id"])
            }
        )

        # Verify response time
        response_time = (time.time() - start_time) * 1000  # Convert to ms
        assert response_time < 200, f"Response time {response_time}ms exceeds 200ms SLA"

        # Validate response
        assert response.status_code == 200
        data = response.json()

        # Verify dashboard structure
        assert "summary" in data
        assert "statistics" in data
        assert "time_series" in data
        assert "distributions" in data

        # Validate quick stats
        assert "total_metrics" in data["summary"]
        assert "time_periods" in data["summary"]
        assert "categories_analyzed" in data["summary"]

        # Test cache hit
        cache_start_time = time.time()
        cache_response = client.get(
            f"/api/v1/analytics/dashboard",
            params={
                "time_range": "24h",
                "organization_id": str(self.test_organization["id"])
            }
        )
        cache_response_time = (time.time() - cache_start_time) * 1000
        assert cache_response_time < 100, "Cache response time exceeds 100ms"

    @pytest.mark.asyncio
    async def test_record_metric(self, client: TestClient):
        """Test metric recording with concurrent writes and validation."""
        # Prepare test metrics
        test_metrics = []
        for category, metrics in self.test_metrics.items():
            for metric in metrics:
                test_metrics.append(
                    MetricCreate(
                        name=metric["name"],
                        category=category,
                        value=metric["value"],
                        organization_id=self.test_organization["id"],
                        tags=metric["tags"]
                    )
                )

        # Test concurrent metric recording
        async def record_metric_async(metric: MetricCreate):
            response = client.post(
                "/api/v1/analytics/metrics",
                json=metric.dict()
            )
            return response

        # Execute concurrent requests
        tasks = [record_metric_async(metric) for metric in test_metrics]
        responses = await asyncio.gather(*tasks)

        # Validate responses
        for response in responses:
            assert response.status_code == 201
            data = response.json()
            assert "metric_id" in data
            assert "recorded_at" in data

        # Test rate limiting
        rate_limit_responses = []
        for _ in range(105):  # Exceed 100/minute limit
            response = client.post(
                "/api/v1/analytics/metrics",
                json=test_metrics[0].dict()
            )
            rate_limit_responses.append(response.status_code)

        assert 429 in rate_limit_responses, "Rate limiting not enforced"

    @pytest.mark.asyncio
    async def test_get_metrics(self, client: TestClient):
        """Test metrics retrieval with filtering and pagination."""
        # Seed test data
        await self._seed_test_metrics(client)

        # Test time range filtering
        end_time = datetime.utcnow()
        start_time = end_time - timedelta(hours=24)
        
        response = client.get(
            "/api/v1/analytics/metrics",
            params={
                "organization_id": str(self.test_organization["id"]),
                "start_time": start_time.isoformat(),
                "end_time": end_time.isoformat(),
                "category": "performance"
            }
        )

        assert response.status_code == 200
        data = response.json()
        assert all(m["category"] == "performance" for m in data["metrics"])

        # Test pagination
        response = client.get(
            "/api/v1/analytics/metrics",
            params={
                "organization_id": str(self.test_organization["id"]),
                "page": 1,
                "page_size": 5
            }
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data["metrics"]) <= 5
        assert "total" in data
        assert "page" in data

        # Test tag filtering
        response = client.get(
            "/api/v1/analytics/metrics",
            params={
                "organization_id": str(self.test_organization["id"]),
                "tags": {"component": "api"}
            }
        )

        assert response.status_code == 200
        data = response.json()
        assert all("api" in m["tags"]["component"] for m in data["metrics"])

    @pytest.mark.asyncio
    async def test_generate_report(self, client: TestClient):
        """Test report generation with various formats and validations."""
        # Seed test data
        await self._seed_test_metrics(client)

        # Test different report formats
        for export_format in ["json", "csv", "pdf"]:
            response = client.post(
                "/api/v1/analytics/reports",
                json={
                    "report_type": "executive_summary",
                    "start_time": (datetime.utcnow() - timedelta(days=7)).isoformat(),
                    "end_time": datetime.utcnow().isoformat(),
                    "organization_id": str(self.test_organization["id"]),
                    "export_format": export_format
                }
            )

            assert response.status_code == 200
            if export_format == "json":
                data = response.json()
                self._validate_report_structure(data)

        # Test background processing
        response = client.post(
            "/api/v1/analytics/reports",
            json={
                "report_type": "executive_summary",
                "start_time": (datetime.utcnow() - timedelta(days=30)).isoformat(),
                "end_time": datetime.utcnow().isoformat(),
                "organization_id": str(self.test_organization["id"]),
                "background_processing": True
            }
        )

        assert response.status_code == 202
        task_id = response.json()["task_id"]

        # Check task status
        status_response = client.get(f"/api/v1/analytics/reports/{task_id}/status")
        assert status_response.status_code == 200
        assert "status" in status_response.json()

    async def _seed_test_metrics(self, client: TestClient) -> None:
        """Seed test metrics data."""
        for category, metrics in self.test_metrics.items():
            for metric in metrics:
                client.post(
                    "/api/v1/analytics/metrics",
                    json={
                        "name": metric["name"],
                        "category": category,
                        "value": metric["value"],
                        "organization_id": str(self.test_organization["id"]),
                        "tags": metric["tags"]
                    }
                )

    def _validate_report_structure(self, report_data: Dict) -> None:
        """Validate report data structure."""
        required_sections = {
            "metadata", "summary", "statistics", 
            "time_series", "distributions", "recommendations"
        }
        assert all(section in report_data for section in required_sections)
        
        assert isinstance(report_data["metadata"], dict)
        assert isinstance(report_data["summary"], dict)
        assert isinstance(report_data["statistics"], dict)
        assert isinstance(report_data["time_series"], dict)
        assert isinstance(report_data["distributions"], dict)
        assert isinstance(report_data["recommendations"], list)