// @ts-check
import { z } from 'zod'; // v3.22.0

/**
 * Global constants for pagination
 */
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

/**
 * Base interface for all entity types providing common fields
 */
export interface BaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Enum defining all possible user roles in the system
 */
export enum UserRole {
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  OPERATOR = 'OPERATOR',
  AGENT = 'AGENT'
}

/**
 * Comprehensive user interface matching backend model
 */
export interface User extends BaseEntity {
  email: string;
  name: string;
  role: UserRole;
  organizationId: string;
  preferences: Record<string, unknown>;
}

/**
 * Generic interface for API responses
 */
export interface ApiResponse<T> {
  data: T;
  message: string;
  status: number;
}

/**
 * Interface for standardized API error responses
 */
export interface ApiError {
  message: string;
  code: string;
  details: Record<string, unknown>;
}

/**
 * Generic interface for paginated responses
 */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * Interface for date range selections
 */
export interface DateRange {
  startDate: Date;
  endDate: Date;
}

/**
 * Enum for sort directions
 */
export enum SortDirection {
  ASC = 'ASC',
  DESC = 'DESC'
}

/**
 * Interface for sort order specifications
 */
export interface SortOrder {
  field: string;
  direction: SortDirection;
}

/**
 * Zod schema for runtime validation of User type
 */
export const userSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string().min(1),
  role: z.nativeEnum(UserRole),
  organizationId: z.string().uuid(),
  preferences: z.record(z.unknown()),
  createdAt: z.date(),
  updatedAt: z.date()
});

/**
 * Zod schema for API error validation
 */
export const apiErrorSchema = z.object({
  message: z.string(),
  code: z.string(),
  details: z.record(z.unknown())
});

/**
 * Type guard to check if a response is an API error
 * @param response - The response to check
 * @returns True if the response matches the ApiError interface
 */
export function isError(response: unknown): response is ApiError {
  try {
    return apiErrorSchema.safeParse(response).success;
  } catch {
    return false;
  }
}

/**
 * Zod schema for date range validation
 */
export const dateRangeSchema = z.object({
  startDate: z.date(),
  endDate: z.date()
}).refine(data => data.startDate <= data.endDate, {
  message: "End date must be after start date"
});

/**
 * Zod schema for sort order validation
 */
export const sortOrderSchema = z.object({
  field: z.string(),
  direction: z.nativeEnum(SortDirection)
});

/**
 * Generic type for API response validation
 */
export type ValidatedApiResponse<T> = z.infer<typeof apiResponseSchema<T>>;

/**
 * Helper function to create a typed API response schema
 * @param dataSchema - Zod schema for the response data
 * @returns Zod schema for the full API response
 */
export function apiResponseSchema<T extends z.ZodType>(dataSchema: T) {
  return z.object({
    data: dataSchema,
    message: z.string(),
    status: z.number().int().positive()
  });
}

/**
 * Helper function to create a typed paginated response schema
 * @param itemSchema - Zod schema for the paginated items
 * @returns Zod schema for the full paginated response
 */
export function paginatedResponseSchema<T extends z.ZodType>(itemSchema: T) {
  return z.object({
    items: z.array(itemSchema),
    total: z.number().int().nonnegative(),
    page: z.number().int().positive(),
    pageSize: z.number().int().positive().max(MAX_PAGE_SIZE),
    totalPages: z.number().int().nonnegative()
  });
}