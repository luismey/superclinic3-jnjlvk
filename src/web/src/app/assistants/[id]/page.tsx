'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { ErrorBoundary } from 'react-error-boundary';
import * as Spinner from '@radix-ui/react-spinner';
import toast from 'react-hot-toast';
import debounce from 'lodash/debounce';

import AssistantBuilder from '../../../components/assistants/AssistantBuilder';
import { useAssistant } from '../../../hooks/useAssistant';
import type { Assistant } from '../../../types/assistant';

// Performance optimization constants
const DEBOUNCE_DELAY = 300;
const PERFORMANCE_THRESHOLD = 200;

/**
 * Page component for displaying and editing individual AI virtual assistant details
 * with WCAG 2.1 AA compliance and Brazilian Portuguese localization
 */
const AssistantPage: React.FC = () => {
  // Get assistant ID from route params
  const params = useParams();
  const assistantId = params?.id as string;

  // State management
  const [isValidating, setIsValidating] = useState(false);
  const [renderTime, setRenderTime] = useState(0);

  // Get assistant data and methods from hook
  const {
    assistants,
    loading,
    error,
    metrics,
    updateAssistant,
    refreshAssistants
  } = useAssistant();

  // Find current assistant
  const assistant = assistants.find(a => a.id === assistantId);

  // Performance monitoring
  useEffect(() => {
    const startTime = performance.now();
    return () => {
      const endTime = performance.now();
      const renderDuration = endTime - startTime;
      setRenderTime(renderDuration);
      
      if (renderDuration > PERFORMANCE_THRESHOLD) {
        console.warn(`Render time exceeded threshold: ${renderDuration.toFixed(2)}ms`);
      }
    };
  }, []);

  // Debounced validation function
  const validateAssistant = useCallback(
    debounce(async (data: Assistant) => {
      setIsValidating(true);
      try {
        // Validate WhatsApp message templates
        const hasValidTemplates = data.config.promptTemplate.length > 0;
        
        // Validate conversation flow
        const hasValidFlow = data.knowledgeBase?.intents?.length > 0;
        
        if (!hasValidTemplates || !hasValidFlow) {
          toast.error('Configuração incompleta do assistente');
          return false;
        }
        
        return true;
      } catch (error) {
        console.error('Validation error:', error);
        return false;
      } finally {
        setIsValidating(false);
      }
    }, DEBOUNCE_DELAY),
    []
  );

  // Handle assistant updates with optimistic updates
  const handleAssistantUpdate = useCallback(async (
    updatedAssistant: Assistant
  ) => {
    const isValid = await validateAssistant(updatedAssistant);
    if (!isValid) return;

    try {
      // Optimistic update
      const previousAssistants = assistants;
      
      await updateAssistant(assistantId, updatedAssistant);
      
      toast.success('Assistente atualizado com sucesso', {
        ariaProps: {
          role: 'status',
          'aria-live': 'polite',
        }
      });
      
      // Refresh data to ensure consistency
      await refreshAssistants();
      
    } catch (error) {
      toast.error('Erro ao atualizar assistente', {
        ariaProps: {
          role: 'alert',
          'aria-live': 'assertive',
        }
      });
      
      // Revert optimistic update on error
      await refreshAssistants();
    }
  }, [assistantId, assistants, updateAssistant, refreshAssistants, validateAssistant]);

  // Error boundary fallback component
  const ErrorFallback = useCallback(({ error }: { error: Error }) => (
    <div 
      role="alert"
      className="p-6 bg-error-50 border border-error-200 rounded-lg"
      aria-labelledby="error-heading"
    >
      <h2 id="error-heading" className="text-lg font-semibold text-error-700 mb-2">
        Erro ao carregar assistente
      </h2>
      <p className="text-error-600">{error.message}</p>
      <button
        onClick={() => window.location.reload()}
        className="mt-4 px-4 py-2 bg-error-100 text-error-700 rounded-md hover:bg-error-200 focus:outline-none focus:ring-2 focus:ring-error-500"
      >
        Tentar novamente
      </button>
    </div>
  ), []);

  // Loading state
  if (loading) {
    return (
      <div 
        role="status"
        className="flex items-center justify-center min-h-[400px]"
        aria-label="Carregando assistente"
      >
        <Spinner.Root className="w-8 h-8 text-primary-600 animate-spin" />
        <span className="sr-only">Carregando...</span>
      </div>
    );
  }

  // Error state
  if (error || !assistant) {
    return (
      <ErrorFallback 
        error={new Error(error || 'Assistente não encontrado')} 
      />
    );
  }

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <main
        className="container mx-auto px-4 py-6"
        aria-busy={isValidating}
      >
        <AssistantBuilder
          initialData={assistant}
          onSave={handleAssistantUpdate}
          className="min-h-[600px] bg-white rounded-lg shadow-md"
          aria-label="Editor de assistente virtual"
        />

        {/* Performance metrics for development */}
        {process.env.NODE_ENV === 'development' && (
          <div className="mt-4 text-sm text-semantic-text-secondary">
            <p>Tempo de renderização: {renderTime.toFixed(2)}ms</p>
            <p>Tempo médio de resposta: {metrics?.avgResponseTime.toFixed(2)}ms</p>
          </div>
        )}
      </main>
    </ErrorBoundary>
  );
};

export default AssistantPage;