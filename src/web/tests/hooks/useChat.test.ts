import { describe, beforeEach, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react-hooks';
import useChat from '../../src/hooks/useChat';
import { chatService } from '../../src/services/chat';
import { useWebSocket, ConnectionStatus } from '../../src/hooks/useWebSocket';
import { MessageType, MessageStatus, ChatStatus } from '../../src/types/chat';

// Mock dependencies
vi.mock('../../src/services/chat');
vi.mock('../../src/hooks/useWebSocket');

// Test data
const mockChat = {
  id: '123',
  messages: [],
  status: ChatStatus.ACTIVE,
  aiEnabled: false,
  lastMessageAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date()
};

const mockMessage = {
  id: '456',
  content: 'Test message',
  type: MessageType.TEXT,
  status: MessageStatus.PENDING
};

describe('useChat', () => {
  // Enhanced setup with WebSocket and performance monitoring
  beforeEach(() => {
    vi.resetAllMocks();
    
    // Mock chatService methods
    vi.mocked(chatService.getChat).mockResolvedValue(mockChat);
    vi.mocked(chatService.sendMessage).mockResolvedValue(mockMessage);
    vi.mocked(chatService.toggleAI).mockResolvedValue({ ...mockChat, aiEnabled: true });

    // Mock WebSocket hook
    vi.mocked(useWebSocket).mockReturnValue({
      connect: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn(),
      sendMessage: vi.fn().mockResolvedValue(undefined),
      isConnected: true,
      connectionStatus: ConnectionStatus.CONNECTED,
      retryCount: 0
    });

    // Setup performance monitoring
    vi.spyOn(performance, 'now');
    vi.spyOn(console, 'error');
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('Initialization', () => {
    it('should initialize chat with correct configuration', async () => {
      const { result } = renderHook(() => useChat('123', { autoConnect: true }));

      await waitFor(() => {
        expect(chatService.getChat).toHaveBeenCalledWith('123');
        expect(result.current.chat).toEqual(mockChat);
        expect(result.current.loading).toBe(false);
        expect(result.current.error).toBeNull();
      });
    });

    it('should handle initialization errors gracefully', async () => {
      const error = new Error('Failed to load chat');
      vi.mocked(chatService.getChat).mockRejectedValueOnce(error);

      const { result } = renderHook(() => useChat('123'));

      await waitFor(() => {
        expect(result.current.error).toBeTruthy();
        expect(result.current.loading).toBe(false);
        expect(console.error).toHaveBeenCalledWith('Failed to initialize chat:', error);
      });
    });
  });

  describe('Real-time Messaging', () => {
    it('should send message successfully through WebSocket', async () => {
      const { result } = renderHook(() => useChat('123'));

      await act(async () => {
        await result.current.sendMessage('Hello');
      });

      expect(useWebSocket().sendMessage).toHaveBeenCalledWith({
        type: 'message',
        payload: {
          chatId: '123',
          content: 'Hello',
          type: MessageType.TEXT
        }
      });
    });

    it('should queue messages when offline', async () => {
      vi.mocked(useWebSocket).mockReturnValueOnce({
        ...useWebSocket(),
        isConnected: false
      });

      const { result } = renderHook(() => useChat('123'));

      await act(async () => {
        await result.current.sendMessage('Offline message');
      });

      expect(result.current.queuedMessages.length).toBe(1);
      expect(result.current.queuedMessages[0].content).toBe('Offline message');
    });

    it('should handle message delivery status updates', async () => {
      const { result } = renderHook(() => useChat('123'));

      const wsMessage = {
        type: 'status',
        payload: {
          messageId: '456',
          status: MessageStatus.DELIVERED
        }
      };

      await act(async () => {
        useWebSocket().onMessage?.(wsMessage);
      });

      expect(result.current.messages.find(m => m.id === '456')?.status)
        .toBe(MessageStatus.DELIVERED);
    });
  });

  describe('AI Assistant Integration', () => {
    it('should toggle AI assistant successfully', async () => {
      const { result } = renderHook(() => useChat('123'));

      await act(async () => {
        await result.current.toggleAI(true);
      });

      expect(chatService.toggleAI).toHaveBeenCalledWith('123', true);
      expect(result.current.chat?.aiEnabled).toBe(true);
    });

    it('should handle AI toggle errors', async () => {
      const error = new Error('Failed to toggle AI');
      vi.mocked(chatService.toggleAI).mockRejectedValueOnce(error);

      const { result } = renderHook(() => useChat('123'));

      await act(async () => {
        await result.current.toggleAI(true);
      });

      expect(result.current.error).toBeTruthy();
      expect(console.error).toHaveBeenCalledWith('Failed to toggle AI:', error);
    });
  });

  describe('Offline Support', () => {
    it('should retry failed messages when connection is restored', async () => {
      const { result } = renderHook(() => useChat('123'));

      // Simulate offline state
      vi.mocked(useWebSocket).mockReturnValueOnce({
        ...useWebSocket(),
        isConnected: false
      });

      await act(async () => {
        await result.current.sendMessage('Queued message');
      });

      expect(result.current.queuedMessages.length).toBe(1);

      // Simulate connection restoration
      vi.mocked(useWebSocket).mockReturnValueOnce({
        ...useWebSocket(),
        isConnected: true
      });

      await act(async () => {
        await result.current.retryFailedMessages();
      });

      expect(result.current.queuedMessages.length).toBe(0);
      expect(useWebSocket().sendMessage).toHaveBeenCalled();
    });

    it('should maintain message order during retry', async () => {
      const { result } = renderHook(() => useChat('123'));
      const messages = ['First', 'Second', 'Third'];

      // Queue multiple messages
      for (const content of messages) {
        await act(async () => {
          await result.current.sendMessage(content);
        });
      }

      const queuedContents = result.current.queuedMessages.map(m => m.content);
      expect(queuedContents).toEqual(messages);
    });
  });

  describe('Performance Monitoring', () => {
    it('should track message sending performance', async () => {
      const startTime = performance.now();
      const { result } = renderHook(() => useChat('123'));

      await act(async () => {
        await result.current.sendMessage('Performance test');
      });

      const endTime = performance.now();
      expect(endTime - startTime).toBeLessThan(500); // 500ms threshold
    });

    it('should handle high message volume efficiently', async () => {
      const { result } = renderHook(() => useChat('123'));
      const messageCount = 100;

      const startTime = performance.now();
      
      await act(async () => {
        for (let i = 0; i < messageCount; i++) {
          await result.current.sendMessage(`Message ${i}`);
        }
      });

      const endTime = performance.now();
      const averageTime = (endTime - startTime) / messageCount;
      expect(averageTime).toBeLessThan(50); // 50ms per message threshold
    });
  });

  describe('Error Handling', () => {
    it('should handle WebSocket connection failures', async () => {
      const error = new Error('WebSocket connection failed');
      vi.mocked(useWebSocket).mockReturnValueOnce({
        ...useWebSocket(),
        connect: vi.fn().mockRejectedValueOnce(error)
      });

      const { result } = renderHook(() => useChat('123'));

      await waitFor(() => {
        expect(result.current.error).toBeTruthy();
        expect(console.error).toHaveBeenCalledWith('WebSocket error:', error);
      });
    });

    it('should handle message sending failures', async () => {
      const error = new Error('Failed to send message');
      vi.mocked(useWebSocket().sendMessage).mockRejectedValueOnce(error);

      const { result } = renderHook(() => useChat('123'));

      await act(async () => {
        await result.current.sendMessage('Failed message');
      });

      expect(result.current.error).toBeTruthy();
      expect(result.current.queuedMessages.length).toBe(1);
    });

    it('should clear errors when requested', async () => {
      const { result } = renderHook(() => useChat('123'));

      await act(async () => {
        result.current.clearError();
      });

      expect(result.current.error).toBeNull();
    });
  });

  describe('Cleanup', () => {
    it('should cleanup resources on unmount', async () => {
      const { unmount } = renderHook(() => useChat('123'));

      unmount();

      expect(useWebSocket().disconnect).toHaveBeenCalled();
    });

    it('should cancel pending operations on unmount', async () => {
      const { result, unmount } = renderHook(() => useChat('123'));

      // Start an operation
      const sendPromise = act(async () => {
        await result.current.sendMessage('Pending message');
      });

      // Unmount before completion
      unmount();

      await sendPromise;

      expect(useWebSocket().disconnect).toHaveBeenCalled();
      expect(console.error).not.toHaveBeenCalled();
    });
  });
});