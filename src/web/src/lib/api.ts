import axiosInstance from './axios'; // v1.4.0
import { ApiResponse, ApiError, PaginatedResponse } from '../types/common';

// Constants for request configuration
const DEFAULT_ERROR_MESSAGE = 'An unexpected error occurred';
const DEFAULT_RETRY_COUNT = 3;
const DEFAULT_TIMEOUT = 30000;
const CACHE_TTL = 300000; // 5 minutes

// Cache implementation using Map
const requestCache = new Map<string, {
  data: any;
  timestamp: number;
}>();

// Types for request options
interface RequestOptions {
  retry?: number;
  cache?: boolean;
  timeout?: number;
  signal?: AbortSignal;
}

interface PaginationParams {
  page: number;
  pageSize: number;
  sortBy?: string;
  sortDirection?: 'ASC' | 'DESC';
}

/**
 * Generates cache key for requests
 */
function generateCacheKey(url: string, params?: Record<string, any>): string {
  return `${url}${params ? `?${JSON.stringify(params)}` : ''}`;
}

/**
 * Checks if cached data is still valid
 */
function isValidCache(timestamp: number): boolean {
  return Date.now() - timestamp < CACHE_TTL;
}

/**
 * Handles API errors with detailed information
 */
function handleError(error: any): never {
  const apiError: ApiError = {
    message: error.response?.data?.message || DEFAULT_ERROR_MESSAGE,
    code: error.response?.data?.code || 'UNKNOWN_ERROR',
    details: {
      status: error.response?.status,
      url: error.config?.url,
      method: error.config?.method,
    }
  };

  throw apiError;
}

/**
 * Makes a GET request with support for caching, retries, and cancellation
 */
async function get<T>(
  url: string,
  params?: Record<string, any>,
  options: RequestOptions = {}
): Promise<T> {
  const {
    retry = DEFAULT_RETRY_COUNT,
    cache = true,
    timeout = DEFAULT_TIMEOUT,
    signal
  } = options;

  // Check cache if enabled
  if (cache) {
    const cacheKey = generateCacheKey(url, params);
    const cachedData = requestCache.get(cacheKey);
    if (cachedData && isValidCache(cachedData.timestamp)) {
      return cachedData.data;
    }
  }

  try {
    const response = await axiosInstance.get<ApiResponse<T>>(url, {
      params,
      timeout,
      signal,
      retry: {
        retries: retry,
        retryCondition: (error: any) => !error.response && retry > 0
      }
    });

    // Cache successful response
    if (cache) {
      const cacheKey = generateCacheKey(url, params);
      requestCache.set(cacheKey, {
        data: response.data.data,
        timestamp: Date.now()
      });
    }

    return response.data.data;
  } catch (error) {
    handleError(error);
  }
}

/**
 * Makes a POST request with support for retries and cancellation
 */
async function post<T, R>(
  url: string,
  data: T,
  options: RequestOptions = {}
): Promise<R> {
  const {
    retry = DEFAULT_RETRY_COUNT,
    timeout = DEFAULT_TIMEOUT,
    signal
  } = options;

  try {
    const response = await axiosInstance.post<ApiResponse<R>>(url, data, {
      timeout,
      signal,
      retry: {
        retries: retry,
        retryCondition: (error: any) => !error.response && retry > 0
      }
    });

    return response.data.data;
  } catch (error) {
    handleError(error);
  }
}

/**
 * Makes a PUT request with support for retries and cancellation
 */
async function put<T, R>(
  url: string,
  data: T,
  options: RequestOptions = {}
): Promise<R> {
  const {
    retry = DEFAULT_RETRY_COUNT,
    timeout = DEFAULT_TIMEOUT,
    signal
  } = options;

  try {
    const response = await axiosInstance.put<ApiResponse<R>>(url, data, {
      timeout,
      signal,
      retry: {
        retries: retry,
        retryCondition: (error: any) => !error.response && retry > 0
      }
    });

    return response.data.data;
  } catch (error) {
    handleError(error);
  }
}

/**
 * Makes a DELETE request with support for retries and cancellation
 */
async function del(
  url: string,
  options: RequestOptions = {}
): Promise<void> {
  const {
    retry = DEFAULT_RETRY_COUNT,
    timeout = DEFAULT_TIMEOUT,
    signal
  } = options;

  try {
    await axiosInstance.delete(url, {
      timeout,
      signal,
      retry: {
        retries: retry,
        retryCondition: (error: any) => !error.response && retry > 0
      }
    });
  } catch (error) {
    handleError(error);
  }
}

/**
 * Makes a GET request that returns paginated data
 */
async function getPaginated<T>(
  url: string,
  params: PaginationParams,
  options: RequestOptions = {}
): Promise<PaginatedResponse<T>> {
  const response = await get<PaginatedResponse<T>>(url, params, options);
  return response;
}

/**
 * Clears the request cache
 */
function clearCache(): void {
  requestCache.clear();
}

// Export API client methods
export const api = {
  get,
  post,
  put,
  delete: del,
  getPaginated,
  clearCache
};