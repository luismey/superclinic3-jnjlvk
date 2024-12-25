'use client';

import React from 'react'; // ^18.0.0
import Skeleton from '@/components/common/Skeleton';

/**
 * Loading state component for the analytics dashboard.
 * Implements responsive skeleton layout matching the dashboard structure
 * with WCAG 2.1 AA compliant animations.
 *
 * @returns {JSX.Element} Loading state UI component
 */
export default function Loading(): JSX.Element {
  return (
    <div className="w-full space-y-8 p-4 md:p-6">
      {/* Period selector loading state */}
      <div className="flex justify-end">
        <Skeleton 
          width={160} 
          height={40} 
          variant="rectangular" 
          className="rounded-lg"
        />
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, index) => (
          <div key={`stat-${index}`} className="space-y-2">
            <Skeleton 
              width="100%" 
              height={24} 
              variant="text" 
              className="mb-2"
            />
            <Skeleton 
              width="60%" 
              height={32} 
              variant="text" 
              className="mb-1"
            />
            <Skeleton 
              width="40%" 
              height={20} 
              variant="text"
            />
          </div>
        ))}
      </div>

      {/* Response Times Chart */}
      <div className="space-y-4">
        <Skeleton 
          width="20%" 
          height={24} 
          variant="text" 
          className="mb-4"
        />
        <Skeleton 
          width="100%" 
          height={300} 
          variant="rectangular" 
          className="rounded-lg"
        />
      </div>

      {/* Customer Journey */}
      <div className="space-y-4">
        <Skeleton 
          width="25%" 
          height={24} 
          variant="text" 
          className="mb-4"
        />
        <div className="flex flex-col space-y-2 sm:flex-row sm:space-x-4 sm:space-y-0">
          {[100, 80, 60, 40].map((width, index) => (
            <Skeleton
              key={`journey-${index}`}
              width={`${width}%`}
              height={80}
              variant="rectangular"
              className="rounded-lg"
            />
          ))}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-4">
        {[...Array(3)].map((_, index) => (
          <Skeleton
            key={`action-${index}`}
            width={120}
            height={40}
            variant="rectangular"
            className="rounded-lg"
          />
        ))}
      </div>
    </div>
  );
}

// Add display name for debugging
Loading.displayName = 'AnalyticsLoading';