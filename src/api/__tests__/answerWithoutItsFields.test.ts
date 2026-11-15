/**
 * An answer that lacks the field a page is built from is a failed request.
 *
 * /recommendations and /integrations each went down to "Något gick fel" when
 * the API answered successfully but without the object the page reads:
 * getActivityProgress handed `undefined` to a state updater that read
 * `remote.exercisesCompleted`, and getSyncStats handed back stats whose
 * `byProvider` the chart passed to Object.values. Both callers already handle
 * a rejected request (keep what is stored locally; show that statistics could
 * not be fetched), so the functions now reject instead of returning something
 * that is not what their type says.
 */
import { vi, describe, it, expect, beforeEach } from 'vitest';

const apiMock = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() }));
vi.mock('../client', () => ({ api: apiMock, default: apiMock, apiClient: apiMock }));

import { getActivityProgress, saveActivityProgress } from '../dashboard';
import { getSyncStats } from '../sync';

const answer = (data: unknown) => ({ data: { success: true, data } });

const STATS = {
  totalSyncs: 3, successCount: 2, failedCount: 1, partialCount: 0, successRate: 66.7, lastSync: null,
  byProvider: { fitbit: { name: 'Fitbit', total: 3, success: 2, failed: 1 } },
};

describe('getActivityProgress', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns the counters the server holds', async () => {
    const activityProgress = { exercisesCompleted: 4, meditationMinutes: 20, articlesRead: 1 };
    apiMock.get.mockResolvedValueOnce(answer({ activityProgress }));

    await expect(getActivityProgress()).resolves.toEqual(activityProgress);
  });

  it.each([[{}], [{ activityProgress: null }], [{ activityProgress: 'none' }], [null]])(
    'rejects an answer without them: %j',
    async (data) => {
      apiMock.get.mockResolvedValueOnce(answer(data));

      await expect(getActivityProgress()).rejects.toThrow();
    },
  );

  it('rejects a save that is answered without them', async () => {
    apiMock.post.mockResolvedValueOnce(answer({}));

    await expect(saveActivityProgress({ exercisesCompleted: 1 })).rejects.toThrow();
  });
});

describe('getSyncStats', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns the statistics', async () => {
    apiMock.get.mockResolvedValueOnce(answer(STATS));

    await expect(getSyncStats()).resolves.toEqual(STATS);
  });

  it.each([[{}], [{ ...STATS, byProvider: undefined }], [{ ...STATS, totalSyncs: '3' }], [null]])(
    'rejects an answer that is not statistics: %j',
    async (data) => {
      apiMock.get.mockResolvedValueOnce(answer(data));

      await expect(getSyncStats()).rejects.toThrow();
    },
  );
});
