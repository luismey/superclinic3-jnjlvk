import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFormContext } from 'react-hook-form'; // v7.0.0
import cn from 'classnames'; // v2.3.0
import { theme } from '../../config/theme';
import { Dropdown, DropdownProps } from './Dropdown';

// Interfaces
export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
  description?: string;
  'aria-label'?: string;
}

export interface SelectProps {
  name: string;
  label: string;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  error?: string;
  className?: string;
  onChange?: (value: string) => void;
  required?: boolean;
  id?: string;
  'aria-label'?: string;
  'aria-describedby'?: string;
}

export const Select = React.memo<SelectProps>(({
  name,
  label,
  options,
  placeholder = 'Select an option',
  disabled = false,
  error,
  className,
  onChange,
  required = false,
  id = name,
  'aria-label': ariaLabel,
  'aria-describedby': ariaDescribedBy,
}) => {
  // Form context integration
  const formContext = useFormContext();
  const isInForm = !!formContext;
  const { register, setValue, watch } = formContext || {};
  
  // Refs and state
  const selectRef = useRef<HTMLDivElement>(null);
  const [selectedValue, setSelectedValue] = useState<string>('');
  const [isFocused, setIsFocused] = useState(false);

  // Register field with form context if available
  useEffect(() => {
    if (isInForm) {
      register(name, { required });
    }
  }, [isInForm, name, register, required]);

  // Watch for form value changes
  useEffect(() => {
    if (isInForm) {
      const subscription = watch((value) => {
        const fieldValue = value[name];
        if (fieldValue !== undefined) {
          setSelectedValue(fieldValue);
        }
      });
      return () => subscription.unsubscribe();
    }
  }, [isInForm, watch, name]);

  // Transform options for Dropdown component
  const dropdownItems = useMemo(() => 
    options.map(option => ({
      value: option.value,
      label: option.label,
      disabled: option.disabled,
      description: option.description,
      className: cn('select-option', {
        'select-option-selected': option.value === selectedValue
      })
    })), [options, selectedValue]
  );

  // Handle selection
  const handleSelect = useCallback((value: string) => {
    setSelectedValue(value);
    
    if (isInForm) {
      setValue(name, value, { 
        shouldValidate: true,
        shouldDirty: true,
        shouldTouch: true 
      });
    }

    onChange?.(value);
  }, [isInForm, setValue, name, onChange]);

  // Selected option label
  const selectedLabel = useMemo(() => 
    options.find(opt => opt.value === selectedValue)?.label || placeholder,
    [options, selectedValue, placeholder]
  );

  // Styles
  const selectStyles = {
    container: cn(
      'select-container relative w-full',
      {
        'opacity-50 cursor-not-allowed': disabled,
        'has-error': error
      },
      className
    ),
    label: cn(
      'select-label block mb-2 text-sm font-medium',
      'text-semantic-text-primary',
      { 'required': required }
    ),
    trigger: cn(
      'select-trigger w-full px-3 py-2',
      'bg-semantic-background',
      'border border-semantic-border',
      'rounded-md text-sm',
      'transition-colors duration-200',
      {
        'border-primary-600 ring-1 ring-primary-500': isFocused && !error,
        'border-error-500 ring-1 ring-error-500': error,
        'hover:border-primary-400': !disabled && !error,
      }
    ),
    error: 'text-error-500 text-sm mt-1'
  };

  // Dropdown trigger content
  const triggerContent = (
    <div className={selectStyles.trigger}>
      <span className={cn('select-value', {
        'text-semantic-text-disabled': !selectedValue
      })}>
        {selectedLabel}
      </span>
    </div>
  );

  const errorId = `${id}-error`;

  return (
    <div 
      ref={selectRef}
      className={selectStyles.container}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
    >
      <label 
        htmlFor={id}
        className={selectStyles.label}
      >
        {label}
        {required && <span className="text-error-500 ml-1">*</span>}
      </label>

      <Dropdown
        trigger={triggerContent}
        items={dropdownItems}
        label={label}
        disabled={disabled}
        onSelect={handleSelect}
        aria-label={ariaLabel || label}
        aria-invalid={!!error}
        aria-required={required}
        aria-describedby={cn(
          error ? errorId : null,
          ariaDescribedBy
        )}
        placement="bottom"
      />

      {error && (
        <p 
          id={errorId}
          className={selectStyles.error}
          role="alert"
        >
          {error}
        </p>
      )}
    </div>
  );
});

Select.displayName = 'Select';