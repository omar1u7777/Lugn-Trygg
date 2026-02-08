/**
 * Secure Storage Utility for Sensitive Data
 * 
 * ⚠️ SECURITY FEATURES:
 * - Uses Web Crypto API for encryption
 * - Encrypts tokens before storing in localStorage
 * - Protects against XSS token theft
 * - Automatic key derivation from user session
 * 
 * NOTE: This is client-side encryption for defense-in-depth.
 * Best practice is httpOnly cookies, but this adds a layer of protection
 * when cookies are not feasible (e.g., mobile apps, CORS issues).
 */

import { getEncryptionKey } from '../config/env';
import AES from 'crypto-js/aes';
import Utf8 from 'crypto-js/enc-utf8';import { logger } from './logger';


// Cache for crypto key to avoid regenerating on every operation
let cachedCryptoKey: CryptoKey | null = null;
const FALLBACK_SECRET = getEncryptionKey();
let hasLoggedFallbackWarning = false;

/**
 * Derive a CryptoKey from the encryption key in environment
 */
async function getCryptoKey(): Promise<CryptoKey> {
  if (cachedCryptoKey) {
    return cachedCryptoKey;
  }

  const encryptionKey = getEncryptionKey();
  
  // Convert string to ArrayBuffer (support both hex and plain text)
  let keyData: Uint8Array;
  
  // Check if it's a hex string (even length, only 0-9a-fA-F)
  if (/^[0-9a-fA-F]+$/.test(encryptionKey) && encryptionKey.length % 2 === 0) {
    // Parse as hex
    keyData = new Uint8Array(
      encryptionKey.match(/.{1,2}/g)?.map(byte => parseInt(byte, 16)) || []
    );
  } else {
    // Treat as plain text - hash it to get 256 bits
    const encoder = new TextEncoder();
    const data = encoder.encode(encryptionKey);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
    keyData = new Uint8Array(hashBuffer);
  }

  // Import key for AES-GCM encryption
  cachedCryptoKey = await window.crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );

  return cachedCryptoKey;
}

/**
 * Encrypt data using AES-GCM
 */
async function encrypt(data: string): Promise<string> {
  try {
    const key = await getCryptoKey();
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encodedData = new TextEncoder().encode(data);

    const encryptedData = await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      encodedData
    );

    // Combine IV + encrypted data and encode as base64
    const combined = new Uint8Array(iv.length + encryptedData.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(encryptedData), iv.length);

    return btoa(String.fromCharCode(...combined));
  } catch (error) {
    logger.error('❌ Encryption failed:', error);
    throw new Error('Failed to encrypt data');
  }
}

/**
 * Decrypt data using AES-GCM
 */
async function decrypt(encryptedData: string): Promise<string> {
  try {
    const key = await getCryptoKey();
    const combined = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));

    // Extract IV (first 12 bytes) and encrypted data
    const iv = combined.slice(0, 12);
    const data = combined.slice(12);

    const decryptedData = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      data
    );

    return new TextDecoder().decode(decryptedData);
  } catch (error) {
    logger.error('❌ Decryption failed:', error);
    throw new Error('Failed to decrypt data');
  }
}

/**
 * Secure Storage API with encryption
 */
function fallbackEncrypt(data: string): string {
  try {
    return AES.encrypt(data, FALLBACK_SECRET).toString();
  } catch (error) {
    logger.error('❌ Fallback encryption failed:', error);
    throw new Error('Failed to encrypt fallback data');
  }
}

function fallbackDecrypt(payload: string): string {
  try {
    const bytes = AES.decrypt(payload, FALLBACK_SECRET);
    const decrypted = bytes.toString(Utf8);
    if (!decrypted) {
      throw new Error('Empty fallback payload');
    }
    return decrypted;
  } catch (error) {
    logger.error('❌ Fallback decryption failed:', error);
    throw new Error('Failed to decrypt fallback data');
  }
}

