// @ts-check
import { z } from 'zod'; // v3.22.0

// API Constants Schema
const apiConstantsSchema = z.object({
  BASE_URL: z.string().startsWith('/'),
  VERSION: z.string().startsWith('v'),
  TIMEOUT: z.number().positive().max(60000),
  RETRY_ATTEMPTS: z.number().int().positive().max(5),
}).readonly();

// UI Constants Schema
const uiConstantsSchema = z.object({
  BREAKPOINTS: z.object({
    MOBILE: z.string(),
    TABLET: z.string(),
    DESKTOP: z.string(),
    WIDE: z.string(),
  }).readonly(),
  SPACING: z.object({
    BASE: z.string(),
    XS: z.string(),
    SM: z.string(),
    MD: z.string(),
    LG: z.string(),
    XL: z.string(),
  }).readonly(),
  TYPOGRAPHY: z.object({
    FONT_FAMILY: z.string(),
    SIZES: z.object({
      H1: z.string(),
      H2: z.string(),
      H3: z.string(),
      BODY: z.string(),
      CAPTION: z.string(),
    }).readonly(),
  }).readonly(),
  COLORS: z.object({
    PRIMARY: z.string(),
    SECONDARY: z.string(),
    ACCENT: z.string(),
    ERROR: z.string(),
  }).readonly(),
}).readonly();

// WhatsApp Constants Schema
const whatsappConstantsSchema = z.object({
  RATE_LIMITS: z.object({
    MESSAGES_PER_DAY: z.string(),
    MESSAGES_PER_MINUTE: z.string(),
    MIN_DELAY_MS: z.string(),
    BURST_LIMIT: z.string(),
  }).readonly(),
  MESSAGE_TYPES: z.object({
    TEXT: z.string(),
    IMAGE: z.string(),
    DOCUMENT: z.string(),
    TEMPLATE: z.string(),
    INTERACTIVE: z.string(),
  }).readonly(),
  RETRY_CONFIG: z.object({
    MAX_RETRIES: z.string(),
    BACKOFF_MS: z.string(),
    MAX_BACKOFF_MS: z.string(),
  }).readonly(),
}).readonly();

// Pagination Constants Schema
const paginationConstantsSchema = z.object({
  DEFAULT_PAGE_SIZE: z.string(),
  MAX_PAGE_SIZE: z.string(),
  DEFAULT_PAGE: z.string(),
}).readonly();

// API Constants
export const API_CONSTANTS = {
  BASE_URL: '/api',
  VERSION: 'v1',
  TIMEOUT: 30000,
  RETRY_ATTEMPTS: 3,
} as const;

// UI Constants
export const UI_CONSTANTS = {
  BREAKPOINTS: {
    MOBILE: '320',
    TABLET: '768',
    DESKTOP: '1024',
    WIDE: '1280',
  },
  SPACING: {
    BASE: '4',
    XS: '8',
    SM: '16',
    MD: '24',
    LG: '32',
    XL: '48',
  },
  TYPOGRAPHY: {
    FONT_FAMILY: 'Inter, sans-serif',
    SIZES: {
      H1: '24',
      H2: '20',
      H3: '16',
      BODY: '14',
      CAPTION: '12',
    },
  },
  COLORS: {
    PRIMARY: '#2563eb',
    SECONDARY: '#64748b',
    ACCENT: '#7c3aed',
    ERROR: '#ef4444',
  },
} as const;

// WhatsApp Constants
export const WHATSAPP_CONSTANTS = {
  RATE_LIMITS: {
    MESSAGES_PER_DAY: '1000',
    MESSAGES_PER_MINUTE: '60',
    MIN_DELAY_MS: '1000',
    BURST_LIMIT: '10',
  },
  MESSAGE_TYPES: {
    TEXT: 'text',
    IMAGE: 'image',
    DOCUMENT: 'document',
    TEMPLATE: 'template',
    INTERACTIVE: 'interactive',
  },
  RETRY_CONFIG: {
    MAX_RETRIES: '3',
    BACKOFF_MS: '1000',
    MAX_BACKOFF_MS: '5000',
  },
} as const;

// Pagination Constants
export const PAGINATION_CONSTANTS = {
  DEFAULT_PAGE_SIZE: '20',
  MAX_PAGE_SIZE: '100',
  DEFAULT_PAGE: '1',
} as const;

// Type definitions for exported constants
export type ApiConstants = typeof API_CONSTANTS;
export type UiConstants = typeof UI_CONSTANTS;
export type WhatsAppConstants = typeof WHATSAPP_CONSTANTS;
export type PaginationConstants = typeof PAGINATION_CONSTANTS;

/**
 * Validates all constant configurations using Zod schemas
 * @throws {Error} If validation fails with detailed error message
 * @returns {boolean} True if all validations pass
 */
export function validateConstants(): boolean {
  try {
    // Validate each constant group
    apiConstantsSchema.parse(API_CONSTANTS);
    uiConstantsSchema.parse(UI_CONSTANTS);
    whatsappConstantsSchema.parse(WHATSAPP_CONSTANTS);
    paginationConstantsSchema.parse(PAGINATION_CONSTANTS);
    
    return true;
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(`Constants validation failed: ${error.errors.map(e => e.message).join(', ')}`);
    }
    throw error;
  }
}

// Validate constants at runtime when importing this file
validateConstants();