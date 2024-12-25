import { api } from '../lib/api';
import { CacheManager } from '@nestjs/cache-manager'; // v2.0.0
import retry from 'axios-retry'; // v3.8.0
import { 
  Campaign, 
  CampaignType, 
  CampaignStatus, 
  CreateCampaignDto, 
  UpdateCampaignDto,
  campaignSchema 
} from '../types/campaign';
import { ApiError, PaginatedResponse } from '../types/common';
import { WHATSAPP_CONSTANTS } from '../config/constants';

// Constants for campaign service configuration
const CACHE_PREFIX = 'campaign:';
const CACHE_TTL = 300000; // 5 minutes
const LIST_CACHE_KEY = `${CACHE_PREFIX}list`;
const MAX_RETRIES = 3;

interface PaginationOptions {
  page: number;
  pageSize: number;
  sortBy?: string;
  sortDirection?: 'ASC' | 'DESC';
}

/**
 * Service class for handling campaign-related operations with comprehensive
 * error handling, caching, and monitoring capabilities
 */
export class CampaignService {
  private readonly baseUrl: string;
  private readonly cacheManager: CacheManager;
  private readonly abortController: AbortController;

  constructor(cacheManager: CacheManager) {
    this.baseUrl = '/api/v1/campaigns';
    this.cacheManager = cacheManager;
    this.abortController = new AbortController();

    // Configure retry strategy
    retry(api, {
      retries: MAX_RETRIES,
      retryDelay: (retryCount) => retryCount * 1000,
      retryCondition: (error) => {
        return !error.response && retry.isNetworkError(error);
      }
    });
  }

  /**
   * Retrieves a paginated list of campaigns with caching and filtering
   */
  async getCampaigns(
    filters: Record<string, any> = {},
    options: PaginationOptions
  ): Promise<PaginatedResponse<Campaign>> {
    const cacheKey = `${LIST_CACHE_KEY}:${JSON.stringify({ filters, options })}`;
    
    try {
      // Check cache first
      const cached = await this.cacheManager.get<PaginatedResponse<Campaign>>(cacheKey);
      if (cached) {
        return cached;
      }

      const response = await api.getPaginated<Campaign>(
        this.baseUrl,
        { ...filters, ...options },
        { signal: this.abortController.signal }
      );

      // Validate response data
      response.items.forEach(campaign => {
        campaignSchema.parse(campaign);
      });

      // Cache successful response
      await this.cacheManager.set(cacheKey, response, CACHE_TTL);

      return response;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Retrieves a specific campaign by ID with caching
   */
  async getCampaignById(id: string): Promise<Campaign> {
    const cacheKey = `${CACHE_PREFIX}${id}`;

    try {
      // Check cache first
      const cached = await this.cacheManager.get<Campaign>(cacheKey);
      if (cached) {
        return cached;
      }

      const campaign = await api.get<Campaign>(
        `${this.baseUrl}/${id}`,
        undefined,
        { signal: this.abortController.signal }
      );

      // Validate campaign data
      campaignSchema.parse(campaign);

      // Cache successful response
      await this.cacheManager.set(cacheKey, campaign, CACHE_TTL);

      return campaign;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Creates a new campaign with validation and rate limit checks
   */
  async createCampaign(data: CreateCampaignDto): Promise<Campaign> {
    try {
      // Validate rate limits
      await this.validateRateLimits(data);

      const campaign = await api.post<CreateCampaignDto, Campaign>(
        this.baseUrl,
        data,
        { signal: this.abortController.signal }
      );

      // Validate created campaign
      campaignSchema.parse(campaign);

      // Invalidate list cache
      await this.cacheManager.del(LIST_CACHE_KEY);

      return campaign;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Updates an existing campaign with validation
   */
  async updateCampaign(id: string, data: UpdateCampaignDto): Promise<Campaign> {
    try {
      const campaign = await api.put<UpdateCampaignDto, Campaign>(
        `${this.baseUrl}/${id}`,
        data,
        { signal: this.abortController.signal }
      );

      // Validate updated campaign
      campaignSchema.parse(campaign);

      // Invalidate caches
      await this.cacheManager.del(`${CACHE_PREFIX}${id}`);
      await this.cacheManager.del(LIST_CACHE_KEY);

      return campaign;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Deletes a campaign with proper cleanup
   */
  async deleteCampaign(id: string): Promise<void> {
    try {
      // Check campaign status before deletion
      const campaign = await this.getCampaignById(id);
      if (campaign.status === CampaignStatus.RUNNING) {
        throw new Error('Cannot delete a running campaign');
      }

      await api.delete(
        `${this.baseUrl}/${id}`,
        { signal: this.abortController.signal }
      );

      // Clean up caches
      await this.cacheManager.del(`${CACHE_PREFIX}${id}`);
      await this.cacheManager.del(LIST_CACHE_KEY);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Starts a campaign with rate limit validation
   */
  async startCampaign(id: string): Promise<Campaign> {
    try {
      const campaign = await this.getCampaignById(id);

      // Validate campaign eligibility
      if (campaign.status !== CampaignStatus.SCHEDULED) {
        throw new Error('Campaign must be in SCHEDULED status to start');
      }

      const updatedCampaign = await api.post<void, Campaign>(
        `${this.baseUrl}/${id}/start`,
        undefined,
        { signal: this.abortController.signal }
      );

      // Validate updated campaign
      campaignSchema.parse(updatedCampaign);

      // Update caches
      await this.cacheManager.del(`${CACHE_PREFIX}${id}`);
      await this.cacheManager.del(LIST_CACHE_KEY);

      return updatedCampaign;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Pauses a running campaign
   */
  async pauseCampaign(id: string): Promise<Campaign> {
    try {
      const campaign = await this.getCampaignById(id);

      // Validate campaign status
      if (campaign.status !== CampaignStatus.RUNNING) {
        throw new Error('Only running campaigns can be paused');
      }

      const updatedCampaign = await api.post<void, Campaign>(
        `${this.baseUrl}/${id}/pause`,
        undefined,
        { signal: this.abortController.signal }
      );

      // Validate updated campaign
      campaignSchema.parse(updatedCampaign);

      // Update caches
      await this.cacheManager.del(`${CACHE_PREFIX}${id}`);
      await this.cacheManager.del(LIST_CACHE_KEY);

      return updatedCampaign;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Validates campaign rate limits based on WhatsApp constraints
   */
  private async validateRateLimits(data: CreateCampaignDto): Promise<void> {
    const { RATE_LIMITS } = WHATSAPP_CONSTANTS;
    
    if (data.rateLimit > parseInt(RATE_LIMITS.MESSAGES_PER_MINUTE)) {
      throw new Error(`Rate limit cannot exceed ${RATE_LIMITS.MESSAGES_PER_MINUTE} messages per minute`);
    }
  }

  /**
   * Handles and transforms service errors
   */
  private handleError(error: unknown): Error {
    if ((error as ApiError).code) {
      return error as ApiError;
    }
    return new Error('Campaign service error: ' + (error as Error).message);
  }

  /**
   * Cleanup resources on service destruction
   */
  destroy(): void {
    this.abortController.abort();
  }
}

// Export singleton instance
export default new CampaignService(new CacheManager());