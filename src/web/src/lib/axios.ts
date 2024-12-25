import axios, { AxiosInstance, AxiosError, AxiosRequestConfig, AxiosResponse } from 'axios'; // v1.4.0
import { getEnvironmentConfig } from '../config/environment';
import { getItem, setItem } from './storage';
import { ApiError } from '../types/common';

// Constants for token management and retry configuration
const AUTH_TOKEN_KEY = 'auth_token';
const REFRESH_TOKEN_KEY = 'refresh_token';
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

/**
 * Creates and configures an Axios instance with enhanced security features
 * and performance optimizations
 */
function createAxiosInstance(): AxiosInstance {
  const { apiUrl } = getEnvironmentConfig();

  const instance = axios.create({
    baseURL: apiUrl,
    timeout: 30000,
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
    },
    withCredentials: true, // Enable CORS credentials
  });

  setupInterceptors(instance);
  return instance;
}

/**
 * Configures comprehensive request and response interceptors
 * @param instance - Axios instance to configure
 */
function setupInterceptors(instance: AxiosInstance): void {
  // Request interceptor for authentication and request enhancement
  instance.interceptors.request.use(
    async (config) => {
      config = await handleAuthToken(config);
      return config;
    },
    (error) => Promise.reject(error)
  );

  // Response interceptor for error handling and response transformation
  instance.interceptors.response.use(
    (response) => response,
    async (error) => {
      const originalRequest = error.config;

      // Handle token refresh
      if (error.response?.status === 401 && !originalRequest._retry) {
        originalRequest._retry = true;
        try {
          await refreshAuthToken();
          originalRequest.headers.Authorization = `Bearer ${await getItem(AUTH_TOKEN_KEY)}`;
          return instance(originalRequest);
        } catch (refreshError) {
          return Promise.reject(handleApiError(refreshError as AxiosError));
        }
      }

      // Implement retry logic for network errors
      if (!error.response && originalRequest.retryCount < MAX_RETRIES) {
        originalRequest.retryCount = (originalRequest.retryCount || 0) + 1;
        return new Promise(resolve => {
          setTimeout(() => {
            resolve(instance(originalRequest));
          }, RETRY_DELAY * originalRequest.retryCount);
        });
      }

      return Promise.reject(handleApiError(error));
    }
  );
}

/**
 * Manages authentication tokens with enhanced security
 * @param config - Axios request configuration
 */
async function handleAuthToken(config: AxiosRequestConfig): Promise<AxiosRequestConfig> {
  const token = await getItem<string>(AUTH_TOKEN_KEY);
  
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }

  // Add CSRF token for mutation requests
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(config.method?.toUpperCase() || '')) {
    const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
    if (csrfToken) {
      config.headers['X-CSRF-Token'] = csrfToken;
    }
  }

  // Add request ID for tracing
  config.headers['X-Request-ID'] = crypto.randomUUID();

  return config;
}

/**
 * Refreshes the authentication token
 */
async function refreshAuthToken(): Promise<void> {
  const refreshToken = await getItem<string>(REFRESH_TOKEN_KEY);
  if (!refreshToken) {
    throw new Error('No refresh token available');
  }

  try {
    const { apiUrl } = getEnvironmentConfig();
    const response = await axios.post(`${apiUrl}/auth/refresh`, {
      refreshToken
    });

    await setItem(AUTH_TOKEN_KEY, response.data.accessToken);
    await setItem(REFRESH_TOKEN_KEY, response.data.refreshToken);
  } catch (error) {
    await setItem(AUTH_TOKEN_KEY, null);
    await setItem(REFRESH_TOKEN_KEY, null);
    throw error;
  }
}

/**
 * Transforms API errors with comprehensive error handling
 * @param error - Axios error object
 */
function handleApiError(error: AxiosError): ApiError {
  const apiError: ApiError = {
    message: 'An unexpected error occurred',
    code: 'UNKNOWN_ERROR',
    details: {}
  };

  if (error.response) {
    // Server error response
    apiError.message = error.response.data?.message || error.message;
    apiError.code = error.response.data?.code || `HTTP_${error.response.status}`;
    apiError.details = {
      status: error.response.status,
      statusText: error.response.statusText,
      data: error.response.data
    };
  } else if (error.request) {
    // Network error
    apiError.message = 'Network error occurred';
    apiError.code = 'NETWORK_ERROR';
    apiError.details = {
      request: error.request,
      message: error.message
    };
  } else {
    // Client-side error
    apiError.message = error.message;
    apiError.code = 'CLIENT_ERROR';
    apiError.details = {
      config: error.config
    };
  }

  // Log error for monitoring (excluding sensitive data)
  console.error('API Error:', {
    code: apiError.code,
    message: apiError.message,
    url: error.config?.url,
    method: error.config?.method
  });

  return apiError;
}

// Create and export the configured Axios instance
const axiosInstance = createAxiosInstance();
export default axiosInstance;

// Export type-safe request methods
export const get = <T>(url: string, config?: AxiosRequestConfig) => 
  axiosInstance.get<T>(url, config).then(response => response.data);

export const post = <T>(url: string, data?: any, config?: AxiosRequestConfig) =>
  axiosInstance.post<T>(url, data, config).then(response => response.data);

export const put = <T>(url: string, data?: any, config?: AxiosRequestConfig) =>
  axiosInstance.put<T>(url, data, config).then(response => response.data);

export const del = <T>(url: string, config?: AxiosRequestConfig) =>
  axiosInstance.delete<T>(url, config).then(response => response.data);

export const patch = <T>(url: string, data?: any, config?: AxiosRequestConfig) =>
  axiosInstance.patch<T>(url, data, config).then(response => response.data);