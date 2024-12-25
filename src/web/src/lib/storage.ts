import { z } from 'zod'; // v3.22.0
import CryptoJS from 'crypto-js'; // v4.1.1
import { ApiError } from '../types/common';

// Constants
const STORAGE_PREFIX = 'porfin_';
const ENCRYPTION_KEY = process.env.NEXT_PUBLIC_STORAGE_KEY || '';
const DEFAULT_QUOTA_MB = 5;
const CLEANUP_INTERVAL_MS = 300000; // 5 minutes

// Types
export type StorageType = 'local' | 'session';

interface StorageMetadata {
  version: string;
  encrypted: boolean;
  iv?: string;
  expiresAt?: number;
  schemaVersion?: string;
}

interface StorageData<T> {
  metadata: StorageMetadata;
  value: T;
}

interface StorageOptions {
  storage?: StorageType;
  encrypt?: boolean;
  ttl?: number;
  schema?: z.ZodType;
  version?: string;
}

/**
 * Enhanced storage service with encryption, validation, and quota management
 */
export class StorageService {
  private readonly secretKey: string;
  private readonly defaultStorage: StorageType;
  private readonly quotaLimit: number;
  private readonly memoryCache: Map<string, any>;
  private readonly cleanupInterval: NodeJS.Timer;

