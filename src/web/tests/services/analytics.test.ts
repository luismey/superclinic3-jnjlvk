import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals'; // v29.0.0
import { analyticsService } from '../../src/services/analytics';
import { MetricType, AlertLevel } from '../../src/types/analytics';
import { api } from '../../src/lib/api';
import { formatDate, getBrazilianTimeZone } from '../../src/utils/date';

// Mock API responses
const mockDashboardResponse = {
  metrics: [
    {
      id: '1',
      type: MetricType.RESPONSE_TIME,
      value: 150,
      timestamp: '2023-06-01T10:00:00-03:00',
      metadata: {},
      alertLevel: AlertLevel.NONE
    },
    {
      id: '2',
      type: MetricType.MESSAGE_COUNT,
      value: 1500,
      timestamp: '2023-06-01T10:00:00-03:00',
      metadata: {},
      alertLevel: AlertLevel.NONE
    }
  ],
  quickStats: {
    totalChats: 1000,
    totalMessages: 5000,
    conversionRate: 0.25,
    activePercentage: 0.85,
    periodComparison: {
      chats: 0.12,
      messages: 0.08,
      conversion: -0.02,
      active: 0
    }
  },
  trends: [
    {
      timestamp: '2023-06-01T00:00:00-03:00',
      value: 1200,
      metricType: MetricType.MESSAGE_COUNT,
      change: 0.15
    }
  ],
  customerJourney: {
    lead: 1000,
    engaged: 500,
    converted: 250,
    stages: [
      {
        name: 'Lead',
        count: 1000,
        percentage: 0.45
      },
      {
        name: 'Engaged',
        count: 500,
        percentage: 0.30
      },
      {
        name: 'Converted',
        count: 250,
        percentage: 0.25
      }
    ]
  }
};

// Test configuration
const mockDateRange = {
  startDate: new Date('2023-01-01T00:00:00-03:00'),
  endDate: new Date('2023-12-31T23:59:59-03:00')
};

const mockMetricTypes = [
  MetricType.MESSAGE_COUNT,
  MetricType.CONVERSION_RATE,
  MetricType.RESPONSE_TIME,
  MetricType.ACTIVE_USERS
];

const mockFilter = {
  dateRange: mockDateRange,
  metricTypes: mockMetricTypes,
  timezone: 'America/Sao_Paulo'
};

describe('Analytics Service', () => {
  // Setup and teardown
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('getDashboardData', () => {
    it('should retrieve and format dashboard data with Brazilian locale', async () => {
      // Mock API call
      jest.spyOn(api, 'get').mockResolvedValueOnce(mockDashboardResponse);

      const result = await analyticsService.getDashboardData(mockFilter);

      // Verify API call
      expect(api.get).toHaveBeenCalledWith(
        '/api/v1/analytics/dashboard',
        mockFilter,
        expect.any(Object)
      );

      // Verify data formatting
      expect(result.quickStats.conversionRate).toBe(25);
      expect(result.quickStats.activePercentage).toBe(85);
      expect(result.metrics[0].value).toBe(150);
      expect(result.customerJourney.stages[0].percentage).toBe(45);
    });

    it('should handle API errors gracefully', async () => {
      // Mock API error
      jest.spyOn(api, 'get').mockRejectedValueOnce(new Error('API Error'));

      await expect(analyticsService.getDashboardData(mockFilter))
        .rejects
        .toThrow('Failed to fetch analytics dashboard data');
    });

    it('should validate threshold monitoring for KPIs', async () => {
      jest.spyOn(api, 'get').mockResolvedValueOnce({
        ...mockDashboardResponse,
        metrics: [{
          ...mockDashboardResponse.metrics[0],
          value: 250 // Above threshold of 200ms
        }]
      });

      const result = await analyticsService.getDashboardData(mockFilter);
      expect(result.metrics[0].alertLevel).toBe(AlertLevel.WARNING);
    });

    it('should handle Brazilian timezone correctly', async () => {
      jest.spyOn(api, 'get').mockResolvedValueOnce(mockDashboardResponse);

      const result = await analyticsService.getDashboardData(mockFilter);
      const timestamp = new Date(result.trends[0].timestamp);
      
      expect(timestamp.getTimezoneOffset()).toBe(-180); // -3 hours for Brazil
    });
  });

  describe('getMetrics', () => {
    it('should retrieve and process metrics with proper formatting', async () => {
      const mockMetrics = [
        {
          id: '1',
          type: MetricType.RESPONSE_TIME,
          value: 180,
          timestamp: '2023-06-01T10:00:00-03:00',
          metadata: {},
          alertLevel: AlertLevel.NONE
        }
      ];

      jest.spyOn(api, 'get').mockResolvedValueOnce(mockMetrics);

      const result = await analyticsService.getMetrics(mockFilter);

      expect(result[0].value).toBe(180);
      expect(result[0].alertLevel).toBe(AlertLevel.NONE);
    });

    it('should handle pagination correctly', async () => {
      const mockPaginatedResponse = {
        items: mockDashboardResponse.metrics,
        total: 100,
        page: 1,
        pageSize: 20
      };

      jest.spyOn(api, 'getPaginated').mockResolvedValueOnce(mockPaginatedResponse);

      const paginatedFilter = { ...mockFilter, page: 1, pageSize: 20 };
      const result = await analyticsService.getMetrics(paginatedFilter);

      expect(result).toHaveLength(2);
      expect(api.getPaginated).toHaveBeenCalledWith(
        '/api/v1/analytics/metrics',
        paginatedFilter,
        expect.any(Object)
      );
    });
  });

  describe('getTrends', () => {
    it('should process trend data with Brazilian market context', async () => {
      jest.spyOn(api, 'get').mockResolvedValueOnce(mockDashboardResponse.trends);

      const result = await analyticsService.getTrends(mockFilter);

      expect(result[0].value).toBe(1200);
      expect(result[0].change).toBe(15); // Percentage formatted
    });

    it('should handle seasonal adjustments for Brazilian holidays', async () => {
      const holidayTrend = {
        timestamp: '2023-04-21T00:00:00-03:00', // Tiradentes holiday
        value: 800,
        metricType: MetricType.MESSAGE_COUNT,
        change: -0.2
      };

      jest.spyOn(api, 'get').mockResolvedValueOnce([holidayTrend]);

      const result = await analyticsService.getTrends(mockFilter);
      expect(result[0].value).toBe(800);
      expect(result[0].change).toBe(-20);
    });

    it('should validate trend data transformation', async () => {
      const mockTrends = [
        {
          timestamp: '2023-06-01T00:00:00-03:00',
          value: 1000,
          metricType: MetricType.MESSAGE_COUNT,
          change: 0.1
        },
        {
          timestamp: '2023-06-02T00:00:00-03:00',
          value: 1100,
          metricType: MetricType.MESSAGE_COUNT,
          change: 0.2
        }
      ];

      jest.spyOn(api, 'get').mockResolvedValueOnce(mockTrends);

      const result = await analyticsService.getTrends(mockFilter);

      expect(result).toHaveLength(2);
      expect(result[0].change).toBe(10);
      expect(result[1].change).toBe(20);
      expect(new Date(result[0].timestamp)).toBeInstanceOf(Date);
    });
  });
});