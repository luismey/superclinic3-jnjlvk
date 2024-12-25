import { axiosInstance } from '../lib/axios'; // v1.4.0
import { StorageService } from '../lib/storage'; // Custom
import jwtDecode from 'jwt-decode'; // v3.1.2
import { browserCrypto } from '@peculiar/webcrypto'; // v1.4.0
import {
  LoginCredentials,
  RegisterCredentials,
  AuthResponse,
  AuthTokens,
  AuthError,
  isValidToken,
  isAuthResponse,
  TOKEN_STORAGE_KEY,
  USER_STORAGE_KEY,
  TOKEN_EXPIRY_BUFFER,
  loginCredentialsSchema,
  registerCredentialsSchema
} from '../types/auth';

// Authentication endpoints
const AUTH_ENDPOINTS = {
  LOGIN: '/auth/login',
  REGISTER: '/auth/register',
  LOGOUT: '/auth/logout',
  REFRESH: '/auth/refresh'
} as const;

// Authentication configuration
const AUTH_CONFIG = {
  ACCESS_TOKEN_EXPIRY: 3600, // 1 hour
  REFRESH_TOKEN_EXPIRY: 604800, // 7 days
  RATE_LIMIT_ATTEMPTS: 5,
  RATE_LIMIT_WINDOW: 300, // 5 minutes
  RETRY_MAX_ATTEMPTS: 3,
  RETRY_BACKOFF_MS: 1000
} as const;

/**
 * Comprehensive authentication service implementing secure JWT-based authentication
 * with token management, session persistence, and security controls
 */
export class AuthService {
  private storage: StorageService;
  private refreshTokenTimeout?: NodeJS.Timeout;
  private rateLimitMap: Map<string, number[]>;
  private crypto: Crypto;

