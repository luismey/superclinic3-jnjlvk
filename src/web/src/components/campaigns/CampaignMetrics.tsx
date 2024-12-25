import React, { useEffect, useState, useCallback, useMemo } from 'react'; // ^18.0.0
import cn from 'classnames'; // ^2.3.0
import { Card } from '../common/Card';
import { Campaign } from '../../types/campaign';
import { analyticsService } from '../../services/analytics';
import { formatNumber, formatPercentage } from '../../utils/format';

// Constants
const METRIC_REFRESH_INTERVAL = 30000; // 30 seconds
const BRAZILIAN_LOCALE = 'pt-BR';

// Interfaces
interface CampaignMetricsProps {
  campaign: Campaign;
  className?: string;
  showProgress?: boolean;
  autoUpdate?: boolean;
  refreshInterval?: number;
}

interface MetricState {
  loading: boolean;
  data: Campaign | null;
  error: Error | null;
}

/**
 * Calculates the message delivery success rate
 * @param delivered - Number of delivered messages
 * @param total - Total number of messages
 * @returns Percentage of successfully delivered messages
 */
const calculateDeliveryRate = (delivered: number, total: number): number => {
  if (total <= 0 || delivered < 0) return 0;
  const rate = (delivered / total) * 100;
  return Math.min(Math.max(Number(rate.toFixed(2)), 0), 100);
};

/**
 * Formats metric values with proper localization
 * @param value - Numeric value to format
 * @param type - Type of metric for formatting
 * @returns Formatted metric string
 */
const formatMetric = (value: number, type: 'number' | 'percentage'): string => {
  try {
    if (type === 'percentage') {
      return formatPercentage(value);
    }
    return formatNumber(value);
  } catch (error) {
    console.error('Metric formatting error:', error);
    return '0';
  }
};

/**
 * CampaignMetrics component displays real-time campaign performance metrics
 * with support for automatic updates and Brazilian Portuguese localization.
 */
export const CampaignMetrics: React.FC<CampaignMetricsProps> = ({
  campaign,
  className,
  showProgress = true,
  autoUpdate = true,
  refreshInterval = METRIC_REFRESH_INTERVAL,
}) => {
  // State management
  const [metricState, setMetricState] = useState<MetricState>({
    loading: false,
    data: campaign,
    error: null,
  });

  // Memoized calculations
  const metrics = useMemo(() => {
    const data = metricState.data;
    if (!data) return null;

    const deliveryRate = calculateDeliveryRate(
      data.messagesDelivered,
      data.messagesSent
    );

    return {
      totalRecipients: formatMetric(data.totalRecipients, 'number'),
      messagesSent: formatMetric(data.messagesSent, 'number'),
      messagesDelivered: formatMetric(data.messagesDelivered, 'number'),
      messagesFailed: formatMetric(data.messagesFailed, 'number'),
      deliveryRate: formatMetric(deliveryRate, 'percentage'),
      engagementRate: formatMetric(data.engagementRate, 'percentage'),
    };
  }, [metricState.data]);

  // Fetch updated metrics
  const fetchMetrics = useCallback(async () => {
    try {
      setMetricState(prev => ({ ...prev, loading: true }));
      const updatedMetrics = await analyticsService.getMetrics({
        dateRange: {
          startDate: new Date(campaign.createdAt),
          endDate: new Date(),
        },
        metricTypes: ['MESSAGE_COUNT', 'CONVERSION_RATE'],
        organizationId: campaign.organizationId,
        granularity: 'HOUR',
        comparison: 'NONE',
      });

      setMetricState({
        loading: false,
        data: {
          ...campaign,
          messagesSent: updatedMetrics[0]?.value || campaign.messagesSent,
          messagesDelivered: updatedMetrics[1]?.value || campaign.messagesDelivered,
        },
        error: null,
      });
    } catch (error) {
      setMetricState(prev => ({
        ...prev,
        loading: false,
        error: error as Error,
      }));
    }
  }, [campaign]);

  // Auto-update effect
  useEffect(() => {
    if (!autoUpdate) return;

    const intervalId = setInterval(fetchMetrics, refreshInterval);
    return () => clearInterval(intervalId);
  }, [autoUpdate, refreshInterval, fetchMetrics]);

  if (!metrics) return null;

  return (
    <Card
      className={cn('campaign-metrics', className)}
      role="region"
      aria-label="Métricas da Campanha"
    >
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {/* Total Recipients */}
        <div className="metric-item">
          <h3 className="text-sm font-medium text-gray-500">Destinatários</h3>
          <p className="mt-1 text-2xl font-semibold text-gray-900">
            {metrics.totalRecipients}
          </p>
        </div>

        {/* Messages Sent */}
        <div className="metric-item">
          <h3 className="text-sm font-medium text-gray-500">Mensagens Enviadas</h3>
          <p className="mt-1 text-2xl font-semibold text-gray-900">
            {metrics.messagesSent}
          </p>
        </div>

        {/* Messages Delivered */}
        <div className="metric-item">
          <h3 className="text-sm font-medium text-gray-500">Mensagens Entregues</h3>
          <p className="mt-1 text-2xl font-semibold text-gray-900">
            {metrics.messagesDelivered}
          </p>
        </div>

        {/* Messages Failed */}
        <div className="metric-item">
          <h3 className="text-sm font-medium text-gray-500">Falhas de Envio</h3>
          <p className="mt-1 text-2xl font-semibold text-red-600">
            {metrics.messagesFailed}
          </p>
        </div>

        {/* Delivery Rate */}
        <div className="metric-item">
          <h3 className="text-sm font-medium text-gray-500">Taxa de Entrega</h3>
          <p className="mt-1 text-2xl font-semibold text-green-600">
            {metrics.deliveryRate}
          </p>
        </div>

        {/* Engagement Rate */}
        <div className="metric-item">
          <h3 className="text-sm font-medium text-gray-500">Taxa de Engajamento</h3>
          <p className="mt-1 text-2xl font-semibold text-blue-600">
            {metrics.engagementRate}
          </p>
        </div>
      </div>

      {/* Progress Indicator */}
      {showProgress && (
        <div className="mt-4" role="progressbar" aria-label="Progresso da Campanha">
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 transition-all duration-500"
              style={{
                width: `${calculateDeliveryRate(
                  metricState.data?.messagesDelivered || 0,
                  metricState.data?.totalRecipients || 0
                )}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Error State */}
      {metricState.error && (
        <div className="mt-4 p-2 bg-red-50 text-red-700 text-sm rounded" role="alert">
          Erro ao atualizar métricas. Tentando novamente...
        </div>
      )}

      {/* Loading State */}
      {metricState.loading && (
        <div className="absolute top-0 right-0 mt-2 mr-2">
          <div className="animate-spin h-4 w-4 border-2 border-blue-600 rounded-full border-t-transparent" />
        </div>
      )}
    </Card>
  );
};

// Default export
export default CampaignMetrics;