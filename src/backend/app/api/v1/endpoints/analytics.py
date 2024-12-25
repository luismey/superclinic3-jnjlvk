# fastapi v0.100.0
# fastapi_cache v0.1.0
# fastapi_limiter v0.1.5

import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from fastapi_cache.decorator import cache
from fastapi_limiter.depends import RateLimiter

from ....services.analytics.metrics import MetricsService
from ....services.analytics.reports import ReportGenerator
from ....services.analytics.aggregator import MetricsAggregator
from ....models.analytics import (
    MetricCategory, AggregationType, TimePeriod,
    Metric, MetricAggregation
)

logger = logging.getLogger(__name__)

# Initialize router with prefix and tags
router = APIRouter(prefix="/api/v1/analytics", tags=["analytics"])

# Constants
CACHE_TTL = 300  # Cache TTL in seconds
RATE_LIMIT = "100/minute"  # Rate limit for metric recording

@router.get("/dashboard")
@cache(expire=CACHE_TTL)
async def get_dashboard_metrics(
    time_range: str,
    organization_id: UUID,
    report_generator: ReportGenerator = Depends(),
    background_tasks: BackgroundTasks = None
) -> Dict:
    """
    Retrieve analytics dashboard metrics with caching support.
    
    Args:
        time_range: Time range for metrics (e.g., '24h', '7d', '30d')
        organization_id: Organization identifier
        report_generator: Report generator service
        background_tasks: Background tasks handler
    
    Returns:
        Dict containing dashboard metrics and statistics
    """
    try:
        # Parse time range
        end_time = datetime.utcnow()
        if time_range == "24h":
            start_time = end_time - timedelta(hours=24)
        elif time_range == "7d":
            start_time = end_time - timedelta(days=7)
        elif time_range == "30d":
            start_time = end_time - timedelta(days=30)
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid time range. Supported values: 24h, 7d, 30d"
            )

        # Generate dashboard metrics
        dashboard_data = await report_generator.generate_report(
            report_type="executive_summary",
            start_time=start_time,
            end_time=end_time,
            metric_categories=["system", "business", "performance"],
            organization_id=organization_id,
            background_processing=False
        )

        return dashboard_data

    except Exception as e:
        logger.error(f"Error retrieving dashboard metrics: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve dashboard metrics: {str(e)}"
        )

@router.post("/metrics")
async def record_metric(
    metric: Metric,
    metrics_service: MetricsService = Depends(),
    rate_limiter: RateLimiter = Depends(RateLimiter(RATE_LIMIT))
) -> Dict:
    """
    Record a new metric with rate limiting and validation.
    
    Args:
        metric: Metric data to record
        metrics_service: Metrics service instance
        rate_limiter: Rate limiting dependency
    
    Returns:
        Dict containing recorded metric details
    """
    try:
        recorded_metric = await metrics_service.record_metric(
            name=metric.name,
            category=metric.category.value,
            value=metric.value,
            organization_id=metric.organization_id,
            metadata=metric.metadata
        )

        return {
            "status": "success",
            "metric_id": str(recorded_metric.id),
            "recorded_at": recorded_metric.timestamp.isoformat()
        }

    except Exception as e:
        logger.error(f"Error recording metric: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to record metric: {str(e)}"
        )

@router.post("/metrics/aggregate")
async def aggregate_metrics(
    aggregation_type: str,
    time_period: str,
    start_time: datetime,
    end_time: datetime,
    organization_id: UUID,
    metrics_aggregator: MetricsAggregator = Depends(),
    background_tasks: BackgroundTasks = None
) -> Dict:
    """
    Aggregate metrics with time-based partitioning and caching.
    
    Args:
        aggregation_type: Type of aggregation (hourly, daily, weekly)
        time_period: Time period for aggregation
        start_time: Start time for aggregation
        end_time: End time for aggregation
        organization_id: Organization identifier
        metrics_aggregator: Metrics aggregator service
        background_tasks: Background tasks handler
    
    Returns:
        Dict containing aggregated metrics data
    """
    try:
        # Validate aggregation type
        if aggregation_type.upper() not in AggregationType.__members__:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid aggregation type. Must be one of: {', '.join(AggregationType.__members__.keys())}"
            )

        # Validate time period
        if time_period.upper() not in TimePeriod.__members__:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid time period. Must be one of: {', '.join(TimePeriod.__members__.keys())}"
            )

        # Perform aggregation
        aggregation = await metrics_aggregator.aggregate_metrics(
            aggregation_type=aggregation_type,
            time_period=time_period,
            start_time=start_time,
            end_time=end_time,
            organization_id=organization_id
        )

        return {
            "aggregation_id": str(aggregation.id),
            "type": aggregation.aggregation_type.value,
            "period": aggregation.time_period.value,
            "data": aggregation.aggregated_data,
            "metadata": aggregation.metadata
        }

    except Exception as e:
        logger.error(f"Error aggregating metrics: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to aggregate metrics: {str(e)}"
        )

@router.get("/reports/{report_id}/status")
async def get_report_status(
    report_id: str,
    report_generator: ReportGenerator = Depends()
) -> Dict:
    """
    Check the status of a background report generation task.
    
    Args:
        report_id: Report task identifier
        report_generator: Report generator service
    
    Returns:
        Dict containing report generation status
    """
    try:
        task_key = f"task_status:{report_id}"
        task_status = await report_generator.cache.hgetall(task_key)

        if not task_status:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Report task not found"
            )

        return {
            "task_id": report_id,
            "status": task_status.get("status", "unknown"),
            "completed_at": task_status.get("completed_at"),
            "error": task_status.get("error")
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error checking report status: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to check report status: {str(e)}"
        )