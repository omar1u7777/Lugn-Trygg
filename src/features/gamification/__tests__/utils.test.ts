/**
 * Tests for gamification utility functions.
 * All pure functions — no mocks required.
 */
import { describe, it, expect } from 'vitest';
import {
  calculateLevel,
  getXPForLevel,
  getXPToNextLevel,
  getBadgeRarity,
  getRarityColor,
  formatXP,
  calculateProgress,
  getLevelBadge,
  getStreakMultiplier,
  isAlmostUnlocked,
  getCelebrationAnimation,
} from '../utils';

describe('calculateLevel', () => {
  it('returns level 1 for 0 XP', () => {
    const result = calculateLevel(0);
    expect(result.level).toBe(1);
    expect(result.xpInLevel).toBe(0);
  });

  it('returns level 2 for 100 XP', () => {
    const result = calculateLevel(100);
    expect(result.level).toBe(2);
  });

  it('returns level 3 for 400 XP', () => {
    const result = calculateLevel(400);
    expect(result.level).toBe(3);
  });

  it('returns level 4 for 900 XP', () => {
    const result = calculateLevel(900);
    expect(result.level).toBe(4);
  });

  it('handles negative XP gracefully', () => {
    const result = calculateLevel(-50);
    expect(result.level).toBe(1);
  });

  it('returns xpInLevel correctly', () => {
    // Level 2 starts at 100 XP, level 3 at 400 XP
    // 250 XP → level 2, xpInLevel = 250 - 100 = 150
    const result = calculateLevel(250);
    expect(result.level).toBe(2);
    expect(result.xpInLevel).toBe(150);
  });

  it('returns correct xpForNextLevel', () => {
    const result = calculateLevel(0);
    expect(result.xpForNextLevel).toBe(100); // level 1 → 2 needs 100
  });
});

describe('getXPForLevel', () => {
  it('returns 0 for level 1', () => {
    expect(getXPForLevel(1)).toBe(0);
  });

  it('returns 100 for level 2', () => {
    expect(getXPForLevel(2)).toBe(100);
  });

  it('returns 400 for level 3', () => {
    expect(getXPForLevel(3)).toBe(400);
  });

  it('returns 900 for level 4', () => {
    expect(getXPForLevel(4)).toBe(900);
  });

  it('returns 0 for level <= 1 (including 0)', () => {
    expect(getXPForLevel(0)).toBe(0);
  });
});

describe('getXPToNextLevel', () => {
  it('returns 100 for level 1', () => {
    expect(getXPToNextLevel(1)).toBe(100);
  });

  it('returns 400 for level 2', () => {
    expect(getXPToNextLevel(2)).toBe(400);
  });

  it('returns 900 for level 3', () => {
    expect(getXPToNextLevel(3)).toBe(900);
  });
});

describe('getBadgeRarity', () => {
  it('returns legendary for difficulty >= 90', () => {
    expect(getBadgeRarity(90)).toBe('legendary');
    expect(getBadgeRarity(100)).toBe('legendary');
  });

  it('returns epic for difficulty >= 70', () => {
    expect(getBadgeRarity(70)).toBe('epic');
    expect(getBadgeRarity(89)).toBe('epic');
  });

  it('returns rare for difficulty >= 40', () => {
    expect(getBadgeRarity(40)).toBe('rare');
    expect(getBadgeRarity(69)).toBe('rare');
  });

  it('returns common for difficulty < 40', () => {
    expect(getBadgeRarity(0)).toBe('common');
    expect(getBadgeRarity(39)).toBe('common');
  });
});

describe('getRarityColor', () => {
  it('returns a non-empty string for each rarity', () => {
    (['common', 'rare', 'epic', 'legendary'] as const).forEach((rarity) => {
      expect(typeof getRarityColor(rarity)).toBe('string');
      expect(getRarityColor(rarity).length).toBeGreaterThan(0);
    });
  });

  it('returns different colors for different rarities', () => {
    expect(getRarityColor('common')).not.toBe(getRarityColor('legendary'));
    expect(getRarityColor('rare')).not.toBe(getRarityColor('epic'));
  });
});

