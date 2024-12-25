'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMediaQuery } from '@react-hook/media-query'; // v1.1.1
import ChatPanel from '../../../components/chats/ChatPanel';
import ChatList from '../../../components/chats/ChatList';
import { useChat } from '../../../hooks/useChat';
import { Chat } from '../../../types/chat';

// Interface for component props
interface ChatLayoutProps {
  children: React.ReactNode;
  params: {
    id: string;
  };
}

/**
 * Layout component for chat pages implementing responsive split view
 * Handles mobile/desktop layouts and real-time chat updates
 */
const ChatLayout: React.FC<ChatLayoutProps> = ({ params }) => {
  // Initialize hooks
  const router = useRouter();
  const isMobile = useMediaQuery('(max-width: 768px)');
  const [selectedChatId, setSelectedChatId] = useState<string | null>(params.id);

  // Initialize chat hook with real-time updates
  const {
    chat: activeChat,
    messages,
    loading,
    error,
    connectionStatus,
    sendMessage,
    toggleAI,
    clearError
  } = useChat(params.id, {
    autoConnect: true,
    onMessage: (message) => {
      // Handle real-time message updates
      console.log('New message received:', message);
    }
  });

  /**
   * Handles chat selection with responsive navigation
   */
  const handleChatSelect = useCallback((chatId: string) => {
    setSelectedChatId(chatId);
    if (isMobile) {
      router.push(`/chats/${chatId}`);
    }
  }, [isMobile, router]);

  /**
   * Handles back navigation on mobile
   */
  const handleBack = useCallback(() => {
    setSelectedChatId(null);
    router.push('/chats');
  }, [router]);

  /**
   * Effect to handle mobile navigation sync
   */
  useEffect(() => {
    if (params.id) {
      setSelectedChatId(params.id);
    }
  }, [params.id]);

  /**
   * Effect to handle connection status changes
   */
  useEffect(() => {
    if (error) {
      console.error('Chat connection error:', error);
    }
  }, [error]);

  return (
    <div className="flex h-full bg-white dark:bg-gray-900">
      {/* Chat list sidebar - hidden on mobile when chat is selected */}
      <div
        className={`
          ${isMobile && selectedChatId ? 'hidden' : 'w-80 border-r border-gray-200 dark:border-gray-700'}
          flex-shrink-0 md:block
        `}
      >
        <ChatList
          chats={activeChat ? [activeChat] : []}
          selectedChatId={selectedChatId}
          onChatSelect={handleChatSelect}
        />
      </div>

      {/* Main chat panel - full width on mobile */}
      <div className="flex-1 flex flex-col min-w-0">
        {selectedChatId ? (
          <ChatPanel
            chatId={selectedChatId}
            onBack={isMobile ? handleBack : undefined}
            className="h-full"
          />
        ) : (
          // Empty state when no chat is selected
          <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
            Select a chat to start messaging
          </div>
        )}

        {/* Loading state overlay */}
        {loading && (
          <div className="absolute inset-0 bg-white/50 dark:bg-gray-900/50 flex items-center justify-center">
            <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full" />
          </div>
        )}

        {/* Error display */}
        {error && (
          <div className="p-4 bg-error-50 text-error-900 dark:bg-error-900 dark:text-error-50">
            <p>{error}</p>
            <button
              onClick={clearError}
              className="mt-2 px-4 py-2 bg-error-100 hover:bg-error-200 dark:bg-error-800 dark:hover:bg-error-700 rounded"
            >
              Retry
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatLayout;