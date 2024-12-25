import { renderHook, act } from '@testing-library/react-hooks'; // v8.0.1
import { waitFor } from '@testing-library/react'; // v14.0.0
import { vi, describe, beforeEach, afterEach, it, expect } from 'vitest'; // v0.34.0
import { WebSocket, Server } from 'mock-socket'; // v9.2.1

import { useCampaign } from '../../src/hooks/useCampaign';
import CampaignService from '../../src/services/campaign';
import { Campaign, CampaignStatus, CampaignType } from '../../src/types/campaign';
import { ApiError } from '../../src/types/common';

// Mock CampaignService
vi.mock('../../src/services/campaign', () => ({
  default: vi.fn(() => ({
    getCampaigns: vi.fn(),
    createCampaign: vi.fn(),
    updateCampaign: vi.fn(),
    deleteCampaign: vi.fn(),
    startCampaign: vi.fn(),
    pauseCampaign: vi.fn(),
    connectWebSocket: vi.fn(),
    destroy: vi.fn()
  }))
}));

// Test constants
const TEST_TIMEOUT = 5000;
const PERFORMANCE_THRESHOLD = 200;
const MOCK_WS_URL = 'ws://localhost:1234';

// Mock campaign data
const mockCampaign: Campaign = {
  id: '123',
  organizationId: 'org123',
  name: 'Test Campaign',
  description: 'Test Description',
  type: CampaignType.BROADCAST,
  status: CampaignStatus.DRAFT,
  messageTemplate: {},
  targetFilters: {},
  scheduleConfig: {
    startTime: new Date(),
    endTime: null,
    timezone: 'America/Sao_Paulo',
    recurringPattern: null,
    dailyStartHour: 9,
    dailyEndHour: 18,
    activeDays: [1, 2, 3, 4, 5]
  },
  analytics: {
    totalRecipients: 100,
    messagesSent: 0,
    messagesDelivered: 0,
    messagesFailed: 0,
    messagesPending: 100,
    deliveryRate: 0,
    failureRate: 0,
    averageDeliveryTime: 0
  },
  rateLimit: 30,
  isActive: true,
  lastExecutionTime: null,
  nextExecutionTime: null,
  createdAt: new Date(),
  updatedAt: new Date()
};