describe('formatXP', () => {
  it('formats integers below 1000 as-is', () => {
    expect(formatXP(0)).toBe('0');
    expect(formatXP(500)).toBe('500');
    expect(formatXP(999)).toBe('999');
  });

  it('formats thousands with k suffix', () => {
    expect(formatXP(1000)).toBe('1.0k');
    expect(formatXP(5500)).toBe('5.5k');
    expect(formatXP(999999)).toBe('1000.0k');
  });

  it('formats millions with M suffix', () => {
    expect(formatXP(1000000)).toBe('1.0M');
    expect(formatXP(2500000)).toBe('2.5M');
  });
});

describe('calculateProgress', () => {
  it('returns 0 when max is 0', () => {
    expect(calculateProgress(10, 0)).toBe(0);
  });

  it('returns 0 for 0/100', () => {
    expect(calculateProgress(0, 100)).toBe(0);
  });

  it('returns 50 for 50/100', () => {
    expect(calculateProgress(50, 100)).toBe(50);
  });

  it('returns 100 for 100/100', () => {
    expect(calculateProgress(100, 100)).toBe(100);
  });

  it('caps at 100 when current > max', () => {
    expect(calculateProgress(150, 100)).toBe(100);
  });

  it('rounds to nearest integer', () => {
    expect(calculateProgress(1, 3)).toBe(33);
    expect(calculateProgress(2, 3)).toBe(67);
  });
});

describe('getLevelBadge', () => {
  it('returns emoji string for each level range', () => {
    [1, 5, 10, 20, 30, 40, 50].forEach((level) => {
      expect(typeof getLevelBadge(level)).toBe('string');
    });
  });

  it('returns 🌟 for levels below 5', () => {
    expect(getLevelBadge(1)).toBe('🌟');
    expect(getLevelBadge(4)).toBe('🌟');
  });

  it('returns ✨ for levels 5-9', () => {
    expect(getLevelBadge(5)).toBe('✨');
    expect(getLevelBadge(9)).toBe('✨');
  });

  it('returns ⭐ for levels 10-19', () => {
    expect(getLevelBadge(10)).toBe('⭐');
  });

  it('returns 🏅 for levels >= 50', () => {
    expect(getLevelBadge(50)).toBe('🏅');
    expect(getLevelBadge(99)).toBe('🏅');
  });
});

describe('getStreakMultiplier', () => {
  it('returns 1.0 for 0 streak days', () => {
    expect(getStreakMultiplier(0)).toBe(1.0);
  });

  it('returns 1.1 for 3+ streak days', () => {
    expect(getStreakMultiplier(3)).toBe(1.1);
    expect(getStreakMultiplier(6)).toBe(1.1);
  });

  it('returns 1.25 for 7+ streak days', () => {
    expect(getStreakMultiplier(7)).toBe(1.25);
    expect(getStreakMultiplier(13)).toBe(1.25);
  });

  it('returns 1.5 for 14+ streak days', () => {
    expect(getStreakMultiplier(14)).toBe(1.5);
    expect(getStreakMultiplier(29)).toBe(1.5);
  });

  it('returns 2.0 for 30+ streak days', () => {
    expect(getStreakMultiplier(30)).toBe(2.0);
    expect(getStreakMultiplier(100)).toBe(2.0);
  });
});

describe('isAlmostUnlocked', () => {
  it('returns false when below 80%', () => {
    expect(isAlmostUnlocked(70, 100)).toBe(false);
    expect(isAlmostUnlocked(79, 100)).toBe(false);
  });

  it('returns true when between 80% and 99%', () => {
    expect(isAlmostUnlocked(80, 100)).toBe(true);
    expect(isAlmostUnlocked(95, 100)).toBe(true);
    expect(isAlmostUnlocked(99, 100)).toBe(true);
  });

  it('returns false when at 100%', () => {
    expect(isAlmostUnlocked(100, 100)).toBe(false);
  });

  it('returns false when above 100%', () => {
    expect(isAlmostUnlocked(110, 100)).toBe(false);
  });
});

describe('getCelebrationAnimation', () => {
  it('returns confetti for legendary', () => {
    expect(getCelebrationAnimation('legendary')).toBe('confetti');
  });

  it('returns sparkle for epic', () => {
    expect(getCelebrationAnimation('epic')).toBe('sparkle');
  });

  it('returns glow for rare', () => {
    expect(getCelebrationAnimation('rare')).toBe('glow');
  });

  it('returns bounce for common', () => {
    expect(getCelebrationAnimation('common')).toBe('bounce');
  });
});
