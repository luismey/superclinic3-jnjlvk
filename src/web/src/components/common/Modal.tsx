import React, { useCallback, useEffect, useMemo } from 'react';
import { Dialog } from '@headlessui/react'; // v1.7.0
import { AnimatePresence, motion } from 'framer-motion'; // v10.0.0
import { useFocusTrap } from '@chakra-ui/hooks'; // v2.0.0
import cn from 'classnames'; // v2.3.0
import Button from './Button';
import { theme } from '../../config/theme';

// Type definitions
export type ModalSize = 'sm' | 'md' | 'lg' | 'full';
export type ModalDirection = 'ltr' | 'rtl';

export interface ModalAction {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'outline';
  loading?: boolean;
  ariaLabel?: string;
}

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  size?: ModalSize;
  children: React.ReactNode;
  actions?: ModalAction[];
  className?: string;
  showClose?: boolean;
  direction?: ModalDirection;
}

// Size configuration mapping
const ModalSizeMap: Record<ModalSize, string> = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  full: 'max-w-[90vw] h-[90vh]',
};

// Animation variants with hardware acceleration
const modalAnimationVariants = {
  hidden: {
    opacity: 0,
    scale: 0.95,
    y: -10,
    transition: { duration: 0.15, ease: 'easeOut' },
  },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.2, ease: 'easeOut' },
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    y: 10,
    transition: { duration: 0.15, ease: 'easeIn' },
  },
};

const overlayAnimationVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};

/**
 * Enhanced Modal component with accessibility features and animations
 * Implements WCAG 2.1 AA standards and supports RTL layouts
 */
export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  size = 'md',
  children,
  actions,
  className,
  showClose = true,
  direction = 'ltr',
}) => {
  // Generate unique IDs for accessibility
  const modalId = useMemo(() => `modal-${Math.random().toString(36).slice(2)}`, []);
  const contentId = useMemo(() => `modal-content-${modalId}`, [modalId]);

  // Focus trap setup
  const { ref: focusTrapRef } = useFocusTrap({
    isEnabled: isOpen,
    returnFocusOnDeactivate: true,
  });

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Generate modal classes
  const modalClasses = useMemo(() => {
    return cn(
      // Base styles
      'relative bg-white dark:bg-gray-800',
      'rounded-lg shadow-xl',
      'flex flex-col',
      'outline-none',
      // Size classes
      ModalSizeMap[size],
      // RTL support
      direction === 'rtl' ? 'text-right' : 'text-left',
      // Custom classes
      className
    );
  }, [size, direction, className]);

  // Render action buttons
  const renderActions = useCallback(() => {
    if (!actions?.length) return null;

    return (
      <div
        className={cn(
          'flex gap-3 mt-6',
          direction === 'rtl' ? 'justify-start' : 'justify-end'
        )}
      >
        {actions.map((action, index) => (
          <Button
            key={`${action.label}-${index}`}
            onClick={action.onClick}
            variant={action.variant || 'primary'}
            loading={action.loading}
            aria-label={action.ariaLabel || action.label}
          >
            {action.label}
          </Button>
        ))}
      </div>
    );
  }, [actions, direction]);

  return (
    <AnimatePresence mode="wait">
      {isOpen && (
        <Dialog
          static
          open={isOpen}
          onClose={onClose}
          initialFocus={focusTrapRef}
          className="fixed inset-0 z-50 overflow-y-auto"
          aria-labelledby={modalId}
          aria-describedby={contentId}
          dir={direction}
        >
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm"
            variants={overlayAnimationVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            aria-hidden="true"
          />

          {/* Modal positioning */}
          <div className="min-h-screen px-4 text-center">
            {/* Center alignment trick */}
            <span
              className="inline-block h-screen align-middle"
              aria-hidden="true"
            >
              &#8203;
            </span>

            {/* Modal content */}
            <motion.div
              ref={focusTrapRef}
              className={modalClasses}
              variants={modalAnimationVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              style={{
                display: 'inline-block',
                verticalAlign: 'middle',
                width: '100%',
              }}
            >
              {/* Header */}
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <Dialog.Title
                  id={modalId}
                  className="text-lg font-semibold text-gray-900 dark:text-white"
                >
                  {title}
                </Dialog.Title>
                {showClose && (
                  <button
                    onClick={onClose}
                    className={cn(
                      'absolute top-4',
                      direction === 'rtl' ? 'left-4' : 'right-4',
                      'text-gray-400 hover:text-gray-500',
                      'focus:outline-none focus-visible:ring-2',
                      'focus-visible:ring-primary-500'
                    )}
                    aria-label="Close modal"
                  >
                    <span className="sr-only">Close</span>
                    <svg
                      className="w-6 h-6"
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
                )}
              </div>

              {/* Content */}
              <Dialog.Description
                id={contentId}
                className="px-6 py-4 flex-grow overflow-y-auto"
              >
                {children}
              </Dialog.Description>

              {/* Footer with actions */}
              {actions?.length > 0 && (
                <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700">
                  {renderActions()}
                </div>
              )}
            </motion.div>
          </div>
        </Dialog>
      )}
    </AnimatePresence>
  );
};

Modal.displayName = 'Modal';

export default Modal;