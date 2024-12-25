// @ts-check
import React from 'react'; // v18.0.0
import cn from 'classnames'; // v2.3.0
import { User } from '../types/common';
import { theme } from '../../config/theme';

/**
 * Size variants for the Avatar component with corresponding Tailwind classes
 */
const AVATAR_SIZES = {
  sm: 'h-8 w-8 text-sm',
  md: 'h-10 w-10 text-base',
  lg: 'h-12 w-12 text-lg',
} as const;

/**
 * Fallback color combinations for avatar backgrounds and text
 * Using theme color tokens to ensure WCAG 2.1 AA compliance
 */
const FALLBACK_COLORS = [
  'bg-primary-100 text-primary-700',
  'bg-secondary-100 text-secondary-700',
  'bg-accent-100 text-accent-700',
] as const;

/**
 * Props interface for the Avatar component
 */
interface AvatarProps {
  /** Size variant of the avatar */
  size?: keyof typeof AVATAR_SIZES;
  /** URL of the profile image */
  src?: string;
  /** Alt text for the image (required for accessibility) */
  alt: string;
  /** User's full name for fallback initials */
  name: string;
  /** Optional additional CSS classes */
  className?: string;
  /** Optional error handler for image load failures */
  onError?: (event: React.SyntheticEvent<HTMLImageElement, Event>) => void;
}

/**
 * Extracts initials from a user's name
 * @param name - The full name to extract initials from
 * @returns A string of up to two characters representing the initials
 */
const getInitials = (name: string): string => {
  const sanitizedName = name.trim();
  if (!sanitizedName) return '';

  const words = sanitizedName.split(/\s+/);
  const firstInitial = words[0]?.[0] || '';
  const lastInitial = words.length > 1 ? words[words.length - 1]?.[0] : '';

  // Handle non-Latin characters using Unicode normalization
  const initials = (firstInitial + lastInitial)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();

  return initials.slice(0, 2);
};

/**
 * Generates a deterministic color selection based on user name
 * @param name - The user's name
 * @returns A CSS class string for background and text colors
 */
const getColorFromName = (name: string): string => {
  const hash = name.split('').reduce((acc, char) => {
    return char.charCodeAt(0) + ((acc << 5) - acc);
  }, 0);
  
  const index = Math.abs(hash) % FALLBACK_COLORS.length;
  return FALLBACK_COLORS[index];
};

/**
 * Avatar component displays a user's profile image or initials in a circular container
 * Implements WCAG 2.1 AA compliance with proper ARIA attributes
 */
export const Avatar: React.FC<AvatarProps> = ({
  size = 'md',
  src,
  alt,
  name,
  className,
  onError,
}) => {
  const [imageError, setImageError] = React.useState(false);

  const handleImageError = (event: React.SyntheticEvent<HTMLImageElement, Event>) => {
    setImageError(true);
    onError?.(event);
  };

  const showInitials = !src || imageError;
  const initials = getInitials(name);
  const fallbackColor = getColorFromName(name);
  
  const containerClasses = cn(
    // Base styles
    'inline-flex items-center justify-center rounded-full overflow-hidden',
    // Size variant
    AVATAR_SIZES[size],
    // Conditional fallback styling
    showInitials && fallbackColor,
    // Additional custom classes
    className
  );

  return (
    <div
      className={containerClasses}
      role="img"
      aria-label={alt}
      style={{
        borderRadius: theme.radii.full,
      }}
    >
      {!showInitials ? (
        <img
          src={src}
          alt={alt}
          className="h-full w-full object-cover"
          onError={handleImageError}
          loading="lazy"
        />
      ) : (
        <span className="select-none" aria-hidden="true">
          {initials}
        </span>
      )}
    </div>
  );
};

// Default export for convenient importing
export default Avatar;