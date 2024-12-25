import { describe, beforeEach, afterEach, it, expect, jest } from '@jest/globals'; // v29.6.0
import { MockInstance } from 'jest-mock'; // v29.6.0
import { assistantService } from '../../src/services/assistant';
import { api } from '../../src/lib/api';
import { 
  Assistant,
  AssistantType,
  AssistantConfig,
  KnowledgeBase,
  AssistantMetrics,
  CreateAssistantPayload,
  UpdateAssistantPayload
} from '../../src/types/assistant';

// Mock the API module
jest.mock('../../src/lib/api');

// Test constants
const TEST_TIMEOUT = 10000;

// Mock data
const MOCK_ASSISTANT: Assistant = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  name: 'Test Assistant',
  type: AssistantType.CUSTOMER_SERVICE,
  description: 'Test assistant for customer service',
  config: {
    promptTemplate: 'You are a helpful customer service assistant.',
    temperature: 0.7,
    maxTokens: 150,
    modelName: 'gpt-4',
    contextWindow: 4096,
    fallbackBehavior: 'apologize',
    stopSequences: ['\n', 'Customer:'],
    responseFormat: 'text'
  },
  knowledgeBase: {
    documents: [{
      id: 'doc1',
      content: 'Test document content',
      metadata: { source: 'manual' },
      lastUpdated: new Date()
    }],
    rules: [{
      id: 'rule1',
      condition: 'intent == "greeting"',
      action: 'respond with greeting',
      priority: 1,
      isActive: true
    }],
    intents: [{
      id: 'intent1',
      name: 'greeting',
      patterns: ['hello', 'hi'],
      responses: ['Hello!', 'Hi there!'],
      confidence: 0.9
    }],
    vectorStore: 'pinecone',
    updateFrequency: 'daily'
  },
  metrics: {
    totalMessages: 100,
    avgResponseTime: 250,
    successRate: 95,
    intentDistribution: { greeting: 0.3, inquiry: 0.7 },
    sentimentScores: { positive: 0.6, neutral: 0.3, negative: 0.1 },
    costMetrics: { totalTokens: 1000, totalCost: 0.02 },
    latencyDistribution: { '<200ms': 0.7, '<500ms': 0.3 }
  },
  isActive: true,
  version: '1.0.0',
  lastTrainingDate: new Date(),
  createdAt: new Date(),
  updatedAt: new Date()
};

const MOCK_KNOWLEDGE_BASE_UPDATE = {
  documents: [{
    content: 'New document content',
    metadata: { source: 'api' }
  }],
  rules: [{
    condition: 'intent == "farewell"',
    action: 'respond with goodbye',
    priority: 2
  }]
};

