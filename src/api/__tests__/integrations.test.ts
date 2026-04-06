import { vi, describe, it, expect, beforeEach } from 'vitest';

const apiMock = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() }));
vi.mock('../client', () => ({ api: apiMock, default: apiMock, apiClient: apiMock }));

import {
  getOAuthAuthorizeUrl,
  getOAuthStatus,
  disconnectOAuth,
  syncHealthDataFromProvider,
  syncHealthDataMulti,
  analyzeHealthMoodPatterns,
  checkHealthAlerts,
  updateAlertSettings,
  toggleAutoSync,
  getAutoSyncSettings,
  getWearableStatus,
  disconnectWearable,
  syncWearable,
  getWearableDetails,
  getFHIRPatient,
  getFHIRObservations,
  createCrisisReferral,
} from '../integrations';

describe('integrations API', () => {
  beforeEach(() => vi.clearAllMocks());

  it('getOAuthAuthorizeUrl returns url', async () => {
    apiMock.get.mockResolvedValueOnce({ data: { data: { url: 'https://oauth.example.com' } } });
    await getOAuthAuthorizeUrl('google_fit');
    expect(apiMock.get).toHaveBeenCalled();
  });

  it('getOAuthAuthorizeUrl throws on error', async () => {
    apiMock.get.mockRejectedValueOnce(new Error('fail'));
    await expect(getOAuthAuthorizeUrl('google_fit')).rejects.toThrow();
  });

  it('getOAuthStatus returns status', async () => {
    apiMock.get.mockResolvedValueOnce({ data: { data: { connected: true } } });
    await getOAuthStatus('google_fit');
    expect(apiMock.get).toHaveBeenCalled();
  });

  it('getOAuthStatus throws on error', async () => {
    apiMock.get.mockRejectedValueOnce(new Error('fail'));
    await expect(getOAuthStatus('google_fit')).rejects.toThrow();
  });

  it('disconnectOAuth disconnects provider', async () => {
    apiMock.post.mockResolvedValueOnce({ data: { success: true, message: 'Disconnected' } });
    await disconnectOAuth('google_fit');
    expect(apiMock.post).toHaveBeenCalled();
  });

  it('disconnectOAuth throws on error', async () => {
    apiMock.delete.mockRejectedValueOnce(new Error('fail'));
    await expect(disconnectOAuth('google_fit')).rejects.toThrow();
  });

  it('syncHealthDataFromProvider syncs data', async () => {
    apiMock.post.mockResolvedValueOnce({ data: { data: { synced: true, entries: 10 } } });
    await syncHealthDataFromProvider('google_fit');
    expect(apiMock.post).toHaveBeenCalled();
  });

  it('syncHealthDataFromProvider throws on error', async () => {
    apiMock.post.mockRejectedValueOnce(new Error('fail'));
    await expect(syncHealthDataFromProvider('google_fit')).rejects.toThrow();
  });

  it('syncHealthDataMulti syncs multiple sources', async () => {
    apiMock.post.mockResolvedValueOnce({ data: { results: [] } });
    await syncHealthDataMulti(['google_fit']);
    expect(apiMock.post).toHaveBeenCalled();
  });

  it('syncHealthDataMulti uses default sources', async () => {
    apiMock.post.mockResolvedValueOnce({ data: { results: [] } });
    await syncHealthDataMulti();
    expect(apiMock.post).toHaveBeenCalled();
  });

  it('analyzeHealthMoodPatterns returns analysis', async () => {
    const analysis = { success: true, message: 'ok', status: 'success' as const };
    apiMock.post.mockResolvedValueOnce({ data: { data: analysis } });
    const result = await analyzeHealthMoodPatterns(30);
    expect(result).toMatchObject(analysis);
  });

  it('analyzeHealthMoodPatterns uses default days', async () => {
    apiMock.post.mockResolvedValueOnce({ data: { success: true, message: 'ok', status: 'success' } });
    await analyzeHealthMoodPatterns();
    expect(apiMock.post).toHaveBeenCalled();
  });

  it('checkHealthAlerts returns alerts', async () => {
    apiMock.post.mockResolvedValueOnce({ data: { data: { alerts: [] } } });
    await checkHealthAlerts('google_fit', { steps: 5000 });
    expect(apiMock.post).toHaveBeenCalled();
  });

  it('checkHealthAlerts throws on error', async () => {
    apiMock.post.mockRejectedValueOnce(new Error('fail'));
    await expect(checkHealthAlerts('google_fit', {})).rejects.toThrow();
  });

  it('updateAlertSettings updates settings', async () => {
    apiMock.post.mockResolvedValueOnce({ data: { success: true, settings: {} } });
    await updateAlertSettings({ lowSteps: true });
    expect(apiMock.post).toHaveBeenCalled();
  });

  it('updateAlertSettings throws on error', async () => {
    apiMock.put.mockRejectedValueOnce(new Error('fail'));
    await expect(updateAlertSettings({})).rejects.toThrow();
  });

  it('toggleAutoSync toggles sync', async () => {
    apiMock.post.mockResolvedValueOnce({ data: { data: { enabled: true } } });
    await toggleAutoSync('google_fit', true);
    expect(apiMock.post).toHaveBeenCalled();
  });

  it('toggleAutoSync throws on error', async () => {
    apiMock.post.mockRejectedValueOnce(new Error('fail'));
    await expect(toggleAutoSync('google_fit', false)).rejects.toThrow();
  });

  it('getAutoSyncSettings returns settings', async () => {
    apiMock.get.mockResolvedValueOnce({ data: { data: { providers: [] } } });
    await getAutoSyncSettings();
    expect(apiMock.get).toHaveBeenCalled();
  });

  it('getAutoSyncSettings throws on error', async () => {
    apiMock.get.mockRejectedValueOnce(new Error('fail'));
    await expect(getAutoSyncSettings()).rejects.toThrow();
  });

  it('getWearableStatus returns status', async () => {
    apiMock.get.mockResolvedValueOnce({ data: { data: { connected: false } } });
    await getWearableStatus();
    expect(apiMock.get).toHaveBeenCalled();
  });

  it('getWearableStatus throws on error', async () => {
    apiMock.get.mockRejectedValueOnce(new Error('fail'));
    await expect(getWearableStatus()).rejects.toThrow();
  });

  it('disconnectWearable disconnects', async () => {
    apiMock.post.mockResolvedValueOnce({ data: { success: true, message: 'Disconnected' } });
    await disconnectWearable('fitbit');
    expect(apiMock.post).toHaveBeenCalled();
  });

  it('disconnectWearable throws on error', async () => {
    apiMock.delete.mockRejectedValueOnce(new Error('fail'));
    await expect(disconnectWearable('fitbit')).rejects.toThrow();
  });

  it('syncWearable syncs device data', async () => {
    apiMock.post.mockResolvedValueOnce({ data: { data: { synced: true } } });
    await syncWearable('fitbit');
    expect(apiMock.post).toHaveBeenCalled();
  });

  it('syncWearable throws on error', async () => {
    apiMock.post.mockRejectedValueOnce(new Error('fail'));
    await expect(syncWearable('fitbit')).rejects.toThrow();
  });

  it('getWearableDetails returns details', async () => {
    apiMock.get.mockResolvedValueOnce({ data: { data: { model: 'Fitbit Charge 5' } } });
    await getWearableDetails();
    expect(apiMock.get).toHaveBeenCalled();
  });

  it('getWearableDetails throws on error', async () => {
    apiMock.get.mockRejectedValueOnce(new Error('fail'));
    await expect(getWearableDetails()).rejects.toThrow();
  });

  it('getFHIRPatient returns patient', async () => {
    apiMock.get.mockResolvedValueOnce({ data: { data: { resourceType: 'Patient', id: 'p1' } } });
    await getFHIRPatient();
    expect(apiMock.get).toHaveBeenCalled();
  });

  it('getFHIRPatient throws on error', async () => {
    apiMock.get.mockRejectedValueOnce(new Error('fail'));
    await expect(getFHIRPatient()).rejects.toThrow();
  });

  it('getFHIRObservations returns bundle', async () => {
    apiMock.get.mockResolvedValueOnce({ data: { data: { resourceType: 'Bundle', entry: [] } } });
    await getFHIRObservations();
    expect(apiMock.get).toHaveBeenCalled();
  });

  it('getFHIRObservations throws on error', async () => {
    apiMock.get.mockRejectedValueOnce(new Error('fail'));
    await expect(getFHIRObservations()).rejects.toThrow();
  });

  it('createCrisisReferral creates referral', async () => {
    apiMock.post.mockResolvedValueOnce({ data: { data: { referralId: 'r1' } } });
    await createCrisisReferral({ reason: 'high risk', provider: 'clinic' });
    expect(apiMock.post).toHaveBeenCalled();
  });

  it('createCrisisReferral throws on error', async () => {
    apiMock.post.mockRejectedValueOnce(new Error('fail'));
    await expect(createCrisisReferral({ reason: 'test' })).rejects.toThrow();
  });
});
