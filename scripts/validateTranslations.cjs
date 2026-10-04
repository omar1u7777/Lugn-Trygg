// Fails if locale files contain untranslated keys (identical to Swedish) that are not allowlisted.
const fs = require('fs');
const path = require('path');

const localesDir = path.join(__dirname, '..', 'src', 'i18n', 'locales');
const configPath = path.join(__dirname, '..', 'src', 'i18n', 'translation-validation-config.json');

const sv = JSON.parse(fs.readFileSync(path.join(localesDir, 'sv.json'), 'utf-8'));
const en = JSON.parse(fs.readFileSync(path.join(localesDir, 'en.json'), 'utf-8'));
const no = JSON.parse(fs.readFileSync(path.join(localesDir, 'no.json'), 'utf-8'));

let config = { allowedIdentical: {} };
if (fs.existsSync(configPath)) {
  config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
}

const allowedIdentical = config.allowedIdentical || {};

const isAllowed = (lang, key) => {
  const allowed = allowedIdentical[lang] || [];
  return allowed.some(rule => {
    if (rule === '*') return true;
    if (rule.endsWith('.*')) {
      return key === rule.slice(0, -2) || key.startsWith(rule.slice(0, -1));
    }
    return key === rule;
  });
};

const findMissing = (source, target, path = '') => {
  const missing = [];
  for (const key of Object.keys(source)) {
    const currentPath = path ? `${path}.${key}` : key;
    if (typeof source[key] === 'object' && source[key] !== null && !Array.isArray(source[key])) {
      if (typeof target[key] !== 'object' || target[key] === null || Array.isArray(target[key])) {
        missing.push(currentPath);
      } else {
        missing.push(...findMissing(source[key], target[key], currentPath));
      }
    } else if (target[key] === undefined) {
      missing.push(currentPath);
    }
  }
  return missing;
};

const findIdentical = (source, target, path = '') => {
  const identical = [];
  for (const key of Object.keys(source)) {
    const currentPath = path ? `${path}.${key}` : key;
    if (typeof source[key] === 'object' && source[key] !== null && !Array.isArray(source[key])) {
      if (typeof target[key] === 'object' && target[key] !== null && !Array.isArray(target[key])) {
        identical.push(...findIdentical(source[key], target[key], currentPath));
      }
    } else if (typeof source[key] === 'string' && typeof target[key] === 'string' && source[key] === target[key]) {
      identical.push(currentPath);
    }
  }
  return identical;
};

/*
 * Symmetric on purpose. This used to be findMissing(sv, no) and
 * findMissing(sv, en) only, which asks "does every Swedish key exist in the
 * other two" and never the reverse — so loginForm.loginTitle and
 * loginForm.welcomeBack sat in en and no but not sv, and the gate passed.
 */
const missing = {
  no: [...findMissing(sv, no), ...findMissing(en, no)],
  en: [...findMissing(sv, en), ...findMissing(no, en)],
  sv: [...findMissing(en, sv), ...findMissing(no, sv)],
};
Object.keys(missing).forEach(lang => {
  missing[lang] = [...new Set(missing[lang])].sort();
});

const identical = {
  no: findIdentical(sv, no).filter(key => !isAllowed('no', key)),
  en: findIdentical(sv, en).filter(key => !isAllowed('en', key)),
};

const hasMissing = Object.values(missing).some(arr => arr.length > 0);
if (hasMissing) {
  console.error('\u274C Build stopped: locale files contain missing keys. Run "python sync_translations.py" to add them.');
  Object.entries(missing).forEach(([lang, keys]) => {
    if (keys.length > 0) {
      console.error(`Missing in ${lang}: ${keys.length} keys`);
      keys.slice(0, 10).forEach(key => console.error(`  - ${key}`));
    }
  });
  process.exit(1);
}

