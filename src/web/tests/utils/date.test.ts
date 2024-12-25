import { describe, it, expect } from '@jest/globals'; // v29.0.0
import {
  formatDate,
  parseDate,
  getDateRange,
  isValidDateRange,
  addDays,
  DEFAULT_DATE_FORMAT,
  DATE_FORMATS,
  TIME_PERIODS,
  ERROR_MESSAGES
} from '../../src/utils/date';
import type { DateRange } from '../../src/types/common';

// Test constants
const TEST_DATE = new Date('2023-12-25');
const TEST_DATE_STRING = '25/12/2023';
const INVALID_DATE_STRING = 'invalid-date';
const BRAZILIAN_HOLIDAYS = [
  new Date('2023-01-01'), // Ano Novo
  new Date('2023-04-21'), // Tiradentes
  new Date('2023-05-01'), // Dia do Trabalho
  new Date('2023-09-07'), // Independência
  new Date('2023-10-12'), // Nossa Senhora
  new Date('2023-11-02'), // Finados
  new Date('2023-11-15'), // Proclamação da República
  new Date('2023-12-25')  // Natal
];

describe('formatDate', () => {
  it('should format date with default Brazilian format (dd/MM/yyyy)', () => {
    expect(formatDate(TEST_DATE)).toBe(TEST_DATE_STRING);
  });

  it('should format date with custom format strings', () => {
    expect(formatDate(TEST_DATE, DATE_FORMATS.SHORT)).toBe('25/12/23');
    expect(formatDate(TEST_DATE, DATE_FORMATS.LONG)).toBe('25 dezembro 2023');
    expect(formatDate(TEST_DATE, DATE_FORMATS.DATETIME)).toMatch(/25\/12\/2023 \d{2}:\d{2}/);
  });

  it('should format Brazilian holidays correctly', () => {
    const christmasFormatted = formatDate(TEST_DATE, DATE_FORMATS.LONG);
    expect(christmasFormatted).toBe('25 dezembro 2023');
  });

  it('should preserve timezone information', () => {
    const dateWithTZ = new Date('2023-12-25T10:30:00-03:00');
    const formatted = formatDate(dateWithTZ, DATE_FORMATS.DATETIME);
    expect(formatted).toMatch(/25\/12\/2023 10:30/);
  });

  it('should throw localized error for invalid date', () => {
    expect(() => formatDate(new Date(INVALID_DATE_STRING)))
      .toThrow(ERROR_MESSAGES.INVALID_DATE);
  });
});

describe('parseDate', () => {
  it('should parse Brazilian date formats', () => {
    const parsedDate = parseDate('2023-12-25');
    expect(parsedDate).toEqual(TEST_DATE);
  });

  it('should handle multiple format patterns', () => {
    const isoDate = parseDate('2023-12-25T00:00:00.000Z');
    expect(isoDate).toEqual(TEST_DATE);
  });

  it('should maintain timezone information', () => {
    const dateWithTZ = parseDate('2023-12-25T10:30:00-03:00');
    expect(dateWithTZ.getHours()).toBe(10);
  });

  it('should throw localized error for invalid format', () => {
    expect(() => parseDate(INVALID_DATE_STRING))
      .toThrow(ERROR_MESSAGES.INVALID_DATE);
  });
});

describe('getDateRange', () => {
  it('should calculate today range correctly', () => {
    const range = getDateRange(TIME_PERIODS.TODAY);
    const now = new Date();
    expect(range.startDate.getDate()).toBe(now.getDate());
    expect(range.endDate.getDate()).toBe(now.getDate());
  });

  it('should calculate last 7 days range correctly', () => {
    const range = getDateRange(TIME_PERIODS.LAST_7_DAYS);
    const now = new Date();
    const diff = Math.floor((now.getTime() - range.startDate.getTime()) / (1000 * 60 * 60 * 24));
    expect(diff).toBe(6);
  });

  it('should calculate last 30 days range correctly', () => {
    const range = getDateRange(TIME_PERIODS.LAST_30_DAYS);
    const now = new Date();
    const diff = Math.floor((now.getTime() - range.startDate.getTime()) / (1000 * 60 * 60 * 24));
    expect(diff).toBe(29);
  });

  it('should handle month-to-date range correctly', () => {
    const range = getDateRange(TIME_PERIODS.MONTH_TO_DATE);
    expect(range.startDate.getDate()).toBe(1);
    expect(range.endDate.getDate()).toBe(new Date().getDate());
  });

  it('should throw error for invalid period', () => {
    expect(() => getDateRange('invalid-period'))
      .toThrow(ERROR_MESSAGES.INVALID_RANGE);
  });
});

describe('isValidDateRange', () => {
  it('should validate correct date ranges', () => {
    const validRange: DateRange = {
      startDate: new Date('2023-01-01'),
      endDate: new Date('2023-12-31')
    };
    expect(isValidDateRange(validRange)).toBe(true);
  });

  it('should reject ranges with end date before start date', () => {
    const invalidRange: DateRange = {
      startDate: new Date('2023-12-31'),
      endDate: new Date('2023-01-01')
    };
    expect(isValidDateRange(invalidRange)).toBe(false);
  });

  it('should reject future end dates', () => {
    const futureRange: DateRange = {
      startDate: new Date(),
      endDate: new Date('2025-12-31')
    };
    expect(isValidDateRange(futureRange)).toBe(false);
  });

  it('should handle null/undefined dates', () => {
    expect(isValidDateRange({} as DateRange)).toBe(false);
    expect(isValidDateRange({ startDate: new Date() } as DateRange)).toBe(false);
    expect(isValidDateRange({ endDate: new Date() } as DateRange)).toBe(false);
  });
});

describe('addDays', () => {
  it('should add business days correctly', () => {
    const result = addDays(new Date('2023-12-20'), 3);
    expect(result.getDate()).toBe(26); // Skips weekend
  });

  it('should skip Brazilian holidays', () => {
    const result = addDays(new Date('2023-12-22'), 2);
    expect(result.getDate()).toBe(27); // Skips Christmas
  });

  it('should handle month transitions', () => {
    const result = addDays(new Date('2023-12-29'), 3);
    expect(result.getMonth()).toBe(0); // January
    expect(result.getDate()).toBe(3);  // Skips New Year
  });

  it('should throw error for invalid date', () => {
    expect(() => addDays(new Date(INVALID_DATE_STRING), 1))
      .toThrow(ERROR_MESSAGES.INVALID_DATE);
  });

  it('should handle zero days addition', () => {
    const date = new Date('2023-12-20');
    const result = addDays(date, 0);
    expect(result).toEqual(date);
  });
});