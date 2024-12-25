# fastapi v0.100.0
# redis v4.5.0
# pandas v2.0.0
# numpy v1.24.0

import asyncio
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Union
from uuid import UUID

import numpy as np
import pandas as pd
from fastapi import BackgroundTasks, HTTPException
from redis import Redis
from fastapi.encoders import jsonable_encoder

from .metrics import MetricsService
from .aggregator import MetricsAggregator

logger = logging.getLogger(__name__)

class ReportGenerator:
    """Enhanced service class for generating analytics reports with support for 
    background processing, progressive generation, and multi-tenant isolation."""

    def __init__(
        self,
        metrics_service: MetricsService,
        aggregator: MetricsAggregator,
        cache_client: Redis,
        background_tasks: BackgroundTasks
    ):
        """Initialize report generator with required services and enhanced caching."""
        self.metrics_service = metrics_service
        self.aggregator = aggregator
        self.cache = cache_client
        self.background_tasks = background_tasks
        
        # Report configuration
        self.report_config = {
            "system_metrics": {
                "retention": timedelta(days=90),
                "cache_ttl": 3600,  # 1 hour
                "required_metrics": ["cpu_usage", "memory_usage", "api_latency"]
            },
            "business_metrics": {
                "retention": timedelta(days=180),
                "cache_ttl": 7200,  # 2 hours
                "required_metrics": ["conversion_rate", "response_time", "engagement"]
            },
            "performance_metrics": {
                "retention": timedelta(days=30),
                "cache_ttl": 1800,  # 30 minutes
                "required_metrics": ["p95_latency", "error_rate", "success_rate"]
            }
        }
        
        # Report templates
        self.report_templates = {
            "executive_summary": {
                "sections": ["overview", "key_metrics", "trends", "recommendations"],
                "visualizations": ["time_series", "distributions", "comparisons"]
            },
            "operational_metrics": {
                "sections": ["system_health", "performance", "resource_usage"],
                "visualizations": ["gauges", "trends", "alerts"]
            },
            "business_analytics": {
                "sections": ["conversion", "engagement", "retention"],
                "visualizations": ["funnels", "cohorts", "heat_maps"]
            }
        }

    async def generate_report(
        self,
        report_type: str,
        start_time: datetime,
        end_time: datetime,
        metric_categories: Optional[List[str]] = None,
        organization_id: UUID = None,
        export_format: Optional[str] = "json",
        background_processing: Optional[bool] = False
    ) -> Union[Dict, str]:
        """Generate a report with enhanced features including background processing 
        and progressive generation."""
        try:
            # Validate parameters
            if not await self._validate_report_params(
                report_type, start_time, end_time, organization_id
            ):
                raise HTTPException(
                    status_code=400,
                    detail="Invalid report parameters"
                )

            # Check cache for existing report
            cache_key = f"report:{organization_id}:{report_type}:{start_time}:{end_time}"
            cached_report = await self.cache.get(cache_key)
            if cached_report:
                logger.info(f"Returning cached report for {cache_key}")
                return cached_report

            # Handle background processing
            if background_processing:
                task_id = f"report_task_{organization_id}_{datetime.utcnow().timestamp()}"
                self.background_tasks.add_task(
                    self._generate_report_background,
                    task_id,
                    report_type,
                    start_time,
                    end_time,
                    metric_categories,
                    organization_id,
                    export_format
                )
                return {"task_id": task_id, "status": "processing"}

            # Generate report sections progressively
            report_data = {}
            
            # Fetch metrics data
            metrics = await self.metrics_service.get_metrics(
                organization_id=organization_id,
                start_time=start_time,
                end_time=end_time,
                category=metric_categories[0] if metric_categories else None
            )

            # Calculate statistics
            statistics = await self.metrics_service.calculate_statistics(
                metrics=metrics,
                statistics=["mean", "median", "p95", "trend"],
                grouping={"category": True, "time_period": "1d"}
            )

            # Generate time series analysis
            time_series = await self.aggregator.calculate_time_series(
                metrics,
                interval="1h",
                aggregation_method="mean"
            )

            # Calculate distributions
            distributions = self.aggregator.calculate_distributions(
                metrics,
                {"bins": 20, "remove_outliers": True}
            )

            # Compile report sections
            report_data = {
                "metadata": {
                    "report_type": report_type,
                    "organization_id": str(organization_id),
                    "generated_at": datetime.utcnow().isoformat(),
                    "time_range": {
                        "start": start_time.isoformat(),
                        "end": end_time.isoformat()
                    },
                    "metric_categories": metric_categories
                },
                "summary": {
                    "total_metrics": len(metrics),
                    "time_periods": len(time_series["timestamps"]),
                    "categories_analyzed": len(statistics)
                },
                "statistics": statistics,
                "time_series": time_series,
                "distributions": distributions,
                "recommendations": await self._generate_recommendations(statistics)
            }

            # Format report based on template
            formatted_report = self._apply_report_template(
                report_type, report_data
            )

            # Cache the report
            cache_ttl = self.report_config[report_type]["cache_ttl"]
            await self.cache.setex(
                cache_key,
                cache_ttl,
                jsonable_encoder(formatted_report)
            )

            # Schedule archival if needed
            if self._should_archive(report_type):
                self.background_tasks.add_task(
                    self._archive_report,
                    formatted_report,
                    organization_id
                )

            return formatted_report

        except Exception as e:
            logger.error(f"Error generating report: {str(e)}")
            raise HTTPException(
                status_code=500,
                detail=f"Report generation failed: {str(e)}"
            )

    async def _validate_report_params(
        self,
        report_type: str,
        start_time: datetime,
        end_time: datetime,
        organization_id: UUID
    ) -> bool:
        """Enhanced validation for report parameters with tenant isolation."""
        try:
            # Validate report type
            if report_type not in self.report_config:
                logger.error(f"Invalid report type: {report_type}")
                return False

            # Validate time range
            if start_time >= end_time:
                logger.error("Invalid time range: start_time must be before end_time")
                return False

            # Validate retention period
            retention = self.report_config[report_type]["retention"]
            if end_time - start_time > retention:
                logger.error(f"Time range exceeds retention period of {retention}")
                return False

            # Validate organization access
            if not await self._verify_organization_access(organization_id):
                logger.error(f"Invalid organization access: {organization_id}")
                return False

            return True

        except Exception as e:
            logger.error(f"Error validating report parameters: {str(e)}")
            return False

    async def _generate_report_background(
        self,
        task_id: str,
        *args,
        **kwargs
    ) -> None:
        """Background task for report generation."""
        try:
            # Update task status
            await self.cache.hset(f"task_status:{task_id}", "status", "processing")
            
            # Generate report
            report = await self.generate_report(*args, **kwargs)
            
            # Store result
            await self.cache.hset(
                f"task_status:{task_id}",
                mapping={
                    "status": "completed",
                    "result": jsonable_encoder(report),
                    "completed_at": datetime.utcnow().isoformat()
                }
            )
            await self.cache.expire(f"task_status:{task_id}", 86400)  # 24-hour retention

        except Exception as e:
            logger.error(f"Background report generation failed: {str(e)}")
            await self.cache.hset(
                f"task_status:{task_id}",
                mapping={
                    "status": "failed",
                    "error": str(e),
                    "completed_at": datetime.utcnow().isoformat()
                }
            )

    def _apply_report_template(
        self,
        report_type: str,
        report_data: Dict
    ) -> Dict:
        """Apply template formatting to report data."""
        template = self.report_templates.get(report_type, {})
        formatted_report = {
            "sections": {},
            "visualizations": []
        }

        # Format sections according to template
        for section in template.get("sections", []):
            if section in report_data:
                formatted_report["sections"][section] = report_data[section]

        # Generate visualizations
        for viz_type in template.get("visualizations", []):
            if viz_type in report_data:
                formatted_report["visualizations"].append({
                    "type": viz_type,
                    "data": report_data[viz_type]
                })

        return formatted_report

    async def _generate_recommendations(
        self,
        statistics: Dict
    ) -> List[Dict]:
        """Generate data-driven recommendations based on statistics."""
        recommendations = []

        # Analyze trends
        for metric, stats in statistics.items():
            if stats.get("trend") == "increasing" and "error" in metric.lower():
                recommendations.append({
                    "type": "warning",
                    "metric": metric,
                    "message": f"Rising error rates detected in {metric}",
                    "priority": "high"
                })
            elif stats.get("p95") > stats.get("mean") * 2:
                recommendations.append({
                    "type": "optimization",
                    "metric": metric,
                    "message": f"High variance detected in {metric}",
                    "priority": "medium"
                })

        return recommendations

    def _should_archive(self, report_type: str) -> bool:
        """Determine if report should be archived based on configuration."""
        return self.report_config[report_type]["retention"] > timedelta(days=30)

    async def _verify_organization_access(self, organization_id: UUID) -> bool:
        """Verify organization access and resource limits."""
        try:
            # Check organization exists and is active
            org_key = f"org:active:{organization_id}"
            is_active = await self.cache.get(org_key)
            if not is_active:
                return False

            # Check resource limits
            usage_key = f"org:report_usage:{organization_id}"
            current_usage = await self.cache.incr(usage_key)
            if current_usage == 1:
                await self.cache.expire(usage_key, 86400)  # Daily reset

            max_daily_reports = 100  # Configure based on organization tier
            return current_usage <= max_daily_reports

        except Exception as e:
            logger.error(f"Error verifying organization access: {str(e)}")
            return False