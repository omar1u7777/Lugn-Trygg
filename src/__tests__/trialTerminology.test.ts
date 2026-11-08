/**
 * One name for the trial: "Provperiod".
 *
 * The profile and the upsell said "Provperiod", the banner on premium pages
 * said "Gratisperiod aktiv", and the plan labels on /upgrade and under the
 * premium gate said "Testperiod": three names for one thing. A scan, because
 * the failure is someone typing another word into a component.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const SRC = join(process.cwd(), 'src');
const OTHER_NAMES = /gratisperiod|testperiod/i;

const sourceFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      return entry === '__tests__' || entry === 'node_modules' ? [] : sourceFiles(path);
    }
    return /\.(tsx?|json)$/.test(entry) && !/\.test\.tsx?$/.test(entry) ? [path] : [];
  });

describe('trial terminology', () => {
  it('calls the trial "Provperiod" everywhere', () => {
    const offenders = sourceFiles(SRC)
      .filter((path) => OTHER_NAMES.test(readFileSync(path, 'utf8')))
      .map((path) => relative(process.cwd(), path));

    expect(offenders).toEqual([]);
  });
});
