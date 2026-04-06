import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getPrivacySettings,
  savePrivacySettings,
  DEFAULT_PRIVACY_SETTINGS,
  deleteAllUserData,
  exportUserData
} from '../encryptionService';

// Mock the api/client module to prevent axios.create issues
vi.mock('../../api/client', () => ({
  default: {
    delete: vi.fn().mockResolvedValue({ data: { success: true } }),
    get: vi.fn().mockResolvedValue({ data: {} }),
    post: vi.fn().mockResolvedValue({ data: new Blob(['{"userId":"user123","exportDate":"2025-01-01"}'], { type: 'application/json' }) }),
    put: vi.fn().mockResolvedValue({ data: {} }),
  },
  api: {
    delete: vi.fn().mockResolvedValue({ data: { success: true } }),
    get: vi.fn().mockResolvedValue({ data: {} }),
    post: vi.fn().mockResolvedValue({ data: new Blob(['{"userId":"user123","exportDate":"2025-01-01"}'], { type: 'application/json' }) }),
    put: vi.fn().mockResolvedValue({ data: {} }),
  },
}));

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  key: vi.fn(),
  length: 0,
};

const fetchMock = vi.fn();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

describe('Encryption Service - Privacy Settings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({}),
      text: async () => '',
      blob: async () => new Blob(['{}'], { type: 'application/json' })
    } as Response);
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  describe('getPrivacySettings', () => {
    it('should return default settings when no stored settings exist', async () => {
      localStorageMock.getItem.mockReturnValue(null);

      const settings = await getPrivacySettings();

      expect(settings).toEqual(DEFAULT_PRIVACY_SETTINGS);
    });

    it('should return merged settings when stored settings exist', async () => {
      const storedSettings = {
        dataRetentionDays: 180,
        shareAnonymizedData: true,
      };
      localStorageMock.getItem.mockReturnValue(JSON.stringify(storedSettings));

      const settings = await getPrivacySettings();

      expect(settings).toEqual({
        ...DEFAULT_PRIVACY_SETTINGS,
        ...storedSettings,
      });
    });

    it('should return default settings when stored settings are invalid JSON', async () => {
      localStorageMock.getItem.mockReturnValue('invalid json');

      const settings = await getPrivacySettings();

      expect(settings).toEqual(DEFAULT_PRIVACY_SETTINGS);
    });
  });

  describe('savePrivacySettings', () => {
    it('should save settings to localStorage', async () => {
      const settings = {
        dataRetentionDays: 90,
        shareAnonymizedData: false,
        allowAnalytics: false,
        encryptLocalStorage: true,
        autoDeleteOldData: false,
      };

      await savePrivacySettings(settings);

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'privacy_settings',
        JSON.stringify(settings)
      );
    });
  });

  describe('deleteAllUserData', () => {
    it('should clear localStorage except for specified keys', async () => {
      // Mock Object.keys to return some keys
      const mockKeys = ['user', 'token', 'theme', 'language', 'privacy_settings'];
      vi.spyOn(Object, 'keys').mockReturnValue(mockKeys);

      await deleteAllUserData('user123');

      // Should remove all keys except 'theme' and 'language'
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('user');
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('token');
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('privacy_settings');
      expect(localStorageMock.removeItem).not.toHaveBeenCalledWith('theme');
      expect(localStorageMock.removeItem).not.toHaveBeenCalledWith('language');
    });
  });

  describe('exportUserData', () => {
    it('should create a blob with user data', async () => {
      const userId = 'user123';

      const blob = await exportUserData(userId);

      expect(blob).toBeInstanceOf(Blob);
      expect(blob.type).toBe('application/json');

      // Verify blob size is greater than 0 (contains data)
      expect(blob.size).toBeGreaterThan(0);
    });
  });
});

