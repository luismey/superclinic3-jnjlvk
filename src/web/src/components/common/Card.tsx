import React from 'react'; // ^18.0.0
import cn from 'classnames'; // ^2.3.0
import { theme } from '../../config/theme';

// Type definitions for component props
type ElevationType = 'low' | 'medium' | 'high';
type BorderRadiusType = 'none' | 'small' | 'medium' | 'large';
type PaddingType = 'sm' | 'md' | 'lg' | 'xl';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  noPadding?: boolean;
  noShadow?: boolean;
  noBorder?: boolean;
  role?: string;
  'aria-label'?: string;
  elevation?: ElevationType;
  borderRadius?: BorderRadiusType;
  padding?: PaddingType;
}

// Shadow mapping based on elevation
const shadowMap: Record<ElevationType, keyof typeof theme.shadows> = {
  low: 'sm',
  medium: 'md',
  high: 'lg',
};

// Border radius mapping
const radiusMap: Record<BorderRadiusType, keyof typeof theme.radii> = {
  none: 'none',
  small: 'sm',
  medium: 'md',
  large: 'lg',
};

// Padding mapping with responsive values
const paddingMap: Record<PaddingType, string> = {
  sm: `${theme.spacing[2]} ${theme.spacing[3]}`,
  md: `${theme.spacing[4]} ${theme.spacing[5]}`,
  lg: `${theme.spacing[6]} ${theme.spacing[8]}`,
  xl: `${theme.spacing[8]} ${theme.spacing[10]}`,
};

/**
 * Card component providing a consistent container with configurable styling and accessibility features.
 * Implements design system specifications for spacing, elevation, and semantic structure.
 *
 * @param {CardProps} props - Component props
 * @returns {JSX.Element} Rendered card component
 */
export const Card = React.memo<CardProps>(({
  children,
  className,
  noPadding = false,
  noShadow = false,
  noBorder = false,
  role = 'region',
  'aria-label': ariaLabel,
  elevation = 'low',
  borderRadius = 'medium',
  padding = 'md',
  ...props
}) => {
  // Ensure aria-label is present when role is specified
  if (role && !ariaLabel) {
    console.warn('Card: aria-label should be provided when role is specified');
  }

  // Base styles
  const baseStyles = 'relative bg-white transition-shadow duration-200';
  
  // Border styles
  const borderStyles = !noBorder && 'border border-semantic-border';
  
  // Shadow styles
  const shadowStyles = !noShadow && theme.shadows[shadowMap[elevation]];
  
  // Border radius styles
  const radiusStyles = `rounded-${radiusMap[borderRadius]}`;
  
  // Padding styles - responsive based on breakpoints
  const paddingStyles = !noPadding && {
    [`@media (min-width: ${theme.breakpoints.mobile})`]: {
      padding: paddingMap[padding],
    },
    [`@media (min-width: ${theme.breakpoints.tablet})`]: {
      padding: paddingMap[padding],
    },
  };

  return (
    <div
      role={role}
      aria-label={ariaLabel}
      className={cn(
        baseStyles,
        borderStyles,
        radiusStyles,
        className,
      )}
      style={{
        ...paddingStyles,
        boxShadow: shadowStyles,
      }}
      {...props}
    >
      {children}
    </div>
  );
});

// Display name for debugging
Card.displayName = 'Card';

// Default export
export default Card;