'use client';

import React, { useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ErrorBoundary } from 'react-error-boundary';
import AssistantList from '../../../components/assistants/AssistantList';
import Button from '../../../components/common/Button';
import { useAssistant } from '../../../hooks/useAssistant';
import { useAnalytics } from '@/hooks/analytics';

// Error fallback component
const ErrorFallback = ({ error, resetErrorBoundary }: { error: Error, resetErrorBoundary: () => void }) => (
  <div className="p-8 text-center" role="alert">
    <h2 className="text-xl font-semibold text-error-600 mb-4">
      Something went wrong
    </h2>
    <p className="text-gray-600 mb-4">{error.message}</p>
    <Button 
      variant="primary" 
      onClick={resetErrorBoundary}
      aria-label="Try again"
    >
      Try again
    </Button>
  </div>
);

/**
 * AssistantsPage component - Main view for managing AI virtual assistants
 * Implements responsive layout, error handling, and analytics tracking
 */
const AssistantsPage: React.FC = () => {
  const router = useRouter();
  const analytics = useAnalytics();
  const { error: assistantError, refreshAssistants } = useAssistant();

  // Track page view on mount
  useEffect(() => {
    analytics.trackPageView('assistants_page');
  }, [analytics]);

  // Handle create assistant button click
  const handleCreateClick = useCallback(() => {
    analytics.trackEvent('create_assistant_click');
    router.push('/assistants/create');
  }, [router, analytics]);

  // Handle assistant errors
  const handleError = useCallback((error: Error) => {
    analytics.trackError('assistant_error', {
      message: error.message,
      location: 'AssistantsPage'
    });
    console.error('Assistant error:', error);
  }, [analytics]);

  // Handle error boundary reset
  const handleErrorReset = useCallback(() => {
    refreshAssistants(true).catch(handleError);
  }, [refreshAssistants, handleError]);

  return (
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onReset={handleErrorReset}
      onError={handleError}
    >
      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Page Header */}
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">
              Virtual Assistants
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Manage and monitor your AI virtual assistants
            </p>
          </div>
          <Button
            variant="primary"
            onClick={handleCreateClick}
            aria-label="Create new assistant"
            data-testid="create-assistant-button"
          >
            Create Assistant
          </Button>
        </header>

        {/* Error Alert */}
        {assistantError && (
          <div 
            className="bg-error-50 border border-error-200 rounded-md p-4"
            role="alert"
          >
            <p className="text-error-700">{assistantError}</p>
          </div>
        )}

        {/* Assistants Grid */}
        <main>
          <AssistantList
            className="min-h-[200px]"
            showActions={true}
            onError={handleError}
          />
        </main>
      </div>
    </ErrorBoundary>
  );
};

export default AssistantsPage;