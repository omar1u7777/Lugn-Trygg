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
import Utf8 from 'crypto-js/enc-utf8';
import { logger } from './logger';
import { base64ToBytes, bytesToBase64 } from './base64';


// Cache for crypto key to avoid regenerating on every operation
let cachedCryptoKey: CryptoKey | null = null;
// Lazy – evaluated on first use so that module loading never throws
let _fallbackSecret: string | null = null;
const getFallbackSecret = (): string => {
  if (!_fallbackSecret) {
    _fallbackSecret = getEncryptionKey();
  }
  return _fallbackSecret;
};
let hasLoggedFallbackWarning = false;

/**
 * Derive a CryptoKey from the encryption key in environment
 */
async function getCryptoKey(): Promise<CryptoKey> {
  if (cachedCryptoKey) {
    return cachedCryptoKey;
  }

  const encryptionKey = getEncryptionKey();
  
  // Convert string to ArrayBuffer (support both hex and plain text).
  // Typed as Uint8Array<ArrayBuffer> rather than a bare Uint8Array: since
  // TS 5.7 the bare form widens to ArrayBufferLike, which importKey's
  // BufferSource parameter does not accept.
  let keyData: Uint8Array<ArrayBuffer>;

  // Check if it's a hex string (even length, only 0-9a-fA-F)
  if (/^[0-9a-fA-F]+$/.test(encryptionKey) && encryptionKey.length % 2 === 0) {
    // Parse as hex
    const hexBytes = encryptionKey.match(/.{1,2}/g)?.map(byte => parseInt(byte, 16)) || [];
    keyData = new Uint8Array(new ArrayBuffer(hexBytes.length));
    keyData.set(hexBytes);
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

    // Chunked: spreading the whole IV+ciphertext into String.fromCharCode
    // throws RangeError once the stored value gets large.
    return bytesToBase64(combined);
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
    const combined = base64ToBytes(encryptedData);

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
    return AES.encrypt(data, getFallbackSecret()).toString();
  } catch (error) {
    logger.error('❌ Fallback encryption failed:', error);
    throw new Error('Failed to encrypt fallback data');
  }
}

function fallbackDecrypt(payload: string): string {
  try {
    const bytes = AES.decrypt(payload, getFallbackSecret());
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
 * Registry of localStorage key prefixes that hold USER-SCOPED data written by
 * feature modules (chat analytics, gratitude challenges, AI personality, …).
 * In a mental-health app this data is sensitive: it MUST be purged on logout
 * so nothing about the previous user survives on a shared device.
 *
 * Any feature that persists per-user data in localStorage must register its
 * prefix here — this list is the single source of truth for logout cleanup.
 */
const USER_SCOPED_KEY_PREFIXES = [
  'chat-analytics-',
  'translation-cache-',
  'preferred-language-',
  'ai-personality-',
  'gratitude_challenge_',
  'user_progress_',
  'article_progress_',
  'lugn_trygg_favorite_stories_',
  'lugn_trygg_daily_usage_',
  'lugn_trygg_subscription_cache_',
  'lugn-trygg-chat-cache',
  'insights_last_generate',
  // Offline queue written by services/offlineStorage.ts. This is the single
  // most sensitive thing the app keeps in localStorage: mood `notes`, memory
  // `content`, and the full bodies of queued POST/PUT requests, all in
  // plaintext. It was absent from this list and offlineStorage's own
  // clearOfflineData() has no callers, so an offline mood entry written by
  // one user stayed readable to the next user of a shared device.
  'lugn_trygg_offline_data',
  // Privacy settings cached by utils/encryptionService.ts under a single
  // unscoped key. Left behind, it became the next user's fallback whenever
  // their backend fetch failed — silently applying user A's analytics
  // opt-out and retention window to user B.
  'privacy_settings',
];

/**
 * Purge all user-scoped feature data from localStorage.
 * Called from every logout path (explicit logout, forced logout on refresh
 * failure, account deletion) to guarantee state synchronization.
 */
export function purgeUserScopedStorage(): void {
  try {
    Object.keys(localStorage)
      .filter(key => USER_SCOPED_KEY_PREFIXES.some(prefix => key.startsWith(prefix)))
      .forEach(key => localStorage.removeItem(key));
  } catch (error) {
    logger.warn('Failed to purge user-scoped storage on logout', { error });
  }
}

/**
 * Token Storage - High-level API for auth tokens
 */
export const tokenStorage = {
  _accessToken: null as string | null,

  /**
   * Store access token in-memory only (never persisted)
   */
  async setAccessToken(token: string): Promise<void> {
    this._accessToken = token;
  },

  /**
   * Get in-memory access token
   */
  async getAccessToken(): Promise<string | null> {
    return this._accessToken;
  },

  /**
   * Refresh token is now httpOnly cookie-only and never stored in JS-accessible storage.
   */
  async setRefreshToken(_token: string): Promise<void> {
    logger.debug('Ignored setRefreshToken call: refresh tokens are cookie-managed.');
  },

  /**
   * Refresh token cannot be read from JS when stored in httpOnly cookies.
   */
  async getRefreshToken(): Promise<string | null> {
    return null;
  },

  /**
   * Clear all tokens
   */
  clearTokens(): void {
    this._accessToken = null;
  }
};

// Clean up legacy persisted tokens from previous versions.
if (typeof window !== 'undefined') {
  try {
    localStorage.removeItem('secure_token');
    localStorage.removeItem('secure_refresh_token');
  } catch {
    // localStorage may be unavailable in some test environments
  }
}

/**
 * Fallback to plain localStorage if Web Crypto is not available
 * (e.g., in tests or very old browsers)
 */
if (typeof window !== 'undefined' && !secureStorage.isAvailable() && !hasLoggedFallbackWarning) {
  hasLoggedFallbackWarning = true;
  logger.warn('⚠️ Web Crypto API unavailable. Using CryptoJS fallback encryption.');
  logger.warn('ℹ️ Tokens remain encrypted, but switch to a secure origin (https://localhost or HTTPS proxy) for hardware-backed crypto.');
}
