import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../client')>();
  return {
    ...actual,
    api: { get: vi.fn(), post: vi.fn() },
  };
});

vi.mock('../../utils/logger', () => ({
  logger: { debug: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

import { api } from '../client';
import { generateStory } from '../ai';

describe('generateStory id mapping', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses the real story id returned by the server so favourites survive a reload', async () => {
    // The history endpoint keys stories by their Firestore doc id. If the
    // generated story is given a throwaway client id instead, a favourite set
    // right after generation points at an id that never comes back from the
    // server -- it silently disappears on reload.
    vi.mocked(api.post).mockResolvedValue({
      data: { success: true, data: { id: 'story_2026-08-07T10:00:00+00:00', story: 'En lugn kväll vid havet. Vågorna rullar in.' } },
    } as never);

    const story = await generateStory('sv');

    expect(story.id).toBe('story_2026-08-07T10:00:00+00:00');
  });

  it('still produces a usable id when the server omits one', async () => {
    vi.mocked(api.post).mockResolvedValue({
      data: { success: true, data: { story: 'En lugn kväll vid havet.' } },
    } as never);

    const story = await generateStory('sv');

    expect(story.id).toBeTruthy();
    expect(typeof story.id).toBe('string');
  });
});
