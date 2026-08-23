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
