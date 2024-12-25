// External imports - v4.4.0
import { create } from 'zustand';
import { subscribeWithSelector, devtools } from 'zustand/middleware';

// Internal store imports
import { useAuthStore } from './auth';
import { useAnalyticsStore } from './analytics';
import { useChatStore } from './chat';

// Constants for store management
const STORE_VERSION = '1.0.0';
const SUBSCRIPTION_OPTIONS = {
  equalityFn: shallow,
  maxBatchSize: 100,
  batchWaitTime: 16 // ~1 frame at 60fps
} as const;

const PERFORMANCE_THRESHOLDS = {
  storeUpdateTime: 50, // ms
  subscriptionExecutionTime: 100, // ms
  batchSize: 1000
} as const;

// Types for store management
interface StoreMetrics {
  updateTime: number;
  subscriptionTime: number;
  batchSize: number;
  timestamp: number;
}

interface RootStore {
  // Store Management
  version: string;
  initialized: boolean;
  metrics: StoreMetrics[];
  
  // Actions
  initialize: () => Promise<void>;
  cleanup: () => void;
  resetStores: () => void;
  clearMetrics: () => void;
}

/**
 * Performance monitoring decorator for store actions
 */
function performanceMonitor() {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const start = performance.now();
      const result = await originalMethod.apply(this, args);
      const duration = performance.now() - start;

      monitorStorePerformance({
        updateTime: duration,
        subscriptionTime: 0,
        batchSize: 1,
        timestamp: Date.now()
      });

      return result;
    };

    return descriptor;
  };
}

/**
 * Monitors store performance metrics and triggers optimizations
 */
function monitorStorePerformance(metrics: StoreMetrics): void {
  const { updateTime, subscriptionTime, batchSize } = metrics;

  // Log performance warnings
  if (updateTime > PERFORMANCE_THRESHOLDS.storeUpdateTime) {
    console.warn(`Store update took ${updateTime}ms - above threshold`);
  }

  if (subscriptionTime > PERFORMANCE_THRESHOLDS.subscriptionExecutionTime) {
    console.warn(`Subscription execution took ${subscriptionTime}ms - above threshold`);
  }

  if (batchSize > PERFORMANCE_THRESHOLDS.batchSize) {
    console.warn(`Large batch size detected: ${batchSize} updates`);
  }

  // Store metrics
  useRootStore.setState(state => ({
    metrics: [...state.metrics, metrics].slice(-100) // Keep last 100 metrics
  }));
}

/**
 * Sets up cross-store subscriptions with proper cleanup
 */
function setupStoreSubscriptions(): () => void {
  const unsubscribers: Array<() => void> = [];

  // Auth -> Chat subscription
  unsubscribers.push(
    useAuthStore.subscribe(
      state => state.isAuthenticated,
      isAuthenticated => {
        if (isAuthenticated) {
          useChatStore.getState().fetchChats();
        } else {
          useChatStore.getState().reset();
        }
      },
      SUBSCRIPTION_OPTIONS
    )
  );

  // Auth -> Analytics subscription
  unsubscribers.push(
    useAuthStore.subscribe(
      state => state.user?.organizationId,
      organizationId => {
        if (organizationId) {
          useAnalyticsStore.getState().setFilter({ organizationId });
          useAnalyticsStore.getState().fetchDashboardData();
        } else {
          useAnalyticsStore.getState().reset();
        }
      },
      SUBSCRIPTION_OPTIONS
    )
  );

  // Chat -> Analytics subscription
  unsubscribers.push(
    useChatStore.subscribe(
      state => state.chats.length,
      () => {
        useAnalyticsStore.getState().fetchMetrics();
      },
      SUBSCRIPTION_OPTIONS
    )
  );

  // Return cleanup function
  return () => unsubscribers.forEach(unsub => unsub());
}

/**
 * Root store for managing global state and cross-store interactions
 */
export const useRootStore = create<RootStore>()(
  devtools(
    (set, get) => ({
      // Initial state
      version: STORE_VERSION,
      initialized: false,
      metrics: [],

      /**
       * Initializes all stores and sets up subscriptions
       */
      initialize: async () => {
        if (get().initialized) return;

        try {
          // Initialize auth store first
          const authState = useAuthStore.getState();
          if (authState.tokens) {
            await authState.validateAndRefreshTokens();
          }

          // Setup cross-store subscriptions
          const cleanup = setupStoreSubscriptions();

          set({
            initialized: true,
            cleanup
          });
        } catch (error) {
          console.error('Store initialization failed:', error);
          throw error;
        }
      },

      /**
       * Cleans up all store subscriptions and connections
       */
      cleanup: () => {
        const state = get();
        if (state.cleanup) {
          state.cleanup();
        }
        set({ initialized: false });
      },

      /**
       * Resets all stores to initial state
       */
      resetStores: () => {
        useAuthStore.getState().reset();
        useAnalyticsStore.getState().reset();
        useChatStore.getState().reset();
        set({ metrics: [] });
      },

      /**
       * Clears performance metrics
       */
      clearMetrics: () => {
        set({ metrics: [] });
      }
    }),
    { name: 'RootStore' }
  )
);

// Export individual stores with proper typing
export { useAuthStore } from './auth';
export { useAnalyticsStore } from './analytics';
export { useChatStore } from './chat';

// Initialize stores when importing this file
if (typeof window !== 'undefined') {
  useRootStore.getState().initialize().catch(console.error);
}