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