describe('assistantService', () => {
  let apiGetMock: MockInstance;
  let apiPostMock: MockInstance;
  let apiPutMock: MockInstance;
  let apiDeleteMock: MockInstance;
  let apiGetPaginatedMock: MockInstance;

  beforeEach(() => {
    // Setup API mocks
    apiGetMock = jest.spyOn(api, 'get').mockResolvedValue(MOCK_ASSISTANT);
    apiPostMock = jest.spyOn(api, 'post').mockResolvedValue(MOCK_ASSISTANT);
    apiPutMock = jest.spyOn(api, 'put').mockResolvedValue(MOCK_ASSISTANT);
    apiDeleteMock = jest.spyOn(api, 'delete').mockResolvedValue(undefined);
    apiGetPaginatedMock = jest.spyOn(api, 'getPaginated').mockResolvedValue({
      items: [MOCK_ASSISTANT],
      total: 1,
      page: 1,
      pageSize: 20,
      totalPages: 1
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getAssistants', () => {
    it('should fetch paginated assistants successfully', async () => {
      const result = await assistantService.getAssistants('org123', {
        page: 1,
        pageSize: 20,
        sortBy: 'createdAt',
        sortDirection: 'DESC'
      });

      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toEqual(MOCK_ASSISTANT);
      expect(apiGetPaginatedMock).toHaveBeenCalledWith('/api/v1/assistants', {
        organizationId: 'org123',
        page: 1,
        pageSize: 20,
        sortBy: 'createdAt',
        sortDirection: 'DESC'
      });
    });

    it('should handle API errors gracefully', async () => {
      apiGetPaginatedMock.mockRejectedValue(new Error('API Error'));
      await expect(assistantService.getAssistants('org123', { page: 1, pageSize: 20 }))
        .rejects.toThrow('API Error');
    });
  });

  describe('getAssistant', () => {
    it('should fetch a single assistant by ID', async () => {
      const result = await assistantService.getAssistant(MOCK_ASSISTANT.id);
      expect(result).toEqual(MOCK_ASSISTANT);
      expect(apiGetMock).toHaveBeenCalledWith(`/api/v1/assistants/${MOCK_ASSISTANT.id}`);
    });

    it('should validate assistant data', async () => {
      apiGetMock.mockResolvedValue({ ...MOCK_ASSISTANT, name: '' });
      await expect(assistantService.getAssistant(MOCK_ASSISTANT.id))
        .rejects.toThrow();
    });
  });

  describe('createAssistant', () => {
    it('should create a new assistant', async () => {
      const payload: CreateAssistantPayload = {
        name: 'New Assistant',
        type: AssistantType.SALES,
        description: 'Sales assistant',
        config: MOCK_ASSISTANT.config,
        knowledgeBase: MOCK_ASSISTANT.knowledgeBase,
        isActive: true,
        version: '1.0.0',
        lastTrainingDate: new Date()
      };

      const result = await assistantService.createAssistant(payload);
      expect(result).toEqual(MOCK_ASSISTANT);
      expect(apiPostMock).toHaveBeenCalledWith('/api/v1/assistants', payload);
    });

    it('should validate assistant configuration', async () => {
      const invalidPayload = {
        ...MOCK_ASSISTANT,
        config: { ...MOCK_ASSISTANT.config, temperature: 2 }
      };
      apiPostMock.mockResolvedValue(invalidPayload);
      await expect(assistantService.createAssistant(invalidPayload))
        .rejects.toThrow();
    });
  });

  describe('updateAssistant', () => {
    it('should update an existing assistant', async () => {
      const payload: UpdateAssistantPayload = {
        name: 'Updated Assistant',
        config: {
          ...MOCK_ASSISTANT.config,
          temperature: 0.8
        }
      };

      const result = await assistantService.updateAssistant(MOCK_ASSISTANT.id, payload);
      expect(result).toEqual(MOCK_ASSISTANT);
      expect(apiPutMock).toHaveBeenCalledWith(
        `/api/v1/assistants/${MOCK_ASSISTANT.id}`,
        payload
      );
    });

    it('should handle partial updates', async () => {
      const payload = { name: 'Updated Name' };
      await assistantService.updateAssistant(MOCK_ASSISTANT.id, payload);
      expect(apiPutMock).toHaveBeenCalledWith(
        `/api/v1/assistants/${MOCK_ASSISTANT.id}`,
        payload
      );
    });
  });

  describe('deleteAssistant', () => {
    it('should delete an assistant', async () => {
      await assistantService.deleteAssistant(MOCK_ASSISTANT.id);
      expect(apiDeleteMock).toHaveBeenCalledWith(`/api/v1/assistants/${MOCK_ASSISTANT.id}`);
    });

    it('should handle deletion errors', async () => {
      apiDeleteMock.mockRejectedValue(new Error('Deletion failed'));
      await expect(assistantService.deleteAssistant(MOCK_ASSISTANT.id))
        .rejects.toThrow('Deletion failed');
    });
  });

  describe('getAssistantMetrics', () => {
    it('should fetch assistant metrics', async () => {
      const timeRange = {
        startDate: new Date('2023-01-01'),
        endDate: new Date('2023-12-31')
      };

      await assistantService.getAssistantMetrics(MOCK_ASSISTANT.id, timeRange);
      expect(apiGetMock).toHaveBeenCalledWith(
        `/api/v1/assistants/${MOCK_ASSISTANT.id}/metrics`,
        {
          startDate: timeRange.startDate.toISOString(),
          endDate: timeRange.endDate.toISOString()
        }
      );
    });

    it('should validate metrics data', async () => {
      apiGetMock.mockResolvedValue({ totalMessages: -1 });
      await expect(assistantService.getAssistantMetrics(
        MOCK_ASSISTANT.id,
        { startDate: new Date(), endDate: new Date() }
      )).rejects.toThrow();
    });
  });

  describe('updateKnowledgeBase', () => {
    it('should update knowledge base content', async () => {
      apiPutMock.mockResolvedValue({
        knowledgeBase: MOCK_ASSISTANT.knowledgeBase,
        validationResults: {
          documentsValid: true,
          rulesValid: true,
          intentsValid: true,
          coverage: 0.95,
          conflicts: []
        }
      });

      const result = await assistantService.updateKnowledgeBase(
        MOCK_ASSISTANT.id,
        MOCK_KNOWLEDGE_BASE_UPDATE
      );

      expect(result.knowledgeBase).toBeDefined();
      expect(result.validationResults.documentsValid).toBe(true);
      expect(apiPutMock).toHaveBeenCalledWith(
        `/api/v1/assistants/${MOCK_ASSISTANT.id}/knowledge`,
        MOCK_KNOWLEDGE_BASE_UPDATE
      );
    });

    it('should handle validation failures', async () => {
      apiPutMock.mockResolvedValue({
        knowledgeBase: { ...MOCK_ASSISTANT.knowledgeBase, documents: null },
        validationResults: {
          documentsValid: false,
          rulesValid: true,
          intentsValid: true,
          coverage: 0,
          conflicts: ['Invalid document format']
        }
      });

      await expect(assistantService.updateKnowledgeBase(
        MOCK_ASSISTANT.id,
        MOCK_KNOWLEDGE_BASE_UPDATE
      )).rejects.toThrow();
    });
  });

  describe('setAssistantStatus', () => {
    it('should activate an assistant', async () => {
      await assistantService.setAssistantStatus(MOCK_ASSISTANT.id, true);
      expect(apiPutMock).toHaveBeenCalledWith(
        `/api/v1/assistants/${MOCK_ASSISTANT.id}/status`,
        { isActive: true }
      );
    });

    it('should deactivate an assistant', async () => {
      await assistantService.setAssistantStatus(MOCK_ASSISTANT.id, false);
      expect(apiPutMock).toHaveBeenCalledWith(
        `/api/v1/assistants/${MOCK_ASSISTANT.id}/status`,
        { isActive: false }
      );
    });
  });

  describe('trainAssistant', () => {
    it('should initiate assistant training', async () => {
      apiPostMock.mockResolvedValue({
        status: 'training',
        estimatedTime: 300,
        trainingId: 'train123'
      });

      const result = await assistantService.trainAssistant(MOCK_ASSISTANT.id);
      expect(result.status).toBe('training');
      expect(result.trainingId).toBeDefined();
      expect(apiPostMock).toHaveBeenCalledWith(
        `/api/v1/assistants/${MOCK_ASSISTANT.id}/train`,
        {}
      );
    });
  });

  describe('testAssistant', () => {
    it('should run test cases successfully', async () => {
      const testCases = [
        { input: 'Hello', expectedOutput: 'Hi there!' }
      ];

      apiPostMock.mockResolvedValue({
        results: [{
          input: 'Hello',
          output: 'Hi there!',
          success: true,
          confidence: 0.95,
          latency: 150
        }],
        summary: {
          successRate: 100,
          avgLatency: 150,
          avgConfidence: 0.95
        }
      });

      const result = await assistantService.testAssistant(MOCK_ASSISTANT.id, testCases);
      expect(result.results).toHaveLength(1);
      expect(result.summary.successRate).toBe(100);
      expect(apiPostMock).toHaveBeenCalledWith(
        `/api/v1/assistants/${MOCK_ASSISTANT.id}/test`,
        { testCases }
      );
    });
  });
});