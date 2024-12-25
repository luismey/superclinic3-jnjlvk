// @ts-check
import { useCallback, useEffect, useRef } from 'react'; // v18.0.0
import { useAssistantStore } from '../store/assistant';
import type { Assistant, AssistantMetrics } from '../types/assistant';

// Constants for performance optimization
const METRICS_UPDATE_INTERVAL = 60000; // 1 minute
const DEBOUNCE_DELAY = 300; // 300ms for debouncing
const CACHE_TTL = 300000; // 5 minutes
const PERFORMANCE_THRESHOLD = 200; // 200ms target response time

/**
 * Interface for performance metrics tracking
 */
interface PerformanceMetrics {
  operationStart: number;
  operationDuration: number;
  operationType: string;
  success: boolean;
}

/**
 * Enhanced hook for managing AI virtual assistant operations with performance optimization
 * and comprehensive metrics tracking
 */
export function useAssistant() {
  // Request cancellation tokens
  const abortControllerRef = useRef<AbortController>();
  
  // Performance metrics tracking
  const metricsRef = useRef<PerformanceMetrics[]>([]);
  
  // Debounce timer
  const debounceTimerRef = useRef<NodeJS.Timeout>();

  // Get state and methods from store
  const {
    assistants,
    loading,
    error,
    metrics,
    fetchAssistants,
    createAssistant,
    updateAssistant,
    deleteAssistant,
    trackMetrics
  } = useAssistantStore();

  /**
   * Tracks operation performance and updates metrics
   */
  const trackPerformance = useCallback((
    operationType: string,
    success: boolean,
    duration: number
  ) => {
    const performanceMetric: PerformanceMetrics = {
      operationStart: Date.now() - duration,
      operationDuration: duration,
      operationType,
      success
    };

    metricsRef.current.push(performanceMetric);

    // Report if performance threshold exceeded
    if (duration > PERFORMANCE_THRESHOLD) {
      console.warn(`Performance threshold exceeded for ${operationType}: ${duration}ms`);
    }

    // Update store metrics
    trackMetrics({
      avgResponseTime: calculateAverageResponseTime(),
      successRate: calculateSuccessRate()
    });
  }, [trackMetrics]);

  /**
   * Calculates average response time from metrics
   */
  const calculateAverageResponseTime = useCallback((): number => {
    const recentMetrics = metricsRef.current.slice(-100); // Consider last 100 operations
    if (recentMetrics.length === 0) return 0;

    const totalDuration = recentMetrics.reduce(
      (sum, metric) => sum + metric.operationDuration,
      0
    );
    return totalDuration / recentMetrics.length;
  }, []);

  /**
   * Calculates success rate from metrics
   */
  const calculateSuccessRate = useCallback((): number => {
    const recentMetrics = metricsRef.current.slice(-100); // Consider last 100 operations
    if (recentMetrics.length === 0) return 100;

    const successfulOps = recentMetrics.filter(metric => metric.success).length;
    return (successfulOps / recentMetrics.length) * 100;
  }, []);

  /**
   * Enhanced create assistant with performance tracking and error handling
   */
  const handleCreateAssistant = useCallback(async (
    data: Omit<Assistant, 'id' | 'createdAt' | 'updatedAt' | 'metrics'>
  ): Promise<Assistant> => {
    const startTime = Date.now();
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();

    try {
      const result = await createAssistant(data);
      trackPerformance('create_assistant', true, Date.now() - startTime);
      return result;
    } catch (error) {
      trackPerformance('create_assistant', false, Date.now() - startTime);
      throw error;
    }
  }, [createAssistant, trackPerformance]);

  /**
   * Enhanced update assistant with debouncing and performance tracking
   */
  const handleUpdateAssistant = useCallback(async (
    id: string,
    updates: Partial<Assistant>
  ): Promise<Assistant> => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    return new Promise((resolve, reject) => {
      debounceTimerRef.current = setTimeout(async () => {
        const startTime = Date.now();
        try {
          const result = await updateAssistant(id, updates);
          trackPerformance('update_assistant', true, Date.now() - startTime);
          resolve(result);
        } catch (error) {
          trackPerformance('update_assistant', false, Date.now() - startTime);
          reject(error);
        }
      }, DEBOUNCE_DELAY);
    });
  }, [updateAssistant, trackPerformance]);

  /**
   * Enhanced delete assistant with confirmation and cleanup
   */
  const handleDeleteAssistant = useCallback(async (
    id: string
  ): Promise<void> => {
    const startTime = Date.now();
    try {
      await deleteAssistant(id);
      trackPerformance('delete_assistant', true, Date.now() - startTime);
    } catch (error) {
      trackPerformance('delete_assistant', false, Date.now() - startTime);
      throw error;
    }
  }, [deleteAssistant, trackPerformance]);

  /**
   * Refreshes assistant data with caching consideration
   */
  const refreshAssistants = useCallback(async (
    force: boolean = false
  ): Promise<void> => {
    const startTime = Date.now();
    try {
      if (force || !assistants.length) {
        await fetchAssistants();
      }
      trackPerformance('refresh_assistants', true, Date.now() - startTime);
    } catch (error) {
      trackPerformance('refresh_assistants', false, Date.now() - startTime);
      throw error;
    }
  }, [assistants.length, fetchAssistants, trackPerformance]);

  /**
   * Gets current metrics with real-time calculations
   */
  const getMetrics = useCallback((): AssistantMetrics => {
    return {
      ...metrics,
      avgResponseTime: calculateAverageResponseTime(),
      successRate: calculateSuccessRate()
    };
  }, [metrics, calculateAverageResponseTime, calculateSuccessRate]);

  // Setup periodic metrics update
  useEffect(() => {
    const metricsInterval = setInterval(() => {
      trackMetrics({
        avgResponseTime: calculateAverageResponseTime(),
        successRate: calculateSuccessRate()
      });
    }, METRICS_UPDATE_INTERVAL);

    return () => {
      clearInterval(metricsInterval);
      abortControllerRef.current?.abort();
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [calculateAverageResponseTime, calculateSuccessRate, trackMetrics]);

  // Initial data fetch
  useEffect(() => {
    refreshAssistants();
  }, [refreshAssistants]);

  return {
    // State
    assistants,
    loading,
    error,
    metrics: getMetrics(),

    // Enhanced operations
    createAssistant: handleCreateAssistant,
    updateAssistant: handleUpdateAssistant,
    deleteAssistant: handleDeleteAssistant,
    refreshAssistants,
    getMetrics
  };
}