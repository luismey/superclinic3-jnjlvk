import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { MockedFunction } from 'jest-mock';
import WebSocket from 'ws';
import { chatService } from '../../src/services/chat';
import { api } from '../../src/lib/api';
import { Chat, ChatStatus, Message, MessageType, MessageStatus } from '../../src/types/chat';
import { WHATSAPP_CONSTANTS } from '../../src/config/constants';

// Mock external dependencies
jest.mock('ws');
jest.mock('../../src/lib/api');
jest.mock('../../src/config/environment');

describe('chatService', () => {
  // Test constants
  const TEST_TIMEOUT = 5000;
  const MOCK_CHAT_ID = '123e4567-e89b-12d3-a456-426614174000';
  const MOCK_USER_ID = '123e4567-e89b-12d3-a456-426614174001';

  // Mock data
  const mockChat: Chat = {
    id: MOCK_CHAT_ID,
    organizationId: '123e4567-e89b-12d3-a456-426614174002',
    assignedUserId: MOCK_USER_ID,
    whatsappChatId: 'whatsapp-123',
    customerPhone: '+5511999999999',
    customerName: 'Test Customer',
    customerMetadata: {},
    status: ChatStatus.ACTIVE,
    aiEnabled: false,
    aiConfig: {},
    lastMessageAt: new Date(),
    messages: [],
    assignedUser: null,
    tags: [],
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const mockMessage: Message = {
    id: '123e4567-e89b-12d3-a456-426614174003',
    chatId: MOCK_CHAT_ID,
    senderId: MOCK_USER_ID,
    whatsappMessageId: 'whatsapp-msg-123',
    messageType: MessageType.TEXT,
    content: 'Test message',
    metadata: {},
    status: MessageStatus.PENDING,
    isFromCustomer: false,
    isFromAssistant: false,
    assistantMetadata: {},
    sender: null,
    sentAt: null,
    deliveredAt: null,
    readAt: null,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  // Setup and teardown
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    chatService.destroy();
  });

  describe('Chat Management', () => {
    it('should fetch chats with pagination', async () => {
      const mockResponse = {
        items: [mockChat],
        total: 1,
        page: 1,
        pageSize: 20,
        totalPages: 1
      };

      (api.getPaginated as jest.Mock).mockResolvedValueOnce(mockResponse);

      const result = await chatService.getChats({
        page: 1,
        pageSize: 20,
        status: ChatStatus.ACTIVE
      });

      expect(result).toEqual(mockResponse);
      expect(api.getPaginated).toHaveBeenCalledWith('/chats', {
        page: 1,
        pageSize: 20,
        status: ChatStatus.ACTIVE,
        cache: true,
        retry: 2
      });
    });

    it('should handle chat fetch errors gracefully', async () => {
      const mockError = new Error('Network error');
      (api.getPaginated as jest.Mock).mockRejectedValueOnce(mockError);

      await expect(chatService.getChats({
        page: 1,
        pageSize: 20
      })).rejects.toThrow('Network error');
    });
  });

  describe('Message Management', () => {
    it('should send message with retry logic', async () => {
      const mockResponse = { ...mockMessage, status: MessageStatus.SENT };
      (api.post as jest.Mock).mockResolvedValueOnce(mockResponse);

      const result = await chatService.sendMessage(
        MOCK_CHAT_ID,
        'Test message',
        MessageType.TEXT
      );

      expect(result).toEqual(mockResponse);
      expect(api.post).toHaveBeenCalledWith('/messages', expect.any(Object));
    });

    it('should handle rate limiting for messages', async () => {
      const messages = Array(parseInt(WHATSAPP_CONSTANTS.RATE_LIMITS.BURST_LIMIT) + 1)
        .fill(null)
        .map(() => chatService.sendMessage(MOCK_CHAT_ID, 'Test message'));

      await expect(Promise.all(messages)).rejects.toThrow('Rate limit exceeded');
    });

    it('should queue messages when offline', async () => {
      // Simulate offline state
      (WebSocket as jest.Mock).mockImplementationOnce(() => {
        throw new Error('Network error');
      });

      await expect(
        chatService.sendMessage(MOCK_CHAT_ID, 'Offline message')
      ).rejects.toThrow('Currently offline');

      // Verify message was queued
      const queuedMessages = localStorage.getItem('offline_messages');
      expect(queuedMessages).toBeTruthy();
    });
  });

  describe('WebSocket Integration', () => {
    let mockWs: any;

    beforeEach(() => {
      mockWs = {
        send: jest.fn(),
        close: jest.fn(),
        onopen: null,
        onclose: null,
        onerror: null,
        onmessage: null,
        readyState: WebSocket.OPEN
      };
      (WebSocket as jest.Mock).mockImplementation(() => mockWs);
    });

    it('should initialize WebSocket connection', async () => {
      await chatService.initializeWebSocket('mock-token');
      expect(WebSocket).toHaveBeenCalledWith(expect.stringContaining('mock-token'));
    });

    it('should handle WebSocket reconnection', async () => {
      await chatService.initializeWebSocket('mock-token');
      mockWs.onclose();

      // Wait for reconnection attempt
      await new Promise(resolve => setTimeout(resolve, WHATSAPP_CONSTANTS.RETRY_CONFIG.BACKOFF_MS));
      expect(WebSocket).toHaveBeenCalledTimes(2);
    });

    it('should process queued messages after reconnection', async () => {
      // Queue an offline message
      localStorage.setItem('offline_messages', JSON.stringify([{
        chatId: MOCK_CHAT_ID,
        content: 'Queued message',
        type: MessageType.TEXT,
        timestamp: Date.now()
      }]));

      await chatService.initializeWebSocket('mock-token');
      mockWs.onopen();

      // Verify queued message was processed
      expect(mockWs.send).toHaveBeenCalled();
    });
  });

  describe('AI Integration', () => {
    it('should toggle AI assistant with configuration', async () => {
      const mockResponse = { ...mockChat, aiEnabled: true };
      (api.put as jest.Mock).mockResolvedValueOnce(mockResponse);

      const result = await chatService.toggleAI(MOCK_CHAT_ID, true, {
        preserveContext: true
      });

      expect(result).toEqual(mockResponse);
      expect(api.put).toHaveBeenCalledWith(
        `/chats/${MOCK_CHAT_ID}/ai`,
        expect.objectContaining({
          enabled: true,
          config: expect.objectContaining({
            preserveContext: true,
            gradualHandoff: true
          })
        })
      );
    });

    it('should handle AI toggle errors', async () => {
      const mockError = new Error('AI service unavailable');
      (api.put as jest.Mock).mockRejectedValueOnce(mockError);

      await expect(
        chatService.toggleAI(MOCK_CHAT_ID, true)
      ).rejects.toThrow('AI service unavailable');
    });
  });

  describe('Error Handling', () => {
    it('should handle WebSocket connection errors', async () => {
      const mockError = new Error('Connection failed');
      (WebSocket as jest.Mock).mockImplementationOnce(() => {
        throw mockError;
      });

      await expect(
        chatService.initializeWebSocket('mock-token')
      ).rejects.toThrow('Connection failed');
    });

    it('should handle message send timeouts', async () => {
      jest.useFakeTimers();
      mockWs.send.mockImplementation(() => new Promise(() => {}));

      const sendPromise = chatService.sendMessage(MOCK_CHAT_ID, 'Test message');
      jest.advanceTimersByTime(5000);

      await expect(sendPromise).rejects.toThrow('WebSocket message timeout');
      jest.useRealTimers();
    });
  });
});