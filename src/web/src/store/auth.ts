// @ts-check
import { create } from 'zustand'; // v4.4.0
import { persist, devtools, subscribeWithSelector } from 'zustand/middleware'; // v4.4.0
import AuthService from '../services/auth';
import { AuthState, AuthTokens } from '../types/auth';
import { User } from '../types/common';
import { isDebugMode } from '../config/environment';

// Constants for authentication management
const TOKEN_REFRESH_INTERVAL = 300000; // 5 minutes
const SESSION_TIMEOUT = 3600000; // 1 hour
const MAX_REFRESH_RETRIES = 3;

// Security event types for monitoring
const SECURITY_EVENTS = {
  LOGIN_SUCCESS: 'auth:login:success',
  LOGIN_FAILURE: 'auth:login:failure',
  TOKEN_REFRESH: 'auth:token:refresh',
  SESSION_TIMEOUT: 'auth:session:timeout',
  SECURITY_VIOLATION: 'auth:security:violation',
} as const;

// Initial state with strict typing
const INITIAL_STATE: AuthState = {
  user: null,
  tokens: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
  lastActivity: Date.now(),
  sessionValid: false,
};

// Create auth store with enhanced security and persistence
export const useAuthStore = create<AuthState>()(
  subscribeWithSelector(
    persist(
      devtools(
        (set, get) => ({
          ...INITIAL_STATE,

          /**
           * Authenticates user with enhanced security measures
           * @param credentials - Login credentials
           */
          login: async (credentials) => {
            try {
              set({ isLoading: true, error: null });

              const authService = new AuthService();
              const response = await authService.login(credentials);

              // Validate response and tokens
              if (!response.tokens || !response.user) {
                throw new Error('Invalid authentication response');
              }

              set({
                user: response.user,
                tokens: response.tokens,
                isAuthenticated: true,
                sessionValid: true,
                lastActivity: Date.now(),
                isLoading: false,
              });

              // Initialize token refresh and session monitoring
              get().startTokenRefresh();
              get().monitorSession();

              // Emit security event
              dispatchSecurityEvent(SECURITY_EVENTS.LOGIN_SUCCESS, {
                userId: response.user.id,
                timestamp: Date.now(),
              });

            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : 'Authentication failed';
              set({
                ...INITIAL_STATE,
                error: errorMessage,
                isLoading: false,
              });

              // Emit security event for failed login
              dispatchSecurityEvent(SECURITY_EVENTS.LOGIN_FAILURE, {
                error: errorMessage,
                timestamp: Date.now(),
              });

              throw error;
            }
          },

          /**
           * Logs out user and cleans up session
           */
          logout: async () => {
            try {
              const authService = new AuthService();
              await authService.logout();
            } finally {
              set(INITIAL_STATE);
              get().stopTokenRefresh();
            }
          },

          /**
           * Validates and refreshes authentication tokens
           */
          validateAndRefreshTokens: async () => {
            const state = get();
            if (!state.tokens) return false;

            try {
              const authService = new AuthService();
              const newTokens = await authService.refreshToken();

              set({
                tokens: newTokens,
                lastActivity: Date.now(),
              });

              dispatchSecurityEvent(SECURITY_EVENTS.TOKEN_REFRESH, {
                userId: state.user?.id,
                timestamp: Date.now(),
              });

              return true;
            } catch (error) {
              console.error('Token refresh failed:', error);
              get().logout();
              return false;
            }
          },

          /**
           * Starts token refresh interval
           */
          startTokenRefresh: () => {
            const refreshInterval = setInterval(
              () => get().validateAndRefreshTokens(),
              TOKEN_REFRESH_INTERVAL
            );

            // Store interval ID for cleanup
            set({ refreshInterval });
          },

          /**
           * Stops token refresh interval
           */
          stopTokenRefresh: () => {
            const state = get();
            if (state.refreshInterval) {
              clearInterval(state.refreshInterval);
              set({ refreshInterval: undefined });
            }
          },

          /**
           * Monitors session health and security
           */
          monitorSession: () => {
            const checkSession = () => {
              const state = get();
              const now = Date.now();

              // Check session timeout
              if (now - state.lastActivity > SESSION_TIMEOUT) {
                dispatchSecurityEvent(SECURITY_EVENTS.SESSION_TIMEOUT, {
                  userId: state.user?.id,
                  lastActivity: state.lastActivity,
                });
                get().logout();
                return;
              }

              // Validate session integrity
              if (state.isAuthenticated && !state.sessionValid) {
                dispatchSecurityEvent(SECURITY_EVENTS.SECURITY_VIOLATION, {
                  userId: state.user?.id,
                  timestamp: now,
                });
                get().logout();
                return;
              }
            };

            // Set up session monitoring interval
            const sessionInterval = setInterval(checkSession, 60000);
            set({ sessionInterval });

            // Set up activity listeners
            if (typeof window !== 'undefined') {
              ['mousedown', 'keydown', 'touchstart', 'scroll'].forEach(event => {
                window.addEventListener(event, () => {
                  set({ lastActivity: Date.now() });
                });
              });
            }
          },

          /**
           * Updates user activity timestamp
           */
          updateActivity: () => {
            set({ lastActivity: Date.now() });
          },

          /**
           * Validates current session status
           */
          validateSession: async () => {
            const state = get();
            if (!state.isAuthenticated) return false;

            try {
              const authService = new AuthService();
              const isValid = await authService.validateSession();
              set({ sessionValid: isValid });
              return isValid;
            } catch {
              get().logout();
              return false;
            }
          },
        }),
        {
          name: 'auth-store',
          enabled: isDebugMode(),
        }
      ),
      {
        name: 'auth-storage',
        storage: {
          getItem: (name) => {
            const value = localStorage.getItem(name);
            return value ? JSON.parse(value) : null;
          },
          setItem: (name, value) => {
            localStorage.setItem(name, JSON.stringify(value));
          },
          removeItem: (name) => localStorage.removeItem(name),
        },
        partialize: (state) => ({
          user: state.user,
          tokens: state.tokens,
          isAuthenticated: state.isAuthenticated,
        }),
      }
    )
  )
);

/**
 * Dispatches security events for monitoring
 */
function dispatchSecurityEvent(
  type: keyof typeof SECURITY_EVENTS,
  payload: Record<string, unknown>
) {
  if (isDebugMode()) {
    console.debug(`Security Event: ${type}`, payload);
  }
  
  const event = new CustomEvent(type, {
    detail: {
      ...payload,
      timestamp: Date.now(),
    },
  });
  
  window.dispatchEvent(event);
}

// Export type-safe selectors
export const selectUser = (state: AuthState) => state.user;
export const selectIsAuthenticated = (state: AuthState) => state.isAuthenticated;
export const selectIsLoading = (state: AuthState) => state.isLoading;
export const selectError = (state: AuthState) => state.error;
export const selectSessionValid = (state: AuthState) => state.sessionValid;