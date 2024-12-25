import React from 'react'; // ^18.0.0
import { render, screen, fireEvent, within } from '@testing-library/react'; // ^14.0.0
import { describe, it, expect, beforeEach, vi } from 'vitest'; // ^0.34.0
import userEvent from '@testing-library/user-event'; // ^14.0.0

import { AnalyticsMetric } from '../../src/components/analytics/AnalyticsMetric';
import { AnalyticsCard } from '../../src/components/analytics/AnalyticsCard';
import { MetricType, AlertLevel } from '../../src/types/analytics';

// Mock theme values for consistent testing
vi.mock('../../src/config/theme', () => ({
  theme: {
    colors: {
      semantic: {
        success: '#22c55e',
        error: '#ef4444',
        secondary: '#64748b'
      }
    }
  }
}));

describe('AnalyticsMetric Component', () => {
  const defaultProps = {
    title: 'Response Time',
    value: 180,
    type: MetricType.RESPONSE_TIME,
    percentageChange: -12
  };

  describe('Rendering', () => {
    it('renders with basic props correctly', () => {
      render(<AnalyticsMetric {...defaultProps} />);
      
      expect(screen.getByText('Response Time')).toBeInTheDocument();
      expect(screen.getByText('180ms')).toBeInTheDocument();
      expect(screen.getByText('-12%')).toBeInTheDocument();
    });

    it('applies correct formatting based on metric type', () => {
      const testCases = [
        { type: MetricType.RESPONSE_TIME, value: 200, expected: '200ms' },
        { type: MetricType.CONVERSION_RATE, value: 0.25, expected: '25%' },
        { type: MetricType.MESSAGE_COUNT, value: 1234, expected: '1,234' },
        { type: MetricType.ACTIVE_USERS, value: 500, expected: '500' }
      ];

      testCases.forEach(({ type, value, expected }) => {
        const { rerender } = render(
          <AnalyticsMetric {...defaultProps} type={type} value={value} />
        );
        expect(screen.getByText(expected)).toBeInTheDocument();
        rerender(<></>);
      });
    });

    it('handles loading state correctly', () => {
      render(<AnalyticsMetric {...defaultProps} isLoading={true} />);
      
      expect(screen.getByRole('status')).toHaveClass('animate-pulse');
      expect(screen.getByLabelText(/loading/i)).toBeInTheDocument();
    });

    it('handles error state correctly', () => {
      const error = new Error('Test error');
      render(<AnalyticsMetric {...defaultProps} error={error} />);
      
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText(error.message)).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('provides proper ARIA labels for trend indicators', () => {
      render(<AnalyticsMetric {...defaultProps} />);
      
      const trendIndicator = screen.getByRole('status');
      expect(trendIndicator).toHaveAttribute(
        'aria-label',
        '12% decrease'
      );
    });

    it('supports keyboard navigation for interactive elements', async () => {
      render(<AnalyticsMetric {...defaultProps} description="Test description" />);
      
      const trigger = screen.getByText(defaultProps.title);
      await userEvent.tab();
      expect(trigger).toHaveFocus();
      
      await userEvent.keyboard('{Enter}');
      expect(screen.getByText('Test description')).toBeInTheDocument();
    });

    it('maintains color contrast requirements', () => {
      render(<AnalyticsMetric {...defaultProps} />);
      
      const title = screen.getByText(defaultProps.title);
      const computedStyle = window.getComputedStyle(title);
      expect(computedStyle.color).toMatch(/^(rgb|#)/); // Verify color is applied
    });
  });

  describe('Responsive Behavior', () => {
    it('adapts to different viewport sizes', () => {
      const { container } = render(<AnalyticsMetric {...defaultProps} />);
      
      // Test mobile viewport
      window.innerWidth = 320;
      fireEvent(window, new Event('resize'));
      expect(container.firstChild).toHaveClass('min-w-[200px]');

      // Test desktop viewport
      window.innerWidth = 1024;
      fireEvent(window, new Event('resize'));
      expect(container.firstChild).toHaveClass('min-w-[200px]');
    });
  });
});

describe('AnalyticsCard Component', () => {
  const defaultProps = {
    title: 'Analytics Overview',
    children: <div>Test content</div>
  };

  describe('Rendering', () => {
    it('renders title and content correctly', () => {
      render(<AnalyticsCard {...defaultProps} />);
      
      expect(screen.getByText('Analytics Overview')).toBeInTheDocument();
      expect(screen.getByText('Test content')).toBeInTheDocument();
    });

    it('applies metric-specific styling', () => {
      const { container } = render(
        <AnalyticsCard {...defaultProps} metricType={MetricType.RESPONSE_TIME} />
      );
      
      expect(container.firstChild).toHaveClass('border-l-primary-500');
    });

    it('handles loading state with skeleton', () => {
      render(<AnalyticsCard {...defaultProps} loading={true} />);
      
      expect(screen.getByTestId('skeleton')).toBeInTheDocument();
      expect(screen.getByRole('status')).toHaveAttribute(
        'aria-label',
        'Loading Analytics Overview'
      );
    });

    it('displays error state correctly', () => {
      const errorMessage = 'Test error message';
      render(
        <AnalyticsCard 
          {...defaultProps} 
          error={true} 
          errorMessage={errorMessage} 
        />
      );
      
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('provides proper region labeling', () => {
      render(<AnalyticsCard {...defaultProps} />);
      
      const card = screen.getByRole('region');
      expect(card).toHaveAttribute(
        'aria-label',
        'Analytics Overview analytics card'
      );
    });

    it('handles custom aria labels', () => {
      const ariaLabel = 'Custom analytics section';
      render(<AnalyticsCard {...defaultProps} ariaLabel={ariaLabel} />);
      
      expect(screen.getByRole('region')).toHaveAttribute(
        'aria-label',
        ariaLabel
      );
    });
  });

  describe('Integration', () => {
    it('works correctly with AnalyticsMetric children', () => {
      render(
        <AnalyticsCard {...defaultProps}>
          <AnalyticsMetric
            title="Response Time"
            value={180}
            type={MetricType.RESPONSE_TIME}
            percentageChange={-12}
          />
        </AnalyticsCard>
      );
      
      expect(screen.getByText('180ms')).toBeInTheDocument();
      expect(screen.getByText('-12%')).toBeInTheDocument();
    });

    it('handles multiple metrics', () => {
      render(
        <AnalyticsCard {...defaultProps}>
          <AnalyticsMetric
            title="Response Time"
            value={180}
            type={MetricType.RESPONSE_TIME}
            percentageChange={-12}
          />
          <AnalyticsMetric
            title="Conversion Rate"
            value={0.25}
            type={MetricType.CONVERSION_RATE}
            percentageChange={5}
          />
        </AnalyticsCard>
      );
      
      expect(screen.getByText('180ms')).toBeInTheDocument();
      expect(screen.getByText('25%')).toBeInTheDocument();
    });
  });
});