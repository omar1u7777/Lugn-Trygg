/**
 * Tests for consent API functions.
 * Note: consent.ts uses `apiClient` (not `api`) from client.
 */
import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('../client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('../constants', () => ({
  API_ENDPOINTS: {
    CONSENT: {
      BASE: '/api/v1/consent',
    },
  },
}));

import { apiClient } from '../client';
import {
  grantBulkConsents,
  getUserConsents,
  grantConsent,
  withdrawConsent,
  validateFeatureAccess,
  checkConsent,
  mapFrontendConsentsToBackend,
} from '../consent';

const mockApiClient = apiClient as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

describe('grantBulkConsents', () => {
  beforeEach(() => vi.clearAllMocks());

  it('posts bulk consents and returns response', async () => {
    const consents = { data_processing_consent: true, ai_analysis_consent: true, marketing_consent: false, terms_of_service: true, privacy_policy: true };
    const response = { success: true };
    mockApiClient.post.mockResolvedValueOnce({ data: response });

    const result = await grantBulkConsents(consents);
    expect(mockApiClient.post).toHaveBeenCalledWith(expect.any(String), consents);
    expect(result).toEqual(response);
  });

  it('throws on error', async () => {
    mockApiClient.post.mockRejectedValueOnce(new Error('Forbidden'));
    await expect(grantBulkConsents({ data_processing_consent: true, ai_analysis_consent: true, marketing_consent: false, terms_of_service: true, privacy_policy: true })).rejects.toThrow();
  });
});

describe('getUserConsents', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns user consents', async () => {
    const data = { consents: [{ type: 'data_processing', granted: true }] };
    mockApiClient.get.mockResolvedValueOnce({ data });

    const result = await getUserConsents();
    expect(result).toEqual(data);
  });

  it('throws on error', async () => {
    mockApiClient.get.mockRejectedValueOnce(new Error('Unauthorized'));
    await expect(getUserConsents()).rejects.toThrow();
  });
});

describe('grantConsent', () => {
  beforeEach(() => vi.clearAllMocks());

  it('posts to correct endpoint with version', async () => {
    const data = { type: 'data_processing', granted: true };
    mockApiClient.post.mockResolvedValueOnce({ data });

    const result = await grantConsent('data_processing', '1.0');
    expect(mockApiClient.post).toHaveBeenCalledWith(
      expect.stringContaining('data_processing'),
      { version: '1.0' }
    );
    expect(result).toEqual(data);
  });

  it('uses default version 1.0 when not provided', async () => {
    mockApiClient.post.mockResolvedValueOnce({ data: {} });

    await grantConsent('ai_processing');
    expect(mockApiClient.post).toHaveBeenCalledWith(expect.any(String), { version: '1.0' });
  });

  it('throws on error', async () => {
    mockApiClient.post.mockRejectedValueOnce(new Error('Failed'));
    await expect(grantConsent('data_processing')).rejects.toThrow();
  });
});

describe('withdrawConsent', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sends delete to correct endpoint', async () => {
    const data = { type: 'data_processing', granted: false };
    mockApiClient.delete.mockResolvedValueOnce({ data });

    const result = await withdrawConsent('data_processing');
    expect(mockApiClient.delete).toHaveBeenCalledWith(expect.stringContaining('data_processing'));
    expect(result).toEqual(data);
  });

  it('throws on error', async () => {
    mockApiClient.delete.mockRejectedValueOnce(new Error('Conflict'));
    await expect(withdrawConsent('marketing')).rejects.toThrow();
  });
});

describe('validateFeatureAccess', () => {
  beforeEach(() => vi.clearAllMocks());

  it('gets feature validation', async () => {
    const data = { hasAccess: true, missingConsents: [] };
    mockApiClient.get.mockResolvedValueOnce({ data });

    const result = await validateFeatureAccess('voice-chat');
    expect(mockApiClient.get).toHaveBeenCalledWith(expect.stringContaining('voice-chat'));
    expect(result).toEqual(data);
  });

  it('throws on error', async () => {
    mockApiClient.get.mockRejectedValueOnce(new Error('Error'));
    await expect(validateFeatureAccess('feature')).rejects.toThrow();
  });
});

describe('checkConsent', () => {
  beforeEach(() => vi.clearAllMocks());

  it('gets consent check result', async () => {
    const data = { type: 'analytics', granted: true };
    mockApiClient.get.mockResolvedValueOnce({ data });

    const result = await checkConsent('analytics');
    expect(mockApiClient.get).toHaveBeenCalledWith(expect.stringContaining('analytics'));
    expect(result).toEqual(data);
  });

  it('throws on error', async () => {
    mockApiClient.get.mockRejectedValueOnce(new Error('Error'));
    await expect(checkConsent('analytics')).rejects.toThrow();
  });
});

describe('mapFrontendConsentsToBackend', () => {
  it('maps all fields correctly', () => {
    const result = mapFrontendConsentsToBackend({
      dataProcessing: true,
      aiAnalysis: true,
      storage: false,
      marketing: false,
      termsOfService: true,
      privacyPolicy: true,
    });

    expect(result.data_processing_consent).toBe(true);
    expect(result.ai_analysis_consent).toBe(true);
    expect(result.marketing_consent).toBe(false);
    expect(result.terms_of_service).toBe(true);
    expect(result.privacy_policy).toBe(true);
  });

  it('uses storage value for data_processing_consent when dataProcessing is false', () => {
    const result = mapFrontendConsentsToBackend({
      dataProcessing: false,
      aiAnalysis: false,
      storage: true,
      marketing: false,
    });

    expect(result.data_processing_consent).toBe(true);
  });

  it('defaults termsOfService to true when undefined', () => {
    const result = mapFrontendConsentsToBackend({
      dataProcessing: true,
      aiAnalysis: false,
      storage: false,
      marketing: false,
    });

    expect(result.terms_of_service).toBe(true);
  });

  it('defaults privacyPolicy to true when undefined', () => {
    const result = mapFrontendConsentsToBackend({
      dataProcessing: true,
      aiAnalysis: false,
      storage: false,
      marketing: false,
    });

    expect(result.privacy_policy).toBe(true);
  });

  it('respects explicit false for termsOfService', () => {
    const result = mapFrontendConsentsToBackend({
      dataProcessing: false,
      aiAnalysis: false,
      storage: false,
      marketing: false,
      termsOfService: false,
    });

    expect(result.terms_of_service).toBe(false);
  });
});
