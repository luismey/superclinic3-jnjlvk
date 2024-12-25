import React, { memo } from 'react'; // ^18.0.0
import cn from 'classnames'; // ^2.3.0
import { ArrowUpIcon, ArrowDownIcon } from '@radix-ui/react-icons'; // ^1.3.0
import * as Tooltip from '@radix-ui/react-tooltip'; // ^1.0.0

import { Card } from '../common/Card';
import { MetricType } from '../../types/analytics';
import { formatNumber, formatPercentage } from '../../utils/format';
import { theme } from '../../config/theme';

interface AnalyticsMetricProps {
  title: string;
  value: number;
  type: MetricType;
  percentageChange: number;
  className?: string;
  description?: string;
  isLoading?: boolean;
  error?: Error;
}

/**
 * Formats the metric value based on its type with proper localization
 * @param value - The numeric value to format
 * @param type - The type of metric determining format style
 * @returns Formatted string representation of the value
 */
const formatMetricValue = (value: number, type: MetricType): string => {
  try {
    switch (type) {
      case MetricType.RESPONSE_TIME:
        return `${formatNumber(value, 0)}ms`;
      case MetricType.CONVERSION_RATE:
      case MetricType.ERROR_RATE:
        return formatPercentage(value);
      case MetricType.MESSAGE_COUNT:
      case MetricType.ACTIVE_USERS:
        return formatNumber(value, 0);
      default:
        return formatNumber(value, 2);
    }
  } catch (error) {
    console.error('Error formatting metric value:', error);
    return '—';
  }
};

/**
 * A reusable component for displaying analytics metrics with value, trend, and percentage change
 */
export const AnalyticsMetric = memo<AnalyticsMetricProps>(({
  title,
  value,
  type,
  percentageChange,
  className,
  description,
  isLoading = false,
  error
}) => {
  // Determine trend direction and styling
  const isPositive = percentageChange > 0;
  const isNeutral = percentageChange === 0;
  const trendColor = isNeutral 
    ? theme.colors.secondary.DEFAULT
    : isPositive 
      ? theme.colors.semantic.success
      : theme.colors.error.DEFAULT;

  // Loading state UI
  if (isLoading) {
    return (
      <Card
        className={cn('min-w-[200px] animate-pulse', className)}
        padding="lg"
        elevation="low"
        role="status"
        aria-label={`Loading ${title} metric`}
      >
        <div className="space-y-3">
          <div className="h-4 bg-gray-200 rounded w-3/4" />
          <div className="h-8 bg-gray-200 rounded w-1/2" />
          <div className="h-4 bg-gray-200 rounded w-1/4" />
        </div>
      </Card>
    );
  }

  // Error state UI
  if (error) {
    return (
      <Card
        className={cn('min-w-[200px] border-error-200 bg-error-50', className)}
        padding="lg"
        elevation="low"
        role="alert"
        aria-label={`Error loading ${title} metric`}
      >
        <div className="text-error-700">
          <h3 className="font-medium">{title}</h3>
          <p className="text-sm mt-1">{error.message}</p>
        </div>
      </Card>
    );
  }

  return (
    <Card
      className={cn('min-w-[200px] transition-all duration-200', className)}
      padding="lg"
      elevation="low"
      role="region"
      aria-label={`${title} metric card`}
    >
      <Tooltip.Provider delayDuration={300}>
        <Tooltip.Root>
          <Tooltip.Trigger asChild>
            <h3 className="text-semantic-text-secondary font-medium text-sm">
              {title}
            </h3>
          </Tooltip.Trigger>
          {description && (
            <Tooltip.Portal>
              <Tooltip.Content
                className="bg-secondary-800 text-white px-3 py-2 rounded text-sm max-w-xs"
                side="top"
              >
                {description}
                <Tooltip.Arrow className="fill-secondary-800" />
              </Tooltip.Content>
            </Tooltip.Portal>
          )}
        </Tooltip.Root>
      </Tooltip.Provider>

      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-2xl font-semibold text-semantic-text-primary">
          {formatMetricValue(value, type)}
        </span>
        
        <div 
          className="flex items-center gap-1 text-sm"
          style={{ color: trendColor }}
          role="status"
          aria-label={`${Math.abs(percentageChange)}% ${isPositive ? 'increase' : 'decrease'}`}
        >
          {!isNeutral && (
            <>
              {isPositive ? (
                <ArrowUpIcon className="w-4 h-4" aria-hidden="true" />
              ) : (
                <ArrowDownIcon className="w-4 h-4" aria-hidden="true" />
              )}
              <span className="font-medium">
                {formatPercentage(Math.abs(percentageChange))}
              </span>
            </>
          )}
        </div>
      </div>
    </Card>
  );
});

AnalyticsMetric.displayName = 'AnalyticsMetric';

export default AnalyticsMetric;
```

This implementation:

1. Follows all design system specifications from theme.ts including colors, typography, and spacing
2. Implements proper accessibility features including ARIA labels and roles
3. Uses the Card component for consistent styling
4. Handles loading and error states with appropriate UI feedback
5. Implements tooltips for metric descriptions
6. Uses proper number formatting based on metric type
7. Shows trend indicators with semantic colors
8. Is memoized for performance optimization
9. Includes responsive design considerations
10. Properly types all props and functions
11. Includes comprehensive error handling
12. Uses the specified external libraries with proper versions

The component can be used in the analytics dashboard like this:

```typescript
<AnalyticsMetric
  title="Response Time"
  value={180}
  type={MetricType.RESPONSE_TIME}
  percentageChange={-12}
  description="Average API response time in milliseconds"
/>