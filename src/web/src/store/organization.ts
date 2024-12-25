import { create } from 'zustand'; // v4.4.0
import { devtools, persist, subscribeWithSelector } from 'zustand/middleware'; // v4.4.0
import { Organization, organizationSchema } from '../types/organization';
import { organizationService } from '../services/organization';
import { ApiError } from '../types/common';

// Constants
const STORE_NAME = 'organization-store';
const STORE_VERSION = '1.0.0';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const MAX_RETRIES = 3;

// Types
interface OrganizationState {
  organization: Organization | null;
  loading: Record<string, boolean>;
  error: ApiError | null;
  validation: Record<string, string[]>;
  cache: {
    timestamp: number | null;
    data: Organization | null;
  };
  fetchOrganization: () => Promise<void>;
  updateOrganization: (data: Partial<Organization>) => Promise<void>;
  updateSettings: (settings: Partial<Organization['settings']>) => Promise<void>;
  upgradePlan: (plan: Organization['plan']) => Promise<void>;
  retry: () => Promise<void>;
  clearError: () => void;
}

/**
 * Creates the organization store with persistence, devtools, and selective subscriptions
 */
export const useOrganizationStore = create<OrganizationState>()(
  subscribeWithSelector(
    persist(
      devtools(
        (set, get) => ({
          // State
          organization: null,
          loading: {},
          error: null,
          validation: {},
          cache: {
            timestamp: null,
            data: null
          },

          // Actions
          fetchOrganization: async () => {
            const { cache } = get();
            
            // Check cache validity
            if (
              cache.data && 
              cache.timestamp && 
              Date.now() - cache.timestamp < CACHE_DURATION
            ) {
              set({ organization: cache.data });
              return;
            }

            set({ loading: { ...get().loading, fetch: true }, error: null });

            try {
              const organization = await organizationService.getOrganization();
              
              // Validate organization data
              const validatedOrg = organizationSchema.parse(organization);

              set({
                organization: validatedOrg,
                cache: {
                  timestamp: Date.now(),
                  data: validatedOrg
                },
                loading: { ...get().loading, fetch: false }
              });
            } catch (error) {
              set({
                error: error as ApiError,
                loading: { ...get().loading, fetch: false }
              });
            }
          },

          updateOrganization: async (data: Partial<Organization>) => {
            const previousOrg = get().organization;
            
            // Optimistic update
            set({
              organization: previousOrg ? { ...previousOrg, ...data } : null,
              loading: { ...get().loading, update: true },
              error: null
            });

            try {
              const updated = await organizationService.updateOrganization(data);
              
              // Validate updated data
              const validatedOrg = organizationSchema.parse(updated);

              set({
                organization: validatedOrg,
                cache: {
                  timestamp: Date.now(),
                  data: validatedOrg
                },
                loading: { ...get().loading, update: false }
              });
            } catch (error) {
              // Revert optimistic update
              set({
                organization: previousOrg,
                error: error as ApiError,
                loading: { ...get().loading, update: false }
              });
            }
          },

          updateSettings: async (settings: Partial<Organization['settings']>) => {
            const previousOrg = get().organization;
            
            if (!previousOrg) {
              throw new Error('No organization loaded');
            }

            // Optimistic update
            set({
              organization: {
                ...previousOrg,
                settings: { ...previousOrg.settings, ...settings }
              },
              loading: { ...get().loading, settings: true },
              error: null
            });

            try {
              const updated = await organizationService.updateOrganizationSettings(settings);
              
              // Validate updated data
              const validatedOrg = organizationSchema.parse(updated);

              set({
                organization: validatedOrg,
                cache: {
                  timestamp: Date.now(),
                  data: validatedOrg
                },
                loading: { ...get().loading, settings: false }
              });
            } catch (error) {
              // Revert optimistic update
              set({
                organization: previousOrg,
                error: error as ApiError,
                loading: { ...get().loading, settings: false }
              });
            }
          },

          upgradePlan: async (plan: Organization['plan']) => {
            const previousOrg = get().organization;
            
            if (!previousOrg) {
              throw new Error('No organization loaded');
            }

            set({
              loading: { ...get().loading, upgrade: true },
              error: null
            });

            try {
              const updated = await organizationService.upgradePlan(plan);
              
              // Validate updated data
              const validatedOrg = organizationSchema.parse(updated);

              set({
                organization: validatedOrg,
                cache: {
                  timestamp: Date.now(),
                  data: validatedOrg
                },
                loading: { ...get().loading, upgrade: false }
              });
            } catch (error) {
              set({
                error: error as ApiError,
                loading: { ...get().loading, upgrade: false }
              });
            }
          },

          retry: async () => {
            const { error } = get();
            if (!error) return;

            let retryCount = 0;
            const operation = error.details?.operation as keyof OrganizationState;

            while (retryCount < MAX_RETRIES) {
              try {
                if (typeof get()[operation] === 'function') {
                  await (get()[operation] as Function)();
                  break;
                }
              } catch (error) {
                retryCount++;
                if (retryCount === MAX_RETRIES) {
                  set({ error: error as ApiError });
                }
                await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
              }
            }
          },

          clearError: () => set({ error: null })
        }),
        {
          name: STORE_NAME
        }
      ),
      {
        name: STORE_NAME,
        version: STORE_VERSION,
        partialize: (state) => ({
          organization: state.organization,
          cache: state.cache
        })
      }
    )
  )
);

// Export selectors for common state slices
export const selectOrganization = (state: OrganizationState) => state.organization;
export const selectLoading = (state: OrganizationState) => state.loading;
export const selectError = (state: OrganizationState) => state.error;
export const selectValidation = (state: OrganizationState) => state.validation;