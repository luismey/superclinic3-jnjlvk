'use client';

import React from 'react'; // ^18.0.0
import Skeleton from '../../components/common/Skeleton';

/**
 * Loading state component for the chats page.
 * Displays an accessible, WCAG 2.1 AA compliant loading interface that matches the chat layout.
 * 
 * @returns {JSX.Element} Memoized loading state component
 */
const Loading = React.memo(() => {
  // Number of chat preview skeletons to show
  const CHAT_PREVIEWS = 5;
  // Number of message skeletons to show
  const MESSAGE_SKELETONS = 3;

  return (
    <main 
      className="flex h-screen bg-gray-50 contain-strict will-change-contents"
      aria-busy="true"
      aria-label="Loading chat interface"
      role="status"
    >
      {/* Chat List Section */}
      <section className="w-1/3 border-r border-gray-200 p-4 space-y-4 contain-content">
        {/* Chat list header skeleton */}
        <Skeleton 
          width="60%"
          height={24}
          variant="text"
          className="mb-6"
          aria-label="Loading chat list header"
        />

        {/* Chat preview skeletons */}
        {Array.from({ length: CHAT_PREVIEWS }).map((_, index) => (
          <div 
            key={`chat-preview-${index}`}
            className="flex items-center space-x-3 p-2"
          >
            <Skeleton 
              variant="circular"
              width={40}
              height={40}
              className="flex-shrink-0"
              aria-label="Loading chat avatar"
            />
            <div className="flex-1 space-y-2">
              <Skeleton 
                variant="text"
                width="80%"
                height={16}
                aria-label="Loading chat name"
              />
              <Skeleton 
                variant="text"
                width="60%"
                height={14}
                className="opacity-75"
                aria-label="Loading chat preview"
              />
            </div>
          </div>
        ))}
      </section>

      {/* Chat Panel Section */}
      <section className="flex-1 flex flex-col contain-content">
        {/* Chat header */}
        <header className="h-16 border-b border-gray-200 p-4 contain-strict">
          <div className="flex items-center space-x-3">
            <Skeleton 
              variant="circular"
              width={40}
              height={40}
              aria-label="Loading active chat avatar"
            />
            <Skeleton 
              variant="text"
              width={200}
              height={20}
              aria-label="Loading active chat name"
            />
          </div>
        </header>

        {/* Messages area */}
        <div className="flex-1 p-4 space-y-4 contain-content">
          {Array.from({ length: MESSAGE_SKELETONS }).map((_, index) => (
            <div 
              key={`message-${index}`}
              className={`flex items-start space-x-2 ${
                index % 2 === 0 ? 'justify-start' : 'flex-row-reverse space-x-reverse'
              }`}
            >
              <Skeleton 
                variant="circular"
                width={32}
                height={32}
                className="flex-shrink-0"
                aria-label="Loading message avatar"
              />
              <Skeleton 
                variant="rectangular"
                width={index % 2 === 0 ? '60%' : '40%'}
                height={64}
                className="rounded-lg transform-gpu"
                aria-label="Loading message content"
              />
            </div>
          ))}
        </div>

        {/* Input area */}
        <div className="h-24 border-t border-gray-200 p-4 contain-strict">
          <div className="flex items-center space-x-4">
            <Skeleton 
              variant="rectangular"
              width="100%"
              height={40}
              className="rounded-full"
              aria-label="Loading message input"
            />
            <Skeleton 
              variant="circular"
              width={40}
              height={40}
              aria-label="Loading send button"
            />
          </div>
        </div>
      </section>
    </main>
  );
});

// Add display name for debugging
Loading.displayName = 'ChatLoading';

export default Loading;