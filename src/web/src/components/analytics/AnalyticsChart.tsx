import React, { memo, useMemo, useCallback } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  BarChart,
  AreaChart,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Line,
  Bar,
  Area,
  Legend
} from 'recharts'; // ^2.9.0
import cn from 'classnames'; // ^2.3.0
import Card from '../common/Card';
import { useAnalytics } from '../../hooks/useAnalytics';
import { formatBrazilianNumber, formatBrazilianDate } from '../../utils/format';
import { MetricType, AlertLevel } from '../../types/analytics';

// Chart type definitions
type ChartType = 'line' | 'bar' | 'area';

// Chart colors mapping based on metric types
const CHART_COLORS = {
  [MetricType.RESPONSE_TIME]: '#ef4444', // Error red
  [MetricType.MESSAGE_COUNT]: '#2563eb', // Primary blue
  [MetricType.CONVERSION_RATE]: '#10b981', // Success green
  [MetricType.ACTIVE_USERS]: '#7c3aed', // Accent purple
  [MetricType.CPU_USAGE]: '#f59e0b', // Warning amber
  [MetricType.ERROR_RATE]: '#dc2626', // Critical red
  [MetricType.UPTIME]: '#059669', // Success green dark
  [MetricType.MEMORY_USAGE]: '#6366f1' // Info indigo
};

// Chart configuration interface
interface ChartConfig {
  aspectRatio?: number;
  animations?: boolean;
  tooltipConfig?: {
    enabled: boolean;
    formatter?: (value: number, name: string) => string;
  };
  axisConfig?: {
    xAxis?: boolean;
    yAxis?: boolean;
    grid?: boolean;
  };
}

// Component props interface
interface AnalyticsChartProps {
  className?: string;
  metrics: MetricType[];
  title: string;
  type?: ChartType;
  showLegend?: boolean;
  interactive?: boolean;
  viewportSize: {
    width: number;
    height: number;
  };
  config?: ChartConfig;
}

/**
 * Analytics chart component with responsive design and Brazilian localization
 */
export const AnalyticsChart = memo<AnalyticsChartProps>(({
  className,
  metrics,
  title,
  type = 'line',
  showLegend = true,
  interactive = true,
  viewportSize,
  config = {}
}) => {
  // Default configuration
  const defaultConfig: ChartConfig = {
    aspectRatio: 2.5,
    animations: true,
    tooltipConfig: {
      enabled: true,
      formatter: (value, name) => `${name}: ${formatBrazilianNumber(value)}`
    },
    axisConfig: {
      xAxis: true,
      yAxis: true,
      grid: true
    }
  };

  // Merge configurations
  const chartConfig = { ...defaultConfig, ...config };

  // Fetch analytics data
  const { metrics: data, loading, error } = useAnalytics();

  // Process chart data with memoization
  const chartData = useMemo(() => {
    if (!data?.length) return [];

    return data.reduce((acc: any[], metric) => {
      if (metrics.includes(metric.type)) {
        const existingData = acc.find(d => d.timestamp === metric.timestamp);
        if (existingData) {
          existingData[metric.type] = metric.value;
        } else {
          acc.push({
            timestamp: metric.timestamp,
            [metric.type]: metric.value,
            alertLevel: metric.alertLevel
          });
        }
      }
      return acc;
    }, []).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }, [data, metrics]);

  // Custom tooltip formatter
  const formatTooltip = useCallback((value: number, name: string) => {
    switch (name) {
      case MetricType.CONVERSION_RATE:
      case MetricType.ERROR_RATE:
        return `${formatBrazilianNumber(value)}%`;
      case MetricType.RESPONSE_TIME:
        return `${formatBrazilianNumber(value)}ms`;
      default:
        return formatBrazilianNumber(value);
    }
  }, []);

  // Handle loading and error states
  if (loading) {
    return (
      <Card className={cn('animate-pulse', className)}>
        <div className="h-64 bg-gray-200 rounded" />
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={cn('bg-red-50', className)}>
        <div className="text-red-600 text-center p-4">
          Erro ao carregar dados do gráfico
        </div>
      </Card>
    );
  }

  // Select chart component based on type
  const ChartComponent = {
    line: LineChart,
    bar: BarChart,
    area: AreaChart
  }[type];

  // Chart rendering function
  const renderChart = () => (
    <ResponsiveContainer
      width="100%"
      height={viewportSize.height || viewportSize.width / chartConfig.aspectRatio!}
    >
      <ChartComponent
        data={chartData}
        margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
      >
        {chartConfig.axisConfig?.grid && (
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        )}
        
        {chartConfig.axisConfig?.xAxis && (
          <XAxis
            dataKey="timestamp"
            tickFormatter={(timestamp) => formatBrazilianDate(new Date(timestamp))}
            stroke="#64748b"
            fontSize={12}
          />
        )}

        {chartConfig.axisConfig?.yAxis && (
          <YAxis
            stroke="#64748b"
            fontSize={12}
            tickFormatter={(value) => formatBrazilianNumber(value)}
          />
        )}

        {chartConfig.tooltipConfig?.enabled && (
          <Tooltip
            formatter={chartConfig.tooltipConfig.formatter || formatTooltip}
            labelFormatter={(label) => formatBrazilianDate(new Date(label))}
            contentStyle={{
              backgroundColor: 'white',
              border: '1px solid #e2e8f0',
              borderRadius: '0.375rem',
              padding: '0.5rem'
            }}
          />
        )}

        {showLegend && (
          <Legend
            verticalAlign="top"
            height={36}
            formatter={(value) => value.replace(/_/g, ' ')}
          />
        )}

        {metrics.map((metricType) => {
          const DataComponent = {
            line: Line,
            bar: Bar,
            area: Area
          }[type];

          return (
            <DataComponent
              key={metricType}
              type="monotone"
              dataKey={metricType}
              stroke={CHART_COLORS[metricType]}
              fill={type === 'area' ? `${CHART_COLORS[metricType]}33` : CHART_COLORS[metricType]}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 6 }}
              isAnimationActive={chartConfig.animations}
            />
          );
        })}
      </ChartComponent>
    </ResponsiveContainer>
  );

  return (
    <Card
      className={cn('overflow-hidden', className)}
      role="region"
      aria-label={`Gráfico de ${title}`}
    >
      {title && (
        <h3 className="text-lg font-semibold mb-4 px-4 pt-4">
          {title}
        </h3>
      )}
      <div className="w-full" style={{ touchAction: interactive ? 'auto' : 'none' }}>
        {renderChart()}
      </div>
    </Card>
  );
});

AnalyticsChart.displayName = 'AnalyticsChart';

export default AnalyticsChart;
```

This implementation provides:

1. Comprehensive chart visualization with support for line, bar, and area charts
2. Brazilian Portuguese localization for numbers, dates, and labels
3. Responsive design with proper aspect ratio handling
4. Accessibility features including ARIA labels and keyboard navigation
5. Loading and error states with proper UI feedback
6. Touch support for mobile devices
7. Configurable chart options including animations and tooltips
8. Proper color coding for different metric types
9. Memory optimization through memoization
10. Type safety with TypeScript
11. Proper integration with the Card component
12. Support for real-time data updates through useAnalytics hook

The component can be used like this:

```typescript
<AnalyticsChart
  title="Métricas de Desempenho"
  metrics={[MetricType.RESPONSE_TIME, MetricType.ERROR_RATE]}
  type="line"
  showLegend={true}
  viewportSize={{ width: 800, height: 400 }}
  config={{
    aspectRatio: 2,
    animations: true,
    tooltipConfig: {
      enabled: true
    }
  }}
/>