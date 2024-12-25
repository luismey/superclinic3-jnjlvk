import React, { useCallback, useRef, useState, useMemo } from 'react';
import ReactDatePicker, { registerLocale } from 'react-datepicker'; // v4.0.0
import { ptBR } from 'date-fns/locale'; // v2.30.0
import classNames from 'classnames'; // v2.3.0
import { DateRange } from '../../types/common';
import { formatDate } from '../../utils/date';
import { useAnalytics } from '../../hooks/useAnalytics';

// Register Brazilian Portuguese locale
registerLocale('pt-BR', ptBR);

// Constants for date constraints and analytics
const MAX_YEAR_RANGE = 1;
const ANALYTICS_EVENTS = {
  DATE_SELECTED: 'date_picker_selection',
  RANGE_SELECTED: 'date_picker_range_selection',
  ERROR_OCCURRED: 'date_picker_error'
} as const;

export interface DatePickerProps {
  // Core props
  value?: Date | null;
  onChange?: (date: Date | null) => void;
  range?: DateRange | null;
  onRangeChange?: (range: DateRange) => void;
  isRangeMode?: boolean;

  // Constraints
  minDate?: Date;
  maxDate?: Date;
  disabled?: boolean;

  // UI State
  isLoading?: boolean;
  errorMessage?: string;

  // Customization
  className?: string;
  customFormat?: string;
  timezone?: string;
}

export const DatePicker = React.memo(({
  value,
  onChange,
  range,
  onRangeChange,
  isRangeMode = false,
  minDate,
  maxDate,
  disabled = false,
  isLoading = false,
  errorMessage,
  className,
  customFormat,
  timezone = 'America/Sao_Paulo'
}: DatePickerProps) => {
  // Refs and state
  const pickerRef = useRef<ReactDatePicker>(null);
  const [internalError, setInternalError] = useState<string>('');
  const { trackEvent } = useAnalytics();

  // Memoized date format
  const dateFormat = useMemo(() => 
    customFormat || 'dd/MM/yyyy',
    [customFormat]
  );

  // Calculate default constraints if not provided
  const defaultMaxDate = useMemo(() => {
    const date = new Date();
    date.setFullYear(date.getFullYear() + MAX_YEAR_RANGE);
    return date;
  }, []);

  const defaultMinDate = useMemo(() => {
    const date = new Date();
    date.setFullYear(date.getFullYear() - MAX_YEAR_RANGE);
    return date;
  }, []);

  // Handlers
  const handleDateChange = useCallback((date: Date | null) => {
    try {
      if (!onChange) return;

      // Validate date constraints
      if (date) {
        const effectiveMinDate = minDate || defaultMinDate;
        const effectiveMaxDate = maxDate || defaultMaxDate;

        if (date < effectiveMinDate || date > effectiveMaxDate) {
          throw new Error('Data fora do período permitido');
        }

        // Adjust for timezone if specified
        if (timezone) {
          date = new Date(date.toLocaleString('en-US', { timeZone: timezone }));
        }
      }

      // Track analytics
      trackEvent(ANALYTICS_EVENTS.DATE_SELECTED, {
        date: date ? formatDate(date) : null,
        isValid: true
      });

      setInternalError('');
      onChange(date);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao selecionar data';
      setInternalError(errorMessage);
      
      trackEvent(ANALYTICS_EVENTS.ERROR_OCCURRED, {
        error: errorMessage,
        date: date ? formatDate(date) : null
      });
    }
  }, [onChange, minDate, maxDate, defaultMinDate, defaultMaxDate, timezone, trackEvent]);

  const handleRangeChange = useCallback((dates: [Date | null, Date | null]) => {
    try {
      if (!onRangeChange) return;

      const [start, end] = dates;
      if (!start || !end) return;

      // Validate range constraints
      const effectiveMinDate = minDate || defaultMinDate;
      const effectiveMaxDate = maxDate || defaultMaxDate;

      if (start < effectiveMinDate || end > effectiveMaxDate) {
        throw new Error('Período fora do intervalo permitido');
      }

      if (start > end) {
        throw new Error('Data inicial deve ser anterior à data final');
      }

      // Adjust for timezone
      const adjustedStart = timezone ? 
        new Date(start.toLocaleString('en-US', { timeZone: timezone })) : start;
      const adjustedEnd = timezone ? 
        new Date(end.toLocaleString('en-US', { timeZone: timezone })) : end;

      const dateRange: DateRange = {
        startDate: adjustedStart,
        endDate: adjustedEnd
      };

      // Track analytics
      trackEvent(ANALYTICS_EVENTS.RANGE_SELECTED, {
        startDate: formatDate(adjustedStart),
        endDate: formatDate(adjustedEnd),
        isValid: true
      });

      setInternalError('');
      onRangeChange(dateRange);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao selecionar período';
      setInternalError(errorMessage);

      trackEvent(ANALYTICS_EVENTS.ERROR_OCCURRED, {
        error: errorMessage,
        dates: dates.map(d => d ? formatDate(d) : null)
      });
    }
  }, [onRangeChange, minDate, maxDate, defaultMinDate, defaultMaxDate, timezone, trackEvent]);

  // Render helpers
  const renderError = () => {
    const error = errorMessage || internalError;
    if (!error) return null;

    return (
      <div 
        role="alert" 
        className="text-sm text-red-600 mt-1"
        aria-live="polite"
      >
        {error}
      </div>
    );
  };

  const renderLoader = () => {
    if (!isLoading) return null;

    return (
      <div 
        role="status"
        className="absolute right-3 top-1/2 transform -translate-y-1/2"
      >
        <div className="w-4 h-4 border-2 border-gray-300 border-t-primary rounded-full animate-spin" />
        <span className="sr-only">Carregando...</span>
      </div>
    );
  };

  return (
    <div className={classNames('relative', className)}>
      <ReactDatePicker
        ref={pickerRef}
        selected={value}
        onChange={isRangeMode ? handleRangeChange : handleDateChange}
        startDate={range?.startDate}
        endDate={range?.endDate}
        selectsRange={isRangeMode}
        dateFormat={dateFormat}
        locale="pt-BR"
        minDate={minDate || defaultMinDate}
        maxDate={maxDate || defaultMaxDate}
        disabled={disabled || isLoading}
        className={classNames(
          'w-full px-4 py-2 border rounded-md shadow-sm',
          'focus:ring-2 focus:ring-primary focus:border-primary',
          'disabled:bg-gray-100 disabled:cursor-not-allowed',
          {
            'border-red-500': errorMessage || internalError,
            'pr-10': isLoading
          }
        )}
        calendarClassName="bg-white shadow-lg rounded-lg border"
        showMonthDropdown
        showYearDropdown
        dropdownMode="select"
        isClearable
        placeholderText={isRangeMode ? 'Selecione um período' : 'Selecione uma data'}
        aria-label={isRangeMode ? 'Seletor de período' : 'Seletor de data'}
        aria-invalid={!!(errorMessage || internalError)}
        aria-describedby={errorMessage || internalError ? 'date-picker-error' : undefined}
      />
      {renderLoader()}
      {renderError()}
    </div>
  );
});

DatePicker.displayName = 'DatePicker';

export default DatePicker;