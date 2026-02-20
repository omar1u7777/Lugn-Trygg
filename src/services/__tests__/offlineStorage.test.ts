// Mock logger to suppress output
vi.mock('../../utils/logger', () => ({
  logger: { debug: vi.fn(), error: vi.fn(), warn: vi.fn(), info: vi.fn(), log: vi.fn() },
}));

import {
  getOfflineData,
  addOfflineMoodLog,
  addOfflineMemory,
  queueRequest,
  getUnsyncedData,
  markMoodAsSynced,
  markMemoryAsSynced,
  removeQueuedRequest,
  retryQueuedRequest,
  clearOfflineData,
  isOffline,
} from '../offlineStorage';

const STORAGE_KEY = 'lugn_trygg_offline_data';

describe('offlineStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('getOfflineData', () => {
    it('returns default shape when nothing stored', () => {
      const data = getOfflineData();
      expect(data.moods).toEqual([]);
      expect(data.memories).toEqual([]);
      expect(data.queuedRequests).toEqual([]);
      expect(data.lastSyncTime).toBeGreaterThan(0);
    });

    it('parses stored JSON', () => {
      const stored = {
        moods: [{ id: 'm1', mood: 'happy', intensity: 8, timestamp: 1, synced: false }],
        memories: [],
        queuedRequests: [],
        lastSyncTime: 100,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));

      const data = getOfflineData();
      expect(data.moods).toHaveLength(1);
      expect(data.moods[0].mood).toBe('happy');
    });
  });

  describe('addOfflineMoodLog', () => {
    it('adds mood to storage and returns it', () => {
      const mood = addOfflineMoodLog('glad', 7, 'Bra dag');
      expect(mood.mood).toBe('glad');
      expect(mood.intensity).toBe(7);
      expect(mood.notes).toBe('Bra dag');
      expect(mood.synced).toBe(false);
      expect(mood.id).toContain('mood_');

      const data = getOfflineData();
      expect(data.moods).toHaveLength(1);
    });

    it('appends multiple moods', () => {
      addOfflineMoodLog('glad', 5);
      addOfflineMoodLog('ledsen', 3);
      expect(getOfflineData().moods).toHaveLength(2);
    });
  });

  describe('addOfflineMemory', () => {
    it('adds memory and returns it', () => {
      const mem = addOfflineMemory('Min titel', 'Innehåll');
      expect(mem.title).toBe('Min titel');
      expect(mem.content).toBe('Innehåll');
      expect(mem.synced).toBe(false);
      expect(getOfflineData().memories).toHaveLength(1);
    });
  });

  describe('queueRequest', () => {
    it('queues a POST request', () => {
      const req = queueRequest('POST', '/api/mood', { mood: 'happy' });
      expect(req.method).toBe('POST');
      expect(req.endpoint).toBe('/api/mood');
      expect(req.retries).toBe(0);
      expect(getOfflineData().queuedRequests).toHaveLength(1);
    });
  });

  describe('getUnsyncedData', () => {
    it('returns only unsynced items', () => {
      addOfflineMoodLog('a', 1);
      addOfflineMoodLog('b', 2);
      markMoodAsSynced(getOfflineData().moods[0].id);

      const unsynced = getUnsyncedData();
      expect(unsynced.moods).toHaveLength(1);
      expect(unsynced.moods[0].mood).toBe('b');
    });

    it('excludes requests that exceeded max retries', () => {
      const req = queueRequest('POST', '/api/test', {});
      retryQueuedRequest(req.id);
      retryQueuedRequest(req.id);
      retryQueuedRequest(req.id); // 3 retries = MAX_RETRIES

      const unsynced = getUnsyncedData();
      expect(unsynced.requests).toHaveLength(0);
    });

    it('totalCount sums all unsynced', () => {
      addOfflineMoodLog('a', 1);
      addOfflineMemory('title', 'content');
      queueRequest('PUT', '/api/x', {});

      const unsynced = getUnsyncedData();
      expect(unsynced.totalCount).toBe(3);
    });
  });

  describe('markMoodAsSynced', () => {
    it('marks a mood as synced', () => {
      addOfflineMoodLog('test', 5);
      const moodId = getOfflineData().moods[0].id;

      markMoodAsSynced(moodId);
      expect(getOfflineData().moods[0].synced).toBe(true);
    });

    it('no-op for unknown id', () => {
      addOfflineMoodLog('test', 5);
      markMoodAsSynced('nonexistent');
      expect(getOfflineData().moods[0].synced).toBe(false);
    });
  });

  describe('markMemoryAsSynced', () => {
    it('marks a memory as synced', () => {
      addOfflineMemory('t', 'c');
      const memId = getOfflineData().memories[0].id;

      markMemoryAsSynced(memId);
      expect(getOfflineData().memories[0].synced).toBe(true);
    });
  });

  describe('removeQueuedRequest', () => {
    it('removes request by id', () => {
      const req = queueRequest('DELETE', '/api/x', {});
      expect(getOfflineData().queuedRequests).toHaveLength(1);

      removeQueuedRequest(req.id);
      expect(getOfflineData().queuedRequests).toHaveLength(0);
    });
  });

  describe('retryQueuedRequest', () => {
    it('increments retry count', () => {
      const req = queueRequest('POST', '/api/y', {});
      retryQueuedRequest(req.id);

      const data = getOfflineData();
      expect(data.queuedRequests[0].retries).toBe(1);
    });
  });

  describe('clearOfflineData', () => {
    it('removes all offline data', () => {
      addOfflineMoodLog('a', 1);
      addOfflineMemory('b', 'c');
      clearOfflineData();

      expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
      expect(getOfflineData().moods).toEqual([]);
    });
  });

  describe('isOffline', () => {
    it('returns boolean based on navigator.onLine', () => {
      // navigator.onLine is true in jsdom by default
      expect(typeof isOffline()).toBe('boolean');
    });
  });
});
