import React from 'react'; // v18.0.0
import classNames from 'classnames'; // v2.3.0
import { twMerge } from 'tailwind-merge'; // v3.0.0
import { Message, MessageType, MessageStatus } from '../../types/chat';

// Text direction type for RTL support
type TextDirection = 'ltr' | 'rtl';

// Component props interface with comprehensive type support
interface ChatBubbleProps {
  message: Message;
  isCurrentUser: boolean;
  className?: string;
  dir?: TextDirection;
}

// Helper function to generate bubble styles based on message properties
const getBubbleStyles = (
  isCurrentUser: boolean,
  message: Message,
  dir: TextDirection
): string => {
  const baseStyles = 'rounded-lg px-4 py-2 max-w-[80%] break-words shadow-sm';
  const accessibilityStyles = 'focus:outline-none focus:ring-2 focus:ring-offset-2';
  
  // Determine alignment and direction styles
  const alignmentStyles = classNames({
    'ml-auto': isCurrentUser && dir === 'ltr',
    'mr-auto': !isCurrentUser && dir === 'ltr',
    'mr-auto': isCurrentUser && dir === 'rtl',
    'ml-auto': !isCurrentUser && dir === 'rtl',
  });

  // Base color scheme based on sender
  const colorStyles = classNames({
    'bg-primary-600 text-white': isCurrentUser && !message.isFromAssistant,
    'bg-gray-100 text-gray-900': !isCurrentUser && !message.isFromAssistant,
    'bg-purple-100 text-purple-900': message.isFromAssistant,
  });

  // Special styles for different message types
  const messageTypeStyles = classNames({
    'font-mono': message.messageType === MessageType.DOCUMENT,
    'italic': message.messageType === MessageType.AUDIO,
    'font-medium': message.messageType === MessageType.LOCATION,
  });

  // Status indicator styles
  const statusStyles = classNames({
    'relative after:absolute after:bottom-0 after:right-0': true,
    'after:w-2 after:h-2 after:rounded-full': true,
    'after:bg-green-500': message.status === MessageStatus.DELIVERED,
    'after:bg-blue-500': message.status === MessageStatus.READ,
    'after:bg-yellow-500': message.status === MessageStatus.SENT,
    'after:bg-red-500': message.status === MessageStatus.FAILED,
    'after:animate-pulse': message.status === MessageStatus.PENDING,
  });

  // AI assistant specific styles
  const assistantStyles = message.isFromAssistant ? 'border-l-4 border-purple-500' : '';

  return twMerge(
    baseStyles,
    alignmentStyles,
    colorStyles,
    messageTypeStyles,
    statusStyles,
    assistantStyles,
    accessibilityStyles
  );
};

// Memoized ChatBubble component for performance optimization
const ChatBubble: React.FC<ChatBubbleProps> = React.memo(({
  message,
  isCurrentUser,
  className,
  dir = 'ltr'
}) => {
  // Generate combined styles for the bubble
  const bubbleStyles = getBubbleStyles(isCurrentUser, message, dir);
  
  return (
    <div
      className={twMerge(
        'mb-2 animate-fade-in',
        isCurrentUser ? 'flex justify-end' : 'flex justify-start',
        className
      )}
      dir={dir}
    >
      <div
        className={bubbleStyles}
        role="article"
        aria-label={`Message from ${message.isFromAssistant ? 'AI Assistant' : isCurrentUser ? 'you' : 'customer'}`}
        tabIndex={0}
      >
        {/* Render different message types appropriately */}
        {message.messageType === MessageType.TEXT && (
          <p className="whitespace-pre-wrap">{message.content}</p>
        )}
        
        {message.messageType === MessageType.IMAGE && (
          <div className="relative">
            <img
              src={message.content}
              alt={message.metadata.altText as string || 'Shared image'}
              className="rounded max-w-full h-auto"
              loading="lazy"
            />
          </div>
        )}
        
        {message.messageType === MessageType.DOCUMENT && (
          <div className="flex items-center">
            <span className="material-icons mr-2">description</span>
            <span className="underline">{message.content}</span>
          </div>
        )}
        
        {message.messageType === MessageType.LOCATION && (
          <div className="flex items-center">
            <span className="material-icons mr-2">location_on</span>
            <span>{message.content}</span>
          </div>
        )}

        {/* Metadata display for debugging (development only) */}
        {process.env.NODE_ENV === 'development' && (
          <div className="text-xs opacity-50 mt-1">
            {message.whatsappMessageId.slice(-6)}
          </div>
        )}
      </div>
    </div>
  );
});

// Display name for debugging
ChatBubble.displayName = 'ChatBubble';

export default ChatBubble;