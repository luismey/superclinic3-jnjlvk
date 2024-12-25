import React, { useCallback, useEffect, useRef, useState } from 'react';
import cn from 'classnames';
import { ErrorBoundary } from 'react-error-boundary';
import ChatHeader from './ChatHeader';
import ChatInput from './ChatInput';
import { useChat } from '../../hooks/useChat';
import { Message, MessageType } from '../../types/chat';
import { useVirtualizer } from '@tanstack/react-virtual'; // v3.0.0

// Constants for virtualization and auto-scroll
const VIRTUALIZATION_OPTIONS = {
  overscan: 5,
  estimateSize: () => 80,
  paddingStart: 16,
  paddingEnd: 16
};

const AUTO_SCROLL_THRESHOLD = 100;
const MESSAGE_GROUP_TIMEOUT = 60000; // 1 minute

interface ChatPanelProps {
  chatId: string;
  onBack: () => void;
  className?: string;
  initialMessages?: Message[];
}

/**
 * Main chat interface component with virtualization and real-time updates
 * Implements WCAG 2.1 AA compliance and performance optimizations
 */
const ChatPanel: React.FC<ChatPanelProps> = React.memo(({
  chatId,
  onBack,
  className,
  initialMessages = []
}) => {
  // Refs for scroll management
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastMessageRef = useRef<string | null>(null);
  const autoScrollRef = useRef(true);

  // Local state
  const [aiToggleLoading, setAiToggleLoading] = useState(false);

  // Initialize chat hook with real-time updates
  const {
    chat,
    messages,
    loading,
    error,
    connectionStatus,
    sendMessage,
    toggleAI,
    clearError
  } = useChat(chatId, {
    initialMessages,
    autoConnect: true,
    onMessage: handleNewMessage
  });

  // Initialize virtualizer for message list
  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => scrollRef.current,
    ...VIRTUALIZATION_OPTIONS
  });

  /**
   * Handles new incoming messages with auto-scroll
   */
  function handleNewMessage(message: Message) {
    if (message.id === lastMessageRef.current) return;
    lastMessageRef.current = message.id;

    if (autoScrollRef.current) {
      requestAnimationFrame(() => {
        virtualizer.scrollToIndex(messages.length - 1, {
          behavior: 'smooth',
          align: 'end'
        });
      });
    }
  }

  /**
   * Handles scroll events for auto-scroll management
   */
  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;

    const { scrollHeight, scrollTop, clientHeight } = scrollRef.current;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    
    autoScrollRef.current = distanceFromBottom <= AUTO_SCROLL_THRESHOLD;
  }, []);

  /**
   * Handles AI assistant toggle with loading state
   */
  const handleAiToggle = useCallback(async (enabled: boolean) => {
    try {
      setAiToggleLoading(true);
      await toggleAI(enabled);
    } catch (error) {
      console.error('Failed to toggle AI:', error);
    } finally {
      setAiToggleLoading(false);
    }
  }, [toggleAI]);

  /**
   * Groups messages by sender and time for better visualization
   */
  const groupedMessages = React.useMemo(() => {
    return messages.reduce((groups: Message[][], message) => {
      const lastGroup = groups[groups.length - 1];
      
      if (!lastGroup) {
        return [[message]];
      }

      const lastMessage = lastGroup[lastGroup.length - 1];
      const timeDiff = message.createdAt.getTime() - lastMessage.createdAt.getTime();
      
      if (
        lastMessage.senderId === message.senderId && 
        timeDiff < MESSAGE_GROUP_TIMEOUT
      ) {
        lastGroup.push(message);
        return groups;
      }

      return [...groups, [message]];
    }, []);
  }, [messages]);

  // Set up scroll event listener
  useEffect(() => {
    const scrollElement = scrollRef.current;
    if (!scrollElement) return;

    scrollElement.addEventListener('scroll', handleScroll);
    return () => scrollElement.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  // Error fallback component
  const ErrorFallback = ({ error, resetErrorBoundary }: any) => (
    <div className="p-4 bg-error-50 text-error-900 dark:bg-error-900 dark:text-error-50">
      <h3 className="font-semibold mb-2">Something went wrong:</h3>
      <p className="mb-4">{error.message}</p>
      <button
        onClick={resetErrorBoundary}
        className="px-4 py-2 bg-error-100 hover:bg-error-200 dark:bg-error-800 dark:hover:bg-error-700 rounded"
      >
        Try again
      </button>
    </div>
  );

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback} onReset={clearError}>
      <div 
        ref={containerRef}
        className={cn(
          'flex flex-col h-full bg-white dark:bg-gray-900 transition-colors',
          className
        )}
      >
        {/* Chat header */}
        <ChatHeader
          chat={chat!}
          onBack={onBack}
          onToggleAI={handleAiToggle}
          loading={aiToggleLoading}
        />

        {/* Virtualized message list */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth"
          role="log"
          aria-live="polite"
          aria-atomic="false"
        >
          <div
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative'
            }}
          >
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const messageGroup = groupedMessages[virtualRow.index];
              return (
                <div
                  key={virtualRow.key}
                  data-index={virtualRow.index}
                  ref={virtualizer.measureElement}
                  className={cn(
                    'absolute top-0 left-0 w-full',
                    'transform transition-transform'
                  )}
                  style={{
                    transform: `translateY(${virtualRow.start}px)`
                  }}
                >
                  {messageGroup.map((message, i) => (
                    <div
                      key={message.id}
                      className={cn(
                        'flex flex-col',
                        message.isFromCustomer ? 'items-start' : 'items-end',
                        i > 0 && 'mt-1'
                      )}
                    >
                      <div
                        className={cn(
                          'max-w-[75%] rounded-lg p-3',
                          message.isFromCustomer
                            ? 'bg-gray-100 dark:bg-gray-800'
                            : 'bg-primary-500 text-white',
                          message.isFromAssistant && 'bg-accent-500'
                        )}
                      >
                        {message.content}
                      </div>
                      {i === messageGroup.length - 1 && (
                        <span className="text-xs text-gray-500 mt-1">
                          {new Date(message.createdAt).toLocaleTimeString()}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>

        {/* Loading overlay */}
        {loading && (
          <div className="absolute inset-0 bg-white/50 dark:bg-gray-900/50 flex items-center justify-center">
            <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full" />
          </div>
        )}

        {/* Error display */}
        {error && (
          <div className="p-4 bg-error-50 text-error-900 dark:bg-error-900 dark:text-error-50">
            {error}
          </div>
        )}

        {/* Chat input */}
        <ChatInput
          chatId={chatId}
          disabled={loading || !chat}
          aiEnabled={chat?.aiEnabled}
          onSend={sendMessage}
          className="border-t border-gray-200 dark:border-gray-700"
        />
      </div>
    </ErrorBoundary>
  );
});

ChatPanel.displayName = 'ChatPanel';

export default ChatPanel;