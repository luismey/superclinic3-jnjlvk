import { format, isValid, parseISO } from 'date-fns'; // v2.30.0
import { ptBR } from 'date-fns/locale'; // v2.30.0
import { DateRange } from '../types/common';

// Constants for date formatting and validation
export const DEFAULT_DATE_FORMAT = 'dd/MM/yyyy';

export const DATE_FORMATS = {
  SHORT: 'dd/MM/yy',
  MEDIUM: 'dd/MM/yyyy',
  LONG: 'dd MMMM yyyy',
  DATETIME: 'dd/MM/yyyy HH:mm',
  ANALYTICS: 'yyyy-MM-dd',
  CAMPAIGN: 'dd/MM/yyyy HH:mm:ss'
} as const;

export const TIME_PERIODS = {
  TODAY: 'today',
  LAST_7_DAYS: '7d',
  LAST_30_DAYS: '30d',
  LAST_90_DAYS: '90d',
  CUSTOM: 'custom',
  MONTH_TO_DATE: 'mtd',
  YEAR_TO_DATE: 'ytd'
} as const;

export const ERROR_MESSAGES = {
  INVALID_DATE: 'Data inválida',
  INVALID_RANGE: 'Período inválido',
  FUTURE_DATE: 'Data não pode ser futura',
  INVALID_FORMAT: 'Formato de data inválido'
} as const;

// Memoization cache for frequently formatted dates
const formatCache = new Map<string, string>();
const CACHE_MAX_SIZE = 1000;

/**
 * Formats a date using Brazilian locale with enhanced error handling and memoization
 * @param date - The date to format
 * @param formatString - The format string to use (defaults to DEFAULT_DATE_FORMAT)
 * @returns Formatted date string in Brazilian Portuguese
 * @throws Error if date is invalid
 */
export function formatDate(date: Date, formatString: string = DEFAULT_DATE_FORMAT): string {
  if (!isValid(date)) {
    throw new Error(ERROR_MESSAGES.INVALID_DATE);
  }

  const cacheKey = `${date.getTime()}-${formatString}`;
  
  if (formatCache.has(cacheKey)) {
    return formatCache.get(cacheKey)!;
  }

  try {
    const formatted = format(date, formatString, { locale: ptBR });
    
    // Cache management
    if (formatCache.size >= CACHE_MAX_SIZE) {
      const firstKey = formatCache.keys().next().value;
      formatCache.delete(firstKey);
    }
    formatCache.set(cacheKey, formatted);
    
    return formatted;
  } catch (error) {
    throw new Error(ERROR_MESSAGES.INVALID_FORMAT);
  }
}

/**
 * Safely parses date strings with enhanced validation and timezone handling
 * @param dateString - The date string to parse
 * @returns Parsed Date object in correct timezone
 * @throws Error if date string is invalid
 */
export function parseDate(dateString: string): Date {
  try {
    const parsedDate = parseISO(dateString);
    if (!isValid(parsedDate)) {
      throw new Error(ERROR_MESSAGES.INVALID_DATE);
    }
    return parsedDate;
  } catch (error) {
    throw new Error(ERROR_MESSAGES.INVALID_DATE);
  }
}

/**
 * Creates a DateRange with enhanced period support and timezone handling
 * @param period - The time period to create range for
 * @returns Validated date range object
 * @throws Error if period is invalid
 */
export function getDateRange(period: string): DateRange {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  switch (period) {
    case TIME_PERIODS.TODAY:
      return {
        startDate: startOfDay,
        endDate: now
      };
      
    case TIME_PERIODS.LAST_7_DAYS:
      return {
        startDate: new Date(startOfDay.getTime() - 6 * 24 * 60 * 60 * 1000),
        endDate: now
      };
      
    case TIME_PERIODS.LAST_30_DAYS:
      return {
        startDate: new Date(startOfDay.getTime() - 29 * 24 * 60 * 60 * 1000),
        endDate: now
      };
      
    case TIME_PERIODS.LAST_90_DAYS:
      return {
        startDate: new Date(startOfDay.getTime() - 89 * 24 * 60 * 60 * 1000),
        endDate: now
      };
      
    case TIME_PERIODS.MONTH_TO_DATE:
      return {
        startDate: new Date(now.getFullYear(), now.getMonth(), 1),
        endDate: now
      };
      
    case TIME_PERIODS.YEAR_TO_DATE:
      return {
        startDate: new Date(now.getFullYear(), 0, 1),
        endDate: now
      };
      
    default:
      throw new Error(ERROR_MESSAGES.INVALID_RANGE);
  }
}

/**
 * Comprehensive date range validation with business rules
 * @param range - The date range to validate
 * @returns Boolean indicating if range is valid
 */
export function isValidDateRange(range: DateRange): boolean {
  if (!range || !range.startDate || !range.endDate) {
    return false;
  }

  if (!isValid(range.startDate) || !isValid(range.endDate)) {
    return false;
  }

  if (range.startDate > range.endDate) {
    return false;
  }

  const now = new Date();
  if (range.endDate > now) {
    return false;
  }

  // Maximum range of 1 year
  const oneYearInMs = 365 * 24 * 60 * 60 * 1000;
  if (range.endDate.getTime() - range.startDate.getTime() > oneYearInMs) {
    return false;
  }

  return true;
}

/**
 * Brazilian holidays for business day calculations
 */
const BRAZILIAN_HOLIDAYS = [
  '01-01', // Ano Novo
  '04-21', // Tiradentes
  '05-01', // Dia do Trabalho
  '09-07', // Independência
  '10-12', // Nossa Senhora
  '11-02', // Finados
  '11-15', // Proclamação da República
  '12-25', // Natal
] as const;

/**
 * Adds days to date with business day handling
 * @param date - The starting date
 * @param days - Number of days to add
 * @returns New date with added days
 * @throws Error if date is invalid
 */
export function addDays(date: Date, days: number): Date {
  if (!isValid(date)) {
    throw new Error(ERROR_MESSAGES.INVALID_DATE);
  }

  let currentDate = new Date(date);
  let remainingDays = days;
  
  while (remainingDays > 0) {
    currentDate = new Date(currentDate.getTime() + 24 * 60 * 60 * 1000);
    
    // Skip weekends
    if (currentDate.getDay() === 0 || currentDate.getDay() === 6) {
      continue;
    }
    
    // Skip Brazilian holidays
    const monthDay = `${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;
    if (BRAZILIAN_HOLIDAYS.includes(monthDay as typeof BRAZILIAN_HOLIDAYS[number])) {
      continue;
    }
    
    remainingDays--;
  }
  
  return currentDate;
}