# fastapi v0.100.0
# redis v4.5.0
# circuitbreaker v1.4.0
# logging (latest)

import logging
from contextlib import contextmanager
from datetime import datetime
from typing import Dict, Optional, Union
from uuid import UUID

from fastapi import HTTPException
from circuitbreaker import circuit

from .metrics import MetricsService
from .reports import ReportGenerator
from .aggregator import MetricsAggregator

# Configure module logger
logger = logging.getLogger(__name__)

class AnalyticsService:
    """
    Main analytics service class that provides a unified interface for metrics collection,
    report generation, and data aggregation with comprehensive error handling and monitoring.
    """

    def __init__(
        self,
        db_session,
        cache_client,
        config: Dict,
        logger: Optional[logging.Logger] = None
    ):
        """Initialize analytics service with required dependencies and configuration."""
        self.logger = logger or logging.getLogger(__name__)
        self.logger.info("Initializing AnalyticsService")

        try:
            # Initialize core services
            self.metrics_service = MetricsService(
                db_session=db_session,
                cache_client=cache_client,
                config=config
            )

            self.aggregator = MetricsAggregator(
                metrics_service=self.metrics_service,
                db_session=db_session,
                config=config
            )

            self.report_generator = ReportGenerator(
                metrics_service=self.metrics_service,
                aggregator=self.aggregator,
                cache_client=cache_client,
                background_tasks=None  # Will be set per request
            )

            # Configure circuit breaker
            self.circuit_config = {
                "failure_threshold": config.get("circuit_breaker_threshold", 5),
                "recovery_timeout": config.get("circuit_breaker_timeout", 60),
                "expected_exception": Exception
            }

            # Initialize tenant context
            self.tenant_context = {}

            self.logger.info("AnalyticsService initialized successfully")

        except Exception as e:
            self.logger.error(f"Failed to initialize AnalyticsService: {str(e)}")
            raise

    @contextmanager
    def tenant_scope(self, organization_id: UUID):
        """Context manager for handling tenant isolation."""
        try:
            self.tenant_context["organization_id"] = organization_id
            yield
        finally:
            self.tenant_context.clear()

    @circuit(failure_threshold=5, recovery_timeout=60)
    async def record_system_metric(
        self,
        metric_name: str,
        value: float,
        metadata: Optional[Dict] = None,
        organization_id: Optional[UUID] = None
    ) -> Dict:
        """Record a system performance metric with validation and error handling."""
        try:
            org_id = organization_id or self.tenant_context.get("organization_id")
            if not org_id:
                raise HTTPException(
                    status_code=400,
                    detail="Organization ID is required"
                )

            self.logger.debug(f"Recording system metric: {metric_name} = {value}")
            
            metric = await self.metrics_service.record_metric(
                name=metric_name,
                category="system",
                value=value,
                organization_id=org_id,
                metadata=metadata
            )

            return {
                "id": str(metric.id),
                "name": metric_name,
                "value": value,
                "timestamp": metric.timestamp.isoformat(),
                "organization_id": str(org_id)
            }

        except Exception as e:
            self.logger.error(f"Error recording system metric: {str(e)}")
            raise HTTPException(
                status_code=500,
                detail=f"Failed to record metric: {str(e)}"
            )

    @circuit(failure_threshold=5, recovery_timeout=60)
    async def generate_performance_report(
        self,
        start_time: datetime,
        end_time: datetime,
        organization_id: Optional[UUID] = None,
        background_processing: bool = False
    ) -> Union[Dict, str]:
        """Generate a system performance report with validation and caching."""
        try:
            org_id = organization_id or self.tenant_context.get("organization_id")
            if not org_id:
                raise HTTPException(
                    status_code=400,
                    detail="Organization ID is required"
                )

            self.logger.info(f"Generating performance report for org: {org_id}")

            return await self.report_generator.generate_report(
                report_type="performance_metrics",
                start_time=start_time,
                end_time=end_time,
                organization_id=org_id,
                background_processing=background_processing
            )

        except Exception as e:
            self.logger.error(f"Error generating performance report: {str(e)}")
            raise HTTPException(
                status_code=500,
                detail=f"Failed to generate report: {str(e)}"
            )

    @circuit(failure_threshold=5, recovery_timeout=60)
    async def get_aggregated_metrics(
        self,
        metric_category: str,
        start_time: datetime,
        end_time: datetime,
        organization_id: Optional[UUID] = None,
        aggregation_type: str = "hourly"
    ) -> Dict:
        """Get aggregated metrics for a time period with validation."""
        try:
            org_id = organization_id or self.tenant_context.get("organization_id")
            if not org_id:
                raise HTTPException(
                    status_code=400,
                    detail="Organization ID is required"
                )

            self.logger.debug(
                f"Fetching aggregated metrics for category: {metric_category}"
            )

            aggregation = await self.aggregator.aggregate_metrics(
                aggregation_type=aggregation_type,
                time_period="hour",
                start_time=start_time,
                end_time=end_time,
                organization_id=org_id
            )

            return {
                "aggregation_id": str(aggregation.id),
                "type": aggregation_type,
                "period": "hour",
                "data": aggregation.aggregated_data,
                "metadata": aggregation.metadata
            }

        except Exception as e:
            self.logger.error(f"Error getting aggregated metrics: {str(e)}")
            raise HTTPException(
                status_code=500,
                detail=f"Failed to get aggregated metrics: {str(e)}"
            )

    async def health_check(self) -> Dict:
        """Perform health check of analytics services."""
        try:
            health_status = {
                "metrics_service": "healthy",
                "report_generator": "healthy",
                "aggregator": "healthy",
                "overall": "healthy"
            }

            # Check metrics service
            try:
                await self.metrics_service.get_metrics(
                    organization_id=UUID("00000000-0000-0000-0000-000000000000"),
                    limit=1
                )
            except Exception as e:
                health_status["metrics_service"] = f"unhealthy: {str(e)}"
                health_status["overall"] = "degraded"

            # Add timestamp
            health_status["timestamp"] = datetime.utcnow().isoformat()
            
            return health_status

        except Exception as e:
            self.logger.error(f"Health check failed: {str(e)}")
            return {
                "overall": "unhealthy",
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat()
            }

# Export public interface
__all__ = ["AnalyticsService"]