// @ts-check
import { create } from 'zustand'; // v4.4.0
import { devtools, persist } from 'zustand/middleware'; // v4.4.0
import { Chat, Message, MessageType, MessageStatus, ChatStatus } from '../types/chat';
import { chatService } from '../services/chat';
import { WHATSAPP_CONSTANTS } from '../config/constants';

// Types for store state and actions
interface PaginationMetadata {
  page: number;
  pageSize: number;
  total: number;
}

interface OfflineMessage {
  id: string;
  chatId: string;
  content: string;
  type: MessageType;
  timestamp: number;
  retryCount: number;
}

interface ChatState {
  // State
  chats: Chat[];
  activeChat: Chat | null;
  loading: boolean;
  error: string | null;
  pagination: PaginationMetadata;
  offlineQueue: OfflineMessage[];
  lastSyncTimestamp: number | null;
  optimisticUpdates: boolean;
  aiContext: Record<string, unknown> | null;

  // Actions
  fetchChats: (params?: Partial<PaginationMetadata>, forceRefresh?: boolean) => Promise<void>;
  setActiveChat: (chat: Chat | null) => void;
  sendMessage: (content: string, type?: MessageType) => Promise<void>;
  toggleAI: (enabled: boolean) => Promise<void>;
  syncOfflineMessages: () => Promise<void>;
  handleWebSocketEvent: (event: WebSocketEvent) => void;
  setOptimisticUpdates: (enabled: boolean) => void;
  clearError: () => void;
}

// Types for WebSocket events
interface WebSocketEvent {
  type: 'message' | 'status' | 'typing';
  payload: any;
}

// Constants
const SYNC_INTERVAL = 30000; // 30 seconds
const RETRY_ATTEMPTS = 3;
const INITIAL_STATE = {
  chats: [],
  activeChat: null,
  loading: false,
  error: null,
  pagination: {
    page: 1,
    pageSize: 20,
    total: 0
  },
  offlineQueue: [],
  lastSyncTimestamp: null,
  optimisticUpdates: true,
  aiContext: null
};

/**
 * Creates the chat store with persistence and dev tools integration
 */
