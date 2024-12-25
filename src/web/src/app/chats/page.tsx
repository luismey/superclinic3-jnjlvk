'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import ChatList from '../../components/chats/ChatList';
import ChatPanel from '../../components/chats/ChatPanel';
import { useChat } from '../../hooks/useChat';
import { Chat } from '../../types/chat';

/**
 * Main chat interface page component implementing a responsive two-column layout
 * with real-time WhatsApp messaging capabilities and AI assistant integration.
 * Implements WCAG 2.1 AA accessibility standards and performance optimizations.
 */
const ChatsPage: React.FC = () => {
  // URL and navigation management
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const selectedChatId = searchParams.get('chatId');

  // Local state
  const [isMobileView, setIsMobileView] = useState(false);
  const [showMobilePanel, setShowMobilePanel] = useState(false);

  // Initialize chat hook for selected conversation
  const {
    chat: selectedChat,
    messages,
    loading,
    error,
    connectionStatus,
    clearError
  } = useChat(selectedChatId || '', {
    autoConnect: !!selectedChatId,
    onMessage: () => {
      // Handle new message notifications
    }
  });

  /**
   * Handles chat selection with URL synchronization and mobile view transitions
   */
  const handleChatSelect = useCallback((chatId: string) => {
    // Update URL with selected chat
    const params = new URLSearchParams(searchParams);
    params.set('chatId', chatId);
    router.push(`${pathname}?${params.toString()}`);

    // Handle mobile view transitions
    if (isMobileView) {
      setShowMobilePanel(true);
    }
  }, [isMobileView, pathname, router, searchParams]);

  /**
   * Handles back navigation in mobile view
   */
  const handleBack = useCallback(() => {
    if (isMobileView) {
      setShowMobilePanel(false);
    }
    // Remove chatId from URL
    const params = new URLSearchParams(searchParams);
    params.delete('chatId');
    router.push(`${pathname}?${params.toString()}`);
  }, [isMobileView, pathname, router, searchParams]);

  /**
   * Updates mobile view state based on viewport width
   */
  useEffect(() => {
    const checkMobileView = () => {
      setIsMobileView(window.innerWidth < 768);
    };

    checkMobileView();
    window.addEventListener('resize', checkMobileView);

    return () => window.removeEventListener('resize', checkMobileView);
  }, []);

  /**
   * Updates mobile panel visibility when chat is selected
   */
  useEffect(() => {
    if (isMobileView && selectedChatId) {
      setShowMobilePanel(true);
    }
  }, [isMobileView, selectedChatId]);

  return (
    <main className="flex h-full bg-gray-50 relative">
      {/* Chat list */}
      <div
        className={`
          w-full md:w-96 border-r border-gray-200 bg-white shadow-sm
          ${isMobileView && showMobilePanel ? 'hidden' : 'block'}
        `}
      >
        <ChatList
          selectedChatId={selectedChatId}
          onChatSelect={handleChatSelect}
          isLoading={loading}
        />
      </div>

      {/* Chat panel */}
      <div
        className={`
          ${isMobileView
            ? 'fixed inset-0 z-50 bg-white transition-transform duration-200'
            : 'flex-1 hidden md:block bg-white'
          }
          ${showMobilePanel ? 'translate-x-0' : 'translate-x-full'}
        `}
      >
        {selectedChatId ? (
          <ChatPanel
            chatId={selectedChatId}
            onBack={handleBack}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500">
            Select a chat to start messaging
          </div>
        )}
      </div>

      {/* Error display */}
      {error && (
        <div 
          role="alert"
          className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 p-4 bg-error-50 text-error-900 rounded-lg shadow-lg"
        >
          <div className="flex items-center justify-between">
            <span>{error}</span>
            <button
              onClick={clearError}
              className="ml-4 text-error-700 hover:text-error-900"
              aria-label="Dismiss error"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Connection status indicator */}
      {connectionStatus !== 'CONNECTED' && selectedChatId && (
        <div className="fixed bottom-4 left-4 p-2 bg-yellow-50 text-yellow-900 rounded-md text-sm">
          {connectionStatus === 'CONNECTING' && 'Connecting...'}
          {connectionStatus === 'RECONNECTING' && 'Reconnecting...'}
          {connectionStatus === 'ERROR' && 'Connection error'}
        </div>
      )}
    </main>
  );
};

export default ChatsPage;