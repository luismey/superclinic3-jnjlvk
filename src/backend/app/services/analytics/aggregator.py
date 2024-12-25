# pandas v2.0.0
# numpy v1.24.0
# asyncio latest
# datetime latest
# cachetools v5.0.0

import asyncio
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Union
from uuid import UUID

import numpy as np
import pandas as pd
from cachetools import TTLCache

from ...models.analytics import (
    Metric, MetricAggregation, MetricCategory,
    AggregationType, TimePeriod
)
from .metrics import MetricsService

logger = logging.getLogger(__name__)

class MetricsAggregator:
    """Service class for aggregating metrics data with support for caching, 
    statistical analysis, and organization isolation."""

    def __init__(
        self,
        metrics_service: MetricsService,
        db_session,
        config: Dict
    ):
        """Initialize aggregator with services, configuration, and caching."""
        self.metrics_service = metrics_service
        self.db_session = db_session
        self.config = config
        
        # Initialize cache with TTL
        self.cache = TTLCache(
            maxsize=config.get("cache_size", 1000),
            ttl=config.get("cache_ttl", 300)  # 5 minutes default
        )
        
        # Define aggregation rules
        self.aggregation_rules = {
            "system": {
                "methods": ["mean", "max", "min", "count"],
                "intervals": ["5m", "1h", "1d"],
                "retention": timedelta(days=30)
            },
            "business": {
                "methods": ["sum", "mean", "count"],
                "intervals": ["1h", "1d", "1w"],
                "retention": timedelta(days=90)
            },
            "performance": {
                "methods": ["p95", "mean", "max", "count"],
                "intervals": ["1m", "5m", "1h"],
                "retention": timedelta(days=7)
            }
        }

    async def aggregate_metrics(
        self,
        aggregation_type: str,
        time_period: str,
        start_time: datetime,
        end_time: datetime,
        organization_id: UUID
    ) -> MetricAggregation:
        """Aggregate metrics with caching and organization isolation."""
        try:
            # Generate cache key
            cache_key = f"{organization_id}:{aggregation_type}:{time_period}:{start_time}:{end_time}"
            
            # Check cache
            if cache_key in self.cache:
                logger.debug(f"Cache hit for aggregation: {cache_key}")
                return self.cache[cache_key]

            # Validate parameters
            valid, error_msg = validate_aggregation_params(
                aggregation_type, time_period, self.config
            )
            if not valid:
                raise ValueError(f"Invalid aggregation parameters: {error_msg}")

            # Fetch metrics
            metrics = await self.metrics_service.get_metrics(
                organization_id=organization_id,
                start_time=start_time,
                end_time=end_time
            )

            # Convert to DataFrame for analysis
            df = pd.DataFrame([{
                'value': m.value,
                'timestamp': m.timestamp,
                'category': m.category.value,
                'metric_type': m.name,
                **m.metadata
            } for m in metrics])

            # Calculate aggregations based on type
            aggregated_data = {}
            
            if aggregation_type == AggregationType.HOURLY.value:
                time_series = self.calculate_time_series(
                    metrics, interval='1H', aggregation_method='mean'
                )
                aggregated_data['time_series'] = time_series
                
            # Calculate distributions
            distributions = self.calculate_distributions(
                metrics, 
                {'bins': 20, 'remove_outliers': True}
            )
            aggregated_data['distributions'] = distributions

            # Create aggregation record
            aggregation = MetricAggregation(
                aggregation_type=aggregation_type,
                time_period=time_period,
                aggregated_data=aggregated_data,
                start_time=start_time,
                end_time=end_time,
                organization_id=organization_id,
                metadata={
                    'metric_count': len(metrics),
                    'categories': df['category'].unique().tolist(),
                    'generated_at': datetime.utcnow().isoformat()
                }
            )

            # Store in database
            self.db_session.add(aggregation)
            await self.db_session.commit()
            
            # Update cache
            self.cache[cache_key] = aggregation
            
            return aggregation

        except Exception as e:
            logger.error(f"Error during metric aggregation: {str(e)}")
            await self.db_session.rollback()
            raise

    def calculate_time_series(
        self,
        metrics: List[Metric],
        interval: str,
        aggregation_method: str
    ) -> Dict:
        """Calculate time series aggregations with interval support."""
        try:
            # Convert to DataFrame
            df = pd.DataFrame([{
                'value': m.value,
                'timestamp': m.timestamp
            } for m in metrics])
            
            # Set timestamp as index
            df.set_index('timestamp', inplace=True)
            
            # Resample and aggregate
            resampled = df.resample(interval)
            
            if aggregation_method == 'mean':
                aggregated = resampled.mean()
            elif aggregation_method == 'sum':
                aggregated = resampled.sum()
            elif aggregation_method == 'p95':
                aggregated = resampled.quantile(0.95)
            else:
                aggregated = resampled.mean()

            # Handle missing values
            aggregated = aggregated.fillna(method='ffill')
            
            # Format results
            return {
                'timestamps': aggregated.index.tolist(),
                'values': aggregated['value'].tolist(),
                'interval': interval,
                'method': aggregation_method
            }

        except Exception as e:
            logger.error(f"Error calculating time series: {str(e)}")
            raise

    def calculate_distributions(
        self,
        metrics: List[Metric],
        distribution_config: Dict
    ) -> Dict:
        """Calculate statistical distributions with outlier handling."""
        try:
            values = np.array([m.value for m in metrics])
            
            # Remove outliers if configured
            if distribution_config.get('remove_outliers', False):
                q1 = np.percentile(values, 25)
                q3 = np.percentile(values, 75)
                iqr = q3 - q1
                lower_bound = q1 - 1.5 * iqr
                upper_bound = q3 + 1.5 * iqr
                values = values[(values >= lower_bound) & (values <= upper_bound)]

            # Calculate histogram
            hist, bin_edges = np.histogram(
                values,
                bins=distribution_config.get('bins', 10)
            )

            # Calculate statistics
            stats = {
                'mean': float(np.mean(values)),
                'median': float(np.median(values)),
                'std': float(np.std(values)),
                'p95': float(np.percentile(values, 95)),
                'p99': float(np.percentile(values, 99)),
                'min': float(np.min(values)),
                'max': float(np.max(values))
            }

            return {
                'histogram': {
                    'counts': hist.tolist(),
                    'bin_edges': bin_edges.tolist()
                },
                'statistics': stats,
                'sample_size': len(values)
            }

        except Exception as e:
            logger.error(f"Error calculating distributions: {str(e)}")
            raise

