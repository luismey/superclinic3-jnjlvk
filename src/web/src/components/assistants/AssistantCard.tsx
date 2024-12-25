// @version React ^18.0.0
// @version clsx ^2.0.0
// @version react-i18next ^13.0.0

import React from 'react';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import Card from '../common/Card';
import Badge from '../common/Badge';
import Tooltip from '../common/Tooltip';
import { Assistant, AssistantType } from '../../types/assistant';
import { theme } from '../../config/theme';

// Props interface for the AssistantCard component
interface AssistantCardProps {
  assistant: Assistant;
  onSelect?: (assistant: Assistant) => void;
  onEdit?: (assistant: Assistant) => void;
  onDelete?: (assistant: Assistant) => void;
  className?: string;
  isLoading?: boolean;
  testId?: string;
}

// Helper function to get localized type label
const getTypeLabel = (type: AssistantType): string => {
  const { t } = useTranslation('assistants');
  
  const typeLabels = {
    [AssistantType.CUSTOMER_SERVICE]: t('types.customerService'),
    [AssistantType.SALES]: t('types.sales'),
    [AssistantType.APPOINTMENT]: t('types.appointment'),
    [AssistantType.CUSTOM]: t('types.custom'),
  };

  return typeLabels[type] || t('types.unknown');
};

// Helper function to format response time with proper units
const formatResponseTime = (ms: number): string => {
  const { t } = useTranslation('common');
  
  if (!ms || ms < 0) return t('metrics.notAvailable');
  
  if (ms < 1000) {
    return t('metrics.milliseconds', { value: ms });
  } else if (ms < 60000) {
    return t('metrics.seconds', { value: (ms / 1000).toFixed(1) });
  }
  
  return t('metrics.minutes', { value: (ms / 60000).toFixed(1) });
};

// Memoized AssistantCard component
export const AssistantCard = React.memo<AssistantCardProps>(({
  assistant,
  onSelect,
  onEdit,
  onDelete,
  className,
  isLoading = false,
  testId,
}) => {
  const { t } = useTranslation(['assistants', 'common']);
  
  // Handle keyboard interactions for accessibility
  const handleKeyPress = (event: React.KeyboardEvent, action: () => void) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      action();
    }
  };

  // Loading skeleton state
  if (isLoading) {
    return (
      <Card
        className={clsx(
          'animate-pulse',
          'min-h-[200px]',
          className
        )}
        aria-busy="true"
        aria-label={t('loading')}
      >
        <div className="space-y-4">
          <div className="h-6 bg-gray-200 rounded w-3/4" />
          <div className="h-4 bg-gray-200 rounded w-1/2" />
          <div className="h-4 bg-gray-200 rounded w-1/4" />
        </div>
      </Card>
    );
  }

  // Status badge variant based on assistant state
  const statusVariant = assistant.isActive ? 'success' : 'secondary';
  const statusLabel = assistant.isActive 
    ? t('status.active')
    : t('status.inactive');

  return (
    <Card
      className={clsx(
        'transition-all duration-200',
        'hover:shadow-md',
        'focus-within:ring-2 focus-within:ring-primary-500',
        onSelect && 'cursor-pointer',
        className
      )}
      role="article"
      aria-label={t('assistantCard.description', { name: assistant.name })}
      data-testid={testId}
      onClick={onSelect ? () => onSelect(assistant) : undefined}
      onKeyPress={onSelect ? (e) => handleKeyPress(e, () => onSelect(assistant)) : undefined}
      tabIndex={onSelect ? 0 : undefined}
    >
      <div className="p-4 space-y-4">
        {/* Header section */}
        <div className="flex items-start justify-between">
          <div>
            <h3 className={clsx(
              'text-lg font-semibold text-gray-900',
              'truncate max-w-[200px]'
            )}>
              {assistant.name}
            </h3>
            <Tooltip content={t(`assistantTypes.${assistant.type}.description`)}>
              <span className="text-sm text-gray-600">
                {getTypeLabel(assistant.type)}
              </span>
            </Tooltip>
          </div>
          <Badge
            variant={statusVariant}
            size="sm"
            className="animate-fade-in"
            ariaLabel={t('status.label', { status: statusLabel })}
          >
            {statusLabel}
          </Badge>
        </div>

        {/* Metrics section */}
        <div className="grid grid-cols-2 gap-4">
          <Tooltip content={t('metrics.totalMessages.description')}>
            <div className="space-y-1">
              <p className="text-sm text-gray-600">
                {t('metrics.totalMessages.label')}
              </p>
              <p className="text-lg font-medium text-gray-900">
                {assistant.metrics.totalMessages.toLocaleString()}
              </p>
            </div>
          </Tooltip>
          
          <Tooltip content={t('metrics.responseTime.description')}>
            <div className="space-y-1">
              <p className="text-sm text-gray-600">
                {t('metrics.responseTime.label')}
              </p>
              <p className="text-lg font-medium text-gray-900">
                {formatResponseTime(assistant.metrics.avgResponseTime)}
              </p>
            </div>
          </Tooltip>
        </div>

        {/* Actions section */}
        {(onEdit || onDelete) && (
          <div className="flex justify-end space-x-2 pt-2 border-t border-gray-200">
            {onEdit && (
              <button
                className={clsx(
                  'text-sm text-gray-600 hover:text-primary-600',
                  'transition-colors duration-200',
                  'focus:outline-none focus:ring-2 focus:ring-primary-500 rounded'
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(assistant);
                }}
                aria-label={t('actions.edit', { name: assistant.name })}
              >
                {t('actions.edit.label')}
              </button>
            )}
            {onDelete && (
              <button
                className={clsx(
                  'text-sm text-gray-600 hover:text-error-600',
                  'transition-colors duration-200',
                  'focus:outline-none focus:ring-2 focus:ring-error-500 rounded'
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(assistant);
                }}
                aria-label={t('actions.delete', { name: assistant.name })}
              >
                {t('actions.delete.label')}
              </button>
            )}
          </div>
        )}
      </div>
    </Card>
  );
});

AssistantCard.displayName = 'AssistantCard';

export default AssistantCard;