import React from 'react'; // v18.0.0
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'; // v14.0.0
import { vi, describe, it, beforeEach, afterEach } from 'vitest'; // v0.34.0
import userEvent from '@testing-library/user-event'; // v14.0.0

import ChatBubble from '../../src/components/chats/ChatBubble';
import ChatMessage from '../../src/components/chats/ChatMessage';
import ChatPanel from '../../src/components/chats/ChatPanel';
import { Message, MessageType, MessageStatus, ChatStatus } from '../../src/types/chat';

// Mock dependencies
vi.mock('../../src/hooks/useChat', () => ({
  useChat: () => ({
    chat: mockChat,
    messages: [mockMessage],
    loading: false,
    error: null,
    connectionStatus: 'CONNECTED',
    sendMessage: vi.fn(),
    toggleAI: vi.fn(),
    clearError: vi.fn()
  })
}));

// Test utilities
const createMockMessage = (overrides?: Partial<Message>): Message => ({
  id: 'msg_123',
  chatId: 'chat_123',
  whatsappMessageId: 'wa_123',
  messageType: MessageType.TEXT,
  content: 'Test message',
  metadata: {},
  status: MessageStatus.SENT,
  isFromCustomer: false,
  isFromAssistant: false,
  assistantMetadata: {},
  sender: null,
  senderId: null,
  sentAt: new Date(),
  deliveredAt: null,
  readAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides
});

const mockChat = {
  id: 'chat_123',
  organizationId: 'org_123',
  assignedUserId: 'user_123',
  whatsappChatId: 'wa_chat_123',
  customerPhone: '+5511999999999',
  customerName: 'John Doe',
  customerMetadata: {},
  status: ChatStatus.ACTIVE,
  aiEnabled: false,
  aiConfig: {},
  lastMessageAt: new Date(),
  messages: [createMockMessage()],
  assignedUser: null,
  tags: [],
  createdAt: new Date(),
  updatedAt: new Date()
};

const mockMessage = createMockMessage();

// Custom render function with providers
const renderWithProviders = (ui: React.ReactElement) => {
  return render(ui);
};

describe('ChatBubble', () => {
  it('renders user message correctly', () => {
    const message = createMockMessage({ isFromCustomer: false });
    render(<ChatBubble message={message} isCurrentUser={true} />);
    
    expect(screen.getByRole('article')).toHaveClass('ml-auto');
    expect(screen.getByText(message.content)).toBeInTheDocument();
  });

  it('renders customer message correctly', () => {
    const message = createMockMessage({ isFromCustomer: true });
    render(<ChatBubble message={message} isCurrentUser={false} />);
    
    expect(screen.getByRole('article')).toHaveClass('mr-auto');
    expect(screen.getByText(message.content)).toBeInTheDocument();
  });

  it('renders AI assistant message with correct styling', () => {
    const message = createMockMessage({ isFromAssistant: true });
    render(<ChatBubble message={message} isCurrentUser={false} />);
    
    const bubble = screen.getByRole('article');
    expect(bubble).toHaveClass('bg-purple-100');
    expect(bubble).toHaveClass('border-l-4');
  });

  it('handles different message types appropriately', () => {
    const imageMessage = createMockMessage({
      messageType: MessageType.IMAGE,
      content: 'https://example.com/image.jpg',
      metadata: { altText: 'Test image' }
    });

    render(<ChatBubble message={imageMessage} isCurrentUser={false} />);
    const image = screen.getByAltText('Test image');
    expect(image).toBeInTheDocument();
    expect(image).toHaveAttribute('src', imageMessage.content);
  });
});

describe('ChatMessage', () => {
  const onRetry = vi.fn();
  const onMediaLoad = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders text message with correct metadata', () => {
    const message = createMockMessage({
      content: 'Hello world',
      sentAt: new Date('2023-01-01T12:00:00Z')
    });

    render(
      <ChatMessage 
        message={message}
        onRetry={onRetry}
        onMediaLoad={onMediaLoad}
      />
    );

    expect(screen.getByText('Hello world')).toBeInTheDocument();
    expect(screen.getByText('12:00')).toBeInTheDocument();
  });

  it('handles message retry on failure', async () => {
    const failedMessage = createMockMessage({
      status: MessageStatus.FAILED,
      error: { message: 'Failed to send' }
    });

    render(
      <ChatMessage
        message={failedMessage}
        onRetry={onRetry}
        onMediaLoad={onMediaLoad}
      />
    );

    const retryButton = screen.getByRole('button', { name: /retry/i });
    await userEvent.click(retryButton);
    
    expect(onRetry).toHaveBeenCalledWith(failedMessage.id);
  });

  it('handles media loading events', async () => {
    const imageMessage = createMockMessage({
      messageType: MessageType.IMAGE,
      mediaUrl: 'https://example.com/image.jpg'
    });

    render(
      <ChatMessage
        message={imageMessage}
        onRetry={onRetry}
        onMediaLoad={onMediaLoad}
      />
    );

    const image = screen.getByRole('img');
    fireEvent.load(image);
    
    expect(onMediaLoad).toHaveBeenCalledWith(imageMessage.id);
  });
});

describe('ChatPanel', () => {
  const onBack = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders chat interface with messages', () => {
    render(
      <ChatPanel
        chatId="chat_123"
        onBack={onBack}
        initialMessages={[mockMessage]}
      />
    );

    expect(screen.getByRole('log')).toBeInTheDocument();
    expect(screen.getByText(mockMessage.content)).toBeInTheDocument();
  });

  it('handles message sending', async () => {
    const { container } = render(
      <ChatPanel
        chatId="chat_123"
        onBack={onBack}
      />
    );

    const input = container.querySelector('input[type="text"]');
    const sendButton = screen.getByRole('button', { name: /send/i });

    await userEvent.type(input!, 'New message');
    await userEvent.click(sendButton);

    await waitFor(() => {
      expect(input).toHaveValue('');
    });
  });

  it('handles AI assistant toggle', async () => {
    render(
      <ChatPanel
        chatId="chat_123"
        onBack={onBack}
      />
    );

    const toggleButton = screen.getByRole('button', { name: /ai/i });
    await userEvent.click(toggleButton);

    await waitFor(() => {
      expect(toggleButton).toHaveAttribute('aria-pressed', 'true');
    });
  });

  it('handles back navigation', async () => {
    render(
      <ChatPanel
        chatId="chat_123"
        onBack={onBack}
      />
    );

    const backButton = screen.getByRole('button', { name: /back/i });
    await userEvent.click(backButton);

    expect(onBack).toHaveBeenCalled();
  });

  it('displays loading state appropriately', () => {
    vi.mocked(useChat).mockImplementation(() => ({
      ...vi.mocked(useChat)(),
      loading: true
    }));

    render(
      <ChatPanel
        chatId="chat_123"
        onBack={onBack}
      />
    );

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('handles error states correctly', () => {
    vi.mocked(useChat).mockImplementation(() => ({
      ...vi.mocked(useChat)(),
      error: 'Failed to load chat'
    }));

    render(
      <ChatPanel
        chatId="chat_123"
        onBack={onBack}
      />
    );

    expect(screen.getByText('Failed to load chat')).toBeInTheDocument();
  });
});