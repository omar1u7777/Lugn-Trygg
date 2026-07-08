/**
 * TDD tests for live bugs found in production.
 *
 * BUG A: MemoryJournal handleSubmit lacks isSubmitting guard — double-click creates duplicates
 * BUG B: MoodList displays raw float score (0.10000000149011612/10) without formatting
 * BUG D: getMemories uses wrong API endpoint (old audio memory vs unified memory)
 * BUG E: Legacy sentiment_score (-1 to +1) displayed as 1-10 score
 */
import { vi, describe, it, expect, beforeEach } from 'vitest';

const apiMock = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() }));
vi.mock('../client', () => ({ api: apiMock, default: apiMock, apiClient: apiMock }));

import { getMemories } from '../memories';

describe('BUG D: getMemories endpoint', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should call the unified memory endpoint, not the old audio endpoint', async () => {
    apiMock.get.mockResolvedValueOnce({ data: { data: { memories: [] } } });
    await getMemories('user123');
    const calledUrl = apiMock.get.mock.calls[0][0];
    expect(calledUrl).toContain('memory-unified');
    expect(calledUrl).not.toContain('/memory/list');
  });
});
