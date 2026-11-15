import { test, expect, type Page } from '@playwright/test';
import { signInWithMockApi } from './support/mockApp';

/**
 * Every page has a main heading, and every control has a name.
 *
 * A walk through the app found ten pages without an <h1>, form fields a screen
 * reader announces only as "edit text" or "combo box" (the note fields, search
 * fields, volume sliders, two selects, a checkbox), and an icon button with no
 * name on /social.
 */

const PAGES = [
  '/dashboard', '/mood-basic', '/mood-list', '/analytics', '/ai-chat/insights', '/mood/assessment',
  '/mood/forecast', '/badges', '/rewards', '/sounds', '/subscribe', '/journal', '/wellness',
  '/weekly-analysis', '/social', '/profile?tab=privacy', '/recommendations', '/integrations',
];

const unnamedControls = (page: Page) =>
  page.evaluate(() => {
    const visible = (el: Element) => {
      const box = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return box.width > 0 && box.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
    };
    const labelledBy = (el: Element) =>
      (el.getAttribute('aria-labelledby') ?? '').split(/\s+/).filter(Boolean)
        .map((id) => document.getElementById(id)?.textContent?.trim() ?? '').join(' ');
    const name = (el: Element) =>
      el.getAttribute('aria-label')?.trim() || labelledBy(el) || el.getAttribute('title')?.trim() || '';
    const describe = (el: Element) =>
      `<${el.tagName.toLowerCase()} .${String(el.className).split(' ')[0]}${el.getAttribute('type') ? ` type=${el.getAttribute('type')}` : ''}` +
      `${el.id ? ` #${el.id}` : ''}${el.getAttribute('placeholder') ? ` placeholder="${el.getAttribute('placeholder')}"` : ''}>`;

    const fields = [...document.querySelectorAll('input, select, textarea')]
      .filter((el) => !['hidden', 'submit', 'button'].includes(el.getAttribute('type') ?? '') && visible(el))
      .filter((el) => {
        const input = el as HTMLInputElement;
        const hasLabel = (input.labels?.length ?? 0) > 0 && [...(input.labels ?? [])].some((l) => l.textContent?.trim());
        return !hasLabel && !name(el);
      });
    const buttons = [...document.querySelectorAll('button, [role="button"], a[href]')]
      .filter(visible)
      .filter((el) => !(el.textContent?.trim() || name(el) || el.querySelector('img[alt]:not([alt=""]), svg[aria-label], [aria-label]')));

    return [...fields, ...buttons].map(describe);
  });

test.use({ serviceWorkers: 'block' });

test.describe('Headings and names', () => {
  test.beforeEach(async ({ page }) => {
    await signInWithMockApi(page);
  });

  for (const path of PAGES) {
    test(`${path} has one main heading and no unnamed control`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      await expect(page.locator('#root')).not.toBeEmpty();

      expect.soft(await page.locator('h1').count(), 'number of <h1>').toBe(1);
      expect(await unnamedControls(page)).toEqual([]);
    });
  }
});