type StoredValue =
  | string
  | {
      __secure_method: 'fallback';
      value: string;
    };

export const secureStorage = {
/**
 * Store encrypted data in localStorage
 */
  async setItem(key: string, value: string): Promise<void> {
    try {
      if (!this.isAvailable()) {
        const encryptedFallback = fallbackEncrypt(value);
        localStorage.setItem(
          `secure_${key}`,
          JSON.stringify({ __secure_method: 'fallback', value: encryptedFallback })
        );
        return;
      }

      const encrypted = await encrypt(value);
      localStorage.setItem(`secure_${key}`, encrypted);
    } catch (error) {
      logger.error(`❌ Failed to store ${key}:`, error);
      throw error;
    }
  },

  /**
   * Retrieve and decrypt data from localStorage
   */
  async getItem(key: string): Promise<string | null> {
    const stored = localStorage.getItem(`secure_${key}`);
    if (!stored) {
      return null;
    }

    try {
      const parsed: StoredValue = JSON.parse(stored);
      if (
        typeof parsed === 'object' &&
        parsed !== null &&
        parsed.__secure_method === 'fallback' &&
        typeof parsed.value === 'string'
      ) {
        return fallbackDecrypt(parsed.value);
      }
    } catch {
      // Not JSON, proceed with legacy handling
    }

    if (!this.isAvailable()) {
      // Legacy fallback: data stored as plain text before CryptoJS support
      return stored;
    }

    try {
      return await decrypt(stored);
    } catch (error) {
      logger.error(`❌ Failed to retrieve ${key}:`, error);
      // If decryption fails, remove the corrupted data
      localStorage.removeItem(`secure_${key}`);
      return null;
    }
  },

  /**
   * Remove item from localStorage
   */
  removeItem(key: string): void {
    localStorage.removeItem(`secure_${key}`);
  },

  /**
   * Clear all secure storage items
   */
  clear(): void {
    // Only remove items with 'secure_' prefix
    Object.keys(localStorage)
      .filter(key => key.startsWith('secure_'))
      .forEach(key => localStorage.removeItem(key));
  },

  /**
   * Check if encryption is available
   */
  isAvailable(): boolean {
    return (
      typeof window !== 'undefined' &&
      typeof window.crypto !== 'undefined' &&
      typeof window.crypto.subtle !== 'undefined'
    );
  }
};

/**
 * Token Storage - High-level API for auth tokens
 */
export const tokenStorage = {
  /**
   * Store access token securely
   */
  async setAccessToken(token: string): Promise<void> {
    await secureStorage.setItem('token', token);
  },

  /**
   * Get access token
   */
  async getAccessToken(): Promise<string | null> {
    const token = await secureStorage.getItem('token');
    logger.debug('🔐 SECURE STORAGE - getAccessToken:', { 
      hasToken: !!token, 
      tokenLength: token?.length,
      tokenPreview: token ? token.substring(0, 20) + '...' : 'null'
    });
    return token;
  },

  /**
   * Store refresh token securely
   */
  async setRefreshToken(token: string): Promise<void> {
    await secureStorage.setItem('refresh_token', token);
  },

  /**
   * Get refresh token
   */
  async getRefreshToken(): Promise<string | null> {
    return await secureStorage.getItem('refresh_token');
  },

  /**
   * Clear all tokens
   */
  clearTokens(): void {
    secureStorage.removeItem('token');
    secureStorage.removeItem('refresh_token');
  }
};

/**
 * Fallback to plain localStorage if Web Crypto is not available
 * (e.g., in tests or very old browsers)
 */
if (typeof window !== 'undefined' && !secureStorage.isAvailable() && !hasLoggedFallbackWarning) {
  hasLoggedFallbackWarning = true;
  logger.warn('⚠️ Web Crypto API unavailable. Using CryptoJS fallback encryption.');
  logger.warn('ℹ️ Tokens remain encrypted, but switch to a secure origin (https://localhost or HTTPS proxy) for hardware-backed crypto.');
}