// Crypto function tests (Web Crypto API — available in jsdom/vitest)
import {
  generateEncryptionKey,
  exportKey,
  importKey,
  encryptData,
  decryptData,
  hashData,
  deriveKeyFromPassword,
  encryptMoodEntry,
  decryptMoodEntry,
} from '../encryptionService';

describe('Encryption Service - Crypto Functions', () => {
  describe('generateEncryptionKey', () => {
    it('generates an AES-GCM CryptoKey', async () => {
      const key = await generateEncryptionKey();
      expect(key).toBeDefined();
      expect(key.type).toBe('secret');
      expect(key.algorithm.name).toBe('AES-GCM');
    });

    it('generates unique keys on each call', async () => {
      const key1 = await generateEncryptionKey();
      const key2 = await generateEncryptionKey();
      const exported1 = await exportKey(key1);
      const exported2 = await exportKey(key2);
      expect(exported1).not.toBe(exported2);
    });
  });

  describe('exportKey / importKey', () => {
    it('exports key as JSON string', async () => {
      const key = await generateEncryptionKey();
      const exported = await exportKey(key);
      expect(typeof exported).toBe('string');
      const parsed = JSON.parse(exported);
      expect(parsed.kty).toBe('oct');
    });

    it('imports exported key back to CryptoKey', async () => {
      const key = await generateEncryptionKey();
      const exported = await exportKey(key);
      const imported = await importKey(exported);
      expect(imported.type).toBe('secret');
      expect(imported.algorithm.name).toBe('AES-GCM');
    });

    it('exported and imported key can encrypt/decrypt round-trip', async () => {
      const key = await generateEncryptionKey();
      const exported = await exportKey(key);
      const imported = await importKey(exported);
      const { encrypted, iv } = await encryptData('round-trip test', key);
      const decrypted = await decryptData(encrypted, iv, imported);
      expect(decrypted).toBe('round-trip test');
    });
  });

  describe('encryptData / decryptData', () => {
    it('encrypts data and returns encrypted object with iv', async () => {
      const key = await generateEncryptionKey();
      const result = await encryptData('Hello World', key);
      expect(result).toHaveProperty('encrypted');
      expect(result).toHaveProperty('iv');
      expect(typeof result.encrypted).toBe('string');
      expect(typeof result.iv).toBe('string');
    });

    it('decrypts encrypted data back to original string', async () => {
      const key = await generateEncryptionKey();
      const { encrypted, iv } = await encryptData('Secret message', key);
      const decrypted = await decryptData(encrypted, iv, key);
      expect(decrypted).toBe('Secret message');
    });

    it('uses random IV so same plaintext encrypts differently each time', async () => {
      const key = await generateEncryptionKey();
      const result1 = await encryptData('Hello', key);
      const result2 = await encryptData('Hello', key);
      expect(result1.iv).not.toBe(result2.iv);
    });

    it('fails to decrypt with wrong key', async () => {
      const key1 = await generateEncryptionKey();
      const key2 = await generateEncryptionKey();
      const { encrypted, iv } = await encryptData('Secret', key1);
      await expect(decryptData(encrypted, iv, key2)).rejects.toThrow();
    });

    it('encrypts unicode and special characters', async () => {
      const key = await generateEncryptionKey();
      const text = 'Hej! Jag mår bra. 😊 Spécial: "åäö"';
      const { encrypted, iv } = await encryptData(text, key);
      const decrypted = await decryptData(encrypted, iv, key);
      expect(decrypted).toBe(text);
    });
  });

  describe('hashData', () => {
    it('returns 64-character hex SHA-256 hash', async () => {
      const hash = await hashData('hello');
      expect(typeof hash).toBe('string');
      expect(hash).toHaveLength(64);
      expect(/^[0-9a-f]+$/.test(hash)).toBe(true);
    });

    it('is deterministic for same input', async () => {
      const h1 = await hashData('hello');
      const h2 = await hashData('hello');
      expect(h1).toBe(h2);
    });

    it('produces different hashes for different input', async () => {
      const h1 = await hashData('hello');
      const h2 = await hashData('world');
      expect(h1).not.toBe(h2);
    });

    it('hashes empty string', async () => {
      const hash = await hashData('');
      expect(hash).toHaveLength(64);
    });
  });

  describe('deriveKeyFromPassword', () => {
    it('derives a CryptoKey from password', async () => {
      const { key, salt } = await deriveKeyFromPassword('my-password');
      expect(key.type).toBe('secret');
      expect(key.algorithm.name).toBe('AES-GCM');
      expect(typeof salt).toBe('string');
    });

    it('generates a new random salt when none provided', async () => {
      const { salt: salt1 } = await deriveKeyFromPassword('pw');
      const { salt: salt2 } = await deriveKeyFromPassword('pw');
      expect(salt1).not.toBe(salt2);
    });

    it('derives consistent key when same salt is provided', async () => {
      const { key: key1, salt } = await deriveKeyFromPassword('my-password');
      const saltBytes = Uint8Array.from(atob(salt), c => c.charCodeAt(0));
      const { key: key2 } = await deriveKeyFromPassword('my-password', saltBytes);
      const { encrypted, iv } = await encryptData('test-data', key1);
      const decrypted = await decryptData(encrypted, iv, key2);
      expect(decrypted).toBe('test-data');
    });

    it('derives different keys for different passwords (same salt)', async () => {
      const { key: key1, salt } = await deriveKeyFromPassword('password1');
      const saltBytes = Uint8Array.from(atob(salt), c => c.charCodeAt(0));
      const { key: key2 } = await deriveKeyFromPassword('password2', saltBytes);
      const { encrypted, iv } = await encryptData('test', key1);
      await expect(decryptData(encrypted, iv, key2)).rejects.toThrow();
    });
  }, 30000); // PBKDF2 is intentionally slow

  describe('encryptMoodEntry / decryptMoodEntry', () => {
    it('encrypts sensitive fields (mood_text, transcript, notes)', async () => {
      const key = await generateEncryptionKey();
      const moodData = {
        mood_score: 7,
        mood_text: 'Feeling good today',
        transcript: 'Voice transcript',
        notes: 'Additional notes',
      };
      const encrypted = await encryptMoodEntry(moodData, key);
      expect(encrypted.mood_text).not.toBe('Feeling good today');
      expect(encrypted.transcript).not.toBe('Voice transcript');
      expect(encrypted.notes).not.toBe('Additional notes');
      expect(encrypted.mood_score).toBe(7);
      expect(encrypted.mood_text_iv).toBeDefined();
    });

    it('skips missing sensitive fields gracefully', async () => {
      const key = await generateEncryptionKey();
      const result = await encryptMoodEntry({ mood_score: 5 }, key);
      expect(result.mood_text).toBeUndefined();
      expect(result.mood_score).toBe(5);
    });

    it('decrypts mood entry back to original', async () => {
      const key = await generateEncryptionKey();
      const moodData = {
        mood_text: 'Original text',
        transcript: 'Transcript here',
        notes: 'Notes here',
      };
      const encrypted = await encryptMoodEntry(moodData, key);
      const decrypted = await decryptMoodEntry(encrypted, key);
      expect(decrypted.mood_text).toBe('Original text');
      expect(decrypted.transcript).toBe('Transcript here');
      expect(decrypted.notes).toBe('Notes here');
      expect(decrypted.mood_text_iv).toBeUndefined();
    });

    it('uses [Encrypted] fallback on wrong key', async () => {
      const key1 = await generateEncryptionKey();
      const key2 = await generateEncryptionKey();
      const encrypted = await encryptMoodEntry({ mood_text: 'Secret' }, key1);
      const decrypted = await decryptMoodEntry(encrypted, key2);
      expect(decrypted.mood_text).toBe('[Encrypted]');
    });
  });
});