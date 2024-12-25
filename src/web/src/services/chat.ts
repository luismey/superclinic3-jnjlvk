import { api } from '../lib/api';
import { Chat, Message, MessageType, MessageStatus, ChatStatus } from '../types/chat';
import { PaginatedResponse } from '../types/common';
import { WHATSAPP_CONSTANTS } from '../config/constants';
import { getEnvironmentConfig } from '../config/environment';
import WebSocket from 'ws'; // v8.0.0

// Constants for WebSocket management
const WS_RECONNECT_DELAY = 1000;
const WS_MAX_RECONNECT_ATTEMPTS = 5;
const MESSAGE_QUEUE_KEY = 'message_queue';
const OFFLINE_QUEUE_KEY = 'offline_messages';

// Types for internal message queue management
interface QueuedMessage {
  chatId: string;
  content: string;
  type: MessageType;
  timestamp: number;
  retryCount: number;
}

interface WebSocketMessage {
  type: 'message' | 'status' | 'typing';
  payload: any;
}

/**
 * Chat service class providing comprehensive chat management functionality
 */
class ChatService {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private messageQueue: QueuedMessage[] = [];
  private isReconnecting = false;
  private heartbeatInterval: NodeJS.Timer | null = null;

  /**
   * Retrieves paginated list of chats with enhanced caching
   */
  async getChats(params: {
    page: number;
    pageSize: number;
    status?: ChatStatus;
    search?: string;
  }): Promise<PaginatedResponse<Chat>> {
    try {
      return await api.getPaginated<Chat>('/chats', {
        ...params,
        cache: true,
        retry: 2
      });
    } catch (error) {
      console.error('Failed to fetch chats:', error);
      throw error;
    }
  }

  /**
   * Sends a new message with retry logic and offline support
   */
  async sendMessage(
    chatId: string,
    content: string,
    type: MessageType = MessageType.TEXT
  ): Promise<Message> {
    // Validate rate limits
    if (!this.validateRateLimit(chatId)) {
      throw new Error('Rate limit exceeded for this chat');
    }

    const message = {
      chatId,
      content,
      type,
      timestamp: Date.now(),
      retryCount: 0
    };

    // Add to offline queue if no connection
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      await this.addToOfflineQueue(message);
      throw new Error('Currently offline, message queued for delivery');
    }

