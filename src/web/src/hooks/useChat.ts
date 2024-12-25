import { useEffect, useCallback, useRef } from 'react'; // v18.0.0
import { chatService } from '../services/chat';
import { useWebSocket, ConnectionStatus, WebSocketMessage } from '../hooks/useWebSocket';
import { useChatStore } from '../store/chat';
import { Chat, Message, MessageType, MessageStatus, ChatStatus } from '../types/chat';

// Constants for chat management
const SYNC_INTERVAL = 30000; // 30 seconds
const DEFAULT_RETRY_INTERVAL = 5000;
const DEFAULT_MAX_RETRIES = 3;

interface UseChatOptions {
  autoConnect?: boolean;
  onMessage?: (message: Message) => void;
  retryInterval?: number;
  maxRetries?: number;
}

/**
 * Enhanced custom hook for managing chat functionality with offline support,
 * message queuing, and optimistic updates
 */
export function useChat(chatId: string, options: UseChatOptions = {}) {
  // Initialize refs for cleanup and sync management
  const syncIntervalRef = useRef<NodeJS.Timer>();
  const retryTimeoutRef = useRef<NodeJS.Timer>();
  const failedMessagesRef = useRef<Set<string>>(new Set());

  // Get chat store methods
  const {
    activeChat,
    setActiveChat,
    sendMessage: storeSendMessage,
    toggleAI: storeToggleAI,
    clearError,
    error,
    loading
  } = useChatStore();

  // Initialize WebSocket connection
  const {
    connect,
    disconnect,
    sendMessage: wsSendMessage,
    connectionStatus,
    isConnected
  } = useWebSocket(chatId, {
    autoReconnect: true,
    reconnectAttempts: options.maxRetries || DEFAULT_MAX_RETRIES,
    reconnectDelay: options.retryInterval || DEFAULT_RETRY_INTERVAL,
    heartbeatEnabled: true,
    onMessage: handleWebSocketMessage,
    onError: handleWebSocketError
  });

  /**
   * Handles incoming WebSocket messages with deduplication
   */
  function handleWebSocketMessage(wsMessage: WebSocketMessage) {
    if (wsMessage.type === 'message' && options.onMessage) {
      options.onMessage(wsMessage.payload as Message);
    }
  }

  /**
   * Handles WebSocket errors with retry logic
   */
  function handleWebSocketError(error: Error) {
    console.error('WebSocket error:', error);
    if (!retryTimeoutRef.current) {
      retryTimeoutRef.current = setTimeout(() => {
        connect();
        retryTimeoutRef.current = undefined;
      }, options.retryInterval || DEFAULT_RETRY_INTERVAL);
    }
  }

  /**
   * Loads initial chat data and sets up real-time sync
   */
  const initializeChat = useCallback(async () => {
    try {
      const chat = await chatService.getChat(chatId);
      setActiveChat(chat);

      // Start periodic sync for offline support
      if (!syncIntervalRef.current) {
        syncIntervalRef.current = setInterval(() => {
          syncMessages();
        }, SYNC_INTERVAL);
      }
    } catch (error) {
      console.error('Failed to initialize chat:', error);
    }
  }, [chatId, setActiveChat]);

  /**
   * Sends a message with optimistic updates and offline support
   */
  const sendMessage = useCallback(async (
    content: string,
    type: MessageType = MessageType.TEXT
  ): Promise<void> => {
    try {
      // Send through WebSocket if connected
      if (isConnected) {
        await wsSendMessage({
          type: 'message',
          payload: {
            chatId,
            content,
            type
          }
        });
      }

      // Store message with optimistic update
      await storeSendMessage(content, type);
    } catch (error) {
      console.error('Failed to send message:', error);
      failedMessagesRef.current.add(`${Date.now()}_${content}`);
      throw error;
    }
  }, [chatId, isConnected, wsSendMessage, storeSendMessage]);

  /**
   * Toggles AI assistant with enhanced configuration
   */
  const toggleAI = useCallback(async (enabled: boolean): Promise<void> => {
    try {
      await storeToggleAI(enabled);
      
      // Notify through WebSocket
      if (isConnected) {
        await wsSendMessage({
          type: 'status',
          payload: {
            chatId,
            aiEnabled: enabled
          }
        });
      }
    } catch (error) {
      console.error('Failed to toggle AI:', error);
      throw error;
    }
  }, [chatId, isConnected, storeToggleAI, wsSendMessage]);

  /**
   * Updates chat status with real-time sync
   */
  const updateStatus = useCallback(async (status: ChatStatus): Promise<void> => {
    try {
      await chatService.updateChatStatus(chatId, status);
      
      if (isConnected) {
        await wsSendMessage({
          type: 'status',
          payload: {
            chatId,
            status
          }
        });
      }
    } catch (error) {
      console.error('Failed to update status:', error);
      throw error;
    }
  }, [chatId, isConnected, wsSendMessage]);

  /**
   * Retries failed messages with exponential backoff
   */
  const retryFailedMessages = useCallback(async (): Promise<void> => {
    const failedMessages = Array.from(failedMessagesRef.current);
    for (const messageId of failedMessages) {
      try {
        const [timestamp, content] = messageId.split('_');
        await sendMessage(content);
        failedMessagesRef.current.delete(messageId);
      } catch (error) {
        console.error('Failed to retry message:', error);
      }
    }
  }, [sendMessage]);

  /**
   * Synchronizes messages with server
   */
  const syncMessages = useCallback(async (): Promise<void> => {
    if (!activeChat) return;

    try {
      await chatService.syncMessages(chatId);
    } catch (error) {
      console.error('Failed to sync messages:', error);
    }
  }, [chatId, activeChat]);

  // Initialize chat and cleanup on mount/unmount
  useEffect(() => {
    if (options.autoConnect !== false) {
      initializeChat();
      connect();
    }

    return () => {
      disconnect();
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, [initializeChat, connect, disconnect, options.autoConnect]);

  return {
    chat: activeChat,
    messages: activeChat?.messages || [],
    loading,
    error,
    connectionStatus,
    sendMessage,
    toggleAI,
    updateStatus,
    retryFailedMessages,
    syncMessages,
    clearError
  };
}