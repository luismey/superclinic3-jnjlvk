'use client';

import React from 'react'; // ^18.0.0
import Skeleton from '../../../components/common/Skeleton';

/**
 * Loading component for the AssistantBuilder page that displays a skeleton placeholder
 * while content is being loaded. Implements a responsive two-panel layout matching
 * the main component structure.
 * 
 * @returns {JSX.Element} Memoized loading skeleton component
 */
const Loading = React.memo(() => {
  return (
    <div 
      className="flex flex-col lg:flex-row w-full min-h-screen gap-6 p-4 lg:p-6"
      role="status"
      aria-label="Loading assistant builder interface"
    >
      {/* Form Section */}
      <div className="w-full lg:w-1/3 space-y-6">
        {/* Header */}
        <div className="space-y-4">
          <Skeleton 
            variant="text"
            width="60%"
            height={32}
            className="mb-2"
          />
          <Skeleton 
            variant="text"
            width="40%"
            height={20}
          />
        </div>

        {/* Form Fields */}
        <div className="space-y-6">
          {/* Name Field */}
          <div className="space-y-2">
            <Skeleton 
              variant="text"
              width={80}
              height={16}
            />
            <Skeleton 
              variant="rectangular"
              width="100%"
              height={40}
            />
          </div>

          {/* Type Field */}
          <div className="space-y-2">
            <Skeleton 
              variant="text"
              width={60}
              height={16}
            />
            <Skeleton 
              variant="rectangular"
              width="100%"
              height={40}
            />
          </div>

          {/* Configuration Fields */}
          <div className="space-y-2">
            <Skeleton 
              variant="text"
              width={120}
              height={16}
            />
            <Skeleton 
              variant="rectangular"
              width="100%"
              height={120}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4 mt-8">
            <Skeleton 
              variant="rectangular"
              width={100}
              height={40}
              className="rounded-md"
            />
            <Skeleton 
              variant="rectangular"
              width={100}
              height={40}
              className="rounded-md"
            />
          </div>
        </div>
      </div>

      {/* Flow Builder Section */}
      <div className="w-full lg:w-2/3 space-y-4">
        {/* Toolbar */}
        <div className="flex gap-4 items-center">
          <Skeleton 
            variant="rectangular"
            width={40}
            height={40}
            className="rounded-md"
          />
          <Skeleton 
            variant="rectangular"
            width={40}
            height={40}
            className="rounded-md"
          />
          <Skeleton 
            variant="rectangular"
            width={40}
            height={40}
            className="rounded-md"
          />
        </div>

        {/* Canvas Area */}
        <Skeleton 
          variant="rectangular"
          width="100%"
          height="calc(100vh - 200px)"
          className="rounded-lg"
        />
      </div>

      {/* Hidden text for screen readers */}
      <span className="sr-only">
        Loading assistant builder interface. Please wait...
      </span>
    </div>
  );
});

// Add display name for debugging
Loading.displayName = 'AssistantBuilderLoading';

export default Loading;