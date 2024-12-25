'use client';

import React from 'react'; // ^18.0.0
import Skeleton from '@/components/common/Skeleton';

// Constants for the loading component
const SKELETON_CARDS_COUNT = 6;
const GRID_LAYOUT_CLASSES = 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4';
const ANIMATION_BASE_DELAY = 150;
const HEADER_HEIGHT = '48px';
const FILTER_SECTION_HEIGHT = '64px';

/**
 * Memoized skeleton card component for campaign loading state
 * Implements staggered animation for visual interest
 */
const SkeletonCard = React.memo(({ index }: { index: number }) => {
  // Calculate staggered animation delay
  const animationDelay = `${index * ANIMATION_BASE_DELAY}ms`;

  return (
    <div 
      className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm"
      style={{ animationDelay }}
    >
      {/* Card Header with Title and Status */}
      <div className="flex justify-between items-center mb-4">
        <Skeleton 
          variant="text" 
          width="60%" 
          height={24} 
          className="mb-2"
        />
        <Skeleton 
          variant="rectangular" 
          width={80} 
          height={28} 
          className="rounded-full"
        />
      </div>

      {/* Progress Bar */}
      <Skeleton 
        variant="rectangular" 
        width="100%" 
        height={8} 
        className="mb-4"
      />

      {/* Metrics Section */}
      <div className="grid grid-cols-3 gap-2">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex flex-col">
            <Skeleton 
              variant="text" 
              width="100%" 
              height={16} 
              className="mb-1"
            />
            <Skeleton 
              variant="text" 
              width="80%" 
              height={14}
            />
          </div>
        ))}
      </div>

      {/* Actions Row */}
      <div className="flex justify-end mt-4 space-x-2">
        {[...Array(2)].map((_, i) => (
          <Skeleton 
            key={i}
            variant="rectangular" 
            width={32} 
            height={32} 
            className="rounded-md"
          />
        ))}
      </div>
    </div>
  );
});

SkeletonCard.displayName = 'SkeletonCard';

/**
 * Loading component for the campaigns page
 * Implements WCAG 2.1 AA compliant loading indicators with synchronized animations
 */
export default function Loading() {
  return (
    <div 
      role="status"
      aria-label="Loading campaigns"
      aria-live="polite"
      className="w-full min-h-screen animate-fade-in"
    >
      {/* Page Header */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex justify-between items-center">
          <Skeleton 
            variant="text" 
            width={200} 
            height={HEADER_HEIGHT} 
          />
          <Skeleton 
            variant="rectangular" 
            width={120} 
            height={40} 
            className="rounded-md"
          />
        </div>
      </div>

      {/* Filters Section */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex flex-wrap gap-4 items-center">
          <Skeleton 
            variant="rectangular" 
            width={240} 
            height={FILTER_SECTION_HEIGHT} 
            className="rounded-md"
          />
          <Skeleton 
            variant="rectangular" 
            width={160} 
            height={FILTER_SECTION_HEIGHT} 
            className="rounded-md"
          />
        </div>
      </div>

      {/* Campaign Cards Grid */}
      <div className={GRID_LAYOUT_CLASSES}>
        {[...Array(SKELETON_CARDS_COUNT)].map((_, index) => (
          <SkeletonCard key={index} index={index} />
        ))}
      </div>

      {/* Screen reader only text */}
      <span className="sr-only">
        Loading campaign list, please wait...
      </span>
    </div>
  );
}