export const useChatStore = create<ChatState>()(
  devtools(
    persist(
      (set, get) => ({
        ...INITIAL_STATE,

        /**
         * Fetches paginated list of chats with cache support
         */
        fetchChats: async (params = {}, forceRefresh = false) => {
          try {
            set({ loading: true, error: null });

            const response = await chatService.getChats({
              page: params.page || get().pagination.page,
              pageSize: params.pageSize || get().pagination.pageSize
            });

            set({
              chats: response.items,
              pagination: {
                page: response.page,
                pageSize: response.pageSize,
                total: response.total
              },
              loading: false
            });
          } catch (error) {
            set({ 
              error: error instanceof Error ? error.message : 'Failed to fetch chats',
              loading: false 
            });
          }
        },

        /**
         * Sets the active chat with validation
         */
        setActiveChat: (chat: Chat | null) => {
          if (chat && !get().chats.find(c => c.id === chat.id)) {
            set({ error: 'Invalid chat selection' });
            return;
          }
          set({ activeChat: chat });
        },

        /**
         * Sends message with offline support and optimistic updates
         */
        sendMessage: async (content: string, type = MessageType.TEXT) => {
          const { activeChat, optimisticUpdates } = get();
          
          if (!activeChat) {
            set({ error: 'No active chat selected' });
            return;
          }

          // Generate temporary ID for optimistic update
          const tempId = `temp_${Date.now()}`;
          
          // Create optimistic message
          const optimisticMessage: Message = {
            id: tempId,
            chatId: activeChat.id,
            content,
            messageType: type,
            status: MessageStatus.PENDING,
            isFromCustomer: false,
            isFromAssistant: false,
            metadata: {},
            assistantMetadata: {},
            createdAt: new Date(),
            updatedAt: new Date(),
            sentAt: null,
            deliveredAt: null,
            readAt: null,
            whatsappMessageId: tempId,
            senderId: null,
            sender: null
          };

          try {
            // Apply optimistic update
            if (optimisticUpdates) {
              set(state => ({
                chats: state.chats.map(chat => 
                  chat.id === activeChat.id 
                    ? { ...chat, messages: [...chat.messages, optimisticMessage] }
                    : chat
                )
              }));
            }

            // Send message
            const response = await chatService.sendMessage(activeChat.id, content, type);

            // Update with real message
            set(state => ({
              chats: state.chats.map(chat => 
                chat.id === activeChat.id 
                  ? {
                      ...chat,
                      messages: chat.messages.map(msg => 
                        msg.id === tempId ? response : msg
                      )
                    }
                  : chat
              )
            }));
          } catch (error) {
            // Handle offline case
            const offlineMessage: OfflineMessage = {
              id: tempId,
              chatId: activeChat.id,
              content,
              type,
              timestamp: Date.now(),
              retryCount: 0
            };

            set(state => ({
              offlineQueue: [...state.offlineQueue, offlineMessage],
              error: 'Message queued for offline delivery'
            }));
          }
        },

        /**
         * Toggles AI assistant for active chat
         */
        toggleAI: async (enabled: boolean) => {
          const { activeChat } = get();
          
          if (!activeChat) {
            set({ error: 'No active chat selected' });
            return;
          }

          try {
            const updatedChat = await chatService.toggleAI(activeChat.id, enabled);
            
            set(state => ({
              chats: state.chats.map(chat => 
                chat.id === activeChat.id ? updatedChat : chat
              ),
              activeChat: updatedChat
            }));
          } catch (error) {
            set({ 
              error: error instanceof Error ? error.message : 'Failed to toggle AI'
            });
          }
        },

        /**
         * Synchronizes offline messages when connection is restored
         */
        syncOfflineMessages: async () => {
          const { offlineQueue } = get();
          
          if (offlineQueue.length === 0) return;

          const sortedQueue = [...offlineQueue].sort((a, b) => a.timestamp - b.timestamp);
          const newQueue: OfflineMessage[] = [];

          for (const message of sortedQueue) {
            try {
              if (message.retryCount >= RETRY_ATTEMPTS) {
                continue;
              }

              await chatService.sendMessage(
                message.chatId,
                message.content,
                message.type
              );
            } catch (error) {
              newQueue.push({
                ...message,
                retryCount: message.retryCount + 1
              });
            }
          }

          set({
            offlineQueue: newQueue,
            lastSyncTimestamp: Date.now()
          });
        },

        /**
         * Handles incoming WebSocket events with optimistic update reconciliation
         */
        handleWebSocketEvent: (event: WebSocketEvent) => {
          switch (event.type) {
            case 'message':
              set(state => ({
                chats: state.chats.map(chat => 
                  chat.id === event.payload.chatId
                    ? {
                        ...chat,
                        messages: [...chat.messages, event.payload.message],
                        lastMessageAt: new Date()
                      }
                    : chat
                )
              }));
              break;

            case 'status':
              set(state => ({
                chats: state.chats.map(chat => 
                  chat.id === event.payload.chatId
                    ? {
                        ...chat,
                        status: event.payload.status,
                        aiEnabled: event.payload.aiEnabled
                      }
                    : chat
                )
              }));
              break;

            case 'typing':
              // Handle typing indicators
              break;
          }
        },

        /**
         * Toggles optimistic updates
         */
        setOptimisticUpdates: (enabled: boolean) => {
          set({ optimisticUpdates: enabled });
        },

        /**
         * Clears current error state
         */
        clearError: () => {
          set({ error: null });
        }
      }),
      {
        name: 'chat-store',
        partialize: (state) => ({
          chats: state.chats,
          pagination: state.pagination,
          offlineQueue: state.offlineQueue,
          lastSyncTimestamp: state.lastSyncTimestamp,
          optimisticUpdates: state.optimisticUpdates
        })
      }
    ),
    { name: 'ChatStore' }
  )
);

// Initialize WebSocket connection and sync scheduler
if (typeof window !== 'undefined') {
  // Sync offline messages periodically
  setInterval(() => {
    const state = useChatStore.getState();
    if (state.offlineQueue.length > 0) {
      state.syncOfflineMessages();
    }
  }, SYNC_INTERVAL);

  // Initialize WebSocket connection
  chatService.initializeWebSocket(localStorage.getItem('auth_token') || '');
}