'use client';

import React from 'react'; // ^18.0.0
import Skeleton from '@/components/common/Skeleton';

// Number of skeleton cards to display during loading
const SKELETON_CARDS_COUNT = 6;

/**
 * Loading state component for the assistants page.
 * Displays skeleton placeholders in a responsive grid layout while data is being fetched.
 * Implements design system specifications and accessibility requirements.
 *
 * @returns {JSX.Element} The rendered loading state component
 */
export default function AssistantsLoading(): JSX.Element {
  return (
    <div 
      className="container mx-auto p-6"
      role="status"
      aria-label="Loading assistants"
      aria-live="polite"
    >
      {/* Responsive grid layout following design system breakpoints */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Generate skeleton cards based on SKELETON_CARDS_COUNT */}
        {Array.from({ length: SKELETON_CARDS_COUNT }).map((_, index) => (
          <div 
            key={`skeleton-${index}`}
            className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm"
          >
            {/* Assistant name skeleton */}
            <Skeleton 
              variant="text"
              width="70%"
              height={24}
              className="mb-4"
              animation="pulse"
            />

            {/* Assistant type skeleton */}
            <div className="flex items-center gap-4 mb-6">
              <Skeleton 
                variant="text"
                width="40%"
                height={16}
                animation="pulse"
              />
              <Skeleton 
                variant="circular"
                width={16}
                height={16}
                animation="pulse"
              />
            </div>

            {/* Metrics skeleton */}
            <div className="grid grid-cols-2 gap-4">
              <Skeleton 
                variant="rectangular"
                width="100%"
                height={20}
                animation="pulse"
              />
              <Skeleton 
                variant="rectangular"
                width="100%"
                height={20}
                animation="pulse"
              />
            </div>

            {/* Action buttons skeleton */}
            <div className="flex justify-end gap-3 mt-6">
              <Skeleton 
                variant="rectangular"
                width={32}
                height={32}
                animation="pulse"
                className="rounded-md"
              />
              <Skeleton 
                variant="rectangular"
                width={32}
                height={32}
                animation="pulse"
                className="rounded-md"
              />
            </div>
          </div>
        ))}
      </div>

      {/* Hidden text for screen readers */}
      <span className="sr-only">
        Loading assistants list, please wait...
      </span>
    </div>
  );
}

// Add display name for debugging
AssistantsLoading.displayName = 'AssistantsLoading';