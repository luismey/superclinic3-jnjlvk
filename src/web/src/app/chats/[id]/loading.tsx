'use client';

import React from 'react'; // ^18.0.0
import Skeleton from '@/components/common/Skeleton';

/**
 * Loading component for the chat detail page that displays skeleton placeholders
 * while content is being fetched. Implements WCAG 2.1 AA compliant loading states.
 *
 * @returns {JSX.Element} Skeleton layout matching the chat interface
 */
const Loading: React.FC = React.memo(() => {
  // Generate array for message skeletons with alternating alignments
  const messageSkeletons = Array.from({ length: 5 }, (_, index) => ({
    align: index % 2 === 0 ? 'left' : 'right',
    width: `${60 + Math.floor(Math.random() * 20)}%`, // Random width between 60-80%
  }));

  return (
    <div 
      className="flex flex-col h-full bg-white"
      role="progressbar"
      aria-busy="true"
      aria-label="Loading chat conversation"
    >
      {/* Header Section */}
      <div className="flex items-center gap-3 p-4 border-b border-gray-200">
        <Skeleton 
          variant="circular"
          width={40}
          height={40}
          className="flex-shrink-0"
        />
        <Skeleton 
          variant="text"
          width={200}
          height={24}
          className="flex-grow max-w-[50%]"
        />
      </div>

      {/* Message List Section */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messageSkeletons.map((skeleton, index) => (
          <div
            key={index}
            className={`flex items-start gap-2 max-w-[80%] ${
              skeleton.align === 'right' ? 'ml-auto' : ''
            }`}
          >
            {skeleton.align === 'left' && (
              <Skeleton 
                variant="circular"
                width={32}
                height={32}
                className="flex-shrink-0"
              />
            )}
            <div className="flex flex-col gap-1">
              <Skeleton 
                variant="text"
                width={skeleton.width}
                height={20}
                className="mb-1"
              />
              <Skeleton 
                variant="text"
                width={skeleton.width}
                height={20}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Input Area Section */}
      <div className="border-t border-gray-200 p-4 flex items-center gap-3">
        <Skeleton 
          variant="rectangular"
          width="100%"
          height={40}
          className="rounded-full"
        />
        <Skeleton 
          variant="circular"
          width={40}
          height={40}
          className="flex-shrink-0"
        />
      </div>
    </div>
  );
});

// Add display name for debugging
Loading.displayName = 'ChatDetailLoading';

export default Loading;