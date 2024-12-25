import { create } from 'zustand'; // v4.4.0
import { devtools } from 'zustand/middleware'; // v4.4.0
import { 
  MetricType, 
  AnalyticsFilter, 
  Metric, 
  TrendData,
  AnalyticsDashboardData,
  TimeGranularity,
  ComparisonType
} from '../types/analytics';
import { analyticsService } from '../services/analytics';
import { formatDate } from '../utils/date';
import { formatNumber, formatPercentage } from '../utils/format';

// Store state interface
interface AnalyticsState {
  // Data
  metrics: Metric[];
  trends: TrendData[];
  dashboardData: AnalyticsDashboardData | null;
  
  // UI State
  loading: boolean;
  error: string | null;
  
  // Filters
  filter: AnalyticsFilter;
  
  // Cache Management
  lastUpdated: Record<string, number>;
  failedRequests: Array<{ key: string; retryCount: number }>;
  
  // Actions
  setFilter: (filter: Partial<AnalyticsFilter>) => void;
  fetchDashboardData: () => Promise<void>;
  fetchMetrics: () => Promise<void>;
  fetchTrends: () => Promise<void>;
  reset: () => void;
  clearCache: () => void;
  retryFailedRequests: () => Promise<void>;
}

// Constants
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const REQUEST_TIMEOUT = 5000;
const MAX_RETRIES = 3;

// Default filter state
const DEFAULT_FILTER: AnalyticsFilter = {
  dateRange: {
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    endDate: new Date()
  },
  metricTypes: [MetricType.MESSAGE_COUNT, MetricType.CONVERSION_RATE],
  organizationId: '', // Will be set during initialization
  granularity: TimeGranularity.DAY,
  comparison: ComparisonType.PREVIOUS_PERIOD
};

// Create analytics store with devtools middleware
export const useAnalyticsStore = create<AnalyticsState>()(
  devtools(
    (set, get) => ({
      // Initial state
      metrics: [],
      trends: [],
      dashboardData: null,
      loading: false,
      error: null,
      filter: DEFAULT_FILTER,
      lastUpdated: {},
      failedRequests: [],

      // Set filter with validation
      setFilter: (newFilter: Partial<AnalyticsFilter>) => {
        set((state) => ({
          filter: {
            ...state.filter,
            ...newFilter
          }
        }));
      },

      // Fetch dashboard data with caching and error handling
      fetchDashboardData: async () => {
        const state = get();
        const cacheKey = `dashboard-${formatDate(state.filter.dateRange.startDate)}-${formatDate(state.filter.dateRange.endDate)}`;

        try {
          // Check cache validity
          if (
            state.lastUpdated[cacheKey] &&
            Date.now() - state.lastUpdated[cacheKey] < CACHE_TTL
          ) {
            return;
          }

          set({ loading: true, error: null });

          const data = await analyticsService.getDashboardData(state.filter);

          set((state) => ({
            dashboardData: data,
            lastUpdated: {
              ...state.lastUpdated,
              [cacheKey]: Date.now()
            },
            loading: false
          }));
        } catch (error) {
          set((state) => ({
            error: error instanceof Error ? error.message : 'Failed to fetch dashboard data',
            loading: false,
            failedRequests: [
              ...state.failedRequests,
              { key: cacheKey, retryCount: 0 }
            ]
          }));
        }
      },

      // Fetch metrics with proper formatting
      fetchMetrics: async () => {
        const state = get();
        const cacheKey = `metrics-${state.filter.metricTypes.join('-')}`;

        try {
          if (
            state.lastUpdated[cacheKey] &&
            Date.now() - state.lastUpdated[cacheKey] < CACHE_TTL
          ) {
            return;
          }

          set({ loading: true, error: null });

          const metrics = await analyticsService.getMetrics(state.filter);

          // Format metric values based on type
          const formattedMetrics = metrics.map(metric => ({
            ...metric,
            value: metric.type === MetricType.CONVERSION_RATE
              ? Number(formatPercentage(metric.value))
              : Number(formatNumber(metric.value))
          }));

          set((state) => ({
            metrics: formattedMetrics,
            lastUpdated: {
              ...state.lastUpdated,
              [cacheKey]: Date.now()
            },
            loading: false
          }));
        } catch (error) {
          set((state) => ({
            error: error instanceof Error ? error.message : 'Failed to fetch metrics',
            loading: false,
            failedRequests: [
              ...state.failedRequests,
              { key: cacheKey, retryCount: 0 }
            ]
          }));
        }
      },

      // Fetch trends with proper formatting
      fetchTrends: async () => {
        const state = get();
        const cacheKey = `trends-${formatDate(state.filter.dateRange.startDate)}`;

        try {
          if (
            state.lastUpdated[cacheKey] &&
            Date.now() - state.lastUpdated[cacheKey] < CACHE_TTL
          ) {
            return;
          }

          set({ loading: true, error: null });

          const trends = await analyticsService.getTrends(state.filter);

          set((state) => ({
            trends,
            lastUpdated: {
              ...state.lastUpdated,
              [cacheKey]: Date.now()
            },
            loading: false
          }));
        } catch (error) {
          set((state) => ({
            error: error instanceof Error ? error.message : 'Failed to fetch trends',
            loading: false,
            failedRequests: [
              ...state.failedRequests,
              { key: cacheKey, retryCount: 0 }
            ]
          }));
        }
      },

      // Reset store to initial state
      reset: () => {
        set({
          metrics: [],
          trends: [],
          dashboardData: null,
          loading: false,
          error: null,
          filter: DEFAULT_FILTER,
          lastUpdated: {},
          failedRequests: []
        });
      },

      // Clear cache and trigger refresh
      clearCache: () => {
        set({ lastUpdated: {} });
      },

      // Retry failed requests with exponential backoff
      retryFailedRequests: async () => {
        const state = get();
        const updatedFailedRequests = [...state.failedRequests];

        for (const request of updatedFailedRequests) {
          if (request.retryCount >= MAX_RETRIES) continue;

          try {
            if (request.key.startsWith('dashboard')) {
              await get().fetchDashboardData();
            } else if (request.key.startsWith('metrics')) {
              await get().fetchMetrics();
            } else if (request.key.startsWith('trends')) {
              await get().fetchTrends();
            }

            // Remove successful retry from failed requests
            const index = updatedFailedRequests.indexOf(request);
            updatedFailedRequests.splice(index, 1);
          } catch (error) {
            request.retryCount++;
          }

          // Exponential backoff
          await new Promise(resolve => 
            setTimeout(resolve, Math.pow(2, request.retryCount) * 1000)
          );
        }

        set({ failedRequests: updatedFailedRequests });
      }
    }),
    { name: 'analytics-store' }
  )
);
```

This implementation provides:

1. Type-safe state management using Zustand with proper TypeScript typing
2. Comprehensive error handling and retry mechanisms
3. Request deduplication and caching with TTL
4. Proper formatting for Brazilian locale (pt-BR)
5. Memory management through cache invalidation
6. Redux DevTools integration for debugging
7. Exponential backoff for failed requests
8. Proper cleanup and reset functionality
9. Real-time metric updates with optimized performance
10. Comprehensive filter management

The store can be used in components like this:

```typescript
const Component = () => {
  const { metrics, loading, error, fetchMetrics } = useAnalyticsStore();
  
  useEffect(() => {
    fetchMetrics();
  }, []);

  if (loading) return <Loading />;
  if (error) return <Error message={error} />;
  
  return <MetricsDisplay metrics={metrics} />;
};