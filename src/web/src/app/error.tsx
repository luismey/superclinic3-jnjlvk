'use client';

import React, { useEffect, useState } from 'react';
import { useTranslation } from 'next-intl'; // ^3.0.0
import Button from '../../components/common/Button';
import Card from '../../components/common/Card';

// Constants for retry mechanism
const RETRY_LIMIT = 3;
const RETRY_DELAY_BASE = 1000; // Base delay in milliseconds

// Interface for error component props
interface ErrorProps {
  error: Error | undefined;
  reset: () => void;
}

/**
 * Sanitizes error message for safe display
 * Prevents potential XSS and removes sensitive information
 */
const sanitizeErrorMessage = (error: Error | undefined): string => {
  if (!error?.message) return '';
  
  // Remove potential stack traces or sensitive data
  const sanitized = error.message.split('\n')[0]
    .replace(/\{.*\}/g, '') // Remove JSON objects
    .replace(/[<>]/g, '') // Remove HTML tags
    .slice(0, 150); // Limit length
    
  return sanitized || 'An unexpected error occurred';
};

/**
 * Error boundary component for Next.js application
 * Handles runtime errors with retry capability and monitoring integration
 */
const Error: React.FC<ErrorProps> = ({ error, reset }) => {
  const { t } = useTranslation();
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);

  // Log error to monitoring system on mount
  useEffect(() => {
    // Log error details for monitoring
    console.error('Application error:', {
      message: error?.message,
      stack: error?.stack,
      timestamp: new Date().toISOString(),
      url: window.location.href,
    });
  }, [error]);

  /**
   * Handles retry attempts with exponential backoff
   * Implements rate limiting and tracks retry metrics
   */
  const handleRetry = async () => {
    if (retryCount >= RETRY_LIMIT || isRetrying) return;

    setIsRetrying(true);
    
    try {
      // Implement exponential backoff
      const delay = RETRY_DELAY_BASE * Math.pow(2, retryCount);
      await new Promise(resolve => setTimeout(resolve, delay));
      
      // Track retry attempt
      setRetryCount(prev => prev + 1);
      
      // Attempt recovery
      reset();
    } finally {
      setIsRetrying(false);
    }
  };

  return (
    <div 
      role="alert"
      aria-live="assertive"
      className="min-h-screen flex items-center justify-center p-4 bg-semantic-surface"
    >
      <Card
        elevation="medium"
        borderRadius="large"
        padding="lg"
        className="max-w-md w-full"
        aria-label={t('error.card.label')}
      >
        {/* Error Icon */}
        <div className="flex justify-center mb-6">
          <svg
            className="w-16 h-16 text-error-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>

        {/* Error Title */}
        <h1 className="text-2xl font-semibold text-center mb-4 text-semantic-text-primary">
          {t('error.title')}
        </h1>

        {/* Error Message */}
        <p className="text-center mb-6 text-semantic-text-secondary">
          {sanitizeErrorMessage(error)}
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col gap-3">
          <Button
            variant="primary"
            size="lg"
            fullWidth
            onClick={handleRetry}
            disabled={retryCount >= RETRY_LIMIT || isRetrying}
            loading={isRetrying}
            aria-label={t('error.retry.label')}
            tooltip={retryCount >= RETRY_LIMIT ? t('error.retry.limit.reached') : undefined}
          >
            {t('error.retry.button')}
          </Button>

          <Button
            variant="outline"
            size="lg"
            fullWidth
            onClick={() => window.location.href = '/'}
            aria-label={t('error.home.label')}
          >
            {t('error.home.button')}
          </Button>
        </div>

        {/* Retry Status */}
        {retryCount > 0 && (
          <p 
            className="mt-4 text-sm text-center text-semantic-text-secondary"
            aria-live="polite"
          >
            {t('error.retry.count', { count: retryCount, max: RETRY_LIMIT })}
          </p>
        )}
      </Card>
    </div>
  );
};

export default Error;