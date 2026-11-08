/**
 * The frontend is served with a Content-Security-Policy that stops injected
 * script.
 *
 * vercel.json set six security headers and no CSP, and index.html had none in
 * a meta tag, so one XSS bug in a health app would run whatever it was given.
 * The policy only protects if script-src refuses inline script and eval, so
 * the app must not depend on either: no inline <script> in index.html, no
 * eval or new Function in src. tests/e2e/csp.spec.ts runs the built app under
 * this exact policy and fails on any violation.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();

interface HeaderRule {
  source: string;
  headers: Array<{ key: string; value: string }>;
}

const vercel = JSON.parse(readFileSync(join(ROOT, 'vercel.json'), 'utf8')) as { headers: HeaderRule[] };

const appliesTo = (rule: HeaderRule, path: string) => new RegExp(`^${rule.source}$`).test(path);
const isPolicy = (header: { key: string }) => header.key.toLowerCase() === 'content-security-policy';
const policyRules = vercel.headers.filter((rule) => rule.headers.some(isPolicy));

const policy = policyRules
  .filter((rule) => appliesTo(rule, '/dashboard'))
  .flatMap((rule) => rule.headers)
  .find(isPolicy)?.value ?? '';

const directives = new Map(
  policy.split(';').map((part) => part.trim()).filter(Boolean).map((part) => {
    const [name = '', ...sources] = part.split(/\s+/);
    return [name, sources] as const;
  }),
);

const sourceFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      return entry === '__tests__' || entry === 'node_modules' ? [] : sourceFiles(path);
    }
    return /\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry) ? [path] : [];
  });

describe('Content-Security-Policy', () => {
  it('is sent with every page', () => {
    expect(policy).not.toBe('');
    for (const path of ['/', '/login', '/dashboard', '/index.html', '/assets/js/main.js']) {
      expect(policyRules.some((rule) => appliesTo(rule, path)), path).toBe(true);
    }
  });

  it('is not sent with the service worker script', () => {
    // A service worker runs under the policy of its own script, and sw.js
    // fetches images, fonts, audio and API responses from other origins on
    // the page's behalf. The page's policy has already allowed each of those
    // requests before the worker sees it.
    expect(policyRules.some((rule) => appliesTo(rule, '/sw.js'))).toBe(false);
  });

  it('runs only script the app ships, never inline script or eval', () => {
    const scripts = directives.get('script-src') ?? [];

    expect(scripts).toContain("'self'");
    expect(scripts).not.toContain("'unsafe-inline'");
    expect(scripts).not.toContain("'unsafe-eval'");
    expect(scripts.filter((source) => source === '*' || source === 'https:' || source === 'data:')).toEqual([]);
  });

  it('closes the other ways in', () => {
    expect(directives.get('default-src')).toEqual(["'self'"]);
    expect(directives.get('object-src')).toEqual(["'none'"]);
    expect(directives.get('base-uri')).toEqual(["'self'"]);
    expect(directives.get('frame-ancestors')).toEqual(["'none'"]);
    expect(directives.get('form-action')).toEqual(["'self'"]);
  });
});

describe('What the policy requires of the app', () => {
  it('index.html has no inline script', () => {
    const html = readFileSync(join(ROOT, 'index.html'), 'utf8').replace(/<!--[\s\S]*?-->/g, '');
    const inline = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)]
      .filter(([, attributes = '', body = '']) => !/\bsrc=/.test(attributes) || body.trim() !== '');

    expect(inline.map(([tag]) => tag.slice(0, 80))).toEqual([]);
  });

  it('src evaluates no strings as code', () => {
    const offenders = sourceFiles(join(ROOT, 'src'))
      .filter((path) => /\bnew Function\(|(?<![.\w])eval\(/.test(readFileSync(path, 'utf8')))
      .map((path) => relative(ROOT, path));

    expect(offenders).toEqual([]);
  });
});
