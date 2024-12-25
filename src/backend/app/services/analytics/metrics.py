# fastapi v0.100.0
# sqlalchemy v2.0.0
# pandas v2.0.0
# numpy v1.24.0
# redis v4.0.0

import asyncio
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Union
from uuid import UUID

import numpy as np
import pandas as pd
from fastapi import HTTPException
from redis import Redis
from sqlalchemy import select, and_, func
from sqlalchemy.ext.asyncio import AsyncSession

from ...models.analytics import (
    Metric, MetricAggregation, MetricCategory,
    AggregationType, TimePeriod
)

logger = logging.getLogger(__name__)

class MetricsService:
    """Service class for managing system and business metrics with caching and multi-tenant support."""

    def __init__(
        self,
        db_session: AsyncSession,
        cache_client: Redis,
        config: Dict
    ):
        """Initialize metrics service with database session and cache client."""
        self.db = db_session
        self.cache = cache_client
        self.metric_cache = {}
        self.config = config
        
        # Define validation rules
        self.validation_rules = {
            "system": {
                "min_value": 0,
                "max_value": float('inf'),
                "required_metadata": ["component", "instance_id"]
            },
            "business": {
                "min_value": -float('inf'),
                "max_value": float('inf'),
                "required_metadata": ["source"]
            },
            "performance": {
                "min_value": 0,
                "max_value": float('inf'),
                "required_metadata": ["endpoint", "method"]
            }
        }

    async def record_metric(
        self,
        name: str,
        category: str,
        value: float,
        organization_id: UUID,
        metadata: Optional[Dict] = None
    ) -> Metric:
        """Record a new metric value with metadata and caching."""
        try:
            # Validate metric data
            if not validate_metric(name, category, value, metadata, self.validation_rules):
                raise ValueError("Invalid metric data")

            # Check rate limits for organization
            cache_key = f"metric_rate:{organization_id}:{name}"
            rate_count = await self.cache.incr(cache_key)
            if rate_count == 1:
                await self.cache.expire(cache_key, 60)  # 1-minute window
            elif rate_count > self.config.get("max_metrics_per_minute", 1000):
                raise HTTPException(status_code=429, detail="Rate limit exceeded")

            # Create and store metric
            metric = Metric(
                name=name,
                category=category,
                value=value,
                organization_id=organization_id,
                metadata=metadata or {},
                timestamp=datetime.utcnow()
            )
            
            self.db.add(metric)
            await self.db.commit()
            await self.db.refresh(metric)

            # Update cache
            cache_key = f"metric:{organization_id}:{name}:latest"
            await self.cache.setex(
                cache_key,
                300,  # 5-minute cache
                format_metric_data(metric)
            )

            # Trigger async aggregation if needed
            asyncio.create_task(self._update_aggregations(metric))

            return metric

        except Exception as e:
            logger.error(f"Error recording metric: {str(e)}")
            await self.db.rollback()
            raise

    async def get_metrics(
        self,
        organization_id: UUID,
        category: Optional[str] = None,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        filters: Optional[Dict] = None
    ) -> List[Metric]:
        """Retrieve metrics with cache integration."""
        try:
            # Check cache for recent queries
            cache_key = f"metrics:{organization_id}:{category}:{start_time}:{end_time}"
            cached_result = await self.cache.get(cache_key)
            if cached_result:
                return cached_result

            # Build query
            query = select(Metric).where(Metric.organization_id == organization_id)

            if category:
                query = query.where(Metric.category == MetricCategory[category.upper()])

            if start_time:
                query = query.where(Metric.timestamp >= start_time)
            if end_time:
                query = query.where(Metric.timestamp <= end_time)

            # Apply additional filters
            if filters:
                for key, value in filters.items():
                    if key in Metric.__table__.columns:
                        query = query.where(getattr(Metric, key) == value)

            # Execute query
            result = await self.db.execute(query)
            metrics = result.scalars().all()

            # Cache results
            await self.cache.setex(cache_key, 60, metrics)  # 1-minute cache

            return metrics

        except Exception as e:
            logger.error(f"Error retrieving metrics: {str(e)}")
            raise

    async def calculate_statistics(
        self,
        metrics: List[Metric],
        statistics: List[str],
        grouping: Optional[Dict] = None,
        filters: Optional[Dict] = None
    ) -> Dict:
        """Calculate comprehensive statistical measures."""
        try:
            # Convert to DataFrame
            df = pd.DataFrame([
                {
                    'name': m.name,
                    'value': m.value,
                    'timestamp': m.timestamp,
                    'category': m.category.value,
                    **m.metadata
                } for m in metrics
            ])

            # Apply filters
            if filters:
                for col, value in filters.items():
                    if col in df.columns:
                        df = df[df[col] == value]

            # Group data if specified
            if grouping:
                grouped = df.groupby(list(grouping.keys()))
            else:
                grouped = df.groupby('name')

            # Calculate statistics
            results = {}
            for name, group in grouped:
                stats = {
                    'count': len(group),
                    'mean': group['value'].mean(),
                    'median': group['value'].median(),
                    'std': group['value'].std(),
                    'min': group['value'].min(),
                    'max': group['value'].max(),
                    'last_value': group.iloc[-1]['value'] if not group.empty else None,
                    'trend': self._calculate_trend(group['value'])
                }

                if isinstance(name, tuple):
                    key = '_'.join(str(n) for n in name)
                else:
                    key = str(name)
                results[key] = stats

            # Cache results
            cache_key = f"stats:{hash(frozenset(statistics))}"
            await self.cache.setex(cache_key, 300, results)  # 5-minute cache

            return results

        except Exception as e:
            logger.error(f"Error calculating statistics: {str(e)}")
            raise

    async def _update_aggregations(self, metric: Metric) -> None:
        """Update metric aggregations asynchronously."""
        try:
            # Determine aggregation periods
            periods = [
                (TimePeriod.HOUR, timedelta(hours=1)),
                (TimePeriod.DAY, timedelta(days=1)),
                (TimePeriod.WEEK, timedelta(weeks=1))
            ]

            for period, delta in periods:
                # Calculate period boundaries
                end_time = datetime.utcnow()
                start_time = end_time - delta

                # Update aggregation
                await self._aggregate_metrics(
                    metric.organization_id,
                    period,
                    start_time,
                    end_time
                )

        except Exception as e:
            logger.error(f"Error updating aggregations: {str(e)}")

    def _calculate_trend(self, values: pd.Series) -> str:
        """Calculate trend direction from time series data."""
        if len(values) < 2:
            return "stable"
        
        slope = np.polyfit(range(len(values)), values, 1)[0]
        if slope > 0.05:
            return "increasing"
        elif slope < -0.05:
            return "decreasing"
        return "stable"

