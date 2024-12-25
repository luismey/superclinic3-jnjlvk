import { useCallback, useEffect } from 'react'; // v18.0.0
import useCampaignStore from '../store/campaign';
import CampaignService from '../services/campaign';
import { Campaign, CampaignStatus } from '../types/campaign';
import { ApiError } from '../types/common';

// Constants for request handling
const RETRY_ATTEMPTS = 3;
const RETRY_DELAY = 1000;
const REQUEST_TIMEOUT = 5000;

// Campaign service singleton
const campaignService = new CampaignService();

/**
 * Custom hook for managing campaign operations with enhanced error handling,
 * real-time updates, and performance optimizations.
 */
export function useCampaign() {
  // Get campaign store state and actions
  const {
    campaigns,
    selectedCampaign,
    loading,
    error,
    fetchCampaigns: storeFetchCampaigns,
    createCampaign: storeCreateCampaign,
    updateCampaign: storeUpdateCampaign,
    deleteCampaign: storeDeleteCampaign,
    startCampaign: storeStartCampaign,
    pauseCampaign: storePauseCampaign,
    setSelectedCampaign,
    clearError
  } = useCampaignStore();

  /**
   * Fetches campaigns with request deduplication and caching
   */
  const fetchCampaigns = useCallback(async () => {
    try {
      await storeFetchCampaigns();
    } catch (error) {
      console.error('Error fetching campaigns:', error);
      throw error;
    }
  }, [storeFetchCampaigns]);

  /**
   * Selects a campaign with validation
   */
  const selectCampaign = useCallback((campaign: Campaign | null) => {
    try {
      if (campaign) {
        // Validate campaign status for selection
        if (campaign.status === CampaignStatus.FAILED) {
          throw new Error('Cannot select a failed campaign');
        }
      }
      setSelectedCampaign(campaign);
    } catch (error) {
      console.error('Error selecting campaign:', error);
      throw error;
    }
  }, [setSelectedCampaign]);

  /**
   * Creates a campaign with enhanced validation and error handling
   */
  const createCampaign = useCallback(async (data: CreateCampaignDto) => {
    try {
      // Validate campaign data before creation
      await campaignService.validateCampaign(data);
      
      const campaign = await storeCreateCampaign(data);
      return campaign;
    } catch (error) {
      const apiError = error as ApiError;
      console.error('Error creating campaign:', apiError);
      throw new Error(apiError.message || 'Failed to create campaign');
    }
  }, [storeCreateCampaign]);

  /**
   * Updates a campaign with optimistic updates
   */
  const updateCampaign = useCallback(async (id: string, data: UpdateCampaignDto) => {
    try {
      // Validate campaign data before update
      await campaignService.validateCampaign(data);
      
      const campaign = await storeUpdateCampaign(id, data);
      return campaign;
    } catch (error) {
      const apiError = error as ApiError;
      console.error('Error updating campaign:', apiError);
      throw new Error(apiError.message || 'Failed to update campaign');
    }
  }, [storeUpdateCampaign]);

  /**
   * Deletes a campaign with proper cleanup
   */
  const deleteCampaign = useCallback(async (id: string) => {
    try {
      // Check if campaign can be deleted
      const campaign = campaigns.find(c => c.id === id);
      if (campaign?.status === CampaignStatus.RUNNING) {
        throw new Error('Cannot delete a running campaign');
      }

      await storeDeleteCampaign(id);
    } catch (error) {
      const apiError = error as ApiError;
      console.error('Error deleting campaign:', apiError);
      throw new Error(apiError.message || 'Failed to delete campaign');
    }
  }, [campaigns, storeDeleteCampaign]);

  /**
   * Starts a campaign with rate limit validation
   */
  const startCampaign = useCallback(async (id: string) => {
    try {
      const campaign = campaigns.find(c => c.id === id);
      if (!campaign) {
        throw new Error('Campaign not found');
      }

      // Validate campaign status
      if (campaign.status !== CampaignStatus.SCHEDULED) {
        throw new Error('Campaign must be in SCHEDULED status to start');
      }

      const updatedCampaign = await storeStartCampaign(id);
      return updatedCampaign;
    } catch (error) {
      const apiError = error as ApiError;
      console.error('Error starting campaign:', apiError);
      throw new Error(apiError.message || 'Failed to start campaign');
    }
  }, [campaigns, storeStartCampaign]);

  /**
   * Pauses a campaign with proper state handling
   */
  const pauseCampaign = useCallback(async (id: string) => {
    try {
      const campaign = campaigns.find(c => c.id === id);
      if (!campaign) {
        throw new Error('Campaign not found');
      }

      // Validate campaign status
      if (campaign.status !== CampaignStatus.RUNNING) {
        throw new Error('Only running campaigns can be paused');
      }

      const updatedCampaign = await storePauseCampaign(id);
      return updatedCampaign;
    } catch (error) {
      const apiError = error as ApiError;
      console.error('Error pausing campaign:', apiError);
      throw new Error(apiError.message || 'Failed to pause campaign');
    }
  }, [campaigns, storePauseCampaign]);

  // Set up automatic cleanup
  useEffect(() => {
    return () => {
      clearError();
      campaignService.destroy();
    };
  }, [clearError]);

  return {
    // State
    campaigns,
    selectedCampaign,
    loading,
    error,

    // Actions
    fetchCampaigns,
    selectCampaign,
    createCampaign,
    updateCampaign,
    deleteCampaign,
    startCampaign,
    pauseCampaign
  };
}

export default useCampaign;