import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import MockAdapter from 'axios-mock-adapter';
import { waitFor } from '@testing-library/react';
import CryptoJS from 'crypto-js';
import { AuthService } from '../../src/services/auth';
import { StorageService } from '../../src/lib/storage';
import { axiosInstance } from '../../src/lib/axios';
import { 
  AuthResponse, 
  LoginCredentials,
  RegisterCredentials,
  UserRole,
  TOKEN_STORAGE_KEY,
  USER_STORAGE_KEY,
  TOKEN_EXPIRY_BUFFER
} from '../../src/types/auth';

// Mock dependencies
jest.mock('../../src/lib/storage');
const mockAxios = new MockAdapter(axiosInstance);
const mockStorageService = jest.mocked(StorageService);

// Test constants
const TEST_TIMEOUT = 5000;
const VALID_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjk5OTk5OTk5OTl9.signature';
const EXPIRED_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE1MTYyMzkwMjJ9.signature';

describe('AuthService', () => {
  let authService: AuthService;
  let mockStorage: jest.Mocked<StorageService>;

  beforeEach(() => {
    // Reset mocks and create fresh instance
    jest.clearAllMocks();
    mockAxios.reset();
    mockStorage = new StorageService() as jest.Mocked<StorageService>;
    authService = new AuthService();
    
    // Setup storage mock
    jest.spyOn(window, 'addEventListener');
    jest.spyOn(window, 'removeEventListener');
  });

  afterEach(() => {
    authService.destroy();
    mockAxios.reset();
    jest.clearAllTimers();
  });

  describe('login', () => {
    const validCredentials: LoginCredentials = {
      email: 'test@example.com',
      password: 'Test@123456',
      rememberMe: true
    };

    const mockAuthResponse: AuthResponse = {
      user: {
        id: '123',
        email: 'test@example.com',
        name: 'Test User',
        role: UserRole.MANAGER,
        organizationId: 'org123',
        preferences: {},
        createdAt: new Date(),
        updatedAt: new Date()
      },
      tokens: {
        accessToken: VALID_TOKEN,
        refreshToken: 'refresh_token',
        expiresIn: 3600,
        tokenType: 'Bearer'
      },
      permissions: ['dashboard:view', 'chats:manage']
    };

    test('should successfully login with valid credentials', async () => {
      mockAxios.onPost('/auth/login').reply(200, mockAuthResponse);
      mockStorage.setItem.mockResolvedValue();

      const response = await authService.login(validCredentials);

      expect(response).toEqual(mockAuthResponse);
      expect(mockStorage.setItem).toHaveBeenCalledWith(
        TOKEN_STORAGE_KEY,
        mockAuthResponse.tokens,
        expect.objectContaining({ encrypt: true })
      );
      expect(mockStorage.setItem).toHaveBeenCalledWith(
        USER_STORAGE_KEY,
        mockAuthResponse.user,
        expect.objectContaining({ encrypt: true })
      );
    });

    test('should handle rate limiting', async () => {
      // Attempt multiple logins rapidly
      mockAxios.onPost('/auth/login').reply(200, mockAuthResponse);

      const attempts = Array(6).fill(validCredentials);
      const results = await Promise.allSettled(
        attempts.map(cred => authService.login(cred))
      );

      expect(results.filter(r => r.status === 'rejected')).toHaveLength(1);
      expect(results[5].status === 'rejected' && results[5]).toMatchObject({
        reason: expect.objectContaining({
          message: expect.stringContaining('Rate limit exceeded')
        })
      });
    });

    test('should validate credentials schema', async () => {
      const invalidCredentials = {
        email: 'invalid-email',
        password: '123',
        rememberMe: true
      };

      await expect(authService.login(invalidCredentials)).rejects.toThrow();
    });

    test('should handle token refresh scheduling', async () => {
      jest.useFakeTimers();
      mockAxios.onPost('/auth/login').reply(200, mockAuthResponse);
      mockAxios.onPost('/auth/refresh').reply(200, {
        tokens: {
          ...mockAuthResponse.tokens,
          accessToken: 'new_token'
        }
      });

      await authService.login(validCredentials);

      // Fast-forward to just before token refresh
      jest.advanceTimersByTime((3600 - TOKEN_EXPIRY_BUFFER - 1) * 1000);
      expect(mockAxios.history.post.filter(r => r.url === '/auth/refresh')).toHaveLength(0);

      // Fast-forward past token refresh time
      jest.advanceTimersByTime(TOKEN_EXPIRY_BUFFER * 1000 + 1000);
      await waitFor(() => {
        expect(mockAxios.history.post.filter(r => r.url === '/auth/refresh')).toHaveLength(1);
      });
    });
  });

  describe('register', () => {
    const validRegistration: RegisterCredentials = {
      email: 'new@example.com',
      password: 'Test@123456',
      name: 'New User',
      organizationName: 'Test Org',
      phoneNumber: '+5511999999999'
    };

    test('should successfully register new user', async () => {
      const mockResponse = {
        user: {
          id: 'new123',
          email: validRegistration.email,
          name: validRegistration.name,
          role: UserRole.MANAGER,
          organizationId: 'neworg123',
          preferences: {},
          createdAt: new Date(),
          updatedAt: new Date()
        },
        tokens: {
          accessToken: VALID_TOKEN,
          refreshToken: 'refresh_token',
          expiresIn: 3600,
          tokenType: 'Bearer'
        },
        permissions: ['dashboard:view']
      };

      mockAxios.onPost('/auth/register').reply(200, mockResponse);
      const response = await authService.register(validRegistration);

      expect(response).toEqual(mockResponse);
      expect(mockStorage.setItem).toHaveBeenCalledTimes(2);
    });

    test('should validate registration data', async () => {
      const invalidRegistration = {
        ...validRegistration,
        password: '123', // Too short
        phoneNumber: 'invalid'
      };

      await expect(authService.register(invalidRegistration)).rejects.toThrow();
    });
  });

  describe('token management', () => {
    test('should handle token refresh', async () => {
      const mockTokens = {
        accessToken: VALID_TOKEN,
        refreshToken: 'refresh_token',
        expiresIn: 3600,
        tokenType: 'Bearer' as const
      };

      mockStorage.getItem.mockResolvedValueOnce(mockTokens);
      mockAxios.onPost('/auth/refresh').reply(200, {
        tokens: {
          ...mockTokens,
          accessToken: 'new_token'
        }
      });

      const newTokens = await authService.refreshToken();
      expect(newTokens.accessToken).toBe('new_token');
      expect(mockStorage.setItem).toHaveBeenCalledWith(
        TOKEN_STORAGE_KEY,
        expect.objectContaining({ accessToken: 'new_token' }),
        expect.any(Object)
      );
    });

    test('should handle token validation', async () => {
      mockStorage.getItem.mockResolvedValueOnce({
        accessToken: EXPIRED_TOKEN,
        refreshToken: 'refresh_token',
        expiresIn: 0,
        tokenType: 'Bearer'
      });

      const isValid = await authService.validateSession();
      expect(isValid).toBe(false);
    });
  });

  describe('session management', () => {
    test('should handle logout', async () => {
      mockStorage.getItem.mockResolvedValueOnce({
        refreshToken: 'refresh_token'
      });
      mockAxios.onPost('/auth/logout').reply(200);

      await authService.logout();

      expect(mockStorage.removeItem).toHaveBeenCalledWith(TOKEN_STORAGE_KEY);
      expect(mockStorage.removeItem).toHaveBeenCalledWith(USER_STORAGE_KEY);
    });

    test('should handle cross-tab synchronization', async () => {
      const storageEvent = new StorageEvent('storage', {
        key: TOKEN_STORAGE_KEY,
        newValue: null
      });

      window.dispatchEvent(storageEvent);

      expect(mockStorage.removeItem).toHaveBeenCalledWith(TOKEN_STORAGE_KEY);
    });
  });

  describe('security controls', () => {
    test('should encrypt sensitive data', async () => {
      const mockData = { test: 'sensitive' };
      const encryptSpy = jest.spyOn(CryptoJS.AES, 'encrypt');

      await mockStorage.setItem('test', mockData, { encrypt: true });

      expect(encryptSpy).toHaveBeenCalled();
    });

    test('should handle unauthorized access', async () => {
      mockAxios.onGet('/protected').reply(401);
      mockStorage.getItem.mockResolvedValueOnce(null);

      const isValid = await authService.validateSession();
      expect(isValid).toBe(false);
    });
  });
});