// @version React ^18.0.0
// @version classnames ^2.3.0
// @version @radix-ui/react-tooltip ^2.0.0

import React, { useCallback, useRef, useState, useEffect } from 'react';
import * as RadixTooltip from '@radix-ui/react-tooltip';
import cn from 'classnames';

// Types and Interfaces
type Position = 'top' | 'right' | 'bottom' | 'left';

interface ViewportDimensions {
  width: number;
  height: number;
}

interface TooltipProps {
  children: React.ReactNode;
  content: string;
  position?: Position;
  delayDuration?: number;
  className?: string;
  disabled?: boolean;
  triggerProps?: RadixTooltip.TooltipTriggerProps;
  contentProps?: RadixTooltip.TooltipContentProps;
}

// Utility function for position calculation
const getTooltipPosition = (
  triggerRect: DOMRect,
  tooltipRect: DOMRect,
  viewport: ViewportDimensions
): Position => {
  const padding = 8; // Safe distance from viewport edges
  const positions: Position[] = ['top', 'right', 'bottom', 'left'];
  
  const space = {
    top: triggerRect.top,
    right: viewport.width - (triggerRect.left + triggerRect.width),
    bottom: viewport.height - (triggerRect.top + triggerRect.height),
    left: triggerRect.left,
  };

  // Find first position with enough space
  return positions.find((pos) => {
    const required = pos === 'left' || pos === 'right' 
      ? tooltipRect.width + padding 
      : tooltipRect.height + padding;
    return space[pos] >= required;
  }) || 'top'; // Fallback to top if no position has enough space
};

// Custom hook for debounced position calculation
const useDebouncePosition = (callback: Function, delay: number) => {
  const timeoutRef = useRef<NodeJS.Timeout>();

  return useCallback((...args: any[]) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => callback(...args), delay);
  }, [callback, delay]);
};

// Main Tooltip Component
const Tooltip: React.FC<TooltipProps> = ({
  children,
  content,
  position = 'top',
  delayDuration = 200,
  className = '',
  disabled = false,
  triggerProps = {},
  contentProps = {},
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentPosition, setCurrentPosition] = useState<Position>(position);
  const triggerRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Position calculation with debounce
  const calculatePosition = useDebouncePosition(() => {
    if (!triggerRef.current || !contentRef.current) return;

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const tooltipRect = contentRef.current.getBoundingClientRect();
    const viewport = {
      width: window.innerWidth,
      height: window.innerHeight,
    };

    const optimalPosition = getTooltipPosition(triggerRect, tooltipRect, viewport);
    if (optimalPosition !== currentPosition) {
      setCurrentPosition(optimalPosition);
    }
  }, 100);

  // Recalculate position on window resize
  useEffect(() => {
    if (!isOpen) return;

    window.addEventListener('resize', calculatePosition);
    return () => window.removeEventListener('resize', calculatePosition);
  }, [isOpen, calculatePosition]);

  // Base styles
  const tooltipClasses = cn(
    'rounded-md px-3 py-2 text-sm font-medium shadow-md',
    'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900',
    'animate-in fade-in duration-200',
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
    {
      'slide-in-from-top-2': currentPosition === 'bottom',
      'slide-in-from-right-2': currentPosition === 'left',
      'slide-in-from-bottom-2': currentPosition === 'top',
      'slide-in-from-left-2': currentPosition === 'right',
    },
    className
  );

  if (disabled) return <>{children}</>;

  return (
    <RadixTooltip.Provider delayDuration={delayDuration}>
      <RadixTooltip.Root onOpenChange={setIsOpen}>
        <RadixTooltip.Trigger
          ref={triggerRef}
          asChild
          {...triggerProps}
          className={cn(
            'inline-flex items-center focus:outline-none',
            triggerProps.className
          )}
        >
          {children}
        </RadixTooltip.Trigger>

        <RadixTooltip.Portal>
          <RadixTooltip.Content
            ref={contentRef}
            side={currentPosition}
            sideOffset={5}
            align="center"
            {...contentProps}
            className={tooltipClasses}
            onOpenAutoFocus={(e) => {
              e.preventDefault(); // Prevent focus stealing
              calculatePosition();
            }}
          >
            {content}
            <RadixTooltip.Arrow
              className="fill-gray-900 dark:fill-gray-100"
              width={10}
              height={5}
            />
          </RadixTooltip.Content>
        </RadixTooltip.Portal>
      </RadixTooltip.Root>
    </RadixTooltip.Provider>
  );
};

export default Tooltip;