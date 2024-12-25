import { z } from 'zod'; // v3.22.0
import { API_CONSTANTS } from './constants';
import memoize from 'lodash/memoize'; // v4.17.21

/**
 * Deployment environment enumeration
 */
export enum Environment {
  Development = 'development',
  Staging = 'staging',
  Production = 'production'
}

/**
 * Firebase configuration interface
 */
interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
}

/**
 * Environment configuration interface
 */
export interface EnvironmentConfig {
  environment: Environment;
  apiUrl: string;
  wsUrl: string;
  openAiApiKey: string;
  firebaseConfig: FirebaseConfig;
  analyticsId: string;
  sentryDsn: string;
  debugMode: boolean;
}

/**
 * Environment variables validation schema
 */
const envSchema = z.object({
  NODE_ENV: z.enum([Environment.Development, Environment.Staging, Environment.Production]),
  NEXT_PUBLIC_API_URL: z.string().url().optional(),
  NEXT_PUBLIC_WS_URL: z.string().url().optional(),
  NEXT_PUBLIC_OPENAI_API_KEY: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_CONFIG: z.string().min(1),
  NEXT_PUBLIC_ANALYTICS_ID: z.string().min(1),
  NEXT_PUBLIC_SENTRY_DSN: z.string().url(),
  NEXT_PUBLIC_DEBUG_MODE: z.string().optional(),
});

/**
 * Firebase configuration validation schema
 */
const firebaseConfigSchema = z.object({
  apiKey: z.string().min(1),
  authDomain: z.string().min(1),
  projectId: z.string().min(1),
  storageBucket: z.string().min(1),
  messagingSenderId: z.string().min(1),
  appId: z.string().min(1),
  measurementId: z.string().optional(),
});

/**
 * Validates Firebase configuration object structure and content
 * @param config - Raw Firebase configuration object
 * @returns Validated Firebase configuration
 * @throws {Error} If validation fails
 */
function validateFirebaseConfig(config: Record<string, unknown>): FirebaseConfig {
  try {
    return firebaseConfigSchema.parse(config);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(`Invalid Firebase configuration: ${error.errors.map(e => e.message).join(', ')}`);
    }
    throw error;
  }
}

/**
 * Validates all required environment variables
 * @throws {Error} If validation fails
 */
function validateEnvironmentVariables(): void {
  try {
    envSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingVars = error.errors.map(e => e.path.join('.'));
      throw new Error(`Missing or invalid environment variables: ${missingVars.join(', ')}`);
    }
    throw error;
  }
}

/**
 * Constructs API URL based on environment and configuration
 */
function getApiUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_API_URL;
  if (envUrl) return envUrl;

  const baseUrl = window.location.origin;
  return `${baseUrl}${API_CONSTANTS.BASE_URL}/${API_CONSTANTS.VERSION}`;
}

/**
 * Constructs WebSocket URL based on environment and configuration
 */
function getWsUrl(): string {
  const envWsUrl = process.env.NEXT_PUBLIC_WS_URL;
  if (envWsUrl) return envWsUrl;

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.host;
  return `${protocol}//${host}${API_CONSTANTS.BASE_URL}/${API_CONSTANTS.VERSION}/ws`;
}

/**
 * Masks sensitive configuration values for logging
 */
function maskSensitiveValues(config: EnvironmentConfig): Record<string, unknown> {
  return {
    ...config,
    openAiApiKey: '***',
    firebaseConfig: {
      ...config.firebaseConfig,
      apiKey: '***',
      messagingSenderId: '***',
      appId: '***',
    },
    sentryDsn: '***',
  };
}

/**
 * Retrieves and validates the current environment configuration
 * @returns Validated environment configuration
 * @throws {Error} If validation fails
 */
export const getEnvironmentConfig = memoize((): EnvironmentConfig => {
  // Validate environment variables
  validateEnvironmentVariables();

  // Parse Firebase config
  const firebaseConfig = validateFirebaseConfig(
    JSON.parse(process.env.NEXT_PUBLIC_FIREBASE_CONFIG || '{}')
  );

  // Construct configuration
  const config: EnvironmentConfig = {
    environment: process.env.NODE_ENV as Environment,
    apiUrl: getApiUrl(),
    wsUrl: getWsUrl(),
    openAiApiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY!,
    firebaseConfig,
    analyticsId: process.env.NEXT_PUBLIC_ANALYTICS_ID!,
    sentryDsn: process.env.NEXT_PUBLIC_SENTRY_DSN!,
    debugMode: process.env.NEXT_PUBLIC_DEBUG_MODE === 'true',
  };

  // Log masked configuration in development
  if (config.debugMode) {
    console.log('Environment Configuration:', maskSensitiveValues(config));
  }

  return config;
});

/**
 * Helper function to check if running in development environment
 */
export const isDevelopment = (): boolean => 
  getEnvironmentConfig().environment === Environment.Development;

/**
 * Helper function to check if running in production environment
 */
export const isProduction = (): boolean =>
  getEnvironmentConfig().environment === Environment.Production;

/**
 * Helper function to check if running in staging environment
 */
export const isStaging = (): boolean =>
  getEnvironmentConfig().environment === Environment.Staging;

/**
 * Helper function to check if debug mode is enabled
 */
export const isDebugMode = (): boolean =>
  getEnvironmentConfig().debugMode;