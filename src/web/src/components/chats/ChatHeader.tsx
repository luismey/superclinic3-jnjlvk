import React, { useCallback, useMemo, useState } from 'react';
import classNames from 'classnames'; // v2.3.2
import { useTranslation } from 'i18next'; // v21.0.0
import Button from '../common/Button';
import { Chat, ChatStatus } from '../../types/chat';
import { colors, typography, spacing } from '../../config/theme';

// Interface for component props
interface ChatHeaderProps {
  chat: Chat;
  onBack: () => void;
  onToggleAI: (enabled: boolean) => Promise<void>;
  className?: string;
  testId?: string;
}

/**
 * ChatHeader component displays customer information and controls for chat interface
 * Implements WCAG 2.1 AA compliance with enhanced accessibility features
 */
const ChatHeader: React.FC<ChatHeaderProps> = React.memo(({
  chat,
  onBack,
  onToggleAI,
  className,
  testId = 'chat-header'
}) => {
  const { t } = useTranslation();
  const [isToggling, setIsToggling] = useState(false);

  // Format customer name with phone fallback
  const displayName = useMemo(() => {
    const name = chat.customerName?.trim();
    const phone = chat.customerPhone?.replace(/^\+?(\d{2})(\d{2})(\d{5})(\d{4})$/, '+$1 ($2) $3-$4');
    return name || phone || t('chat.unknownCustomer');
  }, [chat.customerName, chat.customerPhone, t]);

  // Format chat status for display
  const statusText = useMemo(() => {
    const statusMap = {
      [ChatStatus.ACTIVE]: t('chat.status.active'),
      [ChatStatus.PENDING]: t('chat.status.pending'),
      [ChatStatus.RESOLVED]: t('chat.status.resolved'),
      [ChatStatus.ARCHIVED]: t('chat.status.archived')
    };
    return statusMap[chat.status] || t('chat.status.unknown');
  }, [chat.status, t]);

  // Handle AI assistant toggle with loading state
  const handleAIToggle = useCallback(async () => {
    if (isToggling) return;
    
    try {
      setIsToggling(true);
      await onToggleAI(!chat.aiEnabled);
      
      // Announce status change to screen readers
      const message = chat.aiEnabled ? 
        t('chat.ai.disabled') : 
        t('chat.ai.enabled');
      
      const announcement = document.createElement('div');
      announcement.setAttribute('role', 'status');
      announcement.setAttribute('aria-live', 'polite');
      announcement.className = 'sr-only';
      announcement.textContent = message;
      document.body.appendChild(announcement);
      
      setTimeout(() => announcement.remove(), 1000);
    } catch (error) {
      console.error('Failed to toggle AI:', error);
    } finally {
      setIsToggling(false);
    }
  }, [chat.aiEnabled, isToggling, onToggleAI, t]);

  // Compute container classes
  const containerClasses = classNames(
    // Base styles
    'flex items-center justify-between',
    'px-4 py-3 bg-white border-b border-gray-200',
    'dark:bg-gray-800 dark:border-gray-700',
    // Mobile responsive styles
    'sm:px-6',
    // Custom classes
    className
  );

  // Compute status indicator classes
  const statusIndicatorClasses = classNames(
    'w-2.5 h-2.5 rounded-full mr-2',
    {
      'bg-green-500': chat.status === ChatStatus.ACTIVE,
      'bg-yellow-500': chat.status === ChatStatus.PENDING,
      'bg-blue-500': chat.status === ChatStatus.RESOLVED,
      'bg-gray-500': chat.status === ChatStatus.ARCHIVED
    }
  );

  return (
    <header 
      className={containerClasses}
      data-testid={testId}
      role="banner"
    >
      {/* Left section with back button and customer info */}
      <div className="flex items-center">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="mr-3 sm:mr-4"
          aria-label={t('chat.actions.back')}
        >
          <svg 
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path 
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </Button>

        <div>
          <h1 className={classNames(
            'text-gray-900 dark:text-white',
            typography.sizes.lg,
            'font-semibold leading-6'
          )}>
            {displayName}
          </h1>
          <div className="flex items-center mt-0.5">
            <span 
              className={statusIndicatorClasses}
              aria-hidden="true"
            />
            <span className={classNames(
              'text-gray-500 dark:text-gray-400',
              typography.sizes.sm
            )}>
              {statusText}
            </span>
          </div>
        </div>
      </div>

      {/* Right section with AI toggle */}
      <div className="flex items-center">
        <Button
          variant="outline"
          size="sm"
          onClick={handleAIToggle}
          loading={isToggling}
          className="flex items-center"
          aria-pressed={chat.aiEnabled}
          aria-label={t('chat.actions.toggleAI')}
        >
          <svg
            className={classNames(
              'w-4 h-4 mr-2',
              chat.aiEnabled ? 'text-primary-600' : 'text-gray-400'
            )}
            fill="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm0-14c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6zm0 10c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4z"/>
          </svg>
          {chat.aiEnabled ? t('chat.ai.enabled') : t('chat.ai.disabled')}
        </Button>
      </div>
    </header>
  );
});

// Display name for debugging
ChatHeader.displayName = 'ChatHeader';

export default ChatHeader;