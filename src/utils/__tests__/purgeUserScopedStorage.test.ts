import { describe, it, expect, beforeEach } from 'vitest';
import { purgeUserScopedStorage } from '../secureStorage';

/**
 * On a shared device, whatever survives logout belongs to the NEXT person who
 * signs in. Two of the most sensitive keys were missing from the purge list:
 *
 *  - lugn_trygg_offline_data: plaintext mood `notes`, memory `content` and the
 *    full bodies of queued POST/PUT requests, written by offlineStorage.ts.
 *    Its own clearOfflineData() has no callers, so nothing removed it.
 *  - privacy_settings: the unscoped cache written by encryptionService.ts,
 *    which became the next user's fallback whenever their backend fetch failed.
 */
describe('purgeUserScopedStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('removes the offline queue containing mood notes and memories', () => {
    localStorage.setItem(
      'lugn_trygg_offline_data',
      JSON.stringify({
        moods: [{ id: 'mood_1', mood: 'sad', notes: 'private note', synced: false }],
        memories: [{ id: 'memory_1', title: 't', content: 'private memory' }],
        queuedRequests: [{ id: 'req_1', method: 'POST', endpoint: '/api/v1/mood', data: {} }],
        lastSyncTime: 0,
      })
    );

    purgeUserScopedStorage();

    expect(localStorage.getItem('lugn_trygg_offline_data')).toBeNull();
  });

  it('removes the unscoped privacy settings cache', () => {
    localStorage.setItem('privacy_settings', JSON.stringify({ allowAnalytics: false }));

    purgeUserScopedStorage();

    expect(localStorage.getItem('privacy_settings')).toBeNull();
  });

  it('still removes the previously registered per-user feature caches', () => {
    localStorage.setItem('chat-analytics-user-1', '{}');
    localStorage.setItem('gratitude_challenge_user-1', '{}');
    localStorage.setItem('lugn_trygg_subscription_cache_user-1', '{}');

    purgeUserScopedStorage();

    expect(localStorage.getItem('chat-analytics-user-1')).toBeNull();
    expect(localStorage.getItem('gratitude_challenge_user-1')).toBeNull();
    expect(localStorage.getItem('lugn_trygg_subscription_cache_user-1')).toBeNull();
  });

  it('leaves device-level preferences alone', () => {
    // These are not user data and survive logout by design.
    localStorage.setItem('theme', 'dark');
    localStorage.setItem('consent_given', 'true');

    purgeUserScopedStorage();

    expect(localStorage.getItem('theme')).toBe('dark');
    expect(localStorage.getItem('consent_given')).toBe('true');
  });
});
