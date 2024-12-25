import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import classNames from 'classnames';
import { ErrorBoundary } from 'react-error-boundary';

// Internal imports
import FlowCanvas from './FlowCanvas';
import AssistantForm from './AssistantForm';
import { useAssistant } from '../../hooks/useAssistant';
import { Assistant, AssistantConfig } from '../../types/assistant';
import { theme } from '../../config/theme';

// Component interfaces
interface AssistantBuilderProps {
  className?: string;
  initialData?: AssistantConfig;
  onSave?: (assistant: AssistantConfig) => Promise<void>;
}

/**
 * AssistantBuilder component for creating and configuring AI virtual assistants
 * with visual flow builder and form-based configuration.
 */
const AssistantBuilder = React.memo<AssistantBuilderProps>(({
  className,
  initialData,
  onSave
}) => {
  // Hooks
  const { t } = useTranslation('assistants');
  const { assistantId } = useParams<{ assistantId: string }>();
  const { 
    createAssistant, 
    updateAssistant, 
    loading, 
    error 
  } = useAssistant();

  // Local state
  const [activeTab, setActiveTab] = useState<'flow' | 'config'>('flow');
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Memoized styles
  const styles = useMemo(() => ({
    container: classNames(
      'flex',
      'flex-col',
      'h-full',
      'min-h-[600px]',
      'bg-semantic-background',
      'rounded-lg',
      'shadow-md',
      'overflow-hidden',
      className
    ),
    header: classNames(
      'flex',
      'items-center',
      'justify-between',
      'px-6',
      'py-4',
      'border-b',
      'border-semantic-border'
    ),
    tabs: classNames(
      'flex',
      'space-x-4',
      'border-b',
      'border-semantic-border',
      'px-6'
    ),
    tab: (isActive: boolean) => classNames(
      'px-4',
      'py-2',
      'text-sm',
      'font-medium',
      'focus:outline-none',
      'focus:ring-2',
      'focus:ring-primary-500',
      'rounded-t-md',
      {
        'text-primary-600 border-b-2 border-primary-600': isActive,
        'text-semantic-text-secondary hover:text-semantic-text-primary': !isActive
      }
    ),
    content: classNames(
      'flex-1',
      'p-6',
      'overflow-auto'
    ),
    errorMessage: classNames(
      'text-sm',
      'text-error-500',
      'mt-2',
      'animate-fadeIn'
    )
  }), [className]);

  // Handle validation errors from flow builder
  const handleValidationError = useCallback((errors: string[]) => {
    setValidationErrors(errors);
  }, []);

  // Handle form submission
  const handleSubmit = useCallback(async (data: AssistantConfig) => {
    if (validationErrors.length > 0) return;

    setIsSaving(true);
    try {
      if (assistantId) {
        await updateAssistant(assistantId, { config: data });
      } else {
        await createAssistant({
          name: data.name,
          type: data.type,
          config: data,
          isActive: true
        } as Assistant);
      }
      onSave?.(data);
    } catch (error) {
      console.error('Error saving assistant:', error);
    } finally {
      setIsSaving(false);
    }
  }, [assistantId, updateAssistant, createAssistant, onSave, validationErrors]);

  // Error fallback component
  const ErrorFallback = useCallback(({ error }: { error: Error }) => (
    <div 
      role="alert" 
      className="p-6 text-error-500"
      aria-label={t('errors.builderError')}
    >
      <h2 className="text-lg font-semibold mb-2">
        {t('errors.errorOccurred')}
      </h2>
      <p className="text-sm">{error.message}</p>
    </div>
  ), [t]);

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <div className={styles.container}>
        {/* Header */}
        <header className={styles.header}>
          <h1 className="text-xl font-semibold text-semantic-text-primary">
            {assistantId ? t('editAssistant') : t('createAssistant')}
          </h1>
        </header>

        {/* Tabs */}
        <nav className={styles.tabs} role="tablist">
          <button
            role="tab"
            aria-selected={activeTab === 'flow'}
            aria-controls="flow-panel"
            className={styles.tab(activeTab === 'flow')}
            onClick={() => setActiveTab('flow')}
          >
            {t('tabs.flowBuilder')}
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'config'}
            aria-controls="config-panel"
            className={styles.tab(activeTab === 'config')}
            onClick={() => setActiveTab('config')}
          >
            {t('tabs.configuration')}
          </button>
        </nav>

        {/* Content */}
        <div className={styles.content}>
          {/* Flow Builder Panel */}
          <div
            id="flow-panel"
            role="tabpanel"
            aria-labelledby="flow-tab"
            hidden={activeTab !== 'flow'}
          >
            <FlowCanvas
              assistantId={assistantId}
              readOnly={loading || isSaving}
              onValidationError={handleValidationError}
              autoSave
              aria-label={t('flowBuilder.canvas')}
            />
          </div>

          {/* Configuration Panel */}
          <div
            id="config-panel"
            role="tabpanel"
            aria-labelledby="config-tab"
            hidden={activeTab !== 'config'}
          >
            <AssistantForm
              initialValues={initialData}
              onSubmit={handleSubmit}
              isLoading={loading || isSaving}
              locale="pt-BR"
              timezone="America/Sao_Paulo"
            />
          </div>
        </div>

        {/* Error Messages */}
        {(error || validationErrors.length > 0) && (
          <div 
            className="px-6 py-4 border-t border-semantic-border"
            role="alert"
            aria-live="polite"
          >
            {error && (
              <p className={styles.errorMessage}>{error}</p>
            )}
            {validationErrors.map((error, index) => (
              <p key={index} className={styles.errorMessage}>{error}</p>
            ))}
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
});

AssistantBuilder.displayName = 'AssistantBuilder';

export default AssistantBuilder;