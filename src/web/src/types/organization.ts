import { z } from 'zod'; // v3.22.0
import { BaseEntity } from './common';

/**
 * Available organization subscription plan types
 */
export enum OrganizationPlan {
  FREE = 'FREE',
  BASIC = 'BASIC',
  PROFESSIONAL = 'PROFESSIONAL',
  ENTERPRISE = 'ENTERPRISE'
}

/**
 * Default limits for organization resources
 */
export const DEFAULT_MAX_USERS = 5;
export const DEFAULT_MAX_CAMPAIGNS = 10;
export const DEFAULT_MAX_ASSISTANTS = 3;
export const DEFAULT_MAX_MESSAGES_PER_DAY = 1000;
export const DEFAULT_MAX_CONCURRENT_CHATS = 50;

/**
 * Feature flags controlling organization capabilities
 */
export interface OrganizationFeatureFlags {
  whatsappEnabled: boolean;
  aiAssistantEnabled: boolean;
  campaignsEnabled: boolean;
  analyticsEnabled: boolean;
  customBranding: boolean;
}

/**
 * Usage limits based on organization subscription plan
 */
export interface OrganizationLimits {
  maxUsers: number;
  maxCampaigns: number;
  maxAssistants: number;
  maxMessagesPerDay: number;
  maxConcurrentChats: number;
}

/**
 * Comprehensive organization settings including features and limits
 */
export interface OrganizationSettings {
  features: OrganizationFeatureFlags;
  limits: OrganizationLimits;
  timezone: string;
  language: string;
  customization: Record<string, unknown>;
}

/**
 * Main organization entity interface extending BaseEntity
 */
export interface Organization extends BaseEntity {
  name: string;
  plan: OrganizationPlan;
  settings: OrganizationSettings;
  isActive: boolean;
  subscriptionEndsAt: Date;
}

/**
 * Zod schema for feature flags validation
 */
const organizationFeatureFlagsSchema = z.object({
  whatsappEnabled: z.boolean(),
  aiAssistantEnabled: z.boolean(),
  campaignsEnabled: z.boolean(),
  analyticsEnabled: z.boolean(),
  customBranding: z.boolean()
});

/**
 * Zod schema for organization limits validation
 */
const organizationLimitsSchema = z.object({
  maxUsers: z.number().int().positive().default(DEFAULT_MAX_USERS),
  maxCampaigns: z.number().int().positive().default(DEFAULT_MAX_CAMPAIGNS),
  maxAssistants: z.number().int().positive().default(DEFAULT_MAX_ASSISTANTS),
  maxMessagesPerDay: z.number().int().positive().default(DEFAULT_MAX_MESSAGES_PER_DAY),
  maxConcurrentChats: z.number().int().positive().default(DEFAULT_MAX_CONCURRENT_CHATS)
});

/**
 * Zod schema for organization settings validation
 */
const organizationSettingsSchema = z.object({
  features: organizationFeatureFlagsSchema,
  limits: organizationLimitsSchema,
  timezone: z.string().regex(/^[A-Za-z]+\/[A-Za-z_]+$/, {
    message: "Invalid timezone format. Expected format: Region/City (e.g., America/Sao_Paulo)"
  }),
  language: z.string().regex(/^[a-z]{2}-[A-Z]{2}$/, {
    message: "Invalid language format. Expected format: xx-XX (e.g., pt-BR)"
  }),
  customization: z.record(z.unknown())
});

/**
 * Comprehensive Zod schema for organization validation
 */
export const organizationSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1, "Organization name is required")
    .max(100, "Organization name cannot exceed 100 characters")
    .regex(/^[\w\s-]+$/, {
      message: "Organization name can only contain letters, numbers, spaces, and hyphens"
    }),
  plan: z.nativeEnum(OrganizationPlan),
  settings: organizationSettingsSchema,
  isActive: z.boolean(),
  subscriptionEndsAt: z.date().min(new Date(), {
    message: "Subscription end date must be in the future"
  }),
  createdAt: z.date(),
  updatedAt: z.date()
}).refine(
  (data) => {
    const now = new Date();
    return data.createdAt <= data.updatedAt && data.createdAt <= now;
  },
  {
    message: "Invalid date relationships in organization data",
    path: ["createdAt", "updatedAt"]
  }
);

/**
 * Type for validated organization data
 */
export type ValidatedOrganization = z.infer<typeof organizationSchema>;

/**
 * Default organization settings based on plan
 */
export const getDefaultOrganizationSettings = (plan: OrganizationPlan): OrganizationSettings => ({
  features: {
    whatsappEnabled: true,
    aiAssistantEnabled: plan !== OrganizationPlan.FREE,
    campaignsEnabled: plan !== OrganizationPlan.FREE,
    analyticsEnabled: plan !== OrganizationPlan.FREE,
    customBranding: plan === OrganizationPlan.ENTERPRISE
  },
  limits: {
    maxUsers: plan === OrganizationPlan.ENTERPRISE ? Infinity : DEFAULT_MAX_USERS,
    maxCampaigns: plan === OrganizationPlan.ENTERPRISE ? Infinity : DEFAULT_MAX_CAMPAIGNS,
    maxAssistants: plan === OrganizationPlan.ENTERPRISE ? Infinity : DEFAULT_MAX_ASSISTANTS,
    maxMessagesPerDay: plan === OrganizationPlan.ENTERPRISE ? Infinity : DEFAULT_MAX_MESSAGES_PER_DAY,
    maxConcurrentChats: plan === OrganizationPlan.ENTERPRISE ? Infinity : DEFAULT_MAX_CONCURRENT_CHATS
  },
  timezone: "America/Sao_Paulo",
  language: "pt-BR",
  customization: {}
});