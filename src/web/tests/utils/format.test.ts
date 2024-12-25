import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import {
  formatCurrency,
  formatPercentage,
  formatNumber,
  formatPhoneNumber,
  truncateText
} from '../../src/utils/format';

describe('formatCurrency', () => {
  test('formats currency with proper Brazilian Real symbol and separators', () => {
    expect(formatCurrency(1234.56)).toBe('R$ 1.234,56');
    expect(formatCurrency(1000000.00)).toBe('R$ 1.000.000,00');
    expect(formatCurrency(0.99)).toBe('R$ 0,99');
  });

  test('handles negative values correctly', () => {
    expect(formatCurrency(-1234.56)).toBe('-R$ 1.234,56');
    expect(formatCurrency(-0.99)).toBe('-R$ 0,99');
  });

  test('formats zero and small values properly', () => {
    expect(formatCurrency(0)).toBe('R$ 0,00');
    expect(formatCurrency(0.01)).toBe('R$ 0,01');
    expect(formatCurrency(0.1)).toBe('R$ 0,10');
  });

  test('handles large numbers correctly', () => {
    expect(formatCurrency(1000000000.00)).toBe('R$ 1.000.000.000,00');
    expect(formatCurrency(1234567.89)).toBe('R$ 1.234.567,89');
  });

  test('throws error for invalid inputs', () => {
    expect(() => formatCurrency(NaN)).toThrow('Invalid number provided for currency formatting');
    expect(() => formatCurrency(Infinity)).toThrow('Invalid number provided for currency formatting');
    // @ts-expect-error Testing invalid input
    expect(() => formatCurrency('123')).toThrow('Invalid number provided for currency formatting');
  });
});

describe('formatPercentage', () => {
  test('formats percentages with default precision (2 decimals)', () => {
    expect(formatPercentage(0.1234)).toBe('12,34%');
    expect(formatPercentage(0.5)).toBe('50,00%');
    expect(formatPercentage(1)).toBe('100,00%');
  });

  test('handles custom decimal precision', () => {
    expect(formatPercentage(0.1234, 1)).toBe('12,3%');
    expect(formatPercentage(0.1234, 0)).toBe('12%');
    expect(formatPercentage(0.1234, 3)).toBe('12,340%');
  });

  test('formats small percentages correctly', () => {
    expect(formatPercentage(0.0001)).toBe('0,01%');
    expect(formatPercentage(0.00001)).toBe('0,00%');
  });

  test('handles zero and negative percentages', () => {
    expect(formatPercentage(0)).toBe('0,00%');
    expect(formatPercentage(-0.5)).toBe('-50,00%');
    expect(formatPercentage(-0.0025)).toBe('-0,25%');
  });

  test('throws error for invalid inputs', () => {
    expect(() => formatPercentage(NaN)).toThrow('Invalid number provided for percentage formatting');
    expect(() => formatPercentage(Infinity)).toThrow('Invalid number provided for percentage formatting');
    // @ts-expect-error Testing invalid input
    expect(() => formatPercentage('50%')).toThrow('Invalid number provided for percentage formatting');
  });
});

describe('formatNumber', () => {
  test('formats numbers with Brazilian locale separators', () => {
    expect(formatNumber(1234.56)).toBe('1.234,56');
    expect(formatNumber(1000000.00)).toBe('1.000.000,00');
    expect(formatNumber(0.99)).toBe('0,99');
  });

  test('handles custom decimal precision', () => {
    expect(formatNumber(1234.5678, 3)).toBe('1.234,568');
    expect(formatNumber(1234.5678, 1)).toBe('1.234,6');
    expect(formatNumber(1234.5678, 0)).toBe('1.235');
  });

  test('formats negative numbers correctly', () => {
    expect(formatNumber(-1234.56)).toBe('-1.234,56');
    expect(formatNumber(-0.99)).toBe('-0,99');
  });

  test('handles zero and small numbers', () => {
    expect(formatNumber(0)).toBe('0,00');
    expect(formatNumber(0.001, 3)).toBe('0,001');
    expect(formatNumber(0.1)).toBe('0,10');
  });

  test('throws error for invalid inputs', () => {
    expect(() => formatNumber(NaN)).toThrow('Invalid number provided for formatting');
    expect(() => formatNumber(Infinity)).toThrow('Invalid number provided for formatting');
    // @ts-expect-error Testing invalid input
    expect(() => formatNumber('123')).toThrow('Invalid number provided for formatting');
  });
});

describe('formatPhoneNumber', () => {
  test('formats mobile numbers (11 digits) correctly', () => {
    expect(formatPhoneNumber('11999999999')).toBe('(11) 99999-9999');
    expect(formatPhoneNumber('21987654321')).toBe('(21) 98765-4321');
  });

  test('formats landline numbers (10 digits) correctly', () => {
    expect(formatPhoneNumber('1123456789')).toBe('(11) 2345-6789');
    expect(formatPhoneNumber('2134567890')).toBe('(21) 3456-7890');
  });

  test('handles different input formats', () => {
    expect(formatPhoneNumber('(11)999999999')).toBe('(11) 99999-9999');
    expect(formatPhoneNumber('11 99999-9999')).toBe('(11) 99999-9999');
    expect(formatPhoneNumber('11.9999.9999')).toBe('(11) 9999-9999');
  });

  test('validates area codes correctly', () => {
    expect(() => formatPhoneNumber('00999999999')).toThrow('Invalid area code');
    expect(() => formatPhoneNumber('10999999999')).toThrow('Invalid area code');
    expect(() => formatPhoneNumber('100999999999')).toThrow('Invalid area code');
  });

  test('throws error for invalid phone numbers', () => {
    expect(() => formatPhoneNumber('123')).toThrow('Invalid phone number length');
    expect(() => formatPhoneNumber('123456789012')).toThrow('Invalid phone number length');
    expect(() => formatPhoneNumber('abc12345678')).toThrow('Invalid phone number length');
  });
});

describe('truncateText', () => {
  test('truncates text with ellipsis when exceeding max length', () => {
    const longText = 'This is a very long text that needs to be truncated';
    expect(truncateText(longText, 20)).toBe('This is a very long...');
    expect(truncateText(longText, 10)).toBe('This is...');
  });

  test('handles text shorter than max length', () => {
    expect(truncateText('Short text', 20)).toBe('Short text');
    expect(truncateText('Hi', 5)).toBe('Hi');
  });

  test('handles text exactly matching max length', () => {
    expect(truncateText('Exact Length', 11)).toBe('Exact Length');
  });

  test('handles whitespace correctly', () => {
    expect(truncateText('   Padded   Text   ', 10)).toBe('   Padded...');
    expect(truncateText('\tTabbed\nText', 8)).toBe('\tTabbed...');
  });

  test('handles empty and null inputs', () => {
    expect(truncateText('', 10)).toBe('');
    // @ts-expect-error Testing null input
    expect(() => truncateText(null, 10)).toThrow();
    // @ts-expect-error Testing undefined input
    expect(() => truncateText(undefined, 10)).toThrow();
  });

  test('throws error for invalid max length', () => {
    expect(() => truncateText('Test', -1)).toThrow();
    expect(() => truncateText('Test', 0)).toThrow();
    // @ts-expect-error Testing invalid maxLength
    expect(() => truncateText('Test', '10')).toThrow();
  });
});