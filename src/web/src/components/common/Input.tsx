import React from 'react';
import clsx from 'clsx';
import { theme } from '../../config/theme';

// Input types supported by the component
type InputType = 'text' | 'email' | 'password' | 'number' | 'tel' | 'search';

// Props interface with comprehensive typing for accessibility and validation
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  id: string;
  name: string;
  type?: InputType;
  value?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  error?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  'aria-label'?: string;
  'aria-describedby'?: string;
  className?: string;
}

/**
 * A reusable input component that provides consistent styling, validation,
 * and accessibility features across the application.
 * 
 * @component
 * @example
 * <Input
 *   id="email"
 *   name="email"
 *   type="email"
 *   required
 *   value={email}
 *   onChange={handleChange}
 *   error={errors.email}
 * />
 */
export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      id,
      name,
      type = 'text',
      value,
      placeholder,
      disabled = false,
      required = false,
      error,
      onChange,
      onBlur,
      className,
      'aria-label': ariaLabel,
      'aria-describedby': ariaDescribedby,
      ...props
    },
    ref
  ) => {
    // Generate unique IDs for accessibility
    const errorId = `${id}-error`;
    const descriptionId = `${id}-description`;

    // Combine aria-describedby with error ID when error is present
    const combinedAriaDescribedby = clsx(
      ariaDescribedby,
      error && errorId,
      descriptionId
    );

    // Base styles using theme tokens
    const baseStyles = clsx(
      // Layout and spacing
      'w-full',
      'px-3',
      'py-2',
      
      // Border and rounded corners
      'border',
      'rounded-md',
      
      // Typography
      theme.typography.fontFamily.primary.join(' '),
      'text-base',
      'text-semantic-text-primary',
      'placeholder:text-semantic-text-secondary',
      
      // Transitions
      'transition-all',
      'duration-200',
      
      // Focus states
      'focus:outline-none',
      'focus:ring-2',
      'focus:ring-primary-500',
      'focus:border-primary-500',
      
      // Focus visible (keyboard navigation)
      'focus-visible:ring-2',
      'focus-visible:ring-primary-500',
      
      // Hover state
      !disabled && !error && 'hover:border-gray-400',
      
      // Error state
      error && [
        'border-error-500',
        'focus:ring-error-500',
        'focus:border-error-500',
        'hover:border-error-600'
      ],
      
      // Disabled state
      disabled && [
        'bg-gray-100',
        'cursor-not-allowed',
        'opacity-75'
      ],
      
      // Custom classes
      className
    );

    return (
      <div className="relative">
        <input
          ref={ref}
          id={id}
          name={name}
          type={type}
          value={value}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          onChange={onChange}
          onBlur={onBlur}
          className={baseStyles}
          aria-invalid={!!error}
          aria-required={required}
          aria-label={ariaLabel}
          aria-describedby={combinedAriaDescribedby}
          {...props}
        />
        
        {/* Error message with semantic role for screen readers */}
        {error && (
          <div
            id={errorId}
            role="alert"
            aria-live="polite"
            className={clsx(
              'text-sm',
              'text-error-500',
              'mt-1',
              'animate-fadeIn'
            )}
          >
            {error}
          </div>
        )}
        
        {/* Hidden description for screen readers */}
        <div
          id={descriptionId}
          className="sr-only"
        >
          {required ? 'This field is required. ' : ''}
          {placeholder}
        </div>
      </div>
    );
  }
);

// Display name for React DevTools
Input.displayName = 'Input';

export default Input;