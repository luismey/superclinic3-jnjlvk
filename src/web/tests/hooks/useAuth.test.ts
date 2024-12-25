import { renderHook, act } from '@testing-library/react-hooks'; // v8.0.1
import { vi } from 'vitest'; // v0.34.0
import { useAuth } from '../../src/hooks/useAuth';
import { useAuthStore } from '../../src/store/auth';

// Test constants
const TEST_USER = {
  id: 'test-user-id',
  email: 'test@example.com',
  name: 'Test User',
  role: 'user',
  organizationId: 'test-org-id',
  preferences: {},
  createdAt: new Date(),
  updatedAt: new Date()
};

const TEST_TOKENS = {
  accessToken: 'test.jwt.token',
  refreshToken: 'test.refresh.token',
  expiresIn: 3600,
  tokenType: 'Bearer' as const
};

const TEST_CREDENTIALS = {
  email: 'test@example.com',
  password: 'password123',
  rememberMe: true
};

// Mock router
const mockRouter = {
  push: vi.fn()
};
vi.mock('next/navigation', () => ({
  useRouter: () => mockRouter
}));

// Mock storage
const mockStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn()
};
vi.mock('../../src/lib/storage', () => ({
  storage: mockStorage
}));

describe('useAuth Hook', () => {
  // Setup and cleanup
  beforeEach(() => {
    vi.clearAllMocks();
    vi.clearAllTimers();
    vi.useFakeTimers();
    
    // Reset auth store state
    useAuthStore.setState({
      user: null,
      tokens: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      lastActivity: Date.now(),
      sessionValid: false
    });

    // Reset rate limiting
    vi.spyOn(global, 'Map').mockImplementation(() => new Map());

    // Mock window event listeners
    global.window.addEventListener = vi.fn();
    global.window.removeEventListener = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('initial state should be unauthenticated', () => {
    const { result } = renderHook(() => useAuth());

    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  test('login should handle successful authentication', async () => {
    // Mock successful login
    const mockLogin = vi.fn().mockResolvedValue({
      user: TEST_USER,
      tokens: TEST_TOKENS
    });
    useAuthStore.setState({ login: mockLogin });

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.login(TEST_CREDENTIALS);
    });

    // Verify authentication state
    expect(result.current.user).toEqual(TEST_USER);
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();

    // Verify navigation
    expect(mockRouter.push).toHaveBeenCalledWith('/dashboard');

    // Verify event listeners setup
    expect(window.addEventListener).toHaveBeenCalledWith('mousedown', expect.any(Function));
    expect(window.addEventListener).toHaveBeenCalledWith('keydown', expect.any(Function));
    expect(window.addEventListener).toHaveBeenCalledWith('touchstart', expect.any(Function));
    expect(window.addEventListener).toHaveBeenCalledWith('scroll', expect.any(Function));
  });

  test('login should handle rate limiting', async () => {
    const { result } = renderHook(() => useAuth());

    // Attempt multiple logins
    for (let i = 0; i < 5; i++) {
      await act(async () => {
        try {
          await result.current.login(TEST_CREDENTIALS);
        } catch (error) {
          // Ignore errors for test
        }
      });
    }

    // Next attempt should be rate limited
    await expect(
      act(async () => {
        await result.current.login(TEST_CREDENTIALS);
      })
    ).rejects.toThrow('Too many login attempts');
  });

  test('logout should clean up session and navigate', async () => {
    // Setup authenticated state
    useAuthStore.setState({
      user: TEST_USER,
      tokens: TEST_TOKENS,
      isAuthenticated: true,
      sessionValid: true
    });

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.logout();
    });

    // Verify cleanup
    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
    expect(mockRouter.push).toHaveBeenCalledWith('/login');

    // Verify event listener cleanup
    expect(window.removeEventListener).toHaveBeenCalledWith('mousedown', expect.any(Function));
    expect(window.removeEventListener).toHaveBeenCalledWith('keydown', expect.any(Function));
    expect(window.removeEventListener).toHaveBeenCalledWith('touchstart', expect.any(Function));
    expect(window.removeEventListener).toHaveBeenCalledWith('scroll', expect.any(Function));
  });

  test('should handle automatic token refresh', async () => {
    // Mock successful token refresh
    const mockRefreshToken = vi.fn().mockResolvedValue({
      ...TEST_TOKENS,
      accessToken: 'new.jwt.token'
    });
    useAuthStore.setState({ refreshToken: mockRefreshToken });

    const { result } = renderHook(() => useAuth());

    // Setup authenticated state
    await act(async () => {
      await result.current.login(TEST_CREDENTIALS);
    });

    // Fast-forward past token refresh interval
    await act(async () => {
      vi.advanceTimersByTime(5 * 60 * 1000); // 5 minutes
    });

    // Verify token refresh was called
    expect(mockRefreshToken).toHaveBeenCalled();
  });

  test('should handle session timeout', async () => {
    const { result } = renderHook(() => useAuth());

    // Setup authenticated state
    await act(async () => {
      await result.current.login(TEST_CREDENTIALS);
    });

    // Fast-forward past session timeout
    await act(async () => {
      vi.advanceTimersByTime(30 * 60 * 1000); // 30 minutes
    });

    // Verify session was terminated
    expect(result.current.isAuthenticated).toBe(false);
    expect(mockRouter.push).toHaveBeenCalledWith('/login');
  });

  test('should protect routes for unauthenticated users', () => {
    // Mock protected route
    Object.defineProperty(window, 'location', {
      value: { pathname: '/dashboard' }
    });

    const { result } = renderHook(() => useAuth());

    expect(mockRouter.push).toHaveBeenCalledWith('/login');
  });

  test('should handle multi-tab synchronization', async () => {
    const { result } = renderHook(() => useAuth());

    // Setup authenticated state
    await act(async () => {
      await result.current.login(TEST_CREDENTIALS);
    });

    // Simulate storage event from another tab
    await act(async () => {
      const storageEvent = new StorageEvent('storage', {
        key: 'auth_logout',
        newValue: 'true'
      });
      window.dispatchEvent(storageEvent);
    });

    // Verify session was terminated
    expect(result.current.isAuthenticated).toBe(false);
    expect(mockRouter.push).toHaveBeenCalledWith('/login');
  });

  test('should handle token refresh failure with backoff', async () => {
    const mockRefreshToken = vi.fn()
      .mockRejectedValueOnce(new Error('Network error'))
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce(TEST_TOKENS);

    useAuthStore.setState({ refreshToken: mockRefreshToken });

    const { result } = renderHook(() => useAuth());

    // Setup authenticated state
    await act(async () => {
      await result.current.login(TEST_CREDENTIALS);
    });

    // Trigger token refresh
    await act(async () => {
      vi.advanceTimersByTime(5 * 60 * 1000); // 5 minutes
    });

    // Verify exponential backoff
    expect(mockRefreshToken).toHaveBeenCalledTimes(3);
    expect(vi.getTimerCount()).toBe(0); // All retries completed
  });
});