import React from 'react'; // v18.0.0
import clsx from 'clsx'; // v2.0.0
import { theme } from '../../../config/theme';

// Type definitions for component props
export type BadgeVariant = 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info';
export type BadgeSize = 'xs' | 'sm' | 'md' | 'lg';
export type BadgeRounded = 'none' | 'sm' | 'md' | 'lg' | 'full';

export interface BadgeProps {
  variant?: BadgeVariant;
  size?: BadgeSize;
  roundedStyle?: BadgeRounded;
  children: React.ReactNode;
  className?: string;
  ariaLabel?: string;
  onClick?: () => void;
}

// Constants for valid options
export const BADGE_VARIANTS = {
  primary: 'primary',
  secondary: 'secondary',
  success: 'success',
  warning: 'warning',
  error: 'error',
  info: 'info',
} as const;

export const BADGE_SIZES = {
  xs: 'xs',
  sm: 'sm',
  md: 'md',
  lg: 'lg',
} as const;

export const BADGE_ROUNDED = {
  none: 'none',
  sm: 'sm',
  md: 'md',
  lg: 'lg',
  full: 'full',
} as const;

// Helper function to generate variant-specific styles
const getVariantStyles = (variant: BadgeVariant = 'primary', isHovered: boolean = false): string => {
  const variantColors = {
    primary: {
      bg: theme.colors.primary[100],
      text: theme.colors.primary[700],
      hoverBg: theme.colors.primary[200],
    },
    secondary: {
      bg: theme.colors.secondary[100],
      text: theme.colors.secondary[700],
      hoverBg: theme.colors.secondary[200],
    },
    success: {
      bg: 'bg-green-100',
      text: 'text-green-700',
      hoverBg: 'hover:bg-green-200',
    },
    warning: {
      bg: 'bg-amber-100',
      text: 'text-amber-700',
      hoverBg: 'hover:bg-amber-200',
    },
    error: {
      bg: theme.colors.error[100],
      text: theme.colors.error[700],
      hoverBg: theme.colors.error[200],
    },
    info: {
      bg: 'bg-blue-100',
      text: 'text-blue-700',
      hoverBg: 'hover:bg-blue-200',
    },
  };

  const styles = [
    variantColors[variant].bg,
    variantColors[variant].text,
    'transition-colors duration-200',
  ];

  if (isHovered) {
    styles.push(variantColors[variant].hoverBg);
  }

  return clsx(styles);
};

// Helper function to generate size-specific styles
const getSizeStyles = (size: BadgeSize = 'md', roundedStyle: BadgeRounded = 'md'): string => {
  const sizeStyles = {
    xs: `px-${theme.spacing[2]} py-${theme.spacing[0.5]} text-${theme.typography.sizes.xs}`,
    sm: `px-${theme.spacing[2.5]} py-${theme.spacing[1]} text-${theme.typography.sizes.sm}`,
    md: `px-${theme.spacing[3]} py-${theme.spacing[1.5]} text-${theme.typography.sizes.sm}`,
    lg: `px-${theme.spacing[4]} py-${theme.spacing[2]} text-${theme.typography.sizes.base}`,
  };

  const roundedStyles = {
    none: 'rounded-none',
    sm: `rounded-${theme.radii.sm}`,
    md: `rounded-${theme.radii.md}`,
    lg: `rounded-${theme.radii.lg}`,
    full: 'rounded-full',
  };

  return clsx(sizeStyles[size], roundedStyles[roundedStyle]);
};

/**
 * Badge Component
 * 
 * A flexible badge component that supports multiple variants, sizes, and states.
 * Implements WCAG 2.1 AA accessibility standards and design system tokens.
 *
 * @param {BadgeProps} props - Component props
 * @returns {JSX.Element} Rendered badge component
 */
export const Badge: React.FC<BadgeProps> = ({
  variant = 'primary',
  size = 'md',
  roundedStyle = 'md',
  children,
  className,
  ariaLabel,
  onClick,
}) => {
  const [isHovered, setIsHovered] = React.useState(false);

  const baseStyles = 'inline-flex items-center justify-center font-medium';
  const variantStyles = getVariantStyles(variant, onClick !== undefined);
  const sizeStyles = getSizeStyles(size, roundedStyle);
  const interactiveStyles = onClick ? 'cursor-pointer' : '';

  const combinedStyles = clsx(
    baseStyles,
    variantStyles,
    sizeStyles,
    interactiveStyles,
    className
  );

  const handleMouseEnter = () => onClick && setIsHovered(true);
  const handleMouseLeave = () => onClick && setIsHovered(false);

  return (
    <span
      className={combinedStyles}
      onClick={onClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      role={onClick ? 'button' : 'status'}
      aria-label={ariaLabel}
      tabIndex={onClick ? 0 : undefined}
    >
      {children}
    </span>
  );
};

export default Badge;