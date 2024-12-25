import { renderHook, act } from '@testing-library/react-hooks';
import { waitFor } from '@testing-library/react';
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { useAnalytics } from '../../src/hooks/useAnalytics';
import { useAnalyticsStore } from '../../src/store/analytics';
import { MetricType } from '../../src/types/analytics';
import { formatDate } from '../../src/utils/date';
import { formatNumber, formatPercentage } from '../../src/utils/format';

// Mock the analytics store
jest.mock('../../src/store/analytics', () => ({
  useAnalyticsStore: jest.fn()
}));

// Test constants
const TEST_REFRESH_INTERVAL = 30000;
const TEST_CACHE_TTL = 300000;

// Mock data
const mockMetrics = [
  {
    id: '1',
    type: MetricType.RESPONSE_TIME,
    value: 150,
    timestamp: new Date(),
    metadata: {},
    threshold: 200,
    alertLevel: 'NONE'
  },
  {
    id: '2',
    type: MetricType.MESSAGE_COUNT,
    value: 1000,
    timestamp: new Date(),
    metadata: {},
    threshold: 0,
    alertLevel: 'NONE'
  },
  {
    id: '3',
    type: MetricType.CACHE_HIT_RATE,
    value: 0.85,
    timestamp: new Date(),
    metadata: {},
    threshold: 0.8,
    alertLevel: 'NONE'
  }
];

const mockDashboardData = {
  metrics: mockMetrics,
  quickStats: {
    totalChats: 1234,
    totalMessages: 5678,
    conversionRate: 0.23,
    activePercentage: 0.89,
    periodComparison: {
      chats: 0.12,
      messages: 0.08,
      conversion: -0.02,
      active: 0
    }
  },
  trends: [
    {
      timestamp: new Date(),
      value: 100,
      metricType: MetricType.MESSAGE_COUNT,
      change: 0.05
    }
  ],
  customerJourney: {
    lead: 45,
    engaged: 30,
    converted: 10,
    stages: []
  },
  performance: {
    responseTime: {
      avg: 150,
      p95: 180,
      p99: 190
    },
    resourceUsage: {
      cpu: 0.7,
      memory: 0.8,
      network: 0.6
    },
    reliability: {
      uptime: 0.999,
      errorRate: 0.001,
      successRate: 0.999
    }
  }
};

