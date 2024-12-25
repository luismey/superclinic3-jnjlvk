import { z } from 'zod'; // v3.22.0
import { api } from '../lib/api';
import { 
  MetricType, 
  AnalyticsFilter, 
  AnalyticsDashboardData,
  METRIC_THRESHOLDS,
  DEFAULT_METRICS,
  AlertLevel,
  analyticsFilterSchema,
  Metric,
  TrendData,
  QuickStats,
  JourneyData,
  PerformanceMetrics
} from '../types/analytics';
import { formatDate } from '../utils/date';
import { formatNumber, formatPercentage } from '../utils/format';

// API endpoints
const API_ENDPOINTS = {
  DASHBOARD: '/api/v1/analytics/dashboard',
  METRICS: '/api/v1/analytics/metrics',
  TRENDS: '/api/v1/analytics/trends'
} as const;

// Cache configuration
const CACHE_TTL = 300000; // 5 minutes
const RETRY_CONFIG = { attempts: 3, delay: 1000 };

// Response validation schemas
const metricResponseSchema = z.array(z.object({
  id: z.string(),
  type: z.nativeEnum(MetricType),
  value: z.number(),
  timestamp: z.string().transform(str => new Date(str)),
  metadata: z.record(z.unknown()),
  alertLevel: z.nativeEnum(AlertLevel)
}));

const dashboardResponseSchema = z.object({
  metrics: metricResponseSchema,
  quickStats: z.object({
    totalChats: z.number(),
    totalMessages: z.number(),
    conversionRate: z.number(),
    activePercentage: z.number(),
    periodComparison: z.object({
      chats: z.number(),
      messages: z.number(),
      conversion: z.number(),
      active: z.number()
    })
  }),
  trends: z.array(z.object({
    timestamp: z.string().transform(str => new Date(str)),
    value: z.number(),
    metricType: z.nativeEnum(MetricType),
    change: z.number()
  })),
  customerJourney: z.object({
    lead: z.number(),
    engaged: z.number(),
    converted: z.number(),
    stages: z.array(z.object({
      name: z.string(),
      count: z.number(),
      percentage: z.number()
    }))
  })
});

/**
 * Analytics service for handling data fetching, transformation, and management
 */
class AnalyticsService {
  /**
   * Retrieves complete dashboard data with enhanced error handling and caching
   * @param filter - Analytics filter parameters
   * @returns Promise with dashboard data
   */
  async getDashboardData(filter: AnalyticsFilter): Promise<AnalyticsDashboardData> {
    try {
      // Validate filter parameters
      const validatedFilter = analyticsFilterSchema.parse(filter);

      // Make API request with retry logic
      const response = await api.get<AnalyticsDashboardData>(
        API_ENDPOINTS.DASHBOARD,
        validatedFilter,
        { 
          cache: true,
          retry: RETRY_CONFIG.attempts,
          timeout: CACHE_TTL
        }
      );

      // Validate response data
      const validatedResponse = dashboardResponseSchema.parse(response);

      // Transform and format response data with Brazilian locale
      return this.formatDashboardData(validatedResponse);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      throw new Error('Failed to fetch analytics dashboard data');
    }
  }

  /**
   * Retrieves metrics with threshold monitoring and caching
   * @param filter - Analytics filter parameters
   * @returns Promise with array of metrics
   */
  async getMetrics(filter: AnalyticsFilter): Promise<Metric[]> {
    try {
      const validatedFilter = analyticsFilterSchema.parse(filter);

      const response = await api.get<Metric[]>(
        API_ENDPOINTS.METRICS,
        validatedFilter,
        { cache: true }
      );

      const validatedMetrics = metricResponseSchema.parse(response);
      return this.processMetrics(validatedMetrics);
    } catch (error) {
      console.error('Error fetching metrics:', error);
      throw new Error('Failed to fetch analytics metrics');
    }
  }

  /**
   * Retrieves trend data with enhanced processing
   * @param filter - Analytics filter parameters
   * @returns Promise with array of trend data points
   */
  async getTrends(filter: AnalyticsFilter): Promise<TrendData[]> {
    try {
      const validatedFilter = analyticsFilterSchema.parse(filter);

      const response = await api.get<TrendData[]>(
        API_ENDPOINTS.TRENDS,
        validatedFilter,
        { cache: true }
      );

      return this.processTrends(response);
    } catch (error) {
      console.error('Error fetching trends:', error);
      throw new Error('Failed to fetch analytics trends');
    }
  }

  /**
   * Formats dashboard data with Brazilian locale support
   */
  private formatDashboardData(data: AnalyticsDashboardData): AnalyticsDashboardData {
    return {
      ...data,
      quickStats: this.formatQuickStats(data.quickStats),
      metrics: this.processMetrics(data.metrics),
      trends: this.processTrends(data.trends),
      customerJourney: this.formatJourneyData(data.customerJourney)
    };
  }

  /**
   * Formats quick statistics with Brazilian locale
   */
  private formatQuickStats(stats: QuickStats): QuickStats {
    return {
      ...stats,
      conversionRate: Number(formatPercentage(stats.conversionRate)),
      activePercentage: Number(formatPercentage(stats.activePercentage)),
      periodComparison: {
        ...stats.periodComparison,
        conversion: Number(formatPercentage(stats.periodComparison.conversion)),
        active: Number(formatPercentage(stats.periodComparison.active))
      }
    };
  }

  /**
   * Processes metrics with threshold monitoring
   */
  private processMetrics(metrics: Metric[]): Metric[] {
    return metrics.map(metric => ({
      ...metric,
      value: Number(formatNumber(metric.value)),
      alertLevel: this.calculateAlertLevel(metric),
      threshold: METRIC_THRESHOLDS[metric.type] || 0
    }));
  }

  /**
   * Processes trend data with enhanced calculations
   */
  private processTrends(trends: TrendData[]): TrendData[] {
    return trends.map(trend => ({
      ...trend,
      value: Number(formatNumber(trend.value)),
      timestamp: new Date(trend.timestamp),
      change: Number(formatPercentage(trend.change))
    }));
  }

  /**
   * Formats journey data with Brazilian locale
   */
  private formatJourneyData(journey: JourneyData): JourneyData {
    return {
      ...journey,
      stages: journey.stages.map(stage => ({
        ...stage,
        percentage: Number(formatPercentage(stage.percentage))
      }))
    };
  }

  /**
   * Calculates alert level based on metric thresholds
   */
  private calculateAlertLevel(metric: Metric): AlertLevel {
    const threshold = METRIC_THRESHOLDS[metric.type];
    if (!threshold) return AlertLevel.NONE;

    const value = metric.value;
    if (value >= threshold * 1.2) return AlertLevel.CRITICAL;
    if (value >= threshold) return AlertLevel.WARNING;
    return AlertLevel.NONE;
  }
}

// Export singleton instance
export const analyticsService = new AnalyticsService();