def validate_metric(
    name: str,
    category: str,
    value: float,
    metadata: Optional[Dict],
    validation_rules: Dict
) -> bool:
    """Comprehensive metric validation with schema checking."""
    try:
        # Validate name
        if not name or not isinstance(name, str) or len(name) > 100:
            return False

        # Validate category
        if not category or category.upper() not in MetricCategory.__members__:
            return False

        # Validate value
        if not isinstance(value, (int, float)):
            return False

        # Validate against category rules
        rules = validation_rules.get(category.lower(), {})
        if value < rules.get("min_value", -float('inf')) or \
           value > rules.get("max_value", float('inf')):
            return False

        # Validate required metadata
        if metadata:
            required_fields = rules.get("required_metadata", [])
            if not all(field in metadata for field in required_fields):
                return False

        return True

    except Exception as e:
        logger.error(f"Metric validation error: {str(e)}")
        return False

def format_metric_data(metric: Metric, format_options: Optional[Dict] = None) -> Dict:
    """Format metric data with enhanced metadata."""
    try:
        formatted = {
            "id": str(metric.id),
            "name": metric.name,
            "category": metric.category.value,
            "value": metric.value,
            "timestamp": metric.timestamp.isoformat(),
            "organization_id": str(metric.organization_id),
            "metadata": metric.metadata
        }

        if format_options:
            if format_options.get("include_created_at", False):
                formatted["created_at"] = metric.created_at.isoformat()
            if format_options.get("include_updated_at", False):
                formatted["updated_at"] = metric.updated_at.isoformat()

        return formatted

    except Exception as e:
        logger.error(f"Error formatting metric data: {str(e)}")
        raise