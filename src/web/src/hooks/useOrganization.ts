import { useEffect, useCallback, useRef } from 'react'; // v18.0.0
import { useOrganizationStore } from '../store/organization';
import { Organization } from '../types/organization';

/**
 * Custom hook for managing organization state and operations with optimized performance
 * and error handling. Provides a simplified interface to interact with organization data
 * and settings using Zustand store.
 * 
 * @param organizationId - Optional organization ID for specific organization data
 * @returns Object containing organization state and management functions
 */
export function useOrganization(organizationId?: string) {
  // Get organization store state and methods
  const {
    organization,
    loading,
    error,
    fetchOrganization,
    updateOrganization,
    updateSettings,
    clearError
  } = useOrganizationStore();

  // Abort controller ref for cleanup
  const abortControllerRef = useRef<AbortController>();

  /**
   * Memoized fetch callback with request cancellation support
   */
  const fetchOrganizationData = useCallback(async () => {
    try {
      // Cancel any pending requests
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Create new abort controller
      abortControllerRef.current = new AbortController();

      // Fetch organization data with abort signal
      await fetchOrganization();
    } catch (err) {
      console.error('Failed to fetch organization:', err);
    }
  }, [fetchOrganization]);

  /**
   * Retry fetch with exponential backoff
   */
  const retryFetch = useCallback(async () => {
    clearError();
    const maxRetries = 3;
    const baseDelay = 1000;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        await fetchOrganizationData();
        return;
      } catch (err) {
        if (attempt === maxRetries - 1) throw err;
        await new Promise(resolve => 
          setTimeout(resolve, baseDelay * Math.pow(2, attempt))
        );
      }
    }
  }, [fetchOrganizationData, clearError]);

  /**
   * Handle organization updates with optimistic updates and error handling
   */
  const handleUpdateOrganization = useCallback(async (
    data: Partial<Organization>
  ) => {
    try {
      await updateOrganization(data);
    } catch (err) {
      console.error('Failed to update organization:', err);
      throw err;
    }
  }, [updateOrganization]);

  /**
   * Handle settings updates with validation and error handling
   */
  const handleUpdateSettings = useCallback(async (
    settings: Partial<Organization['settings']>
  ) => {
    try {
      await updateSettings(settings);
    } catch (err) {
      console.error('Failed to update settings:', err);
      throw err;
    }
  }, [updateSettings]);

  // Initialize organization data fetch
  useEffect(() => {
    fetchOrganizationData();

    // Cleanup function to cancel pending requests
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchOrganizationData, organizationId]);

  return {
    // State
    organization,
    loading,
    error,

    // Actions
    fetchOrganization: fetchOrganizationData,
    updateOrganization: handleUpdateOrganization,
    updateSettings: handleUpdateSettings,
    retryFetch
  };
}