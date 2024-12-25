// @version React ^18.0.0
// @version @tanstack/react-virtual ^3.0.0
// @version next/router ^14.0.0
// @version next-i18next ^14.0.0

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { useTranslation } from 'next-i18next';
import { useVirtualizer } from '@tanstack/react-virtual';
import AssistantCard from './AssistantCard';
import { Assistant } from '../../types/assistant';
import { useAssistant } from '../../hooks/useAssistant';
import { theme } from '../../config/theme';

// Constants for grid layout and virtualization
const GRID_GAP = parseInt(theme.spacing[4]);
const MIN_CARD_WIDTH = 320;
const CARD_ASPECT_RATIO = 0.75;

interface AssistantListProps {
  className?: string;
  showActions?: boolean;
  pageSize?: number;
  onAssistantChange?: (assistants: Assistant[]) => void;
}

/**
 * A responsive grid of AI virtual assistants with virtualization support
 * Implements real-time updates, error handling, and accessibility features
 */
export const AssistantList: React.FC<AssistantListProps> = React.memo(({
  className = '',
  showActions = true,
  pageSize = 20,
  onAssistantChange
}) => {
  const { t } = useTranslation(['assistants', 'common']);
  const router = useRouter();
  
  // Container ref for virtualization calculations
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Local state for grid layout
  const [columnCount, setColumnCount] = useState(1);
  const [rowCount, setRowCount] = useState(1);
  
  // Get assistants data and methods from hook
  const {
    assistants,
    loading,
    error,
    deleteAssistant,
    refreshAssistants
  } = useAssistant();

  // Calculate grid dimensions based on container width
  useEffect(() => {
    if (!containerRef.current) return;

    const calculateGrid = () => {
      const containerWidth = containerRef.current?.offsetWidth || 0;
      const columns = Math.max(1, Math.floor(containerWidth / (MIN_CARD_WIDTH + GRID_GAP)));
      const rows = Math.ceil(assistants.length / columns);
      
      setColumnCount(columns);
      setRowCount(rows);
    };

    calculateGrid();

    const resizeObserver = new ResizeObserver(calculateGrid);
    resizeObserver.observe(containerRef.current);

    return () => resizeObserver.disconnect();
  }, [assistants.length]);

  // Setup virtualization
  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => containerRef.current,
    estimateSize: useCallback(() => MIN_CARD_WIDTH * CARD_ASPECT_RATIO + GRID_GAP, []),
    overscan: 2
  });

  // Memoized grid items for current view
  const virtualRows = useMemo(() => {
    return virtualizer.getVirtualItems().map(virtualRow => {
      const rowStartIndex = virtualRow.index * columnCount;
      const rowAssistants = assistants.slice(rowStartIndex, rowStartIndex + columnCount);
      
      return {
        index: virtualRow.index,
        start: virtualRow.start,
        assistants: rowAssistants
      };
    });
  }, [virtualizer.getVirtualItems(), assistants, columnCount]);

  // Navigation handlers
  const handleSelect = useCallback(async (assistantId: string) => {
    try {
      await router.push(`/assistants/${assistantId}`);
    } catch (error) {
      console.error('Navigation error:', error);
    }
  }, [router]);

  const handleEdit = useCallback(async (assistantId: string) => {
    try {
      await router.push(`/assistants/${assistantId}/edit`);
    } catch (error) {
      console.error('Navigation error:', error);
    }
  }, [router]);

  // Delete handler with confirmation
  const handleDelete = useCallback(async (assistantId: string) => {
    if (!window.confirm(t('confirmations.delete'))) return;

    try {
      await deleteAssistant(assistantId);
      await refreshAssistants(true);
      onAssistantChange?.(assistants.filter(a => a.id !== assistantId));
    } catch (error) {
      console.error('Delete error:', error);
    }
  }, [deleteAssistant, refreshAssistants, onAssistantChange, assistants, t]);

  // Error state
  if (error) {
    return (
      <div className="p-4 text-center text-error-600" role="alert">
        <p>{t('errors.loadFailed')}</p>
        <button 
          onClick={() => refreshAssistants(true)}
          className="mt-2 text-primary-600 hover:underline focus:outline-none focus:ring-2"
        >
          {t('actions.retry')}
        </button>
      </div>
    );
  }

  // Empty state
  if (!loading && assistants.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500" role="status">
        <p>{t('states.noAssistants')}</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`relative w-full overflow-auto ${className}`}
      style={{ height: virtualizer.getTotalSize() }}
      role="grid"
      aria-busy={loading}
      aria-label={t('assistantList.label')}
    >
      {virtualRows.map(virtualRow => (
        <div
          key={virtualRow.index}
          className="absolute top-0 left-0 w-full"
          style={{
            transform: `translateY(${virtualRow.start}px)`,
            display: 'grid',
            gridTemplateColumns: `repeat(${columnCount}, minmax(${MIN_CARD_WIDTH}px, 1fr))`,
            gap: GRID_GAP,
            padding: GRID_GAP
          }}
        >
          {virtualRow.assistants.map(assistant => (
            <AssistantCard
              key={assistant.id}
              assistant={assistant}
              onSelect={() => handleSelect(assistant.id)}
              onEdit={showActions ? () => handleEdit(assistant.id) : undefined}
              onDelete={showActions ? () => handleDelete(assistant.id) : undefined}
              isLoading={loading}
              testId={`assistant-card-${assistant.id}`}
            />
          ))}
        </div>
      ))}
    </div>
  );
});

AssistantList.displayName = 'AssistantList';

export default AssistantList;