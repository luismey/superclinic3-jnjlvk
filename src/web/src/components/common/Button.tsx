import React, { forwardRef, memo, useCallback, useMemo } from 'react';
import cn from 'classnames'; // v2.3.0
import { colors, typography, spacing } from '../../config/theme';
import Spinner from './Spinner';
import Tooltip from './Tooltip';

// Type definitions
export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';
export type ButtonType = 'button' | 'submit' | 'reset';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  type?: ButtonType;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  tooltip?: string;
  className?: string;
  children: React.ReactNode;
  'aria-label'?: string;
  'data-testid'?: string;
}

// Size mappings for consistent touch targets and spacing
const ButtonSizeMap: Record<ButtonSize, string> = {
  sm: cn('px-3 py-2 text-sm min-h-[32px]', typography.sizes.sm),
  md: cn('px-4 py-2 text-base min-h-[40px]', typography.sizes.base),
  lg: cn('px-6 py-3 text-lg min-h-[48px]', typography.sizes.lg),
};

// Variant style mappings with WCAG AA compliant contrast ratios
const ButtonVariantMap: Record<ButtonVariant, string> = {
  primary: cn(
    'bg-primary-600 text-white hover:bg-primary-700 focus:bg-primary-700',
    'active:bg-primary-800 disabled:bg-primary-200'
  ),
  secondary: cn(
    'bg-secondary-600 text-white hover:bg-secondary-700 focus:bg-secondary-700',
    'active:bg-secondary-800 disabled:bg-secondary-200'
  ),
  outline: cn(
    'border-2 border-primary-600 text-primary-600',
    'hover:bg-primary-50 focus:bg-primary-50',
    'active:bg-primary-100 disabled:border-primary-200 disabled:text-primary-200'
  ),
  ghost: cn(
    'text-primary-600 hover:bg-primary-50 focus:bg-primary-50',
    'active:bg-primary-100 disabled:text-primary-200'
  ),
};

/**
 * Advanced button component implementing the design system with full accessibility support
 * Compliant with WCAG 2.1 AA standards including touch targets and contrast ratios
 */
export const Button = memo(forwardRef<HTMLButtonElement, ButtonProps>(({
  variant = 'primary',
  size = 'md',
  type = 'button',
  disabled = false,
  loading = false,
  fullWidth = false,
  tooltip,
  className,
  children,
  onClick,
  'aria-label': ariaLabel,
  'data-testid': dataTestId,
  ...props
}, ref) => {
  // Generate memoized class names
  const buttonClasses = useMemo(() => {
    return cn(
      // Base styles
      'inline-flex items-center justify-center',
      'rounded-md font-medium transition-all duration-200',
      'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2',
      'disabled:cursor-not-allowed',
      // Size and variant specific styles
      ButtonSizeMap[size],
      ButtonVariantMap[variant],
      // Full width option
      fullWidth && 'w-full',
      // Loading state styles
      loading && 'cursor-wait',
      // Custom classes
      className
    );
  }, [variant, size, fullWidth, loading, className]);

  // Handle click events with loading state management
  const handleClick = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled || loading || !onClick) return;
    onClick(event);
  }, [disabled, loading, onClick]);

  // Prepare button content
  const buttonContent = (
    <>
      {loading && (
        <Spinner
          size={size === 'lg' ? 'md' : 'sm'}
          color={variant === 'primary' || variant === 'secondary' ? 'white' : 'primary'}
          className="mr-2"
        />
      )}
      {children}
    </>
  );

  // Prepare button element
  const buttonElement = (
    <button
      ref={ref}
      type={type}
      className={buttonClasses}
      disabled={disabled || loading}
      onClick={handleClick}
      aria-label={ariaLabel}
      aria-disabled={disabled || loading}
      aria-busy={loading}
      data-testid={dataTestId}
      {...props}
    >
      {buttonContent}
    </button>
  );

  // Wrap with tooltip if provided and button is disabled
  if (tooltip && disabled) {
    return (
      <Tooltip content={tooltip} position="top">
        {buttonElement}
      </Tooltip>
    );
  }

  return buttonElement;
}));

// Display name for debugging
Button.displayName = 'Button';

// Default export
export default Button;