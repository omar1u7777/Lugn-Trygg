/**
 * Enhanced Encryption Service
 * End-to-end encryption for sensitive user data
 * Uses Web Crypto API for strong encryption
 */

// Type definitions for encrypted data structures
interface EncryptedData {
  encrypted: string;
  iv: string;
}

interface MoodData {
  mood_text?: string;
  transcript?: string;
  notes?: string;
  [key: string]: any;
}

interface EncryptedMoodData extends MoodData {
  mood_text_iv?: string;
  transcript_iv?: string;
  notes_iv?: string;
}

// Generate a secure encryption key
export async function generateEncryptionKey(): Promise<CryptoKey> {
  return await window.crypto.subtle.generateKey(
    {
      name: 'AES-GCM',
      length: 256,
    },
    true,
    ['encrypt', 'decrypt']
  );
}

// Export key for storage
export async function exportKey(key: CryptoKey): Promise<string> {
  const exported = await window.crypto.subtle.exportKey('jwk', key);
  return JSON.stringify(exported);
}

// Import key from storage
export async function importKey(keyData: string): Promise<CryptoKey> {
  const jwk = JSON.parse(keyData);
  return await window.crypto.subtle.importKey(
    'jwk',
    jwk,
    {
      name: 'AES-GCM',
      length: 256,
    },
    true,
    ['encrypt', 'decrypt']
  );
}

// Encrypt sensitive data
export async function encryptData(data: string, key: CryptoKey): Promise<EncryptedData> {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  
  // Generate a random initialization vector
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  
  const encryptedBuffer = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv,
    },
    key,
    dataBuffer
  );
  
  // Convert to base64 for storage
  const encrypted = btoa(String.fromCharCode(...new Uint8Array(encryptedBuffer)));
  const ivBase64 = btoa(String.fromCharCode(...iv));
  
  return {
    encrypted,
    iv: ivBase64,
  };
}

// Decrypt sensitive data
export async function decryptData(
  encrypted: string,
  iv: string,
  key: CryptoKey
): Promise<string> {
  // Convert from base64
  const encryptedBuffer = Uint8Array.from(atob(encrypted), (c) => c.charCodeAt(0));
  const ivBuffer = Uint8Array.from(atob(iv), (c) => c.charCodeAt(0));
  
  const decryptedBuffer = await window.crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: ivBuffer,
    },
    key,
    encryptedBuffer
  );
  
  const decoder = new TextDecoder();
  return decoder.decode(decryptedBuffer);
}

// Hash sensitive data (one-way, for verification)
export async function hashData(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', dataBuffer);
  
  // Convert to hex string
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  
  return hashHex;
}

// Secure key derivation from password (PBKDF2)
export async function deriveKeyFromPassword(
  password: string,
  salt?: Uint8Array
): Promise<{ key: CryptoKey; salt: string }> {
  const encoder = new TextEncoder();
  const passwordBuffer = encoder.encode(password);
  
  // Generate salt if not provided
  const saltBuffer = salt || window.crypto.getRandomValues(new Uint8Array(16));
  
  // Import password as key material
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    passwordBuffer,
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );
  
  // Derive encryption key
  const key = await window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBuffer as BufferSource,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
  
  const saltBase64 = btoa(String.fromCharCode(...saltBuffer));
  
  return { key, salt: saltBase64 };
}

// Encrypt mood log entry
export async function encryptMoodEntry(moodData: MoodData, userKey: CryptoKey): Promise<EncryptedMoodData> {
  const sensitiveFields: (keyof MoodData)[] = ['mood_text', 'transcript', 'notes'];
  const encryptedData: EncryptedMoodData = { ...moodData };
  
  for (const field of sensitiveFields) {
    const value = moodData[field];
    if (typeof value === 'string') {
      const { encrypted, iv } = await encryptData(value, userKey);
      encryptedData[field] = encrypted;
      encryptedData[`${field}_iv`] = iv;
    }
  }
  
  return encryptedData;
}

// Decrypt mood log entry
export async function decryptMoodEntry(encryptedData: EncryptedMoodData, userKey: CryptoKey): Promise<MoodData> {
  const sensitiveFields: (keyof MoodData)[] = ['mood_text', 'transcript', 'notes'];
  const decryptedData: MoodData = { ...encryptedData };
  
  for (const field of sensitiveFields) {
    const encrypted = encryptedData[field];
    const iv = encryptedData[`${field}_iv`];
    
    if (typeof encrypted === 'string' && typeof iv === 'string') {
      try {
        decryptedData[field] = await decryptData(encrypted, iv, userKey);
        // Remove IV from decrypted data
        delete decryptedData[`${field}_iv`];
      } catch (error) {
        console.error(`Failed to decrypt ${String(field)}:`, error);
        decryptedData[field] = '[Encrypted]';
      }
    }
  }
  
  return decryptedData;
}

// User privacy controls
export interface PrivacySettings {
  dataRetentionDays: number;
  shareAnonymizedData: boolean;
  allowAnalytics: boolean;
  encryptLocalStorage: boolean;
  autoDeleteOldData: boolean;
}

export const DEFAULT_PRIVACY_SETTINGS: PrivacySettings = {
  dataRetentionDays: 365,
  shareAnonymizedData: false,
  allowAnalytics: true,
  encryptLocalStorage: true,
  autoDeleteOldData: true,
};

// Get user's privacy settings
export function getPrivacySettings(): PrivacySettings {
  const stored = localStorage.getItem('privacy_settings');
  if (stored) {
    try {
      return { ...DEFAULT_PRIVACY_SETTINGS, ...JSON.parse(stored) };
    } catch {
      return DEFAULT_PRIVACY_SETTINGS;
    }
  }
  return DEFAULT_PRIVACY_SETTINGS;
}

// Save user's privacy settings
export function savePrivacySettings(settings: PrivacySettings): void {
  localStorage.setItem('privacy_settings', JSON.stringify(settings));
}

// Export all user data (GDPR compliance)
export async function exportUserData(userId: string): Promise<Blob> {
  // In production, fetch all user data from backend
  const userData = {
    userId,
    exportDate: new Date().toISOString(),
    moods: [],
    memories: [],
    settings: getPrivacySettings(),
    // Add more data fields as needed
  };
  
  const json = JSON.stringify(userData, null, 2);
  return new Blob([json], { type: 'application/json' });
}

// Delete all user data (GDPR compliance)
export async function deleteAllUserData(userId: string): Promise<void> {
  // Clear local storage
  const keysToKeep = ['theme', 'language'];
  const allKeys = Object.keys(localStorage);
  
  allKeys.forEach((key) => {
    if (!keysToKeep.includes(key)) {
      localStorage.removeItem(key);
    }
  });
  
  // In production, also call backend API to delete all server-side data
  console.log(`All data for user ${userId} has been deleted locally`);
}

export default {
  generateEncryptionKey,
  exportKey,
  importKey,
  encryptData,
  decryptData,
  hashData,
  deriveKeyFromPassword,
  encryptMoodEntry,
  decryptMoodEntry,
  getPrivacySettings,
  savePrivacySettings,
  exportUserData,
  deleteAllUserData,
};
