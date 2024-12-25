import { z } from 'zod'; // v3.22.0
import { BaseEntity } from './common';
import { Organization } from './organization';

/**
 * Enumeration of available campaign types
 */
export enum CampaignType {
  BROADCAST = 'BROADCAST',   // One-time broadcast to all targets
  SCHEDULED = 'SCHEDULED',   // Single scheduled campaign
  RECURRING = 'RECURRING'    // Recurring campaign with pattern
}

/**
 * Enumeration of possible campaign statuses
 */
export enum CampaignStatus {
  DRAFT = 'DRAFT',           // Initial creation state
  SCHEDULED = 'SCHEDULED',   // Ready to execute
  RUNNING = 'RUNNING',       // Currently executing
  PAUSED = 'PAUSED',        // Temporarily stopped
  COMPLETED = 'COMPLETED',   // Successfully finished
  FAILED = 'FAILED'         // Execution failed
}

/**
 * Interface for campaign schedule configuration
 */
export interface CampaignSchedule {
  startTime: Date;                  // Campaign start time
  endTime: Date | null;            // Optional campaign end time
  timezone: string;                // Campaign timezone (e.g., America/Sao_Paulo)
  recurringPattern: string | null; // Cron pattern for recurring campaigns
  dailyStartHour: number;         // Hour to start sending (0-23)
  dailyEndHour: number;           // Hour to stop sending (0-23)
  activeDays: number[];           // Active days of week (0-6, 0=Sunday)
}

/**
 * Interface for campaign analytics tracking
 */
export interface CampaignAnalytics {
  totalRecipients: number;        // Total target recipients
  messagesSent: number;           // Messages sent so far
  messagesDelivered: number;      // Successfully delivered messages
  messagesFailed: number;         // Failed message deliveries
  messagesPending: number;        // Messages waiting to be sent
  deliveryRate: number;           // Successful delivery percentage
  failureRate: number;           // Message failure percentage
  averageDeliveryTime: number;   // Average delivery time in ms
}

/**
 * Main campaign entity interface
 */
export interface Campaign extends BaseEntity {
  organizationId: string;                    // Reference to organization
  name: string;                              // Campaign name
  description: string;                       // Campaign description
  type: CampaignType;                       // Campaign type
  status: CampaignStatus;                   // Current status
  messageTemplate: Record<string, unknown>;  // Message template configuration
  targetFilters: Record<string, unknown>;    // Target audience filters
  scheduleConfig: CampaignSchedule;         // Schedule settings
  analytics: CampaignAnalytics;             // Real-time analytics
  rateLimit: number;                        // Messages per minute limit
  isActive: boolean;                        // Campaign active state
  lastExecutionTime: Date | null;           // Last execution timestamp
  nextExecutionTime: Date | null;           // Next scheduled execution
}

/**
 * DTO for campaign creation
 */
export interface CreateCampaignDto {
  name: string;
  description: string;
  type: CampaignType;
  messageTemplate: Record<string, unknown>;
  targetFilters: Record<string, unknown>;
  scheduleConfig: CampaignSchedule;
  rateLimit: number;
}

/**
 * DTO for campaign updates with optional fields
 */
export interface UpdateCampaignDto {
  name?: string;
  description?: string;
  status?: CampaignStatus;
  messageTemplate?: Record<string, unknown>;
  targetFilters?: Record<string, unknown>;
  scheduleConfig?: Partial<CampaignSchedule>;
  rateLimit?: number;
  isActive?: boolean;
}

/**
 * Zod schema for campaign schedule validation
 */
const campaignScheduleSchema = z.object({
  startTime: z.date(),
  endTime: z.date().nullable(),
  timezone: z.string().regex(/^[A-Za-z]+\/[A-Za-z_]+$/),
  recurringPattern: z.string().nullable(),
  dailyStartHour: z.number().min(0).max(23),
  dailyEndHour: z.number().min(0).max(23),
  activeDays: z.array(z.number().min(0).max(6))
}).refine(
  data => data.dailyStartHour < data.dailyEndHour,
  { message: "Daily end hour must be after start hour" }
);

/**
 * Zod schema for campaign analytics validation
 */
const campaignAnalyticsSchema = z.object({
  totalRecipients: z.number().nonnegative(),
  messagesSent: z.number().nonnegative(),
  messagesDelivered: z.number().nonnegative(),
  messagesFailed: z.number().nonnegative(),
  messagesPending: z.number().nonnegative(),
  deliveryRate: z.number().min(0).max(100),
  failureRate: z.number().min(0).max(100),
  averageDeliveryTime: z.number().nonnegative()
});

/**
 * Comprehensive Zod schema for campaign validation
 */
export const campaignSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  name: z.string().min(1).max(100),
  description: z.string().max(500),
  type: z.nativeEnum(CampaignType),
  status: z.nativeEnum(CampaignStatus),
  messageTemplate: z.record(z.unknown()),
  targetFilters: z.record(z.unknown()),
  scheduleConfig: campaignScheduleSchema,
  analytics: campaignAnalyticsSchema,
  rateLimit: z.number().min(1).max(60),
  isActive: z.boolean(),
  lastExecutionTime: z.date().nullable(),
  nextExecutionTime: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date()
});

/**
 * Type for validated campaign data
 */
export type ValidatedCampaign = z.infer<typeof campaignSchema>;