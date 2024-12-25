import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'; // v18.0.0
import { useQuery, useQueryClient } from '@tanstack/react-query'; // v4.0.0
import { useVirtualizer } from '@tanstack/react-virtual'; // v3.0.0
import clsx from 'clsx'; // v2.0.0
import Fuse from 'fuse.js'; // v6.6.2
import { useDebounce } from 'use-debounce'; // v9.0.0

import { Chat, ChatStatus } from '../../types/chat';
import { Badge } from '../common/Badge';
import { useChat } from '../../hooks/useChat';

// Constants for component configuration
const SEARCH_DEBOUNCE_MS = 300;
const MAX_PREVIEW_LENGTH = 50;
const VIRTUALIZATION_CONFIG = {
  itemSize: 72, // Height of each chat item in pixels
  overscan: 5, // Number of items to render outside viewport
};

const FUZZY_SEARCH_OPTIONS = {
  keys: ['customerName', 'customerPhone'],
  threshold: 0.3,
  distance: 100,
};

interface ChatListProps {
  chats: Chat[];
  selectedChatId: string | null;
  onChatSelect: (chatId: string) => void;
  className?: string;
}

/**
 * ChatList Component
 * 
 * A virtualized list of WhatsApp chats with real-time updates, search, and filtering capabilities.
 * Implements optimized rendering for large lists and accessibility features.
 */
export const ChatList: React.FC<ChatListProps> = ({
  chats,
  selectedChatId,
  onChatSelect,
  className,
}) => {
  // State management
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<ChatStatus | null>(null);
  const [filteredChats, setFilteredChats] = useState<Chat[]>(chats);
  const [debouncedSearch] = useDebounce(searchQuery, SEARCH_DEBOUNCE_MS);

  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const searchIndexRef = useRef<Fuse<Chat> | null>(null);

  // Initialize virtualizer for optimized rendering
  const virtualizer = useVirtualizer({
    count: filteredChats.length,
    getScrollElement: () => containerRef.current,
    estimateSize: () => VIRTUALIZATION_CONFIG.itemSize,
    overscan: VIRTUALIZATION_CONFIG.overscan,
  });

  // Initialize search index
  useEffect(() => {
    searchIndexRef.current = new Fuse(chats, FUZZY_SEARCH_OPTIONS);
  }, [chats]);

  /**
   * Returns appropriate badge variant and animation based on chat status
   */
  const getStatusBadgeVariant = useCallback((status: ChatStatus): {
    variant: string;
    animation?: string;
  } => {
    switch (status) {
      case ChatStatus.ACTIVE:
        return { variant: 'success', animation: 'pulse' };
      case ChatStatus.PENDING:
        return { variant: 'warning', animation: 'bounce' };
      case ChatStatus.RESOLVED:
        return { variant: 'primary' };
      case ChatStatus.ARCHIVED:
        return { variant: 'secondary' };
      default:
        return { variant: 'info' };
    }
  }, []);

  /**
   * Handles search with fuzzy matching and debouncing
   */
  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  /**
   * Filters chats based on search query and status
   */
  useEffect(() => {
    let result = chats;

    // Apply search filter
    if (debouncedSearch && searchIndexRef.current) {
      const searchResults = searchIndexRef.current.search(debouncedSearch);
      result = searchResults.map(({ item }) => item);
    }

    // Apply status filter
    if (statusFilter) {
      result = result.filter(chat => chat.status === statusFilter);
    }

    // Sort by last message timestamp
    result = result.sort((a, b) => 
      b.lastMessageAt.getTime() - a.lastMessageAt.getTime()
    );

    setFilteredChats(result);
  }, [chats, debouncedSearch, statusFilter]);

  /**
   * Formats chat preview text with truncation
   */
  const formatPreviewText = useCallback((chat: Chat): string => {
    const lastMessage = chat.messages[chat.messages.length - 1];
    if (!lastMessage) return '';

    const preview = lastMessage.content;
    return preview.length > MAX_PREVIEW_LENGTH
      ? `${preview.substring(0, MAX_PREVIEW_LENGTH)}...`
      : preview;
  }, []);

  /**
   * Renders individual chat item with optimizations
   */
  const renderChatItem = useCallback((chat: Chat, index: number) => {
    const statusBadge = getStatusBadgeVariant(chat.status);
    const isSelected = chat.id === selectedChatId;
    const previewText = formatPreviewText(chat);

    return (
      <div
        role="button"
        tabIndex={0}
        className={clsx(
          'flex items-center p-4 border-b cursor-pointer transition-colors',
          'hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500',
          isSelected && 'bg-primary-50',
        )}
        onClick={() => onChatSelect(chat.id)}
        onKeyPress={(e) => e.key === 'Enter' && onChatSelect(chat.id)}
        aria-selected={isSelected}
        data-testid={`chat-item-${chat.id}`}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-900 truncate">
              {chat.customerName}
            </h3>
            <span className="text-xs text-gray-500">
              {new Date(chat.lastMessageAt).toLocaleTimeString()}
            </span>
          </div>
          <div className="flex items-center mt-1">
            <Badge
              variant={statusBadge.variant}
              animation={statusBadge.animation}
              size="sm"
            >
              {chat.status}
            </Badge>
            <p className="ml-2 text-sm text-gray-500 truncate">
              {previewText}
            </p>
            {chat.unreadCount > 0 && (
              <span className="ml-auto inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-primary-100 bg-primary-600 rounded-full">
                {chat.unreadCount}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }, [selectedChatId, onChatSelect, getStatusBadgeVariant, formatPreviewText]);

  return (
    <div className={clsx('flex flex-col h-full', className)}>
      {/* Search and Filter Bar */}
      <div className="p-4 border-b">
        <input
          type="search"
          placeholder="Search chats..."
          className="w-full px-3 py-2 border rounded-md"
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
          aria-label="Search chats"
        />
        <div className="flex gap-2 mt-2">
          {Object.values(ChatStatus).map((status) => (
            <button
              key={status}
              className={clsx(
                'px-2 py-1 text-xs rounded-md transition-colors',
                statusFilter === status
                  ? 'bg-primary-100 text-primary-700'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              )}
              onClick={() => setStatusFilter(status === statusFilter ? null : status)}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Virtualized Chat List */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto"
        role="list"
        aria-label="Chat list"
      >
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {virtualizer.getVirtualItems().map((virtualItem) => (
            <div
              key={filteredChats[virtualItem.index].id}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualItem.size}px`,
                transform: `translateY(${virtualItem.start}px)`,
              }}
            >
              {renderChatItem(filteredChats[virtualItem.index], virtualItem.index)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ChatList;