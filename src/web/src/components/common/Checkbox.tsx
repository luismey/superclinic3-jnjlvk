import React, { useCallback, useId } from 'react';
import classNames from 'classnames';
import { theme } from '../../config/theme';

export interface CheckboxProps {
  id?: string;
  name: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  error?: string;
  className?: string;
  'data-testid'?: string;
}

const Checkbox: React.FC<CheckboxProps> = React.memo(({
  id: providedId,
  name,
  label,
  checked,
  onChange,
  disabled = false,
  error,
  className,
  'data-testid': dataTestId,
}) => {
  // Generate unique ID if not provided
  const uniqueId = useId();
  const id = providedId || `checkbox-${uniqueId}`;
  const errorId = `${id}-error`;

  // Memoized change handler
  const handleChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    onChange(event.target.checked);
  }, [onChange]);

  // Keyboard handler for accessibility
  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLLabelElement>) => {
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      if (!disabled) {
        onChange(!checked);
      }
    }
  }, [onChange, checked, disabled]);

  // Compose class names based on state
  const wrapperClasses = classNames(
    'inline-flex items-center',
    disabled && 'opacity-50 cursor-not-allowed',
    className
  );

  const checkboxClasses = classNames(
    // Base styles
    'relative w-5 h-5 border rounded',
    'transition-all duration-200 ease-in-out',
    'focus-visible:ring-2 focus-visible:ring-offset-2',
    'focus-visible:ring-primary-500',
    
    // State-based styles
    checked && [
      'bg-primary-600 border-primary-600',
      !disabled && 'hover:bg-primary-700 hover:border-primary-700'
    ],
    !checked && [
      'bg-white border-secondary-300',
      !disabled && 'hover:border-primary-500'
    ],
    error && !disabled && 'border-error-500',
    disabled && 'bg-secondary-100'
  );

  const labelClasses = classNames(
    'ml-2 text-base select-none',
    disabled ? 'text-semantic-text-disabled' : 'text-semantic-text-primary',
    error && !disabled && 'text-error-600'
  );

  return (
    <div className={wrapperClasses}>
      <label
        htmlFor={id}
        className="relative flex items-center cursor-pointer"
        onKeyDown={handleKeyDown}
        tabIndex={disabled ? -1 : 0}
        data-testid={dataTestId}
      >
        <input
          type="checkbox"
          id={id}
          name={name}
          checked={checked}
          onChange={handleChange}
          disabled={disabled}
          className={checkboxClasses}
          aria-invalid={!!error}
          aria-describedby={error ? errorId : undefined}
          style={{
            // Custom checkmark using border
            '&:checked::after': {
              content: '""',
              position: 'absolute',
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              width: '12px',
              height: '12px',
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 16 16' fill='white' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M12.207 4.793a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0l-2-2a1 1 0 011.414-1.414L6.5 9.086l4.293-4.293a1 1 0 011.414 0z'/%3E%3C/svg%3E")`,
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'center',
            },
          }}
        />
        <span className={labelClasses}>{label}</span>
      </label>
      {error && (
        <span
          id={errorId}
          className="mt-1 text-sm text-error-600"
          role="alert"
        >
          {error}
        </span>
      )}
    </div>
  );
});

Checkbox.displayName = 'Checkbox';

export default Checkbox;