// @ts-check
import { DateRange } from '../types/common';

// External imports
// intl ^1.2.0 - Internationalization support for number and currency formatting

// Constants
const DEFAULT_DECIMALS = 2;
const CURRENCY_LOCALE = 'pt-BR';
const CURRENCY_OPTIONS = {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: DEFAULT_DECIMALS,
  maximumFractionDigits: DEFAULT_DECIMALS
};

// Brazilian phone number validation regex
const PHONE_REGEX = /^\([1-9]{2}\) (?:[2-8]|9[1-9])[0-9]{3}\-[0-9]{4}$/;

// Cached formatters for better performance
const NUMBER_FORMATTER = new Intl.NumberFormat(CURRENCY_LOCALE);
const CURRENCY_FORMATTER = new Intl.NumberFormat(CURRENCY_LOCALE, CURRENCY_OPTIONS);

// Types
interface FormatOptions {
  decimals?: number;
  showSymbol?: boolean;
  compact?: boolean;
}

/**
 * Type guard to validate if value is a valid number
 * @param value - Value to check
 * @returns boolean indicating if value is a valid number
 */
const isValidNumber = (value: unknown): value is number => {
  return typeof value === 'number' && !isNaN(value) && isFinite(value);
};

/**
 * Formats a number as Brazilian Real (BRL) currency
 * @param value - Number to format as currency
 * @param options - Optional formatting configuration
 * @returns Formatted currency string
 * @throws Error if value is invalid
 */
export const formatCurrency = (value: number, options: FormatOptions = {}): string => {
  if (!isValidNumber(value)) {
    throw new Error('Invalid number provided for currency formatting');
  }

  const {
    decimals = DEFAULT_DECIMALS,
    showSymbol = true,
    compact = false
  } = options;

  const formatOptions: Intl.NumberFormatOptions = {
    ...CURRENCY_OPTIONS,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    notation: compact ? 'compact' : 'standard',
    currencyDisplay: showSymbol ? 'symbol' : 'code'
  };

  const formatter = new Intl.NumberFormat(CURRENCY_LOCALE, formatOptions);
  return formatter.format(value);
};

/**
 * Formats a number as a percentage with configurable precision
 * @param value - Number to format as percentage
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted percentage string
 * @throws Error if value is invalid
 */
export const formatPercentage = (value: number, decimals: number = DEFAULT_DECIMALS): string => {
  if (!isValidNumber(value)) {
    throw new Error('Invalid number provided for percentage formatting');
  }

  const formatOptions: Intl.NumberFormatOptions = {
    style: 'percent',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  };

  const formatter = new Intl.NumberFormat(CURRENCY_LOCALE, formatOptions);
  return formatter.format(value < 1 ? value : value / 100);
};

/**
 * Formats and validates Brazilian phone numbers
 * @param phoneNumber - Phone number string to format
 * @returns Formatted phone number string
 * @throws Error if phone number is invalid
 */
export const formatPhoneNumber = (phoneNumber: string): string => {
  // Remove non-numeric characters
  const cleaned = phoneNumber.replace(/\D/g, '');

  // Validate length
  if (cleaned.length !== 10 && cleaned.length !== 11) {
    throw new Error('Invalid phone number length');
  }

  // Validate area code (DDD)
  const areaCode = parseInt(cleaned.substring(0, 2));
  if (areaCode < 11 || areaCode > 99) {
    throw new Error('Invalid area code');
  }

  // Format based on length (mobile vs landline)
  const formatted = cleaned.length === 11
    ? `(${cleaned.substring(0, 2)}) ${cleaned.substring(2, 7)}-${cleaned.substring(7)}`
    : `(${cleaned.substring(0, 2)}) ${cleaned.substring(2, 6)}-${cleaned.substring(6)}`;

  if (!PHONE_REGEX.test(formatted)) {
    throw new Error('Invalid phone number format');
  }

  return formatted;
};

/**
 * Formats a number with Brazilian locale
 * @param value - Number to format
 * @param decimals - Number of decimal places
 * @returns Formatted number string
 * @throws Error if value is invalid
 */
export const formatNumber = (value: number, decimals: number = DEFAULT_DECIMALS): string => {
  if (!isValidNumber(value)) {
    throw new Error('Invalid number provided for formatting');
  }

  const formatOptions: Intl.NumberFormatOptions = {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  };

  return new Intl.NumberFormat(CURRENCY_LOCALE, formatOptions).format(value);
};

/**
 * Formats a date range into a localized string
 * @param dateRange - DateRange object containing start and end dates
 * @returns Formatted date range string
 */
export const formatDateRange = (dateRange: DateRange): string => {
  const { startDate, endDate } = dateRange;
  
  const formatOptions: Intl.DateTimeFormatOptions = {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  };

  const formatter = new Intl.DateTimeFormat(CURRENCY_LOCALE, formatOptions);
  return `${formatter.format(startDate)} - ${formatter.format(endDate)}`;
};

/**
 * Formats a compact number for display (e.g., 1K, 1M)
 * @param value - Number to format
 * @returns Formatted compact number string
 * @throws Error if value is invalid
 */
export const formatCompactNumber = (value: number): string => {
  if (!isValidNumber(value)) {
    throw new Error('Invalid number provided for compact formatting');
  }

  const formatOptions: Intl.NumberFormatOptions = {
    notation: 'compact',
    compactDisplay: 'short'
  };

  return new Intl.NumberFormat(CURRENCY_LOCALE, formatOptions).format(value);
};