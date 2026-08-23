/**
 * accessibilityAudit had no tests at all, and its four typed audit methods
 * declared a return type no value could satisfy:
 *
 *     Promise<AuditResult & { details: ColorContrastResult[] }>
 *
 * The intersection was meant to override `details`, which is declared
 * `Record<string, unknown>` on AuditResult. Intersections do not override,
 * they intersect — so `details` had to be a string-keyed record AND an array
 * simultaneously. Arrays carry a numeric index signature, so nothing could
 * ever be assigned, and every one of those methods was uninhabitable.
 *
 * These pin the shape those signatures now promise, and the contrast maths
 * underneath it, because the parser was edited at the same time.
 *
 * Everything goes through the public auditColorContrast rather than the
 * parser, which is a closure with no way in from outside. That also fixes
 * which branch of it runs: getComputedStyle normalises colour to rgb() in
 * jsdom and in browsers alike, so the rgb() branch is the one production
 * exercises. The #RGB and #RRGGBB branches are consequently NOT covered here
 * and cannot be from this direction.
 */

import { beforeEach, describe, expect, it } from 'vitest';

import { AccessibilityAuditor } from '../accessibilityAudit';

const auditor = AccessibilityAuditor.getInstance();

/** Render one <p> with explicit colours and audit it. */
const auditWith = async (color: string, background: string) => {
  document.body.innerHTML =
    `<p style="color: ${color}; background-color: ${background}; font-size: 16px">text</p>`;
  return auditor.auditColorContrast();
};

describe('auditColorContrast', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('reports details as an array, not a string-keyed record', async () => {
    // The regression the type error was hiding: this method has always
    // returned an array here, while its signature demanded a Record too.
    const result = await auditWith('rgb(0, 0, 0)', 'rgb(255, 255, 255)');

    expect(Array.isArray(result.details)).toBe(true);
    expect(result.details[0]).toMatchObject({
      isCompliant: expect.any(Boolean),
      ratio: expect.any(Number),
      requiredRatio: expect.any(Number),
    });
  });

  it('gives black on white the WCAG maximum of 21:1', async () => {
    // 21 is the highest ratio the formula can produce, so this pins both the
    // relative-luminance maths and the rgb() parsing in one assertion.
    const result = await auditWith('rgb(0, 0, 0)', 'rgb(255, 255, 255)');

    expect(result.details[0]?.ratio).toBeCloseTo(21, 1);
    expect(result.details[0]?.isCompliant).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it('weights the channels the way WCAG does, in the right order', async () => {
    // Every other case here is achromatic — black, white, grey — where r, g
    // and b are equal and a parser that swapped two channels would still pass
    // all of them. These two colours are the check that they are not
    // interchangeable.
    //
    // Relative luminance weights the channels 0.2126 R, 0.7152 G, 0.0722 B, so
    // against white, pure red lands near 4:1 and pure blue near 8.6:1 — from
    // the same three bytes in a different order.
    const red = await auditWith('rgb(255, 0, 0)', 'rgb(255, 255, 255)');
    const blue = await auditWith('rgb(0, 0, 255)', 'rgb(255, 255, 255)');

    expect(red.details[0]?.ratio).toBeCloseTo(4.0, 1);
    expect(blue.details[0]?.ratio).toBeCloseTo(8.59, 1);
  });

  it('is symmetric — the order of the two colours cannot matter', async () => {
    const dark = await auditWith('rgb(0, 0, 0)', 'rgb(255, 255, 255)');
    const light = await auditWith('rgb(255, 255, 255)', 'rgb(0, 0, 0)');

    expect(light.details[0]?.ratio).toBeCloseTo(dark.details[0]?.ratio ?? 0, 5);
  });

  it('flags text that does not meet 4.5:1 at normal size', async () => {
    // Mid grey on white is ~3.9:1 — passes for large text, fails for normal.
    const result = await auditWith('rgb(140, 140, 140)', 'rgb(255, 255, 255)');

    expect(result.details[0]?.requiredRatio).toBe(4.5);
    expect(result.details[0]?.isCompliant).toBe(false);
    expect(result.violations.length).toBeGreaterThan(0);
    expect(result.passed).toBe(false);
  });

  it('scores 100 only when nothing is flagged', async () => {
    const clean = await auditWith('rgb(0, 0, 0)', 'rgb(255, 255, 255)');
    expect(clean.score).toBe(100);

    const dirty = await auditWith('rgb(140, 140, 140)', 'rgb(255, 255, 255)');
    expect(dirty.score).toBeLessThan(100);
  });

  it('returns an empty array rather than throwing when there is no text', async () => {
    document.body.innerHTML = '';
    const result = await auditor.auditColorContrast();

    expect(result.details).toEqual([]);
    expect(result.passed).toBe(true);
  });
});