def validate_aggregation_params(
    aggregation_type: str,
    time_period: str,
    config: Dict
) -> tuple[bool, Optional[str]]:
    """Comprehensive validation of aggregation parameters."""
    try:
        # Validate aggregation type
        if not AggregationType.__members__.get(aggregation_type.upper()):
            return False, f"Invalid aggregation type: {aggregation_type}"

        # Validate time period
        if not TimePeriod.__members__.get(time_period.upper()):
            return False, f"Invalid time period: {time_period}"

        # Validate configuration
        if not config:
            return False, "Missing configuration"

        return True, None

    except Exception as e:
        logger.error(f"Error validating aggregation parameters: {str(e)}")
        return False, str(e)

def format_aggregation_result(
    aggregated_data: Dict,
    metadata: Dict
) -> Dict:
    """Format aggregation results with metadata."""
    try:
        # Convert numpy types to Python natives
        formatted_data = {}
        for key, value in aggregated_data.items():
            if isinstance(value, (np.integer, np.floating)):
                formatted_data[key] = float(value)
            elif isinstance(value, np.ndarray):
                formatted_data[key] = value.tolist()
            else:
                formatted_data[key] = value

        return {
            'data': formatted_data,
            'metadata': metadata,
            'generated_at': datetime.utcnow().isoformat()
        }

    except Exception as e:
        logger.error(f"Error formatting aggregation result: {str(e)}")
        raise