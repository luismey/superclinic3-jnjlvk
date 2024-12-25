// @ts-check
import { useEffect, useCallback, useRef } from 'react'; // v18.0.0
import { getEnvironmentConfig } from '../config/environment';
import { useChatStore } from '../store/chat';
import { MessageType, MessageStatus } from '../types/chat';

// Constants for WebSocket management
const MAX_RETRY_ATTEMPTS = 5;
const INITIAL_RETRY_DELAY = 1000;
const HEARTBEAT_INTERVAL = 30000;
const CONNECTION_TIMEOUT = 5000;

// Types for WebSocket hook
export enum ConnectionStatus {
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  DISCONNECTED = 'DISCONNECTED',
  RECONNECTING = 'RECONNECTING',
  ERROR = 'ERROR'
}

export interface WebSocketMessage {
  type: 'message' | 'status' | 'typing' | 'ping' | 'pong';
  payload?: any;
  id?: string;
  timestamp?: number;
}

interface WebSocketOptions {
  autoReconnect?: boolean;
  reconnectAttempts?: number;
  reconnectDelay?: number;
  heartbeatEnabled?: boolean;
  heartbeatInterval?: number;
  onMessage?: (message: WebSocketMessage) => void;
  onStatusChange?: (status: ConnectionStatus) => void;
  onError?: (error: Error) => void;
}

interface WebSocketControls {
  connect: () => Promise<void>;
  disconnect: () => void;
  sendMessage: (message: WebSocketMessage) => Promise<void>;
  isConnected: boolean;
  connectionStatus: ConnectionStatus;
  retryCount: number;
}

/**
 * Advanced React hook for managing WebSocket connections with enhanced reliability
 * @param chatId - Unique identifier for the chat session
 * @param options - Configuration options for WebSocket behavior
 * @returns WebSocket controls and state
 */
