'use client';

import React, { useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation'; // v14.0.0
import { ErrorBoundary } from 'react-error-boundary'; // v4.0.0
import { toast } from 'react-toastify'; // v9.0.0
import CampaignForm from '../../../components/campaigns/CampaignForm';
import { useCampaign } from '../../../hooks/useCampaign';
import { CreateCampaignDto, CampaignStatus } from '../../../types/campaign';
import { WHATSAPP_CONSTANTS } from '../../../config/constants';

/**
 * Error fallback component for campaign creation errors
 */
const ErrorFallback = ({ error, resetErrorBoundary }: { error: Error; resetErrorBoundary: () => void }) => (
  <div 
    role="alert" 
    className="p-6 rounded-lg bg-error-50 border border-error-200"
    aria-live="assertive"
  >
    <h2 className="text-lg font-semibold text-error-700 mb-2">
      Error Creating Campaign
    </h2>
    <p className="text-error-600 mb-4">{error.message}</p>
    <button
      onClick={resetErrorBoundary}
      className="px-4 py-2 bg-error-600 text-white rounded-md hover:bg-error-700 focus:outline-none focus:ring-2 focus:ring-error-500 focus:ring-offset-2"
    >
      Try Again
    </button>
  </div>
);

/**
 * Campaign creation page component with comprehensive error handling and accessibility
 */
const CreateCampaignPage = () => {
  const router = useRouter();
  const { createCampaign, loading, error } = useCampaign();

  // Reset error state on unmount
  useEffect(() => {
    return () => {
      if (error) {
        toast.dismiss();
      }
    };
  }, [error]);

  /**
   * Validates campaign rate limits based on WhatsApp constraints
   */
  const validateRateLimits = useCallback((data: CreateCampaignDto): boolean => {
    const maxRate = parseInt(WHATSAPP_CONSTANTS.RATE_LIMITS.MESSAGES_PER_MINUTE);
    if (data.rateLimit > maxRate) {
      toast.error(`Rate limit cannot exceed ${maxRate} messages per minute`);
      return false;
    }
    return true;
  }, []);

  /**
   * Handles campaign form submission with validation and error handling
   */
  const handleSubmit = useCallback(async (formData: CreateCampaignDto) => {
    try {
      // Validate rate limits before submission
      if (!validateRateLimits(formData)) {
        return;
      }

      // Prepare campaign data with initial status
      const campaignData = {
        ...formData,
        status: CampaignStatus.SCHEDULED,
      };

      // Create campaign with loading state
      const campaign = await createCampaign(campaignData);

      // Show success message
      toast.success('Campaign created successfully', {
        position: 'top-right',
        autoClose: 3000,
      });

      // Navigate to campaign list
      router.push('/campaigns');

    } catch (error) {
      // Show error message
      toast.error((error as Error).message || 'Failed to create campaign', {
        position: 'top-right',
        autoClose: 5000,
      });
    }
  }, [createCampaign, router, validateRateLimits]);

  /**
   * Handles cancellation of campaign creation
   */
  const handleCancel = useCallback(() => {
    const confirmCancel = window.confirm('Are you sure you want to cancel? Any unsaved changes will be lost.');
    if (confirmCancel) {
      router.push('/campaigns');
    }
  }, [router]);

  return (
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onReset={() => {
        // Reset error state and clear form
        if (error) {
          toast.dismiss();
        }
      }}
    >
      <div className="container mx-auto px-4 py-6">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">
            Create New Campaign
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Configure your WhatsApp marketing campaign with message templates, scheduling, and rate limits.
          </p>
        </header>

        {/* Loading indicator */}
        {loading && (
          <div 
            role="status" 
            aria-live="polite" 
            className="mb-4"
          >
            <p className="text-primary-600">Creating campaign...</p>
          </div>
        )}

        {/* Error display */}
        {error && (
          <div 
            role="alert" 
            aria-live="assertive" 
            className="mb-4 p-4 rounded-md bg-error-50 border border-error-200 text-error-700"
          >
            {error}
          </div>
        )}

        {/* Campaign creation form */}
        <div aria-label="Campaign creation form">
          <CampaignForm
            onSubmit={handleSubmit}
            onCancel={handleCancel}
          />
        </div>
      </div>
    </ErrorBoundary>
  );
};

export default CreateCampaignPage;