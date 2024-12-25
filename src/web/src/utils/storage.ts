import { z } from 'zod'; // v3.22.0
import { ApiResponse } from '../types/common';
import { 
  setItem, 
  getItem, 
  removeItem, 
  clear 
} from '../lib/storage';

// Constants
export const USER_PREFERENCES_PREFIX = 'user_pref_';

// Types
interface StorageOptions {
  encrypt?: boolean;
  ttl?: number;
  storage?: 'local' | 'session';
}

// Generic user preference type
interface UserPreference<T> {
  value: T;
  lastUpdated: Date;
  encrypted: boolean;
}

// Schemas
const userPreferenceSchema = <T extends z.ZodType>(valueSchema: T) => z.object({
  value: valueSchema,
  lastUpdated: z.date(),
  encrypted: z.boolean()
});

/**
 * Type-safe wrapper for storing data with schema validation and optional encryption
 * @param key Storage key
 * @param value Value to store
 * @param schema Zod schema for validation
 * @param options Storage options including encryption and TTL
 */
export async function setTypedItem<T>(
  key: string,
  value: T,
  schema: z.Schema<T>,
  options: StorageOptions = {}
): Promise<void> {
  try {
    // Validate value against schema
    const validatedValue = schema.parse(value);

    // Default to encryption for sensitive data
    const shouldEncrypt = options.encrypt ?? true;

    await setItem(key, validatedValue, {
      ...options,
      encrypt: shouldEncrypt,
      schema
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(`Validation error: ${error.errors.map(e => e.message).join(', ')}`);
    }
    throw new Error(`Storage error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Type-safe wrapper for retrieving and validating stored data
 * @param key Storage key
 * @param schema Zod schema for validation
 * @param options Storage options
 * @returns Retrieved and validated value or null
 */
export async function getTypedItem<T>(
  key: string,
  schema: z.Schema<T>,
  options: StorageOptions = {}
): Promise<T | null> {
  try {
    const value = await getItem<T>(key, {
      ...options,
      schema
    });

    if (!value) {
      return null;
    }

    // Validate retrieved value against schema
    return schema.parse(value);
  } catch (error) {
    console.error('Error retrieving stored item:', error);
    return null;
  }
}

/**
 * Stores user preference with automatic encryption and namespace isolation
 * @param key Preference key
 * @param value Preference value
 */
export async function setUserPreference<T>(
  key: string,
  value: T,
  schema: z.Schema<T>
): Promise<void> {
  const prefKey = `${USER_PREFERENCES_PREFIX}${key}`;
  
  const preference: UserPreference<T> = {
    value,
    lastUpdated: new Date(),
    encrypted: true
  };

  const preferenceSchema = userPreferenceSchema(schema);

  await setTypedItem(
    prefKey,
    preference,
    preferenceSchema,
    { encrypt: true, storage: 'local' }
  );
}

/**
 * Retrieves user preference with automatic decryption and type validation
 * @param key Preference key
 * @param schema Schema for preference value validation
 * @returns Retrieved preference value or null
 */
export async function getUserPreference<T>(
  key: string,
  schema: z.Schema<T>
): Promise<T | null> {
  const prefKey = `${USER_PREFERENCES_PREFIX}${key}`;
  
  const preferenceSchema = userPreferenceSchema(schema);
  
  const preference = await getTypedItem<UserPreference<T>>(
    prefKey,
    preferenceSchema,
    { encrypt: true, storage: 'local' }
  );

  return preference?.value ?? null;
}

/**
 * Removes a user preference
 * @param key Preference key
 */
export async function removeUserPreference(key: string): Promise<void> {
  const prefKey = `${USER_PREFERENCES_PREFIX}${key}`;
  await removeItem(prefKey);
}

/**
 * Clears all stored data
 */
export async function clearStorage(): Promise<void> {
  await clear();
}