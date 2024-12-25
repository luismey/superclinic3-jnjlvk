'use client';

import React, { useEffect } from 'react';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import cn from 'classnames';

import { AnalyticsDashboard } from '../../components/analytics/AnalyticsDashboard';
import { useAuth } from '../../hooks/useAuth';

/**
 * Loading fallback component for Suspense
 */
const DashboardSkeleton = () => (
  <div className="animate-pulse space-y-6">
    <div className="h-8 bg-gray-200 rounded w-1/4" />
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="h-32 bg-gray-200 rounded" />
      ))}
    </div>
    <div className="h-64 bg-gray-200 rounded" />
  </div>
);

/**
 * Error fallback component for ErrorBoundary
 */
const DashboardError = ({ error, resetErrorBoundary }: { 
  error: Error; 
  resetErrorBoundary: () => void;
}) => (
  <div 
    className="p-6 bg-error-50 border border-error-200 rounded-lg"
    role="alert"
  >
    <h3 className="text-lg font-semibold text-error-700 mb-2">
      Erro ao carregar dashboard
    </h3>
    <p className="text-error-600 mb-4">{error.message}</p>
    <button
      onClick={resetErrorBoundary}
      className="px-4 py-2 bg-error-100 text-error-700 rounded hover:bg-error-200 transition-colors"
    >
      Tentar novamente
    </button>
  </div>
);

/**
 * Main dashboard page component implementing authentication protection,
 * analytics display, and performance optimizations
 */
export default function DashboardPage() {
  const { user, isAuthenticated, isLoading } = useAuth();

  // Authentication check and redirect
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      redirect('/login');
    }
  }, [isAuthenticated, isLoading]);

  // Show loading state while checking authentication
  if (isLoading) {
    return <DashboardSkeleton />;
  }

  // Ensure user is authenticated
  if (!isAuthenticated || !user) {
    return null;
  }

  return (
    <main 
      className={cn(
        'dashboard-page container mx-auto px-4 py-6',
        'min-h-screen bg-semantic-background'
      )}
    >
      <ErrorBoundary
        FallbackComponent={DashboardError}
        onReset={() => window.location.reload()}
      >
        <Suspense fallback={<DashboardSkeleton />}>
          <AnalyticsDashboard
            className="dashboard-content"
            refreshInterval={30000} // 30 seconds auto-refresh
            autoRefresh={true}
          />
        </Suspense>
      </ErrorBoundary>
    </main>
  );
}