import React, { memo } from 'react';
import cn from 'classnames'; // v2.3.0
import { colors } from '../../config/theme';

// Type definitions for component props
export type SpinnerSize = 'sm' | 'md' | 'lg';
export type SpinnerColor = 'primary' | 'secondary' | 'accent' | 'white';

export interface SpinnerProps {
  size?: SpinnerSize;
  color?: SpinnerColor;
  className?: string;
}

// Size mapping for Tailwind classes
const SpinnerSizeMap: Record<SpinnerSize, string> = {
  sm: 'h-4 w-4',
  md: 'h-6 w-6',
  lg: 'h-8 w-8',
};

// Color mapping for stroke colors based on theme
const SpinnerColorMap: Record<SpinnerColor, string> = {
  primary: colors.primary.DEFAULT,
  secondary: colors.secondary.DEFAULT,
  accent: colors.accent.DEFAULT,
  white: '#ffffff',
};

/**
 * Generates combined class names for spinner styling
 * @param size - Size variant of the spinner
 * @param color - Color variant of the spinner
 * @param className - Optional additional classes
 */
const getSpinnerClasses = (
  size: SpinnerSize,
  color: SpinnerColor,
  className?: string
): string => {
  return cn(
    // Base classes for animation and positioning
    'animate-spin',
    'inline-block',
    'relative',
    // Size-specific classes
    SpinnerSizeMap[size],
    // Optional custom classes
    className
  );
};

/**
 * Accessible loading spinner component that follows the design system
 * Implements smooth CSS animation and WCAG 2.1 AA compliance
 * 
 * @param props - SpinnerProps configuration
 * @returns Animated spinner component
 */
export const Spinner: React.FC<SpinnerProps> = memo(({
  size = 'md',
  color = 'primary',
  className,
}) => {
  const spinnerClasses = getSpinnerClasses(size, color, className);
  const strokeColor = SpinnerColorMap[color];

  return (
    <div
      role="status"
      aria-live="polite"
      className={spinnerClasses}
    >
      <svg
        className="animate-spin"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Background circle */}
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke={strokeColor}
          strokeWidth="4"
        />
        {/* Animated spinner arc */}
        <path
          className="opacity-75"
          fill={strokeColor}
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
      {/* Hidden text for screen readers */}
      <span className="sr-only">Loading...</span>
    </div>
  );
});

// Display name for debugging
Spinner.displayName = 'Spinner';

// Default props
Spinner.defaultProps = {
  size: 'md',
  color: 'primary',
};

export default Spinner;