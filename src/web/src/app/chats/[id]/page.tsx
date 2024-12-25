'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ErrorBoundary } from 'react-error-boundary';
import ChatPanel from '../../../components/chats/ChatPanel';
import { useChatStore } from '../../../store/chat';
import { ConnectionStatus } from '../../../hooks/useWebSocket';

// Constants for error handling and retry logic
const ERROR_DISPLAY_DURATION = 5000;
const MAX_RETRY_ATTEMPTS = 3;

interface ChatPageProps {
  params: {
    id: string;
  };
  searchParams: {
    ai?: boolean;
  };
}

/**
 * Chat page component with real-time messaging capabilities and AI integration
 * Implements offline support, error handling, and performance optimizations
 */
const ChatPage: React.FC<ChatPageProps> = ({ params, searchParams }) => {
  // Initialize router and state
  const router = useRouter();
  const [retryCount, setRetryCount] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Get chat store methods
  const { 
    activeChat,
    setActiveChat,
    error: storeError,
    clearError,
    fetchChats
  } = useChatStore();

  /**
   * Handles navigation back to chat list
   */
  const handleBack = useCallback(async () => {
    try {
      // Clean up active chat state
      setActiveChat(null);
      router.push('/chats');
    } catch (error) {
      console.error('Navigation error:', error);
    }
  }, [router, setActiveChat]);

  /**
   * Handles chat-related errors with retry logic
   */
  const handleError = useCallback((error: Error) => {
    console.error('Chat error:', error);
    setErrorMessage(error.message);

    // Attempt retry if under limit
    if (retryCount < MAX_RETRY_ATTEMPTS) {
      setRetryCount(prev => prev + 1);
      fetchChats();
    }

    // Clear error message after delay
    setTimeout(() => {
      setErrorMessage(null);
    }, ERROR_DISPLAY_DURATION);
  }, [retryCount, fetchChats]);

  /**
   * Error boundary fallback component
   */
  const ErrorFallback = useCallback(({ error, resetErrorBoundary }: any) => (
    <div className="flex flex-col items-center justify-center h-screen p-4 bg-error-50 dark:bg-error-900">
      <h2 className="text-xl font-semibold text-error-900 dark:text-error-50 mb-4">
        Something went wrong
      </h2>
      <p className="text-error-700 dark:text-error-300 mb-6">
        {error.message}
      </p>
      <div className="flex gap-4">
        <button
          onClick={resetErrorBoundary}
          className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
        >
          Try again
        </button>
        <button
          onClick={handleBack}
          className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
        >
          Go back
        </button>
      </div>
    </div>
  ), [handleBack]);

  // Initialize chat on mount
  useEffect(() => {
    const initializeChat = async () => {
      try {
        // Fetch chat data if not already active
        if (!activeChat || activeChat.id !== params.id) {
          await fetchChats();
          const chat = useChatStore.getState().chats.find(c => c.id === params.id);
          if (chat) {
            setActiveChat(chat);
          } else {
            throw new Error('Chat not found');
          }
        }

        // Apply AI preference from URL if specified
        if (searchParams.ai !== undefined && activeChat) {
          const aiEnabled = searchParams.ai === 'true';
          if (aiEnabled !== activeChat.aiEnabled) {
            await useChatStore.getState().toggleAI(aiEnabled);
          }
        }
      } catch (error) {
        handleError(error instanceof Error ? error : new Error('Failed to initialize chat'));
      }
    };

    initializeChat();

    // Cleanup on unmount
    return () => {
      clearError();
      setActiveChat(null);
    };
  }, [params.id, searchParams.ai, activeChat, setActiveChat, clearError, fetchChats, handleError]);

  // Show loading state
  if (!activeChat) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onReset={() => {
        clearError();
        setRetryCount(0);
      }}
    >
      <main className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
        {/* Error display */}
        {(errorMessage || storeError) && (
          <div className="fixed top-4 right-4 z-50 p-4 bg-error-100 dark:bg-error-900 text-error-900 dark:text-error-100 rounded-md shadow-lg">
            {errorMessage || storeError}
          </div>
        )}

        {/* Chat interface */}
        <ChatPanel
          chatId={params.id}
          onBack={handleBack}
          className="flex-1 overflow-hidden"
        />
      </main>
    </ErrorBoundary>
  );
};

export default ChatPage;