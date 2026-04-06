import { vi, describe, it, expect, beforeEach } from 'vitest';

const apiMock = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() }));
vi.mock('../client', () => ({ api: apiMock, default: apiMock, apiClient: apiMock }));
vi.mock('../../utils/logger', () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() } }));

import {
  saveJournalEntry,
  getJournalEntries,
  updateJournalEntry,
  deleteJournalEntry,
  getJournalEntryById,
} from '../journaling';

describe('journaling API', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('saveJournalEntry', () => {
    it('posts and returns entry', async () => {
      const entry = { id: 'j1', content: 'My day', mood: 5, tags: [], createdAt: new Date().toISOString() };
      apiMock.post.mockResolvedValueOnce({ data: { data: entry } });
      const result = await saveJournalEntry('u1', 'My day', 5);
      expect(apiMock.post).toHaveBeenCalled();
      expect(result).toMatchObject(entry);
    });

    it('throws on error', async () => {
      apiMock.post.mockRejectedValueOnce(new Error('fail'));
      await expect(saveJournalEntry('u1', '')).rejects.toThrow();
    });
  });

  describe('getJournalEntries', () => {
    it('returns entries array', async () => {
      const entries = [{ id: 'j1' }, { id: 'j2' }];
      apiMock.get.mockResolvedValueOnce({ data: { data: { entries } } });
      const result = await getJournalEntries('u1');
      expect(Array.isArray(result)).toBe(true);
    });

    it('throws on error', async () => {
      apiMock.get.mockRejectedValueOnce(new Error('fail'));
      await expect(getJournalEntries('u1')).rejects.toThrow();
    });
  });

  describe('updateJournalEntry', () => {
    it('updates and returns entry', async () => {
      const updated = { id: 'j1', content: 'Updated' };
      apiMock.put.mockResolvedValueOnce({ data: { data: updated } });
      const result = await updateJournalEntry('u1', 'j1', { content: 'Updated' });
      expect(result).toMatchObject(updated);
    });

    it('throws on error', async () => {
      apiMock.put.mockRejectedValueOnce(new Error('fail'));
      await expect(updateJournalEntry('u1', 'j1', {})).rejects.toThrow();
    });
  });

  describe('deleteJournalEntry', () => {
    it('deletes entry', async () => {
      apiMock.delete.mockResolvedValueOnce({ data: { success: true } });
      await expect(deleteJournalEntry('u1', 'j1')).resolves.not.toThrow();
      expect(apiMock.delete).toHaveBeenCalled();
    });

    it('throws on error', async () => {
      apiMock.delete.mockRejectedValueOnce(new Error('fail'));
      await expect(deleteJournalEntry('u1', 'j1')).rejects.toThrow();
    });
  });

  describe('getJournalEntryById', () => {
    it('returns a single entry from entries list', async () => {
      const entries = [{ id: 'j1', content: 'Test' }, { id: 'j2', content: 'Other' }];
      apiMock.get.mockResolvedValueOnce({ data: { data: { entries } } });
      const result = await getJournalEntryById('u1', 'j1');
      expect(result).toMatchObject({ id: 'j1', content: 'Test' });
    });

    it('returns null when entry not found', async () => {
      apiMock.get.mockResolvedValueOnce({ data: { data: { entries: [] } } });
      const result = await getJournalEntryById('u1', 'missing');
      expect(result).toBeNull();
    });

    it('throws on error', async () => {
      apiMock.get.mockRejectedValueOnce(new Error('fail'));
      await expect(getJournalEntryById('u1', 'j1')).rejects.toThrow();
    });
  });
});
