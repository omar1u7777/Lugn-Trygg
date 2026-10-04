import { describe, it, expect } from 'vitest';
import { svCount } from '../plural';

describe('svCount', () => {
  it('uses the singular only for exactly one', () => {
    expect(svCount(1, 'dag', 'dagar')).toBe('1 dag');
    expect(svCount(0, 'dag', 'dagar')).toBe('0 dagar');
    expect(svCount(2, 'vecka', 'veckor')).toBe('2 veckor');
  });
});
