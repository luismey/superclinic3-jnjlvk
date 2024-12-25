'use client';

import React from 'react'; // ^18.0.0
import Skeleton from '@/components/common/Skeleton';

/**
 * Loading component for campaign details page.
 * Displays skeleton placeholders while content is being fetched.
 * Implements WCAG 2.1 AA compliant loading states.
 */
const Loading = React.memo(() => {
  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-8" role="status" aria-label="Loading campaign details">
      {/* Header Section */}
      <div className="space-y-4">
        <Skeleton 
          variant="text"
          width="60%"
          height={32}
          className="mb-2"
          aria-label="Loading campaign title"
        />
        <div className="flex items-center space-x-4">
          <Skeleton 
            variant="text"
            width={120}
            height={20}
            aria-label="Loading campaign date"
          />
          <Skeleton 
            variant="text"
            width={100}
            height={20}
            aria-label="Loading campaign status"
          />
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, index) => (
          <div key={index} className="p-4 border rounded-lg">
            <Skeleton 
              variant="text"
              width="40%"
              height={16}
              className="mb-2"
              aria-label="Loading metric label"
            />
            <Skeleton 
              variant="text"
              width="60%"
              height={24}
              aria-label="Loading metric value"
            />
          </div>
        ))}
      </div>

      {/* Status Section */}
      <div className="space-y-4">
        <Skeleton 
          variant="text"
          width="30%"
          height={24}
          className="mb-4"
          aria-label="Loading progress label"
        />
        <Skeleton 
          variant="rectangular"
          width="100%"
          height={8}
          className="rounded-full"
          aria-label="Loading progress bar"
        />
      </div>

      {/* Campaign Details */}
      <div className="space-y-4">
        <Skeleton 
          variant="rectangular"
          width="100%"
          height={120}
          className="rounded-lg"
          aria-label="Loading campaign details"
        />
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-4">
        <Skeleton 
          variant="rectangular"
          width={120}
          height={40}
          className="rounded-md"
          aria-label="Loading primary action button"
        />
        <Skeleton 
          variant="rectangular"
          width={120}
          height={40}
          className="rounded-md"
          aria-label="Loading secondary action button"
        />
      </div>

      {/* Hidden text for screen readers */}
      <span className="sr-only">
        Loading campaign details. Please wait...
      </span>
    </div>
  );
});

// Add display name for debugging
Loading.displayName = 'CampaignLoading';

export default Loading;