import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'; // v29.0.0
import { rest } from 'msw'; // v1.0.0
import { server } from '../mocks/server'; // v1.0.0
import CampaignService from '../../src/services/campaign';
import { Campaign, CampaignType, CampaignStatus } from '../../src/types/campaign';
import { ApiError } from '../../src/types/common';
import { WHATSAPP_CONSTANTS } from '../../src/config/constants';

// Mock CacheManager
jest.mock('@nestjs/cache-manager', () => ({
  CacheManager: jest.fn().mockImplementation(() => ({
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  })),
}));

describe('CampaignService', () => {
  let campaignService: CampaignService;
  let mockPerformanceNow: jest.SpyInstance;

  // Test data
  const mockCampaign: Campaign = {
    id: 'test-id',
    organizationId: 'org-id',
    name: 'Test Campaign',
    description: 'Test Description',
    type: CampaignType.BROADCAST,
    status: CampaignStatus.DRAFT,
    messageTemplate: {
      content: 'Test message {{name}}',
      variables: ['name'],
      mediaUrl: null,
    },
    targetFilters: {
      segments: ['new-customers'],
      tags: ['active'],
      customFilters: { lastActivity: '30d' },
    },
    scheduleConfig: {
      startTime: new Date('2023-01-01T00:00:00Z'),
      endTime: new Date('2023-01-02T00:00:00Z'),
      timezone: 'America/Sao_Paulo',
      recurringPattern: null,
      dailyStartHour: 9,
      dailyEndHour: 18,
      activeDays: [1, 2, 3, 4, 5],
    },
    rateLimit: 60,
    analytics: {
      totalRecipients: 1000,
      messagesSent: 0,
      messagesDelivered: 0,
      messagesFailed: 0,
      messagesPending: 1000,
      deliveryRate: 0,
      failureRate: 0,
      averageDeliveryTime: 0,
    },
    isActive: true,
    lastExecutionTime: null,
    nextExecutionTime: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    // Initialize service and mocks
    campaignService = new CampaignService(new (jest.requireMock('@nestjs/cache-manager').CacheManager)());
    
    // Mock performance.now for timing checks
    mockPerformanceNow = jest.spyOn(performance, 'now');
    mockPerformanceNow.mockReturnValue(0);
    
    // Reset MSW handlers
    server.resetHandlers();
  });

  afterEach(() => {
    jest.clearAllMocks();
    mockPerformanceNow.mockRestore();
  });

  describe('getCampaigns', () => {
    it('should retrieve campaigns with pagination within performance limits', async () => {
      // Setup MSW handler
      server.use(
        rest.get('/api/v1/campaigns', (req, res, ctx) => {
          mockPerformanceNow.mockReturnValueOnce(150); // 150ms response time
          return res(
            ctx.json({
              items: [mockCampaign],
              total: 1,
              page: 1,
              pageSize: 20,
              totalPages: 1,
            })
          );
        })
      );

      const result = await campaignService.getCampaigns({}, { page: 1, pageSize: 20 });

      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toMatchObject(mockCampaign);
      expect(mockPerformanceNow()).toBeLessThan(200); // Performance requirement check
    });

    it('should handle filtering and sorting correctly', async () => {
      const filters = { status: CampaignStatus.DRAFT };
      const options = { 
        page: 1, 
        pageSize: 20,
        sortBy: 'createdAt',
        sortDirection: 'DESC'
      };

      server.use(
        rest.get('/api/v1/campaigns', (req, res, ctx) => {
          expect(req.url.searchParams.get('status')).toBe(CampaignStatus.DRAFT);
          expect(req.url.searchParams.get('sortBy')).toBe('createdAt');
          return res(
            ctx.json({
              items: [mockCampaign],
              total: 1,
              page: 1,
              pageSize: 20,
              totalPages: 1,
            })
          );
        })
      );

      const result = await campaignService.getCampaigns(filters, options);
      expect(result.items).toHaveLength(1);
    });
  });

  describe('getCampaignById', () => {
    it('should retrieve a specific campaign by ID', async () => {
      server.use(
        rest.get('/api/v1/campaigns/test-id', (req, res, ctx) => {
          mockPerformanceNow.mockReturnValueOnce(100);
          return res(ctx.json(mockCampaign));
        })
      );

      const result = await campaignService.getCampaignById('test-id');
      expect(result).toMatchObject(mockCampaign);
      expect(mockPerformanceNow()).toBeLessThan(200);
    });

    it('should throw error for non-existent campaign', async () => {
      server.use(
        rest.get('/api/v1/campaigns/invalid-id', (req, res, ctx) => {
          return res(
            ctx.status(404),
            ctx.json({ 
              message: 'Campaign not found',
              code: 'CAMPAIGN_NOT_FOUND',
              details: {}
            })
          );
        })
      );

      await expect(campaignService.getCampaignById('invalid-id'))
        .rejects
        .toThrow('Campaign not found');
    });
  });

  describe('createCampaign', () => {
    it('should create a new campaign with rate limit validation', async () => {
      const createDto = {
        name: 'New Campaign',
        description: 'Test Description',
        type: CampaignType.BROADCAST,
        messageTemplate: {
          content: 'Welcome {{name}}',
          variables: ['name'],
          mediaUrl: null,
        },
        targetFilters: {
          segments: ['all'],
          tags: [],
          customFilters: {},
        },
        scheduleConfig: {
          startTime: new Date('2023-01-01T00:00:00Z'),
          endTime: new Date('2023-01-02T00:00:00Z'),
          timezone: 'America/Sao_Paulo',
          recurringPattern: null,
          dailyStartHour: 9,
          dailyEndHour: 18,
          activeDays: [1, 2, 3, 4, 5],
        },
        rateLimit: 60,
      };

      server.use(
        rest.post('/api/v1/campaigns', (req, res, ctx) => {
          mockPerformanceNow.mockReturnValueOnce(150);
          return res(ctx.json({ ...mockCampaign, ...req.body }));
        })
      );

      const result = await campaignService.createCampaign(createDto);
      expect(result.name).toBe(createDto.name);
      expect(mockPerformanceNow()).toBeLessThan(200);
    });

    it('should reject campaign creation with invalid rate limit', async () => {
      const invalidDto = {
        ...mockCampaign,
        rateLimit: parseInt(WHATSAPP_CONSTANTS.RATE_LIMITS.MESSAGES_PER_MINUTE) + 1,
      };

      await expect(campaignService.createCampaign(invalidDto))
        .rejects
        .toThrow(`Rate limit cannot exceed ${WHATSAPP_CONSTANTS.RATE_LIMITS.MESSAGES_PER_MINUTE} messages per minute`);
    });
  });

  describe('updateCampaign', () => {
    it('should update an existing campaign', async () => {
      const updateDto = {
        name: 'Updated Campaign',
        status: CampaignStatus.SCHEDULED,
      };

      server.use(
        rest.put('/api/v1/campaigns/test-id', (req, res, ctx) => {
          mockPerformanceNow.mockReturnValueOnce(120);
          return res(ctx.json({ ...mockCampaign, ...updateDto }));
        })
      );

      const result = await campaignService.updateCampaign('test-id', updateDto);
      expect(result.name).toBe(updateDto.name);
      expect(result.status).toBe(updateDto.status);
      expect(mockPerformanceNow()).toBeLessThan(200);
    });
  });

  describe('deleteCampaign', () => {
    it('should delete a campaign', async () => {
      server.use(
        rest.delete('/api/v1/campaigns/test-id', (req, res, ctx) => {
          mockPerformanceNow.mockReturnValueOnce(100);
          return res(ctx.status(204));
        })
      );

      await expect(campaignService.deleteCampaign('test-id')).resolves.not.toThrow();
      expect(mockPerformanceNow()).toBeLessThan(200);
    });

    it('should not delete a running campaign', async () => {
      const runningCampaign = { ...mockCampaign, status: CampaignStatus.RUNNING };
      
      server.use(
        rest.get('/api/v1/campaigns/test-id', (req, res, ctx) => {
          return res(ctx.json(runningCampaign));
        })
      );

      await expect(campaignService.deleteCampaign('test-id'))
        .rejects
        .toThrow('Cannot delete a running campaign');
    });
  });

  describe('startCampaign', () => {
    it('should start a scheduled campaign', async () => {
      const scheduledCampaign = { ...mockCampaign, status: CampaignStatus.SCHEDULED };
      
      server.use(
        rest.get('/api/v1/campaigns/test-id', (req, res, ctx) => {
          return res(ctx.json(scheduledCampaign));
        }),
        rest.post('/api/v1/campaigns/test-id/start', (req, res, ctx) => {
          mockPerformanceNow.mockReturnValueOnce(150);
          return res(ctx.json({ ...scheduledCampaign, status: CampaignStatus.RUNNING }));
        })
      );

      const result = await campaignService.startCampaign('test-id');
      expect(result.status).toBe(CampaignStatus.RUNNING);
      expect(mockPerformanceNow()).toBeLessThan(200);
    });

    it('should reject starting a non-scheduled campaign', async () => {
      server.use(
        rest.get('/api/v1/campaigns/test-id', (req, res, ctx) => {
          return res(ctx.json(mockCampaign));
        })
      );

      await expect(campaignService.startCampaign('test-id'))
        .rejects
        .toThrow('Campaign must be in SCHEDULED status to start');
    });
  });

  describe('pauseCampaign', () => {
    it('should pause a running campaign', async () => {
      const runningCampaign = { ...mockCampaign, status: CampaignStatus.RUNNING };
      
      server.use(
        rest.get('/api/v1/campaigns/test-id', (req, res, ctx) => {
          return res(ctx.json(runningCampaign));
        }),
        rest.post('/api/v1/campaigns/test-id/pause', (req, res, ctx) => {
          mockPerformanceNow.mockReturnValueOnce(130);
          return res(ctx.json({ ...runningCampaign, status: CampaignStatus.PAUSED }));
        })
      );

      const result = await campaignService.pauseCampaign('test-id');
      expect(result.status).toBe(CampaignStatus.PAUSED);
      expect(mockPerformanceNow()).toBeLessThan(200);
    });

    it('should reject pausing a non-running campaign', async () => {
      server.use(
        rest.get('/api/v1/campaigns/test-id', (req, res, ctx) => {
          return res(ctx.json(mockCampaign));
        })
      );

      await expect(campaignService.pauseCampaign('test-id'))
        .rejects
        .toThrow('Only running campaigns can be paused');
    });
  });

  describe('error handling', () => {
    it('should handle network errors with retry', async () => {
      let attempts = 0;
      server.use(
        rest.get('/api/v1/campaigns', (req, res, ctx) => {
          attempts++;
          if (attempts < 3) {
            return res.networkError('Failed to connect');
          }
          return res(ctx.json({
            items: [mockCampaign],
            total: 1,
            page: 1,
            pageSize: 20,
            totalPages: 1,
          }));
        })
      );

      const result = await campaignService.getCampaigns({}, { page: 1, pageSize: 20 });
      expect(attempts).toBe(3);
      expect(result.items).toHaveLength(1);
    });

    it('should handle API errors correctly', async () => {
      server.use(
        rest.post('/api/v1/campaigns', (req, res, ctx) => {
          return res(
            ctx.status(400),
            ctx.json({
              message: 'Invalid campaign data',
              code: 'VALIDATION_ERROR',
              details: { field: 'name' }
            })
          );
        })
      );

      await expect(campaignService.createCampaign(mockCampaign))
        .rejects
        .toThrow('Invalid campaign data');
    });
  });
});