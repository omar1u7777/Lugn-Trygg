/**
 * Every address the app links to inside itself is one it serves.
 *
 * NAV_LINKS in appFeatures.ts still pointed at /mood-logger after that route
 * was removed, and "Kontakta oss" on /upgrade navigated to /support, which was
 * never a route: both land on the 404 page. A scan, because the failure is
 * someone typing a path into a component.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { ROUTES } from '../appRoutes';

const SRC = join(process.cwd(), 'src');

const sourceFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      return entry === '__tests__' || entry === 'node_modules' ? [] : sourceFiles(path);
    }
    return /\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry) ? [path] : [];
  });

// navigate('/x'), <Link to="/x">, <a href="/x">, and { path: '/x' } in config.
const LINK = /(?:navigate\(\s*|\bto=\{?\s*|\bhref=\{?\s*|\bpath:\s*)['"`](\/[^'"`?#$\s]*)/g;

// The redirects App.tsx declares beside ROUTES (/settings, /privacy, ...).
const redirectPaths = [...readFileSync(join(SRC, 'App.tsx'), 'utf8').matchAll(/<Route\s+path="([^"*]+)"/g)]
  .map((match) => match[1] ?? '');

const served = [...ROUTES.map((route) => route.path), ...redirectPaths].map(
  (path) => new RegExp(`^${path.replace(/:[^/]+/g, '[^/]+')}/?$`),
);

const isServed = (path: string) => served.some((route) => route.test(path));

describe('internal links', () => {
  it('point only at routes the app serves', () => {
    const dead = sourceFiles(SRC).flatMap((file) =>
      [...readFileSync(file, 'utf8').matchAll(LINK)]
        .map((match) => match[1] ?? '')
        .filter((path) => !isServed(path))
        .map((path) => `${relative(process.cwd(), file)}: ${path}`),
    );

    expect(dead).toEqual([]);
  });

  it('recognises the links it is meant to check', () => {
    // Guards the scan itself: a pattern that matched nothing would pass above.
    const upgrade = readFileSync(join(SRC, 'pages', 'UpgradePage.tsx'), 'utf8');
    expect([...upgrade.matchAll(LINK)].length).toBeGreaterThan(0);
    expect(isServed('/mood/advanced')).toBe(true);
    expect(isServed('/settings')).toBe(true);
    expect(isServed('/mood-logger')).toBe(false);
  });
});
