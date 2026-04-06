import { vi, describe, it, expect, beforeEach } from 'vitest';

const apiMock = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() }));
vi.mock('../client', () => ({ api: apiMock, default: apiMock, apiClient: apiMock }));

import {
  getRetentionStatus,
  triggerRetentionCleanup,
  triggerSystemRetentionCleanup,
  DEFAULT_RETENTION_POLICY,
  formatRetentionPeriod,
  getTotalExpiredCount,
  getCollectionsWithExpiredData,
  formatCollectionName,
  isCleanupRecommended,
  getRetentionWarningMessage,
  estimateStorageSaved,
  getNextCleanupDate,
  shouldNotifyUser,
} from '../dataRetention';

const makeStatus = (expiredCounts: Record<string, number> = {}, nextCleanup?: string) => ({
  user_id: 'u1',
  policy: DEFAULT_RETENTION_POLICY,
  retention_status: {
    moods: { expired_count: expiredCounts.moods ?? 0, will_be_deleted: (expiredCounts.moods ?? 0) > 0, oldest_entry: null, total_entries: 10 },
    memories: { expired_count: expiredCounts.memories ?? 0, will_be_deleted: (expiredCounts.memories ?? 0) > 0, oldest_entry: null, total_entries: 5 },
  },
  next_cleanup: nextCleanup ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  last_cleanup: null,
});

describe('dataRetention API', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('async functions', () => {
    it('getRetentionStatus resolves', async () => {
      const s = makeStatus();
      apiMock.get.mockResolvedValueOnce({ data: s });
      const result = await getRetentionStatus('u1');
      expect(apiMock.get).toHaveBeenCalled();
    });

    it('triggerRetentionCleanup resolves', async () => {
      apiMock.post.mockResolvedValueOnce({ data: { deleted_total: 5, collections_processed: [] } });
      const result = await triggerRetentionCleanup('u1');
      expect(apiMock.post).toHaveBeenCalled();
    });

    it('triggerSystemRetentionCleanup resolves', async () => {
      apiMock.post.mockResolvedValueOnce({ data: { deleted_total: 30, collections_processed: [] } });
      const result = await triggerSystemRetentionCleanup();
      expect(apiMock.post).toHaveBeenCalled();
    });
  });

  describe('DEFAULT_RETENTION_POLICY', () => {
    it('has moods set to 2555 days', () => {
      expect(DEFAULT_RETENTION_POLICY.moods).toBe(2555);
    });

    it('has notifications set to 365 days', () => {
      expect(DEFAULT_RETENTION_POLICY.notifications).toBe(365);
    });
  });

  describe('formatRetentionPeriod', () => {
    it('formats days when < 30', () => {
      expect(formatRetentionPeriod(15)).toBe('15 dagar');
    });

    it('formats months when < 365', () => {
      expect(formatRetentionPeriod(60)).toBe('2 månader');
    });

    it('formats 1 month (singular)', () => {
      expect(formatRetentionPeriod(30)).toBe('1 månad');
    });

    it('formats years when >= 365', () => {
      expect(formatRetentionPeriod(730)).toBe('2 år');
      expect(formatRetentionPeriod(2555)).toBe('7 år');
    });
  });

  describe('getTotalExpiredCount', () => {
    it('sums expired counts', () => {
      const s = makeStatus({ moods: 10, memories: 5 });
      expect(getTotalExpiredCount(s)).toBe(15);
    });

    it('returns 0 when nothing expired', () => {
      expect(getTotalExpiredCount(makeStatus())).toBe(0);
    });
  });

  describe('getCollectionsWithExpiredData', () => {
    it('returns collections with will_be_deleted=true and expired_count>0', () => {
      const s = makeStatus({ moods: 5, memories: 0 });
      const result = getCollectionsWithExpiredData(s);
      expect(result).toContain('moods');
      expect(result).not.toContain('memories');
    });
  });

  describe('formatCollectionName', () => {
    it('translates known collections', () => {
      expect(formatCollectionName('moods')).toBe('Humörloggar');
      expect(formatCollectionName('memories')).toBe('Minnen');
      expect(formatCollectionName('notifications')).toBe('Notifikationer');
    });

    it('returns raw name for unknown collection', () => {
      expect(formatCollectionName('unknown_collection')).toBe('unknown_collection');
    });
  });

  describe('isCleanupRecommended', () => {
    it('true when expired > 100', () => {
      expect(isCleanupRecommended(makeStatus({ moods: 101 }))).toBe(true);
    });

    it('false when expired <= 100', () => {
      expect(isCleanupRecommended(makeStatus({ moods: 99 }))).toBe(false);
    });
  });

  describe('getRetentionWarningMessage', () => {
    it('returns no-data message for 0', () => {
      expect(getRetentionWarningMessage(0)).toContain('Ingen data');
    });

    it('returns low warning for < 50', () => {
      expect(getRetentionWarningMessage(25)).toContain('25');
    });

    it('returns medium warning for 50-199', () => {
      expect(getRetentionWarningMessage(100)).toContain('100');
      expect(getRetentionWarningMessage(100)).toContain('bör');
    });

    it('returns urgent warning for >= 200', () => {
      expect(getRetentionWarningMessage(200)).toContain('⚠️');
    });
  });

  describe('estimateStorageSaved', () => {
    it('formats KB for small cleanups', () => {
      const result = estimateStorageSaved({
        deleted_total: 10,
        collections_processed: [{ collection: 'moods', deleted: 10, skipped: 0 }],
        duration_seconds: 1,
        status: 'completed',
      });
      expect(result).toMatch(/KB|MB|GB/);
    });

    it('formats MB for larger cleanups', () => {
      const result = estimateStorageSaved({
        deleted_total: 1000,
        collections_processed: [{ collection: 'voice_data', deleted: 11, skipped: 0 }],
        duration_seconds: 1,
        status: 'completed',
      });
      expect(result).toMatch(/MB|GB/);
    });
  });

  describe('getNextCleanupDate', () => {
    it('returns a Date object', () => {
      const future = new Date(Date.now() + 86400000).toISOString();
      const result = getNextCleanupDate(makeStatus({}, future));
      expect(result instanceof Date).toBe(true);
    });
  });

  describe('shouldNotifyUser', () => {
    it('true when expired > 500', () => {
      const status = makeStatus({ moods: 501 });
      expect(shouldNotifyUser(status)).toBe(true);
    });

    it('true when cleanup within 7 days', () => {
      const soon = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
      expect(shouldNotifyUser(makeStatus({}, soon))).toBe(true);
    });

    it('false when few expired and cleanup far away', () => {
      const far = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      expect(shouldNotifyUser(makeStatus({ moods: 10 }, far))).toBe(false);
    });
  });
});