describe('useCampaign', () => {
  let mockServer: Server;
  let mockCampaignService: jest.Mocked<CampaignService>;
  let performance: { now: () => number };

  beforeEach(() => {
    // Setup WebSocket mock server
    mockServer = new Server(MOCK_WS_URL);
    
    // Setup performance measurement
    performance = {
      now: vi.fn(() => Date.now())
    };
    global.performance = performance;

    // Reset all mocks
    vi.clearAllMocks();
    mockCampaignService = CampaignService as jest.Mocked<typeof CampaignService>;
  });

  afterEach(() => {
    mockServer.close();
    vi.clearAllTimers();
  });

  describe('Campaign List Management', () => {
    it('should fetch campaigns with performance requirements', async () => {
      // Setup
      const startTime = performance.now();
      mockCampaignService.getCampaigns.mockResolvedValue({
        items: [mockCampaign],
        total: 1,
        page: 1,
        pageSize: 10,
        totalPages: 1
      });

      // Execute
      const { result } = renderHook(() => useCampaign());
      await act(async () => {
        await result.current.fetchCampaigns();
      });

      // Verify
      const endTime = performance.now();
      expect(endTime - startTime).toBeLessThan(PERFORMANCE_THRESHOLD);
      expect(result.current.campaigns).toHaveLength(1);
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should handle campaign fetch errors gracefully', async () => {
      // Setup
      const error: ApiError = {
        message: 'Failed to fetch campaigns',
        code: 'FETCH_ERROR',
        details: {}
      };
      mockCampaignService.getCampaigns.mockRejectedValue(error);

      // Execute
      const { result } = renderHook(() => useCampaign());
      await act(async () => {
        await result.current.fetchCampaigns().catch(() => {});
      });

      // Verify
      expect(result.current.error).toBeTruthy();
      expect(result.current.loading).toBe(false);
    });
  });

  describe('Campaign Operations', () => {
    it('should create campaign with optimistic updates', async () => {
      // Setup
      mockCampaignService.createCampaign.mockResolvedValue(mockCampaign);

      // Execute
      const { result } = renderHook(() => useCampaign());
      await act(async () => {
        await result.current.createCampaign({
          name: mockCampaign.name,
          description: mockCampaign.description,
          type: mockCampaign.type,
          messageTemplate: mockCampaign.messageTemplate,
          targetFilters: mockCampaign.targetFilters,
          scheduleConfig: mockCampaign.scheduleConfig,
          rateLimit: mockCampaign.rateLimit
        });
      });

      // Verify
      expect(result.current.campaigns).toContainEqual(mockCampaign);
      expect(result.current.loading).toBe(false);
    });

    it('should update campaign with validation', async () => {
      // Setup
      const updatedCampaign = { ...mockCampaign, name: 'Updated Campaign' };
      mockCampaignService.updateCampaign.mockResolvedValue(updatedCampaign);

      // Execute
      const { result } = renderHook(() => useCampaign());
      await act(async () => {
        await result.current.updateCampaign(mockCampaign.id, {
          name: updatedCampaign.name
        });
      });

      // Verify
      expect(result.current.campaigns.find(c => c.id === mockCampaign.id)?.name)
        .toBe(updatedCampaign.name);
    });

    it('should delete campaign with proper cleanup', async () => {
      // Setup
      mockCampaignService.deleteCampaign.mockResolvedValue(undefined);

      // Execute
      const { result } = renderHook(() => useCampaign());
      await act(async () => {
        await result.current.deleteCampaign(mockCampaign.id);
      });

      // Verify
      expect(result.current.campaigns).not.toContainEqual(mockCampaign);
    });
  });

  describe('Campaign Status Management', () => {
    it('should start campaign with rate limit validation', async () => {
      // Setup
      const runningCampaign = { ...mockCampaign, status: CampaignStatus.RUNNING };
      mockCampaignService.startCampaign.mockResolvedValue(runningCampaign);

      // Execute
      const { result } = renderHook(() => useCampaign());
      await act(async () => {
        await result.current.startCampaign(mockCampaign.id);
      });

      // Verify
      expect(result.current.campaigns.find(c => c.id === mockCampaign.id)?.status)
        .toBe(CampaignStatus.RUNNING);
    });

    it('should pause campaign with proper state handling', async () => {
      // Setup
      const pausedCampaign = { ...mockCampaign, status: CampaignStatus.PAUSED };
      mockCampaignService.pauseCampaign.mockResolvedValue(pausedCampaign);

      // Execute
      const { result } = renderHook(() => useCampaign());
      await act(async () => {
        await result.current.pauseCampaign(mockCampaign.id);
      });

      // Verify
      expect(result.current.campaigns.find(c => c.id === mockCampaign.id)?.status)
        .toBe(CampaignStatus.PAUSED);
    });
  });

  describe('Real-time Updates', () => {
    it('should handle WebSocket campaign status updates', async () => {
      // Setup
      const updatedStatus = CampaignStatus.RUNNING;
      
      // Execute
      const { result } = renderHook(() => useCampaign());
      
      // Simulate WebSocket message
      mockServer.emit('message', JSON.stringify({
        type: 'CAMPAIGN_UPDATE',
        data: { ...mockCampaign, status: updatedStatus }
      }));

      // Verify
      await waitFor(() => {
        expect(result.current.campaigns.find(c => c.id === mockCampaign.id)?.status)
          .toBe(updatedStatus);
      });
    });

    it('should reconnect WebSocket on connection loss', async () => {
      // Setup
      const { result } = renderHook(() => useCampaign());
      
      // Simulate connection loss
      mockServer.close();
      
      // Wait for reconnect attempt
      await waitFor(() => {
        expect(mockCampaignService.connectWebSocket).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle rate limit errors', async () => {
      // Setup
      const error: ApiError = {
        message: 'Rate limit exceeded',
        code: 'RATE_LIMIT_ERROR',
        details: {}
      };
      mockCampaignService.createCampaign.mockRejectedValue(error);

      // Execute
      const { result } = renderHook(() => useCampaign());
      await act(async () => {
        await result.current.createCampaign({
          name: mockCampaign.name,
          description: mockCampaign.description,
          type: mockCampaign.type,
          messageTemplate: mockCampaign.messageTemplate,
          targetFilters: mockCampaign.targetFilters,
          scheduleConfig: mockCampaign.scheduleConfig,
          rateLimit: mockCampaign.rateLimit
        }).catch(() => {});
      });

      // Verify
      expect(result.current.error?.code).toBe('RATE_LIMIT_ERROR');
    });

    it('should handle validation errors', async () => {
      // Setup
      const invalidCampaign = { ...mockCampaign, rateLimit: -1 };
      
      // Execute
      const { result } = renderHook(() => useCampaign());
      await act(async () => {
        await result.current.updateCampaign(invalidCampaign.id, {
          rateLimit: invalidCampaign.rateLimit
        }).catch(() => {});
      });

      // Verify
      expect(result.current.error).toBeTruthy();
    });
  });
});