// @ts-check
import { useEffect, useCallback } from 'react'; // v18.0.0
import { useRouter } from 'next/navigation'; // v14.0.0
import { useAuthStore } from '../store/auth';
import { LoginCredentials, AuthResponse } from '../types/auth';

// Constants for authentication management
const TOKEN_REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes
const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes
const MAX_LOGIN_ATTEMPTS = 5;
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes

// Rate limiting map for login attempts
const loginAttempts = new Map<string, number[]>();

/**
 * Custom hook for managing authentication state and operations
 * Implements secure JWT-based authentication with automatic token refresh
 * and comprehensive session management
 */
export function useAuth() {
  const router = useRouter();
  const {
    user,
    isAuthenticated,
    isLoading,
    login: storeLogin,
    logout: storeLogout,
    refreshToken,
    setError
  } = useAuthStore();

  /**
   * Handles user login with rate limiting and security measures
   * @param credentials - User login credentials
   */
  const handleLogin = useCallback(async (credentials: LoginCredentials) => {
    try {
      // Check rate limiting
      const attempts = loginAttempts.get(credentials.email) || [];
      const now = Date.now();
      const recentAttempts = attempts.filter(
        timestamp => now - timestamp < RATE_LIMIT_WINDOW
      );

      if (recentAttempts.length >= MAX_LOGIN_ATTEMPTS) {
        throw new Error('Too many login attempts. Please try again later.');
      }

      // Update rate limiting tracking
      recentAttempts.push(now);
      loginAttempts.set(credentials.email, recentAttempts);

      // Attempt login
      await storeLogin(credentials);

      // Clear rate limiting on success
      loginAttempts.delete(credentials.email);

      // Navigate to dashboard on success
      router.push('/dashboard');

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Login failed';
      setError(errorMessage);
      throw error;
    }
  }, [storeLogin, router, setError]);

  /**
   * Handles user logout with cleanup
   */
  const handleLogout = useCallback(async () => {
    try {
      await storeLogout();
      router.push('/login');
    } catch (error) {
      console.error('Logout error:', error);
      // Force logout even if API call fails
      await storeLogout();
      router.push('/login');
    }
  }, [storeLogout, router]);

  /**
   * Refreshes authentication token with exponential backoff
   */
  const refreshTokenWithBackoff = useCallback(async (retryCount = 0) => {
    const maxRetries = 3;
    const baseDelay = 1000;

    try {
      await refreshToken();
    } catch (error) {
      if (retryCount < maxRetries) {
        const delay = baseDelay * Math.pow(2, retryCount);
        setTimeout(() => {
          refreshTokenWithBackoff(retryCount + 1);
        }, delay);
      } else {
        // Force logout after max retries
        handleLogout();
      }
    }
  }, [refreshToken, handleLogout]);

  // Setup token refresh interval
  useEffect(() => {
    let refreshInterval: NodeJS.Timeout;

    if (isAuthenticated) {
      refreshInterval = setInterval(() => {
        refreshTokenWithBackoff();
      }, TOKEN_REFRESH_INTERVAL);
    }

    return () => {
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
    };
  }, [isAuthenticated, refreshTokenWithBackoff]);

  // Setup session timeout monitoring
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    let lastActivity = Date.now();

    const resetTimeout = () => {
      lastActivity = Date.now();
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      timeoutId = setTimeout(() => {
        if (Date.now() - lastActivity >= SESSION_TIMEOUT) {
          handleLogout();
        }
      }, SESSION_TIMEOUT);
    };

    if (isAuthenticated) {
      // Monitor user activity
      const events = ['mousedown', 'keydown', 'touchstart', 'scroll'];
      events.forEach(event => {
        window.addEventListener(event, resetTimeout);
      });

      resetTimeout();
    }

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      const events = ['mousedown', 'keydown', 'touchstart', 'scroll'];
      events.forEach(event => {
        window.removeEventListener(event, resetTimeout);
      });
    };
  }, [isAuthenticated, handleLogout]);

  // Setup multi-tab synchronization
  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === 'auth_logout' && event.newValue) {
        handleLogout();
      }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [handleLogout]);

  // Route protection effect
  useEffect(() => {
    const protectedRoutes = ['/dashboard', '/chats', '/assistants', '/campaigns'];
    const currentPath = window.location.pathname;

    if (protectedRoutes.some(route => currentPath.startsWith(route)) && !isAuthenticated && !isLoading) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  return {
    user,
    isAuthenticated,
    isLoading,
    login: handleLogin,
    logout: handleLogout,
    error: useAuthStore(state => state.error)
  };
}