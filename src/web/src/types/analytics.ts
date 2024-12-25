// @ts-check
import { z } from 'zod'; // v3.22.0
import { BaseEntity, DateRange } from './common';

/**
 * Enum defining all supported metric types in the system
 */
export enum MetricType {
  RESPONSE_TIME = 'RESPONSE_TIME',
  MESSAGE_COUNT = 'MESSAGE_COUNT',
  CONVERSION_RATE = 'CONVERSION_RATE',
  ACTIVE_USERS = 'ACTIVE_USERS',
  CPU_USAGE = 'CPU_USAGE',
  MEMORY_USAGE = 'MEMORY_USAGE',
  ERROR_RATE = 'ERROR_RATE',
  UPTIME = 'UPTIME'
}

/**
 * Enum for alert severity levels
 */
export enum AlertLevel {
  NONE = 'NONE',
  WARNING = 'WARNING',
  CRITICAL = 'CRITICAL'
}

/**
 * Enum for time granularity options in analytics
 */
export enum TimeGranularity {
  MINUTE = 'MINUTE',
  HOUR = 'HOUR',
  DAY = 'DAY',
  WEEK = 'WEEK',
  MONTH = 'MONTH'
}

/**
 * Enum for metric comparison types
 */
export enum ComparisonType {
  NONE = 'NONE',
  PREVIOUS_PERIOD = 'PREVIOUS_PERIOD',
  YEAR_OVER_YEAR = 'YEAR_OVER_YEAR'
}

/**
 * Interface for individual metric data points
 */
export interface Metric extends BaseEntity {
  name: string;
  type: MetricType;
  value: number;
  timestamp: Date;
  metadata: Record<string, any>;
  threshold: number;
  alertLevel: AlertLevel;
}

/**
 * Interface for quick statistics display
 */
export interface QuickStats {
  totalChats: number;
  totalMessages: number;
  conversionRate: number;
  activePercentage: number;
  periodComparison: {
    chats: number;
    messages: number;
    conversion: number;
    active: number;
  };
}

/**
 * Interface for trend data points
 */
export interface TrendData {
  timestamp: Date;
  value: number;
  metricType: MetricType;
  change: number;
}

/**
 * Interface for customer journey stages
 */
export interface JourneyData {
  lead: number;
  engaged: number;
  converted: number;
  stages: {
    name: string;
    count: number;
    percentage: number;
  }[];
}

/**
 * Interface for system performance metrics
 */
export interface PerformanceMetrics {
  responseTime: {
    avg: number;
    p95: number;
    p99: number;
  };
  resourceUsage: {
    cpu: number;
    memory: number;
    network: number;
  };
  reliability: {
    uptime: number;
    errorRate: number;
    successRate: number;
  };
}

/**
 * Interface for analytics filtering options
 */
export interface AnalyticsFilter {
  dateRange: DateRange;
  metricTypes: MetricType[];
  organizationId: string;
  granularity: TimeGranularity;
  comparison: ComparisonType;
}

/**
 * Interface for complete analytics dashboard data
 */
export interface AnalyticsDashboardData {
  metrics: Metric[];
  quickStats: QuickStats;
  trends: TrendData[];
  customerJourney: JourneyData;
  performance: PerformanceMetrics;
}

/**
 * Constant mapping of metric display names
 */
export const METRIC_DISPLAY_NAMES: Record<MetricType, string> = {
  [MetricType.RESPONSE_TIME]: 'Response Time',
  [MetricType.MESSAGE_COUNT]: 'Message Count',
  [MetricType.CONVERSION_RATE]: 'Conversion Rate',
  [MetricType.ACTIVE_USERS]: 'Active Users',
  [MetricType.CPU_USAGE]: 'CPU Usage',
  [MetricType.MEMORY_USAGE]: 'Memory Usage',
  [MetricType.ERROR_RATE]: 'Error Rate',
  [MetricType.UPTIME]: 'System Uptime'
};

/**
 * Constant defining threshold values for different metrics
 */
export const METRIC_THRESHOLDS: Partial<Record<MetricType, number>> = {
  [MetricType.RESPONSE_TIME]: 200, // ms
  [MetricType.CPU_USAGE]: 70, // percentage
  [MetricType.MEMORY_USAGE]: 80, // percentage
  [MetricType.ERROR_RATE]: 0.1, // percentage
  [MetricType.UPTIME]: 99.9 // percentage
};

/**
 * Default metrics to display in analytics views
 */
export const DEFAULT_METRICS: MetricType[] = [
  MetricType.MESSAGE_COUNT,
  MetricType.CONVERSION_RATE
];

/**
 * Zod schema for metric validation
 */
export const metricSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  type: z.nativeEnum(MetricType),
  value: z.number(),
  timestamp: z.date(),
  metadata: z.record(z.any()),
  threshold: z.number(),
  alertLevel: z.nativeEnum(AlertLevel),
  createdAt: z.date()
});

/**
 * Zod schema for analytics filter validation
 */
export const analyticsFilterSchema = z.object({
  dateRange: z.object({
    startDate: z.date(),
    endDate: z.date()
  }),
  metricTypes: z.array(z.nativeEnum(MetricType)),
  organizationId: z.string().uuid(),
  granularity: z.nativeEnum(TimeGranularity),
  comparison: z.nativeEnum(ComparisonType)
});

/**
 * Type guard to check if a value is a valid MetricType
 */
export function isMetricType(value: string): value is MetricType {
  return Object.values(MetricType).includes(value as MetricType);
}

/**
 * Helper function to get the display name for a metric type
 */
export function getMetricDisplayName(type: MetricType): string {
  return METRIC_DISPLAY_NAMES[type] || type;
}

/**
 * Helper function to get the threshold for a metric type
 */
export function getMetricThreshold(type: MetricType): number | undefined {
  return METRIC_THRESHOLDS[type];
}