import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

vi.mock('../../utils/logger', () => ({
  logger: { debug: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

const { saveJournalEntryMock, getJournalEntriesMock } = vi.hoisted(() => ({
  saveJournalEntryMock: vi.fn(),
  getJournalEntriesMock: vi.fn(),
}));

vi.mock('../../api/api', () => ({
  saveJournalEntry: saveJournalEntryMock,
  getJournalEntries: getJournalEntriesMock,
}));

import { useJournaling } from '../useJournaling';
import type { User } from '../../types';

const makeUser = (override: Partial<User> = {}): User => ({
  user_id: 'user-1',
  email: 'test@example.com',
  ...override,
} as User);

describe('useJournaling', () => {
  const announce = vi.fn();
  const onProgress = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    getJournalEntriesMock.mockResolvedValue([]);
    saveJournalEntryMock.mockResolvedValue({ id: 'e1' });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('starts with empty state', () => {
    const { result } = renderHook(() =>
      useJournaling({ user: makeUser(), announce, onProgress })
    );
    expect(result.current.content).toBe('');
    expect(result.current.mood).toBeUndefined();
    expect(result.current.tags).toEqual([]);
    expect(result.current.isSaving).toBe(false);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.entries).toEqual([]);
  });

  it('setContent updates content', () => {
    const { result } = renderHook(() =>
      useJournaling({ user: makeUser(), announce, onProgress })
    );
    act(() => {
      result.current.setContent('Idag var det en bra dag');
    });
    expect(result.current.content).toBe('Idag var det en bra dag');
  });

  it('setMood updates mood', () => {
    const { result } = renderHook(() =>
      useJournaling({ user: makeUser(), announce, onProgress })
    );
    act(() => {
      result.current.setMood(7);
    });
    expect(result.current.mood).toBe(7);
  });

  it('setTags updates tags', () => {
    const { result } = renderHook(() =>
      useJournaling({ user: makeUser(), announce, onProgress })
    );
    act(() => {
      result.current.setTags(['stress', 'work']);
    });
    expect(result.current.tags).toEqual(['stress', 'work']);
  });

  describe('loadHistory', () => {
    it('loads journal entries and stores them', async () => {
      const entries = [{ id: 'e1', content: 'Entry 1' }, { id: 'e2', content: 'Entry 2' }];
      getJournalEntriesMock.mockResolvedValue(entries);

      const { result } = renderHook(() =>
        useJournaling({ user: makeUser(), announce, onProgress })
      );

      await act(async () => {
        await result.current.loadHistory();
      });

      expect(getJournalEntriesMock).toHaveBeenCalledWith('user-1', 20);
      expect(result.current.entries).toEqual(entries);
    });

    it('does nothing when user is null', async () => {
      const { result } = renderHook(() =>
        useJournaling({ user: null, announce, onProgress })
      );

      await act(async () => {
        await result.current.loadHistory();
      });

      expect(getJournalEntriesMock).not.toHaveBeenCalled();
    });

    it('does nothing when user has no user_id', async () => {
      const { result } = renderHook(() =>
        useJournaling({ user: { email: 'test@example.com' } as User, announce, onProgress })
      );

      await act(async () => {
        await result.current.loadHistory();
      });

      expect(getJournalEntriesMock).not.toHaveBeenCalled();
    });

    it('handles load error gracefully', async () => {
      getJournalEntriesMock.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() =>
        useJournaling({ user: makeUser(), announce, onProgress })
      );

      await act(async () => {
        await result.current.loadHistory();
      });

      // Should not set entries and not throw
      expect(result.current.entries).toEqual([]);
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('saveEntry', () => {
    it('saves entry and resets form', async () => {
      const { result } = renderHook(() =>
        useJournaling({ user: makeUser(), announce, onProgress })
      );

      act(() => {
        result.current.setContent('Test journal entry');
        result.current.setMood(8);
        result.current.setTags(['happy']);
      });

      await act(async () => {
        await result.current.saveEntry();
      });

      expect(saveJournalEntryMock).toHaveBeenCalledWith('user-1', 'Test journal entry', 8, ['happy']);
      expect(result.current.content).toBe('');
      expect(result.current.mood).toBeUndefined();
      expect(result.current.tags).toEqual([]);
    });

    it('announces error when content is empty', async () => {
      const { result } = renderHook(() =>
        useJournaling({ user: makeUser(), announce, onProgress })
      );

      await act(async () => {
        await result.current.saveEntry();
      });

      expect(announce).toHaveBeenCalledWith(
        'Skriv något i din journal innan du sparar',
        'assertive'
      );
      expect(saveJournalEntryMock).not.toHaveBeenCalled();
    });

    it('announces error when user is null', async () => {
      const { result } = renderHook(() =>
        useJournaling({ user: null, announce, onProgress })
      );

      act(() => {
        result.current.setContent('Some content');
      });

      await act(async () => {
        await result.current.saveEntry();
      });

      expect(announce).toHaveBeenCalledWith(
        'Skriv något i din journal innan du sparar',
        'assertive'
      );
    });

    it('announces success after save', async () => {
      const { result } = renderHook(() =>
        useJournaling({ user: makeUser(), announce, onProgress })
      );

      act(() => {
        result.current.setContent('My entry');
      });

      await act(async () => {
        await result.current.saveEntry();
      });

      expect(announce).toHaveBeenCalledWith('Journalanteckning sparad!', 'polite');
    });

    it('calls onProgress with exercise 10 after save', async () => {
      const { result } = renderHook(() =>
        useJournaling({ user: makeUser(), announce, onProgress })
      );

      act(() => {
        result.current.setContent('My entry');
      });

      await act(async () => {
        await result.current.saveEntry();
      });

      expect(onProgress).toHaveBeenCalledWith('exercise', 10);
    });

    it('handles save failure gracefully', async () => {
      saveJournalEntryMock.mockRejectedValue(new Error('Save failed'));

      const { result } = renderHook(() =>
        useJournaling({ user: makeUser(), announce, onProgress })
      );

      act(() => {
        result.current.setContent('My entry');
      });

      await act(async () => {
        await result.current.saveEntry();
      });

      expect(announce).toHaveBeenCalledWith(
        'Kunde inte spara journalanteckning',
        'assertive'
      );
      expect(result.current.isSaving).toBe(false);
    });

    it('trims whitespace from content before saving', async () => {
      const { result } = renderHook(() =>
        useJournaling({ user: makeUser(), announce, onProgress })
      );

      act(() => {
        result.current.setContent('  My entry  ');
      });

      await act(async () => {
        await result.current.saveEntry();
      });

      expect(saveJournalEntryMock).toHaveBeenCalledWith('user-1', 'My entry', undefined, []);
    });
  });
});
