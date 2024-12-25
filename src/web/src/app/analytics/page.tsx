'use client';

import React, { useCallback, useEffect } from 'react';
import { type Metadata } from 'next';
import { useAnalytics } from '@/hooks/useAnalytics';
import AnalyticsDashboard from '@/components/analytics/AnalyticsDashboard';
import { MetricType, TimeGranularity, ComparisonType } from '@/types/analytics';
import { formatDate } from '@/utils/date';

// Metadata generation for SEO and social sharing
export const generateMetadata = (): Metadata => {
  return {
    title: 'Painel Analítico | Porfin',
    description: 'Visualize e analise suas métricas de desempenho e insights de automação do WhatsApp',
    openGraph: {
      title: 'Painel Analítico | Porfin',
      description: 'Análise de desempenho e métricas de automação do WhatsApp',
      locale: 'pt-BR',
      type: 'website',
    },
    robots: {
      index: true,
      follow: true,
    },
    viewport: 'width=device-width, initial-scale=1',
    themeColor: '#2563eb',
    alternates: {
      canonical: '/analytics',
    },
  };
};

// Default refresh interval for real-time updates (30 seconds)
const REFRESH_INTERVAL = 30000;

// Default metrics to display
const DEFAULT_METRICS = [
  MetricType.RESPONSE_TIME,
  MetricType.MESSAGE_COUNT,
  MetricType.CONVERSION_RATE,
  MetricType.ACTIVE_USERS,
];

/**
 * Analytics page component with real-time updates and comprehensive metrics display
 */
const AnalyticsPage: React.FC = () => {
  const {
    metrics,
    dashboardData,
    loading,
    error,
    fetchDashboard,
    setRefreshInterval,
    exportAnalytics,
  } = useAnalytics();

  // Initialize real-time updates
  useEffect(() => {
    setRefreshInterval(REFRESH_INTERVAL);

    return () => {
      setRefreshInterval(null);
    };
  }, [setRefreshInterval]);

  // Handle time range changes
  const handleTimeRangeChange = useCallback((dateRange) => {
    const filter = {
      dateRange,
      metricTypes: DEFAULT_METRICS,
      granularity: TimeGranularity.DAY,
      comparison: ComparisonType.PREVIOUS_PERIOD,
    };

    fetchDashboard(filter);
  }, [fetchDashboard]);

  // Handle metric toggling
  const handleMetricToggle = useCallback((selectedMetrics: MetricType[]) => {
    const filter = {
      dateRange: {
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        endDate: new Date(),
      },
      metricTypes: selectedMetrics,
      granularity: TimeGranularity.DAY,
      comparison: ComparisonType.PREVIOUS_PERIOD,
    };

    fetchDashboard(filter);
  }, [fetchDashboard]);

  // Handle data export
  const handleExportData = useCallback(async (format: 'csv' | 'xlsx' | 'json') => {
    try {
      await exportAnalytics({
        dateRange: {
          startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          endDate: new Date(),
        },
        metricTypes: DEFAULT_METRICS,
        granularity: TimeGranularity.DAY,
        comparison: ComparisonType.PREVIOUS_PERIOD,
      }, format);
    } catch (error) {
      console.error('Export failed:', error);
    }
  }, [exportAnalytics]);

  return (
    <main
      className="flex flex-col w-full min-h-screen bg-white dark:bg-gray-900"
      role="main"
      aria-label="Painel Analítico"
      lang="pt-BR"
    >
      {/* Error Boundary wrapper for dashboard component */}
      <div className="flex-1 p-4 md:p-6 lg:p-8 space-y-6">
        <h1 className="text-2xl font-semibold text-semantic-text-primary mb-6">
          Painel Analítico
        </h1>

        <AnalyticsDashboard
          className="w-full"
          refreshInterval={REFRESH_INTERVAL}
          autoRefresh={true}
          onTimeRangeChange={handleTimeRangeChange}
          onMetricToggle={handleMetricToggle}
          onExportData={handleExportData}
        />

        {/* Loading state */}
        {loading && (
          <div
            className="fixed inset-0 bg-white/50 dark:bg-gray-900/50 flex items-center justify-center"
            role="status"
            aria-live="polite"
          >
            <div className="text-primary-600">Carregando dados...</div>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div
            className="fixed bottom-4 right-4 bg-error-50 border border-error-200 p-4 rounded-lg shadow-lg"
            role="alert"
          >
            <p className="text-error-700">Erro ao carregar dados: {error}</p>
            <button
              onClick={() => fetchDashboard()}
              className="mt-2 text-error-600 hover:text-error-700 underline"
            >
              Tentar novamente
            </button>
          </div>
        )}
      </div>
    </main>
  );
};

export default AnalyticsPage;