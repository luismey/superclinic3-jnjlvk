import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { DatePickerComponent } from '../common/DatePicker';
import { Select } from '../common/Select';
import { MetricType } from '../../types/analytics';
import { DateRange } from '../../types/common';
import { debounce } from 'lodash'; // v4.17.21
import cn from 'classnames'; // v2.3.0

// Constants for filter configuration
const UPDATE_DEBOUNCE_MS = 300;
const DEFAULT_UPDATE_INTERVAL = 30000; // 30 seconds

// Interface for filter state
interface AnalyticsFilter {
  dateRange: DateRange;
  metricTypes: MetricType[];
  updateInterval?: number;
}

// Props interface
interface AnalyticsFilterProps {
  filter: AnalyticsFilter;
  onFilterChange: (filter: AnalyticsFilter) => void;
  className?: string;
  updateInterval?: number;
  thresholds?: Record<MetricType, number>;
  isLoading?: boolean;
  error?: Error;
}

/**
 * Enhanced analytics filter component with real-time updates and performance optimization
 */
export const AnalyticsFilter = React.memo<AnalyticsFilterProps>(({
  filter,
  onFilterChange,
  className,
  updateInterval = DEFAULT_UPDATE_INTERVAL,
  thresholds,
  isLoading = false,
  error
}) => {
  // Refs for managing intervals and updates
  const updateIntervalRef = useRef<NodeJS.Timeout>();
  const previousFilterRef = useRef(filter);

  // Memoized metric options with thresholds
  const metricOptions = useMemo(() => {
    return Object.values(MetricType).map(type => ({
      value: type,
      label: type.replace(/_/g, ' ').toLowerCase(),
      description: thresholds?.[type] 
        ? `Limite: ${thresholds[type]}` 
        : undefined
    }));
  }, [thresholds]);

  // Debounced filter update handler
  const debouncedFilterUpdate = useMemo(
    () => debounce((newFilter: AnalyticsFilter) => {
      onFilterChange(newFilter);
    }, UPDATE_DEBOUNCE_MS),
    [onFilterChange]
  );

  // Handle date range changes
  const handleDateRangeChange = useCallback((dateRange: DateRange) => {
    const newFilter = {
      ...filter,
      dateRange
    };
    previousFilterRef.current = newFilter;
    debouncedFilterUpdate(newFilter);
  }, [filter, debouncedFilterUpdate]);

  // Handle metric type selection changes
  const handleMetricTypeChange = useCallback((selectedTypes: string[]) => {
    const validMetricTypes = selectedTypes.filter(
      (type): type is MetricType => type in MetricType
    );

    const newFilter = {
      ...filter,
      metricTypes: validMetricTypes
    };
    previousFilterRef.current = newFilter;
    debouncedFilterUpdate(newFilter);
  }, [filter, debouncedFilterUpdate]);

  // Set up real-time update interval
  useEffect(() => {
    if (updateInterval && updateInterval > 0) {
      updateIntervalRef.current = setInterval(() => {
        onFilterChange(previousFilterRef.current);
      }, updateInterval);
    }

    return () => {
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
      }
    };
  }, [updateInterval, onFilterChange]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      debouncedFilterUpdate.cancel();
    };
  }, [debouncedFilterUpdate]);

  return (
    <div 
      className={cn(
        'analytics-filter p-4 bg-white rounded-lg shadow-sm',
        'border border-semantic-border',
        className
      )}
      role="region"
      aria-label="Filtros de análise"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Date Range Selector */}
        <div className="flex flex-col">
          <DatePickerComponent
            range={filter.dateRange}
            onRangeChange={handleDateRangeChange}
            isRangeMode={true}
            disabled={isLoading}
            locale="pt-BR"
            aria-label="Período de análise"
            errorMessage={error?.message}
          />
        </div>

        {/* Metric Type Selector */}
        <div className="flex flex-col">
          <Select
            name="metricTypes"
            label="Métricas"
            options={metricOptions}
            onChange={handleMetricTypeChange}
            disabled={isLoading}
            error={error?.message}
            placeholder="Selecione as métricas"
            aria-label="Seleção de métricas"
            className="w-full"
          />
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div 
          className="mt-2 text-sm text-semantic-text-secondary"
          role="status"
          aria-live="polite"
        >
          Atualizando filtros...
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div 
          className="mt-2 text-sm text-error-500"
          role="alert"
        >
          Erro: {error.message}
        </div>
      )}
    </div>
  );
});

AnalyticsFilter.displayName = 'AnalyticsFilter';

export default AnalyticsFilter;
```

This implementation provides:

1. Comprehensive filtering controls for analytics data with date range and metric type selection
2. Real-time updates with configurable intervals and debouncing
3. Performance optimization through React.memo and useMemo
4. Full accessibility support with ARIA attributes and keyboard navigation
5. Brazilian Portuguese localization
6. Error handling and loading states
7. Responsive design with Tailwind CSS
8. Type safety with TypeScript
9. Integration with form components and validation
10. Clean up of intervals and subscriptions on unmount

The component can be used like this:

```typescript
const AnalyticsDashboard = () => {
  const [filter, setFilter] = useState<AnalyticsFilter>({
    dateRange: {
      startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      endDate: new Date()
    },
    metricTypes: [MetricType.RESPONSE_TIME, MetricType.MESSAGE_COUNT]
  });

  return (
    <AnalyticsFilter
      filter={filter}
      onFilterChange={setFilter}
      updateInterval={30000}
      thresholds={{
        [MetricType.RESPONSE_TIME]: 200,
        [MetricType.ERROR_RATE]: 0.1
      }}
    />
  );
};