import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string, f?: string) => (typeof f === 'string' ? f : k) }),
}));

vi.mock('../../hooks/useAuth', () => ({
  default: () => ({ user: { user_id: 'user-1' }, isLoggedIn: true }),
}));

vi.mock('../../api/api', () => ({
  getMoods: vi.fn(),
  getMoodTotal: vi.fn(),
  getMemories: vi.fn(),
  getJournalEntries: vi.fn(),
  saveJournalEntry: vi.fn(),
}));

vi.mock('../ui/OptimizedImage', () => ({
  default: ({ alt }: { alt: string }) => <img alt={alt} />,
}));

vi.mock('../../config/env', () => ({ getJournalHeroImageId: () => 'hero-id' }));

vi.mock('../../utils/logger', () => ({
  logger: { debug: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

vi.mock('../JournalList', () => ({ default: () => <div>JournalList</div> }));
vi.mock('../MoodList', () => ({ default: () => <div>MoodList</div> }));
vi.mock('../MemoryJournal', () => ({ default: () => <div>MemoryJournal</div> }));

import JournalHub from '../JournalHub';
import { getMoods, getMoodTotal, getMemories, getJournalEntries } from '../../api/api';

/** Local-midnight ISO timestamp N days back, i.e. what a real client writes. */
const localDaysAgo = (daysAgo: number, hour: number) => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
};

describe('JournalHub stats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getMoods).mockResolvedValue([]);
    vi.mocked(getMoodTotal).mockResolvedValue(0);
    vi.mocked(getMemories).mockResolvedValue([]);
    vi.mocked(getJournalEntries).mockResolvedValue([]);
  });

  it('counts a late-night and an early-morning entry on adjacent local days as a 2-day streak', async () => {
    // Keyed by UTC day these two collapse into one day for any timezone east
    // of UTC, silently under-counting the streak. They are two distinct local
    // calendar days and must count as two.
    vi.mocked(getMoods).mockResolvedValue([
      { timestamp: localDaysAgo(0, 1) },   // today, 01:00 local
      { timestamp: localDaysAgo(1, 23) },  // yesterday, 23:00 local
    ] as never);

    render(<JournalHub />);

    await waitFor(() => {
      expect(screen.getByText('Dagar i rad')).toBeInTheDocument();
    });
    await waitFor(() => {
      const streakCard = screen.getByText('Dagar i rad').closest('div')?.parentElement;
      expect(streakCard?.textContent).toContain('2');
    });
  });

  it('surfaces an error banner instead of showing a misleading 0 when a stats fetch fails', async () => {
    // Promise.allSettled never rejects; without an explicit check a failed
    // fetch renders "0 Dagboksanteckningar", which in a journaling app is
    // indistinguishable from having lost every entry.
    vi.mocked(getJournalEntries).mockRejectedValue(new Error('network down'));

    render(<JournalHub />);

    expect(await screen.findByText(/Kunde inte hämta din statistik/)).toBeInTheDocument();
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  it('counts mood logs from the server total, not the first page (UI audit D-1)', async () => {
    // getMoods returns one page of 50; the user has 122.
    vi.mocked(getMoods).mockResolvedValue(Array.from({ length: 50 }, (_, i) => ({ id: `m${i}` })) as never);
    vi.mocked(getMoodTotal).mockResolvedValue(122);

    render(<JournalHub />);

    await waitFor(() => {
      const card = screen.getByText('Humörloggar').closest('div')?.parentElement;
      expect(card?.textContent).toContain('122');
    });
  });

  it('shows real counts with no error banner when every fetch succeeds', async () => {
    vi.mocked(getJournalEntries).mockResolvedValue([{ id: 'j1' }, { id: 'j2' }] as never);

    render(<JournalHub />);

    await waitFor(() => {
      expect(screen.getByText('Dagboksanteckningar')).toBeInTheDocument();
    });
    await waitFor(() => {
      const card = screen.getByText('Dagboksanteckningar').closest('div')?.parentElement;
      expect(card?.textContent).toContain('2');
    });
    expect(screen.queryByText(/Kunde inte hämta din statistik/)).not.toBeInTheDocument();
  });
});