Object.entries(identical).forEach(([lang, keys]) => {
  if (keys.length > 0) {
    console.warn(`\u26A0\uFE0F Identical to Swedish in ${lang}: ${keys.length} keys (review in translation-validation-config.json if needed)`);
    keys.slice(0, 5).forEach(key => console.warn(`  - ${key}`));
  }
});

// ---------------------------------------------------------------------------
// Keys the CODE asks for that no locale defines.
//
// Comparing the locale files against each other cannot catch this: a key that
// is missing from all three is symmetric, and symmetric looked healthy. That is
// how the user menu came to render the literal string "navigation.logout" —
// and it was not alone. Nine keys reached users as raw text; the QA pass that
// prompted this found one of them.
// ---------------------------------------------------------------------------

const srcDir = path.join(__dirname, '..', 'src');

/** Static t('a.b') only. Template literals are dynamic and unresolvable here. */
const BARE_CALL = /\bt\(\s*['"]([A-Za-z0-9_.]+)['"]\s*\)/g;
const CALL_WITH_FALLBACK = /\bt\(\s*['"]([A-Za-z0-9_.]+)['"]\s*,/g;

/*
 * Not display strings: these read a whole subtree via returnObjects and the
 * call sites type the result as `| undefined` and handle its absence. Flagging
 * them would train people to ignore this check.
 */
const STRUCTURED_LOOKUPS = new Set(['dashboard.goalSteps', 'recommendationsPool']);

/*
 * Keys used with a hardcoded fallback. The fallback is Swedish, so these render
 * Swedish in every locale — an i18n leak rather than a broken-looking screen,
 * which is why it is a ratchet and not an error.
 *
 * Lower it whenever you move some into the locale files. Do not raise it.
 */
const MAX_FALLBACK_ONLY_KEYS = 459;

const collectSources = (dir, acc = []) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== '__tests__' && entry.name !== 'node_modules') collectSources(full, acc);
    } else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
      acc.push(full);
    }
  }
  return acc;
};

const flatten = (obj, prefix = '', out = new Set()) => {
  for (const [key, value] of Object.entries(obj)) {
    const full = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) flatten(value, full, out);
    else out.add(full);
  }
  return out;
};

const definedKeys = flatten(sv);
const bareKeys = new Set();
const fallbackKeys = new Set();

const sourceFiles = collectSources(srcDir);
if (sourceFiles.length === 0) {
  console.error('❌ Build stopped: no source files scanned — this check would pass vacuously.');
  process.exit(1);
}

for (const file of sourceFiles) {
  const text = fs.readFileSync(file, 'utf-8');
  for (const m of text.matchAll(BARE_CALL)) bareKeys.add(m[1]);
  for (const m of text.matchAll(CALL_WITH_FALLBACK)) fallbackKeys.add(m[1]);
}

const rawKeyLeaks = [...bareKeys]
  .filter(key => !definedKeys.has(key))
  .filter(key => !fallbackKeys.has(key))
  .filter(key => !STRUCTURED_LOOKUPS.has(key))
  .sort();

if (rawKeyLeaks.length > 0) {
  console.error('❌ Build stopped: these keys are used in the UI but defined in no locale.');
  console.error('   Users see the key itself, e.g. "navigation.logout" where "Logga ut" belongs.');
  rawKeyLeaks.forEach(key => console.error(`  - ${key}`));
  process.exit(1);
}

const fallbackOnly = [...fallbackKeys].filter(key => !definedKeys.has(key));
console.log(`Keys relying on a hardcoded fallback: ${fallbackOnly.length} (ceiling ${MAX_FALLBACK_ONLY_KEYS})`);
if (fallbackOnly.length > MAX_FALLBACK_ONLY_KEYS) {
  console.error(`❌ Build stopped: ${fallbackOnly.length} keys rely on a hardcoded fallback, ceiling is ${MAX_FALLBACK_ONLY_KEYS}.`);
  console.error('   A fallback is Swedish, so these render Swedish in every language.');
  fallbackOnly.slice(0, 10).forEach(key => console.error(`  - ${key}`));
  process.exit(1);
}
