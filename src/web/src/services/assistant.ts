// @ts-check
import { api } from '../lib/api';
import {
  Assistant,
  AssistantType,
  CreateAssistantPayload,
  UpdateAssistantPayload,
  AssistantMetrics,
  KnowledgeBase,
  assistantSchema,
  assistantMetricsSchema,
  knowledgeBaseSchema
} from '../types/assistant';
import { PaginatedResponse } from '../types/common';

// API endpoint constants
const API_BASE_PATH = '/api/v1/assistants' as const;

// Types for service parameters
interface PaginationParams {
  page: number;
  pageSize: number;
  sortBy?: string;
  sortDirection?: 'ASC' | 'DESC';
}

interface MetricsTimeRange {
  startDate: Date;
  endDate: Date;
}

interface KnowledgeBaseUpdate {
  documents?: Array<{
    content: string;
    metadata: Record<string, unknown>;
  }>;
  rules?: Array<{
    condition: string;
    action: string;
    priority: number;
  }>;
  intents?: Array<{
    name: string;
    patterns: string[];
    responses: string[];
  }>;
}

interface KnowledgeBaseResponse {
  knowledgeBase: KnowledgeBase;
  validationResults: {
    documentsValid: boolean;
    rulesValid: boolean;
    intentsValid: boolean;
    coverage: number;
    conflicts: string[];
  };
}

/**
 * Service for managing AI virtual assistants
 */
class AssistantService {
  /**
   * Retrieves a paginated list of assistants for the organization
   */
  async getAssistants(
    organizationId: string,
    params: PaginationParams
  ): Promise<PaginatedResponse<Assistant>> {
    const response = await api.getPaginated<Assistant>(
      API_BASE_PATH,
      {
        organizationId,
        ...params
      }
    );

    // Validate each assistant in the response
    response.items = response.items.map(assistant => 
      assistantSchema.parse(assistant)
    );

    return response;
  }

  /**
   * Retrieves a single assistant by ID
   */
  async getAssistant(assistantId: string): Promise<Assistant> {
    const response = await api.get<Assistant>(
      `${API_BASE_PATH}/${assistantId}`
    );

    // Validate assistant data
    return assistantSchema.parse(response);
  }

  /**
   * Creates a new assistant
   */
  async createAssistant(
    payload: CreateAssistantPayload
  ): Promise<Assistant> {
    const response = await api.post<CreateAssistantPayload, Assistant>(
      API_BASE_PATH,
      payload
    );

    return assistantSchema.parse(response);
  }

  /**
   * Updates an existing assistant
   */
  async updateAssistant(
    assistantId: string,
    payload: UpdateAssistantPayload
  ): Promise<Assistant> {
    const response = await api.put<UpdateAssistantPayload, Assistant>(
      `${API_BASE_PATH}/${assistantId}`,
      payload
    );

    return assistantSchema.parse(response);
  }

  /**
   * Deletes an assistant
   */
  async deleteAssistant(assistantId: string): Promise<void> {
    await api.delete(`${API_BASE_PATH}/${assistantId}`);
  }

  /**
   * Retrieves comprehensive performance metrics for an assistant
   */
  async getAssistantMetrics(
    assistantId: string,
    timeRange: MetricsTimeRange
  ): Promise<AssistantMetrics> {
    const response = await api.get<AssistantMetrics>(
      `${API_BASE_PATH}/${assistantId}/metrics`,
      {
        startDate: timeRange.startDate.toISOString(),
        endDate: timeRange.endDate.toISOString()
      }
    );

    // Validate metrics data
    return assistantMetricsSchema.parse(response);
  }

  /**
   * Updates assistant knowledge base with enhanced validation
   */
  async updateKnowledgeBase(
    assistantId: string,
    knowledgeUpdate: KnowledgeBaseUpdate
  ): Promise<KnowledgeBaseResponse> {
    const response = await api.put<KnowledgeBaseUpdate, KnowledgeBaseResponse>(
      `${API_BASE_PATH}/${assistantId}/knowledge`,
      knowledgeUpdate
    );

    // Validate knowledge base data
    response.knowledgeBase = knowledgeBaseSchema.parse(response.knowledgeBase);

    return response;
  }

  /**
   * Activates or deactivates an assistant
   */
  async setAssistantStatus(
    assistantId: string,
    isActive: boolean
  ): Promise<Assistant> {
    const response = await api.put<{ isActive: boolean }, Assistant>(
      `${API_BASE_PATH}/${assistantId}/status`,
      { isActive }
    );

    return assistantSchema.parse(response);
  }

  /**
   * Trains or retrains an assistant's model
   */
  async trainAssistant(assistantId: string): Promise<{
    status: string;
    estimatedTime: number;
    trainingId: string;
  }> {
    return api.post(
      `${API_BASE_PATH}/${assistantId}/train`,
      {}
    );
  }

  /**
   * Tests assistant performance with sample conversations
   */
  async testAssistant(
    assistantId: string,
    testCases: Array<{
      input: string;
      expectedOutput?: string;
    }>
  ): Promise<{
    results: Array<{
      input: string;
      output: string;
      success: boolean;
      confidence: number;
      latency: number;
    }>;
    summary: {
      successRate: number;
      avgLatency: number;
      avgConfidence: number;
    };
  }> {
    return api.post(
      `${API_BASE_PATH}/${assistantId}/test`,
      { testCases }
    );
  }
}

// Export singleton instance
export const assistantService = new AssistantService();