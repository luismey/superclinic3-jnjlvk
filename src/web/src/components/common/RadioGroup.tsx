import React, { useCallback, useRef, KeyboardEvent } from 'react';
import classNames from 'classnames';
import { colors, typography, spacing } from '../../config/theme';

interface RadioGroupProps {
  id?: string;
  name: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
  disabled?: boolean;
  error?: string;
  className?: string;
  required?: boolean;
  'aria-label'?: string;
}

const RadioGroup: React.FC<RadioGroupProps> = ({
  id,
  name,
  value,
  options,
  onChange,
  disabled = false,
  error,
  className,
  required = false,
  'aria-label': ariaLabel,
}) => {
  const radioRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>, currentIndex: number) => {
    const lastIndex = options.length - 1;
    let nextIndex = currentIndex;

    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        nextIndex = currentIndex === lastIndex ? 0 : currentIndex + 1;
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        nextIndex = currentIndex === 0 ? lastIndex : currentIndex - 1;
        break;
      default:
        return;
    }

    event.preventDefault();
    const nextRadio = radioRefs.current[nextIndex];
    if (nextRadio) {
      nextRadio.focus();
      onChange(options[nextIndex].value);
    }
  }, [options, onChange]);

  // Generate unique IDs for accessibility
  const groupId = id || `radio-group-${name}`;
  const errorId = `${groupId}-error`;

  const radioGroupStyles = classNames(
    'flex flex-col gap-2',
    {
      'opacity-50 cursor-not-allowed': disabled,
    },
    className
  );

  const radioItemStyles = (checked: boolean) => classNames(
    'flex items-center gap-2 cursor-pointer p-2 rounded transition-colors',
    {
      'hover:bg-primary-50': !disabled && !checked,
      'bg-primary-100': checked && !disabled,
      'cursor-not-allowed': disabled,
    }
  );

  const radioCircleStyles = (checked: boolean) => classNames(
    'w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors',
    {
      'border-primary-600': checked && !disabled && !error,
      'border-error-500': error,
      'border-secondary-300': !checked && !error,
      'border-secondary-200': disabled,
    }
  );

  const labelStyles = classNames(
    'text-semantic-text-primary',
    typography.sizes.base,
    {
      'text-semantic-text-disabled': disabled,
    }
  );

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      aria-required={required}
      aria-invalid={!!error}
      aria-errormessage={error ? errorId : undefined}
      className={radioGroupStyles}
    >
      {options.map((option, index) => {
        const radioId = `${groupId}-${option.value}`;
        const isChecked = value === option.value;

        return (
          <label
            key={option.value}
            htmlFor={radioId}
            className={radioItemStyles(isChecked)}
          >
            <div className="relative">
              <input
                ref={el => radioRefs.current[index] = el}
                type="radio"
                id={radioId}
                name={name}
                value={option.value}
                checked={isChecked}
                onChange={() => onChange(option.value)}
                onKeyDown={(e) => handleKeyDown(e, index)}
                disabled={disabled}
                className="sr-only"
                aria-describedby={error ? errorId : undefined}
              />
              <div className={radioCircleStyles(isChecked)}>
                {isChecked && (
                  <div
                    className={classNames(
                      'w-2 h-2 rounded-full',
                      {
                        'bg-primary-600': !disabled && !error,
                        'bg-error-500': error,
                        'bg-secondary-200': disabled,
                      }
                    )}
                  />
                )}
              </div>
            </div>
            <span className={labelStyles}>{option.label}</span>
          </label>
        );
      })}
      {error && (
        <div
          id={errorId}
          role="alert"
          className={classNames(
            'text-error-500',
            typography.sizes.sm,
            spacing[2]
          )}
        >
          {error}
        </div>
      )}
    </div>
  );
};

export default RadioGroup;