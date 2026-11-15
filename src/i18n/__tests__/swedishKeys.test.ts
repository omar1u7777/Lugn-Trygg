/**
 * The pages a tester found English on have a Swedish text for every key.
 *
 * t('chat.anonymous', 'All chats are anonymous and moderated for safety…')
 * shows its English default when sv.json has no such key, and /social,
 * /badges and the leaderboard had fourteen of those. The badge names came
 * from the server in English ("First Step", "Invite 5 friends") and were
 * shown as sent.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import sv from '../locales/sv.json';
import en from '../locales/en.json';
import no from '../locales/no.json';

const FILES = [
  'src/components/PeerSupportChat.tsx',
  'src/components/BadgeDisplay.tsx',
  'src/components/Leaderboard.tsx',
  'src/components/MoodList.tsx',
  'src/components/mood/CircumplexSliders.tsx',
];

// What the server calls its achievements (rewards_routes.py ACHIEVEMENTS).
const ACHIEVEMENT_IDS = ['first_mood', 'week_streak', 'month_streak', 'mood_warrior', 'journal_starter', 'referral_hero'];

const lookup = (locale: unknown, key: string): unknown =>
  key.split('.').reduce<unknown>(
    (node, part) => (node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined),
    locale,
  );

const keysIn = (file: string) =>
  [...readFileSync(join(process.cwd(), file), 'utf8').matchAll(/\bt\(\s*['"]([A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)+)['"]/g)]
    .map((match) => match[1] ?? '');

describe('Swedish texts for /social, /badges, the leaderboard and the mood log', () => {
  it.each(FILES)('%s uses only keys sv.json has', (file) => {
    const keys = keysIn(file);
    expect(keys.length).toBeGreaterThan(0);
    expect(keys.filter((key) => typeof lookup(sv, key) !== 'string')).toEqual([]);
  });

  it.each(ACHIEVEMENT_IDS)('names the achievement %s in every language', (id) => {
    for (const locale of [sv, en, no]) {
      expect(typeof lookup(locale, `achievements.${id}.title`)).toBe('string');
      expect(typeof lookup(locale, `achievements.${id}.description`)).toBe('string');
    }
  });

  it('does not leave the mood log\'s two axes in English', () => {
    expect(sv.mood.circumplex.title).not.toMatch(/Model/);
    expect(sv.mood.arousal.label).not.toMatch(/Arousal/);
  });

  it('tells screen readers in Swedish that the mood list has loaded', () => {
    const source = readFileSync(join(process.cwd(), 'src/components/MoodList.tsx'), 'utf8');
    expect(source).not.toMatch(/Mood list loaded/);
  });

  it('shows achievements by their id, not by the server\'s English name', () => {
    const source = readFileSync(join(process.cwd(), 'src/components/BadgeDisplay.tsx'), 'utf8');
    expect(source).toMatch(/achievements\.\$\{achievement\.id\}\.title/);
  });
});
