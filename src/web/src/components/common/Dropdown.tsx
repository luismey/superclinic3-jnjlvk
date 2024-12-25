import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import cn from 'classnames';
import { theme } from '../../config/theme';

// Types and Interfaces
export interface DropdownItem {
  value: string;
  label: string;
  icon?: React.ReactNode;
  disabled?: boolean;
  description?: string;
  className?: string;
}

type PlacementType = 'top' | 'bottom' | 'left' | 'right';

export interface DropdownProps {
  trigger: React.ReactNode;
  items: DropdownItem[];
  label: string;
  disabled?: boolean;
  className?: string;
  onSelect: (value: string) => void;
  'aria-label'?: string;
  placement?: PlacementType;
  virtualScroll?: boolean;
}

// Component implementation
export const Dropdown: React.FC<DropdownProps> = ({
  trigger,
  items,
  label,
  disabled = false,
  className,
  onSelect,
  'aria-label': ariaLabel,
  placement = 'bottom',
  virtualScroll = false,
}) => {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!open) return;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setActiveIndex(prev => {
          const next = prev + 1;
          return next >= items.length ? 0 : next;
        });
        break;
      case 'ArrowUp':
        event.preventDefault();
        setActiveIndex(prev => {
          const next = prev - 1;
          return next < 0 ? items.length - 1 : next;
        });
        break;
      case 'Home':
        event.preventDefault();
        setActiveIndex(0);
        break;
      case 'End':
        event.preventDefault();
        setActiveIndex(items.length - 1);
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        if (activeIndex >= 0 && !items[activeIndex].disabled) {
          onSelect(items[activeIndex].value);
          setOpen(false);
        }
        break;
      case 'Escape':
        setOpen(false);
        triggerRef.current?.focus();
        break;
    }
  }, [open, items, activeIndex, onSelect]);

  // Handle item selection
  const handleItemClick = useCallback((value: string) => {
    onSelect(value);
    setOpen(false);
    triggerRef.current?.focus();
  }, [onSelect]);

  // Attach keyboard event listeners
  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Reset active index when dropdown closes
  useEffect(() => {
    if (!open) setActiveIndex(-1);
  }, [open]);

  const dropdownStyles = {
    content: {
      minWidth: '200px',
      backgroundColor: theme.colors.semantic.background,
      borderRadius: theme.radii.md,
      padding: theme.spacing[1],
      boxShadow: theme.shadows.lg,
      border: `1px solid ${theme.colors.semantic.border}`,
      animation: 'dropdownSlide 150ms cubic-bezier(0.16, 1, 0.3, 1)',
    },
    item: {
      padding: `${theme.spacing[2]} ${theme.spacing[3]}`,
      borderRadius: theme.radii.sm,
      cursor: 'pointer',
      outline: 'none',
      transition: 'background-color 150ms ease',
      color: theme.colors.semantic.text.primary,
      fontSize: theme.typography.sizes.sm,
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing[2],
    },
  };

  return (
    <DropdownMenu.Root open={open} onOpenChange={setOpen}>
      <DropdownMenu.Trigger
        ref={triggerRef}
        className={cn(
          'dropdown-trigger',
          { 'opacity-50 cursor-not-allowed': disabled },
          className
        )}
        disabled={disabled}
        aria-label={ariaLabel || label}
      >
        {trigger}
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="dropdown-content"
          style={dropdownStyles.content}
          sideOffset={4}
          align="start"
          side={placement}
          onCloseAutoFocus={() => triggerRef.current?.focus()}
        >
          {items.map((item, index) => (
            <DropdownMenu.Item
              key={item.value}
              className={cn(
                'dropdown-item',
                { 'opacity-50 cursor-not-allowed': item.disabled },
                { 'bg-primary-50': activeIndex === index },
                item.className
              )}
              style={{
                ...dropdownStyles.item,
                backgroundColor: activeIndex === index ? theme.colors.primary[50] : 'transparent',
              }}
              disabled={item.disabled}
              onSelect={() => !item.disabled && handleItemClick(item.value)}
            >
              {item.icon && <span className="dropdown-item-icon">{item.icon}</span>}
              <span className="dropdown-item-label">{item.label}</span>
              {item.description && (
                <span className="dropdown-item-description text-sm text-semantic-text-secondary ml-2">
                  {item.description}
                </span>
              )}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
};

// CSS animations
const styles = `
  @keyframes dropdownSlide {
    from {
      opacity: 0;
      transform: translateY(-4px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
`;

// Inject styles
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement('style');
  styleSheet.textContent = styles;
  document.head.appendChild(styleSheet);
}