  constructor() {
    this.storage = new StorageService();
    this.rateLimitMap = new Map();
    this.crypto = typeof window !== 'undefined' ? window.crypto : new browserCrypto();
    
    // Initialize cross-tab session sync
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', this.handleStorageEvent);
    }
  }

  /**
   * Authenticates user with comprehensive security controls
   * @param credentials - User login credentials
   * @returns Promise resolving to auth response with tokens
   * @throws AuthError for invalid credentials or rate limiting
   */
  public async login(credentials: LoginCredentials): Promise<AuthResponse> {
    try {
      // Validate credentials schema
      const validatedCredentials = loginCredentialsSchema.parse(credentials);

      // Check rate limiting
      this.checkRateLimit(validatedCredentials.email);

      // Generate request nonce
      const nonce = await this.generateNonce();

      const response = await axiosInstance.post<AuthResponse>(
        AUTH_ENDPOINTS.LOGIN,
        validatedCredentials,
        {
          headers: {
            'X-Request-Nonce': nonce,
            'X-Client-Version': process.env.NEXT_PUBLIC_VERSION
          }
        }
      );

      if (!isAuthResponse(response.data)) {
        throw new AuthError('Invalid response format');
      }

      // Store tokens and user data securely
      await this.handleAuthSuccess(response.data);

      return response.data;

    } catch (error) {
      this.handleAuthError(error);
      throw error;
    }
  }

  /**
   * Registers new user with security validations
   * @param credentials - User registration credentials
   * @returns Promise resolving to auth response
   * @throws AuthError for validation failures
   */
  public async register(credentials: RegisterCredentials): Promise<AuthResponse> {
    try {
      // Validate registration data
      const validatedCredentials = registerCredentialsSchema.parse(credentials);

      // Check rate limiting
      this.checkRateLimit(validatedCredentials.email);

      const response = await axiosInstance.post<AuthResponse>(
        AUTH_ENDPOINTS.REGISTER,
        validatedCredentials,
        {
          headers: {
            'X-Request-Nonce': await this.generateNonce()
          }
        }
      );

      if (!isAuthResponse(response.data)) {
        throw new AuthError('Invalid response format');
      }

      // Store tokens and user data securely
      await this.handleAuthSuccess(response.data);

      return response.data;

    } catch (error) {
      this.handleAuthError(error);
      throw error;
    }
  }

  /**
   * Logs out user and cleans up session data
   */
  public async logout(): Promise<void> {
    try {
      const tokens = await this.storage.getItem<AuthTokens>(TOKEN_STORAGE_KEY);
      
      if (tokens?.refreshToken) {
        await axiosInstance.post(AUTH_ENDPOINTS.LOGOUT, {
          refreshToken: tokens.refreshToken
        });
      }

    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      this.cleanup();
    }
  }

  /**
   * Refreshes access token with retry logic
   * @returns Promise resolving to new token pair
   * @throws AuthError for refresh failures
   */
  public async refreshToken(): Promise<AuthTokens> {
    try {
      const tokens = await this.storage.getItem<AuthTokens>(TOKEN_STORAGE_KEY);
      
      if (!tokens?.refreshToken) {
        throw new AuthError('No refresh token available');
      }

      const response = await axiosInstance.post<AuthResponse>(
        AUTH_ENDPOINTS.REFRESH,
        { refreshToken: tokens.refreshToken },
        { 
          headers: {
            'X-Request-Nonce': await this.generateNonce()
          }
        }
      );

      const newTokens = response.data.tokens;
      
      // Validate and store new tokens
      if (!isValidToken(newTokens.accessToken)) {
        throw new AuthError('Invalid token received');
      }

      await this.storage.setItem(TOKEN_STORAGE_KEY, newTokens, {
        encrypt: true,
        ttl: AUTH_CONFIG.REFRESH_TOKEN_EXPIRY * 1000
      });

      this.scheduleTokenRefresh(newTokens.expiresIn);

      return newTokens;

    } catch (error) {
      this.handleAuthError(error);
      throw error;
    }
  }

  /**
   * Retrieves current authenticated user
   * @returns Current user or null if not authenticated
   */
  public async getCurrentUser() {
    try {
      const tokens = await this.storage.getItem<AuthTokens>(TOKEN_STORAGE_KEY);
      
      if (!tokens || !isValidToken(tokens.accessToken)) {
        return null;
      }

      return await this.storage.getItem(USER_STORAGE_KEY);

    } catch (error) {
      console.error('Get current user error:', error);
      return null;
    }
  }

  /**
   * Validates current session status
   * @returns Boolean indicating if session is valid
   */
  public async validateSession(): Promise<boolean> {
    try {
      const tokens = await this.storage.getItem<AuthTokens>(TOKEN_STORAGE_KEY);
      return Boolean(tokens && isValidToken(tokens.accessToken));
    } catch {
      return false;
    }
  }

  /**
   * Handles successful authentication
   * @param authResponse - Authentication response data
   */
  private async handleAuthSuccess(authResponse: AuthResponse): Promise<void> {
    const { tokens, user } = authResponse;

    // Store tokens securely
    await this.storage.setItem(TOKEN_STORAGE_KEY, tokens, {
      encrypt: true,
      ttl: AUTH_CONFIG.REFRESH_TOKEN_EXPIRY * 1000
    });

    // Store user data
    await this.storage.setItem(USER_STORAGE_KEY, user, {
      encrypt: true,
      ttl: AUTH_CONFIG.REFRESH_TOKEN_EXPIRY * 1000
    });

    this.scheduleTokenRefresh(tokens.expiresIn);
  }

  /**
   * Schedules token refresh before expiry
   * @param expiresIn - Token expiry time in seconds
   */
  private scheduleTokenRefresh(expiresIn: number): void {
    if (this.refreshTokenTimeout) {
      clearTimeout(this.refreshTokenTimeout);
    }

    const refreshTime = (expiresIn - TOKEN_EXPIRY_BUFFER) * 1000;
    this.refreshTokenTimeout = setTimeout(() => {
      this.refreshToken().catch(console.error);
    }, refreshTime);
  }

  /**
   * Implements rate limiting for authentication attempts
   * @param identifier - User identifier (email)
   * @throws AuthError if rate limit exceeded
   */
  private checkRateLimit(identifier: string): void {
    const now = Date.now();
    const attempts = this.rateLimitMap.get(identifier) || [];
    
    // Clean up old attempts
    const recentAttempts = attempts.filter(
      timestamp => now - timestamp < AUTH_CONFIG.RATE_LIMIT_WINDOW * 1000
    );

    if (recentAttempts.length >= AUTH_CONFIG.RATE_LIMIT_ATTEMPTS) {
      throw new AuthError('Rate limit exceeded. Please try again later.');
    }

    recentAttempts.push(now);
    this.rateLimitMap.set(identifier, recentAttempts);
  }

  /**
   * Generates secure nonce for request verification
   * @returns Promise resolving to base64 nonce
   */
  private async generateNonce(): Promise<string> {
    const buffer = new Uint8Array(32);
    this.crypto.getRandomValues(buffer);
    return btoa(String.fromCharCode(...buffer));
  }

  /**
   * Handles storage events for cross-tab synchronization
   */
  private handleStorageEvent = (event: StorageEvent): void => {
    if (event.key === TOKEN_STORAGE_KEY && !event.newValue) {
      this.cleanup();
    }
  };

  /**
   * Handles authentication errors with proper cleanup
   * @param error - Error object
   */
  private handleAuthError(error: unknown): void {
    if (error instanceof AuthError || (error as Error).message.includes('auth')) {
      this.cleanup();
    }
    throw error;
  }

  /**
   * Cleans up authentication state
   */
  private cleanup(): void {
    if (this.refreshTokenTimeout) {
      clearTimeout(this.refreshTokenTimeout);
    }
    
    void this.storage.removeItem(TOKEN_STORAGE_KEY);
    void this.storage.removeItem(USER_STORAGE_KEY);
    
    this.rateLimitMap.clear();
  }

  /**
   * Cleanup resources on service destruction
   */
  public destroy(): void {
    this.cleanup();
    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', this.handleStorageEvent);
    }
  }
}

// Export singleton instance
export const authService = new AuthService();