export function useWebSocket(
  chatId: string,
  options: WebSocketOptions = {}
): WebSocketControls {
  // Initialize refs and state
  const wsRef = useRef<WebSocket | null>(null);
  const heartbeatRef = useRef<NodeJS.Timer>();
  const reconnectTimeoutRef = useRef<NodeJS.Timer>();
  const retryCountRef = useRef(0);
  const messageQueueRef = useRef<WebSocketMessage[]>([]);

  // Get chat store methods
  const { updateChatStatus, sendMessage, queueOfflineMessage } = useChatStore();

  /**
   * Establishes WebSocket connection with enhanced reliability
   */
  const connect = useCallback(async (): Promise<void> => {
    try {
      const { wsUrl } = getEnvironmentConfig();
      const token = localStorage.getItem('auth_token');

      if (!token) {
        throw new Error('Authentication token not found');
      }

      // Close existing connection if any
      if (wsRef.current) {
        wsRef.current.close();
      }

      // Create new WebSocket connection
      wsRef.current = new WebSocket(`${wsUrl}?token=${token}&chatId=${chatId}`);
      
      // Set up connection timeout
      const connectionTimeout = setTimeout(() => {
        if (wsRef.current?.readyState !== WebSocket.OPEN) {
          wsRef.current?.close();
          throw new Error('Connection timeout');
        }
      }, CONNECTION_TIMEOUT);

      // Configure WebSocket event handlers
      wsRef.current.onopen = () => {
        clearTimeout(connectionTimeout);
        retryCountRef.current = 0;
        updateChatStatus(chatId, ConnectionStatus.CONNECTED);
        options.onStatusChange?.(ConnectionStatus.CONNECTED);
        startHeartbeat();
        processMessageQueue();
      };

      wsRef.current.onclose = () => {
        updateChatStatus(chatId, ConnectionStatus.DISCONNECTED);
        options.onStatusChange?.(ConnectionStatus.DISCONNECTED);
        handleReconnection();
      };

      wsRef.current.onerror = (error) => {
        const wsError = new Error(`WebSocket error: ${error}`);
        options.onError?.(wsError);
        handleReconnection();
      };

      wsRef.current.onmessage = handleIncomingMessage;

    } catch (error) {
      const wsError = error instanceof Error ? error : new Error('WebSocket connection failed');
      options.onError?.(wsError);
      handleReconnection();
    }
  }, [chatId, options]);

  /**
   * Handles WebSocket reconnection with exponential backoff
   */
  const handleReconnection = useCallback(() => {
    if (!options.autoReconnect || retryCountRef.current >= (options.reconnectAttempts || MAX_RETRY_ATTEMPTS)) {
      updateChatStatus(chatId, ConnectionStatus.ERROR);
      options.onStatusChange?.(ConnectionStatus.ERROR);
      return;
    }

    updateChatStatus(chatId, ConnectionStatus.RECONNECTING);
    options.onStatusChange?.(ConnectionStatus.RECONNECTING);

    const delay = Math.min(
      (options.reconnectDelay || INITIAL_RETRY_DELAY) * Math.pow(2, retryCountRef.current),
      30000
    );

    reconnectTimeoutRef.current = setTimeout(() => {
      retryCountRef.current++;
      connect();
    }, delay);
  }, [chatId, options, connect]);

  /**
   * Implements heartbeat mechanism for connection monitoring
   */
  const startHeartbeat = useCallback(() => {
    if (!options.heartbeatEnabled) return;

    heartbeatRef.current = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
      }
    }, options.heartbeatInterval || HEARTBEAT_INTERVAL);
  }, [options]);

  /**
   * Processes queued messages when connection is restored
   */
  const processMessageQueue = useCallback(async () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    while (messageQueueRef.current.length > 0) {
      const message = messageQueueRef.current.shift();
      if (message) {
        try {
          await sendMessage(message);
        } catch (error) {
          messageQueueRef.current.unshift(message);
          break;
        }
      }
    }
  }, [sendMessage]);

  /**
   * Handles incoming WebSocket messages with comprehensive error handling
   */
  const handleIncomingMessage = useCallback((event: MessageEvent) => {
    try {
      const message: WebSocketMessage = JSON.parse(event.data);

      // Handle heartbeat responses
      if (message.type === 'pong') {
        return;
      }

      // Process message based on type
      switch (message.type) {
        case 'message':
          options.onMessage?.(message);
          break;
        case 'status':
          updateChatStatus(chatId, message.payload.status);
          break;
        case 'typing':
          // Handle typing indicators
          break;
      }
    } catch (error) {
      console.error('Failed to process WebSocket message:', error);
      options.onError?.(new Error('Invalid message format'));
    }
  }, [chatId, options, updateChatStatus]);

  /**
   * Sends message through WebSocket with queuing support
   */
  const sendMessage = useCallback(async (message: WebSocketMessage): Promise<void> => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      messageQueueRef.current.push(message);
      queueOfflineMessage(chatId, message);
      return;
    }

    try {
      wsRef.current.send(JSON.stringify({
        ...message,
        timestamp: Date.now(),
        id: crypto.randomUUID()
      }));
    } catch (error) {
      messageQueueRef.current.push(message);
      throw error;
    }
  }, [chatId, queueOfflineMessage]);

  /**
   * Disconnects WebSocket and cleans up resources
   */
  const disconnect = useCallback(() => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    updateChatStatus(chatId, ConnectionStatus.DISCONNECTED);
    options.onStatusChange?.(ConnectionStatus.DISCONNECTED);
  }, [chatId, options, updateChatStatus]);

  // Set up connection and cleanup on mount/unmount
  useEffect(() => {
    connect();
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    connect,
    disconnect,
    sendMessage,
    isConnected: wsRef.current?.readyState === WebSocket.OPEN,
    connectionStatus: wsRef.current?.readyState === WebSocket.OPEN ? 
      ConnectionStatus.CONNECTED : ConnectionStatus.DISCONNECTED,
    retryCount: retryCountRef.current
  };
}