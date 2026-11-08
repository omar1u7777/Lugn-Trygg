import { test, expect, type Locator, type Page, type Route } from '@playwright/test';

/**
 * The sound player can be used in a short window.
 *
 * At 600 px tall the player panel took the whole height of the dialog and left
 * the track list none, the app's header (z-120) and bottom bar (z-50) were
 * drawn over the dialog (z-50), and Spela, Nästa and Stäng sat under other
 * elements: elementFromPoint at their centres hit something else, so a click
 * never reached them. Playback itself worked when triggered from script.
 *
 * Each control is scrolled into view the way a person would, then checked at
 * its centre: the point has to land on the control itself.
 */

const track = (category: string, n: number) => ({
  id: `${category}-${n}`,
  title: `${category === 'nature' ? 'Regn' : 'Piano'} ${n}`,
  artist: 'Lugn & Trygg',
  duration: '3:00',
  url: `https://example.invalid/${category}-${n}.mp3`,
  description: 'Ett lugnt spår för avslappning.',
  license: 'CC0',
});

const LIBRARY = {
  nature: {
    id: 'nature', name: 'Natur', icon: '🌧️', description: 'Naturljud',
    tracks: Array.from({ length: 6 }, (_, i) => track('nature', i + 1)),
  },
  piano: {
    id: 'piano', name: 'Piano', icon: '🎹', description: 'Lugnt piano',
    tracks: Array.from({ length: 6 }, (_, i) => track('piano', i + 1)),
  },
};

// The build calls the API on another origin with credentials, so a mocked
// response needs what a real one carries: CORS headers, and an answer to the
// preflight that names the headers the request asked for.
const fulfil = (route: Route, data: unknown) => {
  const request = route.request();
  const headers = {
    'access-control-allow-origin': 'http://localhost:3000',
    'access-control-allow-credentials': 'true',
    'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'access-control-allow-headers': request.headers()['access-control-request-headers'] ?? 'authorization, content-type',
  };
  if (request.method() === 'OPTIONS') {
    return route.fulfill({ status: 204, headers });
  }
  return route.fulfill({
    status: 200, headers, contentType: 'application/json', body: JSON.stringify({ success: true, data }),
  });
};

const openSounds = async (page: Page) => {
  await page.addInitScript(() => {
    localStorage.setItem('__e2e_test_auth__', JSON.stringify({
      token: 'sounds-e2e-token',
      user: { user_id: 'sounds-e2e-user', email: 'sounds@example.com', displayName: 'Ljud Test' },
    }));
    localStorage.setItem('__e2e_test_tier__', 'premium');
    localStorage.setItem('i18nextLng', 'sv');
  });
  await page.route('**/api/**', (route) => fulfil(route, {}));
  await page.route('**/api/v1/audio/library', (route) => fulfil(route, { library: LIBRARY }));

  await page.goto('/sounds');
  await expect(page.getByRole('button', { name: 'Regn 1' })).toBeAttached();
};

/** Scroll `target` into view and report what a click at its centre would hit. */
const hitAtCentre = async (target: Locator) => {
  await target.scrollIntoViewIfNeeded();
  return target.evaluate((element) => {
    const box = element.getBoundingClientRect();
    const x = box.left + box.width / 2;
    const y = box.top + box.height / 2;
    const hit = document.elementFromPoint(x, y);
    if (hit && (hit === element || element.contains(hit))) {
      return 'itself';
    }
    const describe = (node: Element | null) =>
      node ? `${node.tagName.toLowerCase()}.${String(node.className).split(' ').slice(0, 4).join('.')}` : 'nothing (outside the window)';
    return describe(hit);
  });
};

for (const viewport of [{ width: 1280, height: 600 }, { width: 1280, height: 480 }, { width: 390, height: 600 }]) {
  test.describe(`Sound player in a ${viewport.width}×${viewport.height} window`, () => {
    test.use({ viewport, serviceWorkers: 'block' });

    test('every track can be clicked', async ({ page }) => {
      await openSounds(page);

      for (const name of ['Regn 1', 'Regn 3', 'Regn 6']) {
        expect(await hitAtCentre(page.getByRole('button', { name })), name).toBe('itself');
      }
    });

    test('Spela, Nästa, Volym and Stäng can be clicked', async ({ page }) => {
      await openSounds(page);
      await page.getByRole('button', { name: 'Regn 1' }).click();
      // The test tracks cannot load, so the player shows an error above its
      // controls. Wait for that, so the controls are checked where they end up.
      await page.waitForLoadState('networkidle');

      for (const button of await page.getByRole('button', { name: /^(Spela|Pausa)$/ }).all()) {
        expect(await hitAtCentre(button), 'Spela').toBe('itself');
      }
      expect(await hitAtCentre(page.getByRole('button', { name: 'Nästa' })), 'Nästa').toBe('itself');
      expect(await hitAtCentre(page.getByRole('slider', { name: 'Volym' })), 'Volym').toBe('itself');
      for (const button of await page.getByRole('button', { name: 'Stäng' }).all()) {
        expect(await hitAtCentre(button), 'Stäng').toBe('itself');
      }
    });
  });
}