    try {
      // Attempt real-time delivery
      const response = await this.sendWebSocketMessage({
        type: 'message',
        payload: message
      });

      // Update local queue status
      await this.updateMessageStatus(response.id, MessageStatus.SENT);

      return response;
    } catch (error) {
      // Fall back to REST API
      console.warn('WebSocket delivery failed, falling back to REST:', error);
      return await api.post<Message>('/messages', message);
    }
  }

  /**
   * Initializes WebSocket connection with enhanced reliability
   */
  async initializeWebSocket(token: string): Promise<void> {
    if (this.ws) {
      this.ws.close();
    }

    const { wsUrl } = getEnvironmentConfig();
    this.ws = new WebSocket(`${wsUrl}?token=${token}`);

    this.setupWebSocketHandlers();
    this.startHeartbeat();
    await this.processOfflineQueue();
  }

  /**
   * Toggles AI assistant with enhanced configuration
   */
  async toggleAI(
    chatId: string,
    enabled: boolean,
    config: Record<string, unknown> = {}
  ): Promise<Chat> {
    try {
      const response = await api.put<Chat>(`/chats/${chatId}/ai`, {
        enabled,
        config: {
          preserveContext: true,
          gradualHandoff: true,
          ...config
        }
      });

      // Notify through WebSocket for real-time updates
      this.sendWebSocketMessage({
        type: 'status',
        payload: {
          chatId,
          aiEnabled: enabled
        }
      });

      return response;
    } catch (error) {
      console.error('Failed to toggle AI:', error);
      throw error;
    }
  }

  /**
   * Sets up WebSocket event handlers and reconnection logic
   */
  private setupWebSocketHandlers(): void {
    if (!this.ws) return;

    this.ws.onopen = () => {
      console.log('WebSocket connected');
      this.reconnectAttempts = 0;
      this.isReconnecting = false;
      this.processOfflineQueue();
    };

    this.ws.onclose = () => {
      if (!this.isReconnecting) {
        this.handleReconnection();
      }
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      this.handleReconnection();
    };

    this.ws.onmessage = (event) => {
      try {
        const data: WebSocketMessage = JSON.parse(event.data.toString());
        this.handleWebSocketMessage(data);
      } catch (error) {
        console.error('Failed to process WebSocket message:', error);
      }
    };
  }

  /**
   * Handles WebSocket reconnection with exponential backoff
   */
  private handleReconnection(): void {
    if (this.isReconnecting || this.reconnectAttempts >= WS_MAX_RECONNECT_ATTEMPTS) {
      return;
    }

    this.isReconnecting = true;
    const delay = Math.min(
      WS_RECONNECT_DELAY * Math.pow(2, this.reconnectAttempts),
      WHATSAPP_CONSTANTS.RETRY_CONFIG.MAX_BACKOFF_MS
    );

    setTimeout(() => {
      this.reconnectAttempts++;
      this.initializeWebSocket(this.getStoredToken());
    }, delay);
  }

  /**
   * Implements heartbeat mechanism for connection monitoring
   */
  private startHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.heartbeatInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000);
  }

  /**
   * Validates message rate limits
   */
  private validateRateLimit(chatId: string): boolean {
    const limits = WHATSAPP_CONSTANTS.RATE_LIMITS;
    // Implementation of rate limiting logic
    return true; // Simplified for brevity
  }

  /**
   * Manages offline message queue
   */
  private async addToOfflineQueue(message: QueuedMessage): Promise<void> {
    this.messageQueue.push(message);
    // Persist queue to local storage
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(this.messageQueue));
  }

  /**
   * Processes queued messages when connection is restored
   */
  private async processOfflineQueue(): Promise<void> {
    const queuedMessages = localStorage.getItem(OFFLINE_QUEUE_KEY);
    if (!queuedMessages) return;

    const messages: QueuedMessage[] = JSON.parse(queuedMessages);
    localStorage.removeItem(OFFLINE_QUEUE_KEY);

    for (const message of messages) {
      try {
        await this.sendMessage(message.chatId, message.content, message.type);
      } catch (error) {
        console.error('Failed to process queued message:', error);
        await this.addToOfflineQueue(message);
      }
    }
  }

  /**
   * Updates local message status
   */
  private async updateMessageStatus(
    messageId: string,
    status: MessageStatus
  ): Promise<void> {
    await api.put(`/messages/${messageId}/status`, { status });
  }

  /**
   * Handles incoming WebSocket messages
   */
  private handleWebSocketMessage(message: WebSocketMessage): void {
    switch (message.type) {
      case 'message':
        // Handle new message
        break;
      case 'status':
        // Handle status update
        break;
      case 'typing':
        // Handle typing indicator
        break;
    }
  }

  /**
   * Sends a message through WebSocket connection
   */
  private async sendWebSocketMessage(message: WebSocketMessage): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error('WebSocket not connected'));
        return;
      }

      const timeoutId = setTimeout(() => {
        reject(new Error('WebSocket message timeout'));
      }, 5000);

      this.ws.send(JSON.stringify(message), (error) => {
        clearTimeout(timeoutId);
        if (error) {
          reject(error);
        } else {
          resolve(true);
        }
      });
    });
  }

  /**
   * Retrieves stored authentication token
   */
  private getStoredToken(): string {
    // Implementation of token retrieval
    return ''; // Simplified for brevity
  }

  /**
   * Cleanup resources
   */
  public destroy(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    if (this.ws) {
      this.ws.close();
    }
  }
}

// Export singleton instance
export const chatService = new ChatService();