describe('useAnalytics', () => {
  // Setup and teardown
  beforeEach(() => {
    jest.useFakeTimers();
    (useAnalyticsStore as jest.Mock).mockImplementation(() => ({
      metrics: mockMetrics,
      dashboardData: mockDashboardData,
      loading: false,
      error: null,
      fetchMetrics: jest.fn().mockResolvedValue(mockMetrics),
      fetchDashboardData: jest.fn().mockResolvedValue(mockDashboardData),
      exportData: jest.fn().mockResolvedValue(true),
      clearError: jest.fn(),
      setRefreshInterval: jest.fn()
    }));
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  describe('Initialization', () => {
    it('should initialize with default state', () => {
      const { result } = renderHook(() => useAnalytics());

      expect(result.current.metrics).toEqual(mockMetrics);
      expect(result.current.dashboardData).toEqual(mockDashboardData);
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should accept initial filter configuration', () => {
      const initialFilter = {
        dateRange: {
          startDate: new Date(),
          endDate: new Date()
        },
        metricTypes: [MetricType.RESPONSE_TIME]
      };

      const { result } = renderHook(() => useAnalytics(initialFilter));
      expect(useAnalyticsStore).toHaveBeenCalled();
    });
  });

  describe('Data Operations', () => {
    it('should fetch metrics data with proper formatting', async () => {
      const { result } = renderHook(() => useAnalytics());

      await act(async () => {
        await result.current.fetchMetricsData({
          dateRange: {
            startDate: new Date(),
            endDate: new Date()
          },
          metricTypes: [MetricType.RESPONSE_TIME],
          organizationId: '123',
          granularity: 'DAY',
          comparison: 'PREVIOUS_PERIOD'
        });
      });

      expect(result.current.metrics).toBeDefined();
      expect(result.current.metrics[0].value).toBe(
        Number(formatNumber(mockMetrics[0].value))
      );
    });

    it('should fetch dashboard data with Brazilian locale', async () => {
      const { result } = renderHook(() => useAnalytics());

      await act(async () => {
        await result.current.fetchDashboard();
      });

      expect(result.current.dashboardData).toBeDefined();
      expect(result.current.dashboardData?.quickStats.conversionRate).toBe(
        Number(formatPercentage(mockDashboardData.quickStats.conversionRate))
      );
    });

    it('should handle export operations with multiple formats', async () => {
      const { result } = renderHook(() => useAnalytics());
      const exportFilter = {
        dateRange: {
          startDate: new Date(),
          endDate: new Date()
        },
        metricTypes: [MetricType.RESPONSE_TIME],
        organizationId: '123',
        granularity: 'DAY',
        comparison: 'PREVIOUS_PERIOD'
      };

      await act(async () => {
        await result.current.exportAnalytics(exportFilter, 'csv');
      });

      const analyticsStore = useAnalyticsStore();
      expect(analyticsStore.exportData).toHaveBeenCalledWith(exportFilter, 'csv');
    });
  });

  describe('Cache Management', () => {
    it('should respect cache TTL for metrics data', async () => {
      const { result } = renderHook(() => useAnalytics());
      const filter = {
        dateRange: {
          startDate: new Date(),
          endDate: new Date()
        },
        metricTypes: [MetricType.RESPONSE_TIME],
        organizationId: '123',
        granularity: 'DAY',
        comparison: 'PREVIOUS_PERIOD'
      };

      // First fetch
      await act(async () => {
        await result.current.fetchMetricsData(filter);
      });

      const analyticsStore = useAnalyticsStore();
      expect(analyticsStore.fetchMetrics).toHaveBeenCalledTimes(1);

      // Second fetch within TTL
      await act(async () => {
        await result.current.fetchMetricsData(filter);
      });

      expect(analyticsStore.fetchMetrics).toHaveBeenCalledTimes(1);

      // Advance time beyond TTL
      jest.advanceTimersByTime(TEST_CACHE_TTL + 1000);

      // Third fetch after TTL
      await act(async () => {
        await result.current.fetchMetricsData(filter);
      });

      expect(analyticsStore.fetchMetrics).toHaveBeenCalledTimes(2);
    });
  });

  describe('Real-time Updates', () => {
    it('should handle refresh interval configuration', async () => {
      const { result } = renderHook(() => useAnalytics());

      act(() => {
        result.current.setRefreshInterval(TEST_REFRESH_INTERVAL);
      });

      // Verify initial fetch
      expect(useAnalyticsStore().fetchDashboardData).toHaveBeenCalled();
      expect(useAnalyticsStore().fetchMetrics).toHaveBeenCalled();

      // Clear previous calls
      jest.clearAllMocks();

      // Advance time to trigger refresh
      jest.advanceTimersByTime(TEST_REFRESH_INTERVAL);

      // Verify refresh occurred
      expect(useAnalyticsStore().fetchDashboardData).toHaveBeenCalled();
      expect(useAnalyticsStore().fetchMetrics).toHaveBeenCalled();
    });

    it('should cleanup interval on unmount', () => {
      const { unmount } = renderHook(() => useAnalytics());
      const clearIntervalSpy = jest.spyOn(window, 'clearInterval');

      unmount();

      expect(clearIntervalSpy).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle fetch errors gracefully', async () => {
      const error = new Error('Fetch failed');
      (useAnalyticsStore as jest.Mock).mockImplementation(() => ({
        ...useAnalyticsStore(),
        fetchMetrics: jest.fn().mockRejectedValue(error)
      }));

      const { result } = renderHook(() => useAnalytics());

      await act(async () => {
        try {
          await result.current.fetchMetricsData({
            dateRange: {
              startDate: new Date(),
              endDate: new Date()
            },
            metricTypes: [MetricType.RESPONSE_TIME],
            organizationId: '123',
            granularity: 'DAY',
            comparison: 'PREVIOUS_PERIOD'
          });
        } catch (e) {
          expect(e).toEqual(error);
        }
      });
    });

    it('should handle network timeouts', async () => {
      const timeoutError = new Error('Network timeout');
      (useAnalyticsStore as jest.Mock).mockImplementation(() => ({
        ...useAnalyticsStore(),
        fetchDashboardData: jest.fn().mockRejectedValue(timeoutError)
      }));

      const { result } = renderHook(() => useAnalytics());

      await act(async () => {
        try {
          await result.current.fetchDashboard();
        } catch (e) {
          expect(e).toEqual(timeoutError);
        }
      });
    });
  });
});