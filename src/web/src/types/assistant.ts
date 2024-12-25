// @ts-check
import { z } from 'zod'; // v3.22.0
import { BaseEntity } from './common';

/**
 * Maximum and minimum lengths for assistant name
 */
export const MAX_NAME_LENGTH = 100;
export const MIN_NAME_LENGTH = 2;

/**
 * Default values for assistant configuration
 */
export const DEFAULT_TEMPERATURE = 0.7;
export const DEFAULT_MAX_TOKENS = 150;

/**
 * Enum defining available types of virtual assistants
 */
export enum AssistantType {
  CUSTOMER_SERVICE = 'CUSTOMER_SERVICE',
  SALES = 'SALES',
  APPOINTMENT = 'APPOINTMENT',
  CUSTOM = 'CUSTOM'
}

/**
 * Interface defining the configuration options for an AI assistant
 */
export interface AssistantConfig {
  promptTemplate: string;
  temperature: number;
  maxTokens: number;
  modelName: string;
  contextWindow: number;
  fallbackBehavior: string;
  stopSequences: string[];
  responseFormat: string;
}

/**
 * Interface for a document in the knowledge base
 */
export interface Document {
  id: string;
  content: string;
  metadata: Record<string, unknown>;
  embedding?: number[];
  lastUpdated: Date;
}

/**
 * Interface for a business rule in the knowledge base
 */
export interface Rule {
  id: string;
  condition: string;
  action: string;
  priority: number;
  isActive: boolean;
}

/**
 * Interface for intent recognition configuration
 */
export interface Intent {
  id: string;
  name: string;
  patterns: string[];
  responses: string[];
  confidence: number;
}

/**
 * Interface for the assistant's knowledge base
 */
export interface KnowledgeBase {
  documents: Document[];
  rules: Rule[];
  intents: Intent[];
  vectorStore: string;
  updateFrequency: string;
}

/**
 * Interface for assistant performance metrics
 */
export interface AssistantMetrics {
  totalMessages: number;
  avgResponseTime: number;
  successRate: number;
  intentDistribution: Record<string, number>;
  sentimentScores: Record<string, number>;
  costMetrics: Record<string, number>;
  latencyDistribution: Record<string, number>;
}

/**
 * Main interface for a virtual assistant
 */
export interface Assistant extends BaseEntity {
  name: string;
  type: AssistantType;
  description: string;
  config: AssistantConfig;
  knowledgeBase: KnowledgeBase;
  metrics: AssistantMetrics;
  isActive: boolean;
  version: string;
  lastTrainingDate: Date;
}

/**
 * Zod schema for assistant configuration validation
 */
export const assistantConfigSchema = z.object({
  promptTemplate: z.string().min(1),
  temperature: z.number().min(0).max(1).default(DEFAULT_TEMPERATURE),
  maxTokens: z.number().positive().default(DEFAULT_MAX_TOKENS),
  modelName: z.string().min(1),
  contextWindow: z.number().positive(),
  fallbackBehavior: z.string(),
  stopSequences: z.array(z.string()),
  responseFormat: z.string()
});

/**
 * Zod schema for knowledge base validation
 */
export const knowledgeBaseSchema = z.object({
  documents: z.array(z.object({
    id: z.string(),
    content: z.string(),
    metadata: z.record(z.unknown()),
    embedding: z.array(z.number()).optional(),
    lastUpdated: z.date()
  })),
  rules: z.array(z.object({
    id: z.string(),
    condition: z.string(),
    action: z.string(),
    priority: z.number(),
    isActive: z.boolean()
  })),
  intents: z.array(z.object({
    id: z.string(),
    name: z.string(),
    patterns: z.array(z.string()),
    responses: z.array(z.string()),
    confidence: z.number().min(0).max(1)
  })),
  vectorStore: z.string(),
  updateFrequency: z.string()
});

/**
 * Zod schema for assistant metrics validation
 */
export const assistantMetricsSchema = z.object({
  totalMessages: z.number().nonnegative(),
  avgResponseTime: z.number().nonnegative(),
  successRate: z.number().min(0).max(100),
  intentDistribution: z.record(z.number()),
  sentimentScores: z.record(z.number()),
  costMetrics: z.record(z.number()),
  latencyDistribution: z.record(z.number())
});

/**
 * Complete Zod schema for assistant validation
 */
export const assistantSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(MIN_NAME_LENGTH).max(MAX_NAME_LENGTH),
  type: z.nativeEnum(AssistantType),
  description: z.string(),
  config: assistantConfigSchema,
  knowledgeBase: knowledgeBaseSchema,
  metrics: assistantMetricsSchema,
  isActive: z.boolean(),
  version: z.string(),
  lastTrainingDate: z.date(),
  createdAt: z.date(),
  updatedAt: z.date()
});

/**
 * Validates an assistant configuration
 * @param config - The configuration to validate
 * @returns True if the configuration is valid
 */
export function validateAssistantConfig(config: AssistantConfig): boolean {
  try {
    assistantConfigSchema.parse(config);
    return true;
  } catch {
    return false;
  }
}

/**
 * Type for assistant creation payload
 */
export type CreateAssistantPayload = Omit<Assistant, 'id' | 'createdAt' | 'updatedAt' | 'metrics'>;

/**
 * Type for assistant update payload
 */
export type UpdateAssistantPayload = Partial<Omit<Assistant, 'id' | 'createdAt' | 'updatedAt'>>;