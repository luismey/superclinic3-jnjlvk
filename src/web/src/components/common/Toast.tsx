import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion'; // v10.0.0
import classNames from 'classnames'; // v2.3.0
import { theme } from '../../config/theme';

// Constants for component configuration
const VARIANTS = {
  SUCCESS: 'success',
  ERROR: 'error',
  WARNING: 'warning',
  INFO: 'info',
} as const;

const POSITIONS = {
  TOP_RIGHT: 'top-right',
  TOP_LEFT: 'top-left',
  BOTTOM_RIGHT: 'bottom-right',
  BOTTOM_LEFT: 'bottom-left',
} as const;

const DEFAULT_DURATION = 5000;

const ANIMATION_VARIANTS = {
  INITIAL: { opacity: 0, y: -20, scale: 0.95 },
  ANIMATE: { opacity: 1, y: 0, scale: 1 },
  EXIT: { opacity: 0, scale: 0.95, x: 20 },
};

// Interface definitions
interface ToastProps {
  variant?: keyof typeof VARIANTS;
  message: string;
  duration?: number;
  position?: keyof typeof POSITIONS;
  onClose: () => void;
  priority?: 'high' | 'normal' | 'low';
  autoClose?: boolean;
  showIcon?: boolean;
}

// Helper function to get variant-specific styles
const getVariantStyles = (variant: keyof typeof VARIANTS) => {
  const styles = {
    success: {
      background: theme.colors.semantic.success,
      color: theme.colors.primary.contrast.light,
      icon: '✓',
      role: 'status',
    },
    error: {
      background: theme.colors.error.DEFAULT,
      color: theme.colors.error.contrast.light,
      icon: '!',
      role: 'alert',
    },
    warning: {
      background: theme.colors.semantic.warning,
      color: theme.colors.primary.contrast.light,
      icon: '⚠',
      role: 'alert',
    },
    info: {
      background: theme.colors.primary.DEFAULT,
      color: theme.colors.primary.contrast.light,
      icon: 'i',
      role: 'status',
    },
  };

  return styles[variant] || styles.info;
};

// Helper function to get position styles
const getPositionStyles = (position: keyof typeof POSITIONS, isMobile: boolean) => {
  const baseStyles = {
    position: 'fixed' as const,
    zIndex: 50,
  };

  const positionMap = {
    'top-right': {
      top: isMobile ? theme.spacing[4] : theme.spacing[6],
      right: isMobile ? theme.spacing[4] : theme.spacing[6],
    },
    'top-left': {
      top: isMobile ? theme.spacing[4] : theme.spacing[6],
      left: isMobile ? theme.spacing[4] : theme.spacing[6],
    },
    'bottom-right': {
      bottom: isMobile ? theme.spacing[4] : theme.spacing[6],
      right: isMobile ? theme.spacing[4] : theme.spacing[6],
    },
    'bottom-left': {
      bottom: isMobile ? theme.spacing[4] : theme.spacing[6],
      left: isMobile ? theme.spacing[4] : theme.spacing[6],
    },
  };

  return { ...baseStyles, ...positionMap[position] };
};

export const Toast: React.FC<ToastProps> = ({
  variant = VARIANTS.INFO,
  message,
  duration = DEFAULT_DURATION,
  position = POSITIONS.TOP_RIGHT,
  onClose,
  priority = 'normal',
  autoClose = true,
  showIcon = true,
}) => {
  const variantStyles = getVariantStyles(variant);
  const isMobile = window.innerWidth < parseInt(theme.breakpoints.tablet);
  const positionStyles = getPositionStyles(position, isMobile);

  useEffect(() => {
    if (autoClose && duration > 0) {
      const timer = setTimeout(onClose, duration);
      return () => clearTimeout(timer);
    }
  }, [autoClose, duration, onClose]);

  return (
    <AnimatePresence>
      <motion.div
        role={variantStyles.role}
        aria-live={priority === 'high' ? 'assertive' : 'polite'}
        initial="INITIAL"
        animate="ANIMATE"
        exit="EXIT"
        variants={ANIMATION_VARIANTS}
        transition={{ 
          type: 'spring', 
          stiffness: 400, 
          damping: 30,
          duration: 0.2 
        }}
        style={positionStyles}
        className={classNames(
          'flex items-center gap-3 px-4 py-3 rounded-lg shadow-md max-w-md',
          'transform-gpu backdrop-blur-sm',
          'motion-reduce:transform-none motion-reduce:transition-none',
          '@media (prefers-reduced-motion: reduce) { transition: none; }'
        )}
      >
        {showIcon && (
          <span
            className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded-full"
            style={{ 
              background: variantStyles.color,
              color: variantStyles.background 
            }}
            aria-hidden="true"
          >
            {variantStyles.icon}
          </span>
        )}
        
        <p 
          className="flex-1 text-sm font-medium"
          style={{ color: variantStyles.color }}
        >
          {message}
        </p>

        <button
          onClick={onClose}
          className={classNames(
            'flex-shrink-0 rounded-full p-1',
            'hover:bg-black hover:bg-opacity-10',
            'focus:outline-none focus:ring-2 focus:ring-offset-2',
            'motion-reduce:transform-none'
          )}
          style={{ 
            color: variantStyles.color,
            focusRingColor: variantStyles.color 
          }}
          aria-label="Close notification"
        >
          <svg 
            className="w-4 h-4" 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M6 18L18 6M6 6l12 12" 
            />
          </svg>
        </button>
      </motion.div>
    </AnimatePresence>
  );
};

export type { ToastProps };