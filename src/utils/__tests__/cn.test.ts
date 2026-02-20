import { cn } from '../cn';

describe('cn – Tailwind class merge utility', () => {
  it('returns empty string for no arguments', () => {
    expect(cn()).toBe('');
  });

  it('passes through a single class', () => {
    expect(cn('p-4')).toBe('p-4');
  });

  it('merges multiple classes', () => {
    expect(cn('p-4', 'text-white')).toBe('p-4 text-white');
  });

  it('resolves Tailwind conflicts (last wins)', () => {
    const result = cn('p-4', 'p-8');
    expect(result).toBe('p-8');
  });

  it('handles conditional classes (falsy values ignored)', () => {
    const isActive = false;
    const result = cn('bg-white', isActive && 'bg-blue-500');
    expect(result).toBe('bg-white');
  });

  it('handles conditional classes (truthy)', () => {
    const isActive = true;
    const result = cn('bg-white', isActive && 'bg-blue-500');
    // bg-blue-500 wins over bg-white since it comes last
    expect(result).toBe('bg-blue-500');
  });

  it('handles arrays', () => {
    const result = cn(['p-4', 'text-sm']);
    expect(result).toBe('p-4 text-sm');
  });

  it('handles objects (clsx style)', () => {
    const result = cn({ 'p-4': true, 'text-lg': false, 'font-bold': true });
    expect(result).toBe('p-4 font-bold');
  });

  it('undefined and null values are ignored', () => {
    expect(cn(undefined, null, 'px-2')).toBe('px-2');
  });

  it('merges complex conflicting utilities', () => {
    // tailwind-merge should keep only the last conflicting utility
    const result = cn('text-red-500 text-lg', 'text-blue-500');
    expect(result).toBe('text-lg text-blue-500');
  });
});
