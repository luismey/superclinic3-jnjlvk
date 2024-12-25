// @ts-check
import { z } from 'zod'; // v3.22.0
import { User, UserRole, ApiResponse } from './common';

/**
 * Interface defining the structure of authentication tokens
 * Implements JWT token management requirements with strict typing
 */
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
}

/**
 * Interface for login request credentials with remember me functionality
 */
export interface LoginCredentials {
  email: string;
  password: string;
  rememberMe: boolean;
}

/**
 * Interface for user registration with required organization details
 */
export interface RegisterCredentials {
  email: string;
  password: string;
  name: string;
  organizationName: string;
  phoneNumber: string;
}

/**
 * Interface representing the global authentication state
 * Includes user data, tokens, and loading/error states
 */
export interface AuthState {
  user: User | null;
  tokens: AuthTokens | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  lastActivity: Date;
}

/**
 * Interface for authentication API responses including user permissions
 */
export interface AuthResponse {
  user: User;
  tokens: AuthTokens;
  permissions: string[];
}

/**
 * Storage keys for authentication data
 * Used for secure token and user data persistence
 */
export const TOKEN_STORAGE_KEY = 'porfin_auth_tokens';
export const USER_STORAGE_KEY = 'porfin_auth_user';

/**
 * Buffer time in seconds before token expiry to trigger refresh
 * Prevents token expiration during active sessions
 */
export const TOKEN_EXPIRY_BUFFER = 300; // 5 minutes

/**
 * Zod schema for validating login credentials
 */
export const loginCredentialsSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  rememberMe: z.boolean()
});

/**
 * Zod schema for validating registration credentials
 */
export const registerCredentialsSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
      'Password must contain uppercase, lowercase, number and special character'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  organizationName: z.string().min(2, 'Organization name must be at least 2 characters'),
  phoneNumber: z.string().regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number format')
});

/**
 * Zod schema for validating authentication tokens
 */
export const authTokensSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresIn: z.number().positive(),
  tokenType: z.literal('Bearer')
});

/**
 * Type guard to validate JWT tokens
 * Performs comprehensive token validation including format and expiration
 * @param token - The token to validate
 * @returns boolean indicating if the token is valid
 */
export function isValidToken(token: string | null | undefined): boolean {
  if (!token) return false;

  // JWT format validation
  const jwtRegex = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/;
  if (!jwtRegex.test(token)) return false;

  try {
    // Decode token without verification (we're just checking format and expiration)
    const [, payloadBase64] = token.split('.');
    const payload = JSON.parse(atob(payloadBase64));

    // Check token expiration
    const expirationTime = payload.exp * 1000; // Convert to milliseconds
    const currentTime = Date.now();
    
    if (currentTime >= expirationTime - TOKEN_EXPIRY_BUFFER * 1000) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Type guard to check if a response is an AuthResponse
 */
export function isAuthResponse(response: unknown): response is AuthResponse {
  const authResponseSchema = z.object({
    user: z.object({
      id: z.string(),
      email: z.string(),
      role: z.nativeEnum(UserRole)
    }),
    tokens: authTokensSchema,
    permissions: z.array(z.string())
  });

  return authResponseSchema.safeParse(response).success;
}

/**
 * Type for API responses containing authentication data
 */
export type AuthApiResponse<T> = ApiResponse<T> & {
  tokens?: AuthTokens;
};

/**
 * Map of permissions by role implementing the authorization matrix
 */
export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  [UserRole.ADMIN]: ['*'],
  [UserRole.MANAGER]: [
    'dashboard:view',
    'dashboard:edit',
    'chats:view',
    'chats:manage',
    'assistants:view',
    'assistants:manage',
    'campaigns:view',
    'campaigns:manage',
    'settings:view'
  ],
  [UserRole.OPERATOR]: [
    'dashboard:view',
    'chats:view',
    'chats:manage',
    'assistants:view',
    'campaigns:view'
  ],
  [UserRole.AGENT]: [
    'dashboard:view',
    'chats:view',
    'chats:respond'
  ]
};