  constructor(secretKey?: string, options: Partial<StorageOptions> = {}) {
    this.secretKey = secretKey || ENCRYPTION_KEY;
    this.defaultStorage = options.storage || 'local';
    this.quotaLimit = DEFAULT_QUOTA_MB * 1024 * 1024; // Convert to bytes
    this.memoryCache = new Map();

    // Validate encryption key if encryption will be used
    if (!this.secretKey) {
      console.warn('StorageService: No encryption key provided, encryption will be disabled');
    }

    // Initialize cleanup scheduler
    this.cleanupInterval = setInterval(() => this.cleanup(), CLEANUP_INTERVAL_MS);

    // Setup storage event listener for cross-tab synchronization
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', this.handleStorageEvent);
    }
  }

  /**
   * Stores a value with optional encryption and validation
   */
  public async setItem<T>(
    key: string,
    value: T,
    options: StorageOptions = {}
  ): Promise<void> {
    try {
      // Validate key format
      if (!key || typeof key !== 'string') {
        throw new Error('Invalid storage key');
      }

      // Validate schema if provided
      if (options.schema) {
        value = options.schema.parse(value);
      }

      // Prepare metadata
      const metadata: StorageMetadata = {
        version: options.version || '1.0',
        encrypted: false,
        schemaVersion: options.schema?.version,
      };

      if (options.ttl) {
        metadata.expiresAt = Date.now() + options.ttl;
      }

      let finalValue = value;

      // Handle encryption if enabled
      if (options.encrypt && this.secretKey) {
        const iv = CryptoJS.lib.WordArray.random(16);
        const encrypted = CryptoJS.AES.encrypt(
          JSON.stringify(value),
          this.secretKey,
          { iv }
        );
        
        metadata.encrypted = true;
        metadata.iv = iv.toString();
        finalValue = encrypted.toString();
      }

      const storageData: StorageData<T> = {
        metadata,
        value: finalValue,
      };

      // Check quota before storing
      const dataSize = new TextEncoder().encode(JSON.stringify(storageData)).length;
      if (!this.validateQuota(dataSize)) {
        throw new Error('Storage quota exceeded');
      }

      // Store in specified storage
      const storage = this.getStorageType(options.storage);
      const prefixedKey = `${STORAGE_PREFIX}${key}`;
      storage.setItem(prefixedKey, JSON.stringify(storageData));

      // Update memory cache
      this.memoryCache.set(key, value);

    } catch (error) {
      throw new Error(`Storage error: ${(error as ApiError).message}`);
    }
  }

  /**
   * Retrieves and validates stored value with automatic decryption
   */
  public async getItem<T>(
    key: string,
    options: StorageOptions = {}
  ): Promise<T | null> {
    try {
      const storage = this.getStorageType(options.storage);
      const prefixedKey = `${STORAGE_PREFIX}${key}`;
      const rawData = storage.getItem(prefixedKey);

      if (!rawData) {
        return null;
      }

      const storageData = JSON.parse(rawData) as StorageData<T>;

      // Check expiry
      if (storageData.metadata.expiresAt && Date.now() > storageData.metadata.expiresAt) {
        await this.removeItem(key);
        return null;
      }

      let value = storageData.value;

      // Handle decryption if encrypted
      if (storageData.metadata.encrypted && this.secretKey) {
        if (!storageData.metadata.iv) {
          throw new Error('Missing IV for encrypted data');
        }

        const decrypted = CryptoJS.AES.decrypt(
          value as string,
          this.secretKey,
          { iv: CryptoJS.enc.Hex.parse(storageData.metadata.iv) }
        );

        value = JSON.parse(decrypted.toString(CryptoJS.enc.Utf8));
      }

      // Validate schema if provided
      if (options.schema) {
        value = options.schema.parse(value);
      }

      return value as T;

    } catch (error) {
      console.error('Storage retrieval error:', error);
      return null;
    }
  }

  /**
   * Removes item from storage and cache
   */
  public async removeItem(key: string): Promise<void> {
    const prefixedKey = `${STORAGE_PREFIX}${key}`;
    localStorage.removeItem(prefixedKey);
    sessionStorage.removeItem(prefixedKey);
    this.memoryCache.delete(key);
  }

  /**
   * Clears all storage data with prefix
   */
  public async clear(): Promise<void> {
    if (typeof window === 'undefined') return;

    // Clear both storage types
    [localStorage, sessionStorage].forEach(storage => {
      for (let i = storage.length - 1; i >= 0; i--) {
        const key = storage.key(i);
        if (key?.startsWith(STORAGE_PREFIX)) {
          storage.removeItem(key);
        }
      }
    });

    // Clear memory cache
    this.memoryCache.clear();
  }

  /**
   * Validates storage quota before operations
   */
  public validateQuota(dataSize: number): boolean {
    let totalSize = dataSize;

    // Calculate current storage usage
    [localStorage, sessionStorage].forEach(storage => {
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        if (key?.startsWith(STORAGE_PREFIX)) {
          totalSize += storage.getItem(key)?.length || 0;
        }
      }
    });

    return totalSize <= this.quotaLimit;
  }

  /**
   * Cleanup expired items
   */
  private cleanup(): void {
    [localStorage, sessionStorage].forEach(storage => {
      for (let i = storage.length - 1; i >= 0; i--) {
        const key = storage.key(i);
        if (key?.startsWith(STORAGE_PREFIX)) {
          try {
            const data = JSON.parse(storage.getItem(key) || '');
            if (data.metadata.expiresAt && Date.now() > data.metadata.expiresAt) {
              storage.removeItem(key);
            }
          } catch (error) {
            console.error('Cleanup error:', error);
          }
        }
      }
    });
  }

  /**
   * Handle storage events for cross-tab synchronization
   */
  private handleStorageEvent = (event: StorageEvent): void => {
    if (event.key?.startsWith(STORAGE_PREFIX)) {
      const key = event.key.slice(STORAGE_PREFIX.length);
      if (event.newValue === null) {
        this.memoryCache.delete(key);
      } else {
        try {
          const data = JSON.parse(event.newValue);
          this.memoryCache.set(key, data.value);
        } catch (error) {
          console.error('Storage event handling error:', error);
        }
      }
    }
  };

  /**
   * Get storage type based on options
   */
  private getStorageType(type?: StorageType): Storage {
    if (typeof window === 'undefined') {
      throw new Error('Storage is not available in server-side context');
    }
    return type === 'session' ? sessionStorage : localStorage;
  }

  /**
   * Cleanup resources on service destruction
   */
  public destroy(): void {
    clearInterval(this.cleanupInterval);
    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', this.handleStorageEvent);
    }
  }
}

// Export singleton instance with default configuration
export const storage = new StorageService();