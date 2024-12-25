import { z } from 'zod'; // v3.22.0

// Constants for regular expressions and character mappings
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const HTML_REGEX = /<[^>]*>/g;
const SPECIAL_CHARS_REGEX = /[^a-zA-Z0-9-]/g;
const PORTUGUESE_CHARS: { [key: string]: string } = {
  'á': 'a', 'à': 'a', 'ã': 'a', 'â': 'a',
  'é': 'e', 'ê': 'e',
  'í': 'i',
  'ó': 'o', 'õ': 'o', 'ô': 'o',
  'ú': 'u',
  'ç': 'c'
};

// Zod schemas for input validation
const stringSchema = z.string().min(1);
const emailSchema = z.string().email();
const lengthSchema = z.number().int().positive().max(1000);

// Type for memoization decorator
type Memoizable = (target: any, propertyKey: string, descriptor: PropertyDescriptor) => void;

/**
 * Memoization decorator for caching function results
 */
const memoize: Memoizable = (target, propertyKey, descriptor) => {
  const originalMethod = descriptor.value;
  const cache = new Map<string, any>();

  descriptor.value = function (...args: any[]) {
    const key = JSON.stringify(args);
    if (cache.has(key)) {
      return cache.get(key);
    }
    const result = originalMethod.apply(this, args);
    cache.set(key, result);
    return result;
  };
};

/**
 * Removes diacritical marks from Brazilian Portuguese text
 * @param text - Input text to process
 * @returns Normalized text without diacritical marks
 */
export const removeAccents = (text: string): string => {
  try {
    stringSchema.parse(text);
    
    if (!text) return '';

    // Normalize string and remove combining diacritical marks
    let normalized = text.normalize('NFD');
    
    // Handle Portuguese-specific character mappings
    Object.entries(PORTUGUESE_CHARS).forEach(([accented, plain]) => {
      normalized = normalized.replace(new RegExp(accented, 'g'), plain);
    });

    return normalized.replace(/[\u0300-\u036f]/g, '');
  } catch (error) {
    console.error('Error in removeAccents:', error);
    return '';
  }
};

/**
 * Converts text to URL-friendly slug format
 * @param text - Input text to convert
 * @returns URL-friendly slug
 */
export const slugify = (text: string): string => {
  try {
    stringSchema.parse(text);
    
    if (!text) return '';

    return text
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
      .replace(SPECIAL_CHARS_REGEX, '')
      .replace(/-+/g, '-');
  } catch (error) {
    console.error('Error in slugify:', error);
    return '';
  }
};

/**
 * Removes HTML tags with enhanced security
 * @param html - Input HTML string
 * @returns Sanitized text without HTML
 */
export const sanitizeHtml = (html: string): string => {
  try {
    stringSchema.parse(html);
    
    if (!html) return '';

    // Remove script and style tags first
    let sanitized = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');

    // Remove remaining HTML tags
    sanitized = sanitized.replace(HTML_REGEX, '');

    // Decode HTML entities safely
    const textarea = document.createElement('textarea');
    textarea.innerHTML = sanitized;
    return textarea.value;
  } catch (error) {
    console.error('Error in sanitizeHtml:', error);
    return '';
  }
};

/**
 * Validates email address format with enhanced security
 * @param email - Email address to validate
 * @returns Boolean indicating if email is valid
 */
export const validateEmail = (email: string): boolean => {
  try {
    emailSchema.parse(email);
    
    if (!email) return false;

    // Additional security checks
    if (email.length > 254) return false;
    if (email.includes('..')) return false;
    
    return EMAIL_REGEX.test(email);
  } catch (error) {
    console.error('Error in validateEmail:', error);
    return false;
  }
};

/**
 * Capitalizes first letter of each word with Portuguese support
 * @param text - Input text to capitalize
 * @returns Text with capitalized words
 */
export const capitalizeFirstLetter = (text: string): string => {
  try {
    stringSchema.parse(text);
    
    if (!text) return '';

    return text
      .split(' ')
      .map(word => {
        if (!word) return '';
        const firstChar = word.charAt(0).toUpperCase();
        const rest = word.slice(1).toLowerCase();
        return `${firstChar}${rest}`;
      })
      .join(' ');
  } catch (error) {
    console.error('Error in capitalizeFirstLetter:', error);
    return '';
  }
};

/**
 * Generates a cryptographically secure random string
 * @param length - Desired length of the random string
 * @returns Secure random alphanumeric string
 */
export const generateRandomString = (length: number): string => {
  try {
    lengthSchema.parse(length);
    
    const array = new Uint8Array(Math.ceil(length * 1.5));
    crypto.getRandomValues(array);
    
    return Array.from(array)
      .map(byte => byte % 36)
      .map(value => value.toString(36))
      .join('')
      .slice(0, length);
  } catch (error) {
    console.error('Error in generateRandomString:', error);
    return '';
  }
};