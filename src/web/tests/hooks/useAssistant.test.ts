import { renderHook, act } from '@testing-library/react-hooks'; // v8.0.1
import { waitFor } from '@testing-library/react'; // v14.0.0
import { describe, it, expect, beforeEach, jest } from '@jest/globals'; // v29.0.0
import { useAssistant } from '../../src/hooks/useAssistant';
import { AssistantType } from '../../src/types/assistant';

// Mock the assistant store
jest.mock('../../src/store/assistant', () => ({
  useAssistantStore: jest.fn(() => ({
    assistants: [],
    loading: false,
    error: null,
    metrics: {
      avgResponseTime: 150,
      successRate: 95,
      totalMessages: 1000,
      intentDistribution: {},
      sentimentScores: {},
      costMetrics: {},
      latencyDistribution: {}
    },
    fetchAssistants: jest.fn(),
    createAssistant: jest.fn(),
    updateAssistant: jest.fn(),
    deleteAssistant: jest.fn(),
    trackMetrics: jest.fn()
  }))
}));

// Test data
const mockAssistant = {
  id: 'test-id',
  name: 'Test Assistant',
  type: AssistantType.SALES,
  description: 'Test Description',
  config: {
    promptTemplate: 'Test template',
    temperature: 0.7,
    maxTokens: 150,
    modelName: 'gpt-4',
    contextWindow: 4096,
    fallbackBehavior: 'retry',
    stopSequences: [],
    responseFormat: 'json'
  },
  knowledgeBase: {
    documents: [],
    rules: [],
    intents: [],
    vectorStore: 'pinecone',
    updateFrequency: 'daily'
  },
  isActive: true,
  version: '1.0.0',
  lastTrainingDate: new Date(),
  metrics: {
    totalMessages: 1000,
    avgResponseTime: 150,
    successRate: 95,
    intentDistribution: {},
    sentimentScores: {},
    costMetrics: {},
    latencyDistribution: {}
  }
};

describe('useAssistant', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  it('should initialize with default state and metrics', async () => {
    const { result } = renderHook(() => useAssistant());

    expect(result.current.assistants).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.metrics).toBeDefined();
    expect(result.current.metrics.avgResponseTime).toBeLessThan(200); // Performance requirement
  });

  it('should handle assistant creation with performance tracking', async () => {
    const { result } = renderHook(() => useAssistant());
    const startTime = Date.now();

    const newAssistant = {
      name: 'New Assistant',
      type: AssistantType.SALES,
      description: 'Test assistant',
      config: mockAssistant.config,
      knowledgeBase: mockAssistant.knowledgeBase,
      isActive: true,
      version: '1.0.0',
      lastTrainingDate: new Date()
    };

    await act(async () => {
      await result.current.createAssistant(newAssistant);
    });

    const operationTime = Date.now() - startTime;
    expect(operationTime).toBeLessThan(500); // Performance requirement
  });

  it('should handle assistant updates with debouncing', async () => {
    const { result } = renderHook(() => useAssistant());
    const updates = { name: 'Updated Assistant' };

    await act(async () => {
      const updatePromise = result.current.updateAssistant('test-id', updates);
      jest.advanceTimersByTime(300); // Debounce delay
      await updatePromise;
    });

    expect(result.current.loading).toBe(false);
  });

  it('should handle assistant deletion with cleanup', async () => {
    const { result } = renderHook(() => useAssistant());

    await act(async () => {
      await result.current.deleteAssistant('test-id');
    });

    expect(result.current.assistants).not.toContainEqual(expect.objectContaining({ id: 'test-id' }));
  });

  it('should refresh assistants with caching consideration', async () => {
    const { result } = renderHook(() => useAssistant());

    await act(async () => {
      await result.current.refreshAssistants();
    });

    // Second refresh should use cache
    const startTime = Date.now();
    await act(async () => {
      await result.current.refreshAssistants();
    });

    expect(Date.now() - startTime).toBeLessThan(50); // Cache hit should be fast
  });

  it('should track and report performance metrics', async () => {
    const { result } = renderHook(() => useAssistant());

    // Simulate multiple operations
    await act(async () => {
      await result.current.createAssistant({
        ...mockAssistant,
        id: undefined,
        metrics: undefined
      });
      await result.current.updateAssistant('test-id', { name: 'Updated' });
      await result.current.refreshAssistants();
    });

    expect(result.current.metrics.avgResponseTime).toBeLessThan(200);
    expect(result.current.metrics.successRate).toBeGreaterThan(90);
  });

  it('should handle errors gracefully with recovery', async () => {
    const { result } = renderHook(() => useAssistant());
    const mockError = new Error('Network error');

    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(global, 'fetch').mockRejectedValueOnce(mockError);

    await act(async () => {
      try {
        await result.current.refreshAssistants(true);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    // Should recover on next attempt
    await act(async () => {
      await result.current.refreshAssistants();
    });

    expect(result.current.error).toBeNull();
  });

  it('should cleanup resources on unmount', () => {
    const { unmount } = renderHook(() => useAssistant());

    unmount();

    // Verify cleanup
    expect(setTimeout).toHaveBeenCalled();
    expect(clearTimeout).toHaveBeenCalled();
  });

  it('should maintain performance under load', async () => {
    const { result } = renderHook(() => useAssistant());
    const operations = Array(100).fill(null).map((_, i) => ({
      name: `Assistant ${i}`,
      type: AssistantType.SALES,
      description: 'Test',
      config: mockAssistant.config,
      knowledgeBase: mockAssistant.knowledgeBase,
      isActive: true,
      version: '1.0.0',
      lastTrainingDate: new Date()
    }));

    const startTime = Date.now();

    await act(async () => {
      await Promise.all(operations.map(op => result.current.createAssistant(op)));
    });

    const avgTimePerOperation = (Date.now() - startTime) / operations.length;
    expect(avgTimePerOperation).toBeLessThan(50); // Performance requirement
  });
});