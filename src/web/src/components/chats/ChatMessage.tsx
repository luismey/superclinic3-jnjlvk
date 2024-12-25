import React from 'react'; // v18.0.0
import cn from 'classnames'; // v2.3.0
import {
  MessageSquare,
  Image as ImageIcon,
  Video,
  Mic,
  FileText,
  MapPin,
  User,
  Sticker,
  Mic2,
  Clock,
  Check,
  CheckCheck,
  Eye,
  AlertCircle,
  ExternalLink,
  RefreshCw
} from 'lucide-react'; // v0.284.0

import { Message, MessageType, MessageStatus } from '../../types/chat';
import { Avatar } from '../common/Avatar';
import { formatDate } from '../../utils/date';
import { theme } from '../../config/theme';

// Message type icons mapping with proper accessibility labels
const MESSAGE_TYPE_ICONS = {
  [MessageType.TEXT]: { icon: MessageSquare, label: 'Mensagem de texto' },
  [MessageType.IMAGE]: { icon: ImageIcon, label: 'Imagem' },
  [MessageType.VIDEO]: { icon: Video, label: 'Vídeo' },
  [MessageType.AUDIO]: { icon: Mic, label: 'Áudio' },
  [MessageType.DOCUMENT]: { icon: FileText, label: 'Documento' },
  [MessageType.LOCATION]: { icon: MapPin, label: 'Localização' },
  [MessageType.CONTACT]: { icon: User, label: 'Contato' },
  [MessageType.STICKER]: { icon: Sticker, label: 'Figurinha' },
  VOICE: { icon: Mic2, label: 'Mensagem de voz' }
} as const;

// Message status icons with accessibility labels
const MESSAGE_STATUS_ICONS = {
  [MessageStatus.PENDING]: { icon: Clock, label: 'Mensagem pendente' },
  [MessageStatus.SENT]: { icon: Check, label: 'Mensagem enviada' },
  [MessageStatus.DELIVERED]: { icon: CheckCheck, label: 'Mensagem entregue' },
  [MessageStatus.READ]: { icon: Eye, label: 'Mensagem lida' },
  [MessageStatus.FAILED]: { icon: AlertCircle, label: 'Falha no envio' }
} as const;

interface ChatMessageProps {
  message: Message;
  className?: string;
  onRetry?: (messageId: string) => void;
  onMediaLoad?: (messageId: string) => void;
}

// Helper function to get message container classes
const getMessageClasses = (message: Message): string => {
  const baseClasses = 'rounded-lg p-3 max-w-[80%] break-words';
  const alignmentClasses = message.isFromCustomer ? 'ml-auto' : 'mr-auto';
  
  const colorClasses = message.isFromCustomer
    ? `bg-primary-600 text-white ${message.error ? 'bg-opacity-75' : ''}`
    : message.isFromAssistant
    ? 'bg-accent-100 text-accent-900'
    : 'bg-secondary-100 text-secondary-900';

  return cn(
    baseClasses,
    alignmentClasses,
    colorClasses,
    'shadow-sm',
    'transition-colors duration-200'
  );
};

// Helper function to get message icon component
const getMessageIcon = (type: MessageType) => {
  const iconConfig = MESSAGE_TYPE_ICONS[type] || MESSAGE_TYPE_ICONS.TEXT;
  const IconComponent = iconConfig.icon;
  return <IconComponent size={16} aria-label={iconConfig.label} />;
};

export const ChatMessage: React.FC<ChatMessageProps> = React.memo(({
  message,
  className,
  onRetry,
  onMediaLoad
}) => {
  const messageClasses = getMessageClasses(message);
  const containerClasses = cn(
    'flex items-end gap-2 mb-4',
    message.isFromCustomer ? 'flex-row-reverse' : 'flex-row',
    className
  );

  // Handle media loading
  const handleMediaLoad = React.useCallback(() => {
    onMediaLoad?.(message.id);
  }, [message.id, onMediaLoad]);

  // Handle retry action
  const handleRetry = React.useCallback(() => {
    onRetry?.(message.id);
  }, [message.id, onRetry]);

  // Render message content based on type
  const renderContent = () => {
    switch (message.messageType) {
      case MessageType.IMAGE:
        return (
          <div className="relative">
            <img
              src={message.mediaUrl || ''}
              alt={message.content}
              className="max-w-full rounded-md"
              onLoad={handleMediaLoad}
              loading="lazy"
            />
            {message.content && (
              <p className="mt-2 text-sm">{message.content}</p>
            )}
          </div>
        );

      case MessageType.VIDEO:
      case MessageType.AUDIO:
        return (
          <div className="relative">
            <video
              src={message.mediaUrl || ''}
              controls
              className="max-w-full rounded-md"
              onLoadedData={handleMediaLoad}
            >
              <track kind="captions" />
            </video>
            {message.content && (
              <p className="mt-2 text-sm">{message.content}</p>
            )}
          </div>
        );

      case MessageType.DOCUMENT:
        return (
          <a
            href={message.mediaUrl || ''}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 hover:underline"
          >
            <FileText size={20} />
            <span>{message.content}</span>
            <ExternalLink size={16} className="ml-1" />
          </a>
        );

      default:
        return <p className="whitespace-pre-wrap">{message.content}</p>;
    }
  };

  return (
    <div className={containerClasses}>
      {message.sender && (
        <Avatar
          size="sm"
          name={message.sender.name}
          alt={`Avatar de ${message.sender.name}`}
          className="mb-1"
        />
      )}

      <div
        className={messageClasses}
        style={{
          borderRadius: theme.radii.lg,
        }}
      >
        {renderContent()}

        <div className={cn(
          'flex items-center gap-1 mt-1',
          'text-xs opacity-75',
          message.isFromCustomer ? 'justify-start' : 'justify-end'
        )}>
          {message.sentAt && (
            <time dateTime={message.sentAt.toISOString()}>
              {formatDate(message.sentAt, 'HH:mm')}
            </time>
          )}

          {!message.isFromCustomer && (
            <div className="flex items-center gap-1" aria-live="polite">
              {getMessageIcon(message.messageType)}
              {MESSAGE_STATUS_ICONS[message.status].icon && (
                <span className="sr-only">
                  {MESSAGE_STATUS_ICONS[message.status].label}
                </span>
              )}
            </div>
          )}
        </div>

        {message.error && (
          <div className="flex items-center gap-2 mt-2 text-error-600 text-sm">
            <AlertCircle size={16} />
            <span>{message.error.message}</span>
            {onRetry && (
              <button
                onClick={handleRetry}
                className="flex items-center gap-1 hover:underline focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                aria-label="Tentar novamente"
              >
                <RefreshCw size={14} />
                <span>Tentar novamente</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

ChatMessage.displayName = 'ChatMessage';

export default ChatMessage;