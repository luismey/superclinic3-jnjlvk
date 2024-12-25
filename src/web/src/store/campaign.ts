import { create } from 'zustand'; // v4.4.0
import { devtools, persist } from 'zustand/middleware'; // v4.4.0
import { 
  Campaign, 
  CreateCampaignDto, 
  UpdateCampaignDto 
} from '../types/campaign';
import CampaignService from '../services/campaign';
import { ApiError } from '../types/common';

// Constants
const STORE_NAME = 'campaign-store';
const STORE_VERSION = 1;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Campaign store state interface
interface CampaignState {
  // Data
  campaigns: Campaign[];
  selectedCampaign: Campaign | null;
  
  // UI State
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;

  // Actions
  fetchCampaigns: () => Promise<void>;
  fetchCampaignById: (id: string) => Promise<void>;
  createCampaign: (data: CreateCampaignDto) => Promise<Campaign>;
  updateCampaign: (id: string, data: UpdateCampaignDto) => Promise<Campaign>;
  deleteCampaign: (id: string) => Promise<void>;
  startCampaign: (id: string) => Promise<Campaign>;
  pauseCampaign: (id: string) => Promise<Campaign>;
  
  // State Management
  setSelectedCampaign: (campaign: Campaign | null) => void;
  clearError: () => void;
  resetState: () => void;
  refreshCampaigns: () => Promise<void>;
}

// Initial state
const initialState = {
  campaigns: [],
  selectedCampaign: null,
  loading: false,
  error: null,
  lastUpdated: null,
};

// Campaign service instance
const campaignService = new CampaignService();

/**
 * Creates the campaign store with middleware and comprehensive error handling
 */
export const useCampaignStore = create<CampaignState>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial State
        ...initialState,

        /**
         * Fetches all campaigns with caching
         */
        fetchCampaigns: async () => {
          const { lastUpdated } = get();
          const now = new Date();

          // Return cached data if within cache duration
          if (lastUpdated && now.getTime() - lastUpdated.getTime() < CACHE_DURATION) {
            return;
          }

          set({ loading: true, error: null });

          try {
            const response = await campaignService.getCampaigns({}, {
              page: 1,
              pageSize: 100 // Adjust based on requirements
            });

            set({ 
              campaigns: response.items,
              lastUpdated: new Date(),
              loading: false 
            });
          } catch (error) {
            set({ 
              error: (error as ApiError).message || 'Failed to fetch campaigns',
              loading: false 
            });
          }
        },

        /**
         * Fetches a specific campaign by ID
         */
        fetchCampaignById: async (id: string) => {
          set({ loading: true, error: null });

          try {
            const campaign = await campaignService.getCampaignById(id);
            set({ 
              selectedCampaign: campaign,
              loading: false 
            });
          } catch (error) {
            set({ 
              error: (error as ApiError).message || 'Failed to fetch campaign',
              loading: false 
            });
          }
        },

        /**
         * Creates a new campaign
         */
        createCampaign: async (data: CreateCampaignDto) => {
          set({ loading: true, error: null });

          try {
            const campaign = await campaignService.createCampaign(data);
            set(state => ({ 
              campaigns: [...state.campaigns, campaign],
              loading: false 
            }));
            return campaign;
          } catch (error) {
            set({ 
              error: (error as ApiError).message || 'Failed to create campaign',
              loading: false 
            });
            throw error;
          }
        },

        /**
         * Updates an existing campaign
         */
        updateCampaign: async (id: string, data: UpdateCampaignDto) => {
          set({ loading: true, error: null });

          try {
            const campaign = await campaignService.updateCampaign(id, data);
            set(state => ({
              campaigns: state.campaigns.map(c => 
                c.id === id ? campaign : c
              ),
              selectedCampaign: state.selectedCampaign?.id === id ? campaign : state.selectedCampaign,
              loading: false
            }));
            return campaign;
          } catch (error) {
            set({ 
              error: (error as ApiError).message || 'Failed to update campaign',
              loading: false 
            });
            throw error;
          }
        },

        /**
         * Deletes a campaign
         */
        deleteCampaign: async (id: string) => {
          set({ loading: true, error: null });

          try {
            await campaignService.deleteCampaign(id);
            set(state => ({
              campaigns: state.campaigns.filter(c => c.id !== id),
              selectedCampaign: state.selectedCampaign?.id === id ? null : state.selectedCampaign,
              loading: false
            }));
          } catch (error) {
            set({ 
              error: (error as ApiError).message || 'Failed to delete campaign',
              loading: false 
            });
            throw error;
          }
        },

        /**
         * Starts a campaign
         */
        startCampaign: async (id: string) => {
          set({ loading: true, error: null });

          try {
            const campaign = await campaignService.startCampaign(id);
            set(state => ({
              campaigns: state.campaigns.map(c => 
                c.id === id ? campaign : c
              ),
              selectedCampaign: state.selectedCampaign?.id === id ? campaign : state.selectedCampaign,
              loading: false
            }));
            return campaign;
          } catch (error) {
            set({ 
              error: (error as ApiError).message || 'Failed to start campaign',
              loading: false 
            });
            throw error;
          }
        },

        /**
         * Pauses a campaign
         */
        pauseCampaign: async (id: string) => {
          set({ loading: true, error: null });

          try {
            const campaign = await campaignService.pauseCampaign(id);
            set(state => ({
              campaigns: state.campaigns.map(c => 
                c.id === id ? campaign : c
              ),
              selectedCampaign: state.selectedCampaign?.id === id ? campaign : state.selectedCampaign,
              loading: false
            }));
            return campaign;
          } catch (error) {
            set({ 
              error: (error as ApiError).message || 'Failed to pause campaign',
              loading: false 
            });
            throw error;
          }
        },

        /**
         * Sets the selected campaign
         */
        setSelectedCampaign: (campaign: Campaign | null) => {
          set({ selectedCampaign: campaign });
        },

        /**
         * Clears any error state
         */
        clearError: () => {
          set({ error: null });
        },

        /**
         * Resets store to initial state
         */
        resetState: () => {
          set(initialState);
        },

        /**
         * Force refreshes campaign data
         */
        refreshCampaigns: async () => {
          set({ lastUpdated: null });
          await get().fetchCampaigns();
        }
      }),
      {
        name: STORE_NAME,
        version: STORE_VERSION,
        partialize: (state) => ({
          campaigns: state.campaigns,
          lastUpdated: state.lastUpdated
        })
      }
    )
  )
);

export default useCampaignStore;